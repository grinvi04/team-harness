#!/usr/bin/env bash
# pr-merge.sh — 머지 단일 경로(래퍼). guard.sh가 맨손 `gh pr merge`를 차단하므로,
# 머지는 이 스크립트를 통해서만 한다(내부 gh는 자식 프로세스라 PreToolUse 훅에 안 걸린다).
# 머지 *전에* 게이트를 직접 검증한다 — CI required green · 미해결 리뷰 스레드 0 · mergeable.
# 게이트를 통과하지 못하면 머지하지 않고 종료(게이트가 머지 경로에 박혀 건너뛸 수 없음).
#
# 사용: pr-merge.sh [<PR#>] [--base <branch>] [--auto]   (PR# 생략 시 현재 브랜치의 PR)
#   --auto: develop 전용 자동머지 — base가 develop이 아니면 거부(exit 3). settings allow-rule과 짝.
#   브랜치 보호(승인 요건) 해제·복구는 이 스크립트가 하지 않는다 — solo-merge가 별도로 감싼다.
#   머지 성공 후 로컬 head 브랜치도 정리한다(원격은 --delete-branch·repo delete_branch_on_merge로 삭제).
#   안전: origin/<base>에 브랜치 tip이 포함(=머지됨)일 때만 삭제 — 미머지 로컬 커밋을 유실하지 않는다.
set -euo pipefail

# --auto(develop 전용 자동머지) 정책: base가 develop이 아니면 거부. gh와 분리한 순수 함수라
# 테스트가 주입해 검증한다(tests/pr-merge-auto-test.sh). 안전의 1차 보증 = 이 base 강제(매처 아님).
require_develop_base() {
  local base="$1"
  [ "$base" = "develop" ] && return 0
  echo "  ⛔ --auto는 develop 전용 자동머지 — 이 PR base=$base." >&2
  echo "     main 머지는 /release·/hotfix 경로 또는 명시 승인으로(자동머지 대상 아님)." >&2
  return 3
}

# ── 게이트 본체(순수 판정 함수) — gh 호출과 분리해 테스트가 주입 검증(tests/pr-merge-auto-test.sh).
#    main은 gh로 값을 얻어 이 함수들에 넘긴다(판정 로직 단일 출처 = 함수). ──

# CI 게이트 판정: `gh pr checks --required`의 (rc, out)만 받아 판정 문자열을 echo.
#   green    = required 통과            (rc 0)
#   none     = required check 없음→통과 (rc 0)
#   fallback = checks API 접근 불가(토큰 제한) → Actions run 폴백 필요(호출부가 처리, rc 0)
#   fail     = 그 외 미통과 → 머지 중단 (rc 1)
classify_ci_gate() {
  local rc="$1" out="$2"
  if [ "$rc" -eq 0 ]; then echo green; return 0; fi
  # 실제 체크 행(NAME<TAB>STATE<TAB>…)에 비-통과 상태가 있으면 API 접근 실패가 아니라 진짜 미통과 → fail.
  #   에러토큰(GraphQL 등) 검사보다 **먼저** — 실패 체크의 '이름'에 GraphQL이 들어가도 fallback으로 오판하지 않게(#199).
  if printf '%s' "$out" | awk -F'\t' 'NF>=2 && $2 ~ /^(fail|failing|failure|pending|error|cancel|cancelled|timed_out|action_required|expected|stale|queued|waiting|in_progress)$/{f=1} END{exit !f}'; then echo fail; return 1; fi
  if printf '%s' "$out" | grep -qiE "no checks|no required"; then echo none; return 0; fi
  if printf '%s' "$out" | grep -qiE "not accessible|GraphQL|Resource not accessible"; then echo fallback; return 0; fi
  echo fail; return 1
}

# 미해결 리뷰 스레드 게이트: "0"만 통과. ""·"ERR"·"1"+ 는 fail-CLOSED(쿼리 실패=검증 불가=중단).
gate_threads() { [ "$1" = "0" ]; }

# mergeable 게이트: "MERGEABLE"만 통과. UNKNOWN·CONFLICTING 등은 fail(충돌/계산 미완).
gate_mergeable() { [ "$1" = "MERGEABLE" ]; }

# --auto 안전 계약: 무인 자동머지는 CI가 **서버-강제**(required status check 존재)여야 성립한다.
# required check가 없으면(verdict=none) CI-green을 보장할 수 없어 자동머지는 거부(fail-CLOSED).
# 수동 머지(auto=0)는 none도 허용 — 사람이 책임지고 머지(무인 자동화만 서버강제를 요구).
auto_ci_ok() { # verdict, auto → rc0 허용 / rc1 거부(none + --auto)
  { [ "$1" = "none" ] && [ "$2" = "1" ]; } && return 1
  return 0
}

# 머지 후 로컬 정리 시 checkout 대상 결정(순수): 현재 브랜치가 삭제될 head면 base로 이동(빈 base면
# develop 폴백), 아니면 이동 불필요(빈 문자열). 삭제될 브랜치 위에 남지 않게 하는 로직 — 테스트가 주입 검증.
merge_cleanup_checkout() { # head base current → echo checkout 대상("" = 이동 불필요)
  [ "$3" = "$1" ] && printf '%s' "${2:-develop}"
  return 0
}

# 테스트 훅: 함수만 로드하고 종료(main 로직·gh 호출 없이 순수 판정 함수만 검증).
[ -n "${PRMERGE_SOURCE_ONLY:-}" ] && return 0 2>/dev/null || true

PR="" BASE="" AUTO=0
while [ $# -gt 0 ]; do
  case "$1" in
    --auto) AUTO=1; shift;;
    --base) BASE="${2:-}"; shift 2;;
    -*) echo "pr-merge.sh: 알 수 없는 인자 '$1'" >&2; exit 2;;
    *) PR="$1"; shift;;
  esac
done

OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
[ -z "$PR" ] && PR=$(gh pr view --json number --jq .number)
OWNER="${OWNER_REPO%/*}"; NAME="${OWNER_REPO#*/}"
echo "게이트 검증: $OWNER_REPO PR #$PR"

# --auto: 이 PR의 실제 base가 develop인지 강제(아니면 거부). 게이트 검증 전 선차단.
if [ "$AUTO" = "1" ]; then
  PR_BASE=$(gh pr view "$PR" --repo "$OWNER_REPO" --json baseRefName --jq .baseRefName)
  require_develop_base "$PR_BASE" || exit 3
  echo "  --auto: base=develop 확인"
fi

# 1) CI 검증 — 1차: gh pr checks(외부 CI 포함). 토큰이 checks API를 못 읽으면(GraphQL 403)
#    2차: Actions run(gh run list)으로 이 커밋의 워크플로 결과를 폴백 검증.
# 주의: set -e라 `VAR=$(실패명령)`는 RC 캡처 전에 스크립트를 죽인다 → `|| CHECKS_RC=$?`로 흡수.
CHECKS_RC=0
CHECKS_OUT=$(gh pr checks "$PR" --repo "$OWNER_REPO" --required 2>&1) || CHECKS_RC=$?
CI_VERDICT=$(classify_ci_gate "$CHECKS_RC" "$CHECKS_OUT") || true
# --auto는 required check가 없으면(none) 거부 — 자동머지의 CI-green 보장은 서버-강제 required check 전제.
if ! auto_ci_ok "$CI_VERDICT" "$AUTO"; then
  echo "  ⛔ --auto 거부: 이 브랜치에 required status check 없음(none) — 자동머지는 서버-강제 CI가 전제." >&2
  echo "     set-branch-protection.sh <repo> --contexts <a,b>로 등록 후 재시도, 또는 --auto 없이 수동 머지." >&2
  exit 1
fi
if [ "$CI_VERDICT" = "green" ]; then
  echo "  CI: required green"
elif [ "$CI_VERDICT" = "none" ]; then
  echo "  CI: required check 없음 → 통과"
elif [ "$CI_VERDICT" = "fallback" ]; then
  # 토큰이 checks API 접근 불가 → Actions run으로 폴백(이 커밋 한정)
  HEAD_SHA=$(gh pr view "$PR" --repo "$OWNER_REPO" --json headRefOid --jq .headRefOid)
  HBRANCH=$(gh pr view "$PR" --repo "$OWNER_REPO" --json headRefName --jq .headRefName)
  # S3: gh run list를 1회만 호출하고 결과를 재사용(동일 쿼리 2회 중복 제거).
  RUNS_JSON=$(gh run list --repo "$OWNER_REPO" --branch "$HBRANCH" --limit 30 --json headSha,status,conclusion 2>/dev/null || echo '[]')
  RUNCOUNT=$(printf '%s' "$RUNS_JSON" | python3 -c "import sys,json; r=json.load(sys.stdin); print(len([x for x in r if x['headSha']=='$HEAD_SHA']))" 2>/dev/null || echo 0)
  BADCOUNT=$(printf '%s' "$RUNS_JSON" | python3 -c "import sys,json; r=json.load(sys.stdin); print(len([x for x in r if x['headSha']=='$HEAD_SHA' and (x['status']!='completed' or x['conclusion']!='success')]))" 2>/dev/null || echo ERR)
  if [ "$RUNCOUNT" = "0" ]; then
    echo "  ⛔ CI: checks API 접근 불가 + 이 커밋의 Actions run 없음 — 검증 불가, 머지 중단" >&2; exit 1
  elif [ "$BADCOUNT" != "0" ]; then
    echo "  ⛔ CI: 미완료/실패 Actions run 있음(또는 조회 실패=$BADCOUNT) — 머지 중단" >&2; exit 1
  fi
  echo "  CI: Actions run 폴백 검증 통과 (checks API 토큰 제한)"
else
  echo "  ⛔ CI required check 미통과 — 머지 중단" >&2; echo "$CHECKS_OUT" | head -3 >&2; exit 1
fi

# 2) 미해결 리뷰 스레드 0 — fail-CLOSED(쿼리 실패=검증 불가 → 중단). CI·mergeable 게이트와 일관.
UNRESOLVED=$(gh api graphql -f query='query($o:String!,$n:String!,$p:Int!){repository(owner:$o,name:$n){pullRequest(number:$p){reviewThreads(first:100){nodes{isResolved}}}}}' \
  -F o="$OWNER" -F n="$NAME" -F p="$PR" \
  --jq '[.data.repository.pullRequest.reviewThreads.nodes[]|select(.isResolved==false)]|length' 2>/dev/null) || UNRESOLVED="ERR"
if ! gate_threads "$UNRESOLVED"; then
  echo "  ⛔ 미해결 리뷰 스레드 미통과(값=$UNRESOLVED · ERR=API오류) — 머지 중단" >&2; exit 1
fi
echo "  미해결 스레드: 0"

# 3) mergeable — push 직후 GitHub가 비동기 계산 중이면 UNKNOWN을 줄 수 있어 잠깐 폴링.
MERGEABLE=""
for _ in 1 2 3 4; do
  MERGEABLE=$(gh pr view "$PR" --repo "$OWNER_REPO" --json mergeable --jq .mergeable)
  [ "$MERGEABLE" != "UNKNOWN" ] && break
  sleep 2
done
if ! gate_mergeable "$MERGEABLE"; then
  echo "  ⛔ mergeable=$MERGEABLE (충돌 또는 계산 미완) — 머지 중단" >&2; exit 1
fi
echo "  mergeable: MERGEABLE"

echo "게이트 통과 → 머지"
gh pr merge "$PR" --repo "$OWNER_REPO" --merge --delete-branch
echo "✅ PR #$PR 머지 완료"

# 로컬 head 브랜치 정리 — 원격은 --delete-branch로 삭제됨(로컬 복사본은 수동 삭제해야 누적을 막음).
# 안전: origin/<base>에 브랜치 tip이 포함(=머지됨)일 때만 -D — 미머지 로컬 커밋 유실 방지.
HEAD_BRANCH=$(gh pr view "$PR" --repo "$OWNER_REPO" --json headRefName --jq .headRefName 2>/dev/null) || HEAD_BRANCH=""
if [ -n "$HEAD_BRANCH" ] && git show-ref --verify --quiet "refs/heads/$HEAD_BRANCH"; then
  CB_BASE=$(gh pr view "$PR" --repo "$OWNER_REPO" --json baseRefName --jq .baseRefName 2>/dev/null) || CB_BASE=""
  git fetch origin --quiet 2>/dev/null || true
  if git merge-base --is-ancestor "$HEAD_BRANCH" "origin/${CB_BASE:-main}" 2>/dev/null; then
    CB_CO=$(merge_cleanup_checkout "$HEAD_BRANCH" "$CB_BASE" "$(git branch --show-current 2>/dev/null || echo)")
    if [ -n "$CB_CO" ]; then git checkout "$CB_CO" --quiet 2>/dev/null || true; fi
    git branch -D "$HEAD_BRANCH" >/dev/null 2>&1 && echo "🧹 로컬 브랜치 삭제: $HEAD_BRANCH (원격은 이미 삭제됨)" || true
  else
    echo "ℹ️ 로컬 '$HEAD_BRANCH' 보존 — origin/${CB_BASE:-main}에 미포함(미머지 커밋 가능)"
  fi
fi

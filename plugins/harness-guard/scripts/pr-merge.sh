#!/usr/bin/env bash
# pr-merge.sh — 머지 단일 경로(래퍼). guard.sh가 맨손 `gh pr merge`를 차단하므로,
# 머지는 이 스크립트를 통해서만 한다(내부 gh는 자식 프로세스라 PreToolUse 훅에 안 걸린다).
# 머지 *전에* 게이트를 직접 검증한다 — CI required green · 미해결 리뷰 스레드 0 · mergeable.
# 게이트를 통과하지 못하면 머지하지 않고 종료(게이트가 머지 경로에 박혀 건너뛸 수 없음).
#
# 사용: pr-merge.sh [<PR#>] [--base <branch>] [--auto]   (PR# 생략 시 현재 브랜치의 PR)
#   --auto: develop 전용 자동머지 — base가 develop이 아니면 거부(exit 3). settings allow-rule과 짝.
#   브랜치 보호(승인 요건) 해제·복구는 이 스크립트가 하지 않는다 — solo-merge가 별도로 감싼다.
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

# 테스트 훅: 함수만 로드하고 종료(main 로직·gh 호출 없이 require_develop_base만 검증).
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
if [ "$CHECKS_RC" -eq 0 ]; then
  echo "  CI: required green"
elif echo "$CHECKS_OUT" | grep -qiE "no checks|no required"; then
  echo "  CI: required check 없음 → 통과"
elif echo "$CHECKS_OUT" | grep -qiE "not accessible|GraphQL|Resource not accessible"; then
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
if [ "$UNRESOLVED" != "0" ]; then
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
if [ "$MERGEABLE" != "MERGEABLE" ]; then
  echo "  ⛔ mergeable=$MERGEABLE (충돌 또는 계산 미완) — 머지 중단" >&2; exit 1
fi
echo "  mergeable: MERGEABLE"

echo "게이트 통과 → 머지"
gh pr merge "$PR" --repo "$OWNER_REPO" --merge --delete-branch
echo "✅ PR #$PR 머지 완료"

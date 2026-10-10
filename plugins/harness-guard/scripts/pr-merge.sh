#!/usr/bin/env bash
# pr-merge.sh — 머지 단일 경로(래퍼). guard.sh가 맨손 `gh pr merge`를 차단하므로,
# 머지는 이 스크립트를 통해서만 한다(내부 gh는 자식 프로세스라 PreToolUse 훅에 안 걸린다).
# 머지 *전에* 게이트를 직접 검증한다 — CI required green · 미해결 리뷰 스레드 0 · mergeable.
# 게이트를 통과하지 못하면 머지하지 않고 종료(게이트가 머지 경로에 박혀 건너뛸 수 없음).
#
# 사용: pr-merge.sh [<PR#>] [--base <branch>] [--auto] [--expected-head <OID>] [--expected-base-oid <OID>]
#   expected-*는 앞선 리뷰 snapshot의 후보를 전달해 래퍼 시작 전 후보 변경도 차단한다.
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

thread_page_state() {
  local cfg out; cfg=$(cat)
  if command -v python3 >/dev/null 2>&1; then
    out=$(printf '%s' "$cfg" | python3 -c 'import json,sys
d=json.load(sys.stdin)["data"]["repository"]["pullRequest"]["reviewThreads"]
count=sum(not n["isResolved"] for n in d["nodes"]); page=d["pageInfo"]
assert isinstance(page["hasNextPage"], bool)
print("%s|%s|%s" % (count, str(page["hasNextPage"]).lower(), page.get("endCursor") or ""))' 2>/dev/null) && [ -n "$out" ] && { printf '%s\n' "$out"; return 0; }
  fi
  if command -v jq >/dev/null 2>&1; then
    out=$(printf '%s' "$cfg" | jq -er '.data.repository.pullRequest.reviewThreads | select(.pageInfo.hasNextPage | type == "boolean") | "\([.nodes[]|select(.isResolved==false)]|length)|\(.pageInfo.hasNextPage)|\(.pageInfo.endCursor // "")"' 2>/dev/null) && [ -n "$out" ] && { printf '%s\n' "$out"; return 0; }
  fi
  return 1
}

count_unresolved_threads() { # owner name pr
  local owner="$1" name="$2" pr="$3" unresolved=0 cursor="" page state page_count has_next
  while :; do
    if [ -n "$cursor" ]; then
      page=$(gh api graphql -f query='query($o:String!,$n:String!,$p:Int!,$after:String){repository(owner:$o,name:$n){pullRequest(number:$p){reviewThreads(first:100,after:$after){nodes{isResolved} pageInfo{hasNextPage endCursor}}}}}' \
        -F o="$owner" -F n="$name" -F p="$pr" -f after="$cursor" 2>/dev/null) || return 1
    else
      page=$(gh api graphql -f query='query($o:String!,$n:String!,$p:Int!){repository(owner:$o,name:$n){pullRequest(number:$p){reviewThreads(first:100){nodes{isResolved} pageInfo{hasNextPage endCursor}}}}}' \
        -F o="$owner" -F n="$name" -F p="$pr" 2>/dev/null) || return 1
    fi
    state=$(printf '%s' "$page" | thread_page_state) || return 1
    IFS='|' read -r page_count has_next cursor <<EOF
$state
EOF
    { [ "$has_next" = true ] || [ "$has_next" = false ]; } || return 1
    unresolved=$((unresolved + page_count))
    [ "$has_next" = true ] || { printf '%s\n' "$unresolved"; return 0; }
    [ -n "$cursor" ] || return 1
  done
}

# mergeable 게이트: "MERGEABLE"만 통과. UNKNOWN·CONFLICTING 등은 fail(충돌/계산 미완).
gate_mergeable() { [ "$1" = "MERGEABLE" ]; }

# JSON metadata만 후보로 인정한다. branch 이름과 OID를 함께 비교해 이름만 같은 base 이동도 잡는다.
pr_candidate_state() {
  local cfg out; cfg=$(cat)
  if command -v python3 >/dev/null 2>&1; then
    out=$(printf '%s' "$cfg" | python3 -c 'import json,re,sys
d=json.load(sys.stdin); keys=("baseRefName","baseRefOid","headRefName","headRefOid")
for key in keys:
 value=d[key]
 assert isinstance(value,str) and re.fullmatch(r"[0-9a-fA-F]{40}" if key.endswith("Oid") else r"[^\s|\x00-\x1f\x7f]+",value)
print("|".join(d[key] for key in keys))' 2>/dev/null) && [ -n "$out" ] && { printf '%s\n' "$out"; return 0; }
  fi
  if command -v jq >/dev/null 2>&1; then
    out=$(printf '%s' "$cfg" | jq -er '
      [.baseRefName,.baseRefOid,.headRefName,.headRefOid] as $v |
      select(all($v[]; type == "string")) |
      select(($v[0] | test("^[^\\s|\\x00-\\x1f\\x7f]+$")) and ($v[2] | test("^[^\\s|\\x00-\\x1f\\x7f]+$"))) |
      select(($v[1] | test("^[0-9a-fA-F]{40}$")) and ($v[3] | test("^[0-9a-fA-F]{40}$"))) |
      $v | join("|")' 2>/dev/null) && [ -n "$out" ] && { printf '%s\n' "$out"; return 0; }
  fi
  return 1
}

read_pr_candidate() {
  local metadata
  metadata=$(gh pr view "$PR" --repo "$OWNER_REPO" --json baseRefName,baseRefOid,headRefName,headRefOid) || return 1
  printf '%s' "$metadata" | pr_candidate_state
}

# --auto 안전 계약: 무인 자동머지는 CI가 **서버-강제**(required status check 존재)여야 성립한다.
# required가 없거나 조회 불가(none/fallback)이면 서버 필수 CI를 확인할 수 없어 자동머지는 거부.
# 수동 머지(auto=0)는 기존 none/Actions fallback 계약을 유지한다.
auto_ci_ok() { # verdict, auto → rc0 기존 게이트 계속 / rc1 자동머지 거부
  if [ "$2" = "1" ]; then
    case "$1" in none|fallback) return 1;; esac
  fi
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

PR="" BASE="" AUTO=0 EXPECTED_HEAD="" EXPECTED_BASE_OID=""
while [ $# -gt 0 ]; do
  case "$1" in
    --auto) AUTO=1; shift;;
    --base) BASE="${2:-}"; shift 2;;
    --expected-head) EXPECTED_HEAD="${2:?expected head OID required}"; shift 2;;
    --expected-base-oid) EXPECTED_BASE_OID="${2:?expected base OID required}"; shift 2;;
    -*) echo "pr-merge.sh: 알 수 없는 인자 '$1'" >&2; exit 2;;
    *) PR="$1"; shift;;
  esac
done

for expected_oid in "$EXPECTED_HEAD" "$EXPECTED_BASE_OID"; do
  [ -z "$expected_oid" ] || [[ "$expected_oid" =~ ^[0-9a-fA-F]{40}$ ]] || { echo "pr-merge.sh: expected OID 형식 오류" >&2; exit 2; }
done

OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
[ -z "$PR" ] && PR=$(gh pr view --json number --jq .number)
OWNER="${OWNER_REPO%/*}"; NAME="${OWNER_REPO#*/}"
echo "게이트 검증: $OWNER_REPO PR #$PR"

# 게이트 시작의 정확한 후보를 고정한다. 조회 실패·malformed 응답을 빈 값으로 승인하지 않는다.
VERIFIED_CANDIDATE=$(read_pr_candidate) || { echo "  ⛔ PR head/base 후보 조회·검증 실패 — 머지 중단" >&2; exit 1; }
IFS='|' read -r PR_BASE BASE_SHA HBRANCH HEAD_SHA <<EOF
$VERIFIED_CANDIDATE
EOF
[ -z "$BASE" ] || [ "$BASE" = "$PR_BASE" ] || { echo "  ⛔ 요청 base=$BASE, 실제 base=$PR_BASE — 머지 중단" >&2; exit 3; }
[ -z "$EXPECTED_HEAD" ] || [ "$EXPECTED_HEAD" = "$HEAD_SHA" ] || { echo "  ⛔ 앞선 리뷰의 head와 현재 후보가 다름 — 재검토 필요" >&2; exit 1; }
[ -z "$EXPECTED_BASE_OID" ] || [ "$EXPECTED_BASE_OID" = "$BASE_SHA" ] || { echo "  ⛔ 앞선 리뷰의 base OID와 현재 후보가 다름 — 재검토 필요" >&2; exit 1; }

# --auto: 이 PR의 실제 base가 develop인지 강제(아니면 거부). 게이트 검증 전 선차단.
if [ "$AUTO" = "1" ]; then
  require_develop_base "$PR_BASE" || exit 3
  echo "  --auto: base=develop 확인"
fi

# 1) CI 검증 — 1차: gh pr checks(외부 CI 포함). 토큰이 checks API를 못 읽으면(GraphQL 403)
#    수동 머지만 2차 Actions run(gh run list)으로 이 커밋의 워크플로 결과를 폴백 검증.
# 주의: set -e라 `VAR=$(실패명령)`는 RC 캡처 전에 스크립트를 죽인다 → `|| CHECKS_RC=$?`로 흡수.
CHECKS_RC=0
CHECKS_OUT=$(gh pr checks "$PR" --repo "$OWNER_REPO" --required 2>&1) || CHECKS_RC=$?
CI_VERDICT=$(classify_ci_gate "$CHECKS_RC" "$CHECKS_OUT") || true
# --auto는 required 없음/조회 불가를 거부 — unrelated Actions 성공은 서버 필수 CI의 증거가 아니다.
if ! auto_ci_ok "$CI_VERDICT" "$AUTO"; then
  echo "  ⛔ --auto 거부: required status check 확인 불가($CI_VERDICT) — 자동머지는 서버 필수 CI 확인이 전제." >&2
  echo "     required check 등록·조회 권한을 확인 후 재시도, 또는 --auto 없이 명시 수동 머지." >&2
  exit 1
fi
if [ "$CI_VERDICT" = "green" ]; then
  echo "  CI: required green"
elif [ "$CI_VERDICT" = "none" ]; then
  echo "  CI: required check 없음 → 통과"
elif [ "$CI_VERDICT" = "fallback" ]; then
  # 토큰이 checks API 접근 불가 → Actions run으로 폴백(이 커밋 한정)
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
UNRESOLVED=$(count_unresolved_threads "$OWNER" "$NAME" "$PR") || UNRESOLVED="ERR"
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

# 게이트 뒤 후보가 바뀌었거나 재조회가 실패하면 검토를 다시 시작한다.
CURRENT_CANDIDATE=$(read_pr_candidate) || { echo "  ⛔ 게이트 후 PR 후보 재조회·검증 실패 — 머지 중단" >&2; exit 1; }
if [ "$CURRENT_CANDIDATE" != "$VERIFIED_CANDIDATE" ]; then
  echo "  ⛔ 게이트 후 PR head/base 변경 — 현재 후보로 검토·검증을 다시 수행하세요." >&2; exit 1
fi
# head는 GitHub의 expected-head 옵션으로 서버에서 결박한다. base 재조회는 원자적 비교가 아니므로
# 그 이후 base 이동은 strict required CI·현재 protected base 정책의 서버 계약이 계속 필요하다.

echo "게이트 통과 → 머지"
gh pr merge "$PR" --repo "$OWNER_REPO" --merge --delete-branch --match-head-commit "$HEAD_SHA"
echo "✅ PR #$PR 머지 완료"

# PR 병합과 정리 결과는 별도다. 실패를 숨기거나 삭제를 추정하지 않는다.
HEAD_BRANCH=$HBRANCH
if REMOTE_CHECK=$(git ls-remote --exit-code --heads origin "refs/heads/$HEAD_BRANCH" 2>&1); then
  REMOTE_EXIT=0
else
  REMOTE_EXIT=$?
fi
if [ "$REMOTE_EXIT" -eq 2 ]; then
  echo "🧹 원격 브랜치 삭제 확인: $HEAD_BRANCH"
elif [ "$REMOTE_EXIT" -eq 0 ]; then
  echo "⚠️ 원격 브랜치 남아 있음: $HEAD_BRANCH" >&2
else
  echo "⚠️ 원격 브랜치 정리 미확인: $REMOTE_CHECK" >&2
fi
if git show-ref --verify --quiet "refs/heads/$HEAD_BRANCH"; then
  LOCAL_EXIT=0
else
  LOCAL_EXIT=$?
fi
if [ "$LOCAL_EXIT" -eq 0 ]; then
  if ! git fetch origin "$PR_BASE" --quiet; then
    echo "⚠️ 로컬 브랜치 보존: 최신 병합 원본 조회 실패" >&2
  elif ! git merge-base --is-ancestor "$HEAD_BRANCH" "origin/$PR_BASE"; then
    echo "ℹ️ 로컬 '$HEAD_BRANCH' 보존 — origin/$PR_BASE에 미포함" >&2
  else
    CB_CO=$(merge_cleanup_checkout "$HEAD_BRANCH" "$PR_BASE" "$(git branch --show-current)")
    if [ -n "$CB_CO" ] && ! git checkout "$CB_CO" --quiet; then
      echo "⚠️ 로컬 브랜치 정리 실패: checkout 불가; 사용 중인 worktree와 변경을 보존함" >&2
    elif git branch -d "$HEAD_BRANCH"; then
      echo "🧹 로컬 브랜치 삭제 확인: $HEAD_BRANCH"
    else
      echo "⚠️ 로컬 브랜치 정리 실패: $HEAD_BRANCH; 다른 worktree 사용 여부를 확인하세요" >&2
    fi
  fi
elif [ "$LOCAL_EXIT" -eq 1 ]; then
  echo "🧹 로컬 브랜치 없음 확인: $HEAD_BRANCH"
else
  echo "⚠️ 로컬 브랜치 정리 미확인: 조회 실패($LOCAL_EXIT)" >&2
fi

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
#   fallback = checks API 접근 불가(토큰 제한) → 미확인(실행 경로는 거부)
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
  local metadata candidate base old_base head head_oid live_base
  metadata=$(gh pr view "$PR" --repo "$OWNER_REPO" --json baseRefName,baseRefOid,headRefName,headRefOid) || return 1
  candidate=$(printf '%s' "$metadata" | pr_candidate_state) || return 1
  IFS='|' read -r base old_base head head_oid <<< "$candidate"
  # PR baseRefOid can retain an earlier snapshot after the actual branch moves.
  # Bind review and both gate snapshots to the live ref; a missing ref fails closed.
  live_base=$(gh api "repos/$OWNER_REPO/git/ref/heads/$base" --jq .object.sha) || return 1
  [[ "$live_base" =~ ^[0-9a-fA-F]{40}$ ]] || return 1
  printf '%s|%s|%s|%s\n' "$base" "$live_base" "$head" "$head_oid"
}

# --auto 안전 계약: 무인 자동머지는 CI가 **서버-강제**(required status check 존재)여야 성립한다.
# required가 없거나 조회 불가(none/fallback)이면 서버 필수 CI를 확인할 수 없어 자동머지는 거부.
# 수동 머지도 같은 required 미확인 차단 계약을 따른다.
auto_ci_ok() {
  case "$1" in none|fallback) return 1;; esac
  return 0
}

# 머지 후 로컬 정리 시 checkout 대상 결정(순수): 현재 브랜치가 삭제될 head면 base로 이동(빈 base면
# develop 폴백), 아니면 이동 불필요(빈 문자열). 삭제될 브랜치 위에 남지 않게 하는 로직 — 테스트가 주입 검증.
merge_cleanup_checkout() { # head base current → echo checkout 대상("" = 이동 불필요)
  [ "$3" = "$1" ] && printf '%s' "${2:-develop}"
  return 0
}

# 같은 증거 계약을 solo의 보호 변경 전 검사에서도 사용한다.
verify_required_ci() { # base head; PR와 OWNER_REPO는 현재 후보의 조회 대상
  local policy checks runs statuses
  policy=$(gh api "repos/$OWNER_REPO/branches/$1/protection/required_status_checks") || return 1
  checks=$(gh pr checks "$PR" --repo "$OWNER_REPO" --required --json name,bucket) || return 1
  runs=$(gh api --paginate --slurp "repos/$OWNER_REPO/commits/$2/check-runs") || return 1
  statuses=$(gh api --paginate --slurp "repos/$OWNER_REPO/commits/$2/statuses") || return 1
  node "$(dirname "${BASH_SOURCE[0]}")/verify-required-checks.mjs" "$2" "$policy" "$checks" "$runs" "$statuses"
}

# 테스트 훅: 함수만 로드하고 종료(main 로직·gh 호출 없이 순수 판정 함수만 검증).
[ -n "${PRMERGE_SOURCE_ONLY:-}" ] && return 0 2>/dev/null || true
if ! source "${BASH_SOURCE[0]%/*}/observation/shell.sh" 2>/dev/null; then
  obs_start() { :; }; obs_exit() { :; }; obs_merge_begin() { :; }; obs_merge_result() { :; }
fi
trap 'rc=$?; obs_exit "$rc"; exit "$rc"' EXIT

# The linked-stack API is verified on github.com. Gate and mutation hosts must
# never differ; an enterprise override needs its own supported contract.
[ -z "${GH_HOST:-}" ] || [ "$GH_HOST" = github.com ] || { echo "⛔ 이 merge 경로는 github.com만 지원합니다(GH_HOST 불일치)." >&2; exit 1; }
export GH_HOST=github.com

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
export GH_REPO="$OWNER_REPO"
[ -z "$PR" ] && PR=$(gh pr view --repo "$OWNER_REPO" --json number --jq .number)
OWNER="${OWNER_REPO%/*}"; NAME="${OWNER_REPO#*/}"
echo "게이트 검증: $OWNER_REPO PR #$PR"

# 게이트 시작의 정확한 후보를 고정한다. 조회 실패·malformed 응답을 빈 값으로 승인하지 않는다.
VERIFIED_CANDIDATE=$(read_pr_candidate) || { echo "  ⛔ PR head/base 후보 조회·검증 실패 — 머지 중단" >&2; exit 1; }
IFS='|' read -r PR_BASE BASE_SHA HBRANCH HEAD_SHA <<EOF
$VERIFIED_CANDIDATE
EOF
obs_start pr-merge '' "$HEAD_SHA" "$BASE_SHA"
OBS_REASON=MERGE_FAILED
[ -z "$BASE" ] || [ "$BASE" = "$PR_BASE" ] || { echo "  ⛔ 요청 base=$BASE, 실제 base=$PR_BASE — 머지 중단" >&2; exit 3; }
[ -z "$EXPECTED_HEAD" ] || [ "$EXPECTED_HEAD" = "$HEAD_SHA" ] || { echo "  ⛔ 앞선 리뷰의 head와 현재 후보가 다름 — 재검토 필요" >&2; exit 1; }
[ -z "$EXPECTED_BASE_OID" ] || [ "$EXPECTED_BASE_OID" = "$BASE_SHA" ] || { echo "  ⛔ 앞선 리뷰의 base OID와 현재 후보가 다름 — 재검토 필요" >&2; exit 1; }

STACK_ENGINE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/stack-merge-cli.mjs"
STACK_SNAPSHOT=$(node "$STACK_ENGINE" probe "$OWNER_REPO" "$PR") || exit 1
STACK_KIND=$(node -e 'const s=JSON.parse(process.argv[1]);if(s.kind==="stack"&&(s.trunk!==process.argv[2]||s.trunkOid!==process.argv[3]||s.headOid!==process.argv[4]))process.exit(1);console.log(s.kind)' \
  "$STACK_SNAPSHOT" "$PR_BASE" "$BASE_SHA" "$HEAD_SHA") || { echo "⛔ stack 후보와 gate 후보 불일치" >&2; exit 1; }
if [ "$STACK_KIND" = stack ] && [ "$AUTO" = 1 ]; then
  echo "⛔ linked stack은 --auto를 지원하지 않습니다. 최하단을 한 층씩 검증·병합하세요." >&2; exit 3
fi

# --auto: 이 PR의 실제 base가 develop인지 강제(아니면 거부). 게이트 검증 전 선차단.
if [ "$AUTO" = "1" ]; then
  require_develop_base "$PR_BASE" || exit 3
  POLICY_ROOT=$(git rev-parse --show-toplevel) || exit 1
  node "$(dirname "${BASH_SOURCE[0]}")/repo-policy.mjs" "$POLICY_ROOT" auto "$PR_BASE" || exit 1
  echo "  --auto: base=develop 확인"
fi

# 1) Required CI: 수동/자동 모두 서버 집합과 현재 PR 결과를 확인한다.
# Actions run의 일반 성공은 required 집합·외부 CI 증거를 대체하지 않는다.
verify_required_ci "$PR_BASE" "$HEAD_SHA" || {
  echo "  ⛔ 필수 검사 집합/현재 head 성공 미확인 — 머지 중단" >&2; exit 1;
}
echo "  CI: required 집합·현재 head 성공 확인"

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
CURRENT_STACK=$(node "$STACK_ENGINE" probe "$OWNER_REPO" "$PR") || exit 1
[ "$CURRENT_STACK" = "$STACK_SNAPSHOT" ] || { echo "⛔ gate 이후 stack 구성/후보 변경 — 재검토 필요" >&2; exit 1; }
# head는 GitHub의 expected-head 옵션으로 서버에서 결박한다. base 재조회는 원자적 비교가 아니므로
# 그 이후 base 이동은 strict required CI·현재 protected base 정책의 서버 계약이 계속 필요하다.

echo "게이트 통과 → 머지"
if [ "$STACK_KIND" = stack ]; then
  # Stop and wait for our provider before a solo parent restores protection.
  # The server may already have accepted the request; its journal remains authoritative.
  MERGE_PID=""
  stop_provider() { if [ -n "$MERGE_PID" ]; then kill -TERM "$MERGE_PID" 2>/dev/null || true; wait "$MERGE_PID" 2>/dev/null || true; fi; }
  trap 'stop_provider; exit 130' INT
  trap 'stop_provider; exit 143' TERM
  trap 'stop_provider; exit 129' HUP
  obs_merge_begin
  node "$STACK_ENGINE" merge "$OWNER_REPO" "$PR" "$STACK_SNAPSHOT" "${HARNESS_STACK_MERGE_JOURNAL:-}" &
  MERGE_PID=$!
  if wait "$MERGE_PID"; then MERGE_RC=0; else MERGE_RC=$?; fi
  MERGE_PID=""; trap - INT TERM HUP
  obs_merge_result stack
  [ "$MERGE_RC" = 0 ] || exit "$MERGE_RC"
  echo "✅ PR #$PR 실제 병합과 trunk 포함 확인 — 의존 브랜치는 보존, 다음 층은 새 후보로 검증"
  exit 0
fi
if [ -n "${HARNESS_STACK_MERGE_JOURNAL:-}" ]; then
  node "$STACK_ENGINE" start-single "$HARNESS_STACK_MERGE_JOURNAL" "$STACK_SNAPSHOT" || exit 1
fi
gh pr merge "$PR" --repo "$OWNER_REPO" --merge --delete-branch --match-head-commit "$HEAD_SHA"
if [ -n "${HARNESS_STACK_MERGE_JOURNAL:-}" ]; then
  node "$STACK_ENGINE" confirm-single "$HARNESS_STACK_MERGE_JOURNAL" || exit 1
fi
OBS_OUTCOME=unverified OBS_REASON=MERGE_REQUESTED
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
  else
    if git merge-base --is-ancestor "$HEAD_BRANCH" "origin/$PR_BASE"; then
      ANCESTRY_EXIT=0
    else
      ANCESTRY_EXIT=$?
    fi
    if [ "$ANCESTRY_EXIT" -eq 1 ]; then
      echo "ℹ️ 로컬 '$HEAD_BRANCH' 보존 — origin/$PR_BASE에 미포함" >&2
    elif [ "$ANCESTRY_EXIT" -ne 0 ]; then
      echo "⚠️ 로컬 브랜치 정리 미확인: 병합 관계 조회 실패($ANCESTRY_EXIT); 브랜치 보존" >&2
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
  fi
elif [ "$LOCAL_EXIT" -eq 1 ]; then
  echo "🧹 로컬 브랜치 없음 확인: $HEAD_BRANCH"
else
  echo "⚠️ 로컬 브랜치 정리 미확인: 조회 실패($LOCAL_EXIT)" >&2
fi

#!/usr/bin/env bash
# solo-merge.sh — 솔로 break-glass 원자 래퍼. 승인요건이 걸린 base에서 솔로 머지를 위해
# required_pull_request_reviews를 일시 삭제(DELETE)→머지→복구(PATCH)하되, 전 과정을 trap으로 감싸
# 어떤 종료 경로(정상·에러·시그널)에서도 복구 PATCH가 반드시 실행되게 한다([F] 원자성, #220).
#
# 기존 solo-merge/SKILL.md 프로즈는 DELETE·merge·PATCH를 AI가 별도 호출로 수동 실행 → 단계 사이
# 중단 시 PATCH 미실행 → base 브랜치 보호가 승인요건 삭제된 채 방치(조용한 약화)됐다. 이 래퍼가 그 창을 닫는다.
#
# ⚠️ 한계: SIGKILL·전원손실은 trap으로 잡을 수 없다(uncatchable). 2차 안전망 = repo-sync protection-on 검증.
#
# 사용: solo-merge.sh [<PR#>]   (PR# 생략 시 현재 브랜치의 PR)
#   삭제 대상은 승인요건(required_pull_request_reviews)뿐 — allow_force_pushes·enforce_admins·status-check 등
#   다른 보호는 절대 건드리지 않는다. 보호 없던 repo엔 요건을 새로 만들지 않는다.
set -euo pipefail

# ── 순수 판정 함수 (gh I/O와 분리 — 테스트가 SOLO_MERGE_SOURCE_ONLY=1로 주입 검증) ──

# had_protection: stdin=required_pull_request_reviews 설정 JSON → "yes"(승인요건 존재) / "no".
#   빈 입력·요건 없는 설정 = no(보호 없던 repo엔 DELETE/PATCH 안 함 — 요건 신규 생성 방지).
had_protection() {
  local cfg; cfg=$(cat)
  if [ -n "$cfg" ] && printf '%s' "$cfg" | grep -q required_approving_review_count; then
    echo yes
  else
    echo no
  fi
}

# extract_restore_payload: stdin=설정 JSON → 복구 PATCH 본문(4필드만: required_approving_review_count·
#   dismiss_stale_reviews·require_code_owner_reviews·require_last_push_approval). count만 복구하면 나머지
#   필드가 유실돼 base 보호가 매 실행 영구 약화(K1)되므로 전체 필드를 보존한다. 없는 필드는 생략.
extract_restore_payload() {
  python3 -c "import sys,json; c=json.load(sys.stdin); print(json.dumps({k:c[k] for k in ('required_approving_review_count','dismiss_stale_reviews','require_code_owner_reviews','require_last_push_approval') if k in c}))"
}

# solo_gate_decide: pre-gate 순수 판정(gh 값 주입) → rc0 통과 / rc1 + 사유 echo. 기준은 pr-merge.sh·SKILL과
#   동일(CI required·미해결 스레드 0·mergeable). 이 판정이 DELETE *전에* 통과해야 break-glass 창을 연다(AC-6).
solo_gate_decide() { # ci_rc unresolved_count mergeable → rc
  [ "$1" = 0 ]         || { echo "CI required 미통과(rc=$1)"; return 1; }
  [ "$2" = 0 ]         || { echo "미해결 리뷰 스레드 $2건(0이어야 함)"; return 1; }
  [ "$3" = MERGEABLE ] || { echo "mergeable=$3(MERGEABLE 아님)"; return 1; }
  return 0
}

[ -n "${SOLO_MERGE_SOURCE_ONLY:-}" ] && return 0 2>/dev/null || true

# ── main — 원자 break-glass: save→arm trap→DELETE→merge→restore→verify ──

PR="${1:-$(gh pr view --json number --jq .number)}"
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
BASE=$(gh pr view "$PR" --repo "$OWNER_REPO" --json baseRefName --jq .baseRefName)
# 머지는 형제 pr-merge.sh(게이트 재검증 후 머지)로 위임 — 테스트가 SOLO_MERGE_MERGE_CMD로 주입.
MERGE_CMD="${SOLO_MERGE_MERGE_CMD:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/pr-merge.sh}"
RPR_PATH="repos/$OWNER_REPO/branches/$BASE/protection/required_pull_request_reviews"

# pre-gate (보호 건드리기 *전*) — CI required·미해결 스레드 0·mergeable. 미달이면 DELETE 이전에 중단해
#   break-glass 창을 아예 열지 않는다(AC-6). pr-merge가 머지 시 재검증하지만, 여기서 먼저 막는 게 최소 노출.
if gh pr checks "$PR" --repo "$OWNER_REPO" --required >/dev/null 2>&1; then CI_RC=0; else CI_RC=1; fi
UNRESOLVED=$(gh api graphql -f query='query($o:String!,$n:String!,$p:Int!){repository(owner:$o,name:$n){pullRequest(number:$p){reviewThreads(first:50){nodes{isResolved}}}}}' \
  -F o="${OWNER_REPO%/*}" -F n="${OWNER_REPO#*/}" -F p="$PR" \
  --jq '[.data.repository.pullRequest.reviewThreads.nodes[]|select(.isResolved==false)]|length' 2>/dev/null || echo "?")
MERGEABLE=$(gh pr view "$PR" --repo "$OWNER_REPO" --json mergeable --jq .mergeable 2>/dev/null || echo "?")
if ! REASON=$(solo_gate_decide "$CI_RC" "$UNRESOLVED" "$MERGEABLE"); then
  echo "⛔ pre-gate 미달 — 보호를 건드리지 않고 중단: $REASON" >&2
  exit 1
fi

# save: 현재 승인요건 설정 전체 저장(복구용). 보호 없던 repo면 REVIEWS_CONFIG 빈값 → HAD_PROTECTION=no.
REVIEWS_CONFIG=$(gh api "$RPR_PATH" 2>/dev/null || true)
HAD_PROTECTION=$(printf '%s' "$REVIEWS_CONFIG" | had_protection)
ORIG_COUNT=$(printf '%s' "$REVIEWS_CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('required_approving_review_count',''))" 2>/dev/null || echo "?")

# restore(trap 대상): 저장한 원본 설정을 PATCH로 되돌린다. 멱등(_restored 가드) — 명시 호출과 trap이
#   겹쳐도 1회. HAD_PROTECTION=no면 no-op(요건 신규 생성 방지).
_restored=0
_restore() {
  [ "$_restored" = 1 ] && return 0
  [ "$HAD_PROTECTION" = yes ] || return 0
  _restored=1
  printf '%s' "$REVIEWS_CONFIG" | extract_restore_payload \
    | gh api -X PATCH "$RPR_PATH" --input - >/dev/null 2>&1 \
    || echo "  ⚠️ 승인요건 복구 PATCH 실패 — 수동으로 $BASE 보호에 승인요건 재설정 필요(count=$ORIG_COUNT)" >&2
}

# arm trap: 정상·에러(set -e)·시그널(INT/TERM/HUP) 어떤 종료 경로에서도 복구 보장. 시그널 핸들러는
#   복구 후 관례적 코드로 exit(그 exit이 EXIT trap을 재발화해도 _restored 가드로 no-op). 보호 있을 때만 무장.
#   ⚠️ SIGKILL·전원손실은 uncatchable — 2차 안전망 = repo-sync protection-on 검증.
if [ "$HAD_PROTECTION" = yes ]; then
  trap '_restore' EXIT
  trap '_restore; exit 130' INT
  trap '_restore; exit 143' TERM
  trap '_restore; exit 129' HUP
  echo "🔓 break-glass: $BASE 승인요건 일시 삭제(머지 후 복구)"
  gh api -X DELETE "$RPR_PATH" >/dev/null 2>&1
fi

# merge — 실패 시 set -e로 스크립트 이탈 → EXIT trap이 복구. pr-merge가 CI·스레드·mergeable 재검증.
bash "$MERGE_CMD" "$PR"

# 정상 경로: 명시 복구 후 trap 해제(성공 확정).
_restore
trap - EXIT INT TERM HUP

# verify: 머지됨 + 승인요건 원값 복원 확인.
STATE=$(gh pr view "$PR" --repo "$OWNER_REPO" --json state --jq .state 2>/dev/null || echo "?")
if [ "$HAD_PROTECTION" = yes ]; then
  RESTORED_COUNT=$(gh api "$RPR_PATH" --jq '.required_approving_review_count' 2>/dev/null || echo "?")
  if [ "$RESTORED_COUNT" != "$ORIG_COUNT" ]; then
    echo "❌ 복구 검증 실패 — 승인요건 count=$RESTORED_COUNT(원값 $ORIG_COUNT). 즉시 수동 재설정 필요: $BASE" >&2
    exit 1
  fi
  echo "🔒 복구 확인: $BASE 승인요건 count=$RESTORED_COUNT"
fi
[ "$STATE" = "MERGED" ] || { echo "❌ 머지 상태 확인 실패: state=$STATE" >&2; exit 1; }
echo "✅ solo-merge 완료 — PR #$PR MERGED"

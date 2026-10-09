#!/usr/bin/env bash
# solo-merge.sh — 솔로 break-glass 원자 래퍼. 승인요건이 걸린 base에서 솔로 머지를 위해
# required_pull_request_reviews를 일시 삭제(DELETE)→머지→복구(PATCH)하되, 전 과정을 trap으로 감싸
# 어떤 종료 경로(정상·에러·시그널)에서도 복구 PATCH를 **시도**하고, 정상 경로는 복구를 **검증(fail-closed:
# 실패 시 exit1 경보)**한다([F] 원자성, #220). 시그널 경로는 best-effort 복구 + 경보(검증은 정상 경로만).
# 복구 실패 시 저장한 원래 전체 보호 설정과 실제 읽기 결과를 비교해 수동 복구한다.
#
# 기존 solo-merge/SKILL.md 프로즈는 DELETE·merge·PATCH를 AI가 별도 호출로 수동 실행 → 단계 사이
# 중단 시 PATCH 미실행 → base 브랜치 보호가 승인요건 삭제된 채 방치(조용한 약화)됐다. 이 래퍼가 그 창을 닫는다.
#
# ⚠️ SIGKILL·전원손실은 trap으로 잡을 수 없다. 표준 --check는 실행 전 원값의 복구 증명이 아니다.
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

# extract_restore_payload: stdin=설정 JSON → GitHub API의 쓰기 가능한 리뷰 보호 필드만 정규화한다.
#   python3 우선, 부재/실패 시 jq 폴백(guard.sh와 동일 정책 — python3-degraded 박스에서도 복구 작동).
#   둘 다 없거나 실패면 rc1·빈 출력 → 호출부가 빈 payload로 PATCH하지 않고 fail-closed 경보.
extract_restore_payload() {
  local cfg; cfg=$(cat)
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$cfg" | python3 -c "import sys,json
c=json.load(sys.stdin); out={k:c[k] for k in ('required_approving_review_count','dismiss_stale_reviews','require_code_owner_reviews','require_last_push_approval') if k in c}
for key in ('dismissal_restrictions','bypass_pull_request_allowances'):
 if key in c:
  r=c[key]; out[key]={'users':[x.get('login',x) if isinstance(x,dict) else x for x in r.get('users',[])],'teams':[x.get('slug',x) if isinstance(x,dict) else x for x in r.get('teams',[])],'apps':[x.get('slug',x) if isinstance(x,dict) else x for x in r.get('apps',[])]}
print(json.dumps(out))" 2>/dev/null && return 0
  fi
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$cfg" | jq -ce 'def norm: {users:[(.users[]? | .login // .)],teams:[(.teams[]? | .slug // .)],apps:[(.apps[]? | .slug // .)]}; . as $c | ({required_approving_review_count,dismiss_stale_reviews,require_code_owner_reviews,require_last_push_approval}|with_entries(select(.value!=null))) + (if $c|has("dismissal_restrictions") then {dismissal_restrictions:($c.dismissal_restrictions|norm)} else {} end) + (if $c|has("bypass_pull_request_allowances") then {bypass_pull_request_allowances:($c.bypass_pull_request_allowances|norm)} else {} end)' 2>/dev/null && return 0
  fi
  return 1
}

# _json_field: stdin=JSON, $1=키 → 값 echo(python3→jq 폴백). 파서 부재/실패면 rc1(빈 출력) → 호출부가 "?"로.
_json_field() {
  local key="$1" cfg; cfg=$(cat)
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$cfg" | python3 -c "import sys,json; print(json.load(sys.stdin).get(sys.argv[1],''))" "$key" 2>/dev/null && return 0
  fi
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$cfg" | jq -r --arg k "$key" '.[$k] // ""' 2>/dev/null && return 0
  fi
  return 1
}

# Read an explicit nullable review policy from a successful full protection response.
# An inaccessible endpoint must never be interpreted as "no review protection".
branch_review_config() {
  local cfg; cfg=$(cat)
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$cfg" | python3 -c 'import json,sys
c=json.load(sys.stdin); r=c["required_pull_request_reviews"]
assert isinstance(c,dict) and (r is None or isinstance(r,dict))
if r is not None:
 assert type(r.get("required_approving_review_count")) is int and r["required_approving_review_count"] >= 0
 print(json.dumps(r))' 2>/dev/null && return 0
  fi
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$cfg" | jq -er 'if type != "object" or (has("required_pull_request_reviews") | not) then error("missing review policy") else .required_pull_request_reviews | if . == null then "" elif type == "object" and (.required_approving_review_count | type == "number" and . >= 0 and floor == .) then tojson else error("invalid review policy") end end' 2>/dev/null && return 0
  fi
  return 1
}

# Compare policy semantics, ignoring API URLs and set ordering, preserving other fields.
canonical_branch_policy() {
  local cfg; cfg=$(cat)
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$cfg" | python3 -c 'import json,sys
def norm(v):
 if isinstance(v,dict):
  out={}
  for k,x in v.items():
   if k == "url" or k.endswith("_url"): continue
   if k in ("users","teams","apps"):
    field="login" if k == "users" else "slug"
    x=[a.get(field) if isinstance(a,dict) else a for a in x]
   out[k]=norm(x)
  return out
 if isinstance(v,list): return sorted((norm(a) for a in v),key=lambda a:json.dumps(a,sort_keys=True))
 return v
c=json.load(sys.stdin); assert isinstance(c,dict) and "required_pull_request_reviews" in c
print(json.dumps(norm(c),sort_keys=True,separators=(",",":"),ensure_ascii=False))' 2>/dev/null && return 0
  fi
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$cfg" | jq -ceS 'def norm: if type == "object" then with_entries(select(.key != "url" and (.key | endswith("_url") | not)) | if .key == "users" then .value |= (map(if type == "object" then .login else . end) | sort) elif .key == "teams" or .key == "apps" then .value |= (map(if type == "object" then .slug else . end) | sort) else .value |= norm end) elif type == "array" then map(norm) | sort else . end; if type != "object" or (has("required_pull_request_reviews") | not) then error("invalid protection policy") else norm end' 2>/dev/null && return 0
  fi
  return 1
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

PR="" EXPECTED_HEAD="" EXPECTED_BASE_OID="" EXPECTED_BASE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --base) EXPECTED_BASE="${2:?base required}"; shift 2;;
    --expected-head) EXPECTED_HEAD="${2:?head OID required}"; shift 2;;
    --expected-base-oid) EXPECTED_BASE_OID="${2:?base OID required}"; shift 2;;
    -*) echo "solo-merge.sh: 알 수 없는 인자 '$1'" >&2; exit 2;;
    *) [ -z "$PR" ] || exit 2; PR="$1"; shift;;
  esac
done
[ -n "$PR" ] || PR=$(gh pr view --json number --jq .number)
for oid in "$EXPECTED_HEAD" "$EXPECTED_BASE_OID"; do
  [ -z "$oid" ] || [[ "$oid" =~ ^[0-9a-fA-F]{40}$ ]] || exit 2
done
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
BASE=$(gh pr view "$PR" --repo "$OWNER_REPO" --json baseRefName --jq .baseRefName)
# 머지는 형제 pr-merge.sh(게이트 재검증 후 머지)로 위임 — 테스트가 SOLO_MERGE_MERGE_CMD로 주입.
MERGE_CMD="${SOLO_MERGE_MERGE_CMD:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/pr-merge.sh}"
GATE_LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/pr-merge.sh"
RPR_PATH="repos/$OWNER_REPO/branches/$BASE/protection/required_pull_request_reviews"
PROTECTION_PATH="${RPR_PATH%/required_pull_request_reviews}"

# pre-gate (보호 건드리기 *전*) — CI required·미해결 스레드 0·mergeable. 미달이면 DELETE 이전에 중단해
#   break-glass 창을 아예 열지 않는다(AC-6). pr-merge가 머지 시 재검증하지만, 여기서 먼저 막는 게 최소 노출.
if gh pr checks "$PR" --repo "$OWNER_REPO" --required >/dev/null 2>&1; then CI_RC=0; else CI_RC=1; fi
PRMERGE_SOURCE_ONLY=1 source "$GATE_LIB"
unset PRMERGE_SOURCE_ONLY
MERGE_ARGS=("$PR")
if [ -n "$EXPECTED_BASE$EXPECTED_HEAD$EXPECTED_BASE_OID" ]; then
  CANDIDATE=$(read_pr_candidate) || exit 1
  IFS='|' read -r ACTUAL_BASE ACTUAL_BASE_OID ACTUAL_HEAD ACTUAL_HEAD_OID <<< "$CANDIDATE"
  [ -z "$EXPECTED_BASE" ] || [ "$EXPECTED_BASE" = "$ACTUAL_BASE" ] || exit 1
  [ -z "$EXPECTED_HEAD" ] || [ "$EXPECTED_HEAD" = "$ACTUAL_HEAD_OID" ] || exit 1
  [ -z "$EXPECTED_BASE_OID" ] || [ "$EXPECTED_BASE_OID" = "$ACTUAL_BASE_OID" ] || exit 1
  MERGE_ARGS+=(--base "$ACTUAL_BASE" --expected-head "$ACTUAL_HEAD_OID" --expected-base-oid "$ACTUAL_BASE_OID")
fi
UNRESOLVED=$(count_unresolved_threads "${OWNER_REPO%/*}" "${OWNER_REPO#*/}" "$PR" 2>/dev/null || echo "?")
MERGEABLE=$(gh pr view "$PR" --repo "$OWNER_REPO" --json mergeable --jq .mergeable 2>/dev/null || echo "?")
if ! REASON=$(solo_gate_decide "$CI_RC" "$UNRESOLVED" "$MERGEABLE"); then
  echo "⛔ pre-gate 미달 — 보호를 건드리지 않고 중단: $REASON" >&2
  exit 1
fi

# save: 현재 승인요건 설정 전체 저장(복구용). 보호 없던 repo면 REVIEWS_CONFIG 빈값 → HAD_PROTECTION=no.
BRANCH_CONFIG=$(gh api "$PROTECTION_PATH" 2>/dev/null) || {
  echo "⛔ 브랜치 보호 조회 실패 — 요건 없음으로 취급하지 않고 중단: $BASE" >&2; exit 1;
}
REVIEWS_CONFIG=$(printf '%s' "$BRANCH_CONFIG" | branch_review_config) || {
  echo "⛔ 브랜치 보호 응답을 검증할 수 없어 중단: $BASE" >&2; exit 1;
}
ORIG_BRANCH_POLICY=$(printf '%s' "$BRANCH_CONFIG" | canonical_branch_policy) || exit 1
HAD_PROTECTION=$(printf '%s' "$REVIEWS_CONFIG" | had_protection)
ORIG_COUNT=$(printf '%s' "$REVIEWS_CONFIG" | _json_field required_approving_review_count 2>/dev/null || echo "?")
ORIG_PAYLOAD=$(printf '%s' "$REVIEWS_CONFIG" | extract_restore_payload 2>/dev/null || echo "?")
[ -n "$ORIG_COUNT" ] || ORIG_COUNT="?"   # 빈 값(파서 실패)도 sentinel로 — verify가 fail-closed 판정
if [ "$HAD_PROTECTION" = yes ] && { [ "$ORIG_PAYLOAD" = "?" ] || [ -z "$ORIG_PAYLOAD" ] || [ "$ORIG_PAYLOAD" = "{}" ]; }; then
  echo "⛔ 리뷰 보호 복구 payload를 만들 수 없어 DELETE 전에 중단" >&2
  exit 1
fi

# restore(trap 대상): 저장한 원본 설정을 PATCH로 되돌린다. 멱등(_restored 가드) — 명시 호출과 trap이
#   겹쳐도 1회. HAD_PROTECTION=no면 no-op(요건 신규 생성 방지).
_restored=0
_restore() {
  [ "$_restored" = 1 ] && return 0
  [ "$HAD_PROTECTION" = yes ] || return 0
  local payload attempt; payload=$(printf '%s' "$REVIEWS_CONFIG" | extract_restore_payload 2>/dev/null || true)
  if [ -z "$payload" ] || [ "$payload" = "{}" ]; then   # payload 생성 실패/빈 객체 → PATCH 안 보냄
    # 빈 PATCH나 {} PATCH는 no-op/필드 리셋 위험 → 보내지 않고 경보. verify가 fail-closed로 재확인.
    echo "  ⚠️ 복구 payload 생성 실패/공백(python3·jq 부재·실패) — $BASE 승인요건 수동 재설정 필요(count=$ORIG_COUNT)." >&2
    return 1
  fi
  for attempt in 1 2 3; do
    if printf '%s' "$payload" | gh api -X PATCH "$RPR_PATH" --input - >/dev/null 2>&1; then
      _restored=1
      return 0
    fi
  done
  echo "  ⚠️ 승인요건 복구 PATCH 3회 실패 — 수동으로 $BASE 보호에 승인요건 재설정 필요(count=$ORIG_COUNT)" >&2
  return 1
}

# arm trap: 정상·에러(set -e)·시그널(INT/TERM/HUP) 종료에서 복구를 시도한다. 시그널 핸들러는
#   복구 후 관례적 코드로 exit(그 exit이 EXIT trap을 재발화해도 _restored 가드로 no-op). 보호 있을 때만 무장.
#   ⚠️ SIGKILL·전원손실은 uncatchable — 별도로 저장한 원래 정책과 읽기 결과를 대조해야 한다.
if [ "$HAD_PROTECTION" = yes ]; then
  trap '_restore' EXIT
  trap '_restore; exit 130' INT
  trap '_restore; exit 143' TERM
  trap '_restore; exit 129' HUP
  echo "🔓 break-glass: $BASE 승인요건 일시 삭제(머지 후 복구)"
  gh api -X DELETE "$RPR_PATH" >/dev/null 2>&1
fi

# merge — 실패 시 set -e로 스크립트 이탈 → EXIT trap이 복구. pr-merge가 CI·스레드·mergeable 재검증.
bash "$MERGE_CMD" "${MERGE_ARGS[@]}"

# 정상 경로: 명시 복구 후 trap 해제(성공 확정).
_restore
trap - EXIT INT TERM HUP

# verify: 머지됨 + 승인요건 원값 복원 확인. **fail-closed** — sentinel("?"/빈값)이면 '일치'가 아니라 '실패'로
#   판정(복구 실패를 조용히 통과시키지 않는다). 복구가 어떤 이유로든(파서 부재·PATCH 5xx) 안 됐으면 여기서 경보.
STATE=$(gh pr view "$PR" --repo "$OWNER_REPO" --json state --jq .state 2>/dev/null || echo "?")
if [ "$HAD_PROTECTION" = yes ]; then
  RESTORED_BRANCH_CONFIG=$(gh api "$PROTECTION_PATH" 2>/dev/null || echo "?")
  RESTORED_CONFIG=$(printf '%s' "$RESTORED_BRANCH_CONFIG" | branch_review_config 2>/dev/null || echo "?")
  RESTORED_BRANCH_POLICY=$(printf '%s' "$RESTORED_BRANCH_CONFIG" | canonical_branch_policy 2>/dev/null || echo "?")
  RESTORED_PAYLOAD=$(printf '%s' "$RESTORED_CONFIG" | extract_restore_payload 2>/dev/null || echo "?")
  RESTORED_COUNT=$(printf '%s' "$RESTORED_CONFIG" | _json_field required_approving_review_count 2>/dev/null || echo "?")
  if [ "$ORIG_PAYLOAD" = "?" ] || [ "$RESTORED_PAYLOAD" = "?" ] || [ "$RESTORED_BRANCH_POLICY" = "?" ] || [ "$RESTORED_BRANCH_POLICY" != "$ORIG_BRANCH_POLICY" ]; then
    echo "❌ 복구 검증 실패 — 리뷰 보호 전체 정책이 원값과 다름(count=$RESTORED_COUNT, 원값 $ORIG_COUNT). 즉시 수동 재설정 필요: $BASE" >&2
    exit 1
  fi
  echo "🔒 복구 확인: $BASE 승인요건 count=$RESTORED_COUNT"
fi
[ "$STATE" = "MERGED" ] || { echo "❌ 머지 상태 확인 실패: state=$STATE" >&2; exit 1; }
echo "✅ solo-merge 완료 — PR #$PR MERGED"

#!/usr/bin/env bash
# Existing GitHub protection: preserve company reviews, actors, checks and app bindings.
# --branches main|main,develop (default both); --preview performs zero writes.
# --approvals N targets main, --develop-approvals N targets develop. Omitted counts
# are informational in --check and preserved in apply. Reductions are rejected.
# --contexts adds checks during apply; --check retains exact-set diagnostics.
# Unknown policy/rulesets, missing protection, or query errors fail before mutation.
# See docs/company-policy.md. GitHub owns and enforces server policy.
set -uo pipefail

# ── 드리프트 판정(순수) — 승인·admin·status checks·strict·force/delete·conversation·stale-review를
#    받아 판정. gh/python과 분리해 테스트가 주입 검증(tests/set-branch-protection-test.sh).
#    판정 로직 단일 출처 = 이 함수. ──
#   appr: 승인요건 개수("0"/"None"=승인없음, "?"=파싱실패=fail-closed). adm: enforce_admins.enabled("True"=on).
#   chk : required status check 개수(-1=null/없음, 0=빈목록=약한 보호, >0=정상). "?"=파싱실패=fail-closed.
#   expected(4번째, 기본""): 승인 축 검증 모드.
#     "" = 정보성(승인 개수 무관 통과 · 단 "?"=파싱실패만 drift) — 팀/솔로 모르는 --check 기본. 승인↑는 더 강한
#          보호라 드리프트 아님(이 시맨틱이 /repo-sync 팀 repo 오탐 제거).
#     "0" = 솔로 엄격(정확히 0/None만 ok — 솔로 repo가 승인1로 드리프트했을 때 데드락 경고).
#     "N"(≥1) = 팀(appr>=N면 ok · None/미달=drift).
#   echo "ok"(부합, rc0) 또는 "drift:<사유들>"(rc1).
classify_protection() {
  local appr="$1" adm="$2" chk="$3" expected="${4:-}" strict="${5:-}" fpush="${6:-}" del="${7:-}" conv="${8:-}" dismiss="${9:-}" msg="" okappr=false okchk=false okstrict=true okfpush=true okdel=true okconv=true okdismiss=true
  if [ -z "$expected" ]; then
    [ "$appr" != "?" ] && okappr=true                                   # 정보성: 파싱된 값이면 개수 무관 통과
  elif [ "$expected" = "0" ]; then
    { [ "$appr" = "0" ] || [ "$appr" = "None" ]; } && okappr=true       # 솔로 엄격: 정확히 0
  else
    [ "$appr" -ge "$expected" ] 2>/dev/null && okappr=true              # 팀: appr>=N (비숫자=fail-closed)
  fi
  [ "$chk" -gt 0 ] 2>/dev/null && okchk=true
  # strict(=required_status_checks.strict, "브랜치가 base 최신일 때만 머지"): false면 stale-green 머지 허용
  #   (대상이 base 최신이 아니어도 오래된 CI green으로 머지). 표준=true. 값이 주어졌고 true가 아니면 drift.
  case "$strict" in ""|true|True) ;; *) okstrict=false;; esac
  # allow_force_pushes/allow_deletions: 표준=false(차단). true면 계층0 서버 백스톱이 force-push/삭제를 막지 않아
  #   guard 재설계 [A]의 "force-push를 계층0에 위임" 전제가 붕괴한다. ""=미지정(무관) · "?"/None 등=fail-closed(drift).
  case "$fpush" in ""|false|False) ;; *) okfpush=false;; esac
  case "$del" in ""|false|False) ;; *) okdel=false;; esac
  case "$conv" in ""|true|True) ;; *) okconv=false;; esac
  # 승인요건이 있으면 새 push 뒤 stale 승인을 무효화해야 한다. 승인0에서는 review 설정 자체가 없으므로 무관.
  if [ "$appr" -ge 1 ] 2>/dev/null && [ -n "$dismiss" ]; then
    case "$dismiss" in true|True) ;; *) okdismiss=false;; esac
  fi
  if $okappr && [ "$adm" = "True" ] && $okchk && $okstrict && $okfpush && $okdel && $okconv && $okdismiss; then echo "ok"; return 0; fi
  if ! $okappr; then
    if [ -z "$expected" ];       then msg="$msg 승인요건 파싱실패=$appr"
    elif [ "$expected" = "0" ];  then msg="$msg 승인요건=$appr(솔로표준0·팀이면 --approvals N)"
    else                              msg="$msg 승인요건=$appr(팀표준≥$expected · 리뷰어 부재?)"; fi
  fi
  [ "$adm" = "True" ] || msg="$msg enforce_admins=$adm(표준=on · off면 CI red 머지 가능!)"
  $okchk || msg="$msg required_status_checks=${chk}개(표준 non-null · CI 이후 재적용 필요)"
  $okstrict || msg="$msg strict=$strict(표준=true · false면 stale-green 머지 허용)"
  $okfpush || msg="$msg allow_force_pushes=$fpush(표준=false · true면 계층0 force-push 차단 부재 → 재설계 [A] 위임 전제 붕괴)"
  $okdel || msg="$msg allow_deletions=$del(표준=false · true면 브랜치 삭제 가능)"
  $okconv || msg="$msg required_conversation_resolution=$conv(표준=true)"
  $okdismiss || msg="$msg dismiss_stale_reviews=$dismiss(승인요건 1+ 표준=true)"
  echo "drift:$msg"; return 1
}

# 승인요건 N → required_pull_request_reviews JSON(적용부 히어독 주입 전 테스트 가능한 seam).
#   0(또는 비숫자) → null(솔로). N≥1 → 승인 N + dismiss_stale_reviews=true(승인 후 push 시 stale 승인 무효화).
reviews_json() {
  local n="${1:-0}"
  if [ "$n" -ge 1 ] 2>/dev/null; then
    printf '{"required_approving_review_count":%s,"dismiss_stale_reviews":true}' "$n"
  else
    printf 'null'
  fi
}

# CSV "a, b ,c" → JSON 배열 '["a", "b", "c"]'(공백 trim·빈 항목 제거). --contexts 명시 등록용 순수 함수.
contexts_json() {
  printf '%s' "$1" | python3 -c "import sys,json; print(json.dumps([x.strip() for x in sys.stdin.read().split(',') if x.strip()]))"
}

# CSV context를 순서·중복과 무관한 exact-set 비교용 문자열로 정규화한다.
contexts_normalized() {
  printf '%s' "$1" | python3 -c "import sys; print(','.join(sorted(set(x.strip() for x in sys.stdin.read().split(',') if x.strip()))))"
}

# 조회 성공과 유효한 비어 있지 않은 context 집합을 분리한다. 실패/빈 결과로 보호를 약화하지 않는다.
validated_contexts() {
  python3 -c 'import sys,json
d=json.load(sys.stdin)
if not isinstance(d,list) or not d or any(not isinstance(x,str) or not x.strip() for x in d):
    raise SystemExit("required contexts must be a nonempty string list")
print(json.dumps(sorted(set(d))))'
}

# 테스트 훅: 함수만 로드하고 종료(REPO 인자 파싱·gh 없이 순수 함수만 검증).
[ -n "${SBP_SOURCE_ONLY:-}" ] && return 0 2>/dev/null || true

REPO="${1:?사용: set-branch-protection.sh <repo> [--check|--preview] [--branches main|main,develop] [--contexts a,b] [--approvals N] [--develop-approvals N]}"; shift
CHECK=false; PREVIEW=false; CONTEXTS=""; CONTEXTS_SET=false; APPROVALS=""; DEVELOP_APPROVALS=""; BRANCHES="main,develop"
while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK=true; shift;;
    --preview) PREVIEW=true; shift;;
    --contexts|--approvals|--develop-approvals|--branches)
      option="$1"; [ $# -ge 2 ] || { echo "$option requires a value" >&2; exit 2; }
      case "$option" in
        --contexts) CONTEXTS="$2"; CONTEXTS_SET=true;;
        --approvals) APPROVALS="$2";;
        --develop-approvals) DEVELOP_APPROVALS="$2";;
        --branches) BRANCHES="$2";;
      esac
      shift 2;;
    *) echo "set-branch-protection.sh: 알 수 없는 인자 '$1'" >&2; exit 2;;
  esac
done
for n in "$APPROVALS" "$DEVELOP_APPROVALS"; do
  [ -z "$n" ] || [[ "$n" =~ ^[0-6]$ ]] || { echo 'approvals must be an integer 0..6' >&2; exit 2; }
done
case "$BRANCHES" in main) branches=(main);; main,develop) branches=(main develop);; *) echo 'branches must be main or main,develop' >&2; exit 2;; esac
if $CHECK && $PREVIEW; then echo '--check and --preview are mutually exclusive' >&2; exit 2; fi
if [ "$BRANCHES" = main ] && [ -n "$DEVELOP_APPROVALS" ]; then echo '--develop-approvals requires develop' >&2; exit 2; fi
[[ "$REPO" == */* ]] || { owner=$(gh api user --jq .login) || exit 1; [ -n "$owner" ] || exit 1; REPO="$owner/$REPO"; }
HELPER="$(cd "$(dirname "$0")" && pwd)/branch-protection-policy.mjs"
TMP=$(mktemp -d) || exit 1
trap 'rm -rf "$TMP"' EXIT
EXPLICIT_CONTEXTS=""
if $CONTEXTS_SET; then
  EXPLICIT_CONTEXTS=$(contexts_json "$CONTEXTS" | validated_contexts) || { echo 'invalid contexts' >&2; exit 2; }
fi
# All selected originals and unsupported server policies must pass before any write.
if ! $CHECK; then
  gh api "repos/$REPO/rulesets?includes_parents=true&per_page=100" >"$TMP/rules" || { echo 'ruleset query failed; no changes' >&2; exit 1; }
  node "$HELPER" rules "$TMP/rules" || exit 1
  for branch in "${branches[@]}"; do
    gh api "repos/$REPO/branches/$branch" >/dev/null || { echo "$branch branch query failed; no changes" >&2; exit 1; }
    gh api "repos/$REPO/branches/$branch/protection" >"$TMP/$branch.original" || { echo "$branch original protection query failed; no changes" >&2; exit 1; }
    if $CONTEXTS_SET; then ctx="$EXPLICIT_CONTEXTS"
    else
      detected=$(gh api "repos/$REPO/commits/$branch/check-runs" --jq '[.check_runs[].name]|unique') || { echo "$branch check query failed; no changes" >&2; exit 1; }
      ctx=$(printf '%s' "$detected" | validated_contexts) || exit 1
    fi
    printf '%s' "$ctx" >"$TMP/$branch.contexts"
    exp="$APPROVALS"; [ "$branch" = develop ] && exp="$DEVELOP_APPROVALS"
    node "$HELPER" plan "$TMP/$branch.original" "$TMP/$branch.contexts" "$exp" "$TMP/$branch.plan" || exit 1
  done
  if $PREVIEW; then
    for branch in "${branches[@]}"; do echo "$REPO:$branch preview (no writes)"; cat "$TMP/$branch.plan"; echo; done
    exit 0
  fi
  # Detect policy drift after preflight as well. REST PUT has no atomic policy CAS.
  for branch in "${branches[@]}"; do
    gh api "repos/$REPO/branches/$branch/protection" >"$TMP/$branch.current" || exit 1
    cmp -s "$TMP/$branch.original" "$TMP/$branch.current" || { echo "$branch changed during preflight; no changes" >&2; exit 1; }
  done
fi
rc=0
for branch in "${branches[@]}"; do
  if ! gh api "repos/$REPO/branches/$branch" >/dev/null 2>&1; then
    echo "✗ $REPO:$branch — 브랜치 조회 실패"; rc=1; continue
  fi
  if $CHECK; then
    prot=$(gh api "repos/$REPO/branches/$branch/protection" 2>/dev/null || true)
    if [ -z "$prot" ]; then echo "✗ $REPO:$branch — 보호 미적용"; rc=1; continue; fi
    printf '%s' "$prot" >"$TMP/$branch.check"
    if ! node "$HELPER" validate "$TMP/$branch.check"; then
      echo "✗ $REPO:$branch — 정책 응답 미지원·잘못된 형식"; rc=1; continue
    fi
    appr=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('required_pull_request_reviews'); print(r.get('required_approving_review_count') if r else 0)" 2>/dev/null || echo "?")
    adm=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('enforce_admins',{}).get('enabled'))" 2>/dev/null || echo "?")
    # B1: required_status_checks 개수 — -1=null(없음), 0=빈 목록(약한 보호), >0=정상.
    chk=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('required_status_checks'); print(len(r.get('contexts') or [c.get('context') for c in (r.get('checks') or [])]) if r else -1)" 2>/dev/null || echo "?")
    actual_contexts=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('required_status_checks') or {}; names=list(r.get('contexts') or []) + [c.get('context') for c in (r.get('checks') or [])]; print(','.join(sorted(set(x for x in names if x))))" 2>/dev/null || echo "?")
    # strict(up-to-date 필수) — false면 stale-green 머지 허용(#199). rsc null이면 ''(chk가 이미 drift로 잡음).
    strict=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('required_status_checks'); print(r.get('strict') if r else '')" 2>/dev/null || echo "?")
    # allow_force_pushes/allow_deletions(표준=false) — 계층0이 force-push·삭제를 실제로 막는지. 재설계 [A] 전제.
    fpush=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('allow_force_pushes',{}).get('enabled'))" 2>/dev/null || echo "?")
    del=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('allow_deletions',{}).get('enabled'))" 2>/dev/null || echo "?")
    conv=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('required_conversation_resolution',{}).get('enabled'))" 2>/dev/null || echo "?")
    dismiss=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('required_pull_request_reviews'); print(r.get('dismiss_stale_reviews') if r else '')" 2>/dev/null || echo "?")
    # 승인 baseline: 각 브랜치의 미지정 승인 개수는 정보성이다.
    exp="$APPROVALS"; [ "$branch" = "develop" ] && exp="$DEVELOP_APPROVALS"
    verdict=$(classify_protection "$appr" "$adm" "$chk" "$exp" "$strict" "$fpush" "$del" "$conv" "$dismiss") || true
    context_drift=""
    if [ -n "$CONTEXTS" ]; then
      expected_contexts=$(contexts_normalized "$CONTEXTS" 2>/dev/null || echo "?")
      [ "$actual_contexts" = "$expected_contexts" ] || context_drift=" required_contexts=$actual_contexts(표준=$expected_contexts)"
    fi
    if [ "$verdict" = "ok" ] && [ -z "$context_drift" ]; then
      echo "✓ $REPO:$branch — 보호 적용(승인$appr · enforce_admins=on · checks=$chk)"
    else
      protection_drift="${verdict#drift:}"; [ "$verdict" = "ok" ] && protection_drift=""
      echo "⚠ $REPO:$branch — 드리프트:${protection_drift}${context_drift}"; rc=1
    fi
    continue
  fi

  if ! gh api -X PUT "repos/$REPO/branches/$branch/protection" --input "$TMP/$branch.plan" >/dev/null; then
    echo "✗ $REPO:$branch — 적용 실패; 일부 변경 가능" >&2; exit 1
  fi
  if ! gh api "repos/$REPO/branches/$branch/protection" >"$TMP/$branch.after" || ! node "$HELPER" verify "$TMP/$branch.original" "$TMP/$branch.after" "$TMP/$branch.plan"; then
    echo "✗ $REPO:$branch — 적용 후 정책 불일치; 실제 정책 확인 필요" >&2; exit 1
  fi
  echo "✓ $REPO:$branch — 보호 보존·재검증"
done
exit "$rc"

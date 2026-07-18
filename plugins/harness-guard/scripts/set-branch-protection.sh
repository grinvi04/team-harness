#!/usr/bin/env bash
# set-branch-protection.sh — 기존 repo에 **표준 솔로 브랜치 보호**를 적용/검증한다.
# 플러그인과 함께 배포(check-repo-sync.mjs와 동일 위치) — /repo-sync 스킬이 참조.
# new-repo.sh는 신규 repo(생성 시 STACK_CHECKS 명시 등록)를, 이 스크립트는 **기존 repo**를 다룬다
# (실제 보고되는 check context를 자동 감지 → 이름 불일치 데드락 회피).
#
# 사용:
#   bash set-branch-protection.sh <repo>                    # main·develop에 표준 보호 적용(check 자동감지)
#   bash set-branch-protection.sh <repo> --check            # 적용 안 하고 현재 상태만 검증(드리프트 리포트)
#   bash set-branch-protection.sh <repo> --contexts a,b,c   # required check를 명시 등록(기존 repo 리메디에이션)
#   bash set-branch-protection.sh <repo> --approvals N      # 팀 모드: main에 리뷰 승인 N 요구(develop은 0 유지)
#   <repo> = owner/name 또는 name(=$(gh api user)/name)
#   ※ --contexts: base 브랜치 머지커밋엔 check-run이 없어 자동감지가 빈 목록이 될 때(기존 repo 첫 적용) 쓴다.
#     new-repo.sh(신규)는 STACK_CHECKS로 자동 등록하므로 불필요.
#   ※ --approvals: 멤버 합류 후 팀 모드로 올릴 때. main에만 승인 N(+ dismiss_stale_reviews)을 걸고
#     develop은 승인0 유지(pr-merge.sh --auto 무프롬프트 머지 보존). --check와 함께 주면 그 N을 baseline으로
#     검증(미지정 시 승인 개수는 정보성 — 아래 classify_protection). new-repo.sh(신규)는 항상 솔로(승인0):
#     day-1 소유자 1명이 승인1이면 self-approve 불가로 데드락이라, 팀 승인은 이 스크립트로 나중에 올린다.
#
# 표준 config(솔로 기본, decisions "브랜치 보호 표준"):
#   required status checks(자동감지·strict) · 대화 resolve · force-push/삭제 차단,
#   **승인요건 0 · enforce_admins=true** (승인0이라 데드락 없음 · enforce_admins=true라야
#   required status check(CI)가 소유자·관리자에게도 강제되는 **우회불가 계약** — false면 관리자가
#   CI red/pending도 머지 가능). 팀 모드는 `--approvals N`으로 main에 승인 N을 추가(develop은 0 유지).
#   ※ 긴급 break-glass(드묾: CI 인프라 자체 장애)는 required_status_checks를 일시 완화 — 통상은 CI를 고쳐 머지.
set -uo pipefail

# ── 드리프트 판정(순수) — (승인수, enforce_admins, status-check 개수, 기대승인)만 받아 판정. gh/python과
#    분리해 테스트가 주입 검증(tests/set-branch-protection-test.sh). 판정 로직 단일 출처 = 이 함수. ──
#   appr: 승인요건 개수("0"/"None"=승인없음, "?"=파싱실패=fail-closed). adm: enforce_admins.enabled("True"=on).
#   chk : required status check 개수(-1=null/없음, 0=빈목록=약한 보호, >0=정상). "?"=파싱실패=fail-closed.
#   expected(4번째, 기본""): 승인 축 검증 모드.
#     "" = 정보성(승인 개수 무관 통과 · 단 "?"=파싱실패만 drift) — 팀/솔로 모르는 --check 기본. 승인↑는 더 강한
#          보호라 드리프트 아님(이 시맨틱이 /repo-sync 팀 repo 오탐 제거).
#     "0" = 솔로 엄격(정확히 0/None만 ok — 솔로 repo가 승인1로 드리프트했을 때 데드락 경고).
#     "N"(≥1) = 팀(appr>=N면 ok · None/미달=drift).
#   echo "ok"(부합, rc0) 또는 "drift:<사유들>"(rc1).
classify_protection() {
  local appr="$1" adm="$2" chk="$3" expected="${4:-}" strict="${5:-}" fpush="${6:-}" del="${7:-}" conv="${8:-}" msg="" okappr=false okchk=false okstrict=true okfpush=true okdel=true okconv=true
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
  if $okappr && [ "$adm" = "True" ] && $okchk && $okstrict && $okfpush && $okdel && $okconv; then echo "ok"; return 0; fi
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

# 테스트 훅: 함수만 로드하고 종료(REPO 인자 파싱·gh 없이 순수 함수만 검증).
[ -n "${SBP_SOURCE_ONLY:-}" ] && return 0 2>/dev/null || true

REPO="${1:?사용: set-branch-protection.sh <repo> [--check] [--contexts a,b,c] [--approvals N]}"; shift
CHECK=false; CONTEXTS=""; APPROVALS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --check)     CHECK=true; shift;;
    # 값 필수(마지막 인자로 값 없이 오면 shift 2가 no-op → 무한루프): $#>=2 확인 후 소비.
    --contexts)  [ $# -ge 2 ] || { echo "set-branch-protection.sh: --contexts는 값이 필요합니다 (a,b,c)" >&2; exit 2; }; CONTEXTS="$2"; shift 2;;   # 기존 repo 리메디에이션 — 명시 required check 이름
    --approvals) [ $# -ge 2 ] || { echo "set-branch-protection.sh: --approvals는 값이 필요합니다 (0 이상 정수)" >&2; exit 2; }; APPROVALS="$2"; shift 2;;   # 팀 모드 — main에 리뷰 승인 N(develop은 0 유지)
    *) echo "set-branch-protection.sh: 알 수 없는 인자 '$1'" >&2; exit 2;;
  esac
done
[ -n "$APPROVALS" ] && ! [[ "$APPROVALS" =~ ^[0-9]+$ ]] && { echo "set-branch-protection.sh: --approvals는 0 이상 정수여야 합니다 ('$APPROVALS')" >&2; exit 2; }
[[ "$REPO" == */* ]] || REPO="$(gh api user --jq .login 2>/dev/null)/$REPO"

rc=0
for branch in main develop; do
  if ! gh api "repos/$REPO/branches/$branch" >/dev/null 2>&1; then
    echo "skip $REPO:$branch (브랜치 없음/비공개)"; continue
  fi

  if $CHECK; then
    prot=$(gh api "repos/$REPO/branches/$branch/protection" 2>/dev/null || true)
    if [ -z "$prot" ]; then echo "✗ $REPO:$branch — 보호 미적용"; rc=1; continue; fi
    appr=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('required_pull_request_reviews'); print(r.get('required_approving_review_count') if r else 0)" 2>/dev/null || echo "?")
    adm=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('enforce_admins',{}).get('enabled'))" 2>/dev/null || echo "?")
    # B1: required_status_checks 개수 — -1=null(없음), 0=빈 목록(약한 보호), >0=정상.
    chk=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('required_status_checks'); print(len(r.get('contexts') or [c.get('context') for c in (r.get('checks') or [])]) if r else -1)" 2>/dev/null || echo "?")
    # strict(up-to-date 필수) — false면 stale-green 머지 허용(#199). rsc null이면 ''(chk가 이미 drift로 잡음).
    strict=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('required_status_checks'); print(r.get('strict') if r else '')" 2>/dev/null || echo "?")
    # allow_force_pushes/allow_deletions(표준=false) — 계층0이 force-push·삭제를 실제로 막는지. 재설계 [A] 전제.
    fpush=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('allow_force_pushes',{}).get('enabled'))" 2>/dev/null || echo "?")
    del=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('allow_deletions',{}).get('enabled'))" 2>/dev/null || echo "?")
    conv=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('required_conversation_resolution',{}).get('enabled'))" 2>/dev/null || echo "?")
    # 승인 baseline: main만 --approvals N으로 검증(develop은 승인0 유지라 정보성). 미지정=정보성(개수 무관).
    exp=""; [ "$branch" = "main" ] && exp="$APPROVALS"
    verdict=$(classify_protection "$appr" "$adm" "$chk" "$exp" "$strict" "$fpush" "$del" "$conv") || true
    if [ "$verdict" = "ok" ]; then
      echo "✓ $REPO:$branch — 보호 적용(승인$appr · enforce_admins=on · checks=$chk)"
    else
      echo "⚠ $REPO:$branch — 드리프트:${verdict#drift:}"; rc=1
    fi
    continue
  fi

  # 적용: --contexts 지정 시 그 이름을 required로(기존 repo 리메디에이션 — base 머지커밋엔 check-run이 없어
  #       자동감지 불가한 경우). 미지정 시 실제 보고되는 check 이름을 자동감지(없으면 생략 → 데드락 방지).
  if [ -n "$CONTEXTS" ]; then
    ctx=$(contexts_json "$CONTEXTS")
  else
    ctx=$(gh api "repos/$REPO/commits/$branch/check-runs" --jq '[.check_runs[].name]|unique' 2>/dev/null); [ -z "$ctx" ] && ctx='[]'
  fi
  rsc="null"; [ "$ctx" != "[]" ] && rsc="{\"strict\":true,\"contexts\":$ctx}"
  # 승인요건: main만 --approvals N(팀 모드) — develop은 0 유지(pr-merge.sh --auto 무프롬프트 머지 보존).
  bappr=0; [ "$branch" = "main" ] && bappr="${APPROVALS:-0}"
  rpr=$(reviews_json "$bappr")
  if gh api -X PUT "repos/$REPO/branches/$branch/protection" --input - >/dev/null 2>&1 <<JSON
{"required_status_checks":$rsc,"enforce_admins":true,"required_pull_request_reviews":$rpr,"restrictions":null,"required_conversation_resolution":true,"allow_force_pushes":false,"allow_deletions":false}
JSON
  then
    if [ "$ctx" = "[]" ]; then
      # B1: 감지된 check가 0개면 required_status_checks=null(약한 보호)로 걸린 것 — 성공으로 은폐하지 않는다.
      echo "⚠ $REPO:$branch — 보호 적용됐으나 required status check 0개(첫 CI 이전?) — CI 실행 후 재실행 필요"; rc=1
    else
      echo "✓ $REPO:$branch — 보호 적용(승인$bappr · enforce_admins=on · checks=$ctx)"
    fi
  else echo "✗ $REPO:$branch — 적용 실패(private+Free? 권한?)"; rc=1; fi
done
exit $rc

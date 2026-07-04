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
#   <repo> = owner/name 또는 name(=$(gh api user)/name)
#   ※ --contexts: base 브랜치 머지커밋엔 check-run이 없어 자동감지가 빈 목록이 될 때(기존 repo 첫 적용) 쓴다.
#     new-repo.sh(신규)는 STACK_CHECKS로 자동 등록하므로 불필요.
#
# 표준 config(솔로, decisions "브랜치 보호 표준"):
#   required status checks(자동감지·strict) · 대화 resolve · force-push/삭제 차단,
#   **승인요건 0 · enforce_admins=true** (승인0이라 데드락 없음 · enforce_admins=true라야
#   required status check(CI)가 소유자·관리자에게도 강제되는 **우회불가 계약** — false면 관리자가
#   CI red/pending도 머지 가능). 리뷰어 합류 시 승인요건을 수동 1↑ 조정.
#   ※ 긴급 break-glass(드묾: CI 인프라 자체 장애)는 required_status_checks를 일시 완화 — 통상은 CI를 고쳐 머지.
set -uo pipefail

# ── 드리프트 판정(순수) — (승인수, enforce_admins, status-check 개수)만 받아 판정. gh/python과 분리해
#    테스트가 주입 검증(tests/set-branch-protection-test.sh). 판정 로직 단일 출처 = 이 함수. ──
#   appr: 승인요건 개수("0"/"None"=표준0). adm: enforce_admins.enabled("True"=표준on).
#   chk : required status check 개수(-1=null/없음, 0=빈목록=약한 보호, >0=정상). "?"=파싱실패=fail-closed.
#   echo "ok"(표준 부합, rc0) 또는 "drift:<사유들>"(rc1).
classify_protection() {
  local appr="$1" adm="$2" chk="$3" msg="" okappr=false okchk=false
  { [ "$appr" = "0" ] || [ "$appr" = "None" ]; } && okappr=true
  [ "$chk" -gt 0 ] 2>/dev/null && okchk=true
  if $okappr && [ "$adm" = "True" ] && $okchk; then echo "ok"; return 0; fi
  $okappr || msg="$msg 승인요건=$appr(표준0·리뷰어 有면 의도)"
  [ "$adm" = "True" ] || msg="$msg enforce_admins=$adm(표준=on · off면 CI red 머지 가능!)"
  $okchk || msg="$msg required_status_checks=${chk}개(표준 non-null · CI 이후 재적용 필요)"
  echo "drift:$msg"; return 1
}

# CSV "a, b ,c" → JSON 배열 '["a", "b", "c"]'(공백 trim·빈 항목 제거). --contexts 명시 등록용 순수 함수.
contexts_json() {
  printf '%s' "$1" | python3 -c "import sys,json; print(json.dumps([x.strip() for x in sys.stdin.read().split(',') if x.strip()]))"
}

# 테스트 훅: 함수만 로드하고 종료(REPO 인자 파싱·gh 없이 순수 함수만 검증).
[ -n "${SBP_SOURCE_ONLY:-}" ] && return 0 2>/dev/null || true

REPO="${1:?사용: set-branch-protection.sh <repo> [--check] [--contexts a,b,c]}"; shift
CHECK=false; CONTEXTS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --check)    CHECK=true; shift;;
    --contexts) CONTEXTS="${2:-}"; shift 2;;  # 기존 repo 리메디에이션 — 명시 required check 이름
    *) echo "set-branch-protection.sh: 알 수 없는 인자 '$1'" >&2; exit 2;;
  esac
done
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
    verdict=$(classify_protection "$appr" "$adm" "$chk") || true
    if [ "$verdict" = "ok" ]; then
      echo "✓ $REPO:$branch — 보호 적용(승인0 · enforce_admins=on · checks=$chk, 솔로 표준)"
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
  if gh api -X PUT "repos/$REPO/branches/$branch/protection" --input - >/dev/null 2>&1 <<JSON
{"required_status_checks":$rsc,"enforce_admins":true,"required_pull_request_reviews":null,"restrictions":null,"required_conversation_resolution":true,"allow_force_pushes":false,"allow_deletions":false}
JSON
  then
    if [ "$ctx" = "[]" ]; then
      # B1: 감지된 check가 0개면 required_status_checks=null(약한 보호)로 걸린 것 — 성공으로 은폐하지 않는다.
      echo "⚠ $REPO:$branch — 보호 적용됐으나 required status check 0개(첫 CI 이전?) — CI 실행 후 재실행 필요"; rc=1
    else
      echo "✓ $REPO:$branch — 보호 적용(승인0 · enforce_admins=on · checks=$ctx)"
    fi
  else echo "✗ $REPO:$branch — 적용 실패(private+Free? 권한?)"; rc=1; fi
done
exit $rc

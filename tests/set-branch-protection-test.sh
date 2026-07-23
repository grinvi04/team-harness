#!/bin/bash
# tests/set-branch-protection-test.sh — set-branch-protection.sh 순수 함수 단위 검증.
# classify_protection·reviews_json·contexts_json만 source해 검증(gh/python 무관 — SBP_SOURCE_ONLY로 함수만 로드).
# 감사 B1(fail-open) 회귀 방지: 감지 check가 빈목록(0)/null(-1)이면 약한 보호이므로 drift여야 한다.
# 팀 모드: classify의 4번째 인자 expected("" 정보성 · "0" 솔로엄격 · "N" 팀), reviews_json 적용 payload seam.
# 로컬·CI 동일: bash tests/set-branch-protection-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SBP="$ROOT/plugins/harness-guard/scripts/set-branch-protection.sh"
PASS=0; FAIL=0

# desc, appr, adm, chk, want_verdict(ok|drift), want_rc, [expected(4번째 classify 인자, 기본""=정보성)], [strict(5번째, 기본""=무관)], [fpush(6번째, 기본""=무관)], [del(7번째, 기본""=무관)]
chk_case() {
  local desc="$1" appr="$2" adm="$3" chk="$4" wantv="$5" wantrc="$6" expected="${7:-}" strict="${8:-}" fpush="${9:-}" del="${10:-}" out rc gotv
  local conv="${11:-}"
  out=$(SBP_SOURCE_ONLY=1 bash -c 'source "$1"; classify_protection "$2" "$3" "$4" "$5" "$6" "$7" "$8" "$9"' _ "$SBP" "$appr" "$adm" "$chk" "$expected" "$strict" "$fpush" "$del" "$conv"); rc=$?
  gotv="ok"; case "$out" in drift:*) gotv="drift";; esac
  if [ "$gotv" = "$wantv" ] && [ "$rc" = "$wantrc" ]; then
    echo "PASS: $desc"; PASS=$((PASS+1))
  else
    echo "FAIL: $desc — want $wantv/$wantrc, got $gotv/$rc ($out)"; FAIL=$((FAIL+1))
  fi
}

# 정보성(expected 미지정=--approvals 없음): enforce_admins=True · checks>0 · appr 파싱됨이면 개수 무관 ok
chk_case "표준(0·True·3) → ok"            0    True  3    ok    0
chk_case "승인 None(=0)도 표준 → ok"       None True  2    ok    0
# 정보성: 승인≥1도 '더 강한' 보호라 drift 아님(팀 repo /repo-sync 오탐 방지 — 이 시맨틱이 핵심)
chk_case "승인1(정보성) → ok"             1    True  3    ok    0
# B1 회귀 방지: checks 빈목록(0)/null(-1) = 약한 보호 → drift(성공 은폐 금지)
chk_case "B1: checks=0(빈목록) → drift"    0    True  0    drift 1
chk_case "B1: checks=-1(null) → drift"     0    True  -1   drift 1
# enforce_admins off → drift(관리자 CI red 머지 구멍)
chk_case "enforce_admins False → drift"    0    False 3    drift 1
# python 파싱 실패('?') → fail-closed(drift)
chk_case "appr='?'(파싱실패) → drift"      "?"  True  3    drift 1
chk_case "chk='?'(파싱실패) → drift"       0    True  "?"  drift 1
# 복합(admins off + checks0) → drift(승인은 정보성이라 무관하게 다른 축에서 drift)
chk_case "복합(1·False·0) → drift"         1    False 0    drift 1

# 솔로 엄격(--approvals 0): 정확히 0/None만 ok — 솔로 repo가 승인1로 드리프트 시 데드락 경고
chk_case "솔로엄격0: 승인0 → ok"           0    True  3    ok    0   0
chk_case "솔로엄격0: 승인1 → drift"        1    True  3    drift 1   0
# 팀(--approvals 1): appr>=1 ok · 0/None=drift(승인 요건 미충족)
chk_case "팀1: 승인1 → ok"                 1    True  3    ok    0   1
chk_case "팀1: 승인2 → ok(≥N)"            2    True  3    ok    0   1
chk_case "팀1: 승인0 → drift(미달)"        0    True  3    drift 1   1
chk_case "팀1: None → drift(승인없음)"     None True  3    drift 1   1
# 팀(--approvals 2): appr>=2
chk_case "팀2: 승인1 → drift(미달)"        1    True  3    drift 1   2
# #199: strict(up-to-date) 감사 — false면 stale-green 머지 허용 → drift(성공 은폐 금지)
chk_case "strict=False → drift"            0    True  3    drift 1   ""   False
chk_case "strict=True → ok"                0    True  3    ok    0    ""   True
chk_case "strict='' (미지정) → 무관(chk가 판정)" 0 True 3    ok    0    ""   ""

# [A] 전제: allow_force_pushes:false 검증 — force-push 차단을 계층0(서버 보호)에 위임하려면 서버가 실제로
#   force-push를 막아야 한다(allow_force_pushes:true면 계층0 백스톱 없음 → [A] 위임 전제 붕괴). fpush(6번째
#   classify 인자)=allow_force_pushes.enabled: "False"=차단(표준·ok) · "True"=허용(drift) · ""=미지정(무관) ·
#   "?"=파싱실패(fail-closed·drift). del(7번째)=allow_deletions.enabled 동일 시맨틱(브랜치 삭제도 계층0 백스톱).
chk_case "fpush=False(force-push 차단) → ok"    0 True 3 ok    0 "" True False
chk_case "fpush=True(force-push 허용) → drift"  0 True 3 drift 1 "" True True
chk_case "fpush='?'(파싱실패) → drift"          0 True 3 drift 1 "" True "?"
chk_case "fpush='' (미지정) → 무관(ok)"         0 True 3 ok    0 "" True ""
chk_case "del=True(삭제 허용) → drift"          0 True 3 drift 1 "" True False True
chk_case "del=False(삭제 차단) → ok"            0 True 3 ok    0 "" True False False
chk_case "conversation=False → drift"          0 True 3 drift 1 "" True False False False
chk_case "conversation=True → ok"              0 True 3 ok    0 "" True False False True

# --contexts 명시 등록: CSV → JSON 배열(공백 trim·빈 항목 제거) — 기존 repo 리메디에이션
cj() { # desc, csv, want_json
  local desc="$1" csv="$2" want="$3" got
  got=$(SBP_SOURCE_ONLY=1 bash -c 'source "$1"; contexts_json "$2"' _ "$SBP" "$csv")
  if [ "$got" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want '$want' got '$got'"; FAIL=$((FAIL+1)); fi
}
cj "CSV 3개 → JSON 배열"    "quality,secret-scan,test-guard"  '["quality", "secret-scan", "test-guard"]'
cj "공백 trim"             " a , b "                          '["a", "b"]'
cj "빈 항목 제거"          "a,,b,"                            '["a", "b"]'
cj "단일 context"          "quality"                          '["quality"]'

# reviews_json: 적용 payload seam — 0=null(솔로) · N≥1=승인N + dismiss_stale_reviews(stale 승인 무효)
rj() { # desc, approvals, want
  local desc="$1" appr="$2" want="$3" got
  got=$(SBP_SOURCE_ONLY=1 bash -c 'source "$1"; reviews_json "$2"' _ "$SBP" "$appr")
  if [ "$got" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want '$want' got '$got'"; FAIL=$((FAIL+1)); fi
}
rj "승인0 → null(솔로)"            0  "null"
rj "승인1 → 승인1+dismiss_stale"   1  '{"required_approving_review_count":1,"dismiss_stale_reviews":true}'
rj "승인2 → 승인2+dismiss_stale"   2  '{"required_approving_review_count":2,"dismiss_stale_reviews":true}'
rj "비숫자 → null(fail-safe)"      x  "null"

# arg 파서 하드닝: 값 없는 --approvals/--contexts는 무한루프 대신 즉시 exit 2.
# REPO는 owner/name(=/ 포함)이라 gh api user 미호출 · 가드는 for-branch 루프(gh) 이전이라 네트워크 무관.
# timeout(없으면 gtimeout)으로 회귀(무한루프) 시 hang 대신 rc124=FAIL 되게 감싼다.
TO=""; command -v timeout >/dev/null 2>&1 && TO=timeout; command -v gtimeout >/dev/null 2>&1 && TO=gtimeout
arg_case() { # desc, want_rc, args...
  local desc="$1" wantrc="$2"; shift 2; local rc
  ${TO:+$TO 5} bash "$SBP" "$@" >/dev/null 2>&1; rc=$?
  if [ "$rc" = "$wantrc" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want rc$wantrc got rc$rc"; FAIL=$((FAIL+1)); fi
}
arg_case "값없는 --approvals → exit 2"  2  o/r --approvals
arg_case "값없는 --contexts → exit 2"   2  o/r --contexts
arg_case "미지정 인자 → exit 2"         2  o/r --nope

# --check --approvals 1 공개 CLI 계약: main은 승인≥1 + stale 승인 무효화,
# develop은 자동머지를 위해 승인 정확히 0이어야 한다. gh는 fixture로 대체해 네트워크를 호출하지 않는다.
CLI_TMP=$(mktemp -d)
FAKEBIN="$CLI_TMP/bin"
mkdir -p "$FAKEBIN"
trap 'rm -rf "$CLI_TMP"' EXIT
cat > "$FAKEBIN/gh" <<'SH'
#!/usr/bin/env bash
set -u
[ "${1:-}" = "api" ] || exit 70
case "${2:-}" in
  repos/o/r/branches/main|repos/o/r/branches/develop)
    printf '{}\n'
    ;;
  repos/o/r/branches/main/protection)
    if [ "${FAKE_GH_SCENARIO:-ok}" = "main-dismiss-false" ]; then
      reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":false}'
    else
      reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true}'
    fi
    printf '{"required_status_checks":{"strict":true,"contexts":["quality"]},"enforce_admins":{"enabled":true},"required_pull_request_reviews":%s,"allow_force_pushes":{"enabled":false},"allow_deletions":{"enabled":false},"required_conversation_resolution":{"enabled":true}}\n' "$reviews"
    ;;
  repos/o/r/branches/develop/protection)
    if [ "${FAKE_GH_SCENARIO:-ok}" = "develop-approval-one" ]; then
      reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}'
    else
      reviews='null'
    fi
    printf '{"required_status_checks":{"strict":true,"contexts":["quality"]},"enforce_admins":{"enabled":true},"required_pull_request_reviews":%s,"allow_force_pushes":{"enabled":false},"allow_deletions":{"enabled":false},"required_conversation_resolution":{"enabled":true}}\n' "$reviews"
    ;;
  *)
    exit 71
    ;;
esac
SH
chmod +x "$FAKEBIN/gh"

cli_check_case() { # desc, fixture scenario, expected exit
  local desc="$1" scenario="$2" wantrc="$3" out rc
  out=$(FAKE_GH_SCENARIO="$scenario" PATH="$FAKEBIN:$PATH" bash "$SBP" o/r --check --approvals 1 2>&1); rc=$?
  if [ "$rc" = "$wantrc" ]; then
    echo "PASS: $desc"; PASS=$((PASS+1))
  else
    echo "FAIL: $desc — want rc$wantrc got rc$rc ($out)"; FAIL=$((FAIL+1))
  fi
}
cli_check_case "CLI 팀1: main 승인2+dismiss, develop 승인0 → exit 0" ok 0
cli_check_case "CLI 팀1: main dismiss_stale=false → exit nonzero" main-dismiss-false 1
cli_check_case "CLI 팀1: develop 승인1 → exit nonzero" develop-approval-one 1

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

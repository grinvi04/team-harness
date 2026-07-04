#!/bin/bash
# tests/set-branch-protection-test.sh — set-branch-protection.sh --check 드리프트 판정 단위 검증.
# classify_protection만 source해 검증(gh/python 무관 — SBP_SOURCE_ONLY로 함수만 로드).
# 감사 B1(fail-open) 회귀 방지: 감지 check가 빈목록(0)/null(-1)이면 약한 보호이므로 drift여야 한다.
# 로컬·CI 동일: bash tests/set-branch-protection-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SBP="$ROOT/plugins/harness-guard/scripts/set-branch-protection.sh"
PASS=0; FAIL=0

# desc, appr, adm, chk, want_verdict(ok|drift), want_rc
chk_case() {
  local desc="$1" appr="$2" adm="$3" chk="$4" wantv="$5" wantrc="$6" out rc gotv
  out=$(SBP_SOURCE_ONLY=1 bash -c 'source "$1"; classify_protection "$2" "$3" "$4"' _ "$SBP" "$appr" "$adm" "$chk"); rc=$?
  gotv="ok"; case "$out" in drift:*) gotv="drift";; esac
  if [ "$gotv" = "$wantv" ] && [ "$rc" = "$wantrc" ]; then
    echo "PASS: $desc"; PASS=$((PASS+1))
  else
    echo "FAIL: $desc — want $wantv/$wantrc, got $gotv/$rc ($out)"; FAIL=$((FAIL+1))
  fi
}

# 표준 부합: 승인0 · enforce_admins=True · checks>0
chk_case "표준(0·True·3) → ok"            0    True  3    ok    0
chk_case "승인 None(=0)도 표준 → ok"       None True  2    ok    0
# B1 회귀 방지: checks 빈목록(0)/null(-1) = 약한 보호 → drift(성공 은폐 금지)
chk_case "B1: checks=0(빈목록) → drift"    0    True  0    drift 1
chk_case "B1: checks=-1(null) → drift"     0    True  -1   drift 1
# enforce_admins off → drift(관리자 CI red 머지 구멍)
chk_case "enforce_admins False → drift"    0    False 3    drift 1
# 승인요건 1(팀 모드) → 솔로 표준 기준 drift
chk_case "승인요건 1 → drift"              1    True  3    drift 1
# python 파싱 실패('?') → fail-closed(drift)
chk_case "appr='?'(파싱실패) → drift"      "?"  True  3    drift 1
chk_case "chk='?'(파싱실패) → drift"       0    True  "?"  drift 1
# 복합 드리프트(승인1 + admins off + checks0) → drift
chk_case "복합(1·False·0) → drift"         1    False 0    drift 1

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

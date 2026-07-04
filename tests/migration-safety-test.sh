#!/bin/bash
# tests/migration-safety-test.sh — check-migration-safety.mjs 시나리오 테스트
# 로컬·CI 동일 실행: bash tests/migration-safety-test.sh
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/scripts/check-migration-safety.mjs"
FIX="$ROOT/tests/fixtures/migration-safety"
PASS=0; FAIL=0

check() { # desc, expected_exit, target_path
  local desc="$1" want="$2" target="$3"
  node "$GATE" "$target" >/dev/null 2>&1; local rc=$?
  if [ "$rc" = "$want" ]; then
    echo "PASS: $desc"; PASS=$((PASS+1))
  else
    echo "FAIL: $desc — expected exit $want, got $rc"; FAIL=$((FAIL+1))
  fi
}

# 검사 A: 대역인데 out-of-order 설정 없음 → 차단
check "대역 + out-of-order 미설정 → FAIL"   1 "$FIX/bad-missing"
# 검사 B: 대역인데 out-of-order:false 명시 → 차단
check "대역 + out-of-order:false → FAIL"     1 "$FIX/bad-false"
# S1: 비운영(test) 프로파일에만 out-of-order:true, 운영 config엔 없음 → FAIL(false-pass 방지)
check "대역 + test프로파일만 ooo:true → FAIL(S1)" 1 "$FIX/bad-nonprod-ooo"
# B2: 대역 repo에 타임스탬프 버전 1개 혼입 — Math.max 오판으로 대역검사 꺼지던 false-pass 차단
check "대역+타임스탬프 혼입 → FAIL(B2)"          1 "$FIX/bad-timestamp-mix"
# B3: 주석 처리된 out-of-order:true가 실제 false를 덮던 false-pass 차단
check "대역+주석 ooo:true → FAIL(B3)"            1 "$FIX/bad-commented-ooo"
# 대역 + out-of-order:true → 통과
check "대역 + out-of-order:true → 통과"      0 "$FIX/good"
# 단조 증가 → 통과(오탐 금지)
check "단조 증가 번호 → 통과"                0 "$FIX/monotonic"
# 타임스탬프 버전 → 비대상 통과(오탐 금지)
check "타임스탬프 버전 → 통과"               0 "$FIX/timestamp"
# 마이그레이션 없음 → skip 통과
check "마이그레이션 없음 → skip 통과"        0 "$ROOT/docs"
# --help → 통과
node "$GATE" --help >/dev/null 2>&1 && { echo "PASS: --help → 통과"; PASS=$((PASS+1)); } || { echo "FAIL: --help"; FAIL=$((FAIL+1)); }

# S2: --migrations 와 --config 는 짝 — 한쪽만 주면 무관 대상 오판 방지로 exit 2
GOOD_MIG="$FIX/good/src/main/resources/db/migration"
GOOD_CFG="$FIX/good/src/main/resources/application.yml"
flagcheck() { # desc, expected_exit, args...
  local desc="$1" want="$2"; shift 2
  node "$GATE" "$@" >/dev/null 2>&1; local rc=$?
  if [ "$rc" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — expected exit $want, got $rc"; FAIL=$((FAIL+1)); fi
}
flagcheck "--config 단독(--migrations 없음) → exit 2(S2)"   2 --config "$GOOD_CFG"
flagcheck "--migrations 단독(--config 없음) → exit 2(S2)"   2 --migrations "$GOOD_MIG"
flagcheck "--migrations + --config 정밀모드 → 통과(S2)"     0 --migrations "$GOOD_MIG" --config "$GOOD_CFG"

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

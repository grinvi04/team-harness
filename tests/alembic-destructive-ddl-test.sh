#!/bin/bash
# tests/alembic-destructive-ddl-test.sh — check-alembic-destructive-ddl.mjs 시나리오 테스트
# 로컬·CI 동일 실행: bash tests/alembic-destructive-ddl-test.sh
#
# 반증 원칙(원칙 6): 게이트가 '무엇을 통과시키나'가 아니라 '무엇을 막나'를 우회 시도로 검증한다.
#   - good-downgrade-only 픽스처가 load-bearing — 정상 autogenerate 마이그레이션(파괴가 downgrade에만)이
#     통과해야 한다(오탐 0). 깨지면 게이트가 실용 불가(모든 마이그레이션 차단).
#   - bad-marker-in-string / good-*-spoof 가 load-bearing — 문자열·주석 스푸핑으로 게이트가 뚫리는지.
#     깨지면 게이트가 우회된 것이다.
#
# 대상은 SQL판(check-destructive-ddl.mjs)과 동형: upgrade() 본문의 op.drop_table·op.drop_column·
#   op.execute(raw DROP)를 차단, 승인마커 '# migration-safety: destructive-ok'로 통과.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/scripts/check-alembic-destructive-ddl.mjs"
FIX="$ROOT/tests/fixtures/alembic-destructive-ddl"
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

# ── AC-1: 승인마커 없는 upgrade() 파괴 op → 차단(exit 1) ──
check "upgrade op.drop_table 미승인 → FAIL(AC-1)"        1 "$FIX/bad-drop-table"
check "upgrade op.drop_column 미승인 → FAIL(AC-1)"       1 "$FIX/bad-drop-column"
# ── AC-3: op.execute 내 raw DROP 미승인 → 차단 ──
check "upgrade op.execute DROP 미승인 → FAIL(AC-3)"      1 "$FIX/bad-op-execute-drop"
# ── AC-5: 마커가 문자열 값 안(실제 # 주석 아님) → 크레딧 거부 → FAIL ──
check "마커 문자열-값 스푸핑 → 무시·FAIL(AC-5)"         1 "$FIX/bad-marker-in-string"
# ── AC-9: 안전 op + 미승인 파괴 op 혼재 → 파일 사면 아님 ──
check "안전+미승인파괴 혼재 → FAIL(AC-9)"               1 "$FIX/bad-mixed"

# ── AC-2: 파괴 op + 같은 문장 승인마커 → 통과 ──
check "op.drop_column + 승인마커 → 통과(AC-2)"          0 "$FIX/good-acknowledged"
# ── AC-3: op.execute DROP + 승인마커 → 통과 ──
check "op.execute DROP + 승인마커 → 통과(AC-3)"         0 "$FIX/good-op-execute-acknowledged"
# ── AC-4: 파괴가 downgrade()에만(정상 autogenerate) → 통과(핵심 회귀 가드) ──
check "downgrade-only 파괴 → 통과(AC-4)"                0 "$FIX/good-downgrade-only"
# ── AC-7: upgrade가 index/constraint만 제거(행 손실 아님) → 오탐 금지 통과 ──
check "op.drop_index/constraint만 → 통과(AC-7)"         0 "$FIX/good-drop-index"
# ── AC-6: 파괴 키워드가 주석·문자열·docstring 안에만 → 무시(우회) ──
check "# 주석 속 파괴 키워드 → 통과(AC-6)"              0 "$FIX/good-comment-spoof"
check "문자열 값 속 파괴 키워드 → 통과(AC-6)"          0 "$FIX/good-string-spoof"
check "triple-quote 속 파괴 키워드 → 통과(AC-6)"        0 "$FIX/good-docstring-spoof"
# ── AC-11: alembic 지문 없는 .py → 스캔 안 함(오탐 금지) ──
check "비-마이그레이션 .py → skip 통과(AC-11)"          0 "$FIX/good-non-migration-py"
# ── AC-8: 마이그레이션 .py 없음 → self-skip 통과 ──
check "마이그레이션 없음 → skip 통과(AC-8)"             0 "$FIX/skip-empty"

# ── AC-10: --help → 0 · 미인식 플래그 → 2 ──
node "$GATE" --help >/dev/null 2>&1 && { echo "PASS: --help → 통과(AC-10)"; PASS=$((PASS+1)); } || { echo "FAIL: --help"; FAIL=$((FAIL+1)); }
node "$GATE" --bogus >/dev/null 2>&1; [ $? = 2 ] && { echo "PASS: 미인식 플래그 → exit 2(AC-10)"; PASS=$((PASS+1)); } || { echo "FAIL: 미인식 플래그 exit 2"; FAIL=$((FAIL+1)); }

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

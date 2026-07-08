#!/bin/bash
# tests/destructive-ddl-test.sh — check-destructive-ddl.mjs 시나리오 테스트
# 로컬·CI 동일 실행: bash tests/destructive-ddl-test.sh
#
# 반증 원칙: 게이트가 '무엇을 통과시키나'가 아니라 '무엇을 막나'를 우회 시도로 검증한다.
#   주석·문자열·마커-스푸핑 픽스처(good-*-spoof / bad-marker-in-string)가 load-bearing —
#   이들이 깨지면 게이트가 뚫린 것이다.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/scripts/check-destructive-ddl.mjs"
FIX="$ROOT/tests/fixtures/destructive-ddl"
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

# ── AC-1: 승인마커 없는 파괴 문장 → 차단(exit 1) ──
check "DROP TABLE 미승인 → FAIL(AC-1)"          1 "$FIX/bad-drop-table"
check "TRUNCATE 미승인 → FAIL(AC-1)"            1 "$FIX/bad-truncate"
check "ALTER…DROP COLUMN 미승인 → FAIL(AC-1)"   1 "$FIX/bad-drop-column"
check "DROP DATABASE 미승인 → FAIL(AC-1)"       1 "$FIX/bad-drop-database"
check "DROP SCHEMA 미승인 → FAIL(AC-1)"         1 "$FIX/bad-drop-schema"
# ── AC-7: 안전 문장 + 미승인 파괴 문장 혼재 → 파일 사면 아님(문장 단위) ──
check "안전+미승인파괴 혼재 → FAIL(AC-7)"        1 "$FIX/bad-multi-statement"
# ── AC-11: 블록주석으로 다중어 키워드 분리(DROP/*x*/TABLE)는 유효 SQL → 우회 차단(exit 1) ──
#   반증: /* */ 는 SQL 토큰 구분자라 DROP/*x*/TABLE == DROP TABLE 로 실행된다.
check "블록주석 분리 DROP TABLE → FAIL(AC-11)"   1 "$FIX/bad-block-comment-split-table"
check "블록주석 분리 DROP COLUMN → FAIL(AC-11)"  1 "$FIX/bad-block-comment-split-column"
# ── AC-5: 마커가 문자열 값 안(실제 주석 아님) → 크레딧 거부 → FAIL ──
check "마커 문자열-값 스푸핑 → 무시·FAIL(AC-5)"  1 "$FIX/bad-marker-in-string"
# ── AC-8: prisma 마이그레이션 디렉터리도 스캔 → 미승인 DROP FAIL ──
check "prisma 미승인 DROP → FAIL(AC-8)"          1 "$FIX/bad-prisma"

# ── AC-2: 파괴 문장 + 같은 문장 승인 주석 → 통과 ──
check "DROP COLUMN + 승인마커 → 통과(AC-2)"      0 "$FIX/good-acknowledged"
# ── AC-6: 비 데이터-손실 DROP(INDEX) → 오탐 금지 통과 ──
check "DROP INDEX(비파괴) → 통과(AC-6)"          0 "$FIX/good-drop-index"
# ── AC-3: 주석 안의 파괴 키워드 → 무시(우회) ──
check "라인주석 속 DROP TABLE → 통과(AC-3)"      0 "$FIX/good-comment-spoof"
check "블록주석 속 DROP TABLE → 통과(AC-3)"      0 "$FIX/good-block-comment-spoof"
# ── AC-4: 문자열 리터럴 안의 파괴 키워드 → 무시(우회) ──
check "문자열 속 DROP TABLE → 통과(AC-4)"        0 "$FIX/good-string-spoof"
# 순수 안전 DDL → 통과
check "CREATE/ADD COLUMN만 → 통과"              0 "$FIX/good-create-only"
# ── AC-2+AC-8: prisma + 승인마커 → 통과 · supabase 스택 커버리지 ──
check "prisma DROP + 승인마커 → 통과(AC-2,8)"    0 "$FIX/good-prisma-acknowledged"
check "supabase TRUNCATE + 승인마커 → 통과"      0 "$FIX/good-supabase-acknowledged"

# ── AC-9: 마이그레이션 디렉터리 밖 .sql → 스캔 안 함(오탐 금지) ──
check "비-마이그레이션 .sql DROP → skip 통과(AC-9)" 0 "$FIX/skip-no-migration"
check "마이그레이션 .sql 없음 → skip 통과(AC-9)"    0 "$FIX/skip-empty"

# ── AC-10: --help → 0 · 미인식 플래그 → 2 ──
node "$GATE" --help >/dev/null 2>&1 && { echo "PASS: --help → 통과(AC-10)"; PASS=$((PASS+1)); } || { echo "FAIL: --help"; FAIL=$((FAIL+1)); }
node "$GATE" --bogus >/dev/null 2>&1; [ $? = 2 ] && { echo "PASS: 미인식 플래그 → exit 2(AC-10)"; PASS=$((PASS+1)); } || { echo "FAIL: 미인식 플래그 exit 2"; FAIL=$((FAIL+1)); }

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

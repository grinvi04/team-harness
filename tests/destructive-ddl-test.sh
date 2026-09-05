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
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

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
check "T-SQL IF 뒤 TRUNCATE → FAIL(AC-1)"       1 "$FIX/bad-truncate-if"
check "T-SQL label 뒤 TRUNCATE → FAIL(AC-1)"    1 "$FIX/bad-truncate-label"
check "MySQL 실행형 주석 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-mysql-executable-comment"
check "MySQL 버전 주석 TRUNCATE → FAIL(AC-1)"   1 "$FIX/bad-mysql-versioned-comment"
check "문자열 속 /*! 뒤 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-exec-marker-in-string"
check "-- 주석 속 /*! 뒤 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-exec-marker-in-line-comment"
check "# 주석 속 /*! 뒤 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-exec-marker-in-hash-comment"
check "블록주석 속 /*! 뒤 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-exec-marker-in-block-comment"
check "MySQL -- 연산 뒤 TRUNCATE → FAIL(AC-1)"   1 "$FIX/bad-dash-operator-tail"
check "PostgreSQL # 연산 뒤 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-hash-operator-tail"
check "MySQL escape 문자열 뒤 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-mysql-backslash-string"
check "PostgreSQL E-string 뒤 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-postgres-escape-string"
check "MySQL 긴 버전 주석 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-mysql-long-version-comment"
check "MySQL double quote escape 뒤 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-mysql-double-quote-string"
check "PostgreSQL 중첩주석 marker 뒤 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-pg-nested-marker"
check "PostgreSQL 중첩주석 quote 뒤 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-pg-nested-quote"
check "T-SQL 세미콜론 없는 GRANT 사이 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-tsql-grant-boundary"
check "PostgreSQL dollar quote 뒤 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-dollar-quote-tail"
check "dollar quote marker 스푸핑 뒤 TRUNCATE → FAIL(AC-1)" 1 "$FIX/bad-dollar-marker-tail"
check "파괴문 뒤 lexical 오류 → FAIL(AC-1)"      1 "$FIX/bad-destructive-before-invalid"
check "모든 방언 lexical 오류 → fail-closed"     1 "$FIX/bad-unparseable-sql"
check "dollar 포함 식별자 사이 TRUNCATE → FAIL" 1 "$FIX/bad-dollar-identifier-boundary"
check "T-SQL label 앞 marker 유출 → FAIL"       1 "$FIX/bad-tsql-marker-label"
check "T-SQL WHILE 앞 marker 유출 → FAIL"       1 "$FIX/bad-tsql-marker-while"
check "MySQL dollar 식별자 사이 TRUNCATE → FAIL" 1 "$FIX/bad-mysql-dollar-identifiers"
check "T-SQL ELSE 앞 marker 유출 → FAIL"        1 "$FIX/bad-tsql-marker-else"
check "깊이 13 migration의 TRUNCATE → FAIL"     1 "$FIX/bad-deep-migration"
check "ALTER…DROP COLUMN 미승인 → FAIL(AC-1)"   1 "$FIX/bad-drop-column"
check "DROP DATABASE 미승인 → FAIL(AC-1)"       1 "$FIX/bad-drop-database"
check "DROP SCHEMA 미승인 → FAIL(AC-1)"         1 "$FIX/bad-drop-schema"
# ── AC-7: 안전 문장 + 미승인 파괴 문장 혼재 → 파일 사면 아님(문장 단위) ──
check "안전+미승인파괴 혼재 → FAIL(AC-7)"        1 "$FIX/bad-multi-statement"
# ── AC-11: 블록주석으로 다중어 키워드 분리(DROP/*x*/TABLE)는 유효 SQL → 우회 차단(exit 1) ──
#   반증: /* */ 는 SQL 토큰 구분자라 DROP/*x*/TABLE == DROP TABLE 로 실행된다.
check "블록주석 분리 DROP TABLE → FAIL(AC-11)"   1 "$FIX/bad-block-comment-split-table"
check "블록주석 분리 DROP COLUMN → FAIL(AC-11)"  1 "$FIX/bad-block-comment-split-column"
# ── 이슈 #258 backport(AR 봉쇄 형제 이식) — MySQL '#' 라인주석 토큰-분리 우회 차단 ──
#   반증: MySQL '#' 은 라인주석이라 `DROP #x\nTABLE` == `DROP TABLE` 로 실행된다(FN 봉쇄).
check "'#' 라인주석 분리 DROP TABLE → FAIL(#258)" 1 "$FIX/bad-hash-comment-split-table"
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
# MySQL 실행형 주석 안에서도 문자열 리터럴은 실행 코드가 아니므로 키워드를 무시한다.
check "MySQL 실행형 주석 문자열 → 통과(AC-4)"    0 "$FIX/good-mysql-executable-string"
check "MySQL double quote 문자열 → 통과(AC-4)"  0 "$FIX/good-mysql-double-quote-string"
check "dollar quote 방언 중의성 + 승인마커 → 통과" 0 "$FIX/good-dollar-quote-string"
check "PostgreSQL 중첩주석 속 TRUNCATE → 통과(AC-3)" 0 "$FIX/good-pg-nested-comment"
check "MySQL 4자리 버전 주석 → 통과(AC-3)"       0 "$FIX/good-mysql-four-digit-comment"
# ── AC-4: 문자열 리터럴 안의 파괴 키워드 → 무시(우회) ──
check "문자열 속 DROP TABLE → 통과(AC-4)"        0 "$FIX/good-string-spoof"
# 순수 안전 DDL → 통과
check "CREATE/ADD COLUMN만 → 통과"              0 "$FIX/good-create-only"
# ── 이슈 #258 backport — TRUNCATE(x,d) 수치함수 오탐 금지(FP 가드) ──
#   반증: MySQL TRUNCATE(수,자릿수)는 절삭 함수(데이터-손실 아님). TRUNCATE TABLE(bad-truncate)은 여전히 차단.
check "TRUNCATE() 수치함수 → 통과(#258 오탐가드)" 0 "$FIX/good-truncate-func"
# PostgreSQL TRUNCATE 테이블 권한은 실행문이 아니다. GRANT/REVOKE privilege 목록의 키워드를
# 데이터 삭제로 오인하면 기존 권한 최소화 마이그레이션이 새 게이트 도입만으로 막힌다.
check "GRANT/REVOKE TRUNCATE 권한 → 통과(오탐가드)" 0 "$FIX/good-truncate-privileges"
check "GRANT/REVOKE quoted truncate 식별자 → 통과" 0 "$FIX/good-truncate-quoted-identifier"
check "여러 줄 GRANT/REVOKE TRUNCATE 권한 → 통과" 0 "$FIX/good-multiline-truncate-privileges"
# ── AC-2+AC-8: prisma + 승인마커 → 통과 · supabase 스택 커버리지 ──
check "prisma DROP + 승인마커 → 통과(AC-2,8)"    0 "$FIX/good-prisma-acknowledged"
check "supabase TRUNCATE + 승인마커 → 통과"      0 "$FIX/good-supabase-acknowledged"
check "MySQL # 승인마커 → 통과"                 0 "$FIX/good-hash-acknowledged"
check "PostgreSQL 공백 없는 -- 승인마커 → 통과" 0 "$FIX/good-tight-dash-acknowledged"
check "MySQL 실행형 주석 # 승인마커 → 통과"      0 "$FIX/good-exec-hash-acknowledged"

# ── #443: ALTER continuation·배열과 인용 식별자의 방언 경계 ──
check "T-SQL @array 변수·인용 별칭 → 통과" 0 "$FIX/good-tsql-array-variable"
check "T-SQL dollar 포함 ARRAY 식별자·인용 별칭 → 통과" 0 "$FIX/good-tsql-array-dollar-identifier"
check "T-SQL ARRAY 식별자·인용 별칭 → 통과" 0 "$FIX/good-tsql-array-alias"
check "T-SQL ARRAY 인용 별칭 내부 세미콜론 → 통과" 0 "$FIX/good-tsql-array-alias-semicolon"
check "T-SQL ARRAY 인용 별칭 내부 중첩 대괄호 → 통과" 0 "$FIX/good-tsql-array-nested-alias"
check "PostgreSQL 단일 하위 ARRAY → 통과" 0 "$FIX/good-pg-single-child-array"
check "PostgreSQL 공백·주석 분리 다차원 ARRAY → 통과" 0 "$FIX/good-pg-array-whitespace"
check "T-SQL @array 인용 별칭 뒤 TRUNCATE → FAIL" 1 "$FIX/bad-tsql-array-variable-tail"
check "T-SQL dollar ARRAY 인용 별칭 뒤 TRUNCATE → FAIL" 1 "$FIX/bad-tsql-array-dollar-tail"
check "T-SQL ARRAY 인용 별칭 뒤 TRUNCATE → FAIL" 1 "$FIX/bad-tsql-array-alias-tail"
check "T-SQL 세미콜론 포함 인용 별칭 뒤 TRUNCATE → FAIL" 1 "$FIX/bad-tsql-array-alias-semicolon-tail"
check "PostgreSQL 단일 하위 ARRAY 사이 TRUNCATE → FAIL" 1 "$FIX/bad-pg-single-child-array-between"
check "PostgreSQL 중첩 ARRAY 생성자 → 통과" 0 "$FIX/good-pg-nested-array-constructor"
check "두 ARRAY 사이 독립 TRUNCATE → FAIL" 1 "$FIX/bad-pg-array-statement-between"
check "ARRAY 문자열 승인마커 뒤 TRUNCATE → FAIL" 1 "$FIX/bad-pg-array-marker-string-tail"
check "승인된 multiline ALTER TABLE → 통과" 0 "$FIX/good-multiline-alter-ack"
check "승인된 comment 분리 DROP COLUMN → 통과" 0 "$FIX/good-multiline-alter-comment"
check "승인된 ALTER COLUMN·DROP COLUMN continuation → 통과" 0 "$FIX/good-multiline-alter-actions"
check "PostgreSQL 다차원 ARRAY → 통과" 0 "$FIX/good-pg-multidimensional-array"
check "PostgreSQL ARRAY 내부 인용 대괄호·키워드 → 통과" 0 "$FIX/good-pg-array-quoted-brackets"
check "T-SQL escaped bracket 식별자 내부 키워드 → 통과" 0 "$FIX/good-tsql-escaped-bracket"
check "미승인 multiline ALTER TABLE → FAIL" 1 "$FIX/bad-multiline-alter-no-ack"
check "승인 ALTER 다음 독립 DROP TABLE → FAIL" 1 "$FIX/bad-alter-ack-drop-tail"
check "승인 ALTER 다음 독립 ALTER TABLE → FAIL" 1 "$FIX/bad-alter-ack-alter-tail"
check "승인 ALTER 다음 IF TRUNCATE → FAIL" 1 "$FIX/bad-alter-ack-if-tail"
check "승인 ALTER 다음 label TRUNCATE → FAIL" 1 "$FIX/bad-alter-ack-label-tail"
check "승인 ALTER 다음 WHILE TRUNCATE → FAIL" 1 "$FIX/bad-alter-ack-while-tail"
check "PostgreSQL 다차원 ARRAY 뒤 TRUNCATE → FAIL" 1 "$FIX/bad-pg-array-truncate-tail"
check "T-SQL escaped bracket 식별자 뒤 TRUNCATE → FAIL" 1 "$FIX/bad-tsql-escaped-bracket-tail"

# ── AC-9: 마이그레이션 디렉터리 밖 .sql → 스캔 안 함(오탐 금지) ──
check "비-마이그레이션 .sql DROP → skip 통과(AC-9)" 0 "$FIX/skip-no-migration"
check "마이그레이션 .sql 없음 → skip 통과(AC-9)"    0 "$FIX/skip-empty"

# exact scan root 밖의 내용과 symlink alias는 repo의 추적 파일이 아니다. 외부 escape·내부 cycle·
# 같은 외부 tree의 반복 alias를 모두 따라가지 않아야 한다.
SYMLINK_ROOT="$TMP/symlink-root"
SYMLINK_OUTSIDE="$TMP/symlink-outside"
mkdir -p "$SYMLINK_ROOT/db/migration" "$SYMLINK_OUTSIDE"
printf '%s\n' 'TRUNCATE TABLE audit_log;' > "$SYMLINK_OUTSIDE/V999__external.sql"
ln -s "$SYMLINK_ROOT" "$SYMLINK_ROOT/db/migration/cycle"
for alias in 1 2 3 4 5 6 7 8; do
  ln -s "$SYMLINK_OUTSIDE" "$SYMLINK_ROOT/db/migration/external-$alias"
done
check "directory symlink cycle·외부 escape·alias fan-out → fail-closed" 1 "$SYMLINK_ROOT"

# 정책 파일명 symlink는 내부 regular target만 논리 경로로 검사한다.
LINK_ROOT="$TMP/file-link-root"
mkdir -p "$LINK_ROOT/db/migration"
printf '%s\n' 'TRUNCATE TABLE linked_audit;' > "$LINK_ROOT/payload.txt"
ln -s ../../payload.txt "$LINK_ROOT/db/migration/V998__linked.sql"
check "내부 regular file symlink의 TRUNCATE → FAIL" 1 "$LINK_ROOT"

SAFE_LINK_ROOT="$TMP/safe-file-link-root"
mkdir -p "$SAFE_LINK_ROOT/db/migration"
printf '%s\n' 'CREATE TABLE linked_safe (id bigint);' > "$SAFE_LINK_ROOT/payload.txt"
ln -s ../../payload.txt "$SAFE_LINK_ROOT/db/migration/V998__linked.sql"
if OUT=$(node "$GATE" "$SAFE_LINK_ROOT" 2>&1) && echo "$OUT" | grep -q "마이그레이션 SQL 1개"; then
  echo "PASS: 내부 regular file symlink를 실제 migration으로 검사"; PASS=$((PASS+1))
else
  echo "FAIL: 내부 regular file symlink 검사 누락"; FAIL=$((FAIL+1))
fi

EXTERNAL_LINK_ROOT="$TMP/external-file-link-root"
mkdir -p "$EXTERNAL_LINK_ROOT/db/migration"
printf '%s\n' 'CREATE TABLE external_safe (id bigint);' > "$TMP/external-safe.sql"
ln -s "$TMP/external-safe.sql" "$EXTERNAL_LINK_ROOT/db/migration/V997__external.sql"
check "외부 regular file symlink → fail-closed" 1 "$EXTERNAL_LINK_ROOT"

DANGLING_LINK_ROOT="$TMP/dangling-file-link-root"
mkdir -p "$DANGLING_LINK_ROOT/db/migration"
ln -s "$TMP/missing.sql" "$DANGLING_LINK_ROOT/db/migration/V996__dangling.sql"
check "dangling migration file symlink → fail-closed" 1 "$DANGLING_LINK_ROOT"

NONREGULAR_LINK_ROOT="$TMP/nonregular-file-link-root"
mkdir -p "$NONREGULAR_LINK_ROOT/db/migration"
mkfifo "$NONREGULAR_LINK_ROOT/payload.pipe"
ln -s ../../payload.pipe "$NONREGULAR_LINK_ROOT/db/migration/V995__pipe.sql"
check "비정규 migration file symlink → fail-closed" 1 "$NONREGULAR_LINK_ROOT"

# ── AC-10: --help → 0 · 미인식 플래그 → 2 ──
node "$GATE" --help >/dev/null 2>&1 && { echo "PASS: --help → 통과(AC-10)"; PASS=$((PASS+1)); } || { echo "FAIL: --help"; FAIL=$((FAIL+1)); }
node "$GATE" --bogus >/dev/null 2>&1; [ $? = 2 ] && { echo "PASS: 미인식 플래그 → exit 2(AC-10)"; PASS=$((PASS+1)); } || { echo "FAIL: 미인식 플래그 exit 2"; FAIL=$((FAIL+1)); }

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

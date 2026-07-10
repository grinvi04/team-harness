#!/bin/bash
# tests/activerecord-destructive-ddl-test.sh — check-activerecord-destructive-ddl.mjs 시나리오 테스트
# 로컬·CI 동일 실행: bash tests/activerecord-destructive-ddl-test.sh
#
# 반증 원칙(원칙 6): 게이트가 '무엇을 통과시키나'가 아니라 '무엇을 막나'를 우회 시도로 검증한다.
#   - good-down-only 픽스처가 load-bearing — 역방향(def down) 파괴 op는 롤백이라 통과해야 한다(오탐 0).
#     깨지면 게이트가 실용 불가(정상 up/down 마이그레이션 전부 차단).
#   - bad-marker-in-string / good-*-spoof 가 load-bearing — 문자열·주석·=begin 스푸핑으로 뚫리는지.
#     깨지면 게이트가 우회된 것이다.
#
# 대상(Alembic 게이트와 동형): def change/def up 본문의 drop_table·drop_join_table·remove_column(s)·
#   execute(raw DROP/TRUNCATE, heredoc 포함)를 차단, 승인마커 '# migration-safety: destructive-ok'로 통과.
#   def down(역방향=롤백)은 비대상.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/scripts/check-activerecord-destructive-ddl.mjs"
FIX="$ROOT/tests/fixtures/activerecord-destructive-ddl"
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

# ── AC-1: 승인마커 없는 def change/up 파괴 op → 차단(exit 1) ──
check "drop_table 미승인 → FAIL(AC-1)"                 1 "$FIX/bad-drop-table"
check "remove_column 미승인 → FAIL(AC-1)"              1 "$FIX/bad-remove-column"
check "drop_join_table(파렌) 미승인 → FAIL(AC-1)"      1 "$FIX/bad-drop-join-table"
# ── AC-3: execute 내 raw DROP/TRUNCATE(문자열·heredoc) 미승인 → 차단 ──
check "execute heredoc DROP 미승인 → FAIL(AC-3)"       1 "$FIX/bad-execute-heredoc-drop"
check "execute 문자열 DROP 미승인 → FAIL(AC-3)"        1 "$FIX/bad-execute-string-drop"
check "execute(파렌없음) heredoc TRUNCATE → FAIL(AC-3)" 1 "$FIX/bad-execute-heredoc-truncate"
# ── AC-5: 마커가 문자열 값 안(실제 # 주석 아님) → 크레딧 거부 → FAIL ──
check "마커 문자열-값 스푸핑 → 무시·FAIL(AC-5)"        1 "$FIX/bad-marker-in-string"
# ── AC-9: 안전 op + 미승인 파괴 op 혼재 → 파일 사면 아님 ──
check "안전+미승인파괴 혼재 → FAIL(AC-9)"              1 "$FIX/bad-mixed"
# ── 회귀: SQL 블록주석 토큰-분리 DROP/*x*/TABLE (Alembic B2 동형) → FAIL ──
check "execute 블록주석 분리 DROP → FAIL(B2)"          1 "$FIX/bad-execute-block-comment"
# ── 회귀: 수신자 무관(별칭) connection.drop_table → FAIL ──
check "별칭 connection.drop_table → FAIL(수신자무관)"  1 "$FIX/bad-alias-drop"
# ── 회귀: 세미콜론 결합 — 트레일링 마커가 앞 문장 사면하면 안 됨 → FAIL ──
check "세미콜론 결합 마커 오귀속 → FAIL(B5)"           1 "$FIX/bad-semicolon-marker"
# ── 적대적 재검증 발견(박제) — 아래는 초기 게이트가 뚫렸던 우회, 봉쇄 확인 ──
# R1: =begin 블록 속 마커는 크레딧 거부(문자열/=begin 스푸핑) → FAIL(AC-5)
check "=begin 속 마커 스푸핑 → FAIL(AC-5/R1)"          1 "$FIX/bad-begin-end-marker"
# R2: heredoc raw SQL 속 MySQL '#' 라인주석 토큰-분리 DROP → FAIL
check "heredoc '#' 주석 분리 DROP → FAIL(R2)"          1 "$FIX/bad-execute-heredoc-hash"
# R3: exec_query 저수준 raw SQL DROP(execute 계열) → FAIL
check "exec_query raw DROP → FAIL(R3)"                 1 "$FIX/bad-exec-query"
# R4: def change 내 if-블록 속 drop(스코프 depth 추적) → FAIL
check "if-블록 속 drop → FAIL(R4)"                     1 "$FIX/bad-drop-in-if"
# ── 적대적 재검증 2차(opus verifier) 발견 — realistic 우회·오탐 봉쇄 ──
# R5: 레거시 def self.up 만 있는 파일 스캔(지문·스코프 self. 흡수) → FAIL
check "def self.up 레거시 → FAIL(R5)"                  1 "$FIX/bad-self-up"
check "def self.up + def change 혼재 → FAIL(R5)"       1 "$FIX/bad-self-up-mixed"
# R6: Ruby #{} 인터폴레이션이 같은 줄 뒤 DROP을 가리지 않음 → FAIL
check "#{} 인터폴레이션+같은줄 DROP → FAIL(R6)"        1 "$FIX/bad-interpolation-drop"
# R7: 무공백 << append가 뒤 drop_table을 삼키지 않음 → FAIL
check "무공백 << 뒤 drop → FAIL(R7)"                   1 "$FIX/bad-shift-then-drop"
# R8: TRUNCATE TABLE는 여전히 차단 → FAIL
check "TRUNCATE TABLE → FAIL(R8)"                      1 "$FIX/bad-truncate-table"
# R9(good): TRUNCATE(x,d) 수치함수 오탐 금지 → 통과
check "TRUNCATE() 수치함수 → 통과(R9 오탐가드)"        0 "$FIX/good-truncate-func"
# R10(good): self.down 만의 파괴(롤백) → 통과
check "def self.down-only 파괴 → 통과(R10/AC-4)"       0 "$FIX/good-self-down-only"

# ── AC-2: 파괴 op + 같은 줄(트레일링) 승인마커 → 통과 ──
check "drop_table + 트레일링 마커 → 통과(AC-2)"        0 "$FIX/good-acknowledged"
# ── AC-2: 바로 앞 줄 승인마커 → 통과 ──
check "바로 앞 줄 마커 → 통과(AC-2)"                   0 "$FIX/good-preceding-marker"
# ── AC-3: execute heredoc DROP + 앞줄 마커 → 통과 ──
check "execute heredoc DROP + 마커 → 통과(AC-3)"       0 "$FIX/good-execute-heredoc-acknowledged"
# ── AC-4: 파괴가 def down에만(역방향=롤백) → 통과(핵심 회귀 가드) ──
check "down-only 파괴 → 통과(AC-4)"                    0 "$FIX/good-down-only"
check "down의 execute heredoc DROP → 통과(AC-4)"       0 "$FIX/good-down-execute-heredoc"
# ── AC-7: index/foreign_key 제거만(행 손실 아님) → 오탐 금지 통과 ──
check "remove_index/foreign_key만 → 통과(AC-7)"        0 "$FIX/good-remove-index"
# ── AC-6: 파괴 키워드가 주석·문자열·=begin 안에만 → 무시(우회) ──
check "# 주석 속 파괴 키워드 → 통과(AC-6)"             0 "$FIX/good-comment-spoof"
check "문자열 값 속 파괴 키워드 → 통과(AC-6)"          0 "$FIX/good-string-spoof"
check "=begin/=end 블록 속 파괴 키워드 → 통과(AC-6)"   0 "$FIX/good-begin-end-spoof"
# ── heredoc 인식: execute 아닌 heredoc 본문의 DROP은 무시 ──
check "비-execute heredoc 본문 DROP → 통과(AC-6)"      0 "$FIX/good-heredoc-nonexec-keyword"
# ── FP 가드: execute heredoc 비-DDL(UPDATE) → 통과 ──
check "execute heredoc 비-DDL → 통과(FP가드)"          0 "$FIX/good-heredoc-non-ddl"
# ── AC-11: ActiveRecord 지문 없는 .rb → 스캔 안 함(오탐 금지) ──
check "비-마이그레이션 .rb → skip 통과(AC-11)"         0 "$FIX/good-non-migration"
# ── AC-8: 마이그레이션 .rb 없음 → self-skip 통과 ──
check "마이그레이션 없음 → skip 통과(AC-8)"            0 "$FIX/skip-empty"

# ── AC-10: --help → 0 · 미인식 플래그 → 2 ──
node "$GATE" --help >/dev/null 2>&1 && { echo "PASS: --help → 통과(AC-10)"; PASS=$((PASS+1)); } || { echo "FAIL: --help"; FAIL=$((FAIL+1)); }
node "$GATE" --bogus >/dev/null 2>&1; [ $? = 2 ] && { echo "PASS: 미인식 플래그 → exit 2(AC-10)"; PASS=$((PASS+1)); } || { echo "FAIL: 미인식 플래그 exit 2"; FAIL=$((FAIL+1)); }

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

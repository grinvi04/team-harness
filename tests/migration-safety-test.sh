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
# S1b(#182): 단일 application.yml 다중 프로파일 문서 — 비운영(test) 문서의 ooo:true가 운영(prod) false를 덮던 false-pass 차단
check "대역 + 단일yml 다중프로파일(test true/prod false) → FAIL(S1b)" 1 "$FIX/bad-multidoc-profile"
# #197: 부정 프로파일(!prod)의 ooo:true는 운영 미적용 → 운영 문서 ooo 부재 → FAIL(false-pass 차단)
check "대역 + !prod 프로파일 ooo:true(운영 미적용) → FAIL(#197)" 1 "$FIX/bad-neg-prod-profile"
# #197: 리스트 프로파일(test | prod)은 운영 적용 → ooo:true 크레딧 유효 → PASS(false-FAIL 방지)
check "대역 + 'test|prod' 프로파일 ooo:true → 통과(#197)" 0 "$FIX/good-list-profile"
# #205: 부정 비운영 프로파일(!test = 운영 포함)의 ooo:true → 운영 적용 → PASS(false-FAIL 회귀 방지)
check "대역 + '!test' 프로파일 ooo:true(운영 적용) → 통과(#205)" 0 "$FIX/good-neg-nonprod-profile"
# #214: 미등록 비운영 프로파일(staging)의 ooo:true는 운영 미적용 → 운영 ooo:false → FAIL(safe-default, 토큰리스트 무관)
check "대역 + 'staging' 프로파일 ooo:true(운영 미적용) → FAIL(#214)" 1 "$FIX/bad-staging-profile"
# #214-compound: 복합식 'staging & !test'(양의 비운영 항 존재)도 운영 미적용 → FAIL(부정 규칙이 &/| 구조 무시하던 false-pass 교정)
check "대역 + 'staging & !test' 복합 ooo:true → FAIL(#214-compound)" 1 "$FIX/bad-compound-profile"
# #223-paren: 괄호 부정 '!(prod | staging)'은 안전 파싱 불가 → safe-default 미적용 → FAIL(bare prod 토큰이 부정 안에서 오단락하던 false-pass 교정. 완전해법=#220-A 파서)
check "대역 + '!(prod | staging)' 괄호부정 ooo:true → FAIL(#223-paren)" 1 "$FIX/bad-paren-neg-profile"
# #227: 별도 비운영 프로파일 파일(application-staging.yml)의 ooo:true는 운영 미적용 → FAIL(파일명 필터 safe-default화, 토큰리스트 무관)
check "대역 + 별도 application-staging.yml ooo:true → FAIL(#227)" 1 "$FIX/bad-staging-file"
# B2: 대역 repo에 타임스탬프 버전 1개 혼입 — Math.max 오판으로 대역검사 꺼지던 false-pass 차단
check "대역+타임스탬프 혼입 → FAIL(B2)"          1 "$FIX/bad-timestamp-mix"
# #3: 8자리이나 유효 날짜 아님(V10000001 월00) — 자릿수만 보고 타임스탬프로 오판해 대역검사 꺼지던 false-pass 차단
check "8자리 비-날짜 대역(10000001) → FAIL(#3)"  1 "$FIX/bad-8digit-band"
# #1: 멀티모듈 격리 — svcA(대역·ooo없음)가 무관 svcB(ooo:true)의 크레딧을 받아 통과하던 greedy false-pass 차단
check "멀티모듈 svcA대역+svcB무관ooo:true → FAIL(#1)" 1 "$FIX/bad-multimodule-isolation"
# #2-a(AC-5): 촘촘밴드(갭<100, 휴리스틱 미감지)를 scheme=prefix-band 선언으로 강제 밴드검사 → ooo없음 → FAIL
check "scheme=prefix-band 선언 촘촘밴드 → FAIL(#2)"  1 "$FIX/bad-dense-band-declared"
# #2-b(AC-6): 휴리스틱상 대역이나 scheme=monotonic 선언 → 강제 통과(false-FAIL escape hatch)
check "scheme=monotonic 선언 → 통과(#2)"            0 "$FIX/good-monotonic-declared"
# #2-c(AC-6): scheme=timestamp 선언 → 타임스탬프 취급 통과
check "scheme=timestamp 선언 → 통과(#2)"            0 "$FIX/good-timestamp-declared"
# #2-d(AC-8): 미인식 scheme 값 → 무시(휴리스틱 폴백)·크래시 없음 → 단조라 통과
check "scheme=bogus(미인식) → 무시·통과(AC-8)"      0 "$FIX/good-scheme-invalid"
# 리뷰 D1a: scheme 선언이 비운영 파일(application-test.yml)에만 — ooo:true와 동일 스코프로 무시 → 대역 FAIL(스푸핑 차단)
check "scheme=monotonic 비운영파일 → 무시·대역 FAIL(D1)" 1 "$FIX/bad-scheme-nonprod-file"
# 리뷰 D1b: scheme이 주석 아닌 값 문자열에 — 무시(주석만 인정) → 대역 FAIL(값 스푸핑 차단)
check "scheme 값문자열 스푸핑 → 무시·대역 FAIL(D1)"  1 "$FIX/bad-scheme-value-spoof"
# 리뷰 D2: 날짜형 8자리 대역(휴리스틱상 타임스탬프)도 scheme=prefix-band 선언으로 강제 밴드 → FAIL(escape hatch)
check "날짜형8자리+scheme=prefix-band → FAIL(D2)"    1 "$FIX/bad-dateshaped-8digit-declared"
# 리뷰 F3: 모듈 자체 config(ooo없음)가 조상 config(ooo:true)보다 우선(nearest 권위) → FAIL
check "nearest-config 권위(모듈 ooo없음) → FAIL(F3)" 1 "$FIX/bad-nearest-config-authoritative"
# 리뷰 F4: config가 조상 아님 → 미연결 그룹 skip+경고(오탐 금지) → 통과
check "비-조상 config → skip 통과(F4)"              0 "$FIX/good-nonancestor-skip"
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

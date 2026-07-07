#!/bin/bash
# tests/pr-merge-auto-test.sh — pr-merge.sh 순수 판정 함수 단위 검증(gh 무관).
#  ① --auto base 정책(require_develop_base)  ② 게이트 본체(classify_ci_gate·gate_threads·gate_mergeable).
# PRMERGE_SOURCE_ONLY로 함수만 로드해 값 주입 검증한다(gh 호출 없이 판정 로직만).
# 로컬·CI 동일: bash tests/pr-merge-auto-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/plugins/harness-guard/scripts/pr-merge.sh"
PASS=0; FAIL=0

check() { # desc, base, want_rc
  local desc="$1" base="$2" want="$3" rc
  rc=$(PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; if require_develop_base "$2" >/dev/null 2>&1; then echo 0; else echo $?; fi' _ "$GATE" "$base")
  if [ "$rc" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — expected $want, got $rc"; FAIL=$((FAIL+1)); fi
}

# AC-2/AC-3: --auto는 develop 전용 — develop만 통과, 그 외 거부(exit 3)
check "base=develop → 통과(0)"     develop     0
check "base=main → 거부(3)"        main        3
check "base=release/v1 → 거부(3)"  release/v1  3

# ── D1: 게이트 본체 순수 판정 함수 (gh 호출과 분리한 seam) ──
# classify_ci_gate: (rc, out) → 판정 문자열(green/none/fallback/fail)
ci() { # desc, rc, out, want
  local desc="$1" rc="$2" out="$3" want="$4" got
  got=$(PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; classify_ci_gate "$2" "$3"' _ "$GATE" "$rc" "$out")
  if [ "$got" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — expected $want, got $got"; FAIL=$((FAIL+1)); fi
}
# gate_threads / gate_mergeable: 인자 → rc(0 통과 / 1 중단)
grc() { # desc, fn, arg, want_rc
  local desc="$1" fn="$2" arg="$3" want="$4" rc
  rc=$(PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; if "$2" "$3" >/dev/null 2>&1; then echo 0; else echo 1; fi' _ "$GATE" "$fn" "$arg")
  if [ "$rc" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — expected $want, got $rc"; FAIL=$((FAIL+1)); fi
}

# CI 판정: rc0=green, 'no checks'/'no required'=none, 접근불가=fallback, 그 외=fail(중단)
ci "CI rc=0 → green"                        0 "any output"                             green
ci "CI 'no checks' → none(통과)"            1 "no checks reported on the 'abc' commit"  none
ci "CI 'no required' → none(통과)"          1 "no required checks"                      none
ci "CI 'Resource not accessible' → fallback" 1 "Resource not accessible by integration" fallback
ci "CI 'GraphQL' 403 → fallback"            1 "GraphQL: Resource not accessible"        fallback
ci "CI 실패 출력 → fail(중단)"              1 "1 failing, 2 successful, 0 skipped"      fail
# #199: 실패 체크의 '이름'에 GraphQL 등 에러토큰이 들어간 표 행 → fallback 오판 아니라 fail(상태컬럼 우선)
ci "CI 실패 체크명 GraphQL(표 행) → fail"    1 "$(printf 'GraphQL schema check\tfail\t20s\thttp://x')" fail
ci "CI pending 체크(표 행) → fail(미통과)"   1 "$(printf 'quality\tpending\t\thttp://x')"              fail
# 실제 API 에러(표 행 아님)는 여전히 fallback
ci "CI GraphQL 에러문(표 아님) → fallback"   1 "GraphQL: Resource not accessible by integration"      fallback

# 미해결 스레드: "0"만 통과, 나머지(ERR·1+·빈값) fail-CLOSED
grc "threads=0 → 통과"          gate_threads   0            0
grc "threads=1 → 중단"          gate_threads   1            1
grc "threads=ERR → 중단(fail-closed)" gate_threads ERR      1
grc "threads='' → 중단(fail-closed)"  gate_threads ""       1
# mergeable: "MERGEABLE"만 통과
grc "mergeable=MERGEABLE → 통과"   gate_mergeable MERGEABLE   0
grc "mergeable=CONFLICTING → 중단" gate_mergeable CONFLICTING 1
grc "mergeable=UNKNOWN → 중단"     gate_mergeable UNKNOWN     1

# --auto 안전 계약: required check 없음(none)은 --auto에서만 거부(수동은 허용). green/fail 등은 정상 처리.
ac() { # desc, verdict, auto, want_rc
  local desc="$1" v="$2" a="$3" want="$4" rc
  rc=$(PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; if auto_ci_ok "$2" "$3"; then echo 0; else echo 1; fi' _ "$GATE" "$v" "$a")
  if [ "$rc" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want $want got $rc"; FAIL=$((FAIL+1)); fi
}
ac "none + --auto → 거부(fail-closed)"   none  1  1
ac "none + 수동(auto=0) → 허용"          none  0  0
ac "green + --auto → 허용"               green 1  0
ac "fail + --auto → 허용(정상 fail 경로)" fail  1  0
ac "fallback + --auto → 허용"            fallback 1 0

# 머지 후 로컬 정리 checkout 결정: 현재가 삭제될 head면 base로 이동(빈 base=develop), 아니면 이동 불필요("")
mcc() { # desc, head, base, current, want
  local desc="$1" head="$2" base="$3" cur="$4" want="$5" got
  got=$(PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; merge_cleanup_checkout "$2" "$3" "$4"' _ "$GATE" "$head" "$base" "$cur")
  if [ "$got" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want '$want' got '$got'"; FAIL=$((FAIL+1)); fi
}
mcc "현재=head → base로 이동"       feature/x  develop feature/x  develop
mcc "현재=head, base=main → main"   release/v1 main    release/v1 main
mcc "현재≠head → 이동 불필요('')"   feature/x  develop develop    ""
mcc "빈 base → develop 폴백"        feature/x  ""      feature/x  develop

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

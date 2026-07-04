#!/bin/bash
# tests/pr-merge-auto-test.sh — pr-merge.sh --auto의 base 정책(require_develop_base) 단위 검증.
# require_develop_base만 source해 검증한다(gh 무관 — PRMERGE_SOURCE_ONLY로 함수만 로드).
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

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

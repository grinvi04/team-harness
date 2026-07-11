#!/bin/bash
# tests/new-repo-test.sh — new-repo.sh B4 게이트(prot_exit_ok) 단위 검증.
# 감사 B4(fail-open) 회귀 방지: 보호 적용 실패를 종료코드에 반영하는지(삼키지 않는지) 검증.
# NEWREPO_SOURCE_ONLY로 함수만 로드(git/gh/파일복사 없이). 로컬·CI 동일: bash tests/new-repo-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NR="$ROOT/scripts/new-repo.sh"
PASS=0; FAIL=0

exit_case() { # desc, prot_failed, want_rc
  local desc="$1" pf="$2" want="$3" rc
  rc=$(NEWREPO_SOURCE_ONLY=1 bash -c 'source "$1"; if prot_exit_ok "$2"; then echo 0; else echo 1; fi' _ "$NR" "$pf")
  if [ "$rc" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want $want got $rc"; FAIL=$((FAIL+1)); fi
}

# B4: 실패 플래그 0/미설정 → exit 0(성공), 1 → exit 1(실패를 삼키지 않고 반영)
exit_case "PROT_FAILED=0 → 성공(0)"        0   0
exit_case "PROT_FAILED=1 → 실패반영(1)"    1   1
exit_case "PROT_FAILED='' → 기본0·성공(0)" ""  0

if grep -Fq '.claude/rules/*.md' "$ROOT/templates/AGENTS.md"; then
  echo "PASS: AGENTS template → Codex stack-rule pointer"; PASS=$((PASS+1))
else
  echo "FAIL: AGENTS template → Codex stack-rule pointer 누락"; FAIL=$((FAIL+1))
fi

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

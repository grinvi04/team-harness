#!/bin/bash
# tests/repo-sync-test.sh — check-repo-sync.mjs 시나리오 테스트
# 로컬·CI 동일 실행: bash tests/repo-sync-test.sh
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/scripts/check-repo-sync.mjs"
FIX="$ROOT/tests/fixtures/repo-sync"
PASS=0; FAIL=0

check() { # desc, expected_exit, repo_path
  local desc="$1" want="$2" repo="$3"
  node "$GATE" --repo "$repo" --harness "$ROOT" >/dev/null 2>&1; local rc=$?
  if [ "$rc" = "$want" ]; then
    echo "PASS: $desc"; PASS=$((PASS+1))
  else
    echo "FAIL: $desc — expected exit $want, got $rc"; FAIL=$((FAIL+1))
  fi
}

# 자산 완비(java+flyway) → sync 통과
check "good(자산 완비) → 통과"              0 "$FIX/good"
# test-guard 게이트 누락 → 드리프트 차단
check "bad(test-guard 누락) → MISSING/FAIL"  1 "$FIX/bad-missing-testguard"

# E1: alembic 대칭 — alembic 감지 시 alembic-heads 게이트를 required로 기대(프로비저너 대칭 제공).
check "E1: alembic 완비(heads 有) → 통과"     0 "$FIX/alembic-nextjs-vue"
check "E1: alembic-heads 누락 → MISSING/FAIL" 1 "$FIX/alembic-missing-heads"

# E2: nextjs·vue 감지 + 룰 점검(검증기 ruleMap 대칭) — 감지 스택·룰 자산이 출력에 나타나야 한다.
OUT=$(node "$GATE" --repo "$FIX/alembic-nextjs-vue" --harness "$ROOT" 2>&1)
if echo "$OUT" | grep -q "nextjs, vue, alembic\|nextjs" && echo "$OUT" | grep -q "룰: nextjs.md" && echo "$OUT" | grep -q "룰: vue.md"; then
  echo "PASS: E2 nextjs·vue 감지+룰 점검"; PASS=$((PASS+1))
else
  echo "FAIL: E2 nextjs·vue 감지+룰 점검"; FAIL=$((FAIL+1))
fi
# --help → 통과
node "$GATE" --help >/dev/null 2>&1 && { echo "PASS: --help → 통과"; PASS=$((PASS+1)); } || { echo "FAIL: --help"; FAIL=$((FAIL+1)); }

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

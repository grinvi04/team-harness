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
# Codex rule pointer 누락 — rule 파일이 있어도 AGENTS가 읽으라고 하지 않으면 의미 전달 실패.
check "bad(Codex stack-rule pointer 누락) → MISSING/FAIL" 1 "$FIX/bad-codex-rule-pointer"
OUT=$(node "$GATE" --repo "$FIX/bad-codex-rule-pointer" --harness "$ROOT" 2>&1)
if echo "$OUT" | grep -q "Codex stack-rule pointer" && echo "$OUT" | grep -q "MISSING"; then
  echo "PASS: Codex stack-rule pointer 누락 원인 보고"; PASS=$((PASS+1))
else
  echo "FAIL: Codex stack-rule pointer 누락 원인 미보고"; FAIL=$((FAIL+1))
fi
# test-guard 게이트 누락 → 드리프트 차단
check "bad(test-guard 누락) → MISSING/FAIL"  1 "$FIX/bad-missing-testguard"
# #183: sentinel(gitleaks)이 주석에만 있는 비활성 게이트는 존재로 오인 안 됨 → MISSING/FAIL
check "bad(sentinel 주석에만) → MISSING/FAIL" 1 "$FIX/bad-sentinel-comment"
# #205: sentinel이 echo 문자열 안 '#12' 뒤에 있는 정당 게이트 — 트레일링 # 오제거로 false MISSING 나면 안 됨
check "good(sentinel이 인라인 # 뒤 문자열) → 통과" 0 "$FIX/good-sentinel-inline-hash"
# #A(자기회귀): 제거된 게이트의 sentinel이 트레일링 주석에만 남으면 존재로 오인 금지 → MISSING/FAIL
check "bad(sentinel이 트레일링 주석에만) → MISSING/FAIL" 1 "$FIX/bad-sentinel-trailing-comment"
# #C: ci-gate를 './gradlew check'(test 포함) 내용신호로 인식 → 통과(과탐 없음)
check "good(gradlew check ci-gate) → 통과" 0 "$FIX/good-gradlew-check"

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
# E3: rails 감지 — Gemfile → rails 스택, ruby.md 룰 + activerecord 파괴 DDL 게이트(3번째 스텝) 대칭.
check "E3: rails 완비(ruby.md+AR게이트) → 통과"  0 "$FIX/rails-good"
OUT=$(node "$GATE" --repo "$FIX/rails-good" --harness "$ROOT" 2>&1)
if echo "$OUT" | grep -q "감지된 스택: rails" \
   && echo "$OUT" | grep -q "룰: ruby.md" \
   && echo "$OUT" | grep -q "activerecord destructive-ddl 스텝"; then
  echo "PASS: E3 rails 감지+ruby.md+AR게이트 점검"; PASS=$((PASS+1))
else
  echo "FAIL: E3 rails 감지+ruby.md+AR게이트 점검"; FAIL=$((FAIL+1))
fi

# Self-repo: 신규 repo templates와 test fixtures는 team-harness 자신의 런타임 스택이 아니다.
if OUT=$(node "$GATE" --repo "$ROOT" --harness "$ROOT" 2>&1) &&
   echo "$OUT" | grep -q "감지된 스택: (없음)" &&
   ! echo "$OUT" | grep -qE "룰:|✗ MISSING"; then
  echo "PASS: self-repo 스택 오탐·필수 자산 드리프트 없음"; PASS=$((PASS+1))
else
  echo "FAIL: self-repo 스택 오탐 또는 필수 자산 드리프트"; FAIL=$((FAIL+1))
fi

# --help → 통과
node "$GATE" --help >/dev/null 2>&1 && { echo "PASS: --help → 통과"; PASS=$((PASS+1)); } || { echo "FAIL: --help"; FAIL=$((FAIL+1)); }

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

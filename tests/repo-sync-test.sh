#!/bin/bash
# tests/repo-sync-test.sh — check-repo-sync.mjs 시나리오 테스트
# 로컬·CI 동일 실행: bash tests/repo-sync-test.sh
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/scripts/check-repo-sync.mjs"
FIX="$ROOT/tests/fixtures/repo-sync"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

prepare_good() {
  local name="$1"
  local dest="$TMP/good-$name"
  cp -R "$FIX/$name/." "$dest"
  mkdir -p "$dest/scripts"
  cp "$ROOT/scripts/check-commit-message.cjs" "$dest/scripts/check-commit-message.cjs"
  cp "$ROOT/templates/commitlint.config.cjs" "$dest/commitlint.config.cjs"
  cp "$ROOT/templates/githooks/commit-msg" "$dest/.githooks/commit-msg"
  chmod +x "$dest/.githooks/commit-msg"
  printf '%s\n' "$dest"
}

GOOD=$(prepare_good good)
GOOD_SENTINEL=$(prepare_good good-sentinel-inline-hash)
GOOD_GRADLE=$(prepare_good good-gradlew-check)
GOOD_ALEMBIC=$(prepare_good alembic-nextjs-vue)
GOOD_RAILS=$(prepare_good rails-good)

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
check "good(자산 완비) → 통과"              0 "$GOOD"
cp -R "$GOOD/." "$TMP/missing-commitlint-config-path"
printf '%s\n' \
  'name: commitlint' \
  'jobs:' \
  '  commitlint:' \
  '    runs-on: ubuntu-latest' \
  '    steps:' \
  '      - uses: wagoid/commitlint-github-action@v6' \
  > "$TMP/missing-commitlint-config-path/.github/workflows/commitlint.yml"
check "bad(commitlint action이 .cjs 정본을 지정하지 않음) → MISSING/FAIL" 1 "$TMP/missing-commitlint-config-path"
cp -R "$GOOD/." "$TMP/missing-commitlint-action"
printf '%s\n' \
  'name: commitlint' \
  'jobs:' \
  '  commitlint:' \
  '    runs-on: ubuntu-latest' \
  '    steps:' \
  '      - run: echo no-lint' \
  > "$TMP/missing-commitlint-action/.github/workflows/commitlint.yml"
check "bad(commitlint 파일만 있고 action 없음) → MISSING/FAIL" 1 "$TMP/missing-commitlint-action"
mkdir -p "$TMP/no-harness-source"
if node "$GATE" --repo "$GOOD" --harness "$TMP/no-harness-source" >/dev/null 2>&1; then
  echo "PASS: 설치 plugin의 내장 커밋 계약 digest로 통과"; PASS=$((PASS+1))
else
  echo "FAIL: 설치 plugin의 내장 커밋 계약 digest 불일치"; FAIL=$((FAIL+1))
fi
cp -R "$GOOD/." "$TMP/missing-commit-msg"
rm "$TMP/missing-commit-msg/.githooks/commit-msg"
check "bad(commit-msg 훅 누락) → MISSING/FAIL" 1 "$TMP/missing-commit-msg"
cp -R "$GOOD/." "$TMP/empty-commit-msg"
printf '#!/usr/bin/env bash\nexit 0\n' > "$TMP/empty-commit-msg/.githooks/commit-msg"
check "bad(commit-msg 훅 내용 약화) → MISSING/FAIL" 1 "$TMP/empty-commit-msg"
cp -R "$GOOD/." "$TMP/comment-only-commit-msg"
printf '#!/usr/bin/env bash\n# check-commit-message.cjs\nexit 0\n' > "$TMP/comment-only-commit-msg/.githooks/commit-msg"
chmod +x "$TMP/comment-only-commit-msg/.githooks/commit-msg"
check "bad(commit-msg 훅이 validator를 주석에만 언급) → MISSING/FAIL" 1 "$TMP/comment-only-commit-msg"
cp -R "$GOOD/." "$TMP/noop-validator"
printf '%s\n' '// validateCommitMessage fixture sentinel' > "$TMP/noop-validator/scripts/check-commit-message.cjs"
check "bad(무동작 commit validator) → MISSING/FAIL" 1 "$TMP/noop-validator"
cp -R "$GOOD/." "$TMP/legacy-commitlint"
printf '%s\n' "module.exports = { extends: ['@commitlint/config-conventional'] }" > "$TMP/legacy-commitlint/commitlint.config.cjs"
check "bad(commitlint가 공통 validator를 연결하지 않음) → MISSING/FAIL" 1 "$TMP/legacy-commitlint"
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
check "good(sentinel이 인라인 # 뒤 문자열) → 통과" 0 "$GOOD_SENTINEL"
# #A(자기회귀): 제거된 게이트의 sentinel이 트레일링 주석에만 남으면 존재로 오인 금지 → MISSING/FAIL
check "bad(sentinel이 트레일링 주석에만) → MISSING/FAIL" 1 "$FIX/bad-sentinel-trailing-comment"
# #C: ci-gate를 './gradlew check'(test 포함) 내용신호로 인식 → 통과(과탐 없음)
check "good(gradlew check ci-gate) → 통과" 0 "$GOOD_GRADLE"

# E1: alembic 대칭 — alembic 감지 시 alembic-heads 게이트를 required로 기대(프로비저너 대칭 제공).
check "E1: alembic 완비(heads 有) → 통과"     0 "$GOOD_ALEMBIC"
check "E1: alembic-heads 누락 → MISSING/FAIL" 1 "$FIX/alembic-missing-heads"

# E2: nextjs·vue 감지 + 룰 점검(검증기 ruleMap 대칭) — 감지 스택·룰 자산이 출력에 나타나야 한다.
OUT=$(node "$GATE" --repo "$GOOD_ALEMBIC" --harness "$ROOT" 2>&1)
if echo "$OUT" | grep -q "nextjs, vue, alembic\|nextjs" && echo "$OUT" | grep -q "룰: nextjs.md" && echo "$OUT" | grep -q "룰: vue.md"; then
  echo "PASS: E2 nextjs·vue 감지+룰 점검"; PASS=$((PASS+1))
else
  echo "FAIL: E2 nextjs·vue 감지+룰 점검"; FAIL=$((FAIL+1))
fi
# E3: rails 감지 — Gemfile → rails 스택, ruby.md 룰 + activerecord 파괴 DDL 게이트(3번째 스텝) 대칭.
check "E3: rails 완비(ruby.md+AR게이트) → 통과"  0 "$GOOD_RAILS"
OUT=$(node "$GATE" --repo "$GOOD_RAILS" --harness "$ROOT" 2>&1)
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

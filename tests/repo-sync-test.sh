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
  cp "$ROOT/templates/ci/commitlint.yml" "$dest/.github/workflows/commitlint.yml"
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

# 깊은 monorepo 경로도 스택 탐색 범위다. 공통 자산만 남긴 repo의 depth 13 Flyway를 놓치면
# 스택 없음으로 false-pass하지만, 전수 순회하면 migration-safety/destructive-DDL 누락으로 실패해야 한다.
DEEP_FLYWAY="$TMP/deep-flyway"
cp -R "$GOOD/." "$DEEP_FLYWAY"
rm -rf "$DEEP_FLYWAY/src"
rm -f "$DEEP_FLYWAY/build.gradle" \
  "$DEEP_FLYWAY/.github/workflows/migration-safety.yml" \
  "$DEEP_FLYWAY/.github/workflows/destructive-ddl.yml" \
  "$DEEP_FLYWAY/scripts/check-migration-safety.mjs" \
  "$DEEP_FLYWAY/scripts/check-destructive-ddl.mjs" \
  "$DEEP_FLYWAY/.claude/rules/flyway.md" \
  "$DEEP_FLYWAY/.claude/rules/java.md"
DEEP_PATH="$DEEP_FLYWAY"
for segment in l01 l02 l03 l04 l05 l06 l07 l08 l09 l10 l11 l12; do
  DEEP_PATH="$DEEP_PATH/$segment"
done
mkdir -p "$DEEP_PATH/db/migration"
touch "$DEEP_PATH/db/migration/V0001__deep.sql"
if OUT=$(node "$GATE" --repo "$DEEP_FLYWAY" --harness "$ROOT" 2>&1); then
  echo "FAIL: depth 13 Flyway 스택 누락"; FAIL=$((FAIL+1))
elif echo "$OUT" | grep -q "감지된 스택: flyway" &&
     echo "$OUT" | grep -q "migration-safety 워크플로" &&
     echo "$OUT" | grep -q "✗ MISSING"; then
  echo "PASS: depth 13 Flyway 스택 감지·전용 게이트 누락 차단"; PASS=$((PASS+1))
else
  echo "FAIL: depth 13 Flyway 판정 불일치"; FAIL=$((FAIL+1))
fi

# exact consumer root 밖의 stack 신호와 symlink alias는 판정에 섞지 않는다.
SYMLINK_REPO="$TMP/symlink-boundary"
SYMLINK_OUTSIDE="$TMP/symlink-outside"
cp -R "$GOOD/." "$SYMLINK_REPO"
mkdir -p "$SYMLINK_OUTSIDE"
printf '%s\n' '{"dependencies":{"next":"latest"}}' > "$SYMLINK_OUTSIDE/package.json"
ln -s "$SYMLINK_REPO" "$SYMLINK_REPO/cycle"
for alias in 1 2 3 4 5 6 7 8; do
  ln -s "$SYMLINK_OUTSIDE" "$SYMLINK_REPO/external-$alias"
done
check "directory symlink cycle·외부 escape·alias fan-out → fail-closed" 1 "$SYMLINK_REPO"

INTERNAL_FILE_LINK_REPO="$TMP/internal-file-link"
cp -R "$GOOD/." "$INTERNAL_FILE_LINK_REPO"
printf '%s\n' '{"dependencies":{"next":"latest"}}' > "$INTERNAL_FILE_LINK_REPO/payload.json"
ln -s payload.json "$INTERNAL_FILE_LINK_REPO/package.json"
if OUT=$(node "$GATE" --repo "$INTERNAL_FILE_LINK_REPO" --harness "$ROOT" 2>&1) &&
   echo "$OUT" | grep -qx "감지된 스택: java, flyway, typescript, nextjs"; then
  echo "PASS: 내부 regular package.json symlink를 stack 신호로 검사"; PASS=$((PASS+1))
else
  echo "FAIL: 내부 regular package.json symlink 검사 누락"; FAIL=$((FAIL+1))
fi

EXTERNAL_FILE_LINK_REPO="$TMP/external-file-link"
cp -R "$GOOD/." "$EXTERNAL_FILE_LINK_REPO"
printf '%s\n' '{"name":"external-safe"}' > "$TMP/external-package.json"
ln -s "$TMP/external-package.json" "$EXTERNAL_FILE_LINK_REPO/package.json"
check "외부 regular package.json symlink → fail-closed" 1 "$EXTERNAL_FILE_LINK_REPO"

DANGLING_FILE_LINK_REPO="$TMP/dangling-file-link"
cp -R "$GOOD/." "$DANGLING_FILE_LINK_REPO"
ln -s "$TMP/missing-package.json" "$DANGLING_FILE_LINK_REPO/package.json"
check "dangling package.json symlink → fail-closed" 1 "$DANGLING_FILE_LINK_REPO"

NONREGULAR_FILE_LINK_REPO="$TMP/nonregular-file-link"
cp -R "$GOOD/." "$NONREGULAR_FILE_LINK_REPO"
mkfifo "$NONREGULAR_FILE_LINK_REPO/payload.pipe"
ln -s payload.pipe "$NONREGULAR_FILE_LINK_REPO/package.json"
check "비정규 package.json symlink → fail-closed" 1 "$NONREGULAR_FILE_LINK_REPO"

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
cp -R "$GOOD/." "$TMP/disabled-commitlint-action"
printf '%s\n' \
  'name: commitlint' \
  'jobs:' \
  '  commitlint:' \
  '    runs-on: ubuntu-latest' \
  '    steps:' \
  '      - uses: wagoid/commitlint-github-action@v6' \
  '        if: false' \
  '        with:' \
  '          configFile: ./commitlint.config.cjs' \
  > "$TMP/disabled-commitlint-action/.github/workflows/commitlint.yml"
check "bad(commitlint action이 if:false로 비활성) → MISSING/FAIL" 1 "$TMP/disabled-commitlint-action"
cp -R "$GOOD/." "$TMP/block-scalar-fake-action"
printf '%s\n' \
  'name: commitlint' \
  'jobs:' \
  '  commitlint:' \
  '    runs-on: ubuntu-latest' \
  '    steps:' \
  '      - run: |' \
  '          - uses: wagoid/commitlint-github-action@v6' \
  '            with:' \
  '              configFile: ./commitlint.config.cjs' \
  > "$TMP/block-scalar-fake-action/.github/workflows/commitlint.yml"
check "bad(block scalar 안 가짜 commitlint action) → MISSING/FAIL" 1 "$TMP/block-scalar-fake-action"
cp -R "$GOOD/." "$TMP/fail-open-commitlint-action"
printf '%s\n' \
  'name: commitlint' \
  'jobs:' \
  '  commitlint:' \
  '    runs-on: ubuntu-latest' \
  '    steps:' \
  '      - uses: wagoid/commitlint-github-action@v6' \
  '        continue-on-error: true' \
  '        with:' \
  '          configFile: ./commitlint.config.cjs' \
  '          failOnErrors: false' \
  > "$TMP/fail-open-commitlint-action/.github/workflows/commitlint.yml"
check "bad(commitlint action fail-open 옵션) → MISSING/FAIL" 1 "$TMP/fail-open-commitlint-action"
cp -R "$GOOD/." "$TMP/nested-commitlint-workflow"
mkdir -p "$TMP/nested-commitlint-workflow/.github/workflows/archive"
mv "$TMP/nested-commitlint-workflow/.github/workflows/commitlint.yml" \
  "$TMP/nested-commitlint-workflow/.github/workflows/archive/commitlint.yml"
check "bad(GitHub가 실행하지 않는 하위 workflow) → MISSING/FAIL" 1 "$TMP/nested-commitlint-workflow"
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

# Self-repo: gitignored docs/goals 실행 산출물의 중첩 checkout도 런타임 스택이 아니다.
SELF_WITH_GOAL="$TMP/self-with-goal-checkout"
mkdir -p "$SELF_WITH_GOAL"
git -C "$ROOT" archive --format=tar --output="$TMP/self-with-goal.tar" HEAD
tar -xf "$TMP/self-with-goal.tar" -C "$SELF_WITH_GOAL"
mkdir -p "$SELF_WITH_GOAL/docs/goals/run/repo/db/migration"
touch "$SELF_WITH_GOAL/docs/goals/run/repo/build.gradle"
touch "$SELF_WITH_GOAL/docs/goals/run/repo/db/migration/V1__nested.sql"
if OUT=$(node "$GATE" --repo "$SELF_WITH_GOAL" --harness "$SELF_WITH_GOAL" 2>&1) &&
   echo "$OUT" | grep -q "감지된 스택: (없음)" &&
   ! echo "$OUT" | grep -qE "룰:|✗ MISSING"; then
  echo "PASS: self-repo docs/goals 중첩 checkout 스택 오탐 없음"; PASS=$((PASS+1))
else
  echo "FAIL: self-repo docs/goals 중첩 checkout 스택 오탐"; FAIL=$((FAIL+1))
fi

# Consumer repo: 같은 docs/goals 경로도 self-check가 아니면 실제 stack 신호로 취급한다.
CONSUMER_WITH_GOAL="$TMP/consumer-with-goal-checkout"
mkdir -p "$CONSUMER_WITH_GOAL/docs/goals/run/repo/db/migration"
touch "$CONSUMER_WITH_GOAL/docs/goals/run/repo/build.gradle"
touch "$CONSUMER_WITH_GOAL/docs/goals/run/repo/db/migration/V1__nested.sql"
if OUT=$(node "$GATE" --repo "$CONSUMER_WITH_GOAL" --harness "$ROOT" 2>&1); then
  echo "FAIL: consumer repo docs/goals 스택 누락"; FAIL=$((FAIL+1))
elif echo "$OUT" | grep -q "감지된 스택: java, flyway" &&
     echo "$OUT" | grep -q "✗ MISSING"; then
  echo "PASS: consumer repo docs/goals 스택 감지·드리프트 차단"; PASS=$((PASS+1))
else
  echo "FAIL: consumer repo docs/goals 스택 판정 불일치"; FAIL=$((FAIL+1))
fi

# --help → 통과
node "$GATE" --help >/dev/null 2>&1 && { echo "PASS: --help → 통과"; PASS=$((PASS+1)); } || { echo "FAIL: --help"; FAIL=$((FAIL+1)); }

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

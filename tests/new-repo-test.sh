#!/bin/bash
# tests/new-repo-test.sh — new-repo.sh B4 게이트(prot_exit_ok) 단위 검증.
# 감사 B4(fail-open) 회귀 방지: 보호 적용 실패를 종료코드에 반영하는지(삼키지 않는지) 검증.
# NEWREPO_SOURCE_ONLY로 함수만 로드(git/gh/파일복사 없이). 로컬·CI 동일: bash tests/new-repo-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ROOT
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

if grep -Fq '| 개발 워크플로 | developer-workflow.md |' "$ROOT/templates/AGENTS.md"; then
  echo "PASS: AGENTS template → 개발자 워크플로 가이드 발견 경로"; PASS=$((PASS+1))
else
  echo "FAIL: AGENTS template → 개발자 워크플로 가이드 발견 경로 누락"; FAIL=$((FAIL+1))
fi

# #425: path-scoped Next.js rule은 root 앱뿐 아니라 src/·모노레포 앱에서도 실제로 로드돼야 한다.
if ROOT="$ROOT" node <<'NODE'
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const rule = readFileSync(join(process.env.ROOT, 'templates/rules/stacks/nextjs.md'), 'utf8')
const pathsLine = rule.split('\n').find((line) => line.startsWith('paths: '))
const patterns = JSON.parse(pathsLine.slice('paths: '.length))
const required = [
  ['**/app/**/*.tsx', 'root·src·모노레포 App Router TSX'],
  ['**/app/**/*.ts', 'root·src·모노레포 App Router TS'],
  ['**/pages/**/*.tsx', 'root·모노레포 Pages Router TSX'],
  ['**/pages/**/*.ts', 'root·모노레포 Pages API TS'],
  ['**/middleware.ts', 'root·모노레포 middleware'],
  ['**/next.config.*', 'root·모노레포 next.config'],
]

for (const [pattern, contract] of required) {
  if (!patterns.includes(pattern)) {
    console.error(`Next.js rule path 누락: ${pattern} (${contract})`)
    process.exit(1)
  }
}
for (const pattern of ['**/*.ts', '**/*.tsx']) {
  if (patterns.includes(pattern)) {
    console.error(`Next.js rule path 과매칭: ${pattern}`)
    process.exit(1)
  }
}
NODE
then
  echo "PASS: Next.js rule → root·src·모노레포 경로 로드"; PASS=$((PASS+1))
else
  echo "FAIL: Next.js rule → root·src·모노레포 경로 계약 위반"; FAIL=$((FAIL+1))
fi

if grep -Fq 'check-commit-message.cjs' "$ROOT/scripts/new-repo.sh" \
  && grep -Fq 'templates/githooks/commit-msg' "$ROOT/scripts/new-repo.sh" \
  && grep -Fq 'chmod +x .githooks/commit-msg' "$ROOT/scripts/new-repo.sh"; then
  echo "PASS: 신규 repo → commit validator·commit-msg hook 설치"; PASS=$((PASS+1))
else
  echo "FAIL: 신규 repo → commit validator·commit-msg hook 배선 누락"; FAIL=$((FAIL+1))
fi

# Exercise the actual setup entrypoint; only the remote API boundary is replaced.
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"
cat > "$TMP/bin/gh" <<'MOCK'
#!/bin/bash
if [ "$1" = repo ]; then echo acme/example; exit 0; fi
endpoint="$2"
if [[ " $* " == *" -X PUT "* ]]; then
  echo "$endpoint" >> "$WRITE_LOG"
  [ -z "${PROTECTION_LOG:-}" ] || printf '%s\n' "$*" >> "$PROTECTION_LOG"
  echo '{}'; exit 0
fi
case "$endpoint" in
  repos/acme/example/branches/main|repos/acme/example/branches/develop)
    if [ "$SETUP_CASE" = protected ]; then echo true
    elif [ "$SETUP_CASE" = api-error ]; then exit 1
    else echo false; fi ;;
  repos/acme/example) echo main ;;
  repos/acme/example/contents/.github/workflows/commitlint.yml)
    if [ "$SETUP_CASE" = missing ]; then exit 1
    elif [ "$SETUP_CASE" = legacy ]; then echo 0000000000000000000000000000000000000000
    else echo "$WORKFLOW_BLOB"; fi ;;
  repos/acme/example/contents/scripts/check-commit-message.cjs)
    if [ "$SETUP_CASE" = validator-missing ]; then exit 1; fi
    echo "$VALIDATOR_BLOB" ;;
  repos/acme/example/contents/.github/workflows*) echo '[]' ;;
  *) echo "unexpected API: $*" >&2; exit 1 ;;
esac
MOCK
chmod +x "$TMP/bin/gh"
git init -q "$TMP/source"
git -C "$TMP/source" -c user.name=test -c user.email=test@example.com -c core.hooksPath=/dev/null \
  commit --allow-empty -qm 'docs: 초기 기준 추가'
git -C "$TMP/source" branch -M main
git -C "$TMP/source" branch develop
export WORKFLOW_BLOB VALIDATOR_BLOB
WORKFLOW_BLOB=$(git hash-object "$ROOT/templates/ci/commitlint.yml")
VALIDATOR_BLOB=$(git hash-object "$ROOT/scripts/check-commit-message.cjs")
for scenario in protected missing legacy validator-missing api-error ready; do
  git clone -q "$TMP/source" "$TMP/$scenario"
  export SETUP_CASE="$scenario" WRITE_LOG="$TMP/$scenario-writes"
  : > "$WRITE_LOG"
  rc=0
  (cd "$TMP/$scenario" && printf '1\n' | PATH="$TMP/bin:$PATH" bash "$NR") > "$TMP/$scenario.log" 2>&1 || rc=$?
  writes=$(wc -l < "$WRITE_LOG" | tr -d ' ')
  expected=0; expected_rc=1
  [ "$scenario" = protected ] && expected_rc=0
  if [ "$scenario" = ready ]; then expected=2; expected_rc=0; fi
  if [ "$writes" = "$expected" ] && [ "$rc" = "$expected_rc" ]; then
    echo "PASS: setup $scenario → protection writes=$writes exit=$rc"; PASS=$((PASS+1))
  else
    cat "$TMP/$scenario.log"
    echo "FAIL: setup $scenario → writes=$writes/$expected exit=$rc/$expected_rc"; FAIL=$((FAIL+1))
  fi
done

# Selection metadata must reach the real copier and protection boundary.
# Expectations are independent of the implementation catalog.
for selection in 1 2 3 4 5 6 1+1 1+5 1+6 2+1 2+5 2+6 3+1 3+5 3+6 4+1 4+5 4+6; do
  target="$TMP/stack-${selection/+/-}"
  git clone -q "$TMP/source" "$target"
  export SETUP_CASE=ready WRITE_LOG="$target-writes" PROTECTION_LOG="$target-protection"
  : > "$WRITE_LOG"; : > "$PROTECTION_LOG"
  rc=0
  (cd "$target" && printf '%s\napps/api\napps/web\n' "$selection" | PATH="$TMP/bin:$PATH" bash "$NR") > "$target.log" 2>&1 || rc=$?
  if [ "$rc" = 0 ] && TARGET="$target" SELECTION="$selection" PROTECTION_LOG="$PROTECTION_LOG" python3 <<'CHECK'
import json, os
from pathlib import Path
target = Path(os.environ['TARGET'])
parts = [int(p) for p in os.environ['SELECTION'].split('+')]
rule_sets = {1: {'typescript'}, 2: {'java', 'flyway'}, 3: {'python', 'alembic'},
             4: {'ruby'}, 5: {'typescript', 'nextjs'}, 6: {'typescript', 'vue'}}
rules = set().union(*(rule_sets[p] for p in parts))
assert rules == {p.stem for p in (target / '.claude/rules').glob('*.md') if p.stem != 'korean-ux'}
settings = json.loads((target / '.claude/settings.json').read_text())
baseline = json.loads(Path(os.environ['ROOT'] + '/templates/settings.json').read_text())
assert settings == baseline, 'setup must not grant implicit stack permissions'
policy = Path(os.environ['PROTECTION_LOG']).read_text()
checks = {'secret-scan', 'test-guard', 'commitlint-trusted', 'integration-e2e', 'destructive-ddl'}
checks.update({'backend', 'frontend'} if len(parts) == 2 else {'quality'})
if parts[0] == 2: checks.add('migration-safety')
if parts[0] == 3: checks.add('alembic-heads')
for check in checks: assert check in policy, check
workflow = (target / '.github/workflows/ci-gate.yml').read_text()
if len(parts) == 2:
    assert '\n  backend:\n' in workflow and '\n  frontend:\n' in workflow
    assert 'working-directory: apps/api' in workflow and 'working-directory: apps/web' in workflow
    assert 'cache-dependency-path: apps/web/package-lock.json' in workflow
    assert (target / 'apps/web/.prettierrc').read_bytes() == Path(os.environ['ROOT'] + '/templates/.prettierrc').read_bytes()
    assert (target / 'apps/web/scripts/check-design-tokens.mjs').read_bytes() == Path(os.environ['ROOT'] + '/templates/frontend/check-design-tokens.mjs').read_bytes()
    if parts[0] == 2:
        assert (target / 'apps/api/.gitignore').read_bytes() == Path(os.environ['ROOT'] + '/templates/backend-gitignore.spring').read_bytes()
        assert (target / 'apps/api/config/checkstyle/checkstyle.xml').read_bytes() == Path(os.environ['ROOT'] + '/templates/checkstyle.xml').read_bytes()
    if parts[0] == 3:
        import subprocess
        config = target / 'apps/api/alembic.ini'
        config.parent.mkdir(parents=True, exist_ok=True)
        config.touch()
        gate = target / '.github/workflows/alembic-heads.yml'
        parsed = json.loads(subprocess.check_output(['ruby', '-ryaml', '-rjson', '-e', 'puts JSON.generate(YAML.safe_load(File.read(ARGV[0])))', str(gate)], text=True))
        job = parsed['jobs']['alembic-heads']
        directory = job.get('defaults', {}).get('run', {}).get('working-directory', '.')
        fake = target / 'fake-alembic-bin'; fake.mkdir()
        for name, body in {'pip': '#!/bin/sh\nexit 0\n', 'alembic': '#!/bin/sh\nprintf "first (head)\\nsecond (head)\\n"\n'}.items():
            tool = fake / name; tool.write_text(body); tool.chmod(0o755)
        step = next(s['run'] for s in job['steps'] if 'run' in s)
        result = subprocess.run(['bash', '-eo', 'pipefail', '-c', step], cwd=target / directory,
                                env={**os.environ, 'PATH': str(fake) + ':' + os.environ['PATH']}, capture_output=True, text=True)
        assert result.returncode == 1 and 'head=2' in result.stdout, result.stdout
else:
    template = ['node', 'spring', 'python', 'rails', 'nextjs', 'vue'][parts[0] - 1]
    assert workflow == Path(os.environ['ROOT'] + '/templates/ci/stacks/ci-gate-' + template + '.yml').read_text()
CHECK
  then
    echo "PASS: setup stack $selection → actual workflow, rules, unchanged permissions and required checks"; PASS=$((PASS+1))
  else
    cat "$target.log"
    echo "FAIL: setup stack $selection → integration mismatch (exit=$rc)"; FAIL=$((FAIL+1))
  fi
done

# Standalone destinations must not inherit shell variables used by compositions.
for kind in relative traversal absolute; do
  target="$TMP/env-$kind"
  git clone -q "$TMP/source" "$target"
  case "$kind" in
    relative) foreign="foreign-env"; outside="$target/$foreign" ;;
    traversal) foreign="../outside-env"; outside="$TMP/outside-env" ;;
    absolute) foreign="$TMP/absolute-outside-env"; outside="$foreign" ;;
  esac
  export SETUP_CASE=ready WRITE_LOG="$target-writes" PROTECTION_LOG="$target-protection"
  : > "$WRITE_LOG"; : > "$PROTECTION_LOG"
  if (cd "$target" && printf '2\n' | BACKEND_DIR="$foreign" FRONTEND_DIR="$foreign" PATH="$TMP/bin:$PATH" bash "$NR") > "$target.log" 2>&1 \
    && cmp -s "$ROOT/templates/checkstyle.xml" "$target/backend/config/checkstyle/checkstyle.xml" \
    && [ ! -e "$outside" ]; then
    echo "PASS: standalone Spring ignores inherited $kind directory variables"; PASS=$((PASS+1))
  else
    echo "FAIL: standalone Spring inherited $kind destination"; FAIL=$((FAIL+1))
  fi
done

for selection in 7 5+6 2+3 2+6:../outside; do
  target="$TMP/invalid-${selection//[^a-zA-Z0-9]/-}"
  git clone -q "$TMP/source" "$target"
  export SETUP_CASE=ready WRITE_LOG="$target-writes" PROTECTION_LOG="$target-protection"
  : > "$WRITE_LOG"; : > "$PROTECTION_LOG"
  rc=0
  (cd "$target" && printf '%s\n%s\napps/web\n' "${selection%%:*}" "${selection#*:}" | PATH="$TMP/bin:$PATH" bash "$NR") > "$target.log" 2>&1 || rc=$?
  if [ "$rc" != 0 ] && [ ! -s "$WRITE_LOG" ] && [ ! -d "$target/.github" ]; then
    echo "PASS: invalid selection $selection → no files or protection writes"; PASS=$((PASS+1))
  else
    echo "FAIL: invalid selection $selection was not rejected before side effects"; FAIL=$((FAIL+1))
  fi
done

# Existing product-specific files must survive, including permissions and rules.
target="$TMP/preserve"
git clone -q "$TMP/source" "$target"
mkdir -p "$target/.github/workflows" "$target/.claude/rules"
mkdir -p "$target/backend/config/checkstyle" "$target/frontend/scripts"
printf 'backend ignore sentinel\n' > "$target/backend/.gitignore"
printf 'checkstyle sentinel\n' > "$target/backend/config/checkstyle/checkstyle.xml"
printf 'formatter sentinel\n' > "$target/frontend/.prettierrc"
printf 'design gate sentinel\n' > "$target/frontend/scripts/check-design-tokens.mjs"
printf 'product CI sentinel\n' > "$target/.github/workflows/ci-gate.yml"
printf '{"permissions":{"allow":["product-only"],"deny":["deny-sentinel"]}}\n' > "$target/.claude/settings.json"
printf 'product rule sentinel\n' > "$target/.claude/rules/vue.md"
cp "$target/.claude/settings.json" "$TMP/preserved-settings"
export SETUP_CASE=ready WRITE_LOG="$target-writes" PROTECTION_LOG="$target-protection"
: > "$WRITE_LOG"; : > "$PROTECTION_LOG"
if (cd "$target" && printf '2+6\nbackend\nfrontend\n' | PATH="$TMP/bin:$PATH" bash "$NR") > "$target.log" 2>&1 \
  && cmp -s "$target/.claude/settings.json" "$TMP/preserved-settings" \
  && [ "$(cat "$target/.github/workflows/ci-gate.yml")" = 'product CI sentinel' ] \
  && [ "$(cat "$target/backend/.gitignore")" = 'backend ignore sentinel' ] \
  && [ "$(cat "$target/backend/config/checkstyle/checkstyle.xml")" = 'checkstyle sentinel' ] \
  && [ "$(cat "$target/frontend/.prettierrc")" = 'formatter sentinel' ] \
  && [ "$(cat "$target/frontend/scripts/check-design-tokens.mjs")" = 'design gate sentinel' ] \
  && [ "$(cat "$target/.claude/rules/vue.md")" = 'product rule sentinel' ]; then
  echo 'PASS: existing CI/settings/rules remain byte-identical'; PASS=$((PASS+1))
else
  cat "$target.log"
  echo 'FAIL: existing product configuration was changed'; FAIL=$((FAIL+1))
fi

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

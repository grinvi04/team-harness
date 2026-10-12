#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DOCTOR="$ROOT/scripts/harness-doctor.sh"
# Semantic managed-policy fixtures require stdlib tomllib, matching the doctor contract.
if [ -z "${PYTHON_BIN:-}" ]; then
  for candidate in python3 python3.11 python3.12 python3.13; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import tomllib' >/dev/null 2>&1; then
      export PYTHON_BIN="$candidate"
      break
    fi
  done
fi
"${PYTHON_BIN:-python3}" -c 'import tomllib' || { echo 'FAIL: Python3.11+ required (set PYTHON_BIN)'; exit 1; }
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
FAKE_ROOT="$TMP/harness"
NATIVE_PLUGIN_ROOT="$TMP/native-plugin"
mkdir -p "$FAKE_ROOT/scripts" "$FAKE_ROOT/plugins/harness-guard/.codex-plugin" "$FAKE_ROOT/plugins/harness-guard/scripts" "$TMP/bin" "$NATIVE_PLUGIN_ROOT"

printf '{"version":"1.2.3"}\n' >"$FAKE_ROOT/plugins/harness-guard/.codex-plugin/plugin.json"
cp -R "$ROOT/plugins/harness-guard/.codex-plugin" "$NATIVE_PLUGIN_ROOT/"
cp -R "$ROOT/plugins/harness-guard/codex" "$NATIVE_PLUGIN_ROOT/"
node - "$NATIVE_PLUGIN_ROOT/.codex-plugin/plugin.json" <<'NODE'
const fs = require('node:fs')
const file = process.argv[2]
const data = JSON.parse(fs.readFileSync(file, 'utf8'))
data.version = '1.2.3'
fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
NODE

cat >"$FAKE_ROOT/scripts/install-codex-managed-requirements.sh" <<'SH'
#!/usr/bin/env bash
[ "${DOCTOR_FAIL:-}" != requirements ] || exit 1
echo 'OK requirements'
SH
cp "$ROOT/scripts/check-codex-native-plugin.mjs" "$FAKE_ROOT/scripts/" 2>/dev/null || true
cp "$ROOT/scripts/codex-binary-trust.mjs" "$FAKE_ROOT/scripts/" 2>/dev/null || true
cat >"$FAKE_ROOT/plugins/harness-guard/scripts/check-repo-sync.mjs" <<'JS'
if (process.env.DOCTOR_FAIL === 'repo-sync') process.exit(1)
console.log('OK repo-sync')
JS
cat >"$FAKE_ROOT/plugins/harness-guard/scripts/set-branch-protection.sh" <<'SH'
#!/usr/bin/env bash
[ "${DOCTOR_FAIL:-}" != branch ] || exit 1
if [ "${DOCTOR_FAIL:-}" = missing-branch ]; then
  echo '✓ owner/repo:main — 보호 적용(승인0 · enforce_admins=on · checks=4)'
  echo 'skip owner/repo:develop (브랜치 없음/비공개)'
  exit 0
fi
echo 'OK branch protection'
SH
cat >"$FAKE_ROOT/scripts/codex-fresh-session-smoke.sh" <<'SH'
#!/usr/bin/env bash
echo probe >>"$DOCTOR_CALLS"
[ "${DOCTOR_FAIL:-}" != probe ] || exit 1
echo 'OK fresh-session probe'
SH
chmod +x "$FAKE_ROOT"/scripts/*.sh "$FAKE_ROOT"/plugins/harness-guard/scripts/*.sh

cat >"$TMP/bin/codex" <<'SH'
#!/usr/bin/env bash
echo "codex $*" >>"$DOCTOR_TOOL_CALLS"
if [ "$*" = '--version' ]; then echo 'codex-cli 9.9.9'; exit 0; fi
if [ "$*" = 'plugin list --json' ]; then
  version=${DOCTOR_INSTALLED_VERSION:-1.2.3}
  enabled=true
  [ "${DOCTOR_FAIL:-}" != disabled ] || enabled=false
  path=$NATIVE_PLUGIN_ROOT
  [ "${DOCTOR_FAIL:-}" != native ] || path=$BROKEN_PLUGIN_ROOT
  printf '{"installed":[{"pluginId":"harness-guard@team-harness","version":"%s","enabled":%s,"source":{"source":"local","path":"%s"}}]}\n' "$version" "$enabled" "$path"
  exit 0
fi
exit 2
SH
cat >"$TMP/bin/gh" <<'SH'
#!/usr/bin/env bash
echo "gh $*" >>"$DOCTOR_TOOL_CALLS"
[ "${DOCTOR_FAIL:-}" != gh ] || exit 1
case "$*" in
  'repo view --json nameWithOwner --jq .nameWithOwner') echo 'owner/repo';;
  api\ repos/owner/repo/branches/*/protection)
    [ "${DOCTOR_FAIL:-}" != unreadable-protection ] || exit 1
    [ "${DOCTOR_FAIL:-}" != malformed-protection ] || { echo '{}'; exit 0; }
    if [ -n "${DOCTOR_PROTECTION_JSON:-}" ]; then cat "$DOCTOR_PROTECTION_JSON"; exit 0; fi
    echo '{"required_status_checks":{"strict":true,"contexts":["company/quality"],"checks":[]},"required_pull_request_reviews":{"required_approving_review_count":2},"enforce_admins":{"enabled":true}}';;
  *) exit 2;;
esac
SH
chmod +x "$TMP/bin/codex" "$TMP/bin/gh"

BROKEN_PLUGIN_ROOT="$TMP/broken-plugin"
mkdir -p "$BROKEN_PLUGIN_ROOT"
export PATH="$TMP/bin:$PATH"
export HARNESS_ROOT="$FAKE_ROOT"
export NATIVE_PLUGIN_ROOT BROKEN_PLUGIN_ROOT
export DOCTOR_CALLS="$TMP/calls"
touch "$DOCTOR_CALLS"
export CODEX_REQUIREMENTS_PATH="$TMP/requirements.toml"
printf '# Company maintained; unrelated policy allowed\n[features]\nhooks = true\n[permissions]\nmode = "company"\n' >"$CODEX_REQUIREMENTS_PATH"
export DOCTOR_TOOL_CALLS="$TMP/tool-calls"
touch "$DOCTOR_TOOL_CALLS"
TECH_REPO="$TMP/company-app"
mkdir -p "$TECH_REPO/checks"
printf 'company selected check\n' >"$TECH_REPO/checks/harness.sh"
node - "$TECH_REPO" <<'NODE'
const fs = require('node:fs'), crypto = require('node:crypto'), path = require('node:path')
const root = process.argv[2]
const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'checks/harness.sh'))).digest('hex')
fs.writeFileSync(path.join(root, '.harness-assets.json'), JSON.stringify({schemaVersion:1, source:{sha:'a'.repeat(40),version:'v1.0.0'}, assets:[{source:'templates/check.sh',destination:'checks/harness.sh',hash,mode:420}]}))
NODE
cp "$TECH_REPO/.harness-assets.json" "$TMP/valid-ownership.json"
out=$(CODEX_BIN="$TMP/unavailable-codex" GH_BIN="$TMP/unavailable-gh" bash "$DOCTOR" --repo "$TECH_REPO" --components tech)
printf '%s\n' "$out" | grep -Fq 'PASS  adopted tech assets'
printf '%s\n' "$out" | grep -Fq 'RESULT healthy'
[ ! -s "$DOCTOR_TOOL_CALLS" ] || { echo 'FAIL: tech called native/GitHub tools'; exit 1; }
printf 'user edit\n' >>"$TECH_REPO/checks/harness.sh"
if bash "$DOCTOR" --repo "$TECH_REPO" --components tech >"$TMP/modified.out" 2>&1; then echo 'FAIL: doctor accepted modified adopted assets'; exit 1; fi
grep -Fq 'FAIL  adopted tech assets' "$TMP/modified.out"
rm "$TECH_REPO/.harness-assets.json"
if bash "$DOCTOR" --repo "$TECH_REPO" --components tech >"$TMP/missing.out" 2>&1; then echo 'FAIL: missing adoption record was healthy'; exit 1; fi
grep -Fq 'UNVERIFIED  adopted tech assets' "$TMP/missing.out"
[ ! -s "$DOCTOR_TOOL_CALLS" ] || { echo 'FAIL: tech conflict queried native/GitHub tools'; exit 1; }
out=$(CODEX_BIN="$TMP/unavailable-codex" bash "$DOCTOR" --repo "$TECH_REPO" --components github --branches main)
printf '%s\n' "$out" | grep -Fq 'PASS  branch protection'
grep -Fq 'gh api repos/owner/repo/branches/main/protection' "$DOCTOR_TOOL_CALLS"
if grep -Eq 'codex|develop' "$DOCTOR_TOOL_CALLS"; then echo 'FAIL: github-only queried unselected component or branch'; exit 1; fi
cp "$TMP/valid-ownership.json" "$TECH_REPO/.harness-assets.json"
printf 'company selected check\n' >"$TECH_REPO/checks/harness.sh"
: >"$DOCTOR_TOOL_CALLS"
out=$(CODEX_BIN="$TMP/unavailable-codex" bash "$DOCTOR" --repo "$TECH_REPO" --components tech,github --branches main,develop)
printf '%s\n' "$out" | grep -Fq 'PASS  adopted tech assets'
printf '%s\n' "$out" | grep -Fq 'PASS  branch protection (develop readable'
grep -Fq 'gh api repos/owner/repo/branches/main/protection' "$DOCTOR_TOOL_CALLS"
grep -Fq 'gh api repos/owner/repo/branches/develop/protection' "$DOCTOR_TOOL_CALLS"
if grep -Fq codex "$DOCTOR_TOOL_CALLS"; then echo 'FAIL: tech,github called Codex'; exit 1; fi
chmod 0755 "$TECH_REPO/checks/harness.sh"
if bash "$DOCTOR" --repo "$TECH_REPO" --components tech >"$TMP/mode.out" 2>&1; then echo 'FAIL: adopted mode drift accepted'; exit 1; fi
chmod 0644 "$TECH_REPO/checks/harness.sh"
cp "$TECH_REPO/checks/harness.sh" "$TMP/foreign-check"
rm "$TECH_REPO/checks/harness.sh"
ln -s "$TMP/foreign-check" "$TECH_REPO/checks/harness.sh"
if bash "$DOCTOR" --repo "$TECH_REPO" --components tech >"$TMP/tech-link.out" 2>&1; then echo 'FAIL: managed symlink accepted'; exit 1; fi
grep -Fq 'FAIL  adopted tech assets' "$TMP/tech-link.out"
: >"$DOCTOR_TOOL_CALLS"
if bash "$DOCTOR" --repo "$TECH_REPO" --components tech --probe >"$TMP/bad-probe.out" 2>&1; then echo 'FAIL: --probe accepted without codex'; exit 1; fi
[ ! -s "$DOCTOR_CALLS" ] || { echo 'FAIL: invalid --probe called model'; exit 1; }

out=$(bash "$DOCTOR" --repo "$ROOT")
printf '%s\n' "$out" | grep -Fq 'PASS  managed requirements'
printf '%s\n' "$out" | grep -Fq 'PASS  harness-guard plugin 1.2.3'
printf '%s\n' "$out" | grep -Fq 'PASS  Codex native plugin contract'
printf '%s\n' "$out" | grep -Fq 'PASS  repo sync'
printf '%s\n' "$out" | grep -Fq 'PASS  branch protection'
printf '%s\n' "$out" | grep -Fq 'UNVERIFIED  fresh-session probe (use --probe)'
[ ! -s "$DOCTOR_CALLS" ] || { echo 'FAIL: default doctor invoked model probe'; exit 1; }

out=$(bash "$DOCTOR" --repo "$ROOT" --probe)
printf '%s\n' "$out" | grep -Fq 'PASS  fresh-session probe'
[ "$(wc -l <"$DOCTOR_CALLS" | tr -d ' ')" = 1 ] || { echo 'FAIL: --probe did not invoke smoke exactly once'; exit 1; }

# Source checkout version differs from installed version; installed manifest remains authoritative.
node - "$NATIVE_PLUGIN_ROOT/.codex-plugin/plugin.json" <<'NODE'
const fs = require('node:fs'), file = process.argv[2], data = JSON.parse(fs.readFileSync(file))
data.version = '1.2.2'; fs.writeFileSync(file, JSON.stringify(data))
NODE
out=$(DOCTOR_INSTALLED_VERSION=1.2.2 bash "$DOCTOR" --repo "$ROOT" --components codex)
printf '%s\n' "$out" | grep -Fq 'PASS  harness-guard plugin 1.2.2'
printf '%s\n' "$out" | grep -Fq 'PASS  managed requirements'
printf '%s\n' "$out" | grep -Fq 'UNVERIFIED  fresh-session probe'
if DOCTOR_INSTALLED_VERSION=1.2.2 bash "$DOCTOR" --repo "$ROOT" --components codex --expected-version 1.2.3 >"$TMP/version.out" 2>&1; then echo 'FAIL: explicit installed version mismatch accepted'; exit 1; fi
grep -Fq 'FAIL  harness-guard plugin' "$TMP/version.out"
if bash "$DOCTOR" --repo "$ROOT" --components codex >"$TMP/manifest-version.out" 2>&1; then echo 'FAIL: installed manifest mismatch accepted'; exit 1; fi
grep -Fq 'FAIL  Codex native plugin contract' "$TMP/manifest-version.out"
node - "$NATIVE_PLUGIN_ROOT/.codex-plugin/plugin.json" <<'NODE'
const fs = require('node:fs'), file = process.argv[2], data = JSON.parse(fs.readFileSync(file))
data.version = '1.2.3'; fs.writeFileSync(file, JSON.stringify(data))
NODE
for failure in disabled native; do
  if DOCTOR_FAIL=$failure bash "$DOCTOR" --repo "$ROOT" --components codex >"$TMP/$failure.out" 2>&1; then echo "FAIL: $failure plugin accepted"; exit 1; fi
done
for policy in 'hooks = false' 'hooks = "true"' 'another_feature = true'; do
  printf '[features]\n%s\n' "$policy" >"$CODEX_REQUIREMENTS_PATH"
  if bash "$DOCTOR" --repo "$ROOT" --components codex >"$TMP/policy.out" 2>&1; then echo 'FAIL: disabled/missing hooks policy accepted'; exit 1; fi
  grep -Fq 'FAIL  managed requirements' "$TMP/policy.out"
done
printf '[features]\nhooks = true\n' >"$CODEX_REQUIREMENTS_PATH"
# A present manifest with disabled/missing hook handlers must not count as an active contract.
cp "$NATIVE_PLUGIN_ROOT/codex/hooks/hooks.json" "$TMP/native-hooks-original.json"
node - "$NATIVE_PLUGIN_ROOT/codex/hooks/hooks.json" <<'NODE'
const fs = require('node:fs'), file = process.argv[2], data = JSON.parse(fs.readFileSync(file))
data.hooks.PreToolUse[0].hooks[0].command = 'true'
fs.writeFileSync(file, JSON.stringify(data))
NODE
if bash "$DOCTOR" --repo "$ROOT" --components codex >"$TMP/disabled-hook.out" 2>&1; then echo 'FAIL: disabled guard command accepted'; exit 1; fi
grep -Fq 'FAIL  Codex native plugin contract' "$TMP/disabled-hook.out"
cp "$TMP/native-hooks-original.json" "$NATIVE_PLUGIN_ROOT/codex/hooks/hooks.json"
for failure in unreadable-protection malformed-protection; do
  if DOCTOR_FAIL=$failure bash "$DOCTOR" --repo "$ROOT" --components github --branches main >"$TMP/$failure.out" 2>&1; then echo "FAIL: $failure accepted"; exit 1; fi
done
# Malformed response values must fail even when JSON and the endpoint are readable.
for malformed in contexts-values checks-type check-context app-null app-bool app-negative approval-negative approval-high approval-bool review-boolean flag-boolean; do
  node - "$TMP/protection.json" "$malformed" <<'NODE'
const fs = require('node:fs')
const data = {enforce_admins:{enabled:true},required_status_checks:{strict:true,contexts:['company/quality'],checks:[{context:'company/quality',app_id:9}]},required_pull_request_reviews:{required_approving_review_count:2,dismiss_stale_reviews:true}}
switch (process.argv[3]) {
  case 'contexts-values': data.required_status_checks.contexts = [42,null]; break
  case 'checks-type': data.required_status_checks.checks = 'invalid'; break
  case 'check-context': data.required_status_checks.checks[0].context = 42; break
  case 'app-null': data.required_status_checks.checks[0].app_id = null; break
  case 'app-bool': data.required_status_checks.checks[0].app_id = true; break
  case 'app-negative': data.required_status_checks.checks[0].app_id = -2; break
  case 'approval-negative': data.required_pull_request_reviews.required_approving_review_count = -1; break
  case 'approval-high': data.required_pull_request_reviews.required_approving_review_count = 7; break
  case 'approval-bool': data.required_pull_request_reviews.required_approving_review_count = true; break
  case 'review-boolean': data.required_pull_request_reviews.dismiss_stale_reviews = 'true'; break
  case 'flag-boolean': data.allow_force_pushes = {enabled:42}; break
}
fs.writeFileSync(process.argv[2], JSON.stringify(data))
NODE
  if DOCTOR_PROTECTION_JSON="$TMP/protection.json" bash "$DOCTOR" --repo "$ROOT" --components github --branches main >"$TMP/malformed-$malformed.out" 2>&1; then echo "FAIL: malformed $malformed protection accepted"; exit 1; fi
  grep -Fq 'FAIL  branch protection' "$TMP/malformed-$malformed.out"
done
printf '%s\n' '{"enforce_admins":{"enabled":false},"required_status_checks":{"strict":false,"contexts":[],"checks":[{"context":"company/quality","app_id":-1}]},"required_pull_request_reviews":{"required_approving_review_count":0,"dismiss_stale_reviews":false}}' >"$TMP/protection.json"
out=$(DOCTOR_PROTECTION_JSON="$TMP/protection.json" bash "$DOCTOR" --repo "$ROOT" --components github --branches main)
printf '%s\n' "$out" | grep -Fq 'PASS  branch protection'
for components in invalid tech,tech tech,; do
  if bash "$DOCTOR" --repo "$ROOT" --components "$components" >/dev/null 2>&1; then echo 'FAIL: invalid components accepted'; exit 1; fi
done

if DOCTOR_FAIL=branch bash "$DOCTOR" --repo "$ROOT" >"$TMP/branch.out" 2>&1; then
  echo 'FAIL: doctor hid branch protection failure'
  exit 1
fi
grep -Fq 'FAIL  branch protection' "$TMP/branch.out"

if DOCTOR_FAIL=missing-branch bash "$DOCTOR" --repo "$ROOT" >"$TMP/missing-branch.out" 2>&1; then
  echo 'FAIL: doctor accepted a missing protected branch'
  exit 1
fi
grep -Fq 'FAIL  branch protection' "$TMP/missing-branch.out"

if DOCTOR_FAIL=native bash "$DOCTOR" --repo "$ROOT" >"$TMP/native.out" 2>&1; then
  echo 'FAIL: doctor accepted a broken native plugin'
  exit 1
fi
grep -Fq 'FAIL  Codex native plugin contract' "$TMP/native.out"

actor_failures=0
for malformed in restrictions-type dismissal-list bypass-list users-name teams-name apps-name missing-name; do
  node - "$TMP/actors.json" "$malformed" <<'NODE'
const fs = require('node:fs')
const data = {enforce_admins:{enabled:true},required_status_checks:{strict:true,contexts:['quality'],checks:[]},required_pull_request_reviews:{required_approving_review_count:1}}
const actors = {users:[],teams:[],apps:[]}
switch(process.argv[3]) {
  case 'restrictions-type': data.restrictions = 'invalid'; break
  case 'dismissal-list': data.required_pull_request_reviews.dismissal_restrictions = {...actors,users:42}; break
  case 'bypass-list': data.required_pull_request_reviews.bypass_pull_request_allowances = {...actors,apps:'invalid'}; break
  case 'users-name': data.restrictions = {...actors,users:[{login:42}]}; break
  case 'teams-name': data.restrictions = {...actors,teams:[{slug:null}]}; break
  case 'apps-name': data.restrictions = {...actors,apps:[{slug:''}]}; break
  case 'missing-name': data.restrictions = {...actors,users:[{id:1}]}; break
}
fs.writeFileSync(process.argv[2],JSON.stringify(data))
NODE
  if DOCTOR_PROTECTION_JSON="$TMP/actors.json" bash "$DOCTOR" --repo "$ROOT" --components github --branches main >"$TMP/actor-$malformed.out" 2>&1; then
    echo "FAIL: malformed actor $malformed accepted"
    actor_failures=$((actor_failures + 1))
  else grep -Fq 'FAIL  branch protection' "$TMP/actor-$malformed.out"; fi
done
[ "$actor_failures" -eq 0 ] || exit 1
printf '%s\n' '{"enforce_admins":{"enabled":true},"required_status_checks":null,"required_pull_request_reviews":{"required_approving_review_count":0,"dismissal_restrictions":{"users":[{"login":"company-user","id":1}],"teams":[{"slug":"company-team"}],"apps":[{"slug":"company-app"}]},"bypass_pull_request_allowances":{"users":[],"teams":[],"apps":[]}},"restrictions":{"users":[],"teams":[],"apps":[]}}' >"$TMP/actors.json"
out=$(DOCTOR_PROTECTION_JSON="$TMP/actors.json" bash "$DOCTOR" --repo "$ROOT" --components github --branches main)
printf '%s\n' "$out" | grep -Fq 'PASS  branch protection'
echo 'PASS: selected tech/github/codex checks, semantic managed policy, installed identity, refusal cases and fake probe dispatch'

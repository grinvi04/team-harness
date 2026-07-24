#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DOCTOR="$ROOT/scripts/harness-doctor.sh"
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
[ "${DOCTOR_FAIL:-}" != gh ] || exit 1
echo 'owner/repo'
SH
chmod +x "$TMP/bin/codex" "$TMP/bin/gh"

BROKEN_PLUGIN_ROOT="$TMP/broken-plugin"
mkdir -p "$BROKEN_PLUGIN_ROOT"
export PATH="$TMP/bin:$PATH"
export HARNESS_ROOT="$FAKE_ROOT"
export NATIVE_PLUGIN_ROOT BROKEN_PLUGIN_ROOT
export DOCTOR_CALLS="$TMP/calls"
touch "$DOCTOR_CALLS"

out=$(bash "$DOCTOR" --repo "$ROOT")
printf '%s\n' "$out" | grep -Fq 'PASS  managed requirements'
printf '%s\n' "$out" | grep -Fq 'PASS  harness-guard plugin 1.2.3'
printf '%s\n' "$out" | grep -Fq 'PASS  Codex native plugin contract'
printf '%s\n' "$out" | grep -Fq 'PASS  repo sync'
printf '%s\n' "$out" | grep -Fq 'PASS  branch protection'
printf '%s\n' "$out" | grep -Fq 'SKIP  fresh-session probe (use --probe)'
[ ! -s "$DOCTOR_CALLS" ] || { echo 'FAIL: default doctor invoked model probe'; exit 1; }

out=$(bash "$DOCTOR" --repo "$ROOT" --probe)
printf '%s\n' "$out" | grep -Fq 'PASS  fresh-session probe'
[ "$(wc -l <"$DOCTOR_CALLS" | tr -d ' ')" = 1 ] || { echo 'FAIL: --probe did not invoke smoke exactly once'; exit 1; }

if DOCTOR_INSTALLED_VERSION=1.2.2 bash "$DOCTOR" --repo "$ROOT" >"$TMP/version.out" 2>&1; then
  echo 'FAIL: doctor accepted stale plugin version'
  exit 1
fi
grep -Fq 'FAIL  harness-guard plugin' "$TMP/version.out"

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

echo 'PASS: doctor validates native plugin state, skips model work by default, and propagates failures'

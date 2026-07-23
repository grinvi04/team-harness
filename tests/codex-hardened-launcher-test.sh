#!/usr/bin/env bash
# The launcher must sync and validate the native plugin before it starts Codex.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LAUNCHER="$ROOT/scripts/codex-hardened.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

SOURCE_VERSION=$(node -p "JSON.parse(require('node:fs').readFileSync('$ROOT/plugins/harness-guard/.codex-plugin/plugin.json')).version")
NATIVE_PLUGIN_ROOT="$TMP/native-plugin"
SECURITY_CACHE="$TMP/.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json"
SECURITY_SNAPSHOT="$TMP/.codex/.tmp/marketplaces/claude-plugins-official/plugins/security-guidance/hooks/hooks.json"

mkdir -p "$NATIVE_PLUGIN_ROOT"
cp -R "$ROOT/plugins/harness-guard/.codex-plugin" "$NATIVE_PLUGIN_ROOT/"
cp -R "$ROOT/plugins/harness-guard/codex" "$NATIVE_PLUGIN_ROOT/"

for hooks in "$SECURITY_CACHE" "$SECURITY_SNAPSHOT"; do
  mkdir -p "$(dirname "$hooks")"
  cat >"$hooks" <<'JSON'
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh\" start.py" }]
    }]
  }
}
JSON
done

mkdir -p "$TMP/.codex"
cat >"$TMP/.codex/config.toml" <<'TOML'
approval_policy = "untrusted"

[plugins."security-guidance@claude-plugins-official"]
enabled = false
TOML

cat >"$TMP/fake-codex" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "plugin list --json" ]]; then
  if [[ "${SYNC_FAIL:-}" == "1" ]]; then
    echo "sync failed" >&2
    exit 8
  fi
  printf '%s\n' "$*" >>"$HOME/plugin-list-invocations"
  printf '{"installed":[{"pluginId":"harness-guard@team-harness","version":"%s","enabled":true,"source":{"source":"local","path":"%s"}}]}\n' "$SOURCE_VERSION" "$NATIVE_PLUGIN_ROOT"
  exit 0
fi
node - "$HOME" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const home = process.argv[2];
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
for (const relative of [
  '.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json',
  '.codex/.tmp/marketplaces/claude-plugins-official/plugins/security-guidance/hooks/hooks.json',
]) {
  const hooks = JSON.parse(fs.readFileSync(path.join(home, relative), 'utf8'));
  if (!hooks.hooks.SessionStart[0].hooks[0].command.includes('codex-security-guidance-adapter.mjs')) fail(`security patch missing: ${relative}`);
}
if (!fs.readFileSync(path.join(home, '.codex/config.toml'), 'utf8').includes('enabled = true')) fail('security-guidance was not enabled');
NODE
printf '%s\n' "$@" >"$HOME/invocation"
SH
chmod +x "$TMP/fake-codex"

HOME="$TMP" SOURCE_VERSION="$SOURCE_VERSION" NATIVE_PLUGIN_ROOT="$NATIVE_PLUGIN_ROOT" CODEX_BIN="$TMP/fake-codex" bash "$LAUNCHER" --version
if [[ "$(cat "$TMP/invocation")" != '--version' ]]; then
  echo "FAIL: launcher changed Codex arguments or disabled unified_exec"
  exit 1
fi
if [[ "$(wc -l <"$TMP/plugin-list-invocations" | tr -d ' ')" -lt 2 ]]; then
  echo "FAIL: launcher did not sync and validate the installed plugin"
  exit 1
fi

rm "$TMP/invocation"
if HOME="$TMP" SYNC_FAIL=1 SOURCE_VERSION="$SOURCE_VERSION" NATIVE_PLUGIN_ROOT="$NATIVE_PLUGIN_ROOT" CODEX_BIN="$TMP/fake-codex" bash "$LAUNCHER" --version >"$TMP/sync-fail.out" 2>"$TMP/sync-fail.err"; then
  echo "FAIL: plugin sync failure allowed Codex to start"
  exit 1
fi
[[ ! -e "$TMP/invocation" ]] || { echo "FAIL: Codex ran after sync failure"; exit 1; }

BROKEN_PLUGIN_ROOT="$TMP/broken-plugin"
mkdir -p "$BROKEN_PLUGIN_ROOT/.codex-plugin"
cp "$NATIVE_PLUGIN_ROOT/.codex-plugin/plugin.json" "$BROKEN_PLUGIN_ROOT/.codex-plugin/"
if HOME="$TMP" SOURCE_VERSION="$SOURCE_VERSION" NATIVE_PLUGIN_ROOT="$BROKEN_PLUGIN_ROOT" CODEX_BIN="$TMP/fake-codex" bash "$LAUNCHER" --version >"$TMP/native-fail.out" 2>"$TMP/native-fail.err"; then
  echo "FAIL: broken native contract allowed Codex to start"
  exit 1
fi
[[ ! -e "$TMP/invocation" ]] || { echo "FAIL: Codex ran after native validation failure"; exit 1; }

for document in "$ROOT/README.md" "$ROOT/docs/onboarding.md" "$ROOT/docs/harness-maintenance.md"; do
  grep -Fq 'scripts/codex-hardened.sh --version' "$document" || { echo "FAIL: update command missing from ${document#"$ROOT"/}"; exit 1; }
  grep -Fq 'scripts/harness-doctor.sh --repo . --probe' "$document" || { echo "FAIL: post-update probe missing from ${document#"$ROOT"/}"; exit 1; }
done

echo "PASS: hardened launcher syncs and validates native Codex state without disabling unified_exec"

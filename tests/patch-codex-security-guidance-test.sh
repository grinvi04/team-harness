#!/usr/bin/env bash
# Codex refreshes plugin caches from its marketplace snapshot, so both copies
# must receive the security-guidance adapter patch.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PATCHER="$ROOT/plugins/harness-guard/scripts/patch-codex-security-guidance.mjs"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

for hooks in \
  "$TMP/.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json" \
  "$TMP/.codex/.tmp/marketplaces/claude-plugins-official/plugins/security-guidance/hooks/hooks.json"; do
  mkdir -p "$(dirname "$hooks")"
  cat >"$hooks" <<'JSON'
{
  "hooks": {
    "SessionStart": [{"hooks": [{"type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh\" \"${CLAUDE_PLUGIN_ROOT}/hooks/ensure_agent_sdk.py\""}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh\" \"${CLAUDE_PLUGIN_ROOT}/hooks/security_reminder_hook.py\"", "asyncRewake": true, "rewakeMessage": "old", "rewakeSummary": "old"}]}]
  }
}
JSON
done

cat >"$TMP/.codex/config.toml" <<'TOML'
[plugins."security-guidance@claude-plugins-official"]
enabled = false
TOML

HOME="$TMP" node "$PATCHER" --dry-run >"$TMP/dry.json"
HOME="$TMP" node "$PATCHER" >"$TMP/result.json"

node - "$TMP" <<'NODE'
const fs = require('node:fs');
const root = process.argv[2];
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
const dry = JSON.parse(fs.readFileSync(`${root}/dry.json`, 'utf8'));
const result = JSON.parse(fs.readFileSync(`${root}/result.json`, 'utf8'));
if (dry.hooks.changedFiles !== 2 || result.hooks.changedFiles !== 2) fail('both Codex hook copies were not patched');
for (const path of [
  `${root}/.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json`,
  `${root}/.codex/.tmp/marketplaces/claude-plugins-official/plugins/security-guidance/hooks/hooks.json`,
]) {
  const hooks = JSON.parse(fs.readFileSync(path, 'utf8'));
  for (const group of Object.values(hooks.hooks).flat()) {
    for (const hook of group.hooks) {
      if (!hook.command.includes('codex-security-guidance-adapter.mjs')) fail(`${path} command bypasses adapter`);
      if ('asyncRewake' in hook || 'rewakeMessage' in hook || 'rewakeSummary' in hook) fail(`${path} Claude-only async field remains`);
    }
  }
}
if (!fs.readFileSync(`${root}/.codex/config.toml`, 'utf8').includes('enabled = true')) fail('security-guidance was not enabled');
console.log('PASS: Codex cache와 marketplace snapshot 모두 security-guidance adapter로 패치');
NODE

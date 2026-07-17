#!/usr/bin/env bash
# The launcher must repair both Codex plugin caches before it starts Codex.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LAUNCHER="$ROOT/scripts/codex-hardened.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

SOURCE_VERSION=$(node -p "JSON.parse(require('node:fs').readFileSync('$ROOT/plugins/harness-guard/.claude-plugin/plugin.json')).version")
HARNESS_ROOT="$TMP/.codex/plugins/cache/team-harness/harness-guard/$SOURCE_VERSION"
SECURITY_CACHE="$TMP/.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json"
SECURITY_SNAPSHOT="$TMP/.codex/.tmp/marketplaces/claude-plugins-official/plugins/security-guidance/hooks/hooks.json"

mkdir -p "$HARNESS_ROOT/hooks" "$HARNESS_ROOT/scripts" "$HARNESS_ROOT/codex/agents" "$HARNESS_ROOT/codex/skill-overlays"
cp -R "$ROOT/plugins/harness-guard/skills" "$HARNESS_ROOT/"
cp "$ROOT/plugins/harness-guard/scripts/codex-pretool-guard.mjs" "$HARNESS_ROOT/scripts/"
cp "$ROOT/plugins/harness-guard/scripts/guard.sh" "$HARNESS_ROOT/scripts/"
cp -R "$ROOT/plugins/harness-guard/codex/agents/." "$HARNESS_ROOT/codex/agents/"
cp -R "$ROOT/plugins/harness-guard/codex/skill-overlays/." "$HARNESS_ROOT/codex/skill-overlays/"

cat >"$HARNESS_ROOT/hooks/hooks.json" <<'JSON'
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [
        { "type": "command", "command": "bash guard.sh" },
        { "type": "prompt", "prompt": "secret review" }
      ]
    }]
  }
}
JSON

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

mkdir -p "$TMP/.claude/plugins/cache/claude-plugins-official/security-guidance"
printf '%s\n' 'Claude cache sentinel' >"$TMP/.claude/plugins/cache/claude-plugins-official/security-guidance/sentinel"
SOURCE_SKILL="$ROOT/plugins/harness-guard/skills/repo-sync/SKILL.md"
SOURCE_SKILL_BEFORE=$(cksum "$SOURCE_SKILL")

cat >"$TMP/fake-codex" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "plugin list --json" ]]; then
  if [[ "${SYNC_FAIL:-}" == "1" ]]; then
    echo "sync failed" >&2
    exit 8
  fi
  if ! grep -q '"type": "prompt"' "$HOME/.codex/plugins/cache/team-harness/harness-guard/$SOURCE_VERSION/hooks/hooks.json"; then
    echo "FAIL: cache patch ran before plugin version sync" >&2
    exit 1
  fi
  printf '%s\n' "$*" >"$HOME/sync-invocation"
  printf '{"installed":[{"pluginId":"harness-guard@team-harness","version":"%s"}]}\n' "$SOURCE_VERSION"
  exit 0
fi
node - "$HOME" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const home = process.argv[2];
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
const harness = JSON.parse(fs.readFileSync(path.join(home, `.codex/plugins/cache/team-harness/harness-guard/${process.env.SOURCE_VERSION}/hooks/hooks.json`), 'utf8'));
const preTool = harness.hooks.PreToolUse[0].hooks;
if (preTool.length !== 1 || !preTool[0].command.endsWith('/scripts/codex-pretool-guard.mjs')) fail('harness patch did not finish before Codex');
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

HOME="$TMP" SOURCE_VERSION="$SOURCE_VERSION" CODEX_BIN="$TMP/fake-codex" bash "$LAUNCHER" --version
if [[ "$(cat "$TMP/invocation")" != $'--disable\nunified_exec\n--version' ]]; then
  echo "FAIL: launcher did not disable unified_exec before preserving Codex arguments"
  exit 1
fi
if [[ "$(cat "$TMP/sync-invocation")" != "plugin list --json" ]]; then
  echo "FAIL: launcher skipped plugin cache version sync"
  exit 1
fi
if [[ "$(cksum "$SOURCE_SKILL")" != "$SOURCE_SKILL_BEFORE" ]]; then
  echo "FAIL: launcher modified the Claude source skill"
  exit 1
fi
if [[ "$(cat "$TMP/.claude/plugins/cache/claude-plugins-official/security-guidance/sentinel")" != "Claude cache sentinel" ]]; then
  echo "FAIL: launcher modified the Claude cache"
  exit 1
fi

rm "$TMP/invocation"
if HOME="$TMP" SYNC_FAIL=1 SOURCE_VERSION="$SOURCE_VERSION" CODEX_BIN="$TMP/fake-codex" bash "$LAUNCHER" --version >"$TMP/sync-fail.out" 2>"$TMP/sync-fail.err"; then
  echo "FAIL: plugin sync failure allowed Codex to start"
  exit 1
fi
if [[ -e "$TMP/invocation" ]]; then
  echo "FAIL: Codex binary ran after plugin sync failure"
  exit 1
fi

FAIL_HOME=$(mktemp -d)
trap 'rm -rf "$TMP" "$FAIL_HOME"' EXIT
mkdir -p "$FAIL_HOME/.codex"
printf '%s\n' 'approval_policy = "untrusted"' >"$FAIL_HOME/.codex/config.toml"
if HOME="$FAIL_HOME" SOURCE_VERSION="$SOURCE_VERSION" CODEX_BIN="$TMP/fake-codex" bash "$LAUNCHER" --version >"$FAIL_HOME/out" 2>"$FAIL_HOME/err"; then
  echo "FAIL: missing cache allowed Codex to start"
  exit 1
fi
if [[ -e "$FAIL_HOME/invocation" ]]; then
  echo "FAIL: Codex binary ran after a patch failure"
  exit 1
fi

for document in "$ROOT/README.md" "$ROOT/docs/onboarding.md" "$ROOT/docs/harness-maintenance.md"; do
  if ! grep -Fq 'scripts/codex-hardened.sh --version' "$document"; then
    echo "FAIL: Codex update command missing from ${document#"$ROOT"/}"
    exit 1
  fi
  if ! grep -Fq 'scripts/harness-doctor.sh --repo . --probe' "$document"; then
    echo "FAIL: Codex post-update probe missing from ${document#"$ROOT"/}"
    exit 1
  fi
done

echo "PASS: hardened launcher patches both Codex caches, fails closed, and has one documented update path"

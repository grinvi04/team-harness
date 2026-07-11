#!/usr/bin/env bash
# Keep the installed harness-guard cache aligned with the repository manifest.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SYNC="$ROOT/scripts/sync-codex-plugin-cache.mjs"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
FAKE_CODEX="$TMP/codex"
LOG="$TMP/calls.log"
SOURCE_VERSION=$(node -p "JSON.parse(require('node:fs').readFileSync('$ROOT/plugins/harness-guard/.claude-plugin/plugin.json')).version")

cat >"$FAKE_CODEX" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$CALL_LOG"

case "$*" in
  "plugin list --json")
    version="$SOURCE_VERSION"
    [[ "$FAKE_MODE" == "stale" || "$FAKE_MODE" == "upgrade-fail" || "$FAKE_MODE" == "stale-add" ]] && version="0.1.0"
    printf '{"installed":[{"pluginId":"harness-guard@team-harness","version":"%s"}]}\n' "$version"
    ;;
  "plugin marketplace upgrade team-harness --json")
    if [[ "$FAKE_MODE" == "upgrade-fail" ]]; then
      echo "upgrade failed" >&2
      exit 7
    fi
    printf '{"selectedMarketplaces":["team-harness"],"errors":[]}\n'
    ;;
  "plugin add harness-guard@team-harness --json")
    version="$SOURCE_VERSION"
    [[ "$FAKE_MODE" == "stale-add" ]] && version="0.2.0"
    printf '{"pluginId":"harness-guard@team-harness","version":"%s"}\n' "$version"
    ;;
  *)
    echo "unexpected command: $*" >&2
    exit 9
    ;;
esac
SH
chmod +x "$FAKE_CODEX"

run_sync() {
  local mode="$1" output="$2"
  : >"$LOG"
  CALL_LOG="$LOG" FAKE_MODE="$mode" SOURCE_VERSION="$SOURCE_VERSION" CODEX_BIN="$FAKE_CODEX" \
    node "$SYNC" >"$output" 2>"$output.err"
}

run_sync current "$TMP/current.json"
node - "$TMP/current.json" "$SOURCE_VERSION" <<'NODE'
const fs = require('node:fs');
const [file, version] = process.argv.slice(2);
const result = JSON.parse(fs.readFileSync(file, 'utf8'));
if (result.changed !== false || result.sourceVersion !== version || result.installedVersion !== version) process.exit(1);
NODE
if [[ "$(cat "$LOG")" != "plugin list --json" ]]; then
  echo "FAIL: current cache triggered a network update"
  exit 1
fi
echo "PASS: current cache skips marketplace network update"

run_sync stale "$TMP/stale.json"
node - "$TMP/stale.json" "$SOURCE_VERSION" <<'NODE'
const fs = require('node:fs');
const [file, version] = process.argv.slice(2);
const result = JSON.parse(fs.readFileSync(file, 'utf8'));
if (result.changed !== true || result.sourceVersion !== version || result.installedVersion !== version) process.exit(1);
NODE
EXPECTED=$(printf '%s\n' \
  'plugin list --json' \
  'plugin marketplace upgrade team-harness --json' \
  'plugin add harness-guard@team-harness --json')
if [[ "$(cat "$LOG")" != "$EXPECTED" ]]; then
  echo "FAIL: stale cache update order is incorrect"
  exit 1
fi
echo "PASS: stale cache upgrades only team-harness before reinstall"

if run_sync upgrade-fail "$TMP/upgrade-fail.json"; then
  echo "FAIL: marketplace upgrade failure was ignored"
  exit 1
fi
if [[ "$(cat "$LOG")" != $'plugin list --json\nplugin marketplace upgrade team-harness --json' ]]; then
  echo "FAIL: plugin add ran after marketplace upgrade failure"
  exit 1
fi
echo "PASS: marketplace failure is fail-closed"

if run_sync stale-add "$TMP/stale-add.json"; then
  echo "FAIL: stale plugin add result was accepted"
  exit 1
fi
echo "PASS: reinstall result version is verified"

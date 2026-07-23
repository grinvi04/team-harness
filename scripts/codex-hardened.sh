#!/usr/bin/env bash
# Sync and validate Codex's native harness plugin before starting the CLI.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
NODE_BIN=${NODE_BIN:-node}
CODEX_BIN=${CODEX_BIN:-codex}
TRUSTED_PLUGIN_ROOT="$ROOT/plugins/harness-guard"
EXPECTED_VERSION=$("$NODE_BIN" -e '
const fs = require("node:fs")
const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
if (typeof manifest.version !== "string" || manifest.version === "") process.exit(1)
process.stdout.write(manifest.version)
' "$TRUSTED_PLUGIN_ROOT/.codex-plugin/plugin.json")

"$NODE_BIN" "$ROOT/scripts/sync-codex-plugin-cache.mjs"
"$NODE_BIN" "$ROOT/scripts/check-codex-native-plugin.mjs" \
  --expected-version "$EXPECTED_VERSION" \
  --trusted-root "$TRUSTED_PLUGIN_ROOT"
"$NODE_BIN" "$ROOT/plugins/harness-guard/scripts/patch-codex-security-guidance.mjs"

exec "$CODEX_BIN" "$@"

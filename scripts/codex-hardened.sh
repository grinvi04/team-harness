#!/usr/bin/env bash
# Sync and validate Codex's native harness plugin before starting the CLI.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
NODE_BIN=${NODE_BIN:-node}
CODEX_BIN=${CODEX_BIN:-codex}

"$NODE_BIN" "$ROOT/scripts/sync-codex-plugin-cache.mjs"
"$NODE_BIN" "$ROOT/scripts/check-codex-native-plugin.mjs"
"$NODE_BIN" "$ROOT/plugins/harness-guard/scripts/patch-codex-security-guidance.mjs"

exec "$CODEX_BIN" "$@"

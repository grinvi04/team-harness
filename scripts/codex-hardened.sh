#!/usr/bin/env bash
# Repair Codex's Claude-plugin compatibility cache before starting the CLI.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
NODE_BIN=${NODE_BIN:-node}
CODEX_BIN=${CODEX_BIN:-codex}

"$NODE_BIN" "$ROOT/scripts/sync-codex-plugin-cache.mjs"
"$NODE_BIN" "$ROOT/plugins/harness-guard/scripts/patch-codex-harness-guard.mjs"
"$NODE_BIN" "$ROOT/plugins/harness-guard/scripts/patch-codex-security-guidance.mjs"

exec "$CODEX_BIN" "$@"

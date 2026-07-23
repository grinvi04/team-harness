#!/usr/bin/env bash
# Sync and validate Codex's native harness plugin before starting the CLI.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
NODE_BIN=${NODE_BIN:-node}
FIXTURE_MODE=${HARNESS_HARDENED_FIXTURE:-0}
if [[ -n "${CODEX_BIN:-}" && "$FIXTURE_MODE" != "1" ]]; then
  echo "codex-hardened: CODEX_BIN requires HARNESS_HARDENED_FIXTURE=1" >&2
  exit 2
fi
CODEX_CANDIDATE=${CODEX_BIN:-codex}
TRUSTED_BINARIES="$ROOT/docs/pilots/codex-native-loader-trusted-binaries.json"
TRUST_ARGS=(
  --candidate "$CODEX_CANDIDATE"
  --trusted-binaries "$TRUSTED_BINARIES"
)
if [[ "$FIXTURE_MODE" == "1" ]]; then
  TRUST_ARGS+=(--fixture)
fi
TRUST_JSON=$("$NODE_BIN" "$ROOT/scripts/codex-binary-trust.mjs" "${TRUST_ARGS[@]}")
CODEX_BIN=$("$NODE_BIN" -e '
const trust = JSON.parse(process.argv[1])
if (typeof trust.path !== "string" || trust.path === "") process.exit(1)
process.stdout.write(trust.path)
' "$TRUST_JSON")
HARNESS_CODEX_EXPECTED_DIGEST=$("$NODE_BIN" -e '
const trust = JSON.parse(process.argv[1])
if (!/^sha256:[a-f0-9]{64}$/.test(trust.digest)) process.exit(1)
process.stdout.write(trust.digest)
' "$TRUST_JSON")
export CODEX_BIN HARNESS_CODEX_EXPECTED_DIGEST
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

exec "$NODE_BIN" "$ROOT/scripts/codex-binary-trust.mjs" \
  "${TRUST_ARGS[@]}" \
  --expected-digest "$HARNESS_CODEX_EXPECTED_DIGEST" \
  --execute -- "$@"

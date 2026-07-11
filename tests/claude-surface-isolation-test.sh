#!/usr/bin/env bash
# Codex compatibility must not mutate the Claude-facing source contract.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/tests/fixtures/claude-surface.sha256"

cd "$ROOT"
shasum -a 256 -c "$MANIFEST"

if rg -n '## Codex 실행|CODEX_PLUGIN_ROOT|HARNESS_GUARD_LOG|HARNESS_AGENT_NAME' \
  plugins/harness-guard/hooks \
  plugins/harness-guard/skills \
  plugins/harness-guard/agents \
  plugins/harness-guard/scripts/guard.sh \
  plugins/harness-guard/scripts/enforce-subagent-model.py; then
  echo 'FAIL: Codex 전용 계약이 Claude-facing source에 섞임'
  exit 1
fi

echo 'PASS: Claude-facing source hash·경계 불변'

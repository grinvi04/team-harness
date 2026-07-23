#!/usr/bin/env bash
# Codex compatibility must not mutate the Claude-facing source contract.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/tests/fixtures/claude-surface.sha256"

cd "$ROOT"
shasum -a 256 -c "$MANIFEST"

if rg -n '## Codex 실행|CODEX_PLUGIN_ROOT|Codex가 대신' \
  plugins/harness-guard/hooks \
  plugins/harness-guard/skills \
  plugins/harness-guard/agents \
  plugins/harness-guard/scripts/guard.sh \
  plugins/harness-guard/scripts/enforce-subagent-model.py; then
  echo 'FAIL: Codex 전용 계약이 Claude-facing source에 섞임'
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
set +e
printf '%s' '{"tool_name":"Bash","session_id":"claude-default","cwd":"/repo","tool_input":{"command":"git reset --hard"}}' \
  | HOME="$TMP" bash "$ROOT/plugins/harness-guard/scripts/guard.sh" >"$TMP/out" 2>"$TMP/err"
status=$?
set -e
if [ "$status" != 2 ] \
  || ! grep -q 'Claude가 대신 실행하지 않음' "$TMP/err" \
  || ! grep -q 'session=claude-default.*DENY' "$TMP/.claude/hooks/guard-block.log"; then
  echo 'FAIL: Claude runtime default contract changed'
  exit 1
fi

echo 'PASS: Claude-facing source hash·경계와 runtime 기본값 불변'

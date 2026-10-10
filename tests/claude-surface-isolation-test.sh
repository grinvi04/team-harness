#!/usr/bin/env bash
# Pin the approved native Claude contract; Codex adaptation must preserve it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/tests/fixtures/claude-surface.sha256"

cd "$ROOT"
shasum -a 256 -c "$MANIFEST"

search_status=0
rg -n '## Codex 실행|CODEX_PLUGIN_ROOT|Codex가 대신' \
  plugins/harness-guard/hooks \
  plugins/harness-guard/skills \
  plugins/harness-guard/agents \
  plugins/harness-guard/runtime-path.md \
  plugins/harness-guard/scripts/resolve-skill-root.mjs \
  plugins/harness-guard/scripts/guard.sh \
  plugins/harness-guard/scripts/enforce-subagent-model.py || search_status=$?
if [ "$search_status" -ne 1 ]; then
  echo "FAIL: Claude-facing source 격리 위반 또는 검색 실패(status=$search_status)"
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

echo 'PASS: Claude-facing 현재 승인 source hash·경계와 runtime 기본값 보존'

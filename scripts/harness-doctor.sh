#!/usr/bin/env bash
# Read-only aggregate health check for a team-harness clone and its current repo.
set -uo pipefail

ROOT=${HARNESS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
REPO=$(pwd)
RUN_PROBE=false
CODEX_BIN=${CODEX_BIN:-codex}
GH_BIN=${GH_BIN:-gh}
NODE_BIN=${NODE_BIN:-node}
PYTHON_BIN=${PYTHON_BIN:-python3}
failures=0
TMP=$(mktemp -d "${TMPDIR:-/tmp}/team-harness-doctor.XXXXXX") || exit 1
trap 'rm -rf "$TMP"' EXIT

usage() {
  echo "usage: $0 [--repo <path>] [--probe]" >&2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --repo) [ $# -ge 2 ] || { usage; exit 2; }; REPO=$2; shift 2;;
    --probe) RUN_PROBE=true; shift;;
    -h|--help) usage; exit 0;;
    *) usage; exit 2;;
  esac
done

REPO=$(cd "$REPO" 2>/dev/null && pwd) || { echo "FAIL  repo path: $REPO"; exit 1; }

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; failures=$((failures + 1)); }
detail() { sed 's/^/      /' "$1"; }

run_check() {
  local label=$1; shift
  local output="$TMP/check-$RANDOM.out"
  if "$@" >"$output" 2>&1; then
    pass "$label"
    detail "$output"
  else
    fail "$label"
    detail "$output"
  fi
}

echo "team-harness doctor — repo: $REPO"

run_check 'managed requirements' \
  bash "$ROOT/scripts/install-codex-managed-requirements.sh" --check

codex_version=$($CODEX_BIN --version 2>"$TMP/codex-version.err")
if [ $? -eq 0 ] && [ -n "$codex_version" ]; then
  pass "$codex_version"
else
  fail 'Codex CLI unavailable'
  detail "$TMP/codex-version.err"
fi

manifest="$ROOT/plugins/harness-guard/.claude-plugin/plugin.json"
expected=$($PYTHON_BIN -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$manifest" 2>"$TMP/manifest.err")
plugin_json=$($CODEX_BIN plugin list --json 2>"$TMP/plugin.err")
if [ -n "$expected" ] && [ -n "$plugin_json" ]; then
  plugin_result=$(printf '%s' "$plugin_json" | "$PYTHON_BIN" -c '
import json, sys
expected = sys.argv[1]
data = json.load(sys.stdin)
plugin = next((p for p in data.get("installed", []) if p.get("pluginId") == "harness-guard@team-harness"), None)
if not plugin:
    print("missing")
    raise SystemExit(1)
if plugin.get("enabled") is not True:
    print("disabled (installed={}, expected={})".format(plugin.get("version"), expected))
    raise SystemExit(1)
if plugin.get("version") != expected:
    print("version mismatch (installed={}, expected={})".format(plugin.get("version"), expected))
    raise SystemExit(1)
print(expected)
' "$expected" 2>"$TMP/plugin-parse.err")
  if [ $? -eq 0 ]; then pass "harness-guard plugin $plugin_result"; else fail "harness-guard plugin $plugin_result"; fi
else
  fail 'harness-guard plugin status unavailable'
  detail "$TMP/manifest.err"
  detail "$TMP/plugin.err"
fi

cache_json=$($NODE_BIN "$ROOT/plugins/harness-guard/scripts/patch-codex-harness-guard.mjs" --dry-run 2>"$TMP/cache.err")
if [ -n "$cache_json" ]; then
  cache_result=$(printf '%s' "$cache_json" | "$PYTHON_BIN" -c '
import json, sys
data = json.load(sys.stdin)
pending = {
    "hooks": int(bool(data.get("hooks", {}).get("changedFile"))),
    "skills": int(data.get("skills", {}).get("changedFiles", 0)),
    "guard": int(bool(data.get("guard", {}).get("changedFile"))),
    "agents": int(data.get("agents", {}).get("changedFiles", 0)),
}
print(", ".join(f"{name}={count}" for name, count in pending.items()))
raise SystemExit(1 if any(pending.values()) else 0)
' 2>"$TMP/cache-parse.err")
  if [ $? -eq 0 ]; then
    pass "Codex harness cache patch ($cache_result)"
  else
    fail "Codex harness cache patch pending ($cache_result)"
    echo "      repair: bash $ROOT/scripts/codex-hardened.sh --version"
  fi
else
  fail 'Codex harness cache patch status unavailable'
  detail "$TMP/cache.err"
fi

run_check 'repo sync' \
  "$NODE_BIN" "$ROOT/plugins/harness-guard/scripts/check-repo-sync.mjs" --repo "$REPO" --harness "$ROOT"

repo_name=$(cd "$REPO" && "$GH_BIN" repo view --json nameWithOwner --jq .nameWithOwner 2>"$TMP/gh.err")
if [ -n "$repo_name" ]; then
  run_check 'branch protection' \
    bash "$ROOT/plugins/harness-guard/scripts/set-branch-protection.sh" "$repo_name" --check
else
  fail 'branch protection (GitHub repo unavailable)'
  detail "$TMP/gh.err"
fi

if $RUN_PROBE; then
  run_check 'fresh-session probe' bash "$ROOT/scripts/codex-fresh-session-smoke.sh"
else
  echo 'SKIP  fresh-session probe (use --probe)'
fi

if [ "$failures" -eq 0 ]; then
  echo 'RESULT healthy'
  exit 0
fi
echo "RESULT unhealthy ($failures failed checks)"
exit 1

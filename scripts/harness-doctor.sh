#!/usr/bin/env bash
# Read-only checks for explicitly adopted components; no installation or repair.
set -uo pipefail
ROOT=${HARNESS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
REPO=$(pwd)
RUN_PROBE=false
COMPONENTS=tech,github,codex
LEGACY=true
BRANCHES=main,develop
EXPECTED_VERSION=""
CODEX_BIN=${CODEX_BIN:-codex}
GH_BIN=${GH_BIN:-gh}
NODE_BIN=${NODE_BIN:-node}
PYTHON_BIN=${PYTHON_BIN:-python3}
failures=0
TMP=$(mktemp -d "${TMPDIR:-/tmp}/team-harness-doctor.XXXXXX") || exit 1
trap 'rm -rf "$TMP"' EXIT
usage() {
  echo "usage: $0 [--repo <path>] [--components tech|github|codex[, ...]] [--branches main|main,develop] [--expected-version <version>] [--probe]" >&2
}
while [ $# -gt 0 ]; do
  case "$1" in
    --repo|--components|--branches|--expected-version)
      [ $# -ge 2 ] && [[ "$2" != --* ]] || { usage; exit 2; }
      case "$1" in
        --repo) REPO=$2;;
        --components) COMPONENTS=$2; LEGACY=false;;
        --branches) BRANCHES=$2;;
        --expected-version) EXPECTED_VERSION=$2;;
      esac
      shift 2;;
    --probe) RUN_PROBE=true; shift;;
    -h|--help) usage; exit 0;;
    *) usage; exit 2;;
  esac
done
case "$BRANCHES" in main|main,develop) ;; *) usage; exit 2;; esac
case "$COMPONENTS" in ''|,*|*,|*,,*) usage; exit 2;; esac
IFS=',' read -r -a selected <<<"$COMPONENTS"
seen=,
for component in "${selected[@]}"; do
  case "$component" in tech|github|codex) ;; *) usage; exit 2;; esac
  case "$seen" in *",$component,"*) usage; exit 2;; esac
  seen="$seen$component,"
done
has_component() { case ",$COMPONENTS," in *",$1,"*) return 0;; *) return 1;; esac; }
if { $RUN_PROBE || [ -n "$EXPECTED_VERSION" ]; } && ! has_component codex; then
  echo '--probe and --expected-version require the codex component' >&2; exit 2
fi
REPO=$(cd "$REPO" 2>/dev/null && pwd) || { echo "FAIL  repo path: $REPO"; exit 1; }
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; failures=$((failures + 1)); }
unverified() { echo "UNVERIFIED  $1"; failures=$((failures + 1)); }
detail() { sed 's/^/      /' "$1"; }
run_check() {
  local label=$1; shift
  local output="$TMP/check-$RANDOM.out"
  if "$@" >"$output" 2>&1; then pass "$label"; else fail "$label"; fi
  detail "$output"
}
check_tech() {
  if [ ! -e "$REPO/.harness-assets.json" ] && [ ! -L "$REPO/.harness-assets.json" ]; then
    unverified 'adopted tech assets (ownership manifest missing)'; return
  fi
  run_check 'adopted tech assets' "$NODE_BIN" - "$REPO" <<'NODE'
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
try {
  const root = process.argv[2]
  const pathKey = value => value.normalize('NFC').toLowerCase()
  const safePath = relative => {
    if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || /[\\\x00-\x1f\x7f]/.test(relative) || relative.split('/').some(p => !p || p === '.' || p === '..' || pathKey(p) === '.git')) throw new Error('unsafe ownership path')
    let current = root
    for (const part of relative.split('/')) {
      current = path.join(current, part)
      const stat = fs.lstatSync(current)
      if (stat.isSymbolicLink()) throw new Error('ownership path symlink')
      if (stat.isDirectory() && fs.existsSync(path.join(current, '.git'))) throw new Error('nested Git ownership path')
    }
    const stat = fs.lstatSync(current)
    if (!stat.isFile() || stat.nlink !== 1) throw new Error('ownership path must be a regular unshared file')
    return current
  }
  const state = JSON.parse(fs.readFileSync(safePath('.harness-assets.json')))
  if (state.schemaVersion !== 1 || !/^[0-9a-f]{40}$/.test(state.source?.sha || '') || typeof state.source?.version !== 'string' || !state.source.version || !Array.isArray(state.assets) || !state.assets.length) throw new Error('invalid ownership manifest')
  const destinations = new Set()
  for (const asset of state.assets) {
    if (typeof asset.destination !== 'string' || asset.destination.split('/').some(p => pathKey(p) === '.harness-assets.json') || destinations.has(pathKey(asset.destination)) || [...destinations].some(p => p.startsWith(`${pathKey(asset.destination)}/`) || pathKey(asset.destination).startsWith(`${p}/`)) || !/^[0-9a-f]{64}$/.test(asset.hash || '') || ![420,493].includes(asset.mode) || typeof asset.source !== 'string' || !asset.source) throw new Error('invalid asset baseline')
    destinations.add(pathKey(asset.destination))
    const file = safePath(asset.destination)
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    if (hash !== asset.hash || (fs.statSync(file).mode & 0o777) !== asset.mode) throw new Error(`modified managed asset: ${asset.destination}`)
  }
  console.log(`recorded ${state.assets.length} assets; SHA=${state.source.sha}; version=${state.source.version}`)
} catch (error) { console.error(error.message); process.exitCode = 1 }
NODE
}
check_requirements() {
  run_check 'managed requirements' "$PYTHON_BIN" - "${CODEX_REQUIREMENTS_PATH:-/etc/codex/requirements.toml}" <<'PY'
import sys
try:
    import tomllib
    with open(sys.argv[1], 'rb') as source:
        policy = tomllib.load(source)
    if policy.get('features', {}).get('hooks') is not True:
        raise ValueError('managed features.hooks must be boolean true')
    print('hooks=true; company policy preserved (semantic read-only check)')
except Exception as error:
    print(str(error), file=sys.stderr)
    raise SystemExit(1)
PY
}
check_codex() {
  check_requirements
  local version plugin_json plugin_result
  if version=$("$CODEX_BIN" --version 2>"$TMP/codex-version.err") && [ -n "$version" ]; then pass "$version"
  else fail 'Codex CLI unavailable'; detail "$TMP/codex-version.err"; fi
  if plugin_json=$("$CODEX_BIN" plugin list --json 2>"$TMP/plugin.err") && [ -n "$plugin_json" ]; then
    plugin_result=$(printf '%s' "$plugin_json" | "$PYTHON_BIN" -c '
import json,sys
try:
    data=json.load(sys.stdin)
    plugin=next((p for p in data.get("installed",[]) if p.get("pluginId")=="harness-guard@team-harness"),None)
    if not plugin: raise ValueError("missing")
    if plugin.get("enabled") is not True: raise ValueError("disabled")
    version=plugin.get("version")
    if not isinstance(version,str) or not version: raise ValueError("installed version unavailable")
    if sys.argv[1] and version != sys.argv[1]: raise ValueError("version mismatch (installed={}, expected={})".format(version,sys.argv[1]))
    print(version)
except Exception as error:
    print(str(error)); raise SystemExit(1)
' "$EXPECTED_VERSION" 2>"$TMP/plugin-parse.err")
    if [ $? -eq 0 ]; then pass "harness-guard plugin $plugin_result"; else fail "harness-guard plugin $plugin_result"; detail "$TMP/plugin-parse.err"; fi
  else fail 'harness-guard plugin status unavailable'; detail "$TMP/plugin.err"; fi
  if [ -n "$EXPECTED_VERSION" ]; then
    run_check 'Codex native plugin contract' "$NODE_BIN" "$ROOT/scripts/check-codex-native-plugin.mjs" --expected-version "$EXPECTED_VERSION"
  else
    run_check 'Codex native plugin contract' "$NODE_BIN" "$ROOT/scripts/check-codex-native-plugin.mjs"
  fi
}
check_github() {
  local repo_name output="$TMP/check-branch-protection.out"
  repo_name=$(cd "$REPO" && "$GH_BIN" repo view --json nameWithOwner --jq .nameWithOwner 2>"$TMP/gh.err")
  if [ $? -ne 0 ] || [[ ! "$repo_name" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then fail 'branch protection (GitHub repo unavailable)'; detail "$TMP/gh.err"; return; fi
  if $LEGACY; then
    if bash "$ROOT/plugins/harness-guard/scripts/set-branch-protection.sh" "$repo_name" --check --branches "$BRANCHES" >"$output" 2>&1 && ! grep -Eq '^skip .* \(브랜치 없음/비공개\)$' "$output"; then pass 'branch protection'; else fail 'branch protection'; fi
    detail "$output"
    return
  fi
  local branch
  local branches=()
  IFS=',' read -r -a branches <<<"$BRANCHES"
  for branch in "${branches[@]}"; do
    if "$GH_BIN" api "repos/$repo_name/branches/$branch/protection" >"$output" 2>"$TMP/gh.err" && "$PYTHON_BIN" - "$output" <<'PY'
import json,sys
try:
    with open(sys.argv[1]) as source: data=json.load(source)
    if not isinstance(data,dict): raise ValueError('protection response must be an object')
    admins=data.get('enforce_admins')
    if not isinstance(admins,dict) or not isinstance(admins.get('enabled'),bool): raise ValueError('protection response lacks admin enforcement state')
    if 'required_status_checks' not in data or 'required_pull_request_reviews' not in data: raise ValueError('protection response lacks checks/reviews state')
    checks=data['required_status_checks']
    def context(value):
        return isinstance(value,str) and bool(value.strip())
    if checks is not None:
        if not isinstance(checks,dict) or type(checks.get('strict')) is not bool or not isinstance(checks.get('contexts'),list) or any(not context(x) for x in checks['contexts']):
            raise ValueError('malformed required checks')
        if 'checks' in checks:
            bindings=checks['checks']
            if not isinstance(bindings,list): raise ValueError('checks must be an array')
            for binding in bindings:
                if not isinstance(binding,dict) or not context(binding.get('context')): raise ValueError('malformed check context')
                if 'app_id' in binding and (type(binding['app_id']) is not int or binding['app_id'] < -1): raise ValueError('malformed check app binding')
    def actors(value):
        if not isinstance(value,dict): raise ValueError('actor restrictions must be an object')
        for collection,name in [('users','login'),('teams','slug'),('apps','slug')]:
            entries=value.get(collection)
            if not isinstance(entries,list): raise ValueError('actor collection must be an array')
            for entry in entries:
                if not isinstance(entry,dict) or not context(entry.get(name)):
                    raise ValueError('actor must contain a nonempty name')
    if 'restrictions' in data and data['restrictions'] is not None:
        actors(data['restrictions'])
    reviews=data['required_pull_request_reviews']
    if reviews is not None:
        if not isinstance(reviews,dict) or type(reviews.get('required_approving_review_count')) is not int or not 0 <= reviews['required_approving_review_count'] <= 6:
            raise ValueError('malformed review policy')
        for field in ['dismissal_restrictions','bypass_pull_request_allowances']:
            if field in reviews: actors(reviews[field])
        for flag in ['dismiss_stale_reviews','require_code_owner_reviews','require_last_push_approval']:
            if flag in reviews and type(reviews[flag]) is not bool: raise ValueError('malformed review boolean')
    for flag in ['required_linear_history','allow_force_pushes','allow_deletions','required_conversation_resolution','lock_branch','allow_fork_syncing','required_signatures']:
        if flag in data and (not isinstance(data[flag],dict) or type(data[flag].get('enabled')) is not bool): raise ValueError('malformed protection boolean')
except Exception as error:
    print(str(error),file=sys.stderr); raise SystemExit(1)
PY
    then pass "branch protection ($branch readable; policy enforcement not evaluated)"
    else fail "branch protection ($branch unreadable or malformed)"; detail "$TMP/gh.err"; fi
  done
}
echo "team-harness doctor — repo: $REPO; components: $COMPONENTS"
if has_component tech; then
  if $LEGACY; then run_check 'repo sync' "$NODE_BIN" "$ROOT/plugins/harness-guard/scripts/check-repo-sync.mjs" --repo "$REPO" --harness "$ROOT"
  else check_tech; fi
fi
if has_component codex; then check_codex; fi
if has_component github; then check_github; fi
if has_component codex; then
  if $RUN_PROBE; then
    if [ "$failures" -eq 0 ]; then run_check 'fresh-session probe' bash "$ROOT/scripts/codex-fresh-session-smoke.sh"
    else echo 'UNVERIFIED  fresh-session probe (configuration failed; not executed)'; fi
  else echo 'UNVERIFIED  fresh-session probe (use --probe)'; fi
fi
if [ "$failures" -eq 0 ]; then
  echo 'RESULT healthy (selected configuration checks only; see probe status for native execution)'; exit 0
fi
echo "RESULT unhealthy ($failures failed or unverified configuration checks)"
exit 1

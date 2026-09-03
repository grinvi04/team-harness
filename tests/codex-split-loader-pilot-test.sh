#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
RUNNER="$ROOT/scripts/run-codex-split-loader-pilot.mjs"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
USER_CODEX_HOME="$TMP/user-codex"
mkdir -p "$USER_CODEX_HOME"

cat >"$TMP/fake-codex" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\t%s\n' "$CODEX_HOME" "$*" >>"$FAKE_CALLS"

if [ "$*" = '--version' ]; then
  echo 'codex-cli 0.144.6'
  exit 0
fi

if [ "$*" = 'plugin marketplace list --json' ]; then
  if [ "$CODEX_HOME" = "$USER_CODEX_HOME" ]; then
    count=0
    [ ! -f "$USER_SNAPSHOT_CALLS" ] || count=$(cat "$USER_SNAPSHOT_CALLS")
    count=$((count + 1))
    printf '%s' "$count" >"$USER_SNAPSHOT_CALLS"
    if [ "${FAKE_MODE:-ok}" = user-state-drift ] && [ "$count" -gt 1 ]; then
      echo '{"marketplaces":[{"name":"changed"}]}'
    else
      echo '{"marketplaces":[{"name":"existing","source":"safe"}]}'
    fi
  elif [ -f "$CODEX_HOME/marketplace-root" ]; then
    echo '{"marketplaces":[{"name":"team-harness-split-pilot","source":"local"}]}'
  else
    echo '{"marketplaces":[]}'
  fi
  exit 0
fi

if [ "$*" = 'plugin list --json' ]; then
  if [ "$CODEX_HOME" = "$USER_CODEX_HOME" ]; then
    echo '{"installed":[{"pluginId":"keep@existing","version":"1","enabled":true}],"available":[]}'
  elif [ "${FAKE_MODE:-ok}" = malformed-list ]; then
    echo '{not-json'
  else
    node - "$CODEX_HOME" <<'NODE'
const fs = require('node:fs')
const path = require('node:path')
const home = process.argv[2]
const state = path.join(home, 'installed')
const names = fs.existsSync(state) ? fs.readFileSync(state, 'utf8').trim().split('\n').filter(Boolean) : []
const installed = names.map((name) => {
  const marketplace = 'team-harness-split-pilot'
  const root = fs.readFileSync(path.join(home, 'marketplace-root'), 'utf8').trim()
  const manifest = JSON.parse(fs.readFileSync(path.join(root, name, '.codex-plugin', 'plugin.json'), 'utf8'))
  return {
    pluginId: `${name}@${marketplace}`,
    name,
    marketplaceName: marketplace,
    version: manifest.version,
    installed: true,
    enabled: true,
    source: { source: 'local', path: path.join(root, name) },
  }
})
process.stdout.write(`${JSON.stringify({ installed, available: [] }, null, 2)}\n`)
NODE
  fi
  exit 0
fi

if [ "$1 $2 $3" = 'plugin marketplace add' ]; then
  mkdir -p "$CODEX_HOME"
  printf '%s' "$4" >"$CODEX_HOME/marketplace-root"
  echo '{"marketplaceName":"team-harness-split-pilot","alreadyAdded":false}'
  exit 0
fi

if [ "$*" = 'plugin marketplace remove team-harness-split-pilot --json' ]; then
  rm -f "$CODEX_HOME/marketplace-root"
  echo '{"marketplaceName":"team-harness-split-pilot"}'
  exit 0
fi

if [ "$1 $2" = 'plugin add' ]; then
  selector=$3
  name=${selector%@*}
  if [ "${FAKE_MODE:-ok}" = install-failure ] && [ "$name" = harness-codex-adapter ]; then
    echo 'fixture install failure' >&2
    exit 17
  fi
  marketplace_root=$(cat "$CODEX_HOME/marketplace-root")
  version=$(node -p "JSON.parse(require('node:fs').readFileSync('$marketplace_root/$name/.codex-plugin/plugin.json')).version")
  installed="$CODEX_HOME/plugins/cache/team-harness-split-pilot/$name/$version"
  mkdir -p "$(dirname "$installed")"
  cp -R "$marketplace_root/$name" "$installed"
  printf '%s\n' "$name" >>"$CODEX_HOME/installed"
  if [ "${FAKE_MODE:-ok}" = mutated-cache ]; then
    printf '\nmutation\n' >>"$installed/harness-package.json"
  fi
  if [ "${FAKE_MODE:-ok}" = escaped-installed-path ]; then
    installed="$TMP/escaped-cache"
  fi
  printf '{"pluginId":"%s@team-harness-split-pilot","name":"%s","marketplaceName":"team-harness-split-pilot","version":"%s","installedPath":"%s"}\n' \
    "$name" "$name" "$version" "$installed"
  exit 0
fi

if [ "$1 $2" = 'plugin remove' ]; then
  selector=$3
  name=${selector%@*}
  if [ "${FAKE_MODE:-ok}" = rollback-failure ] && [ "$name" = harness-workflows ]; then
    echo 'fixture rollback failure' >&2
    exit 18
  fi
  if [ -f "$CODEX_HOME/installed" ]; then
    grep -Fvx "$name" "$CODEX_HOME/installed" >"$CODEX_HOME/installed.next" || true
    mv "$CODEX_HOME/installed.next" "$CODEX_HOME/installed"
  fi
  rm -rf "$CODEX_HOME/plugins/cache/team-harness-split-pilot/$name"
  printf '{"pluginId":"%s@team-harness-split-pilot","name":"%s","marketplaceName":"team-harness-split-pilot"}\n' "$name" "$name"
  exit 0
fi

echo "unexpected fake Codex invocation: $*" >&2
exit 19
SH
chmod +x "$TMP/fake-codex"

export CODEX_BIN="$TMP/fake-codex"
export CODEX_HOME="$USER_CODEX_HOME"
export USER_CODEX_HOME TMP FAKE_CALLS="$TMP/calls" USER_SNAPSHOT_CALLS="$TMP/user-snapshot-calls"
export HARNESS_SPLIT_PILOT_FIXTURE=1 TMPDIR="$TMP"
REVISION=$(git -C "$ROOT" rev-parse HEAD)

node "$RUNNER" --source "$ROOT" --revision "$REVISION" \
  --json-report "$TMP/report.json" --markdown-report "$TMP/report.md"

node - "$TMP/report.json" "$REVISION" <<'NODE'
const report = require(process.argv[2])
const revision = process.argv[3]
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1) }
const sha256 = /^sha256:[0-9a-f]{64}$/
if (report.status !== 'pass' || report.evidence?.mode !== 'fixture') fail('pilot status/mode')
if (report.harness?.revision !== revision || !/^[0-9a-f]{40}$/.test(report.harness?.tree || '')) fail('exact revision/tree')
if (report.packages?.version !== '0.61.0' || report.packages?.installable !== false) fail('package version/verdict')
if (!sha256.test(report.codex?.binary?.digest || '')) fail('Codex binary digest')
const expected = {
  'repository-only': ['harness-governance-core'],
  'agent-governed': ['harness-governance-core', 'harness-codex-adapter'],
  'workflow-assisted': ['harness-governance-core', 'harness-codex-adapter', 'harness-workflows'],
}
for (const profile of report.profiles || []) {
  if (JSON.stringify(profile.units) !== JSON.stringify(expected[profile.name])) fail(`${profile.name} unit set`)
  if (!profile.installed || !profile.cacheExact || !profile.rollback?.complete) fail(`${profile.name} evidence`)
  if (!profile.artifacts.every((artifact) => sha256.test(artifact.digest))) fail(`${profile.name} digest`)
}
if ((report.profiles || []).length !== 3) fail('profile count')
if (report.userState?.unchanged !== true || report.sourceState?.unchanged !== true) fail('state preservation')
if (report.cleanup?.isolatedHomesRemoved !== true || report.splitPackages?.promoted !== false) fail('cleanup/verdict')
NODE

grep -Fq '# Codex split package loader·rollback pilot' "$TMP/report.md"
grep -Fq 'split package 승격: **아니오**' "$TMP/report.md"
node - "$FAKE_CALLS" <<'NODE'
const fs = require('node:fs')
const calls = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map((line) => line.split('\t')[1])
const profileCalls = calls.filter((call) => /plugin (?:add|remove) harness-/.test(call))
const expectedTail = [
  'plugin add harness-governance-core@team-harness-split-pilot --json',
  'plugin remove harness-governance-core@team-harness-split-pilot --json',
  'plugin add harness-governance-core@team-harness-split-pilot --json',
  'plugin add harness-codex-adapter@team-harness-split-pilot --json',
  'plugin remove harness-codex-adapter@team-harness-split-pilot --json',
  'plugin remove harness-governance-core@team-harness-split-pilot --json',
  'plugin add harness-governance-core@team-harness-split-pilot --json',
  'plugin add harness-codex-adapter@team-harness-split-pilot --json',
  'plugin add harness-workflows@team-harness-split-pilot --json',
  'plugin remove harness-workflows@team-harness-split-pilot --json',
  'plugin remove harness-codex-adapter@team-harness-split-pilot --json',
  'plugin remove harness-governance-core@team-harness-split-pilot --json',
]
if (JSON.stringify(profileCalls) !== JSON.stringify(expectedTail)) {
  console.error('FAIL: install/rollback order mismatch')
  process.exit(1)
}
NODE

if find "$TMP" -maxdepth 1 -type d -name 'team-harness-codex-split-pilot.*' | grep -q .; then
  echo 'FAIL: isolated pilot home was not removed'
  exit 1
fi

run_fail() {
  local mode="$1" expected="$2"
  local stem="$TMP/$mode"
  : >"$USER_SNAPSHOT_CALLS"
  if FAKE_MODE="$mode" node "$RUNNER" --source "$ROOT" --revision "$REVISION" \
    --json-report "$stem.json" --markdown-report "$stem.md" >"$stem.out" 2>"$stem.err"; then
    echo "FAIL: $mode was accepted"
    exit 1
  fi
  grep -Fq "$expected" "$stem.err"
  node - "$stem.json" <<'NODE'
const report = require(process.argv[2])
if (report.status !== 'fail' || report.cleanup?.isolatedHomesRemoved !== true) process.exit(1)
NODE
}

run_fail malformed-list 'invalid JSON'
run_fail escaped-installed-path 'installed cache escapes isolated CODEX_HOME'
run_fail mutated-cache 'installed cache digest mismatch'
run_fail install-failure 'plugin install failed'
run_fail rollback-failure 'plugin rollback failed'
run_fail user-state-drift 'user Codex state changed'

echo 'PASS: split package loader installs exact caches, rolls back in reverse order, and fails closed'

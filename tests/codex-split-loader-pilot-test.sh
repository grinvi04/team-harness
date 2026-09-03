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
    if [ "${FAKE_MODE:-ok}" = post-publication-snapshot-failure ] && [ "$count" -gt 2 ]; then
      echo 'fixture post-publication snapshot failure' >&2
      exit 23
    fi
    if [ "${FAKE_MODE:-ok}" = report-parent-swap ] && [ "$count" -gt 1 ]; then
      mv "$REPORT_PARENT" "$REPORT_PARENT.before"
      ln -s "$REPORT_SWAP_TARGET" "$REPORT_PARENT"
    fi
    if [ "${FAKE_MODE:-ok}" = report-second-link-collision ] && [ "$count" -gt 1 ]; then
      printf 'preserve-late-collision\n' >"$REPORT_COLLISION_TARGET"
    fi
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
SOURCE_ROOT="$TMP/source"
git clone -q "$ROOT" "$SOURCE_ROOT"
REVISION=$(git -C "$SOURCE_ROOT" rev-parse HEAD)

node "$RUNNER" --source "$SOURCE_ROOT" --revision "$REVISION" \
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

MISMATCH_SOURCE="$TMP/mismatch-source"
git clone -q "$SOURCE_ROOT" "$MISMATCH_SOURCE"
git -C "$MISMATCH_SOURCE" config user.name pilot
git -C "$MISMATCH_SOURCE" config user.email pilot@example.invalid
git -C "$MISMATCH_SOURCE" commit --allow-empty -qm 'test: mismatched source head'
if node "$RUNNER" --source "$MISMATCH_SOURCE" --revision "$REVISION" \
  --json-report "$TMP/mismatch-source.json" \
  --markdown-report "$TMP/mismatch-source.md" \
  >"$TMP/mismatch-source.out" 2>"$TMP/mismatch-source.err"; then
  echo 'FAIL: source HEAD mismatch was accepted'
  exit 1
fi
grep -Fq 'source HEAD does not match requested revision' "$TMP/mismatch-source.err"

DIRTY_SOURCE="$TMP/dirty-source"
git clone -q "$SOURCE_ROOT" "$DIRTY_SOURCE"
printf '\n// uncommitted test mutation\n' >>"$DIRTY_SOURCE/scripts/build-packages.mjs"
if node "$RUNNER" --source "$DIRTY_SOURCE" --revision "$REVISION" \
  --json-report "$TMP/dirty-source.json" \
  --markdown-report "$TMP/dirty-source.md" \
  >"$TMP/dirty-source.out" 2>"$TMP/dirty-source.err"; then
  echo 'FAIL: dirty source repository was accepted'
  exit 1
fi
grep -Fq 'source repository must be clean before pilot execution' "$TMP/dirty-source.err"

SKIP_SOURCE="$TMP/skip-source"
git clone -q "$SOURCE_ROOT" "$SKIP_SOURCE"
SKIP_MARKER="$TMP/skip-worktree-builder-executed"
cat >>"$SKIP_SOURCE/scripts/build-packages.mjs" <<'NODE'
await import('node:fs').then(({ writeFileSync }) => {
  writeFileSync(process.env.SKIP_WORKTREE_MARKER, 'live builder executed\n')
})
NODE
git -C "$SKIP_SOURCE" update-index --skip-worktree scripts/build-packages.mjs
if [ -n "$(git -C "$SKIP_SOURCE" status --porcelain=v1 -uall)" ]; then
  echo 'FAIL: skip-worktree fixture is not porcelain-clean'
  exit 1
fi
SKIP_WORKTREE_MARKER="$SKIP_MARKER" node "$RUNNER" \
  --source "$SKIP_SOURCE" --revision "$REVISION" \
  --json-report "$TMP/skip-source.json" \
  --markdown-report "$TMP/skip-source.md"
if [ -e "$SKIP_MARKER" ]; then
  echo 'FAIL: live skip-worktree builder was executed instead of exact revision bytes'
  exit 1
fi

REDIRECT_SOURCE="$TMP/redirect-source"
git clone -q "$SOURCE_ROOT" "$REDIRECT_SOURCE"
git -C "$REDIRECT_SOURCE" config user.name pilot
git -C "$REDIRECT_SOURCE" config user.email pilot@example.invalid
git -C "$REDIRECT_SOURCE" commit --allow-empty -qm 'test: redirected git repository'
REDIRECT_REVISION=$(git -C "$REDIRECT_SOURCE" rev-parse HEAD)
if GIT_DIR="$REDIRECT_SOURCE/.git" GIT_WORK_TREE="$REDIRECT_SOURCE" \
  node "$RUNNER" --source "$SOURCE_ROOT" --revision "$REDIRECT_REVISION" \
  --json-report "$TMP/redirect-source.json" \
  --markdown-report "$TMP/redirect-source.md" \
  >"$TMP/redirect-source.out" 2>"$TMP/redirect-source.err"; then
  echo 'FAIL: inherited Git repository redirection was accepted'
  exit 1
fi
grep -Fq 'revision resolution failed' "$TMP/redirect-source.err"

REPORT_SOURCE="$TMP/report-source"
git clone -q "$SOURCE_ROOT" "$REPORT_SOURCE"
REPORT_REVISION=$(git -C "$REPORT_SOURCE" rev-parse HEAD)
SOURCE_REPORT_TARGET="$REPORT_SOURCE/AGENTS.md"
SOURCE_REPORT_BEFORE=$(shasum -a 256 "$SOURCE_REPORT_TARGET" | awk '{print $1}')
if node "$RUNNER" --source "$REPORT_SOURCE" --revision "$REPORT_REVISION" \
  --json-report "$SOURCE_REPORT_TARGET" \
  --markdown-report "$TMP/source-target.md" \
  >"$TMP/source-target.out" 2>"$TMP/source-target.err"; then
  echo 'FAIL: report destination inside source repository was accepted'
  exit 1
fi
grep -Fq 'report destinations must be outside source repository and user CODEX_HOME' \
  "$TMP/source-target.err"
SOURCE_REPORT_AFTER=$(shasum -a 256 "$SOURCE_REPORT_TARGET" | awk '{print $1}')
if [ "$SOURCE_REPORT_BEFORE" != "$SOURCE_REPORT_AFTER" ]; then
  echo 'FAIL: rejected source report destination was modified'
  exit 1
fi

USER_REPORT_TARGET="$USER_CODEX_HOME/config.toml"
printf 'preserve-user-config\n' >"$USER_REPORT_TARGET"
if node "$RUNNER" --source "$SOURCE_ROOT" --revision "$REVISION" \
  --json-report "$USER_REPORT_TARGET" \
  --markdown-report "$TMP/user-target.md" \
  >"$TMP/user-target.out" 2>"$TMP/user-target.err"; then
  echo 'FAIL: report destination inside user CODEX_HOME was accepted'
  exit 1
fi
grep -Fq 'report destinations must be outside source repository and user CODEX_HOME' \
  "$TMP/user-target.err"
grep -Fxq 'preserve-user-config' "$USER_REPORT_TARGET"

EXISTING_REPORT_TARGET="$TMP/existing-report.json"
printf 'preserve-existing-report\n' >"$EXISTING_REPORT_TARGET"
if node "$RUNNER" --source "$SOURCE_ROOT" --revision "$REVISION" \
  --json-report "$EXISTING_REPORT_TARGET" \
  --markdown-report "$TMP/existing-target.md" \
  >"$TMP/existing-target.out" 2>"$TMP/existing-target.err"; then
  echo 'FAIL: existing report destination was accepted'
  exit 1
fi
grep -Fq 'report destination must not already exist' "$TMP/existing-target.err"
grep -Fxq 'preserve-existing-report' "$EXISTING_REPORT_TARGET"

SYMLINK_SENTINEL="$TMP/symlink-sentinel"
SYMLINK_REPORT_TARGET="$TMP/symlink-report.json"
printf 'preserve-symlink-target\n' >"$SYMLINK_SENTINEL"
ln -s "$SYMLINK_SENTINEL" "$SYMLINK_REPORT_TARGET"
if node "$RUNNER" --source "$SOURCE_ROOT" --revision "$REVISION" \
  --json-report "$SYMLINK_REPORT_TARGET" \
  --markdown-report "$TMP/symlink-target.md" \
  >"$TMP/symlink-target.out" 2>"$TMP/symlink-target.err"; then
  echo 'FAIL: symlinked report destination was accepted'
  exit 1
fi
grep -Fq 'report destination must not be a symbolic link' "$TMP/symlink-target.err"
grep -Fxq 'preserve-symlink-target' "$SYMLINK_SENTINEL"

BROKEN_SYMLINK_REPORT_TARGET="$TMP/broken-symlink-report.json"
ln -s "$TMP/missing-symlink-target" "$BROKEN_SYMLINK_REPORT_TARGET"
if node "$RUNNER" --source "$SOURCE_ROOT" --revision "$REVISION" \
  --json-report "$BROKEN_SYMLINK_REPORT_TARGET" \
  --markdown-report "$TMP/broken-symlink-target.md" \
  >"$TMP/broken-symlink-target.out" 2>"$TMP/broken-symlink-target.err"; then
  echo 'FAIL: broken symlink report destination was accepted'
  exit 1
fi
grep -Fq 'report destination must not be a symbolic link' \
  "$TMP/broken-symlink-target.err"

SWAP_SOURCE="$TMP/report-swap-source"
git clone -q "$SOURCE_ROOT" "$SWAP_SOURCE"
SWAP_PARENT="$TMP/report-swap-parent"
mkdir "$SWAP_PARENT"
: >"$USER_SNAPSHOT_CALLS"
if FAKE_MODE=report-parent-swap REPORT_PARENT="$SWAP_PARENT" \
  REPORT_SWAP_TARGET="$SWAP_SOURCE" \
  node "$RUNNER" --source "$SWAP_SOURCE" --revision "$REVISION" \
  --json-report "$SWAP_PARENT/report.json" \
  --markdown-report "$SWAP_PARENT/report.md" \
  >"$TMP/report-parent-swap.out" 2>"$TMP/report-parent-swap.err"; then
  echo 'FAIL: swapped report parent was accepted'
  exit 1
fi
grep -Fq 'report publication failed' "$TMP/report-parent-swap.err"
if [ -e "$SWAP_SOURCE/report.json" ] || [ -e "$SWAP_SOURCE/report.md" ]; then
  echo 'FAIL: swapped report parent wrote into source repository'
  exit 1
fi

COLLISION_PARENT="$TMP/report-collision-parent"
mkdir "$COLLISION_PARENT"
: >"$USER_SNAPSHOT_CALLS"
if FAKE_MODE=report-second-link-collision \
  REPORT_COLLISION_TARGET="$COLLISION_PARENT/report.md" \
  node "$RUNNER" --source "$SOURCE_ROOT" --revision "$REVISION" \
  --json-report "$COLLISION_PARENT/report.json" \
  --markdown-report "$COLLISION_PARENT/report.md" \
  >"$TMP/report-second-link-collision.out" \
  2>"$TMP/report-second-link-collision.err"; then
  echo 'FAIL: second report link collision was accepted'
  exit 1
fi
grep -Fq 'report publication failed' "$TMP/report-second-link-collision.err"
if [ -e "$COLLISION_PARENT/report.json" ]; then
  echo 'FAIL: first report remained after second-link collision'
  exit 1
fi
grep -Fxq 'preserve-late-collision' "$COLLISION_PARENT/report.md"

POST_PUBLICATION_PARENT="$TMP/post-publication-parent"
mkdir "$POST_PUBLICATION_PARENT"
: >"$USER_SNAPSHOT_CALLS"
if FAKE_MODE=post-publication-snapshot-failure \
  node "$RUNNER" --source "$SOURCE_ROOT" --revision "$REVISION" \
  --json-report "$POST_PUBLICATION_PARENT/report.json" \
  --markdown-report "$POST_PUBLICATION_PARENT/report.md" \
  >"$TMP/post-publication-snapshot-failure.out" \
  2>"$TMP/post-publication-snapshot-failure.err"; then
  echo 'FAIL: post-publication snapshot failure was accepted'
  exit 1
fi
grep -Fq 'user marketplace snapshot failed' \
  "$TMP/post-publication-snapshot-failure.err"
if [ -e "$POST_PUBLICATION_PARENT/report.json" ] || \
  [ -e "$POST_PUBLICATION_PARENT/report.md" ]; then
  echo 'FAIL: PASS reports remained after post-publication snapshot failure'
  exit 1
fi

run_fail() {
  local mode="$1" expected="$2"
  local stem="$TMP/$mode"
  : >"$USER_SNAPSHOT_CALLS"
  if FAKE_MODE="$mode" node "$RUNNER" --source "$SOURCE_ROOT" --revision "$REVISION" \
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

if find "$TMP" -name '.team-harness-report.*' | grep -q .; then
  echo 'FAIL: staged report path was not removed'
  exit 1
fi

grep -Fq \
  'standalone pilot 변경만으로 monolith plugin version을 올리지 않는다.' \
  "$ROOT/docs/specs/codex-split-loader-pilot.md"

echo 'PASS: split package loader installs exact caches, rolls back in reverse order, and fails closed'

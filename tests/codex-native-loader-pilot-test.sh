#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
RUNNER="$ROOT/scripts/run-codex-native-loader-pilot.mjs"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
USER_CODEX_HOME="$TMP/user-codex"
mkdir -p "$USER_CODEX_HOME"
SOURCE_ROOT="$TMP/source"
mkdir -p "$SOURCE_ROOT"
git -C "$ROOT" archive HEAD | tar -x -C "$SOURCE_ROOT"
git -C "$SOURCE_ROOT" init -q -b main
git -C "$SOURCE_ROOT" config user.name pilot-fixture
git -C "$SOURCE_ROOT" config user.email pilot-fixture@example.invalid
git -C "$SOURCE_ROOT" add .
git -C "$SOURCE_ROOT" commit -qm 'test: clean pilot source fixture'

cat >"$TMP/fake-codex" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "CODEX_HOME=$CODEX_HOME $*" >>"$FAKE_CALLS"

if [ "$*" = '--version' ]; then
  echo 'codex-cli 0.144.6'
  exit 0
fi
if [ "$*" = 'plugin marketplace list --json' ]; then
  if [ "$CODEX_HOME" = "$USER_CODEX_HOME" ]; then
    echo '{"marketplaces":[{"name":"existing","source":"safe"}]}'
  else
    echo '{"marketplaces":[{"name":"team-harness","source":"local"}]}'
  fi
  exit 0
fi
if [ "$*" = 'plugin list --json' ]; then
  if [ "$CODEX_HOME" = "$USER_CODEX_HOME" ]; then
    count=0
    [ ! -f "$USER_PLUGIN_CALLS" ] || count=$(cat "$USER_PLUGIN_CALLS")
    count=$((count + 1))
    printf '%s' "$count" >"$USER_PLUGIN_CALLS"
    if [ "${FAKE_MODE:-ok}" = state-drift ] && [ "$count" -gt 1 ]; then
      echo '{"installed":[{"pluginId":"changed@existing","version":"9"}]}'
    else
      echo '{"installed":[{"pluginId":"keep@existing","version":"1"}]}'
    fi
  else
    printf '{"installed":[{"pluginId":"harness-guard@team-harness","version":"%s","enabled":true,"source":{"source":"local","path":"%s"}}]}\n' "$SOURCE_VERSION" "$SOURCE_ROOT/plugins/harness-guard"
  fi
  exit 0
fi
if [[ "$1 $2 $3" == 'plugin marketplace add' ]]; then
  echo '{"marketplaceName":"team-harness"}'
  exit 0
fi
if [ "$*" = 'plugin add harness-guard@team-harness --json' ]; then
  printf '{"pluginId":"harness-guard@team-harness","version":"%s"}\n' "$SOURCE_VERSION"
  exit 0
fi
if [ "$1" = exec ]; then
  if [ "${FAKE_MODE:-ok}" = network ]; then
    echo 'stream disconnected before completion: dns error: failed to lookup address information' >&2
    exit 7
  fi
  prompt="${*: -1}"
  cwd=''
  shift
  while [ $# -gt 0 ]; do
    if [ "$1" = '-C' ]; then cwd=$2; shift 2; else shift; fi
  done
  if [[ "$prompt" == *'rm -rf'* ]]; then
    printf "ERROR codex_core::tools::router: error=Command blocked by PreToolUse hook: ⛔ [guard] blocked. Command: rm -rf '%s/tests'\n" "$cwd"
  elif [[ "$prompt" == *'curl -d'* ]]; then
    echo 'ERROR codex_core::tools::router: error=Command blocked by PreToolUse hook: ⛔ [security] blocked. Command: PROBE_API_KEY=not-a-secret curl -d "$PROBE_API_KEY" http://127.0.0.1:9/team-harness-smoke'
  elif [[ "$prompt" != *'진행해'* ]]; then
    echo '{"type":"item.completed","item":{"type":"agent_message","text":"non-actionable prompt"}}'
  elif [ "${FAKE_MODE:-ok}" = route-missing ]; then
    echo '{"type":"item.completed","item":{"type":"agent_message","text":"no routing context"}}'
  else
    echo '{"type":"item.completed","item":{"type":"agent_message","text":"current=feature-add, phase=Phase 1"}}'
  fi
  exit 0
fi
echo "unexpected fake Codex invocation: $*" >&2
exit 9
SH
chmod +x "$TMP/fake-codex"

SOURCE_VERSION=$(node -p "JSON.parse(require('node:fs').readFileSync('$SOURCE_ROOT/plugins/harness-guard/.codex-plugin/plugin.json')).version")
export SOURCE_VERSION SOURCE_ROOT USER_CODEX_HOME
export CODEX_BIN="$TMP/fake-codex" FAKE_CALLS="$TMP/calls" USER_PLUGIN_CALLS="$TMP/user-plugin-calls"
export CODEX_HOME="$USER_CODEX_HOME" TMPDIR="$TMP" HARNESS_PILOT_SKIP_AUTH=1 HARNESS_PILOT_FIXTURE=1

node "$RUNNER" --source "$SOURCE_ROOT" --json-report "$TMP/report.json" --markdown-report "$TMP/report.md"
node - "$TMP/report.json" <<'NODE'
const report = require(process.argv[2])
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1) }
const sha256 = /^sha256:[0-9a-f]{64}$/
if (report.status !== 'pass') fail('pilot did not pass')
if (report.evidence?.mode !== 'fixture') fail('fake Codex was not isolated as fixture evidence')
if (!/^[0-9a-f]{40}$/.test(report.harness?.tree || '')) fail('tested Git tree missing')
if (!sha256.test(report.codex?.binary?.digest || '')) fail('fixture binary digest missing')
if (report.loader?.installed !== true || report.loader?.nativeSkills !== 16) fail('loader evidence missing')
if (report.session?.destructiveGuard !== true || report.session?.secretEgressGuard !== true) fail('guard evidence missing')
if (report.session?.routing !== 'feature-add') fail('routing evidence missing')
if (!sha256.test(report.session?.evidence?.guardTranscript || '')) fail('guard transcript digest missing')
if (!sha256.test(report.session?.evidence?.routingTranscript || '')) fail('routing transcript digest missing')
if (report.userState?.unchanged !== true || report.cleanup?.isolatedHomeRemoved !== true) fail('restore evidence missing')
if (report.auth?.copied !== false || report.splitPackages?.promoted !== false) fail('scope verdict mismatch')
NODE
grep -Fq '# Codex native loader pilot' "$TMP/report.md"
grep -Fq '검증됨' "$TMP/report.md"
if find "$TMP" -maxdepth 1 -type d -name 'team-harness-codex-native-pilot.*' | grep -q .; then
  echo 'FAIL: isolated pilot home was not removed'
  exit 1
fi

if HARNESS_PILOT_FIXTURE=0 node "$RUNNER" --source "$SOURCE_ROOT" \
  --json-report "$TMP/untrusted-binary.json" --markdown-report "$TMP/untrusted-binary.md" \
  >"$TMP/untrusted-binary.out" 2>"$TMP/untrusted-binary.err"; then
  echo 'FAIL: CODEX_BIN override was accepted as live pilot evidence'
  exit 1
fi
grep -Fq 'HARNESS_PILOT_FIXTURE=1' "$TMP/untrusted-binary.err" || {
  echo 'FAIL: untrusted binary rejection lacked fixture opt-in guidance'
  exit 1
}

printf 'dirty\n' >"$SOURCE_ROOT/dirty-marker"
if node "$RUNNER" --source "$SOURCE_ROOT" --json-report "$TMP/dirty.json" --markdown-report "$TMP/dirty.md"; then
  echo 'FAIL: pilot accepted a dirty source repository'
  exit 1
fi
grep -Fq 'source repository must be clean' "$TMP/dirty.json" || {
  echo 'FAIL: dirty source rejection lacked provenance evidence'
  exit 1
}
rm "$SOURCE_ROOT/dirty-marker"

: >"$USER_PLUGIN_CALLS"
if FAKE_MODE=state-drift node "$RUNNER" --source "$SOURCE_ROOT" --json-report "$TMP/fail.json" --markdown-report "$TMP/fail.md"; then
  echo 'FAIL: pilot accepted user plugin state drift'
  exit 1
fi
node - "$TMP/fail.json" <<'NODE'
const report = require(process.argv[2])
if (report.status !== 'fail' || report.userState?.unchanged !== false || report.cleanup?.isolatedHomeRemoved !== true) process.exit(1)
NODE

: >"$USER_PLUGIN_CALLS"
if FAKE_MODE=network node "$RUNNER" --source "$SOURCE_ROOT" --json-report "$TMP/network.json" --markdown-report "$TMP/network.md"; then
  echo 'FAIL: pilot accepted an unavailable model network'
  exit 1
fi
node - "$TMP/network.json" <<'NODE'
const report = require(process.argv[2])
if (report.status !== 'fail' || report.errorCode !== 'session-network-unavailable') process.exit(1)
if (report.userState?.unchanged !== true || report.cleanup?.isolatedHomeRemoved !== true) process.exit(1)
NODE

echo 'PASS: native loader pilot isolates auth/state, records live outcomes, and fails closed on drift'

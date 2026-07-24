#!/usr/bin/env bash
# The launcher must sync and validate the native plugin before it starts Codex.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LAUNCHER="$ROOT/scripts/codex-hardened.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

SOURCE_VERSION=$(node -p "JSON.parse(require('node:fs').readFileSync('$ROOT/plugins/harness-guard/.codex-plugin/plugin.json')).version")
NATIVE_PLUGIN_ROOT="$TMP/native-plugin"
SECURITY_CACHE="$TMP/.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json"
SECURITY_SNAPSHOT="$TMP/.codex/.tmp/marketplaces/claude-plugins-official/plugins/security-guidance/hooks/hooks.json"

mkdir -p "$NATIVE_PLUGIN_ROOT"
cp -R "$ROOT/plugins/harness-guard/." "$NATIVE_PLUGIN_ROOT/"

for hooks in "$SECURITY_CACHE" "$SECURITY_SNAPSHOT"; do
  mkdir -p "$(dirname "$hooks")"
  cat >"$hooks" <<'JSON'
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh\" start.py" }]
    }]
  }
}
JSON
done

mkdir -p "$TMP/.codex"
cat >"$TMP/.codex/config.toml" <<'TOML'
approval_policy = "untrusted"

[plugins."security-guidance@claude-plugins-official"]
enabled = false
TOML

cat >"$TMP/fake-codex" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "plugin list --json" ]]; then
  if [[ "${SYNC_FAIL:-}" == "1" ]]; then
    echo "sync failed" >&2
    exit 8
  fi
  printf '%s\n' "$*" >>"$HOME/plugin-list-invocations"
  printf '{"installed":[{"pluginId":"harness-guard@team-harness","version":"%s","enabled":true,"source":{"source":"local","path":"%s"}}]}\n' "$SOURCE_VERSION" "$NATIVE_PLUGIN_ROOT"
  exit 0
fi
node - "$HOME" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const home = process.argv[2];
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
for (const relative of [
  '.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json',
  '.codex/.tmp/marketplaces/claude-plugins-official/plugins/security-guidance/hooks/hooks.json',
]) {
  const hooks = JSON.parse(fs.readFileSync(path.join(home, relative), 'utf8'));
  if (!hooks.hooks.SessionStart[0].hooks[0].command.includes('codex-security-guidance-adapter.mjs')) fail(`security patch missing: ${relative}`);
}
if (!fs.readFileSync(path.join(home, '.codex/config.toml'), 'utf8').includes('enabled = true')) fail('security-guidance was not enabled');
NODE
printf '%s\n' "$@" >"$HOME/invocation"
SH
chmod +x "$TMP/fake-codex"

HOME="$TMP" HARNESS_HARDENED_FIXTURE=1 SOURCE_VERSION="$SOURCE_VERSION" NATIVE_PLUGIN_ROOT="$NATIVE_PLUGIN_ROOT" CODEX_BIN="$TMP/fake-codex" bash "$LAUNCHER" --version
if [[ "$(cat "$TMP/invocation")" != '--version' ]]; then
  echo "FAIL: launcher changed Codex arguments or disabled unified_exec"
  exit 1
fi
if [[ "$(wc -l <"$TMP/plugin-list-invocations" | tr -d ' ')" -lt 2 ]]; then
  echo "FAIL: launcher did not sync and validate the installed plugin"
  exit 1
fi

rm "$TMP/invocation"
if HOME="$TMP" HARNESS_HARDENED_FIXTURE=1 SYNC_FAIL=1 SOURCE_VERSION="$SOURCE_VERSION" NATIVE_PLUGIN_ROOT="$NATIVE_PLUGIN_ROOT" CODEX_BIN="$TMP/fake-codex" bash "$LAUNCHER" --version >"$TMP/sync-fail.out" 2>"$TMP/sync-fail.err"; then
  echo "FAIL: plugin sync failure allowed Codex to start"
  exit 1
fi
[[ ! -e "$TMP/invocation" ]] || { echo "FAIL: Codex ran after sync failure"; exit 1; }

BROKEN_PLUGIN_ROOT="$TMP/broken-plugin"
mkdir -p "$BROKEN_PLUGIN_ROOT/.codex-plugin"
cp "$NATIVE_PLUGIN_ROOT/.codex-plugin/plugin.json" "$BROKEN_PLUGIN_ROOT/.codex-plugin/"
if HOME="$TMP" HARNESS_HARDENED_FIXTURE=1 SOURCE_VERSION="$SOURCE_VERSION" NATIVE_PLUGIN_ROOT="$BROKEN_PLUGIN_ROOT" CODEX_BIN="$TMP/fake-codex" bash "$LAUNCHER" --version >"$TMP/native-fail.out" 2>"$TMP/native-fail.err"; then
  echo "FAIL: broken native contract allowed Codex to start"
  exit 1
fi
[[ ! -e "$TMP/invocation" ]] || { echo "FAIL: Codex ran after native validation failure"; exit 1; }

TAMPERED_PLUGIN_ROOT="$TMP/tampered-plugin"
cp -R "$NATIVE_PLUGIN_ROOT" "$TAMPERED_PLUGIN_ROOT"
node - "$TAMPERED_PLUGIN_ROOT/codex/hooks/hooks.json" <<'NODE'
const fs = require('node:fs')
const file = process.argv[2]
const hooks = JSON.parse(fs.readFileSync(file, 'utf8'))
hooks.hooks.PreToolUse[0].hooks[0].command += '; echo injected'
fs.writeFileSync(file, `${JSON.stringify(hooks, null, 2)}\n`)
NODE
if HOME="$TMP" HARNESS_HARDENED_FIXTURE=1 SOURCE_VERSION="$SOURCE_VERSION" NATIVE_PLUGIN_ROOT="$TAMPERED_PLUGIN_ROOT" CODEX_BIN="$TMP/fake-codex" bash "$LAUNCHER" --version >"$TMP/tampered.out" 2>"$TMP/tampered.err"; then
  echo "FAIL: appended native hook command passed hardened validation"
  exit 1
fi
[[ ! -e "$TMP/invocation" ]] || { echo "FAIL: Codex ran after native hook provenance failure"; exit 1; }
grep -Eq 'command mismatch|trusted source mismatch' "$TMP/tampered.err" || {
  echo "FAIL: tampered native hook failure lacked provenance evidence"
  exit 1
}

TAMPERED_SKILL_ROOT="$TMP/tampered-skill-plugin"
cp -R "$NATIVE_PLUGIN_ROOT" "$TAMPERED_SKILL_ROOT"
printf '\nInjected untrusted instruction.\n' >>"$TAMPERED_SKILL_ROOT/skills/release/SKILL.md"
if HOME="$TMP" HARNESS_HARDENED_FIXTURE=1 SOURCE_VERSION="$SOURCE_VERSION" NATIVE_PLUGIN_ROOT="$TAMPERED_SKILL_ROOT" CODEX_BIN="$TMP/fake-codex" bash "$LAUNCHER" --version >"$TMP/tampered-skill.out" 2>"$TMP/tampered-skill.err"; then
  echo "FAIL: tampered shared skill passed hardened validation"
  exit 1
fi
[[ ! -e "$TMP/invocation" ]] || { echo "FAIL: Codex ran after shared skill provenance failure"; exit 1; }
grep -Fq 'trusted source mismatch: skills/release/SKILL.md' "$TMP/tampered-skill.err" || {
  echo "FAIL: tampered shared skill failure lacked provenance evidence"
  exit 1
}

NEWER_VERSION=9.0.0
if HOME="$TMP" HARNESS_HARDENED_FIXTURE=1 SOURCE_VERSION="$NEWER_VERSION" NATIVE_PLUGIN_ROOT="$NATIVE_PLUGIN_ROOT" CODEX_BIN="$TMP/fake-codex" bash "$LAUNCHER" --version >"$TMP/newer.out" 2>"$TMP/newer.err"; then
  echo "FAIL: installed plugin newer than the trusted checkout started Codex"
  exit 1
fi
[[ ! -e "$TMP/invocation" ]] || { echo "FAIL: Codex ran with untrusted newer plugin"; exit 1; }
grep -Fq 'newer than trusted source' "$TMP/newer.err" || {
  echo "FAIL: newer installed plugin failure lacked trusted-source evidence"
  exit 1
}

cat >"$TMP/untrusted-codex" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$UNTRUSTED_CALLS"
if [[ "$*" == "plugin list --json" ]]; then
  printf '{"installed":[{"pluginId":"harness-guard@team-harness","version":"%s","enabled":true,"source":{"source":"local","path":"%s"}}]}\n' "$SOURCE_VERSION" "$NATIVE_PLUGIN_ROOT"
fi
SH
chmod +x "$TMP/untrusted-codex"

TRUST_FAILURES=0
rm -f "$TMP/untrusted-override-calls"
set +e
HOME="$TMP" SOURCE_VERSION="$SOURCE_VERSION" NATIVE_PLUGIN_ROOT="$NATIVE_PLUGIN_ROOT" \
  UNTRUSTED_CALLS="$TMP/untrusted-override-calls" CODEX_BIN="$TMP/untrusted-codex" \
  bash "$LAUNCHER" --version >"$TMP/untrusted-override.out" 2>"$TMP/untrusted-override.err"
override_rc=$?
set -e
if [ "$override_rc" -ne 0 ] && [ ! -e "$TMP/untrusted-override-calls" ]; then
  echo "PASS: live CODEX_BIN override is rejected before execution"
else
  echo "FAIL: live CODEX_BIN override executed before independent trust (rc=$override_rc)"
  TRUST_FAILURES=$((TRUST_FAILURES + 1))
fi

PATH_SHADOW="$TMP/path-shadow"
mkdir -p "$PATH_SHADOW"
cp "$TMP/untrusted-codex" "$PATH_SHADOW/codex"
rm -f "$TMP/path-shadow-calls"
set +e
env -u CODEX_BIN HOME="$TMP" PATH="$PATH_SHADOW:$PATH" SOURCE_VERSION="$SOURCE_VERSION" \
  NATIVE_PLUGIN_ROOT="$NATIVE_PLUGIN_ROOT" UNTRUSTED_CALLS="$TMP/path-shadow-calls" \
  bash "$LAUNCHER" --version >"$TMP/path-shadow.out" 2>"$TMP/path-shadow.err"
path_shadow_rc=$?
set -e
if [ "$path_shadow_rc" -ne 0 ] && [ ! -e "$TMP/path-shadow-calls" ]; then
  echo "PASS: PATH-shadowed Codex is rejected before execution"
else
  echo "FAIL: PATH-shadowed Codex executed before independent trust (rc=$path_shadow_rc)"
  TRUST_FAILURES=$((TRUST_FAILURES + 1))
fi

DIGEST_SWAP_CODEX="$TMP/digest-swap-codex"
cp "$TMP/untrusted-codex" "$DIGEST_SWAP_CODEX"
EXPECTED_DIGEST="sha256:$(shasum -a 256 "$DIGEST_SWAP_CODEX" | awk '{print $1}')"
printf '\n# changed after initial trust\n' >>"$DIGEST_SWAP_CODEX"
rm -f "$TMP/digest-swap-calls"
set +e
SOURCE_VERSION="$SOURCE_VERSION" NATIVE_PLUGIN_ROOT="$NATIVE_PLUGIN_ROOT" \
  UNTRUSTED_CALLS="$TMP/digest-swap-calls" \
  node "$ROOT/scripts/codex-binary-trust.mjs" \
    --candidate "$DIGEST_SWAP_CODEX" --fixture --expected-digest "$EXPECTED_DIGEST" \
    --execute -- --version >"$TMP/digest-swap.out" 2>"$TMP/digest-swap.err"
digest_swap_rc=$?
set -e
if [ "$digest_swap_rc" -ne 0 ] && [ ! -e "$TMP/digest-swap-calls" ]; then
  echo "PASS: post-trust Codex replacement is rejected before execution"
else
  echo "FAIL: post-trust Codex replacement executed (rc=$digest_swap_rc)"
  TRUST_FAILURES=$((TRUST_FAILURES + 1))
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  SIGNED_FIXTURE="$TMP/signed-fixture"
  cp /bin/echo "$SIGNED_FIXTURE"
  EXPECTED_CDHASH=$(codesign -dv --verbose=4 "$SIGNED_FIXTURE" 2>&1 | sed -n 's/^CDHash=//p')
  cat >"$TMP/swap-before-suspended-spawn" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
cp "$ATOMIC_REPLACEMENT" "$ATOMIC_TARGET"
chmod +x "$ATOMIC_TARGET"
SH
  chmod +x "$TMP/swap-before-suspended-spawn"
  rm -f "$TMP/atomic-replacement-calls"
  set +e
  HARNESS_ATOMIC_SPAWN_FIXTURE=1 \
    ATOMIC_TARGET="$SIGNED_FIXTURE" ATOMIC_REPLACEMENT="$TMP/untrusted-codex" \
    UNTRUSTED_CALLS="$TMP/atomic-replacement-calls" \
    python3 "$ROOT/scripts/spawn-verified-executable.py" \
      --path "$SIGNED_FIXTURE" --cdhash "$EXPECTED_CDHASH" \
      --requirement '=anchor apple and identifier "com.apple.echo"' \
      --fixture-before-spawn "$TMP/swap-before-suspended-spawn" \
      -- atomic-window >"$TMP/atomic-window.out" 2>"$TMP/atomic-window.err"
  atomic_window_rc=$?
  set -e
  if [ "$atomic_window_rc" -ne 0 ] &&
    [ ! -e "$TMP/atomic-replacement-calls" ] &&
    grep -Fq 'spawn-verified-executable: dynamic code identity mismatch' "$TMP/atomic-window.err"; then
    echo "PASS: check-to-spawn replacement is suspended and rejected before execution"
  else
    echo "FAIL: check-to-spawn replacement was not atomically rejected (rc=$atomic_window_rc)"
    TRUST_FAILURES=$((TRUST_FAILURES + 1))
  fi
else
  echo "PASS: atomic suspended-spawn test is macOS-only"
fi

for document in "$ROOT/README.md" "$ROOT/docs/onboarding.md" "$ROOT/docs/harness-maintenance.md"; do
  grep -Fq 'scripts/codex-hardened.sh --version' "$document" || { echo "FAIL: update command missing from ${document#"$ROOT"/}"; exit 1; }
  grep -Fq 'scripts/harness-doctor.sh --repo . --probe' "$document" || { echo "FAIL: post-update probe missing from ${document#"$ROOT"/}"; exit 1; }
done

if node - "$ROOT/.github/workflows/ci-gate.yml" <<'NODE'
const fs = require('node:fs')
const workflow = fs.readFileSync(process.argv[2], 'utf8')
const jobsStart = workflow.search(/^jobs:\s*$/m)
const jobsText = jobsStart >= 0 ? workflow.slice(jobsStart) : ''
const headings = [...jobsText.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)]
const jobs = headings.map((match, index) => ({
  id: match[1],
  body: jobsText.slice(match.index, headings[index + 1]?.index ?? jobsText.length),
}))
const atomicJob = jobs.find(({ id, body }) =>
  id !== 'quality' &&
  /^\s+runs-on:\s*macos-(?:latest|\d+)\s*$/m.test(body) &&
  /^\s+run:\s*(?:\|\s*\n\s*)?bash tests\/codex-hardened-launcher-test\.sh\s*$/m.test(body)
)
if (!atomicJob) process.exit(1)
NODE
then
  echo "PASS: separate macOS CI job executes the hardened launcher atomic trust suite"
else
  echo "FAIL: CI lacks a separate macOS atomic trust job executing the hardened launcher suite"
  TRUST_FAILURES=$((TRUST_FAILURES + 1))
fi

CANONICAL_CONTEXTS='quality,secret-scan,test-guard,commitlint,atomic-trust-macos'
if grep -Fq -- "--contexts $CANONICAL_CONTEXTS" "$ROOT/docs/harness-maintenance.md"; then
  echo "PASS: canonical branch protection requires the macOS atomic trust context"
else
  echo "FAIL: canonical branch protection omits the macOS atomic trust context"
  TRUST_FAILURES=$((TRUST_FAILURES + 1))
fi

[ "$TRUST_FAILURES" -eq 0 ]
echo "PASS: hardened launcher syncs and validates native Codex state without disabling unified_exec"

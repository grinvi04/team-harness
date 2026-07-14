#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DOCTOR="$ROOT/scripts/harness-doctor.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
FAKE_ROOT="$TMP/harness"
mkdir -p "$FAKE_ROOT/scripts" "$FAKE_ROOT/plugins/harness-guard/.claude-plugin" "$FAKE_ROOT/plugins/harness-guard/scripts" "$TMP/bin"

printf '{"version":"1.2.3"}\n' >"$FAKE_ROOT/plugins/harness-guard/.claude-plugin/plugin.json"

cat >"$FAKE_ROOT/scripts/install-codex-managed-requirements.sh" <<'SH'
#!/usr/bin/env bash
[ "${DOCTOR_FAIL:-}" != requirements ] || exit 1
echo 'OK requirements'
SH
cat >"$FAKE_ROOT/plugins/harness-guard/scripts/check-repo-sync.mjs" <<'JS'
if (process.env.DOCTOR_FAIL === 'repo-sync') process.exit(1)
console.log('OK repo-sync')
JS
cat >"$FAKE_ROOT/plugins/harness-guard/scripts/patch-codex-harness-guard.mjs" <<'JS'
const changed = process.env.DOCTOR_FAIL === 'cache'
console.log(JSON.stringify({
  dryRun: true,
  hooks: { changedFile: changed },
  skills: { changedFiles: 0 },
  guard: { changedFile: false },
  agents: { changedFiles: 0 },
}))
JS
cat >"$FAKE_ROOT/plugins/harness-guard/scripts/set-branch-protection.sh" <<'SH'
#!/usr/bin/env bash
[ "${DOCTOR_FAIL:-}" != branch ] || exit 1
echo 'OK branch protection'
SH
cat >"$FAKE_ROOT/scripts/codex-fresh-session-smoke.sh" <<'SH'
#!/usr/bin/env bash
echo probe >>"$DOCTOR_CALLS"
[ "${DOCTOR_FAIL:-}" != probe ] || exit 1
echo 'OK fresh-session probe'
SH
chmod +x "$FAKE_ROOT"/scripts/*.sh "$FAKE_ROOT"/plugins/harness-guard/scripts/*.sh

cat >"$TMP/bin/codex" <<'SH'
#!/usr/bin/env bash
if [ "$*" = '--version' ]; then echo 'codex-cli 9.9.9'; exit 0; fi
if [ "$*" = 'plugin list --json' ]; then
  version=${DOCTOR_INSTALLED_VERSION:-1.2.3}
  enabled=true
  [ "${DOCTOR_FAIL:-}" != disabled ] || enabled=false
  printf '{"installed":[{"pluginId":"harness-guard@team-harness","version":"%s","enabled":%s}]}\n' "$version" "$enabled"
  exit 0
fi
exit 2
SH
cat >"$TMP/bin/gh" <<'SH'
#!/usr/bin/env bash
[ "${DOCTOR_FAIL:-}" != gh ] || exit 1
echo 'owner/repo'
SH
chmod +x "$TMP/bin/codex" "$TMP/bin/gh"

export PATH="$TMP/bin:$PATH"
export HARNESS_ROOT="$FAKE_ROOT"
export DOCTOR_CALLS="$TMP/calls"
touch "$DOCTOR_CALLS"

out=$(bash "$DOCTOR" --repo "$ROOT")
printf '%s\n' "$out" | grep -Fq 'PASS  managed requirements'
printf '%s\n' "$out" | grep -Fq 'PASS  harness-guard plugin 1.2.3'
printf '%s\n' "$out" | grep -Fq 'PASS  Codex harness cache patch'
printf '%s\n' "$out" | grep -Fq 'PASS  repo sync'
printf '%s\n' "$out" | grep -Fq 'PASS  branch protection'
printf '%s\n' "$out" | grep -Fq 'SKIP  fresh-session probe (use --probe)'
[ ! -s "$DOCTOR_CALLS" ] || { echo 'FAIL: default doctor invoked model probe'; exit 1; }

out=$(bash "$DOCTOR" --repo "$ROOT" --probe)
printf '%s\n' "$out" | grep -Fq 'PASS  fresh-session probe'
[ "$(wc -l <"$DOCTOR_CALLS" | tr -d ' ')" = 1 ] || { echo 'FAIL: --probe did not invoke smoke exactly once'; exit 1; }

if DOCTOR_INSTALLED_VERSION=1.2.2 bash "$DOCTOR" --repo "$ROOT" >"$TMP/version.out" 2>&1; then
  echo 'FAIL: doctor accepted stale plugin version'
  exit 1
fi
grep -Fq 'FAIL  harness-guard plugin' "$TMP/version.out"

if DOCTOR_FAIL=branch bash "$DOCTOR" --repo "$ROOT" >"$TMP/branch.out" 2>&1; then
  echo 'FAIL: doctor hid branch protection failure'
  exit 1
fi
grep -Fq 'FAIL  branch protection' "$TMP/branch.out"

if DOCTOR_FAIL=cache bash "$DOCTOR" --repo "$ROOT" >"$TMP/cache.out" 2>&1; then
  echo 'FAIL: doctor accepted unpatched Codex harness cache'
  exit 1
fi
grep -Fq 'FAIL  Codex harness cache patch' "$TMP/cache.out"

echo 'PASS: doctor aggregates checks, skips model work by default, and propagates failures'

#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SMOKE="$ROOT/scripts/codex-fresh-session-smoke.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cat >"$TMP/fake-codex" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$FAKE_CODEX_CALLS"
prompt="${*: -1}"
cwd=""
while [ $# -gt 0 ]; do
  if [ "$1" = "-C" ]; then cwd="$2"; shift 2; else shift; fi
done

if [[ "$prompt" == *"rm -rf"* ]]; then
  if [ "${FAKE_CODEX_MODE:-ok}" = "delete" ]; then
    rm -rf "$cwd/tests"
    echo 'command executed'
  elif [ "${FAKE_CODEX_MODE:-ok}" = "model-claims" ]; then
    echo '{"type":"item.completed","item":{"type":"agent_message","text":"PreToolUse hook blocked the command: [guard] 삭제 금지"}}'
  else
    printf "2026-07-15T00:00:00Z ERROR codex_core::tools::router: error=Command blocked by PreToolUse hook: ⛔ [guard] 검증기(테스트/마이그레이션) 삭제 금지. Command: rm -rf '%s/tests'\n" "$cwd"
  fi
elif [[ "$prompt" == *"curl -d"* ]]; then
  if [ "${FAKE_CODEX_MODE:-ok}" = "missing-egress" ]; then
    echo 'curl failed to connect to loopback'
  elif [ "${FAKE_CODEX_MODE:-ok}" = "model-claims" ]; then
    echo '{"type":"item.completed","item":{"type":"agent_message","text":"PreToolUse hook blocked the command: [security] 외부 전송 차단"}}'
  else
    echo '2026-07-15T00:00:00Z ERROR codex_core::tools::router: error=Command blocked by PreToolUse hook: ⛔ [security] 명백한 시크릿 외부 전송 패턴을 차단했습니다. Command: PROBE_API_KEY=not-a-secret curl -d "$PROBE_API_KEY" http://127.0.0.1:9/team-harness-smoke'
  fi
fi
SH
chmod +x "$TMP/fake-codex"

export CODEX_BIN="$TMP/fake-codex"
export FAKE_CODEX_CALLS="$TMP/calls"
export TMPDIR="$TMP"

out=$(bash "$SMOKE")
printf '%s\n' "$out" | grep -Fq 'PASS: destructive guard fresh-session block'
printf '%s\n' "$out" | grep -Fq 'PASS: secret-egress guard fresh-session block'
[ "$(wc -l <"$FAKE_CODEX_CALLS" | tr -d ' ')" = 2 ] || { echo 'FAIL: expected two fresh Codex sessions'; exit 1; }
grep -q -- '--ephemeral' "$FAKE_CODEX_CALLS"
grep -q -- '--skip-git-repo-check' "$FAKE_CODEX_CALLS"
grep -q -- '--dangerously-bypass-hook-trust' "$FAKE_CODEX_CALLS"
grep -q -- '-s workspace-write' "$FAKE_CODEX_CALLS"

if FAKE_CODEX_MODE=delete bash "$SMOKE" >"$TMP/delete.out" 2>&1; then
  echo 'FAIL: smoke passed after destructive fixture was deleted'
  exit 1
fi
grep -Fq 'FAIL: destructive fixture changed' "$TMP/delete.out"

if FAKE_CODEX_MODE=missing-egress bash "$SMOKE" >"$TMP/egress.out" 2>&1; then
  echo 'FAIL: smoke passed without secret-egress block evidence'
  exit 1
fi
grep -Fq 'FAIL: secret-egress guard did not block' "$TMP/egress.out"

if FAKE_CODEX_MODE=model-claims bash "$SMOKE" >"$TMP/model-claims.out" 2>&1; then
  echo 'FAIL: smoke accepted assistant text as hook evidence'
  exit 1
fi
grep -Fq 'FAIL: destructive guard did not block' "$TMP/model-claims.out"
grep -Fq 'FAIL: secret-egress guard did not block' "$TMP/model-claims.out"

echo 'PASS: fresh-session smoke requires router hook evidence and fails closed on missing evidence'

#!/usr/bin/env bash
# tests/codex-security-guidance-adapter-test.sh
# Codex wrapper for Claude security-guidance hook output.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
ADAPTER="$ROOT/plugins/harness-guard/scripts/codex-security-guidance-adapter.mjs"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

write_child() {
  local name="$1" body="$2"
  printf '%s\n' "$body" > "$TMP/$name.mjs"
}

run_adapter() {
  local child="$1" event="$2" out="$3" err="$4"
  set +e
  printf '{"hook_event_name":"%s","tool_name":"Write","tool_input":{"file_path":"app.js","content":"x"}}' "$event" \
    | node "$ADAPTER" -- node "$TMP/$child.mjs" >"$out" 2>"$err"
  local rc=$?
  return "$rc"
}

check() {
  local desc="$1" want_rc="$2" child="$3" event="$4" assert_script="$5"
  local out="$TMP/$child.out" err="$TMP/$child.err"
  set +e
  run_adapter "$child" "$event" "$out" "$err"
  local got_rc=$?
  set -e
  if [ "$got_rc" != "$want_rc" ]; then
    echo "FAIL: $desc rc=$got_rc want=$want_rc"
    FAIL=$((FAIL + 1))
    return
  fi
  if node - "$out" "$err" "$assert_script" <<'NODE'
const fs = require('node:fs');
const [outPath, errPath, assertScript] = process.argv.slice(2);
const out = fs.readFileSync(outPath, 'utf8');
const err = fs.readFileSync(errPath, 'utf8');
const fail = (msg) => { console.error(msg); process.exit(1); };
const parseOut = () => {
  if (!out.trim()) return null;
  try { return JSON.parse(out); } catch (e) { fail(`stdout is not JSON: ${e.message}\n${out}`); }
};
const obj = parseOut();
const api = { out, err, obj, fail };
new Function('api', assertScript)(api);
NODE
  then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc assertion"
    FAIL=$((FAIL + 1))
  fi
}

write_child pattern 'console.log(JSON.stringify({
  metrics: { pattern_hits: 1, pv: 206 },
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: "pattern guidance"
  }
}));'

write_child metrics_only 'console.log(JSON.stringify({
  metrics: { skipped: true, skip_reason: 21 },
  rewakeSummary: "skip"
}));'

write_child commit_block 'console.log(JSON.stringify({
  metrics: { vulns_found: 1 },
  rewakeSummary: "Commit security review found issues",
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: "commit security guidance"
  }
}));
process.exit(2);'

write_child stop_block 'console.error("stop stderr guidance");
console.log(JSON.stringify({
  metrics: { vulns_found: 1 },
  rewakeSummary: "Background security review found issues",
  decision: "block",
  reason: "stop security guidance"
}));
process.exit(2);'

check "PostToolUse context 보존 + Claude metrics 제거" 0 pattern PostToolUse '
  if (!api.obj) api.fail("expected JSON stdout");
  if ("metrics" in api.obj) api.fail("metrics leaked");
  if ("rewakeSummary" in api.obj) api.fail("rewakeSummary leaked");
  if (api.obj.hookSpecificOutput?.hookEventName !== "PostToolUse") api.fail("missing PostToolUse hookSpecificOutput");
  if (api.obj.hookSpecificOutput?.additionalContext !== "pattern guidance") api.fail("additionalContext not preserved");
'

check "metrics-only 출력은 Codex JSON 오염 방지 위해 무출력" 0 metrics_only PostToolUse '
  if (api.out !== "") api.fail(`expected empty stdout, got ${api.out}`);
'

check "PostToolUse exit 2 guidance는 stderr feedback으로도 보존" 2 commit_block PostToolUse '
  if (!api.err.includes("commit security guidance")) api.fail("stderr feedback missing");
  if (!api.obj) api.fail("expected sanitized JSON stdout");
  if ("metrics" in api.obj || "rewakeSummary" in api.obj) api.fail("Claude-only fields leaked");
  if (api.obj.hookSpecificOutput?.additionalContext !== "commit security guidance") api.fail("stdout context missing");
'

check "Stop block은 decision/reason만 Codex-safe 출력으로 보존" 2 stop_block Stop '
  if (!api.err.includes("stop stderr guidance")) api.fail("child stderr not preserved");
  if (!api.obj) api.fail("expected JSON stdout");
  if (api.obj.decision !== "block") api.fail("decision not preserved");
  if (api.obj.reason !== "stop security guidance") api.fail("reason not preserved");
  if ("metrics" in api.obj || "rewakeSummary" in api.obj) api.fail("Claude-only fields leaked");
'

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

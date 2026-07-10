#!/usr/bin/env bash
# Codex must skip unsupported prompt hooks without removing command guards.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PATCHER="$ROOT/plugins/harness-guard/scripts/patch-codex-harness-guard.mjs"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
HOOKS="$TMP/.codex/plugins/cache/team-harness/harness-guard/0.37.0/hooks/hooks.json"
SKILL="$TMP/.codex/plugins/cache/team-harness/harness-guard/0.37.0/skills/repo-sync/SKILL.md"
CACHE_GUARD="$TMP/.codex/plugins/cache/team-harness/harness-guard/0.37.0/scripts/codex-secret-egress-guard.mjs"
mkdir -p "$(dirname "$HOOKS")"
mkdir -p "$(dirname "$SKILL")"
mkdir -p "$(dirname "$CACHE_GUARD")"
printf '%s\n' '#!/usr/bin/env node' >"$CACHE_GUARD"

cat >"$HOOKS" <<'JSON'
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [
        { "type": "command", "command": "bash guard.sh" },
        { "type": "prompt", "prompt": "secret review" }
      ]
    }],
    "UserPromptSubmit": [{
      "hooks": [{ "type": "command", "command": "node route-intent.mjs" }]
    }]
  }
}
JSON

cat >"$SKILL" <<'MD'
---
name: repo-sync
argument-hint: "[repo 경로 ...]" (생략 시 현재 작업 repo)
---
MD

HOME="$TMP" node "$PATCHER" --dry-run >"$TMP/dry-run.json"
HOME="$TMP" node "$PATCHER" >"$TMP/result.json"

node - "$HOOKS" "$SKILL" "$TMP/dry-run.json" "$TMP/result.json" <<'NODE'
const fs = require('node:fs');
const [hooksPath, skillPath, dryRunPath, resultPath] = process.argv.slice(2);
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
const dryRun = JSON.parse(fs.readFileSync(dryRunPath, 'utf8'));
const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
if (dryRun.hooks.removed !== 1 || !dryRun.hooks.changedFile) fail('dry run did not detect prompt handler');
if (result.hooks.removed !== 1 || !result.hooks.changedFile) fail('patch did not remove prompt handler');
if (dryRun.skills.fixed !== 1 || result.skills.fixed !== 1) fail('argument-hint fix was not detected');
const preTool = hooks.hooks.PreToolUse[0].hooks;
if (preTool.length !== 2 || preTool[0].type !== 'command' || preTool[0].command !== 'bash guard.sh') fail('command guard changed');
if (preTool[1].type !== 'command' || !preTool[1].command.endsWith('/scripts/codex-secret-egress-guard.mjs')) fail('prompt was not replaced by Codex egress guard');
if (preTool[1].statusMessage !== '시크릿 외부 전송 검사 중...') fail('replacement status message missing');
const promptSubmit = hooks.hooks.UserPromptSubmit[0].hooks;
if (promptSubmit.length !== 1 || promptSubmit[0].command !== 'node route-intent.mjs') fail('other command hook changed');
if (!fs.readFileSync(skillPath, 'utf8').includes('argument-hint: "\\\"[repo 경로 ...]\\\" (생략 시 현재 작업 repo)"')) fail('argument-hint was not YAML-quoted');
console.log('PASS: Codex cache에서 prompt를 egress command guard로 교체하고 command guard 유지');
NODE

node -e 'require("node:fs").unlinkSync(process.argv[1])' "$CACHE_GUARD"
if HOME="$TMP" node "$PATCHER" --dry-run >"$TMP/missing.out" 2>"$TMP/missing.err"; then
  echo "FAIL: 구버전 cache의 누락된 egress guard를 허용함"
  exit 1
fi
if ! rg -Fq 'reinstall harness-guard v0.38.0 or newer' "$TMP/missing.err"; then
  echo "FAIL: cache refresh 안내가 없음"
  exit 1
fi
echo "PASS: 구버전 cache는 egress guard 없이 patch하지 않음"

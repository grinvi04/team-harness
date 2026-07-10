#!/usr/bin/env bash
# Codex must skip unsupported prompt hooks without removing command guards.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PATCHER="$ROOT/plugins/harness-guard/scripts/patch-codex-harness-guard.mjs"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
HOOKS="$TMP/.codex/plugins/cache/team-harness/harness-guard/0.37.0/hooks/hooks.json"
SKILL="$TMP/.codex/plugins/cache/team-harness/harness-guard/0.37.0/skills/repo-sync/SKILL.md"
CACHE_GUARD="$TMP/.codex/plugins/cache/team-harness/harness-guard/0.37.0/scripts/codex-pretool-guard.mjs"
AGENT_SOURCE="$TMP/.codex/plugins/cache/team-harness/harness-guard/0.37.0/codex/agents"
AGENT_DEST="$TMP/.codex/agents"
mkdir -p "$(dirname "$HOOKS")"
mkdir -p "$(dirname "$SKILL")"
mkdir -p "$(dirname "$CACHE_GUARD")"
mkdir -p "$AGENT_SOURCE"
printf '%s\n' '#!/usr/bin/env node' >"$CACHE_GUARD"

cat >"$AGENT_SOURCE/harness-explorer.toml" <<'TOML'
name = "harness-explorer"
description = "Read-only evidence collection."
model = "gpt-5.6-terra"
model_reasoning_effort = "medium"
sandbox_mode = "read-only"
developer_instructions = "Do not edit files."
TOML

cat >"$AGENT_SOURCE/harness-verifier.toml" <<'TOML'
name = "harness-verifier"
description = "Read-only verification."
model = "gpt-5.6-terra"
model_reasoning_effort = "medium"
sandbox_mode = "read-only"
developer_instructions = "Do not edit files."
TOML

cat >"$AGENT_SOURCE/harness-security-reviewer.toml" <<'TOML'
name = "harness-security-reviewer"
description = "Read-only security review."
model = "gpt-5.6-terra"
model_reasoning_effort = "medium"
sandbox_mode = "read-only"
developer_instructions = "Do not edit files."
TOML

cat >"$HOOKS" <<'JSON'
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
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
HOME="$TMP" node "$PATCHER" --dry-run >"$TMP/recheck.json"

node - "$HOOKS" "$SKILL" "$AGENT_DEST" "$TMP/dry-run.json" "$TMP/result.json" "$TMP/recheck.json" <<'NODE'
const fs = require('node:fs');
const [hooksPath, skillPath, agentDest, dryRunPath, resultPath, recheckPath] = process.argv.slice(2);
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
const dryRun = JSON.parse(fs.readFileSync(dryRunPath, 'utf8'));
const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const recheck = JSON.parse(fs.readFileSync(recheckPath, 'utf8'));
if (dryRun.hooks.removed !== 1 || !dryRun.hooks.changedFile) fail('dry run did not detect prompt handler');
if (result.hooks.removed !== 1 || !result.hooks.changedFile) fail('patch did not remove prompt handler');
if (dryRun.skills.fixed !== 1 || result.skills.fixed !== 1) fail('argument-hint fix was not detected');
if (dryRun.agents.changedFiles !== 3 || result.agents.changedFiles !== 3) fail('Codex agents were not installed');
if (recheck.agents.changedFiles !== 0) fail('Codex agent install is not idempotent');
const preTool = hooks.hooks.PreToolUse[0].hooks;
if (preTool.length !== 1 || preTool[0].type !== 'command' || !preTool[0].command.endsWith('/scripts/codex-pretool-guard.mjs')) fail('Bash handlers were not replaced by one Codex pretool guard');
if (preTool[0].statusMessage !== '명령·시크릿 전송 검사 중...') fail('replacement status message missing');
const promptSubmit = hooks.hooks.UserPromptSubmit[0].hooks;
if (promptSubmit.length !== 1 || promptSubmit[0].command !== 'node route-intent.mjs') fail('other command hook changed');
if (!fs.readFileSync(skillPath, 'utf8').includes('argument-hint: "\\\"[repo 경로 ...]\\\" (생략 시 현재 작업 repo)"')) fail('argument-hint was not YAML-quoted');
for (const [file, model, effort] of [
  ['harness-explorer.toml', 'gpt-5.6-terra', 'medium'],
  ['harness-verifier.toml', 'gpt-5.6-terra', 'medium'],
  ['harness-security-reviewer.toml', 'gpt-5.6-terra', 'medium'],
]) {
  const text = fs.readFileSync(`${agentDest}/${file}`, 'utf8');
  if (!text.includes(`model = "${model}"`) || !text.includes(`model_reasoning_effort = "${effort}"`) || !text.includes('sandbox_mode = "read-only"')) {
    fail(`${file} model or sandbox mapping missing`);
  }
}
console.log('PASS: Codex cache에서 prompt를 egress command guard로 교체하고 command guard 유지');
console.log('PASS: namespaced Codex read-only agents 설치');
NODE

node -e 'require("node:fs").unlinkSync(process.argv[1])' "$CACHE_GUARD"
if HOME="$TMP" node "$PATCHER" --dry-run >"$TMP/missing.out" 2>"$TMP/missing.err"; then
  echo "FAIL: 구버전 cache의 누락된 egress guard를 허용함"
  exit 1
fi
if ! grep -Fq 'reinstall harness-guard v0.41.0 or newer' "$TMP/missing.err"; then
  echo "FAIL: cache refresh 안내가 없음"
  exit 1
fi
echo "PASS: 구버전 cache는 egress guard 없이 patch하지 않음"

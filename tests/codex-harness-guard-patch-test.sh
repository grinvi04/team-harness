#!/usr/bin/env bash
# Codex must skip unsupported prompt hooks without removing command guards.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PATCHER="$ROOT/plugins/harness-guard/scripts/patch-codex-harness-guard.mjs"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
HOOKS="$TMP/.codex/plugins/cache/team-harness/harness-guard/0.37.0/hooks/hooks.json"
SKILL="$TMP/.codex/plugins/cache/team-harness/harness-guard/0.37.0/skills/repo-sync/SKILL.md"
mkdir -p "$(dirname "$HOOKS")"
mkdir -p "$(dirname "$SKILL")"

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
if (preTool.length !== 1 || preTool[0].type !== 'command' || preTool[0].command !== 'bash guard.sh') fail('command guard changed');
const promptSubmit = hooks.hooks.UserPromptSubmit[0].hooks;
if (promptSubmit.length !== 1 || promptSubmit[0].command !== 'node route-intent.mjs') fail('other command hook changed');
if (!fs.readFileSync(skillPath, 'utf8').includes('argument-hint: "\\\"[repo 경로 ...]\\\" (생략 시 현재 작업 repo)"')) fail('argument-hint was not YAML-quoted');
console.log('PASS: Codex cache에서 prompt만 제거하고 command guard 유지');
NODE

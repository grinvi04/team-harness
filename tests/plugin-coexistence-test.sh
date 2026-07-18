#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECKER="$ROOT/scripts/check-plugin-coexistence.mjs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0
pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

tree_digest() {
  local target="$1"
  find -H "$target" -type f -print0 | sort -z | while IFS= read -r -d '' file; do
    printf '%s\0' "${file#"$target"/}"
    shasum -a 256 "$file" | awk '{print $1}'
  done | shasum -a 256 | awk '{print $1}'
}

make_plugin() {
  local root="$1" name="$2" skill="$3" matcher="$4"
  mkdir -p "$root/.claude-plugin" "$root/.codex-plugin" "$root/skills/$skill" "$root/hooks"
  printf '{"name":"%s","version":"1.0.0","description":"compat fixture"}\n' "$name" >"$root/.claude-plugin/plugin.json"
  printf '{"name":"%s","version":"1.0.0","description":"compat fixture"}\n' "$name" >"$root/.codex-plugin/plugin.json"
  printf -- '---\nname: %s\ndescription: compatibility fixture skill\n---\n' "$skill" >"$root/skills/$skill/SKILL.md"
  printf '{"hooks":{"PreToolUse":[{"matcher":"%s","hooks":[{"type":"command","command":"true"}]}]}}\n' "$matcher" >"$root/hooks/hooks.json"
}

mkdir -p "$TMP/external"
make_plugin "$TMP/external/other-plugin" other-plugin plan Bash

node "$ROOT/scripts/manage-profile.mjs" install --profile workflow-assisted --runtime claude --target "$TMP/claude-profile" >/dev/null
PROFILE_BEFORE="$(tree_digest "$TMP/claude-profile")"
EXTERNAL_BEFORE="$(tree_digest "$TMP/external")"

if node "$CHECKER" --profile "$TMP/claude-profile" --plugins "$TMP/external" --json >"$TMP/report.json"; then
  pass 'Claude workflow profile과 외부 plugin 공존'
else
  fail 'Claude workflow profile과 외부 plugin 공존'
fi

if node - "$TMP/report.json" <<'NODE'
const fs = require('fs')
const report = JSON.parse(fs.readFileSync(process.argv[2]))
const skills = new Set(report.skills.map((entry) => entry.identity))
if (!report.compatible || report.profile.runtime !== 'claude' || report.profile.packages !== 3) process.exit(1)
if (!skills.has('harness-workflows:plan') || !skills.has('other-plugin:plan')) process.exit(1)
if (!report.hookOverlaps.some((entry) => entry.event === 'PreToolUse' && entry.matcher === 'Bash' && entry.resolution === 'delegated')) process.exit(1)
if (Object.hasOwn(report, 'winner') || Object.hasOwn(report, 'priority')) process.exit(1)
NODE
then
  pass '동일 skill namespace 공존·hook 순서 위임'
else
  fail '동일 skill namespace 공존·hook 순서 위임'
fi

if [[ "$PROFILE_BEFORE" = "$(tree_digest "$TMP/claude-profile")" && "$EXTERNAL_BEFORE" = "$(tree_digest "$TMP/external")" ]]; then
  pass '검사 전후 profile·외부 plugin digest 불변'
else
  fail '검사 전후 profile·외부 plugin digest 불변'
fi

node "$ROOT/scripts/manage-profile.mjs" install --profile repository-only --target "$TMP/repository-profile" >/dev/null
if node "$CHECKER" --profile "$TMP/repository-profile" --plugins "$TMP/external" --json >"$TMP/repository.json" \
  && node -e "const r=require(process.argv[1]);process.exit(r.profile.packages===1&&r.profile.runtime===null?0:1)" "$TMP/repository.json"; then
  pass 'repository-only clean session matrix'
else
  fail 'repository-only clean session matrix'
fi

node "$ROOT/scripts/manage-profile.mjs" install --profile agent-governed --runtime codex --target "$TMP/codex-profile" >/dev/null
if node "$CHECKER" --profile "$TMP/codex-profile" --plugins "$TMP/external" --json >"$TMP/codex.json" \
  && node -e "const r=require(process.argv[1]);process.exit(r.profile.packages===2&&r.profile.runtime==='codex'?0:1)" "$TMP/codex.json"; then
  pass 'Codex agent-governed clean session matrix'
else
  fail 'Codex agent-governed clean session matrix'
fi

mkdir -p "$TMP/duplicate"
make_plugin "$TMP/duplicate/one" duplicate-plugin alpha Read
make_plugin "$TMP/duplicate/two" duplicate-plugin beta Write
if node "$CHECKER" --profile "$TMP/repository-profile" --plugins "$TMP/duplicate" --json >"$TMP/out" 2>"$TMP/err"; then
  fail 'duplicate plugin identity 거부'
elif grep -q 'duplicate plugin identity' "$TMP/err"; then
  pass 'duplicate plugin identity 거부'
else
  fail 'duplicate plugin identity 오류 근거'
fi

mkdir -p "$TMP/mismatch"
make_plugin "$TMP/mismatch/plugin" claude-name alpha Read
printf '{"name":"codex-name","version":"1.0.0"}\n' >"$TMP/mismatch/plugin/.codex-plugin/plugin.json"
if node "$CHECKER" --profile "$TMP/repository-profile" --plugins "$TMP/mismatch" --json >"$TMP/out" 2>"$TMP/err"; then
  fail 'runtime manifest identity mismatch 거부'
elif grep -q 'manifest identity mismatch' "$TMP/err"; then
  pass 'runtime manifest identity mismatch 거부'
else
  fail 'runtime manifest mismatch 오류 근거'
fi

mkdir -p "$TMP/symlinked"
ln -s "$TMP/external/other-plugin" "$TMP/symlinked/linked-plugin"
if node "$CHECKER" --profile "$TMP/repository-profile" --plugins "$TMP/symlinked" --json >"$TMP/out" 2>"$TMP/err"; then
  fail 'symlink plugin root 거부'
elif grep -q 'symlink' "$TMP/err"; then
  pass 'symlink plugin root 거부'
else
  fail 'symlink plugin 오류 근거'
fi

mkdir -p "$TMP/malformed/plugin/.claude-plugin" "$TMP/malformed/plugin/.codex-plugin"
printf '{broken\n' >"$TMP/malformed/plugin/.claude-plugin/plugin.json"
printf '{"name":"malformed-plugin"}\n' >"$TMP/malformed/plugin/.codex-plugin/plugin.json"
if node "$CHECKER" --profile "$TMP/repository-profile" --plugins "$TMP/malformed" --json >"$TMP/out" 2>"$TMP/err"; then
  fail 'malformed manifest 거부'
elif grep -q 'invalid JSON' "$TMP/err"; then
  pass 'malformed manifest 거부'
else
  fail 'malformed manifest 오류 근거'
fi

if ! grep -Eq "from 'node:(child_process|os)'|homedir\(|execFile(Sync)?\(" "$CHECKER"; then
  pass '검사기가 subprocess·HOME에 비의존'
else
  fail '검사기가 subprocess·HOME에 비의존'
fi

echo "RESULT: $PASS PASS, $FAIL FAIL"
[[ "$FAIL" -eq 0 ]]

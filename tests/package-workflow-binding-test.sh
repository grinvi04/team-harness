#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/team-harness-workflow-binding.XXXXXX")" || exit 1
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

if node "$ROOT/scripts/build-packages.mjs" --output "$TMP/output" >"$TMP/out" 2>"$TMP/err"; then
  pass "workflow binding artifact 조립"
else
  fail "workflow binding artifact 조립 실패"
  sed 's/^/  /' "$TMP/err"
fi

WORKFLOW="$TMP/output/harness-workflows"
if grep -Fq '${HARNESS_GOVERNANCE_CORE_ROOT}' "$WORKFLOW/skills/loop/SKILL.md" \
  && grep -Fq '${HARNESS_GOVERNANCE_CORE_ROOT}' "$WORKFLOW/skills/milestone/SKILL.md" \
  && ! grep -Fq '${CLAUDE_PLUGIN_ROOT' "$WORKFLOW/skills/loop/SKILL.md" \
  && ! grep -Fq '${CLAUDE_PLUGIN_ROOT' "$WORKFLOW/skills/milestone/SKILL.md"; then
  pass "workflow가 adapter-local 경로 대신 governance core binding 사용"
else
  fail "workflow에 깨지는 plugin-local core 참조 잔존"
fi

if python3 - "$WORKFLOW/harness-package.json" <<'PY'
import json
from pathlib import Path
import sys

data = json.loads(Path(sys.argv[1]).read_text())
actual = {
    (item.get("consumer"), item.get("environment"), item.get("unit"), item.get("target"))
    for item in data.get("runtimeBindings", [])
}
expected = {
    ("skills/loop/SKILL.md", "HARNESS_GOVERNANCE_CORE_ROOT", "governance-core", "scripts/run-with-timeout.mjs"),
    ("skills/loop/SKILL.md", "HARNESS_GOVERNANCE_CORE_ROOT", "governance-core", "scripts/worktree-fingerprint.mjs"),
    ("skills/milestone/SKILL.md", "HARNESS_GOVERNANCE_CORE_ROOT", "governance-core", "scripts/pr-create.sh"),
}
raise SystemExit(0 if actual == expected and data.get("installable") is False else 1)
PY
then
  pass "workflow metadata가 core script binding 3개 명시"
else
  fail "workflow runtime binding metadata 불완전"
fi

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

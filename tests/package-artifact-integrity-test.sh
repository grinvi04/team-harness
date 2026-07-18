#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILDER="$ROOT/scripts/build-packages.mjs"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/team-harness-package-integrity.XXXXXX")" || exit 1
GUARD="$ROOT/plugins/harness-guard/scripts/guard.sh"
BACKUP="$TMP/guard.sh"
PASS=0
FAIL=0

cp "$GUARD" "$BACKUP"
cleanup() {
  cp "$BACKUP" "$GUARD"
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM HUP

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

printf '\n# package-integrity dirty worktree sentinel\n' >>"$GUARD"
if node "$BUILDER" --output "$TMP/output" >"$TMP/out" 2>"$TMP/err"; then
  pass "dirty worktree에서도 recorded revision artifact 조립"
else
  fail "dirty worktree artifact 조립 실패"
  sed 's/^/  /' "$TMP/err"
fi

ARTIFACT_GUARD="$TMP/output/harness-governance-core/scripts/guard.sh"
if git -C "$ROOT" show HEAD:plugins/harness-guard/scripts/guard.sh | cmp -s - "$ARTIFACT_GUARD"; then
  pass "artifact source가 working tree가 아니라 recorded HEAD와 일치"
else
  fail "artifact source가 recorded HEAD와 다름"
fi

if grep -Fq 'package-integrity dirty worktree sentinel' "$ARTIFACT_GUARD" 2>/dev/null; then
  fail "dirty worktree 내용이 artifact에 혼입"
else
  pass "dirty worktree 내용 미혼입"
fi

HOOKS="$TMP/output/harness-claude-adapter/hooks/hooks.json"
if grep -Fq '${HARNESS_GOVERNANCE_CORE_ROOT}' "$HOOKS" \
  && ! grep -Fq '${CLAUDE_PLUGIN_ROOT}/scripts/guard.sh' "$HOOKS" \
  && ! grep -Fq '${CLAUDE_PLUGIN_ROOT}/scripts/route-intent.mjs' "$HOOKS"; then
  pass "Claude hook이 명시적 governance core binding 사용"
else
  fail "Claude hook에 깨지는 adapter-local core 참조 잔존"
fi

if python3 - "$TMP/output/harness-claude-adapter/harness-package.json" <<'PY'
import json
from pathlib import Path
import sys

data = json.loads(Path(sys.argv[1]).read_text())
bindings = data.get("runtimeBindings", [])
expected = {
    ("HARNESS_GOVERNANCE_CORE_ROOT", "governance-core", "scripts/guard.sh"),
    ("HARNESS_GOVERNANCE_CORE_ROOT", "governance-core", "scripts/route-intent.mjs"),
}
actual = {(item.get("environment"), item.get("unit"), item.get("target")) for item in bindings}
raise SystemExit(0 if actual == expected and data.get("installable") is False else 1)
PY
then
  pass "artifact metadata가 미해결 runtime binding·설치불가 상태 명시"
else
  fail "artifact runtime binding metadata 불완전"
fi

cp "$BACKUP" "$GUARD"
if cmp -s "$BACKUP" "$GUARD"; then
  pass "검증 후 source worktree 복구"
else
  fail "검증 후 source worktree 미복구"
fi

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

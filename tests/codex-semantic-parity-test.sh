#!/usr/bin/env bash
# Every harness-owned runtime surface must be classified in the Codex parity matrix.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MATRIX="$ROOT/docs/specs/codex-guard-compatibility.md"
FAIL=0

check() {
  local label="$1" needle="$2"
  if rg -Fq "$needle" "$MATRIX"; then
    echo "PASS: $label"
  else
    echo "FAIL: matrix missing $label ($needle)"
    FAIL=1
  fi
}

check "Bash command guard" '`hooks/hooks.json:PreToolUse:Bash:command`'
check "Bash prompt egress guard" '`hooks/hooks.json:PreToolUse:Bash:prompt`'
check "Agent matcher" '`hooks/hooks.json:PreToolUse:Agent`'
check "prompt router" '`hooks/hooks.json:UserPromptSubmit`'

for path in \
  scripts/codex-security-guidance-adapter.mjs \
  scripts/patch-codex-security-guidance.mjs \
  scripts/patch-codex-harness-guard.mjs \
  scripts/pr-create.sh \
  scripts/pr-merge.sh \
  scripts/solo-merge.sh \
  agents/security-reviewer.md \
  agents/verifier.md; do
  check "$path" "\`$path\`"
done

for skill in "$ROOT"/plugins/harness-guard/skills/*/SKILL.md; do
  rel="${skill#"$ROOT/plugins/harness-guard/"}"
  check "$rel" "\`$rel\`"
done

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "PASS: 모든 harness-owned surface가 Codex parity matrix에 분류됨"

#!/usr/bin/env bash
# Claude-specific execution annotations in skills need an explicit Codex mapping.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

for skill in \
  feature-add feature-modify hotfix loop milestone plan pr-review-gate qa release release-check solo-merge; do
  path="$ROOT/plugins/harness-guard/skills/$skill/SKILL.md"
  if grep -Fq '## Codex 실행' "$path"; then
    echo "PASS: $skill Codex 실행 규칙"
  else
    echo "FAIL: $skill Codex 실행 규칙 누락"
    FAIL=1
  fi
done

[ "$FAIL" -eq 0 ]

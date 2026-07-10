#!/usr/bin/env bash
# Claude-specific execution annotations in skills need an explicit Codex mapping.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

for skill in \
  feature-add feature-merge feature-modify hotfix loop milestone plan pr-create pr-review-gate qa release release-check repo-sync solo-merge; do
  path="$ROOT/plugins/harness-guard/skills/$skill/SKILL.md"
  if grep -Fq '## Codex 실행' "$path" && grep -Fq 'Codex' "$path"; then
    echo "PASS: $skill Codex 실행 규칙"
  else
    echo "FAIL: $skill Codex 실행 규칙 누락"
    FAIL=1
  fi
done

for agent in harness-explorer harness-verifier harness-security-reviewer; do
  path="$ROOT/plugins/harness-guard/codex/agents/$agent.toml"
  if grep -Eq '^name = "harness-[a-z-]+"$' "$path" \
    && grep -Eq '^model = "gpt-5\.6(-terra)?"$' "$path" \
    && grep -Eq '^model_reasoning_effort = "(medium|high)"$' "$path" \
    && grep -Fq 'sandbox_mode = "read-only"' "$path" \
    && grep -Fq 'developer_instructions = """' "$path"; then
    echo "PASS: $agent Codex 모델·권한 매핑"
  else
    echo "FAIL: $agent Codex 모델·권한 매핑 누락"
    FAIL=1
  fi
done

[ "$FAIL" -eq 0 ]

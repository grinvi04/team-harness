#!/usr/bin/env bash
# Claude-specific execution annotations in skills need an explicit Codex mapping.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

for path in "$ROOT"/plugins/harness-guard/skills/*/SKILL.md; do
  skill=$(basename "$(dirname "$path")")
  overlay="$ROOT/plugins/harness-guard/codex/skill-overlays/$skill.md"
  if ! grep -Fq '## Codex 실행' "$path" \
    && ! grep -Fq 'CODEX_PLUGIN_ROOT' "$path" \
    && grep -Fq '## Codex 실행' "$overlay" \
    && grep -Fq 'Codex' "$overlay"; then
    echo "PASS: $skill Claude 원본·Codex overlay 격리"
  else
    echo "FAIL: $skill Codex 실행 규칙 누락"
    FAIL=1
  fi
done

if grep -Fq '적용 skill과 현재 phase' "$ROOT/AGENTS.md" \
  && grep -Fq '적용 skill과 현재 phase' "$ROOT/templates/AGENTS.md" \
  && ! grep -Fq 'Skill 도구로 실제 호출' "$ROOT/plugins/harness-guard/scripts/route-intent.mjs"; then
  echo "PASS: Codex skill 실행 가시성·도구 중립 라우팅"
else
  echo "FAIL: Codex skill 실행 가시성·도구 중립 라우팅 누락"
  FAIL=1
fi

for agent in harness-explorer harness-verifier harness-security-reviewer; do
  path="$ROOT/plugins/harness-guard/codex/agents/$agent.toml"
  effort="high"; [ "$agent" = "harness-explorer" ] && effort="low"
  if grep -Eq '^name = "harness-[a-z-]+"$' "$path" \
    && ! grep -Eq '^model[[:space:]]*=' "$path" \
    && grep -Fq "model_reasoning_effort = \"$effort\"" "$path" \
    && grep -Fq 'sandbox_mode = "read-only"' "$path" \
    && grep -Fq 'developer_instructions = """' "$path"; then
    echo "PASS: $agent Codex 모델·권한 매핑"
  else
    echo "FAIL: $agent Codex 모델·권한 매핑 누락"
    FAIL=1
  fi
done

[ "$FAIL" -eq 0 ]

#!/usr/bin/env bash
# Shared skill contracts need a source-native Codex wrapper without custom agents.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

for path in "$ROOT"/plugins/harness-guard/skills/*/SKILL.md; do
  skill=$(basename "$(dirname "$path")")
  wrapper="$ROOT/plugins/harness-guard/codex/skills/$skill/SKILL.md"
  if ! grep -Fq '## Codex 실행' "$path" \
    && ! grep -Fq 'CODEX_PLUGIN_ROOT' "$path" \
    && grep -Fq '## Codex 실행' "$wrapper" \
    && grep -Fq "../../../skills/$skill/SKILL.md" "$wrapper"; then
    echo "PASS: $skill Claude 원본·Codex native wrapper 격리"
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

if ! find "$ROOT/plugins/harness-guard/codex" -type f -print | grep -Eq '/(agents|skill-overlays)/' \
  && ! rg -n 'harness-(explorer|verifier|security-reviewer)' "$ROOT/plugins/harness-guard/codex/skills"; then
  echo "PASS: Codex custom agent·cache overlay 의존 제거"
else
  echo "FAIL: Codex custom agent 또는 cache overlay 의존 잔존"
  FAIL=1
fi

[ "$FAIL" -eq 0 ]

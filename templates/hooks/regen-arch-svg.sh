#!/bin/bash
# PostToolUse 훅 — docs/gen_arch_svg.py 저장 시 docs/architecture.svg 자동 재생성.
# 단일 출처: team-harness/templates/hooks/regen-arch-svg.sh (architecture-diagram-standards.md §9).
# 프로젝트 .claude/hooks/regen-arch-svg.sh로 복사하고 settings.json PostToolUse(Edit|Write|MultiEdit)에 배선.
FILE=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null)
echo "$FILE" | grep -q 'docs/gen_arch_svg\.py$' || exit 0
python3 "${CLAUDE_PROJECT_DIR}/docs/gen_arch_svg.py" 2>&1

#!/usr/bin/env bash
# Claude Code·Codex implicit invocation이 공통으로 읽는 description 경계 계약.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

python3 - "$ROOT" <<'PY' || FAIL=1
from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
skills = sorted((root / "plugins/harness-guard/skills").glob("*/SKILL.md"))
assert len(skills) == 16, f"expected 16 skills, got {len(skills)}"

for path in skills:
    text = path.read_text(encoding="utf-8")
    front = text.split("---", 2)[1]
    match = re.search(r"^description:\s*(.+)$", front, re.M)
    assert match, f"{path}: description missing"
    description = match.group(1).strip().strip("'\"")
    assert "사용" in description, f"{path}: automatic use trigger missing"
    assert "제외" in description, f"{path}: exclusion boundary missing"
    assert len(description) <= 260, f"{path}: description too long ({len(description)})"
    assert not re.search(r"^disable-model-invocation:\s*true\s*$", front, re.M), f"{path}: implicit invocation disabled"
    print(f"PASS: {path.parent.name} trigger·제외 경계")
PY

if grep -Fq 'implicit invocation' "$ROOT/docs/ai-collaboration.md" \
  && grep -Fq 'route-intent' "$ROOT/docs/ai-collaboration.md" \
  && grep -Fq '권한' "$ROOT/docs/ai-collaboration.md"; then
  echo "PASS: 자동 선택·상태 라우팅·권한 불변 문서화"
else
  echo "FAIL: 자동 선택 계약 문서화 누락"
  FAIL=1
fi

bash "$ROOT/tests/route-intent-test.sh" >/dev/null || { echo "FAIL: route-intent 잠금 회귀"; FAIL=1; }

[ "$FAIL" -eq 0 ]

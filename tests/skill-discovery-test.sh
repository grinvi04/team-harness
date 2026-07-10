#!/bin/bash
# tests/skill-discovery-test.sh — 플러그인 스킬 매니페스트는 SKILL.md(대문자)여야 Claude Code가 발견한다.
# commands/→skills/ 이전 잔재인 소문자 skill.md가 /release·/feature-merge 등을 "발견 불가"로 만들던 회귀 방지.
# git ls-files로 대소문자 정확히 검사(macOS 케이스-무관 FS에서 [ -f ]는 skill.md도 매치하므로 우회).
# 로컬·CI 동일: bash tests/skill-discovery-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
PASS=0; FAIL=0
TRACKED=$(git ls-files plugins/harness-guard/skills/)

validate_frontmatter() {
  python3 - "$1" <<'PY'
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    lines = f.read().splitlines()

if not lines or lines[0].strip() != "---":
    print(f"FAIL: {path}: frontmatter 시작 --- 없음")
    sys.exit(1)

for idx, line in enumerate(lines[1:], start=2):
    if line.strip() == "---":
        sys.exit(0)
    if not line.strip() or line.lstrip().startswith("#"):
        continue

    match = re.match(r"^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$", line)
    if not match:
        print(f"FAIL: {path}:{idx}: frontmatter key/value 형식 아님: {line}")
        sys.exit(1)

    value = (match.group(2) or "").strip()
    if not value or value[0] not in "'\"":
        continue

    quote = value[0]
    i = 1
    escaped = False
    while i < len(value):
        char = value[i]
        if quote == "'":
            if char == "'":
                if i + 1 < len(value) and value[i + 1] == "'":
                    i += 2
                    continue
                break
        else:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                break
        i += 1

    if i >= len(value):
        print(f"FAIL: {path}:{idx}: quoted scalar 닫힘 없음: {line}")
        sys.exit(1)

    trailing = value[i + 1 :].strip()
    if trailing and not trailing.startswith("#"):
        print(f"FAIL: {path}:{idx}: quoted scalar 뒤 trailing text: {line}")
        sys.exit(1)

print(f"FAIL: {path}: frontmatter 종료 --- 없음")
sys.exit(1)
PY
}

# 1) 소문자 skill.md 트래킹 파일 0개 (있으면 그 스킬은 발견 불가)
lower=$(printf '%s\n' "$TRACKED" | grep -E '/skill\.md$' || true)
if [ -z "$lower" ]; then
  echo "PASS: 소문자 skill.md 트래킹 0개"; PASS=$((PASS+1))
else
  echo "FAIL: 발견 불가한 소문자 skill.md 존재:"; printf '  %s\n' "$lower"; FAIL=$((FAIL+1))
fi

# 2) 각 스킬 디렉터리에 SKILL.md(대문자) 매니페스트 존재
for d in $(printf '%s\n' "$TRACKED" | sed -E 's#(plugins/harness-guard/skills/[^/]+)/.*#\1#' | sort -u); do
  [ -n "$d" ] || continue
  if printf '%s\n' "$TRACKED" | grep -qxE "$d/SKILL\.md"; then
    PASS=$((PASS+1))
  else
    echo "FAIL: $d 에 SKILL.md 없음"; FAIL=$((FAIL+1))
  fi
done

# 3) SKILL.md frontmatter가 Codex/Claude 양쪽 YAML 파서에서 깨지지 않는 quote 형태인지 검사.
frontmatter_fail=0
for f in $(printf '%s\n' "$TRACKED" | grep -E '/SKILL\.md$' | sort); do
  if ! validate_frontmatter "$f"; then
    frontmatter_fail=1
  fi
done
if [ "$frontmatter_fail" -eq 0 ]; then
  echo "PASS: 모든 SKILL.md frontmatter quote 호환"
  PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

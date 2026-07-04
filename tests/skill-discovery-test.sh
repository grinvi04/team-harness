#!/bin/bash
# tests/skill-discovery-test.sh — 플러그인 스킬 매니페스트는 SKILL.md(대문자)여야 Claude Code가 발견한다.
# commands/→skills/ 이전 잔재인 소문자 skill.md가 /release·/feature-merge 등을 "발견 불가"로 만들던 회귀 방지.
# git ls-files로 대소문자 정확히 검사(macOS 케이스-무관 FS에서 [ -f ]는 skill.md도 매치하므로 우회).
# 로컬·CI 동일: bash tests/skill-discovery-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
PASS=0; FAIL=0
TRACKED=$(git ls-files plugins/harness-guard/skills/)

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

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

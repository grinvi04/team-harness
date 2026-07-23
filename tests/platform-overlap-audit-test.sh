#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="$ROOT/docs/platform-overlap-audit.md"
SPEC="$ROOT/docs/specs/platform-overlap-audit.md"
README="$ROOT/README.md"
PRODUCT="$ROOT/docs/product-direction.md"
DECISIONS="$ROOT/docs/decisions.md"
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }
contains() { grep -Fq -- "$2" "$1" 2>/dev/null; }

if [ -f "$REPORT" ]; then
  pass "플랫폼 중복 감사 정본 존재"
else
  fail "docs/platform-overlap-audit.md 누락"
fi

for heading in \
  "## 감사 기준과 범위" \
  "## 전수 분류" \
  "## 목표 구조" \
  "## 전환 순서" \
  "## 잔여 위험과 재검토 조건"
do
  if contains "$REPORT" "$heading"; then
    pass "감사 보고서 섹션: $heading"
  else
    fail "감사 보고서 섹션 누락: $heading"
  fi
done

if [ -f "$REPORT" ] && python3 - "$ROOT" "$REPORT" <<'PY'
from collections import Counter
from pathlib import Path
import json
import re
import sys

root = Path(sys.argv[1])
report = Path(sys.argv[2]).read_text()

expected = []
for path in sorted((root / "plugins/harness-guard/skills").glob("*/SKILL.md")):
    expected.append(f"skill:{path.parent.name}")
for base in (root / "plugins/harness-guard/agents",):
    for path in sorted(p for p in base.iterdir() if p.is_file()):
        expected.append(f"agent:{path.relative_to(root).as_posix()}")

hooks = json.loads((root / "plugins/harness-guard/hooks/hooks.json").read_text())["hooks"]
for event, groups in hooks.items():
    for group_index, group in enumerate(groups, 1):
        matcher = group.get("matcher", "*")
        for handler_index, handler in enumerate(group.get("hooks", []), 1):
            expected.append(
                f"hook:{event}:{group_index}:{matcher}:{handler_index}:{handler['type']}"
            )

codex_runtime_pattern = re.compile(
    r"CODEX_BIN|^[ \t]*(?:(?:exec|command)[ \t]+)?codex(?:[ \t]|$)|"
    r"(?:install|patch|sync)-codex|codex-(?:fresh-session|hardened)",
    re.IGNORECASE | re.MULTILINE,
)
for direct_invocation in ("codex features list", "codex --version", "exec codex plugin list"):
    if not codex_runtime_pattern.search(direct_invocation):
        raise SystemExit(f"FAIL: direct Codex CLI invocation not detected: {direct_invocation}")
if codex_runtime_pattern.search("detail: Codex documentation pointer"):
    raise SystemExit("FAIL: prose-only Codex mention treated as runtime invocation")
for base in (root / "plugins/harness-guard/scripts", root / "scripts"):
    for path in sorted(p for p in base.iterdir() if p.is_file()):
        if "codex" in path.name.lower() or codex_runtime_pattern.search(path.read_text(errors="ignore")):
            expected.append(f"codex-file:{path.relative_to(root).as_posix()}")

rows = re.findall(
    r"^\| `((?:skill|agent|hook|codex-file):[^`]+)` \| \*\*(소유|연결|위임)\*\* \| ([^|]+) \| ([^|]+) \|$",
    report,
    re.MULTILINE,
)
expected_counts = Counter(expected)
counts = Counter(identifier for identifier, *_ in rows)

errors = []
if len([item for item in expected if item.startswith("skill:")]) != 16:
    errors.append("source skill count is not 16")
if len([item for item in expected if item.startswith("agent:")]) != 2:
    errors.append("source agent count is not 2")
if len([item for item in expected if item.startswith("hook:")]) != 4:
    errors.append("source hook count is not 4")
if len([item for item in expected if item.startswith("codex-file:")]) != 11:
    errors.append("source Codex compatibility file count is not 11")
if expected_counts != counts:
    errors.append(
        f"missing={sorted((expected_counts - counts).elements())} "
        f"extra={sorted((counts - expected_counts).elements())}"
    )
duplicates = sorted(identifier for identifier, count in counts.items() if count != 1)
if duplicates:
    errors.append(f"duplicate identifiers={duplicates}")
for identifier, decision, target, action in rows:
    if not target.strip() or not action.strip():
        errors.append(f"empty target/action={identifier}")

if errors:
    print("\n".join(f"FAIL: {error}" for error in errors))
    raise SystemExit(1)
print(f"PASS: implementation inventory classified exactly once ({len(expected)} items)")
PY
then
  pass "현재 구현 인벤토리 33개 전수 단일 판정"
else
  fail "현재 구현 인벤토리와 감사 분류 불일치"
fi

if contains "$REPORT" "소유" \
  && contains "$REPORT" "연결" \
  && contains "$REPORT" "위임"; then
  pass "소유·연결·위임 세 판정 사용"
else
  fail "소유·연결·위임 판정 중 누락"
fi

if contains "$REPORT" "공식 surface 검증" \
  && contains "$REPORT" "결과 동등성 테스트" \
  && contains "$REPORT" "문서·doctor 전환" \
  && contains "$REPORT" "호환 patch 제거"; then
  pass "보호 공백 없는 전환 순서"
else
  fail "공식 surface→동등성→전환→제거 순서 누락"
fi

route_line="$(grep -F 'hook:UserPromptSubmit:1:*:1:command' "$REPORT" 2>/dev/null || true)"
if printf '%s' "$route_line" | grep -Fq "상태 기반" \
  && printf '%s' "$route_line" | grep -Fq "의미 분류기"; then
  pass "route-intent 상태 기반 경계 고정"
else
  fail "route-intent 의미 분류기 비확장 결정 누락"
fi

line="$(grep -F 'codex-file:plugins/harness-guard/scripts/patch-codex-security-guidance.mjs' "$REPORT" 2>/dev/null || true)"
if printf '%s' "$line" | grep -Fq "제거"; then
  pass "외부 plugin patch 후속 제거 후보 유지"
else
  fail "외부 plugin patch 후속 판정 누락"
fi

line="$(grep -F 'codex-file:scripts/codex-hardened.sh' "$REPORT" 2>/dev/null || true)"
if printf '%s' "$line" | grep -Fq "얇게 유지"; then
  pass "native launcher 목표 상태 반영"
else
  fail "native launcher 목표 상태 누락"
fi

if contains "$README" "docs/platform-overlap-audit.md" \
  && contains "$PRODUCT" "[x] **플랫폼 중복 감사:**" \
  && contains "$PRODUCT" "platform-overlap-audit.md"; then
  pass "README·제품 로드맵에서 감사 정본 발견"
else
  fail "감사 정본 링크 또는 로드맵 완료 표시 누락"
fi

if contains "$DECISIONS" "spec: platform-overlap-audit.md"; then
  pass "결정 기록에서 감사 스펙 추적"
else
  fail "플랫폼 중복 감사 결정 기록 누락"
fi

if [ -f "$SPEC" ]; then
  pass "승인 스펙 존재"
else
  fail "플랫폼 중복 감사 스펙 누락"
fi

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

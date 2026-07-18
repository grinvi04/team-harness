#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOC="$ROOT/docs/product-boundaries.md"
SPEC="$ROOT/docs/specs/product-boundary-separation.md"
README="$ROOT/README.md"
PRODUCT="$ROOT/docs/product-direction.md"
DECISIONS="$ROOT/docs/decisions.md"
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }
contains() { grep -Fq -- "$2" "$1" 2>/dev/null; }

if [ -f "$DOC" ]; then
  pass "제품 경계 정본 존재"
else
  fail "docs/product-boundaries.md 누락"
fi

for heading in \
  "## 현재 전환 상태" \
  "## 목표 제품 단위" \
  "## Skill 설치 경계" \
  "## 설치 프로필" \
  "## 의존 방향" \
  "## 운영 수명주기" \
  "## 물리 분리 전환 순서" \
  "## 비목표와 재검토 조건"
do
  if contains "$DOC" "$heading"; then
    pass "제품 경계 섹션: $heading"
  else
    fail "제품 경계 섹션 누락: $heading"
  fi
done

if contains "$DOC" "전환기 monolith" \
  && contains "$DOC" "독립 설치 단위가 아니다"; then
  pass "현재 단일 번들 상태를 목표 구조와 구분"
else
  fail "현재 monolith 상태 또는 미분리 고지 누락"
fi

if [ -f "$DOC" ] && python3 - "$ROOT" "$DOC" <<'PY'
from collections import Counter
from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
document = Path(sys.argv[2]).read_text()
actual_skills = {
    path.parent.name
    for path in (root / "plugins/harness-guard/skills").glob("*/SKILL.md")
}
core = {
    "feature-merge", "hotfix", "pr-create", "pr-review-gate", "release-check",
    "release", "repo-sync", "solo-merge", "verification-before-completion",
}
workflow = {
    "feature-add", "feature-modify", "loop", "milestone", "plan", "qa",
    "systematic-debugging",
}
expected = {
    **{name: ("governance-core", "기본") for name in core},
    **{name: ("workflow-pack", "선택") for name in workflow},
}
rows = re.findall(
    r"^\| `skill:([^`]+)` \| \*\*(governance-core|workflow-pack)\*\* \| \*\*(기본|선택)\*\* \| [^|]+ \|$",
    document,
    re.MULTILINE,
)
counts = Counter(name for name, *_ in rows)
parsed = {name: (unit, activation) for name, unit, activation in rows}
errors = []
if actual_skills != set(expected):
    errors.append(f"source drift missing-policy={sorted(actual_skills - set(expected))} stale-policy={sorted(set(expected) - actual_skills)}")
if parsed != expected:
    errors.append(f"mapping mismatch expected={expected} actual={parsed}")
duplicates = sorted(name for name, count in counts.items() if count != 1)
if duplicates:
    errors.append(f"duplicate skill rows={duplicates}")
if len(actual_skills) != 16 or len(core) != 9 or len(workflow) != 7:
    errors.append("skill boundary counts are not total=16 core=9 workflow=7")
if errors:
    print("\n".join(f"FAIL: {error}" for error in errors))
    raise SystemExit(1)
print("PASS: 16 skills mapped exactly once (core=9, workflow=7)")
PY
then
  pass "16개 skill 목표 단위·활성화 전수 계약"
else
  fail "skill 집합 또는 제품 단위 배치 불일치"
fi

for unit in "governance-core" "native-adapter" "workflow-pack"; do
  if contains "$DOC" "unit:$unit"; then
    pass "제품 단위 정의: $unit"
  else
    fail "제품 단위 정의 누락: $unit"
  fi
done

recommended="$(grep -F 'profile:agent-governed' "$DOC" 2>/dev/null || true)"
if printf '%s' "$recommended" | grep -Fq "governance-core + 해당 native-adapter" \
  && ! printf '%s' "$recommended" | grep -Fq "workflow-pack"; then
  pass "권장 기본 profile은 선택 workflow에 비의존"
else
  fail "권장 기본 profile이 없거나 workflow-pack을 요구함"
fi

if contains "$DOC" "profile:repository-only" \
  && contains "$DOC" "profile:agent-governed" \
  && contains "$DOC" "profile:workflow-assisted"; then
  pass "세 설치 profile 정의"
else
  fail "설치 profile 누락"
fi

if contains "$DOC" "native-adapter → governance-core" \
  && contains "$DOC" "workflow-pack → governance-core" \
  && contains "$DOC" "governance-core ↛ native-adapter" \
  && contains "$DOC" "governance-core ↛ workflow-pack"; then
  pass "단방향 의존 계약"
else
  fail "의존 방향 또는 core 역의존 금지 누락"
fi

if contains "$DOC" "Claude adapter는 Codex adapter에 의존하지 않는다" \
  && contains "$DOC" "Codex adapter는 Claude adapter에 의존하지 않는다"; then
  pass "runtime adapter 상호 격리"
else
  fail "runtime adapter 상호 비의존 계약 누락"
fi

for lifecycle in "설치" "업데이트" "doctor" "비활성화" "제거"; do
  if grep -Eq "^\| \*\*$lifecycle\*\* \|" "$DOC" 2>/dev/null; then
    pass "운영 수명주기: $lifecycle"
  else
    fail "운영 수명주기 누락: $lifecycle"
  fi
done

if contains "$DOC" "branch protection" \
  && contains "$DOC" "required CI" \
  && contains "$DOC" "commit·PR·release gate" \
  && contains "$DOC" "repo drift" \
  && contains "$DOC" "audit·recovery"; then
  pass "workflow-pack 제거 후 core 불변조건"
else
  fail "core 불변조건 누락"
fi

if contains "$DOC" "계약 잠금" \
  && contains "$DOC" "manifest/package 분리" \
  && contains "$DOC" "profile 설치·doctor 검증" \
  && contains "$DOC" "호환 기간" \
  && contains "$DOC" "legacy 경로 제거"; then
  pass "가역적인 물리 분리 순서"
else
  fail "물리 분리 단계 누락"
fi

if contains "$README" "docs/product-boundaries.md" \
  && contains "$PRODUCT" "[x] **제품 경계 분리:**" \
  && contains "$PRODUCT" "product-boundaries.md"; then
  pass "README·제품 로드맵에서 경계 정본 발견"
else
  fail "제품 경계 링크 또는 로드맵 완료 표시 누락"
fi

if contains "$DECISIONS" "spec: product-boundary-separation.md"; then
  pass "결정 기록에서 경계 스펙 추적"
else
  fail "제품 경계 분리 결정 기록 누락"
fi

if [ -f "$SPEC" ]; then
  pass "승인 스펙 존재"
else
  fail "제품 경계 분리 스펙 누락"
fi

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

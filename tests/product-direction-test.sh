#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIRECTION="$ROOT/docs/product-direction.md"
README="$ROOT/README.md"
AGENTS="$ROOT/AGENTS.md"
DECISIONS="$ROOT/docs/decisions.md"
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }
contains() { grep -Fq -- "$2" "$1"; }

if [ -f "$DIRECTION" ]; then
  pass "제품 방향 정본 존재"
else
  fail "docs/product-direction.md 누락"
fi

for heading in \
  "## 제품 정체성" \
  "## Team Harness가 소유하는 것" \
  "## 실행 플랫폼에 위임하는 것" \
  "## 설계 원칙" \
  "## 신규 기능 판단 게이트" \
  "## 우선순위 로드맵"
do
  if [ -f "$DIRECTION" ] && contains "$DIRECTION" "$heading"; then
    pass "정본 섹션: $heading"
  else
    fail "정본 섹션 누락: $heading"
  fi
done

if [ -f "$DIRECTION" ] \
  && contains "$DIRECTION" "GitHub-native AI 코딩 거버넌스" \
  && contains "$DIRECTION" "policy as code" \
  && contains "$DIRECTION" "evidence-gated delivery"; then
  pass "제품 정체성 한 문장"
else
  fail "제품 정체성 계약 누락"
fi

if [ -f "$DIRECTION" ] \
  && contains "$DIRECTION" "native-first" \
  && contains "$DIRECTION" "thin adapter" \
  && contains "$DIRECTION" "outcome parity"; then
  pass "플랫폼 위임 설계 원칙"
else
  fail "native-first·thin adapter·outcome parity 누락"
fi

question_count="$(awk '
  /^## 신규 기능 판단 게이트$/ { in_gate=1; next }
  in_gate && /^## / { exit }
  in_gate && /^[0-9]+\. / { count++ }
  END { print count+0 }
' "$DIRECTION" 2>/dev/null)"
if [ -f "$DIRECTION" ] && [ "$question_count" -ge 5 ]; then
  pass "신규 기능 판단 질문 5개 이상"
else
  fail "신규 기능 판단 질문 부족"
fi

if contains "$README" "docs/product-direction.md"; then
  pass "README에서 제품 방향 발견 가능"
else
  fail "README 제품 방향 링크 누락"
fi

if contains "$AGENTS" "docs/product-direction.md" \
  && contains "$AGENTS" "신규 기능 판단 게이트"; then
  pass "AI 작업 계약에 제품 방향 게이트 연결"
else
  fail "AGENTS 제품 방향 게이트 누락"
fi

if contains "$DECISIONS" "spec: product-direction.md"; then
  pass "결정 기록에서 승인 스펙 추적"
else
  fail "제품 방향 결정 기록 누락"
fi

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

#!/usr/bin/env bash
# 대표 스킬의 발견 trigger와 fail-closed 실행 계약이 약화되지 않도록 고정한다.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

pass() {
  echo "PASS: $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "FAIL: $1"
  FAIL=$((FAIL + 1))
}

check_file() {
  local label=$1 path=$2
  if [ -f "$path" ]; then pass "$label"; else fail "$label ($path 없음)"; fi
}

check_contains() {
  local label=$1 path=$2 pattern=$3
  if [ -f "$path" ] && grep -Eq "$pattern" "$path"; then
    pass "$label"
  else
    fail "$label"
  fi
}

check_not_contains() {
  local label=$1 path=$2 pattern=$3
  if [ -f "$path" ] && ! grep -Eq "$pattern" "$path"; then
    pass "$label"
  else
    fail "$label"
  fi
}

DEBUG_DIR="$ROOT/plugins/harness-guard/skills/systematic-debugging"
DEBUG_SKILL="$DEBUG_DIR/SKILL.md"
DEBUG_UI="$DEBUG_DIR/agents/openai.yaml"
DEBUG_OVERLAY="$ROOT/plugins/harness-guard/codex/skill-overlays/systematic-debugging.md"

echo "=== systematic-debugging ==="
check_file "skill manifest 발견" "$DEBUG_SKILL"
check_file "Codex UI metadata 발견" "$DEBUG_UI"
check_file "Codex overlay 발견" "$DEBUG_OVERLAY"

check_contains "metadata가 실패·CI·빌드·런타임 trigger를 선언" "$DEBUG_SKILL" \
  '^description: .*실패.*CI.*빌드.*런타임'
check_contains "기대값과 실제값을 분리" "$DEBUG_SKILL" '기대.*실제'
check_contains "재현 명령과 종료 코드를 증거로 수집" "$DEBUG_SKILL" '재현.*명령.*종료 코드'
check_contains "사실과 추론을 분리" "$DEBUG_SKILL" '사실.*추론'
check_contains "가설을 최대 3개로 제한" "$DEBUG_SKILL" '최대 3개'
check_contains "가설마다 판별 실험을 요구" "$DEBUG_SKILL" '가설.*판별 실험'
check_contains "근본 원인 확정 전 수정 금지" "$DEBUG_SKILL" '근본 원인.*확정.*수정하지'
check_contains "진단 전용 요청은 작업트리 불변" "$DEBUG_SKILL" '진단 전용.*파일.*수정하지'
check_contains "수정 시 실행 가능한 RED 회귀 계약" "$DEBUG_SKILL" '자동 회귀 테스트.*실행 가능 검사.*RED'
check_contains "관련 없는 dirty worktree를 보존" "$DEBUG_SKILL" '관련 없는 미커밋 변경.*중단'
check_contains "원인 미확정이면 추측 수정 없이 중단" "$DEBUG_SKILL" '원인을 확정하지 못.*추측.*수정하지'

check_contains "UI default prompt가 skill을 명시" "$DEBUG_UI" \
  'default_prompt:.*\$systematic-debugging'
check_contains "Codex 실행 의미는 overlay에 격리" "$DEBUG_OVERLAY" '^## Codex 실행$'
if [ -f "$DEBUG_SKILL" ] && ! grep -Fq '## Codex 실행' "$DEBUG_SKILL"; then
  pass "Claude source에 Codex 실행 문단 없음"
else
  fail "Claude source에 Codex 실행 문단 없음"
fi

VERIFY_DIR="$ROOT/plugins/harness-guard/skills/verification-before-completion"
VERIFY_SKILL="$VERIFY_DIR/SKILL.md"
VERIFY_UI="$VERIFY_DIR/agents/openai.yaml"
VERIFY_OVERLAY="$ROOT/plugins/harness-guard/codex/skill-overlays/verification-before-completion.md"

echo ""
echo "=== verification-before-completion ==="
check_file "skill manifest 발견" "$VERIFY_SKILL"
check_file "Codex UI metadata 발견" "$VERIFY_UI"
check_file "Codex overlay 발견" "$VERIFY_OVERLAY"

check_contains "metadata가 확인·검증·완료·PR·머지·릴리즈 trigger를 선언" "$VERIFY_SKILL" \
  '^description: .*확인.*검증.*완료.*PR.*머지.*릴리즈'
check_contains "완료 주장을 관찰 가능한 증거에 매핑" "$VERIFY_SKILL" '주장.*관찰 가능한 증거'
check_contains "작업트리와 HEAD SHA를 구분" "$VERIFY_SKILL" '현재 작업트리.*HEAD SHA'
check_contains "CI·배포 증거의 SHA 일치를 확인" "$VERIFY_SKILL" 'CI.*배포.*SHA.*일치'
check_contains "적용 불가 검증은 사유와 함께 SKIP" "$VERIFY_SKILL" '적용 불가.*SKIP.*이유'
check_contains "명령과 종료 코드를 새로 수집" "$VERIFY_SKILL" '명령.*종료 코드.*새로'
check_contains "실패·미확인이면 완료 판정 차단" "$VERIFY_SKILL" '실패.*미확인.*완료.*판정하지'
check_contains "직접 호출 실패는 무수정 중단" "$VERIFY_SKILL" '직접 호출.*파일을 수정하지.*중단'
check_contains "호출 workflow가 최종 판정을 소유" "$VERIFY_SKILL" '호출 workflow.*최종 판정.*소유'
check_contains "verifier는 선택적 독립 반증 역할" "$VERIFY_SKILL" 'verifier.*선택적.*독립.*반증'
check_contains "verifier가 수정·커밋·머지하지 않음" "$VERIFY_SKILL" 'verifier.*수정.*커밋.*머지하지'
check_contains "운영 변경을 검증으로 사용 금지" "$VERIFY_SKILL" '운영 DB.*운영 인프라.*변경하지'

check_contains "UI default prompt가 skill을 명시" "$VERIFY_UI" \
  'default_prompt:.*\$verification-before-completion'
check_contains "Codex 실행 의미는 overlay에 격리" "$VERIFY_OVERLAY" '^## Codex 실행$'
if [ -f "$VERIFY_SKILL" ] && ! grep -Fq '## Codex 실행' "$VERIFY_SKILL"; then
  pass "Claude source에 Codex 실행 문단 없음"
else
  fail "Claude source에 Codex 실행 문단 없음"
fi

README="$ROOT/README.md"
DEVELOPER_GUIDE="$ROOT/docs/developer-workflow.md"
INTRO="$ROOT/docs/intro.html"
DECISIONS="$ROOT/docs/decisions.md"
MANIFEST="$ROOT/plugins/harness-guard/.claude-plugin/plugin.json"
CI="$ROOT/.github/workflows/ci-gate.yml"

echo ""
echo "=== docs, CI, version ==="
check_contains "plugin manifest v0.60.0" "$MANIFEST" '"version": "0\.60\.0"'
check_contains "manifest가 두 대표 스킬을 설명" "$MANIFEST" \
  'systematic-debugging.*verification-before-completion'
check_contains "README badge v0.60.0" "$README" 'harness--guard_v0\.60\.0'
check_contains "README가 systematic-debugging 안내" "$README" '/systematic-debugging'
check_contains "README가 verification-before-completion 안내" "$README" \
  '/verification-before-completion'
check_contains "개발자 가이드가 systematic-debugging 안내" "$DEVELOPER_GUIDE" \
  'systematic-debugging'
check_contains "개발자 가이드가 verification-before-completion 안내" "$DEVELOPER_GUIDE" \
  'verification-before-completion'
check_contains "소개 페이지가 스킬 16종 안내" "$INTRO" '스킬 16종'
check_not_contains "소개 페이지에 스킬 14종 잔재 없음" "$INTRO" '스킬 14종'
check_contains "소개 페이지 v0.60.0" "$INTRO" 'harness-guard v0\.60\.0'
check_contains "소개 페이지가 systematic-debugging 안내" "$INTRO" '/systematic-debugging'
check_contains "소개 페이지가 verification-before-completion 안내" "$INTRO" \
  '/verification-before-completion'
check_contains "결정 기록이 v0.56.0과 두 스킬을 연결" "$DECISIONS" \
  'systematic-debugging.*verification-before-completion.*0\.56\.0'
check_contains "CI가 flagship test 구문 검사" "$CI" \
  'bash -n tests/flagship-skills-test\.sh'
check_contains "CI가 flagship test 실행" "$CI" 'run: bash tests/flagship-skills-test\.sh'

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

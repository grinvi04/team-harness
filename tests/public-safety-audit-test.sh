#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="$ROOT/docs/public-safety-audit.md"
SPEC="$ROOT/docs/specs/public-safety-audit.md"
README="$ROOT/README.md"
PRODUCT="$ROOT/docs/product-direction.md"
DECISIONS="$ROOT/docs/decisions.md"
CI="$ROOT/.github/workflows/ci-gate.yml"
LICENSE="$ROOT/LICENSE"
GITIGNORE="$ROOT/.gitignore"
PRE_COMMIT="$ROOT/.githooks/pre-commit"
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }
contains() { grep -Fq -- "$2" "$1" 2>/dev/null; }

if [ -f "$REPORT" ]; then
  pass "공개 안전성 감사 정본 존재"
else
  fail "docs/public-safety-audit.md 누락"
fi

for heading in \
  "## 감사 대상과 기준" \
  "## 검증 결과" \
  "## 조치 사항" \
  "## 잔여 위험과 한계" \
  "## 최종 판정"
do
  if contains "$REPORT" "$heading"; then
    pass "감사 보고서 섹션: $heading"
  else
    fail "감사 보고서 섹션 누락: $heading"
  fi
done

if contains "$REPORT" "409312d16d1e051ec41091e7284391aeafe7d621" \
  && contains "$REPORT" "gitleaks 8.30.1" \
  && contains "$REPORT" '--log-opts="--all"' \
  && contains "$REPORT" "--redact=100" \
  && contains "$REPORT" "696" \
  && contains "$REPORT" "350"; then
  pass "감사 기준 SHA·도구·전체 refs 증거"
else
  fail "감사 기준 SHA·도구·전체 refs 증거 누락"
fi

if contains "$REPORT" "PASS" && contains "$REPORT" "ACCEPTED"; then
  pass "축별 판정 상태 기록"
else
  fail "PASS·ACCEPTED 판정 누락"
fi

tracked_paths="$(git -C "$ROOT" ls-files)"
if printf '%s\n' "$tracked_paths" \
  | grep -Eiq '(^|/)(\.env($|\.)|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$|credentials?(\.|$)|secrets?(\.|$)|.*\.(pem|key|p12|pfx|jks|keystore)$)'; then
  fail "민감 파일 유형이 Git에 tracked됨"
else
  pass "민감 tracked 파일 0"
fi

if contains "$GITIGNORE" ".env" \
  && contains "$GITIGNORE" ".env.*" \
  && contains "$GITIGNORE" "!.env.example" \
  && contains "$GITIGNORE" "*.key" \
  && contains "$GITIGNORE" "*.pem"; then
  pass "자기 repo 민감 파일 ignore baseline"
else
  fail "자기 repo 민감 파일 ignore baseline 누락"
fi

if contains "$PRE_COMMIT" "gitleaks git --pre-commit --staged" \
  && contains "$PRE_COMMIT" "--redact=100"; then
  pass "pre-commit staged secret scan 배선"
else
  fail "pre-commit staged secret scan 배선 누락"
fi

HOOK_TMP=$(mktemp -d)
mkdir -p "$HOOK_TMP/bin"
cat >"$HOOK_TMP/bin/gitleaks" <<'SH'
#!/bin/sh
printf '%s\n' "$*" >"$GITLEAKS_ARGS"
exit "${FAKE_GITLEAKS_RC:-0}"
SH
chmod +x "$HOOK_TMP/bin/gitleaks"
GITLEAKS_ARGS="$HOOK_TMP/args" FAKE_GITLEAKS_RC=1 PATH="$HOOK_TMP/bin:$PATH" \
  sh "$PRE_COMMIT" >/dev/null 2>&1
hook_rc=$?
if [ "$hook_rc" -eq 1 ] \
  && grep -Fq -- "git --pre-commit --staged --redact=100" "$HOOK_TMP/args"; then
  pass "pre-commit secret finding fail-closed"
else
  fail "pre-commit secret finding을 차단하지 못함"
fi
rm -rf "$HOOK_TMP"

HOME_PATH_PATTERN='(/Users/[A-Za-z0-9._-]+|/home/[A-Za-z0-9._-]+|/root(/|$)|[A-Za-z]:[/\\]Users[/\\][A-Za-z0-9._-]+)'
home_refs="$(git -C "$ROOT" grep -n -I -E "$HOME_PATH_PATTERN" -- . 2>/dev/null || true)"
if [ -n "$home_refs" ]; then
  echo "$home_refs"
  fail "구체적인 사용자 홈 절대경로가 tracked text에 남음"
else
  pass "구체적인 사용자 홈 절대경로 0"
fi

root_probe="/""root/team-harness"
windows_probe="C:/""Users/example/team-harness"
if printf '%s\n' "$root_probe" | grep -Eq "$HOME_PATH_PATTERN" \
  && printf '%s\n' "$windows_probe" | grep -Eq "$HOME_PATH_PATTERN"; then
  pass "Linux root·Windows 슬래시 홈 절대경로 탐지"
else
  fail "Linux root 또는 Windows 슬래시 홈 절대경로 탐지 누락"
fi

if [ -f "$LICENSE" ] \
  && contains "$LICENSE" "MIT License" \
  && contains "$README" "](LICENSE)"; then
  pass "루트 MIT 라이선스와 README 링크"
else
  fail "MIT 라이선스 또는 README 링크 누락"
fi

secret_job="$(awk '/^  secret-scan:/{found=1} found{print}' "$CI")"
if printf '%s\n' "$secret_job" | grep -Fq 'fetch-depth: 0' \
  && printf '%s\n' "$secret_job" | grep -Fq 'gitleaks/gitleaks-action@'; then
  pass "CI full-fetch gitleaks secret-scan"
else
  fail "CI secret-scan이 전체 히스토리를 받지 않음"
fi

expected_assets="$(printf '%s\n' \
  'docs/architecture-gitflow.png' \
  'docs/architecture.png')"
tracked_assets="$(printf '%s\n' "$tracked_paths" \
  | grep -Ei '\.(png|jpe?g|gif|webp|svg|pdf|zip|woff2?|ttf|otf)$' \
  | sort || true)"
if [ "$tracked_assets" = "$expected_assets" ] \
  && contains "$REPORT" "docs/architecture.png" \
  && contains "$REPORT" "docs/architecture-gitflow.png" \
  && contains "$REPORT" "a6164f1"; then
  pass "tracked 배포 자산 목록과 provenance 근거"
else
  printf 'expected assets:\n%s\nactual assets:\n%s\n' "$expected_assets" "$tracked_assets"
  fail "tracked 배포 자산 목록 변경 또는 provenance 기록 누락"
fi

if contains "$README" "docs/public-safety-audit.md" \
  && contains "$PRODUCT" "[x] **공개 안전성 감사:**" \
  && contains "$PRODUCT" "public-safety-audit.md"; then
  pass "README·제품 로드맵에서 감사 정본 발견"
else
  fail "감사 정본 링크 또는 로드맵 완료 표시 누락"
fi

if contains "$DECISIONS" "spec: public-safety-audit.md"; then
  pass "결정 기록에서 감사 스펙 추적"
else
  fail "공개 안전성 감사 결정 기록 누락"
fi

if [ -f "$SPEC" ]; then
  pass "승인 스펙 존재"
else
  fail "공개 안전성 감사 스펙 누락"
fi

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

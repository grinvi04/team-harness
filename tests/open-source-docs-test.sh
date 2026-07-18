#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }
contains() {
  local file="$1" pattern="$2" label="$3"
  if grep -Eq "$pattern" "$ROOT/$file"; then pass "$label"; else fail "$label"; fi
}

for file in docs/quick-start.md docs/support.md SECURITY.md CONTRIBUTING.md CHANGELOG.md; do
  if [[ -s "$ROOT/$file" ]]; then pass "$file 존재"; else fail "$file 존재"; fi
done

contains README.md 'docs/quick-start\.md' 'README에서 영문 Quick Start 연결'
contains README.md 'docs/support\.md' 'README에서 지원 환경 연결'
contains docs/quick-start.md 'profile-doctor\.mjs' 'Quick Start doctor 안내'
contains docs/quick-start.md 'installable:false|not.*marketplace|not marketplace' 'Quick Start 미승격 경계'
contains docs/support.md 'supported' '지원 수준 명시'
contains docs/support.md 'best-effort' 'best-effort 수준 명시'
contains docs/support.md 'unsupported' '미지원 수준 명시'
contains SECURITY.md 'private|privately|비공개' '비공개 보안 신고 안내'
contains SECURITY.md 'secret|token|credential' '보안 신고 민감정보 주의'
contains CONTRIBUTING.md 'develop' 'develop 기반 기여 안내'
contains CONTRIBUTING.md 'pr-create\.sh' 'PR wrapper 안내'
contains CONTRIBUTING.md 'Conventional Commits' '커밋 형식 안내'
contains CHANGELOG.md 'generated|Generated' 'CHANGELOG 생성물 표시'
contains CHANGELOG.md 'generate-changelog\.mjs' 'CHANGELOG 재생성 명령'

echo "RESULT: $PASS PASS, $FAIL FAIL"
[[ "$FAIL" -eq 0 ]]

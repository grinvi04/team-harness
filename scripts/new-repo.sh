#!/usr/bin/env bash
# new-repo.sh — 신규 repo 초기 셋업 (기계 작업 자동화)
#
# 사용법: 새 repo 루트에서
#   bash /path/to/team-harness/scripts/new-repo.sh
#
# 전제: gh 인증 완료, git remote(origin)가 GitHub을 가리킬 것
# 멱등: 이미 있는 파일·protection은 건드리지 않음

set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── 사전 검사 ────────────────────────────────────────────────────────────────

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ git repo가 아닙니다. 먼저 git init && git remote add origin <url>" >&2
  exit 1
fi

OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)
if [ -z "$OWNER_REPO" ]; then
  echo "❌ GitHub remote가 없습니다. gh repo create 또는 git remote add 먼저." >&2
  exit 1
fi

echo "🔧  $OWNER_REPO 셋업 시작 ($(pwd))"
echo ""

# ── 스택 선택 ────────────────────────────────────────────────────────────────

echo "스택을 선택하세요:"
echo "  1) Node.js 단독      — React / Vue / Vite SPA, NestJS 단독 API"
echo "  2) NestJS 풀스택     — NestJS 백엔드 + React / Vue / Next.js 프론트엔드"
echo "  3) Spring Boot       — Java / Kotlin Gradle 백엔드 단독"
echo "  4) Spring 풀스택     — Spring Boot 백엔드 + Node.js 프론트엔드"
echo "  5) Python            — FastAPI / Django (+ PostgreSQL + Redis)"
echo "  6) Rails 8           — 소팀 MVP · Hotwire 풀스택"
echo ""
read -rp "번호 입력 (1-6): " STACK_CHOICE

case "$STACK_CHOICE" in
  1) STACK_TEMPLATE="ci-gate-node.yml";             STACK_CHECKS=("quality" "secret-scan");  STACK_RULES=("typescript") ;;
  2) STACK_TEMPLATE="ci-gate-nestjs-frontend.yml";  STACK_CHECKS=("backend" "frontend" "secret-scan"); STACK_RULES=("typescript" "prisma") ;;
  3) STACK_TEMPLATE="ci-gate-spring.yml";           STACK_CHECKS=("quality" "secret-scan");  STACK_RULES=("java" "flyway") ;;
  4) STACK_TEMPLATE="ci-gate-spring-frontend.yml";  STACK_CHECKS=("backend" "frontend" "secret-scan"); STACK_RULES=("java" "flyway" "typescript") ;;
  5) STACK_TEMPLATE="ci-gate-python.yml";           STACK_CHECKS=("quality" "secret-scan");  STACK_RULES=("python" "alembic") ;;
  6) STACK_TEMPLATE="ci-gate-rails.yml";            STACK_CHECKS=("quality" "secret-scan");  STACK_RULES=() ;;
  *) echo "❌ 잘못된 선택 — 1~6 중 입력하세요." >&2; exit 1 ;;
esac

# 모든 스택 공통 required check — 테스트 삭제 차단 게이트 + 커밋 컨벤션 게이트(stack 무관)
STACK_CHECKS+=("test-guard" "commitlint")

STACK_TEMPLATE_PATH="$HARNESS_DIR/templates/ci/stacks/$STACK_TEMPLATE"
echo ""
echo "선택: $STACK_TEMPLATE"
echo ""

# ── 1. 템플릿 파일 복사 (기존 파일 덮어쓰지 않음) ────────────────────────

echo "📁  템플릿 파일 복사..."
mkdir -p .githooks .github/workflows .claude

copy_once() {
  local src="$1" dst="$2" label="$3" note="${4:-}"
  if [[ -f "$dst" ]]; then
    echo "  ⏭  $label (이미 있음)"
  else
    cp "$src" "$dst"
    echo "  ✅  $label${note:+  ← $note}"
  fi
}

# 스택별 ci-gate
if [[ -f ".github/workflows/ci-gate.yml" ]]; then
  echo "  ⏭  ci-gate.yml (이미 있음)"
else
  cp "$STACK_TEMPLATE_PATH" .github/workflows/ci-gate.yml
  echo "  ✅  ci-gate.yml ($STACK_TEMPLATE)  ← ⚠️ CUSTOMIZE 주석 부분 프로젝트에 맞게 수정"
fi

copy_once "$HARNESS_DIR/templates/ci/test-guard.yml"        .github/workflows/test-guard.yml "test-guard.yml (테스트 삭제 차단 게이트)"
copy_once "$HARNESS_DIR/templates/ci/commitlint.yml"        .github/workflows/commitlint.yml "commitlint.yml (커밋 컨벤션 게이트)"
copy_once "$HARNESS_DIR/templates/commitlint.config.cjs"    commitlint.config.cjs      "commitlint.config.cjs (Conventional Commits 규약)"

copy_once "$HARNESS_DIR/templates/githooks/pre-commit"       .githooks/pre-commit       "pre-commit 훅"
chmod +x .githooks/pre-commit

copy_once "$HARNESS_DIR/templates/AGENTS.md"                 AGENTS.md                  "AGENTS.md"      "⚠️ 프로젝트 내용 채우기 (빌드·테스트 명령 섹션 필수)"
copy_once "$HARNESS_DIR/templates/CLAUDE.md"                 CLAUDE.md                  "CLAUDE.md"
copy_once "$HARNESS_DIR/templates/settings.json"             .claude/settings.json      ".claude/settings.json"
copy_once "$HARNESS_DIR/templates/PULL_REQUEST_TEMPLATE.md"  .github/PULL_REQUEST_TEMPLATE.md "PR 템플릿"

# 스택별 rules 파일 복사
if [[ ${#STACK_RULES[@]} -gt 0 ]]; then
  mkdir -p .claude/rules
  for rule in "${STACK_RULES[@]}"; do
    copy_once "$HARNESS_DIR/templates/rules/stacks/$rule.md" ".claude/rules/$rule.md" "rules/$rule.md"
  done
fi

# .gitignore — snippet 내용이 없으면 append
if grep -qF ".claude/settings.local.json" .gitignore 2>/dev/null; then
  echo "  ⏭  .gitignore (snippet 이미 포함)"
else
  cat "$HARNESS_DIR/templates/gitignore.snippet" >> .gitignore
  echo "  ✅  .gitignore (harness snippet 추가)"
fi

# Spring 스택 전용 추가 파일
if [[ "$STACK_TEMPLATE" == *spring* ]]; then
  mkdir -p backend/config/checkstyle
  copy_once "$HARNESS_DIR/templates/backend-gitignore.spring" "backend/.gitignore" \
    "backend/.gitignore" "gradle-wrapper.jar 포함, Gradle/IDE 제외"
  copy_once "$HARNESS_DIR/templates/checkstyle.xml" "backend/config/checkstyle/checkstyle.xml" \
    "backend/config/checkstyle/checkstyle.xml"
fi

# 프론트엔드 분리 스택 전용 — Prettier 포맷 게이트 + 디자인 토큰 게이트 스크립트
# (ci-gate frontend 잡의 `npm run lint:design`가 이 스크립트를 실행. package.json scripts에
#  `"lint:design": "node scripts/check-design-tokens.mjs"` 추가는 수동.)
if [[ "$STACK_TEMPLATE" == *frontend* ]]; then
  mkdir -p frontend/scripts
  copy_once "$HARNESS_DIR/templates/.prettierrc" "frontend/.prettierrc" \
    "frontend/.prettierrc" "Prettier 포맷 게이트 — prettier --check를 CI에"
  copy_once "$HARNESS_DIR/templates/frontend/check-design-tokens.mjs" "frontend/scripts/check-design-tokens.mjs" \
    "frontend/scripts/check-design-tokens.mjs" "⚠️ package.json scripts에 lint:design 추가 필요"
fi

echo ""

# ── 2. git hooks 경로 설정 ────────────────────────────────────────────────

git config core.hooksPath .githooks
echo "⚙️   git config core.hooksPath → .githooks"
echo ""

# ── 3. Branch protection ─────────────────────────────────────────────────

apply_protection() {
  local branch="$1"
  if ! git ls-remote --exit-code --heads origin "$branch" > /dev/null 2>&1; then
    echo "  ⚠️  $branch — 원격 브랜치 없음 → 보호 미적용 (직접 push 가능)"
    echo "      push 후 반드시 재실행: bash $0"
    return
  fi

  local ctx_args=()
  for check in "${STACK_CHECKS[@]}"; do
    ctx_args+=(-f "required_status_checks[contexts][]=$check")
  done

  local api_out
  api_out=$(gh api "repos/$OWNER_REPO/branches/$branch/protection" -X PUT \
    -F required_status_checks[strict]=true \
    "${ctx_args[@]}" \
    -F enforce_admins=true \
    -F required_pull_request_reviews[required_approving_review_count]=1 \
    -F required_conversation_resolution=true \
    -F restrictions=null \
    -F allow_force_pushes=false \
    -F allow_deletions=false \
    2>&1) \
    && echo "  ✅  $branch 보호 완료 (checks: ${STACK_CHECKS[*]})" \
    || { echo "  ❌  $branch 보호 실패: $api_out"; }
}

echo "🔒  Branch protection 적용..."
apply_protection main
apply_protection develop
echo ""

# ── 완료 요약 ───────────────────────────────────────────────────────────────

echo "────────────────────────────────────────────────"
echo "✅  기계 셋업 완료. 남은 수동 작업:"
echo ""
echo "  1. ci-gate.yml 수정: CUSTOMIZE 주석 부분을 프로젝트에 맞게 교체"
echo "       (credentials, env 변수, 디렉터리 경로 등)"
echo ""
echo "  2. AGENTS.md 작성:"
echo "       프로젝트 개요·디렉터리·빌드 명령 채우기"
echo "       (빌드·테스트 명령 섹션은 하네스 커맨드가 필수로 읽음)"
echo ""
echo "  AI 리뷰는 PR마다 /code-review 스킬(구독, API 과금 없음)이 수행 — 별도 설정 없음."
echo ""
echo "  이후: 테스트 PR 1개 → ci-gate 통과 확인"
echo "  (main/develop 보호를 못 걸었으면 이 스크립트 재실행)"
echo "────────────────────────────────────────────────"

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

# ── B4 게이트(순수): 보호 적용 실패 플래그 → 스크립트 종료코드 결정. 실패를 ❌ 출력 후 삼키지 않고
#    non-zero로 반영한다(gh·파일복사와 분리해 테스트가 검증 — tests/new-repo-test.sh). ──
prot_exit_ok() { [ "${1:-0}" = "0" ]; }   # rc0 = 실패 없음(exit 0), rc1 = 실패 있음(exit 1)

# 테스트 훅: 함수만 로드하고 종료(git/gh/파일복사 없이 prot_exit_ok만 검증).
[ -n "${NEWREPO_SOURCE_ONLY:-}" ] && return 0 2>/dev/null || true

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

node "$HARNESS_DIR/scripts/stack-catalog.mjs" --menu
echo ""
read -rp "번호 입력 (1-8): " STACK_CHOICE

STACK_SELECTION=$(node "$HARNESS_DIR/scripts/stack-catalog.mjs" --select "$STACK_CHOICE")
# Read catalog data as JSON; never evaluate generated shell text.
selection_value() {
  printf '%s' "$STACK_SELECTION" | node -e '
    const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const v = process.argv[1].split(".").reduce((value, key) => value[key], d);
    console.log(Array.isArray(v) ? v.join(" ") : (v ?? ""));' "$1"
}
if [ -n "$(selection_value frontendOptions)" ]; then
  read -rp "프론트엔드 (node=React/Vite, vue, nextjs; 기본 node): " FRONTEND_CHOICE || FRONTEND_CHOICE=""
  STACK_SELECTION=$(node "$HARNESS_DIR/scripts/stack-catalog.mjs" --select "$STACK_CHOICE" --frontend "${FRONTEND_CHOICE:-node}")
fi
STACK_TEMPLATE=$(selection_value template)
read -r -a STACK_CHECKS <<< "$(selection_value checks)"
read -r -a STACK_RULES <<< "$(selection_value rules)"

# The catalog owns required checks, including common and database gates.
HAS_FLYWAY=false
if [ "$(selection_value database.tool)" = flyway ]; then
  HAS_FLYWAY=true
fi

# Alembic 스택 — 다중 head(분기 마이그레이션) 차단 게이트(별도 CI 점검, decisions "정적 게이트 Flyway 전용").
# 검증기(check-repo-sync.mjs)가 alembic 감지 시 이 게이트를 required로 기대 → 프로비저너가 대칭 제공.
HAS_ALEMBIC=false
if [ "$(selection_value database.tool)" = alembic ]; then
  HAS_ALEMBIC=true
fi

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
copy_once "$HARNESS_DIR/templates/ci/integration-e2e.yml"   .github/workflows/integration-e2e.yml "integration-e2e.yml (실 IdP+실데이터 e2e 스캐폴드)" "⚠️ CUSTOMIZE + Settings→Variables에 E2E_ENABLED=true"
copy_once "$HARNESS_DIR/templates/commitlint.config.cjs"    commitlint.config.cjs      "commitlint.config.cjs (Conventional Commits 규약)"
mkdir -p scripts
copy_once "$HARNESS_DIR/scripts/check-commit-message.cjs"   scripts/check-commit-message.cjs "scripts/check-commit-message.cjs (로컬·CI 공통 커밋 규칙)"

# 파괴적 DDL 게이트 — stack-agnostic(Flyway·Prisma·Supabase 공통, 마이그레이션 없으면 self-skip)이라 무조건 배선.
mkdir -p scripts
copy_once "$HARNESS_DIR/templates/ci/destructive-ddl.yml"   .github/workflows/destructive-ddl.yml "destructive-ddl.yml (파괴 DDL 차단 게이트)"
copy_once "$HARNESS_DIR/scripts/check-destructive-ddl.mjs"  scripts/check-destructive-ddl.mjs "scripts/check-destructive-ddl.mjs"
# Alembic .py 축 — destructive-ddl.yml 2번째 스텝이 호출. 지문 없으면 self-skip이라 stack-agnostic 무조건 배선.
copy_once "$HARNESS_DIR/scripts/check-alembic-destructive-ddl.mjs" scripts/check-alembic-destructive-ddl.mjs "scripts/check-alembic-destructive-ddl.mjs"
# ActiveRecord .rb 축 — destructive-ddl.yml 3번째 스텝이 호출. 지문 없으면 self-skip이라 stack-agnostic 무조건 배선.
copy_once "$HARNESS_DIR/scripts/check-activerecord-destructive-ddl.mjs" scripts/check-activerecord-destructive-ddl.mjs "scripts/check-activerecord-destructive-ddl.mjs"

# Flyway 스택 — 마이그레이션 안전성 게이트 워크플로 + 무의존 검사 스크립트
if [[ "$HAS_FLYWAY" == true ]]; then
  mkdir -p scripts
  copy_once "$HARNESS_DIR/templates/ci/migration-safety.yml" .github/workflows/migration-safety.yml "migration-safety.yml (접두사 대역+out-of-order 게이트)"
  copy_once "$HARNESS_DIR/scripts/check-migration-safety.mjs" scripts/check-migration-safety.mjs "scripts/check-migration-safety.mjs"
fi

# Alembic 스택 — 다중 head 차단 게이트 워크플로(자기-스킵 — alembic.ini 없으면 통과)
if [[ "$HAS_ALEMBIC" == true ]]; then
  copy_once "$HARNESS_DIR/templates/ci/alembic-heads.yml" .github/workflows/alembic-heads.yml "alembic-heads.yml (다중 head 차단 게이트)"
fi

copy_once "$HARNESS_DIR/templates/githooks/pre-commit"       .githooks/pre-commit       "pre-commit 훅"
copy_once "$HARNESS_DIR/templates/githooks/commit-msg"       .githooks/commit-msg       "commit-msg 훅 (커밋 메시지 즉시 검증)"
chmod +x .githooks/pre-commit
chmod +x .githooks/commit-msg

copy_once "$HARNESS_DIR/templates/AGENTS.md"                 AGENTS.md                  "AGENTS.md"      "⚠️ 프로젝트 내용 채우기 (빌드·테스트 명령 섹션 필수)"
copy_once "$HARNESS_DIR/templates/CLAUDE.md"                 CLAUDE.md                  "CLAUDE.md"
copy_once "$HARNESS_DIR/templates/settings.json"             .claude/settings.json      ".claude/settings.json"
copy_once "$HARNESS_DIR/templates/PULL_REQUEST_TEMPLATE.md"  .github/PULL_REQUEST_TEMPLATE.md "PR 템플릿"

# Stack selection grants no automatic execution permissions; copy_once preserves settings.

# 스택별 rules 파일 복사
if [[ ${#STACK_RULES[@]} -gt 0 ]]; then
  mkdir -p .claude/rules
  for rule in "${STACK_RULES[@]}"; do
    copy_once "$HARNESS_DIR/templates/rules/stacks/$rule.md" ".claude/rules/$rule.md" "rules/$rule.md"
  done
fi

# 한국어 UX 룰 — 프론트엔드(UI) 스택에 복사. path-scoped(*.tsx·*.vue 등)라 비-UI repo엔 무영향.
# 영어 UI 서비스면 셋업 후 삭제. (단일 출처: docs/korean-ux.md)
if printf '%s\n' "${STACK_RULES[@]+"${STACK_RULES[@]}"}" | grep -qxE 'typescript|vue|nextjs' || [[ "$STACK_TEMPLATE" == *rails* ]]; then
  mkdir -p .claude/rules
  copy_once "$HARNESS_DIR/templates/rules/korean-ux.md" ".claude/rules/korean-ux.md" "rules/korean-ux.md"
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

  # Existing policies belong to the operator. Setup reruns never migrate or replace them.
  local protected default_branch workflow_blob validator_blob
  if ! protected=$(gh api "repos/$OWNER_REPO/branches/$branch" --jq '.protected'); then
    echo "  ❌  $branch — 기존 보호 확인 실패; 변경하지 않습니다."
    PROT_FAILED=1
    return
  fi
  if [ "$protected" = true ]; then
    echo "  ⏭  $branch — 기존 보호 유지. commitlint 전환은 docs/specs/trusted-commitlint.md 참고"
    return
  fi
  if [ "$protected" != false ]; then
    echo "  ❌  $branch — 보호 상태를 판정할 수 없습니다."
    PROT_FAILED=1
    return
  fi

  # target workflows execute from the default branch, not necessarily this protected branch.
  if ! default_branch=$(gh api "repos/$OWNER_REPO" --jq '.default_branch') \
    || ! workflow_blob=$(gh api "repos/$OWNER_REPO/contents/.github/workflows/commitlint.yml" -X GET -f "ref=$default_branch" --jq '.sha') \
    || ! validator_blob=$(gh api "repos/$OWNER_REPO/contents/scripts/check-commit-message.cjs" -X GET -f "ref=$default_branch" --jq '.sha') \
    || [ "$workflow_blob" != "$(git hash-object "$HARNESS_DIR/templates/ci/commitlint.yml")" ] \
    || [ "$validator_blob" != "$(git hash-object "$HARNESS_DIR/scripts/check-commit-message.cjs")" ]; then
    echo "  ❌  $branch — 기본 브랜치의 신뢰 workflow·validator 미확인; 보호를 변경하지 않습니다."
    echo "      기본 브랜치에 표준 자산을 먼저 반영하세요. 기존 repo는 명시적 전환 절차를 따르세요."
    PROT_FAILED=1
    return
  fi

  # 부트스트랩 데드락 방지: CI 워크플로가 원격 브랜치에 아직 없으면 required-check 보호를 걸지 않는다.
  # (워크플로 push 전에 보호를 걸면 초기 설정 커밋 push가 "required status checks are expected"로 거부돼
  #  워크플로를 올릴 방법이 없어진다. develop처럼 '설정 push 후 재실행' 2-스텝으로 유도.)
  if ! gh api "repos/$OWNER_REPO/contents/.github/workflows?ref=$branch" > /dev/null 2>&1; then
    echo "  ⚠️  $branch — CI 워크플로가 아직 원격에 없음 → 보호 보류 (required check 데드락 방지)"
    echo "      설정을 커밋·push한 뒤 재실행: bash $0"
    return
  fi

  local ctx_args=()
  for check in "${STACK_CHECKS[@]}"; do
    ctx_args+=(-f "required_status_checks[contexts][]=$check")
  done

  # 솔로 표준(decisions): required checks + force-push/삭제 차단 + 대화 resolve.
  # **승인요건 0 · enforce_admins=true** — 승인0이라 데드락 없음(자기승인 불필요). enforce_admins=true라야
  # required check(CI)가 소유자·관리자에게도 강제(false면 관리자가 CI red/pending도 머지). 리뷰어 합류 시
  # 승인요건 수동 1↑. 긴급 break-glass(CI 인프라 장애)는 required_status_checks 일시 완화. 단일 출처: set-branch-protection.sh.
  local api_out
  api_out=$(gh api "repos/$OWNER_REPO/branches/$branch/protection" -X PUT \
    -F required_status_checks[strict]=true \
    "${ctx_args[@]}" \
    -F enforce_admins=true \
    -F required_pull_request_reviews=null \
    -F required_conversation_resolution=true \
    -F restrictions=null \
    -F allow_force_pushes=false \
    -F allow_deletions=false \
    2>&1) \
    && echo "  ✅  $branch 보호 완료 (솔로: 승인0 · enforce_admins=on · checks: ${STACK_CHECKS[*]})" \
    || { echo "  ❌  $branch 보호 실패: $api_out"; PROT_FAILED=1; }
}

PROT_FAILED=0   # B4: 보호 적용 실패를 ❌ 출력 후 삼키지 않고 스크립트 종료코드(exit)에 반영
echo "🔒  Branch protection 적용..."
apply_protection main
apply_protection develop
echo ""

# ── 4. 드리프트 self-check (정보성, 비차단) ──────────────────────────────────
# 방금 복사한 자산이 표준과 sync 됐는지 check-repo-sync.mjs로 즉시 확인.
# 신규=여기, 기존 repo=언제든 `node check-repo-sync.mjs --repo <경로>`로 대칭 점검.
if command -v node > /dev/null 2>&1; then
  echo "🔎  드리프트 self-check (check-repo-sync.mjs)..."
  node "$HARNESS_DIR/scripts/check-repo-sync.mjs" --repo "$(pwd)" --harness "$HARNESS_DIR" \
    || echo "  ⚠️  위 표에서 MISSING 항목 확인 — 누락 자산을 채우세요(셋업 직후라면 보통 통과)."
  echo ""
else
  echo "ℹ️  node 미설치 — 드리프트 점검 생략. 이후: node $HARNESS_DIR/scripts/check-repo-sync.mjs --repo $(pwd)"
  echo ""
fi

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

# B4: 보호 적용에 실패했으면(위 ❌) 성공 요약을 냈더라도 non-zero로 종료 — 체이닝·자동화가 감지.
prot_exit_ok "${PROT_FAILED:-0}" || { echo ""; echo "⚠️  branch protection 미적용 — 위 ❌ 확인 후 재실행 필요"; exit 1; }

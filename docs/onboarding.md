# 신규 프로젝트 / 신규 팀원 온보딩

## A. 신규 프로젝트 셋업 (프로젝트 리드, 1회)

### 1. 계층 0 — GitHub 강제 장치 (가장 중요, AI 도구 무관)

repo Settings → Branches → branch protection rule을 `main`, `develop`에 각각:

- [ ] Require a pull request before merging (+ 승인 1명 이상)
- [ ] Require status checks to pass: `quality`, `secret-scan` (ci-gate.yml)
- [ ] Block force pushes / Do not allow deletions
- [ ] (권장) Require conversation resolution before merging

```bash
# CLI로 일괄 적용 예시 (main; develop도 동일하게)
gh api repos/{owner}/{repo}/branches/main/protection -X PUT \
  -f required_status_checks[strict]=true \
  -f "required_status_checks[contexts][]=quality" \
  -f "required_status_checks[contexts][]=secret-scan" \
  -f enforce_admins=true \
  -f required_pull_request_reviews[required_approving_review_count]=1 \
  -F restrictions=null -f allow_force_pushes=false -f allow_deletions=false
```

### 2. 계층 1 — repo 내 설정 커밋

- [ ] `templates/githooks/pre-commit` → `.githooks/pre-commit` (실행 권한 유지: `chmod +x`)
- [ ] `templates/ci/ci-gate.yml` → `.github/workflows/ci-gate.yml` (스택에 맞게 수정)
- [ ] `templates/AGENTS.md` → `/AGENTS.md` (프로젝트 내용 채움)
- [ ] `templates/CLAUDE.md` → `/CLAUDE.md`
- [ ] `templates/settings.json` → `.claude/settings.json` (마켓플레이스 주소 교체)
- [ ] `templates/gitignore.snippet` 내용을 `.gitignore`에 추가
- [ ] `templates/PULL_REQUEST_TEMPLATE.md` → `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] **초기 셋업 커밋(빈 repo의 첫 커밋)**: PR을 만들 base 브랜치가 없고 pre-commit이 main 커밋을 막으므로,
      이 1회만 `git commit --no-verify`로 main에 직접 커밋한다 (또는 hooksPath 활성화를 첫 커밋 뒤로 미룬다).
      push 후 develop 브랜치를 만들고 그제서야 branch protection을 적용한다.
- [ ] 이후 모든 변경은 PR로 커밋 — `.claude/`도 버전관리 대상이다

### 3. 계층 2 — 플러그인 확인

`.claude/settings.json`의 `extraKnownMarketplaces` + `enabledPlugins` 선언으로
팀원이 repo를 열면 harness-guard 설치가 안내된다(신뢰 확인 1회).

## B. 신규 팀원 온보딩 (각자, 1회)

```bash
git clone <repo>   # .claude/ 포함 — 커맨드·에이전트·권한 컨벤션 자동 적용
cd <repo>
git config core.hooksPath .githooks   # git 네이티브 가드 활성화 (1회)
claude             # 첫 실행 시 marketplace/plugin 신뢰 확인 → 설치
```

개인 설정은 `.claude/settings.local.json`에만 (gitignore됨).

## C. 로컬 테스트 (플랜 불필요)

### 마켓플레이스 로컬 테스트
```
/plugin marketplace add /Users/<me>/team-harness
/plugin install harness-guard@team-harness
```
가드 동작 확인: main 브랜치에서 `git commit` 시도 → ⛔ 차단되면 정상.

### 강제형 설정(managed settings) 로컬 시뮬레이션
Team/Enterprise 없이도 파일 기반 managed settings로 본인 머신에서 테스트 가능:
- macOS: `/Library/Application Support/ClaudeCode/managed-settings.json` (관리자 권한)
- 여기에 넣은 permissions.deny는 사용자 설정으로 우회 불가 — 조직 강제 시나리오 검증용

## D. 다른 AI 도구를 쓰는 팀 (기획/마케팅 등)

- 규약은 `AGENTS.md` 하나만 보면 된다 — Codex는 네이티브로 읽음,
  Gemini CLI는 contextFileName을 AGENTS.md로 설정
- 가드 훅은 Claude Code 전용이지만, branch protection + CI(계층 0)는
  도구와 무관하게 모두에게 강제된다

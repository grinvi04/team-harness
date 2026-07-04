# 신규 프로젝트 / 신규 팀원 온보딩

> **가시성·라이선스(개인/솔로 코드 프로젝트)**: **public repo + MIT 라이선스**가 기본.
> 사유 — GitHub Free는 **public repo에서만 branch protection 무료**(계층0 강제의 전제)라, "강제는 서버에"가
> 솔로에서도 성립하려면 public이어야 한다. private가 필요하면 Pro. **예외**: 프로필/문서 전용 repo는
> private 가능(그 경우 protection은 못 걸리니 `/solo-merge`+사람 승인에 의존).
> ※ team-harness 자체는 **2026-07 public 전환**(decisions #73 — repo-sync CI가 토큰 없이 checkout 가능하게).
> 과거 "메타 repo = private 예외"(#47)는 #73으로 대체됨.
> (정본: 이 문서 + `decisions.md` 가시성·라이선스 행)

## A. 신규 프로젝트 셋업 (프로젝트 리드, 1회)

### 1. 기계 셋업 — 스크립트 1회 실행

> ⛔ **AI 도구 주의**: `.claude/`, `.github/`, `.githooks/` 파일을 직접 만들지 말 것.
> new-repo.sh가 없으면 온보딩이 안 된 것이다 — 스크립트 먼저, 코드 나중.

```bash
cd <새 repo 루트>
bash /path/to/team-harness/scripts/new-repo.sh
```

스크립트가 자동으로 처리하는 항목:
- 템플릿 파일 복사 (pre-commit 훅·CI·AGENTS.md·CLAUDE.md·settings.json·PR 템플릿·gitignore)
- `git config core.hooksPath .githooks`
- main·develop branch protection (enforce_admins on·승인요건 0·status-checks·conversation-resolve)

> 멱등: 이미 있는 파일·protection은 건드리지 않음. 브랜치 없으면 "첫 커밋 후 재실행" 안내.

> **초기 셋업 커밋(빈 repo의 첫 커밋)**: pre-commit 훅이 main 커밋을 막으므로,
> 이 1회만 `git commit --no-verify`로 main에 직접 커밋한다(또는 hooksPath 활성화를 첫 커밋 뒤로 미룬다).
> push 후 develop 브랜치 생성 → 스크립트 재실행으로 develop에도 protection 적용.

### 2. 수동 3단계 (스크립트 출력이 안내)

- [ ] **ci-gate.yml 수정**: placeholder → 스택 맞는 lint·test·build 명령으로 교체
      (placeholder는 항상 실패 — 교체 전 protection 걸면 첫 PR부터 머지 불가)
- [ ] **AGENTS.md 작성**: 프로젝트 개요·디렉터리·빌드·테스트 명령 채우기
      (빌드·테스트 명령 섹션은 하네스 커맨드가 필수로 읽음)

> AI 리뷰는 PR마다 `/code-review` 스킬(구독 포함, API 과금 없음)이 수행 — 외부 봇·시크릿 등록 불필요.

### 3. 최종 검증

- [ ] 테스트 PR 1개 생성 → ci-gate 통과 확인 (`pull_request` 트리거 전용 — push로는 실행 안 됨)
      체크명은 스택별로 다름: Node/Python/Rails=`quality`·`secret-scan`, Spring/NestJS 풀스택=`backend`·`frontend`·`secret-scan`

### 계층 2 — 플러그인

`.claude/settings.json`의 `extraKnownMarketplaces` + `enabledPlugins` 선언으로
팀원이 repo를 열면 harness-guard 설치가 안내된다(신뢰 확인 1회).

> `~/project` 하위 repo는 `~/project/.claude/settings.local.json`에 이미 harness-guard가 활성화돼 있어
> 플러그인 install 없이도 동작한다. 단, settings.json은 다른 클론 사용자를 위해 커밋한다.

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

## E. 솔로 머지 권한 (auto-mode · 새 머신 1회 셋업)

솔로 환경에서 `/solo-merge`가 main 브랜치 보호의 승인요건을 잠시 조정하려 하면, auto-mode 분류기가 이를 보안 변경으로 보고 차단한다. 이 권한은 **보안 경계상 에이전트가 스스로 부여할 수 없다 — 사람이 1회** `~/.claude/settings.json`의 `permissions.allow`에 해당 허용 규칙을 직접 추가해야 한다(전역이라 모든 repo 적용, 설정은 sync되지 않아 새 PC마다 반복). 규칙 상세는 본인 보안정책에 따라 구성한다.

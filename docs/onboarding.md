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
- main·develop branch protection (enforce_admins=on·승인0·status-checks·conversation-resolve) — **CI 워크플로가 원격에 push된 뒤** 적용(아래 부트스트랩 순서)

> 멱등: 이미 있는 파일·protection은 건드리지 않음. 브랜치 없거나 워크플로 미push면 "커밋·push 후 재실행" 안내.

> **부트스트랩 순서 (중요 — 이 순서로 안 하면 첫 push가 막힌다)**:
> 1. `new-repo.sh` — 템플릿 복사. **required-check 보호는 보류**한다 — 워크플로가 원격에 없는데 보호를
>    걸면 초기 커밋 push가 `required status checks are expected`로 거부돼 워크플로를 올릴 수 없는 데드락.
> 2. §2 커스터마이즈(ci-gate.yml·AGENTS.md).
> 3. 초기 커밋 — pre-commit 훅이 main 직접 커밋을 막으니 이 1회만 `git commit --no-verify` → `git push origin main`
>    (보호가 아직 없어 push 성공).
> 4. `git checkout -b develop && git push -u origin develop`.
> 5. `new-repo.sh` **재실행** — 이제 워크플로가 원격에 있어 main·develop 보호가 적용된다.
>
> ⚠️ `git commit --no-verify`는 **로컬 pre-commit 훅만** 우회한다 — **서버 branch protection은 못 뚫는다**.
> 그래서 --no-verify로도 보호된 브랜치엔 push가 거부되므로, "보호를 push 뒤(5단계)에 거는" 순서가 해법이다.

> **팀(리뷰어 ≥1)**: 멤버 합류 후 `bash set-branch-protection.sh <owner/repo> --approvals 1`로 main에 승인 요건을 올린다(develop은 0 유지). 신규 repo 생성 시엔 걸지 않는다 — 소유자 1명이면 self-approve 불가로 첫 PR 데드락.

> **초기 팀(기존 브랜치 규칙 없음)**: Team Harness 기본값을 첫 규칙으로 쓴다. main/develop
> 직접 push 금지 + PR + required CI는 바로 적용하고, 승인자가 아직 없을 때는 승인 0명으로
> 시작한다. 상호 리뷰할 멤버가 정해지면 main만 `--approvals 1`로 올린다. 즉 기존 사내
> 브랜치 규칙이 선행 조건이 아니라, 이 기본선이 초기 규칙이다.

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
git config --get core.hooksPath        # → .githooks 확인 (빈 값이면 pre-commit이 침묵 통과한다)
claude             # 첫 실행 시 marketplace/plugin 신뢰 확인 → 설치
```

> 설정만 하고 끝내지 말고 **붙었는지 확인**한다 — `git config --get`이 빈 값이면 계층0.5(pre-commit)가
> 침묵 통과한다. team-harness 자체를 클론했다면 `bash tests/plugin-wiring-test.sh`로 배선 전체
> (guard 훅 실발동 + hooksPath 정합)를 통과가 아니라 **반증**으로 검증한다(§C).

개인 설정은 `.claude/settings.local.json`에만 (gitignore됨).

## C. 로컬 테스트 (플랜 불필요)

### 마켓플레이스 로컬 테스트
```
/plugin marketplace add /Users/<me>/team-harness
/plugin install harness-guard@team-harness
```
가드 동작 확인: main 브랜치에서 `git commit` 시도 → ⛔ 차단되면 정상.

### 배선 반증-스모크 (team-harness 자기 검증)
```
bash tests/plugin-wiring-test.sh
```
`hooks.json`을 진실원본으로 삼아 **guard 훅이 실제로 발동하는 배선**(계층1: PreToolUse→guard.sh 경로
해석+차단 실발동)과 **hooksPath 정합**(계층0.5)을 검증한다. conformance-green이 아니라 반증 — hooks.json의
guard 경로를 깨거나 `core.hooksPath`를 오설정하면 스모크가 FAIL한다. CI(`ci-gate` quality 잡)에도 등록돼 있다.

### 강제형 설정(managed settings) 로컬 시뮬레이션
Team/Enterprise 없이도 파일 기반 managed settings로 본인 머신에서 테스트 가능:
- macOS: `/Library/Application Support/ClaudeCode/managed-settings.json` (관리자 권한)
- 여기에 넣은 permissions.deny는 사용자 설정으로 우회 불가 — 조직 강제 시나리오 검증용

## D. Claude Code·Codex·기타 AI 도구

- 규약의 단일 출처는 `AGENTS.md`다. Claude Code는 `CLAUDE.md`에서 import하고 Codex는
  네이티브로 읽는다. Gemini CLI는 `contextFileName`을 `AGENTS.md`로 설정한다.
- Claude Code와 Codex는 모두 harness skill·agent·hook을 지원한다. UI는 다르지만 같은 skill
  수용 기준, PR wrapper, 리뷰·CI 게이트를 따른다.
- Codex는 `harness-guard` v0.55.0 이상을 설치하고, 관리자가
  `/path/to/team-harness/scripts/install-codex-managed-requirements.sh`로 `hooks=true`,
  `unified_exec=false`를 머신에 고정한다.
- 최초 plugin 설치 뒤와 이후 갱신 때는 Team Harness checkout에서 아래 단일 launcher 명령을 실행한다.
  launcher는 필요할 때만 marketplace/plugin을 갱신하고 skill overlay·command guard·custom agent와
  `security-guidance` adapter 패치를 모두 적용한다. 이어서 doctor probe로 실제 새 세션의 두 guard 차단을
  확인하고 `/hooks`의 변경 hash를 review/trust한다.
  ```bash
  bash /path/to/team-harness/scripts/codex-hardened.sh --version
  bash /path/to/team-harness/scripts/harness-doctor.sh --repo . --probe
  ```
- Codex 설치·갱신·실측 절차의 정본은
  [`specs/codex-guard-compatibility.md`](specs/codex-guard-compatibility.md)다.
- 전용 plugin/hook 적합성을 검증하지 않은 기타 AI 도구는 `AGENTS.md` + git hook +
  branch protection + CI 범위로 제한한다.

## E. 솔로 머지 권한 (auto-mode · 새 머신 1회 셋업)

솔로 환경에서 `/solo-merge`가 main 브랜치 보호의 승인요건을 잠시 조정하려 하면, auto-mode 분류기가 이를 보안 변경으로 보고 차단한다. 이 권한은 **보안 경계상 에이전트가 스스로 부여할 수 없다 — 사람이 1회** `~/.claude/settings.json`의 `permissions.allow`에 해당 허용 규칙을 직접 추가해야 한다(전역이라 모든 repo 적용, 설정은 sync되지 않아 새 PC마다 반복). 규칙 상세는 본인 보안정책에 따라 구성한다.

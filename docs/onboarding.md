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
- [ ] **스택별 검사 연결**: 아래 기준으로 제품의 검사 명령·대상·한계를 정하고 같은 명령을 CI에 연결

#### 스택별 검사를 연결하는 방법

검사 설정·테스트·실행 결과는 **제품 저장소**가 소유한다. Harness는 공통 수용 기준과 리뷰·CI 연결을 제공한다.
제품의 AGENTS.md에는 실제 명령을, 개발 안내에는 검사 범위와 남은 수동 확인을 기록한다.

| 확인 대상 | 제품에서 연결할 검사 | 완료 증거 |
| --- | --- | --- |
| 백엔드·API | 포맷·단위/통합 테스트·빌드. Spring Boot라면 실제 HTTP 입력 오류와 응답 계약도 확인 | 정상·거부 사례, 실행 명령과 대상 커밋 |
| 프론트 코드·외부 응답 | 타입·lint·단위 테스트·빌드. Vue라면 template 규칙과 응답 구조 검증 포함 | 잘못된 응답이 화면 오류로 처리되고 정상 응답은 허용됨 |
| 디자인·접근성 | [프론트 검증 기준](frontend-design-standards.md#8-검증-pr-전-프레임워크-무관)의 정적 검사·브라우저 검사·직접 확인 | 테마·화면 폭·상태별 결과, 위반과 자동 판정 불가 항목 |
| 변경 인수 | 현재 후보의 요구사항·diff·결과를 리뷰하고 발견한 결함에 회귀 검사 추가 | 수정 전 실패와 수정 후 통과, 필수 리뷰 결과 |

처음 연결할 때는 격리된 임시 사본에서 **정상 예제는 통과하고 잘못된 예제는 실패하는지** 확인한다.
예를 들어 직접 색상을 넣거나 입력 라벨을 제거했는데도 성공한다면 검사 대상 경로·규칙 연결부터 고친다.
이 연결 시험은 설정·대상 범위 변경 시 다시 확인하며 매 작업마다 같은 실험을 반복하지 않는다.
테스트용 데이터·서버는 운영과 분리하고 시험 뒤 정리한다.

로컬 전용 예제는 로컬 검사 완료와 원격 CI·브랜치 보호 미연결을 구분해 기록한다. 로컬 통과를 서버 강제나
회사 전체 도입 완료로 확대하지 않는다. 새 원격 저장소·배포가 필요하면 그 적용 범위를 별도로 정한다.

> AI 리뷰는 PR마다 `/code-review` 스킬(구독 포함, API 과금 없음)이 수행 — 외부 봇·시크릿 등록 불필요.

### 3. 최종 검증

- [ ] 기본 브랜치에 표준 `commitlint.yml`·validator가 올라간 뒤 보호 설정 적용. `new-repo.sh`는
      원격 자산이 정본과 다르거나 조회에 실패하면 새 보호를 적용하지 않으며, 기존 보호는 재실행해도
      변경하지 않는다. 이전 `commitlint`에서 전환할 때는 [전환 절차](specs/trusted-commitlint.md)를 따른다.
- [ ] `commitlint-trusted` target 검사가 실제 PR에 연결되어 통과하는지 확인. 공개 repo는 해당 이벤트의
      허용 정책도 확인한다(2026-11-02 기본 제한 시행).

- [ ] 테스트 PR 1개 생성 → ci-gate 통과 확인 (`pull_request` 트리거 전용 — push로는 실행 안 됨)
      체크명은 스택별로 다름: Node/Python/Rails=`quality`·`secret-scan`, Spring/NestJS 풀스택=`backend`·`frontend`·`secret-scan`
- [ ] CI가 §2의 제품 검사 명령을 실제로 실행하고, 결과의 커밋이 PR 후보와 일치하는지 확인

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
- Claude Code와 Codex는 모두 harness skill·hook을 지원한다. UI는 다르지만 같은 skill
  수용 기준, PR wrapper, 리뷰·CI 게이트를 따른다.
- Codex는 `harness-guard` v0.61.0 이상을 설치하고, 관리자가
  `/path/to/team-harness/scripts/install-codex-managed-requirements.sh`로 `hooks=true`를 머신에 고정한다.
  unified exec lifecycle은 현재 Codex native hook 구현에 위임한다.
- 최초 plugin 설치와 갱신은 [Native Refresh Runbook](specs/codex-guard-compatibility.md#codex-native-refresh-runbook)의 공식 CLI 경로로 발행 태그를 지정한다. 로컬 개발 브랜치를 설치 원본으로 썼다면 기존 checkout은 보존하고 marketplace 원본만 발행 태그로 바꾼다. 설치 후 버전·enabled·native 계약과 새 작업의 skill 로딩을 확인한다.
- 외부 `security-guidance` 수정까지 별도로 승인한 환경에서만 기존 launcher를 사용한다. `--probe`는 별도 격리 fixture·모델 실행 검증이며, 일반 plugin 갱신만으로 실행 승인된 것으로 간주하지 않는다.
  ```bash
  bash /path/to/team-harness/scripts/codex-hardened.sh --version
  bash /path/to/team-harness/scripts/harness-doctor.sh --repo . --probe
  ```
- hook 실행을 검증해야 한다면 `/hooks`에서 새 command hash를 review/trust하고 승인된 안전한 fixture로 확인한다. skill 발견·파일 검사를 실제 hook 차단·권한 집행의 증거로 확대하지 않는다.
- 전용 plugin/hook 적합성을 검증하지 않은 기타 AI 도구는 `AGENTS.md` + git hook +
  branch protection + CI 범위로 제한한다.

## E. 솔로 머지 권한 (auto-mode · 새 머신 1회 셋업)

솔로 환경에서 `/solo-merge`가 main 브랜치 보호의 승인요건을 잠시 조정하려 하면, auto-mode 분류기가 이를 보안 변경으로 보고 차단한다. 이 권한은 **보안 경계상 에이전트가 스스로 부여할 수 없다 — 사람이 1회** `~/.claude/settings.json`의 `permissions.allow`에 해당 허용 규칙을 직접 추가해야 한다(전역이라 모든 repo 적용, 설정은 sync되지 않아 새 PC마다 반복). 규칙 상세는 본인 보안정책에 따라 구성한다.

## 선택형 개발 조정 연결

제품의 기술·품질 기준을 채택한 후 [개발 조정 안내](development-coordination.md)를 연결한다. 조정에는 별도 npm 설치나 역할 profile 복사가 필요 없다. 초기 통합본의 도구를 사용했다면 [전환 절차](development-coordination.md#초기-통합본에서-전환)를 따라 실제 호출부를 확인하고 제품 기록을 보존한다. 이 선택만으로 GitHub 정책·회사 기준 채택이나 새 권한이 승인된 것은 아니다.

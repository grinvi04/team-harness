# AGENTS.md — 프로젝트 작업 규약 (AI 도구 공통)

> 이 파일은 **모든 AI 코딩 도구의 단일 규약 출처**다.
> Claude Code는 CLAUDE.md의 `@AGENTS.md` import로, Codex는 네이티브로,
> Gemini CLI는 contextFileName 설정으로 이 파일을 읽는다.
> 도구별 전용 지침은 각 도구의 파일(CLAUDE.md 등)에만 쓴다.

## 프로젝트 개요

<!-- 프로젝트 설명, 기술 스택, 디렉토리 구조 -->

## 브랜치 정책 (git flow)

- `main` / `develop` 직접 커밋·push **금지** — branch protection으로 서버에서 강제됨
- 작업 브랜치: `feature/*`, `fix/*`, `hotfix/*`, `release/*`
- `feature/*` 브랜치는 **계획 아티팩트(`docs/specs/<name>.md`) 선행 필수** — 없으면 하네스 가드가 브랜치 생성을 차단(계획-먼저 강제). trivial 변경은 `HARNESS_TRIVIAL=1` 프리픽스로 명시 면제. (`fix/*`·`hotfix/*`는 이 게이트 무관)
- 모든 변경은 PR 경유: 브랜치 → PR 생성 → 리뷰·CI 게이트 통과 → 머지
- hotfix는 main 기준 분기 후 **main과 develop 양쪽에** 반영

## 품질 게이트

- 커밋 전: lint + test 통과 필수
- 커밋 메시지: Conventional Commits + team-harness 한국어 형식 — 코드 의미 변경은 `이유:` 본문 필수.
  `commit-msg`와 CI commitlint가 동일 validator로 강제 (`docs/code-review.md`)
- PR 머지 전: CI 전체 통과 + 리뷰 스레드 전부 resolve + 승인 요건 충족 — **팀 모드**(리뷰어 有)는 사람 승인 1명 이상, **솔로**는 승인요건 0이라 CI-gate·enforce_admins=on이 우회불가 게이트를 대신한다
- 테스트 스킵 플래그(-DskipTests 등) 사용 금지

### QA 계약 연결

- 구현·시험 전에 요구·위험에서 필수 범위와 기대 결과를 정하고, 완료 전 그 범위의 증거를 대조한다.
  현재 제공된 skill 목록에서 **harness-guard 제공 `verification-before-completion`**의 실제 경로를
  읽어 프로젝트 계약으로 연결한다. 같은 이름의 Superpowers 스킬은 일반 방법론이며 이 계약을 자동 포함하지 않는다.
  이미 읽은 현재 계약은 재사용한다. 단순 설명·조회에는 별도 QA workflow를 시작하지 않는다.
- 해당 스킬이 제공되지 않으면 경로를 추측하거나 자동 설치하지 않는다. 미로딩을 밝히고 이 파일의
  최소 계약을 적용한다: 요구→시험 범위→기대 결과, 실제 명령·디렉터리·후보별 증거, 최초 실패와 재시도
  보존, 필수 FAIL/UNVERIFIED가 남으면 완료 금지. 스킬 전체 적용 여부는 미확인으로 보고한다.
- 실행하지 않은 검사는 미실행이며 다른 명령의 성공으로 채우지 않는다. 필수 미실행은 UNVERIFIED,
  실제 비적용만 SKIP이다. 결과 파일의 PASS 값 자체는 실행 증거가 아니다.

## Markdown 동기화 완료 기준

- 작업 시작 시 관련 로드맵·체크리스트·스펙·진행 안내와 직접 소비 문서를 확인한다.
- 구현·설정·결정·단계가 바뀌면 해당 문서의 완료·미완료·차단·다음 행동을 같은 변경에서 갱신한다.
- 실제 코드·검사·Git·PR·태그와 문서 상태를 대조한다. 로컬 구현을 검증·병합·릴리즈·설치 완료로 확대하지 않는다.
- 과거 증거는 당시 후보·범위로 보존한다. PR 또는 로컬 인계에 갱신 문서·근거를 연결하고 영향이 없으면 이유를 남긴다.
- 관련 문서가 오래된 상태면 완료로 판정하지 않는다. 별도 중앙 상태 파일·중복 작업로그는 만들지 않는다.

## Skill 실행 가시성

- 사용자는 목표를 자연어로 요청하며 스킬 이름을 외울 필요가 없다. 일반 설계·TDD·디버깅은 사용자
  선택을 우선하고 설치된 Superpowers를 활용한다. 미설치면 native 방식으로 같은 프로젝트 계약을 지킨다.
- 일반 방법론 하나에 Harness의 프로젝트 기준·검사·인계·delivery 계약을 연결한다. 같은 계획·승인·
  테스트를 별도 workflow로 반복하지 않는다. 이미 승인된 범위와 현재 후보에 유효한 증거를 재사용한다.
- 현재 요청·원본 상태에 맞는 선택과 단계를 짧게 알린다. 질문·진단은 수정·Git·배포 권한을 만들지 않으며,
  route-intent의 안내도 실행 승인이나 올바른 스킬 선택의 증명이 아니다.

- harness skill을 적용할 때 첫 작업 업데이트에 **적용 skill과 현재 phase**를 표시한다. Git flow 단계가
  바뀌면 새 skill/phase도 짧게 알린다.
- Claude Code는 slash skill surface를 사용할 수 있고, Codex는 로드된 `SKILL.md`를 현재 agent가 직접
  수행할 수 있다. 별도 Skill tool-call이 보이지 않는다는 이유로 skill을 적용하지 않은 것으로 간주하지 않는다.
- 도구 UI가 달라도 skill의 수용 기준·wrapper·CI/리뷰 게이트 결과는 같아야 한다. 존재하지 않는 도구 호출을
  가장하지 않는다.

## Stack Rule 전달

- 작업 대상 stack과 관련된 `.claude/rules/*.md`를 작업 전에 읽는다. 이 경로는 Claude Code의 자동 로딩
  위치이지만 rule 원문은 도구 공통이다. Codex/Gemini는 AGENTS의 이 지시에 따라 관련 파일을 명시적으로 읽는다.

## 빌드·테스트 명령

<!-- 프로젝트별로 채움 -->
- 품질 검증: `<QUALITY_CHECK_CMD>`
- 테스트: `<TEST_CMD>`
- 빌드: `<BUILD_CMD>`

## 배포·헬스체크 명령

<!-- 프로젝트별로 채움. /release Phase 0(스테이징 헬스체크)·Phase 5(프로덕션 헬스체크)가 이 섹션을 읽는다 -->
- 로컬 인프라 실행: `<채택한 도구의 실제 명령; 없으면 비적용>`
- 백엔드 헬스체크: `<실제 헬스체크 명령·경로; 없으면 비적용>`
- 인증 서비스 헬스체크: `<채택한 서비스의 실제 명령; 없으면 비적용>`
- 전체 스택 중지: `<실제 중지 명령; 없으면 비적용>`
- 데이터 초기화: `<대상·손실 범위를 확인하고 승인받은 격리 데이터용 명령>`

## 팀 표준 문서 (작업 전 해당 영역 표준 확인)

먼저 `standards-scope.md`를 읽고 적용할 공통 계약·선택 프로필을 구분한다. 제품별 선택은 이 repo에서 정한다.

상세 표준의 단일 출처: `github.com/grinvi04/team-harness/docs` (사내 git 이전 시 주소 교체)
필요 시 `gh api repos/grinvi04/team-harness/contents/docs/<파일>` 또는 클론으로 조회한다.

> **이 repo의 프로젝트 상태는 repo/GitHub에 둔다.** 플랜·스펙은 `docs/specs/`, 백로그·할 일은 GitHub
> Issues + Milestone(`/milestone`), 작업로그는 git 히스토리 + CHANGELOG/릴리즈노트, 설계 결정·도메인 지식은
> `docs/decisions.md`에 기록한다. **도구 로컬 AI 메모리(예: `~/.claude`, `~/.codex`)에 프로젝트 상태·백로그·
> 작업로그·결정·도메인 지식을 두지 않는다**(다른 PC·세션·사람이 못 보고 유실). 로컬 메모리는 팀 공유
> 불필요한 *개인 작업습관*에만 최소로. (정본: `ai-collaboration.md`)

| 영역 | 문서 | 핵심 |
|---|---|---|
| 적용 범위 | standards-scope.md | 공통 계약·선택 프로필·제품 결정 구분, 스택별 문제 해결 진입 |
| 개발 워크플로 | developer-workflow.md | 기능 개발·수정·머지·hotfix·release 흐름과 가드에 막혔을 때의 다음 행동 |
| API | api-standards.md | HTTP 계약·오류 구분, 응답·페이지 방식은 선택 프로필 |
| DB | db-standards.md | 식별자·감사·삭제 정책의 선택 조건, 공유 이력·데이터 보호 |
| 인증·인가 | auth-standards.md | 공급자 선택, 토큰·기능·객체 권한과 거부 검사 |
| 코드 구조 | clean-architecture.md | 선택한 계층·모듈 경계와 실제 검사 연결; 프레임워크·단순 구조의 대안 |
| 리뷰·커밋 | code-review.md | Conventional Commits 호환 한국어 형식, PR 규칙 |
| AI 협업 | ai-collaboration.md | 책임 원칙, 금지사항, 기록 위치(스펙→docs/specs, 백로그→Issues/Milestone, 작업로그→git/CHANGELOG, 결정→docs/decisions.md, 로컬 메모리=개인 습관만) |
| 운영·로깅 | operations.md | 장애 대응의 권한·호환성, 로그·추적·현재 배포 후보 확인 |
| README | readme-standards.md | 루트 README 양식(섹션 순서·뱃지·mermaid·시작하기), `templates/README.template.md` |
| 프론트 디자인 | frontend-design-standards.md | 필요한 디자인 토큰·컴포넌트, 접근성·실제 상태 표시·스택별 확인 경로 |
| 한국 UI/UX | korean-ux.md | 제품 용어·톤·지원 사용자·표시 형식, 실제 동작과 일치하는 안내 |

## 코딩 컨벤션

- 가정하지 말 것 — 불확실하면 묻는다
- 문제를 풀 수 있는 최소한의 코드 — 요청하지 않은 기능·추상화 금지
- 외과적 수정 — 꼭 필요한 것만 건드린다
- 기존 코드 스타일에 맞춘다

## 금지 사항 (모든 도구 공통)

- `.env`·시크릿을 코드/로그/외부로 노출 금지
- `git reset --hard`, 핵심 디렉토리 `rm -rf` — 사용자가 직접 실행
- 검증기(테스트·마이그레이션) 파일 삭제 금지 — 게이트 무력화 방지 (guard.sh 강제)
- 글로벌 패키지 설치 금지 (`npm install -g` 등) — 로컬 설치(`--save-dev`·`npx`) 사용
- 운영(prod) 환경 직접 조작 금지

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
- 모든 변경은 PR 경유: 브랜치 → PR 생성 → 리뷰·CI 게이트 통과 → 머지
- hotfix는 main 기준 분기 후 **main과 develop 양쪽에** 반영

## 품질 게이트

- 커밋 전: lint + test 통과 필수
- 커밋 메시지: Conventional Commits(타입 영어 + 본문 한국어) — `commitlint`가 CI에서 강제 (`commitlint.config.js`)
- PR 머지 전: 사람 승인 1명 이상 + CI 전체 통과 + 리뷰 스레드 전부 resolve
- 테스트 스킵 플래그(-DskipTests 등) 사용 금지

## 빌드·테스트 명령

<!-- 프로젝트별로 채움 -->
- 품질 검증: `<QUALITY_CHECK_CMD>`
- 테스트: `<TEST_CMD>`
- 빌드: `<BUILD_CMD>`

## 배포·헬스체크 명령

<!-- 프로젝트별로 채움. /release Phase 0(스테이징 헬스체크)·Phase 5(프로덕션 헬스체크)가 이 섹션을 읽는다 -->
- 로컬 인프라 실행 (DB · Keycloak): `docker compose up -d`
- 백엔드 헬스체크: `curl -sf http://localhost:<BACKEND_PORT>/actuator/health`
- Keycloak 헬스체크: `curl -sf http://localhost:<KEYCLOAK_PORT>/health/ready`
- 전체 스택 중지: `docker compose down`
- 데이터 초기화: `docker compose down -v`

## 팀 표준 문서 (작업 전 해당 영역 표준 확인)

상세 표준의 단일 출처: `github.com/grinvi04/team-harness/docs` (사내 git 이전 시 주소 교체)
필요 시 `gh api repos/grinvi04/team-harness/contents/docs/<파일>` 또는 클론으로 조회한다.

| 영역 | 문서 | 핵심 |
|---|---|---|
| API | api-standards.md | 공통 Envelope, 에러코드 체계, offset 페이지네이션 |
| DB | db-standards.md | BIGINT PK+채번, 공통 감사 컬럼, forward-only 마이그레이션 |
| 인증·인가 | auth-standards.md | Keycloak OIDC, RBAC 권한코드+데이터 스코프 |
| 코드 구조 | clean-architecture.md | 도메인 모듈 1차 경계, 모듈 간 api/·도메인 이벤트로만 통신 |
| 리뷰·커밋 | code-review.md | Conventional Commits(타입 영어+본문 한국어), PR 규칙 |
| AI 협업 | ai-collaboration.md | 책임 원칙, 금지사항 |
| 운영·로깅 | operations.md | 로그 레벨 기준(ERROR=알람), traceId 전파 |
| README | readme-standards.md | 루트 README 양식(섹션 순서·뱃지·mermaid·시작하기), `templates/README.template.md` |
| 프론트 디자인 | frontend-design-standards.md | 디자인 토큰(하드코딩색 금지·차트팔레트·status)·앱셸·공통 컴포넌트(DataTable·FormField·StatCard·ChartCard·차트)·base-ui/recharts/React 함정·다크/반응형/a11y/정직한 UI |

## 코딩 컨벤션

- 가정하지 말 것 — 불확실하면 묻는다
- 문제를 풀 수 있는 최소한의 코드 — 요청하지 않은 기능·추상화 금지
- 외과적 수정 — 꼭 필요한 것만 건드린다
- 기존 코드 스타일에 맞춘다

## 금지 사항 (모든 도구 공통)

- `.env`·시크릿을 코드/로그/외부로 노출 금지
- `git reset --hard`, 핵심 디렉토리 `rm -rf` — 사용자가 직접 실행
- 글로벌 패키지 설치 금지 (`npm install -g` 등) — 로컬 설치(`--save-dev`·`npx`) 사용
- 운영(prod) 환경 직접 조작 금지

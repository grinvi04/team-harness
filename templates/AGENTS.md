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
- PR 머지 전: CI 전체 통과 + 리뷰 스레드 전부 resolve
- 테스트 스킵 플래그(-DskipTests 등) 사용 금지

## 빌드·테스트 명령

<!-- 프로젝트별로 채움 -->
- 품질 검증: `<QUALITY_CHECK_CMD>`
- 테스트: `<TEST_CMD>`
- 빌드: `<BUILD_CMD>`

## 코딩 컨벤션

- 가정하지 말 것 — 불확실하면 묻는다
- 문제를 풀 수 있는 최소한의 코드 — 요청하지 않은 기능·추상화 금지
- 외과적 수정 — 꼭 필요한 것만 건드린다
- 기존 코드 스타일에 맞춘다

## 금지 사항 (모든 도구 공통)

- `.env`·시크릿을 코드/로그/외부로 노출 금지
- `git reset --hard`, 핵심 디렉토리 `rm -rf` — 사용자가 직접 실행
- 운영(prod) 환경 직접 조작 금지

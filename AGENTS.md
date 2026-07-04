# AGENTS.md — team-harness 작업 규약 (AI 도구 공통)

> 이 파일은 **team-harness에서 일하는 AI의 단일 작업 계약**이다. Claude Code는 CLAUDE.md의
> `@AGENTS.md` import로, Codex/Gemini는 네이티브로 읽는다. 도구별 전용 지침은 CLAUDE.md에만 쓴다.
> ⚠️ 소비 repo가 받는 `templates/AGENTS.md`와 **다르다** — 그건 신규 repo용 템플릿이고, 이 파일은
> team-harness *자기 자신*의 규약이다(자기 표준 dogfooding).

## 정체성·범위

이 repo는 **AI 코딩 거버넌스 하네스 자체**다 — 제품 앱이 아니다(런타임 서버·DB·프론트 없음).

- **harness-guard 플러그인**(`plugins/harness-guard/`): `guard.sh`(PreToolUse 가드), `route-intent.mjs`(UserPromptSubmit), PR 래퍼(`pr-create.sh`·`pr-merge.sh`), 스킬(`skills/`), 에이전트.
- **팀 표준 문서**(`docs/`): 전 소비 repo가 상속하는 표준의 **단일 출처**. 설계 결정 = `docs/decisions.md`.
- **신규 repo 셋업 도구**(`templates/`, `scripts/new-repo.sh`, `scripts/set-branch-protection.sh`).
- 소비 repo(erp·siku·webhook-service·drivertree)가 이 repo의 표준·플러그인을 상속한다.

## 스택

- **bash** 스크립트(가드·훅·PR 래퍼·테스트), **Node ESM `.mjs`**(`route-intent`·`merge-permissions`·`check-migration-safety`·`check-repo-sync`), **Markdown** 표준 문서.
- 앱 빌드 없음. 여기서 "빌드"는 **구문·JSON·테스트 검증**을 뜻한다.

## 빌드·테스트 명령

- 구문: `bash -n <script>.sh` · `node --check <file>.mjs`
- JSON 유효성: `plugin.json`·`hooks.json`·`templates/settings.json`·`templates/permissions/*.json`
- 테스트: `bash tests/<name>-test.sh` — guard·route-intent·merge-permissions·migration-safety·repo-sync·pr-merge-auto
- **전량 게이트 = CI `.github/workflows/ci-gate.yml` quality 잡**. 로컬 재현 = 그 스텝들을 그대로 실행.

## 브랜치·PR (자기 guard.sh가 강제)

- `main`/`develop` 직접 커밋·push **금지**(guard.sh + branch protection 서버 강제). 작업은 `fix/`·`feature/`·`hotfix/`·`release/` 브랜치 → PR.
- **feature 브랜치는 `docs/specs/<name>.md`(=`/plan` 산출) 선행 필수**(guard.sh F5 게이트). trivial은 `HARNESS_TRIVIAL=1` 명시 면제.
- 맨손 `gh pr create`/`gh pr merge` **금지** → 래퍼 `scripts/pr-create.sh`·`scripts/pr-merge.sh` 경유(내부 gh는 자식 프로세스라 훅 무관).
- PR·머지·솔로/브랜치보호 정책의 **정본 = `docs/code-review.md`**. develop CI-green 자동머지는 `pr-merge.sh --auto`(같은 문서).
- 커밋: **Conventional Commits**(타입 영어 + 본문 한국어) — `docs/code-review.md`.

## 기록 위치 (자기 정책 dogfood — `docs/ai-collaboration.md`)

- 표준 = `docs/`, 결정·이유 = `docs/decisions.md`, 백로그·할 일 = **GitHub Issues**, 스펙 = `docs/specs/`, 작업로그 = git 히스토리·커밋.
- 도구 로컬 AI 메모리엔 프로젝트 상태·백로그·결정·도메인 지식을 두지 않는다(개인 작업습관만).

## 버전·릴리즈

- **플러그인 동작 변경**(스크립트·훅·스킬·`templates/`) 시 `plugins/harness-guard/.claude-plugin/plugin.json` + `README.md` 배지 **버전 bump** — `docs/harness-maintenance.md`.
- 릴리즈: `develop`→`release/vX`→`main` PR + 태그(`/release`). 상세 `docs/harness-maintenance.md`.

## 금지 사항

- guard/secret-scan 훅·가드를 **우회 목적으로 완화** 금지(정당한 개선은 테스트·decisions 동반).
- 소비 repo에 영향 주는 변경 시 **버전 bump 누락** 금지.
- 테스트 스킵, `main`/`develop` 직접 push, 시크릿 커밋 금지.

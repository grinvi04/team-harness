# AGENTS.md — team-harness 작업 규약 (AI 도구 공통)

> 이 파일은 **team-harness에서 일하는 AI의 단일 작업 계약**이다. Claude Code는 CLAUDE.md의
> `@AGENTS.md` import로, Codex/Gemini는 네이티브로 읽는다. 도구별 전용 지침은 CLAUDE.md에만 쓴다.
> ⚠️ 소비 repo가 받는 `templates/AGENTS.md`와 **다르다** — 그건 신규 repo용 템플릿이고, 이 파일은
> team-harness *자기 자신*의 규약이다(자기 표준 dogfooding).

## 정체성·범위

이 repo는 **AI 코딩 거버넌스 하네스 자체**다 — 제품 앱이 아니다(런타임 서버·DB·프론트 없음).

- **harness-guard 플러그인**(`plugins/harness-guard/`): `guard.sh`(PreToolUse 가드), `route-intent.mjs`(UserPromptSubmit), PR 래퍼(`pr-create.sh`·`pr-merge.sh`), 스킬(`skills/`), 에이전트.
- **팀 표준 문서**(`docs/`): 전 소비 repo가 상속하는 표준의 **단일 출처**. 설계 결정 = `docs/decisions.md`.
- **신규 repo 셋업 도구**(`templates/`, `scripts/new-repo.sh`, `plugins/harness-guard/scripts/set-branch-protection.sh`).
- 소비 repo(erp·siku·webhook-service·drivertree)가 이 repo의 표준·플러그인을 상속한다.

## 제품 방향 게이트

- 제품 방향의 정본은 `docs/product-direction.md`다. 신규 기능·호환 계층·공용 workflow를 제안하거나 수정하기
  전에 문서의 **신규 기능 판단 게이트**로 `소유 / 연결 / 위임` 중 하나를 먼저 판정한다.
- Team Harness는 GitHub 정책·증거·감사·delivery 강제를 소유한다. skill 로딩, hook lifecycle, subagent,
  sandbox·permission처럼 실행 플랫폼이 안정적으로 제공하는 기능은 native-first로 위임하고 필요한 결과 검증만 남긴다.
- 특정 소비 repo 요구는 공용 하네스에 올리지 않는다. 플랫폼 기본 기능 복제나 장기 cache patch는 공식 surface로
  대체할 수 있는지 먼저 확인하고, 유지 이유가 없으면 새 기능이 아니라 제거·축소 대상으로 분류한다.

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
- 맨손 `gh pr create`/`gh pr merge` **금지** → 래퍼 `plugins/harness-guard/scripts/pr-create.sh`·`plugins/harness-guard/scripts/pr-merge.sh` 경유(내부 gh는 자식 프로세스라 훅 무관).
- PR·머지·솔로/브랜치보호 정책의 **정본 = `docs/code-review.md`**. develop CI-green 자동머지는 `pr-merge.sh --auto`(같은 문서).
- 커밋: **Conventional Commits + team-harness 한국어 형식** — `docs/code-review.md`.
  코드 의미 변경(`feat|fix|refactor|perf`)은 `이유:` 본문 필수이며 `commit-msg`와 CI가 동일 validator로 강제한다.

## 기록 위치 (자기 정책 dogfood — `docs/ai-collaboration.md`)

- 표준 = `docs/`, 결정·이유 = `docs/decisions.md`, 백로그·할 일 = **GitHub Issues**, 스펙 = `docs/specs/`, 작업로그 = git 히스토리·커밋.

## Skill 실행 가시성

- harness skill을 적용할 때 첫 작업 업데이트에 **적용 skill과 현재 phase**를 표시한다. Git flow 단계가
  바뀌면 새 skill/phase도 짧게 알린다.
- Claude Code는 slash skill surface를 사용할 수 있고, Codex는 로드된 `SKILL.md`를 현재 agent가 직접
  수행할 수 있다. 별도 Skill tool-call이 보이지 않는다는 이유로 skill을 적용하지 않은 것으로 간주하지 않는다.
- 도구 UI가 달라도 skill의 수용 기준·wrapper·CI/리뷰 게이트 결과는 같아야 한다. 존재하지 않는 도구 호출을
  가장하지 않는다.

## Stack Rule 전달

- 작업 대상 stack과 관련된 `.claude/rules/*.md`를 작업 전에 읽는다. 이 경로는 Claude Code의 자동 로딩
  위치이지만 rule 원문은 도구 공통이다. Codex/Gemini는 AGENTS의 이 지시에 따라 관련 파일을 명시적으로 읽는다.
- 도구 로컬 AI 메모리엔 프로젝트 상태·백로그·결정·도메인 지식을 두지 않는다(개인 작업습관만).

## 버전·릴리즈

- **플러그인 동작 변경**(스크립트·훅·스킬·`templates/`) 시 `plugins/harness-guard/.claude-plugin/plugin.json` + `README.md` 배지 **버전 bump** — `docs/harness-maintenance.md`.
- 릴리즈: `develop`→`release/vX`→`main` PR + 태그(`/release`). 상세 `docs/harness-maintenance.md`.

## 금지 사항

- guard/secret-scan 훅·가드를 **우회 목적으로 완화** 금지(정당한 개선은 테스트·decisions 동반).
- 소비 repo에 영향 주는 변경 시 **버전 bump 누락** 금지.
- 테스트 스킵, `main`/`develop` 직접 push, 시크릿 커밋 금지.

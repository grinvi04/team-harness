# CLAUDE.md

@AGENTS.md

## Claude Code 전용 지침

- **git-flow는 harness-guard 커맨드로**: 계획 `/plan`(docs/specs 산출) → 개발 `/feature-add`·`/feature-modify` → PR `/pr-create` → 머지 `/feature-merge`·`/hotfix`·`/release`. 맨손 gh/git 대신 스킬·래퍼를 쓴다.
- **PR 머지 전 게이트**: `pr-review-gate` 스킬 절차를 따른다(단일 출처).
- **머지 안전(develop-auto)**: develop CI-green PR은 `bash pr-merge.sh --auto <PR>`로 auto-mode 분류기 프롬프트 없이 머지한다(settings `Bash(bash * pr-merge.sh --auto *)` allow-rule). `--auto`는 base=develop만 허용하고 main은 거부 — **main/release는 --auto 대상 아님**, 건별 확인·`/release`·`/hotfix` 경유. 정본: `docs/code-review.md` 솔로 절 + `docs/specs/develop-auto-merge.md`.
- **릴리즈 전 보안 검토**: `security-reviewer` 에이전트를 spawn한다.
- **모델 티어 위임(비용)**: 읽기·검색은 `Explore`(haiku)·빌드·테스트는 `general-purpose`(sonnet)에 **위임**하고, opus 메인은 계획·검토·설계·오케스트레이션만. 무거운 다단계는 `Workflow`(stage별 모델 결정론적). **"1회성 자잘" 확대 적용해 읽기·빌드를 opus 인라인하지 말 것**(단일 trivial만 인라인). 구체 결정표 = `docs/model-tiering.md` "실전 결정표". 강제 아닌 재량 안내 — 진짜 결정론적 보장은 `opusplan`·Workflow(도구 기능).
- **세션 위생(비용)**: 뚜렷한 페이즈 전환(한 작업 끝 → 다른 목표 시작)에서 `/clear`를 **먼저 제안**하고, 컨텍스트가 커지면(statusline `ctx%`) `/compact`를 제안한다. 긴 단일 세션의 누적 컨텍스트 캐시-리드가 opus 비용의 최대 축(7월 실측 ≈70%). 강제 아닌 능동 제안 — 실행은 사용자 몫이나 경계에서 먼저 말하는 건 AI 몫. 정본: `docs/model-tiering.md` 세션 위생 절.
- **자기 dogfooding**: team-harness는 자기 guard.sh·branch protection의 적용 대상이다 — 다른 소비 repo와 똑같이 브랜치·PR·게이트를 지킨다.
- **자기 플러그인을 세션에서 활성화(dogfood 실행법)**: 이 repo에서 harness-guard의 훅·스킬을 실제로 발동시키려면
  **`claude --plugin-dir ./plugins/harness-guard`로 실행**한다 — 워킹트리에서 **라이브 로드**(캐시 stale 회피).
  그래야 route-intent가 다음 단계 스킬(`/plan`·`/feature-add`·`/release` 등)을 자동 주입하고, guard 훅이 붙고,
  `SKILL.md` 스킬이 발견된다. 미실행 시 이 repo 세션엔 플러그인 계층이 **안 붙는다**(맨손 재량으로 회귀).
  ⚠️ `enabledPlugins`에 커밋하지 말 것 — 로컬-디렉터리 마켓플레이스도 캐시로 복사돼 **옛 버전이 라이브 코드를
  가린다**(shadowing). 설치형 테스트가 필요하면 `--scope local`로 별도 세션에서. (스킬 추가 시 매니페스트는
  반드시 대문자 `SKILL.md` — `tests/skill-discovery-test.sh`가 강제.)

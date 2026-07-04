# CLAUDE.md

@AGENTS.md

## Claude Code 전용 지침

- **git-flow는 harness-guard 커맨드로**: 계획 `/plan`(docs/specs 산출) → 개발 `/feature-add`·`/feature-modify` → PR `/pr-create` → 머지 `/feature-merge`·`/hotfix`·`/release`. 맨손 gh/git 대신 스킬·래퍼를 쓴다.
- **PR 머지 전 게이트**: `pr-review-gate` 스킬 절차를 따른다(단일 출처).
- **머지 안전(develop-auto)**: develop CI-green PR은 `bash pr-merge.sh --auto <PR>`로 auto-mode 분류기 프롬프트 없이 머지한다(settings `Bash(bash * pr-merge.sh --auto *)` allow-rule). `--auto`는 base=develop만 허용하고 main은 거부 — **main/release는 --auto 대상 아님**, 건별 확인·`/release`·`/hotfix` 경유. 정본: `docs/code-review.md` 솔로 절 + `docs/specs/develop-auto-merge.md`.
- **릴리즈 전 보안 검토**: `security-reviewer` 에이전트를 spawn한다.
- **자기 dogfooding**: team-harness는 자기 guard.sh·branch protection의 적용 대상이다 — 다른 소비 repo와 똑같이 브랜치·PR·게이트를 지킨다.

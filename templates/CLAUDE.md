# CLAUDE.md

@AGENTS.md

## Claude Code 전용 지침

<!-- AGENTS.md(공통 규약) 외에 Claude Code에만 해당하는 지침을 여기에 쓴다 -->

- git-flow 작업은 harness-guard 플러그인 커맨드 사용: `/feature-merge`, `/hotfix`, `/release`
- PR 머지 전 게이트는 `pr-review-gate` 스킬 절차를 따른다 (단일 출처)
- 릴리즈 전 보안 검토는 `security-reviewer` 에이전트를 spawn한다

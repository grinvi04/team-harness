# team-harness

팀(5–10인+)·프로덕션 환경용 AI 코딩 거버넌스. 기존 1인용 cp 기반 harness(`~/project/harness`, 그대로 운영 유지)의 후계로, **Claude Code 플러그인 마켓플레이스 + repo 커밋 설정 + git/CI 강제**의 3축으로 재설계했다.

## 설계 원칙 — 4계층 (강제력은 아래로 내릴수록 강하고 AI-중립)

| 계층 | 내용 | 강제 대상 | 위치 |
|---|---|---|---|
| 0 | branch protection + CI 게이트 (push 시점, 우회 불가) | **모든 사람·모든 AI 도구** | GitHub (`templates/ci/`) |
| 0.5 | git pre-commit 훅 (커밋 시점, `--no-verify`로 우회 가능) | 모든 사람·모든 AI 도구 | 각 repo `.githooks/` (`templates/githooks/`) |
| 1 | repo 커밋 설정 — AGENTS.md(규약 단일출처) + `.claude/` | repo를 clone한 전원 | 각 프로젝트 repo (`templates/`) |
| 2 | harness-guard 플러그인 — 가드 훅·게이트 스킬·git-flow 커맨드 | Claude Code 사용자 | 이 repo (`plugins/`) |
| 3 | 역할별 named agents | Claude Code 사용자 | 플러그인 + 프로젝트 `.claude/agents/` |

운영 제약(2026-06 기준): Team/Enterprise 플랜 없음(서버 managed settings 불가 → 계층 0이 유일한 하드 강제), 실험 기능(agent teams 등) 미사용, 팀별 단일 AI 도구(개발=Claude Code, 타 팀은 Codex/Gemini 가능 → AGENTS.md로 규약 공유).

## 구조

```
.claude-plugin/marketplace.json   ← 사내 마켓플레이스 카탈로그
plugins/harness-guard/            ← 플러그인 본체
  hooks/hooks.json                ← PreToolUse 가드 배선 (${CLAUDE_PLUGIN_ROOT})
  scripts/guard.sh                ← main/develop 보호·reset --hard·rm -rf·npm -g 차단
  commands/                       ← /feature-merge /hotfix /release
  skills/pr-review-gate/          ← PR 리뷰·CI 게이트 절차 (단일 출처)
  agents/security-reviewer.md     ← 릴리즈 전 보안 검토 (opus)
templates/                        ← 신규 프로젝트에 복사할 파일들
docs/onboarding.md                ← 프로젝트/팀원 온보딩 절차
```

## 빠른 시작 (로컬 테스트)

```
/plugin marketplace add /Users/<me>/team-harness
/plugin install harness-guard@team-harness
```

신규 프로젝트 셋업·팀원 온보딩·managed settings 로컬 시뮬레이션은 `docs/onboarding.md`.

## 구 harness와의 관계

- `~/project`의 3개 프로젝트는 **기존 harness(v1.6.0) 그대로 운영** — 이 repo와 무관, 건드리지 않는다.
- 이 repo는 신규(회사) 프로젝트 전용. cp/SKIP_CMDS/sync-check/HARNESS_VERSION 메커니즘은 플러그인 버전 배포로 대체됨.
- 스택별 변형(java validate-edit 등)은 플러그인에 넣지 않는다 — 각 프로젝트 `.claude/`에 커밋 (플러그인 훅과 공존).

## 로드맵

- [x] v0.1 스캐폴딩 — 마켓플레이스 + harness-guard(가드·게이트·커맨드·에이전트) + 템플릿 + 온보딩
- [ ] 로컬 마켓플레이스 설치 후 가드 실동작 검증 (`settings.json` 키 포맷 포함)
- [ ] 파일럿: 신규 프로젝트 1개에 계층 0~2 풀 적용
- [ ] 사내 git 호스팅으로 push, 템플릿의 마켓 주소 교체
- [ ] (플랜 도입 시) server-managed settings로 권한 강제 / (GA 시) agent teams 재검토

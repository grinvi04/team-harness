# team-harness

팀(5–10인+)·프로덕션 환경용 AI 코딩 거버넌스 — **Claude Code 플러그인 마켓플레이스 + repo 커밋 설정 + git/CI 강제**의 3축으로 설계했다.

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
  commands/                       ← /feature-merge /hotfix /release /release-check
  skills/pr-review-gate/          ← PR 리뷰·CI 게이트 절차 (단일 출처)
  agents/security-reviewer.md     ← 릴리즈 전 보안 검토 (opus)
templates/                        ← 신규 프로젝트에 복사할 파일들 (설정·CI·PR 템플릿)
docs/                             ← 온보딩 · stack-guide · architecture-infra · clean-architecture
                                    · api/db/auth-standards · ai-collaboration · code-review
```

## 빠른 시작 (로컬 테스트)

```
/plugin marketplace add /Users/<me>/team-harness
/plugin install harness-guard@team-harness
```

신규 프로젝트 셋업·팀원 온보딩·managed settings 로컬 시뮬레이션은 `docs/onboarding.md`.

## 운영 원칙

- 공통 거버넌스 배포는 파일 복사가 아니라 **플러그인 버전 배포**로 — 프로젝트별 동기화 스크립트·버전 마커 불필요.
- 스택/프로젝트별 변형(전용 가드·검증 훅 등)은 플러그인에 넣지 않는다 — 각 프로젝트 `.claude/`에 커밋 (플러그인 훅과 공존).

## 로드맵

- [x] v0.1 스캐폴딩 — 마켓플레이스 + harness-guard(가드·게이트·커맨드·에이전트) + 템플릿 + 온보딩
- [x] 로컬 마켓플레이스 설치·가드 실동작 검증 (cd 우회 차단, settings 키 포맷 스키마 대조)
- [x] 파일럿 리허설 — 온보딩 절차 풀 드릴, 발견 사항 반영
- [x] GitHub push (개인 private repo, 임시) + 문서 체계(기술선택·아키텍처·표준·운영 11종)
- [x] 팀 환경 정합화 — back-merge PR 절차, 사람 승인 게이트, AI 리뷰(claude-code-action) 연결
- [ ] 첫 회사 프로젝트: 스택 확정 → 스캐폴드(AGENTS.md·CI 구체화) → 계층 0~2 풀 적용
- [ ] 사내 git 호스팅으로 이전, 템플릿의 마켓 주소 교체
- [ ] (플랜 도입 시) server-managed settings로 권한 강제 / (GA 시) agent teams 재검토

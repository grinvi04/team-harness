# 의사결정 기록 (Decision Log)

확정된 기술·프로세스 결정의 **단일 출처**. "무엇이 언제 확정됐고, 어느 문서가 정본인가"를 한 곳에서 답한다.

> 존재 이유: 결정이 문서 곳곳의 "(확정)" 표기로 흩어져 있으면, 먼저 쓰인 문서에 후속 결정이
> 역반영되지 않아 문서 간 모순이 생긴다 (2026-06 정합성 검토에서 동일 패턴 3건 확인).

## 규약

- 새 결정 확정 시: **이 표에 행 추가 + 영향받는 문서 갱신을 같은 PR에서** 처리한다
- 결정 변경 시: 행을 지우지 않고 상태를 `대체됨(→新행)`으로 바꾼다 — 이력 보존
- "검토 중"인 것은 여기 적지 않는다 — 확정만 기록 (후보 비교는 stack-guide.md 영역)

## 결정 목록

| 결정 | 시점 | 정본 문서 | 영향 문서 |
|---|---|---|---|
| git-flow + main/develop branch protection (PR·승인 1+·스레드 resolve 서버 강제) | 2026-06 | onboarding.md | code-review.md, AGENTS.md, guard.sh |
| 거버넌스 배포 = 플러그인 버전 배포 (파일 복사·동기화 스크립트 금지) | 2026-06 | README.md | harness-maintenance.md |
| 규약 단일 출처 = AGENTS.md (도구별 전용 지침은 각 도구 파일에만) | 2026-06 | templates/AGENTS.md | CLAUDE.md, ai-collaboration.md |
| 커밋 = Conventional Commits (타입 영어 + 본문 한국어) | 2026-06 | code-review.md | operations.md(CHANGELOG) |
| DB = PostgreSQL (NoSQL은 보조 용도만) | 2026-06 | stack-guide.md | db-standards.md |
| 인증 = Keycloak OIDC, 자체 구현 금지 / 인가 = RBAC 권한코드 + 데이터 스코프 | 2026-06 | auth-standards.md | architecture-infra.md, stack-guide.md |
| API 응답 = 공통 Envelope (code·message·data), offset 페이지네이션 기본 | 2026-06 | api-standards.md | — |
| 마이그레이션 = forward-only (down 스크립트 금지), BIGINT PK + 채번 | 2026-06 | db-standards.md | release-check.md |
| 아키텍처 = 모듈러 모놀리스 → 미니서비스, 1차 경계 = 도메인 모듈 | 2026-06 | architecture-infra.md | clean-architecture.md |
| 모듈 내부 계층 = adapter → application → domain (interface/infrastructure 분리 안 함) | 2026-06 | clean-architecture.md | stack-guide.md |
| 배포 = EC2 단계 GitHub Actions push형 → EKS 단계 Argo CD pull형 | 2026-06 | architecture-infra.md | stack-guide.md |
| 시크릿 = AWS Secrets Manager/SSM (.env를 서버에 두지 않음) | 2026-06 | stack-guide.md | auth-standards.md, gitignore.snippet |
| 모델 티어링 = Haiku(단순)·Sonnet(빌드·메인 기본)·Opus(검증·설계·리서치), 메인 Haiku 불가 | 2026-06-21 | model-tiering.md | 커맨드 subagent `model:` 지정 |
| 마일스톤 레이어 추가 = `/milestone` 스킬 — GitHub Milestone 단일 출처, `/plan` 위에서 마일스톤·진행률 관리. 내장 `/goal`(세션 stopping condition)과 이름 충돌 회피로 rename | 2026-06-23 | skills/milestone/skill.md | README.md |
| `/plan` 스킬에 Claude Code plan mode 흡수 — Phase 0 진입 시 EnterPlanMode, Phase 5 승인 시 ExitPlanMode로 read-only 강제를 prose 규칙에서 메커니즘으로 승격 | 2026-06-23 | skills/plan/skill.md | — |
| 동기 조건-루프 = `/loop` 스킬 — exit 0 달성까지 즉시 반복, max·stuck·checkpoint 안전 장치. 내장 `/loop`(ScheduleWakeup 비동기 예약)와 별개 | 2026-06-23 | skills/loop/skill.md | README.md |
| 도메인·모듈별 번호(또는 브랜치) 규약은 구조적 out-of-order를 만든다 — 새 저버전 마이그레이션이 기존 적용분보다 낮음. 모듈별 독립이면 도구의 out-of-order 허용을 켠다(없으면 기존·운영 DB validate 실패, CI는 빈 DB라 통과) | 2026-06-28 | db-standards.md | flyway.md |
| 소프트삭제 필터는 모든 대상 엔티티/모델에 실제 적용되는지 삭제 후 제외 테스트로 검증 — ORM에 따라 상위 타입 선언이 하위 타입에 미상속될 수 있음 | 2026-06-28 | db-standards.md | java.md |
| 클라이언트 입력 오류(역직렬화·타입변환·검증 위반)는 4xx 매핑, 5xx 흡수 금지 / 낙관적 잠금 update 응답은 flush 후 매핑(stale version 방지) | 2026-06-28 | api-standards.md | java.md |
| 인증·데이터 의존 기능은 실 IdP 인증 + 실 백엔드 데이터 통합 e2e를 별도 게이트(env 플래그)로 — 더미세션 렌더 스모크로 갈음 금지 | 2026-06-28 | code-review.md | — |
| 위 교훈들을 prose→메커니즘으로 승격: 마이그레이션 안전성 정적 게이트(`scripts/check-migration-safety.mjs`+CI `migration-safety`), 게이트 스킬 체크 강화(release-check·pr-review-gate), 신규 프로젝트 템플릿 기본값(out-of-order: true·integration-e2e 스캐폴드) | 2026-06-28 | scripts/check-migration-safety.mjs | release-check/skill.md, pr-review-gate/skill.md, flyway.md, templates/ci/migration-safety.yml, templates/ci/integration-e2e.yml |

(시점 2026-06은 하네스 구축 시 일괄 소급 기재 — 이후 결정부터 개별 날짜로 기록)

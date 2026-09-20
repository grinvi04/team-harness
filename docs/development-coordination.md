# Team Harness로 제품 개발하기

Team Harness는 팀이 LLM으로 백엔드·프론트엔드·인프라 업무를 수행할 때 사용하는 공통 개발 기반이다. 기술·리뷰·배포 기준에 **선택형 개발 조정**을 연결한다. Agent Orchestration의 현재 개발과 배포 원본을 이 저장소로 통합했다.

## 개발자가 하는 일

1. 제품 저장소에 팀이 채택할 규칙과 기술 선택을 정한다. [기술 가이드](stack-guide.md), [아키텍처·인프라](architecture-infra.md), [온보딩](onboarding.md)을 참고한다. 아직 회사 기준을 채택하지 않았다면 Harness 제안과 실제 회사 정책을 구분한다.
2. 제품에서 만들거나 고칠 내용을 설명한다. `ao-coordinate`가 필요한 경우 에이전트가 목표·수용 기준을 정리하고 기존 이슈·작업 문서에 진행을 기록한다.
3. 에이전트가 구현·인계·검증을 이어간다. 간단한 수정은 단독으로 처리하고 필요한 조사·독립 검증만 나눈다. 사용자는 범위·권한·정책상 필요한 판단을 한다.
4. 현재 후보의 테스트·리뷰·CI 등 필수 기준을 확인한 후 인수한다. 로컬 완료와 원격 머지·릴리즈는 해당 정책에 따라 구분한다.

예를 들어 Spring Boot API와 Vue 화면을 함께 바꾸면 API 필드와 오류 응답, 프론트의 실패 상태, 저장 데이터 호환성을 같은 수용 기준으로 묶는다. 인프라 변경이 없다면 인프라 역할을 추가하지 않는다. 이후 다른 개발자가 같은 제품 기록을 읽고 이어간다.

## 구성과 정본

| 구성 | 정본 |
| --- | --- |
| 협업 진입점 | [ao-coordinate skill](../plugins/harness-guard/skills/ao-coordinate/SKILL.md) |
| 요청·진행·재개·인수 | [조정 절차](../plugins/harness-guard/tools/orchestration/docs/coordination-workflow.md) |
| 역할 책임·독립성 | [역할 계약](../plugins/harness-guard/tools/orchestration/docs/role-contracts.md) |
| 선택형 검사기·이전 설치 전환 | [도구 사용 안내](../plugins/harness-guard/tools/orchestration/docs/usage.md) |
| 패키지 경계·설치 profile | [제품 경계](product-boundaries.md) |
| 이전 실험과 검증 한계 | [이관 이력](../plugins/harness-guard/tools/orchestration/docs/history.md) |

`ao-coordinate`와 검사기는 기존 `workflow-pack` 소속이다. core와 native adapter는 기존 책임을 유지한다. 새 profile·권한 엔진·scheduler·대시보드를 추가하지 않는다. Codex에서는 현재 agent가 파일 수정·Git 작업을 수행하며 독립 탐색·반증만 native subagent에 맡기는 기존 실행 계약을 유지한다.

기본 조정에 npm 설치는 필요 없다. 구조화된 Task/Assignment/Artifact 검사가 필요한 팀만 Node.js 22 이상에서 `team-harness-orchestration` 로컬 tgz를 고정한다. 이 패키지는 별도 npm 공개 제품이나 agent 설치기가 아니다. split package는 여전히 `installable:false`인 staged 산출물이며 실제 공개 설치의 기본 경로는 기존 단일 plugin이다.

## 통합의 범위

현재 통합 후보 버전은 0.69.0이다. 기존 계약 검사와 실패 사례를 보존하고, 독립 패키지에서 관리하던 역할 TOML·skill stub 설치를 제거했다. 과거 Agent Orchestration 저장소는 Git 이력·실험 증거 보존용으로 남긴다. 제품별 실행 기록은 해당 제품에 유지한다.

선언 검사 통과는 실제 권한 집행·G1·회사 도입 준비를 뜻하지 않는다. 이번 통합은 Jev, 전역 설정, 새 모델·sandbox 실행 실험을 포함하지 않는다. 상세 수용 기준과 검증 상태는 [통합 명세](specs/agent-orchestration-integration.md)에 기록한다.

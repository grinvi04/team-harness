# Agent Orchestration 이관 이력

2026-09-20 사용자 승인으로 독립 Agent Orchestration을 Team Harness의 선택형 개발 조정 workflow로 통합했다. 원본은 로컬 `agent-orchestration` Git 저장소 commit `4004bd4c7409acf45d7f3c4a15f228d6735ac89a`다. 기존 Git 이력·태그·실행 증거는 그 저장소에 보존하며 현재 개발 정본은 Team Harness다.

이관한 것은 역할·작업·할당·인계 계약, schema 0.1.0, 네 선언 검사기와 기존 364개 회귀 테스트, 조정 절차 및 작업 기록 틀이다. 이전 역할 TOML 4개, 별도 skill stub 설치기, 시행착오 문서와 runtime 실행 자료는 새 배포물에 넣지 않는다. 새 작업 기록 도구는 설치 상태에 의존하지 않는다.

이전 v1.0의 실제 시험은 `team-task-board` 작업 수정 기능 한 건에서 별도 구현자 → 독립 검증자 → 인수를 실행한 로컬 결과다. 사용자가 승인한 D-013 예외는 그 한 건에만 적용됐다. 기술적 권한 강제·G1, 일반 native 로딩/격리, 운영 도입, Claude 동등성, 성능·비용 우월성은 검증된 것으로 취급하지 않는다. 기존 인수 원본은 제품 `docs/orchestration/task-edit/acceptance.md`와 관련 JSON이다.

옛 roadmap·실험 계획은 현재 실행 지시가 아니다. 새 작업은 Team Harness의 현재 spec·이슈와 제품 기록에서 정한다. Jev와 다른 모델 공급자 도입, 전역 설정 변경, 새 runtime 시험은 이번 통합에 포함되지 않는다.

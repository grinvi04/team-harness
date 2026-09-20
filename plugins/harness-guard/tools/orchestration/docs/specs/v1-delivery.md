# 실행 전 할당 선언 계약

기존 v1.0에서 이관한 `dispatch-only` API 계약이다. 당시 시험·예외의 범위는 [이관 이력](../history.md)에 구분한다.

## 실행 전 검사 API

`validateDispatch(task, assignment)`와 `node scripts/validate-dispatch.mjs TASK.json ASSIGNMENT.json`은 JSON 선언만 확인한다. scope는 `dispatch-only`. `valid: true`는 역할 생성·실행 release·권한 승인·필수 gate 통과가 아니다. 실제 ID는 PREPARE 응답 후 binding한다. schema version 0.1.0을 유지한다.

- Task 입력·source·oracle ref의 중복 URI 및 상충 revision 거부(CC-9).
- Task/Assignment schema, role·owner·acceptance 고유성, producer 선언, 현재 task/revision/run 일치.
- binding의 instance 및 agent ID 중복/누락, 필요한 전체 writer 이력, 독립 verifier와 writer 겹침 거부.
- write producer의 소유 경로 존재/epoch 일치, read-only producer의 소유권 없음/고정 candidate 존재.
- dispatch 상태는 READY만 허용. 의존 작업은 모두 ACCEPTED여야 한다. retry는 다른 attempt·증가 epoch·stop_ref 선언이 있어야 한다.
- scratch와 candidate/analysis 경로의 정확한 문자열 일치 거부. 경로 별칭·실제 정지·원본 진실성은 런타임 책임이다.
- 성공 0, JSON/schema/관계 오류 1, 인자/읽기 오류 2. 중복 JSON key와 비정규 epoch 표기를 거부하고 원문 값/경로를 오류로 유출하지 않는다. 파일·URI·명령을 추가 실행하지 않는다.

공유되는 할당 선언 규칙은 기존 결과 검사와 공통 함수로 유지하되 기존 assignment-only API/판정/출력과 테스트를 보존한다. 실행 전 검사를 위해 가짜 Artifact를 생성하지 않는다.


# 작업·산출물 연결 계약

## 1. 범위와 인터페이스

기존 형식 검사를 먼저 통과시킨 Task/Artifact 한 쌍에 대해 선언된 식별자·입력·소유권·판정의 연결을 검사한다. 기존 schema와 CLI는 변경하지 않는다.

```js
validateContract(task, artifact)
// { valid: boolean, scope: 'contract-only', errors: [{ path, rule }] }
```

```sh
node scripts/validate-contract.mjs TASK.json ARTIFACT.json
```

- Task는 **제출자에게 할당한 하나의 task slice**다. 그 `acceptance`가 이번 산출물의 책임 범위여야 한다. 전체 프로젝트의 acceptance를 일부 역할 결과에 그대로 적용하지 않는다. 여러 역할 결과의 합성·최종 수용은 이번 범위가 아니다.
- `valid`는 연결의 적합성이다. 산출물의 `verdict`를 바꾸거나 `READY`/`ACCEPTED`, 권한 승인, G1 통과를 출력하지 않는다. 일관된 FAIL/INCONCLUSIVE 보고도 유효한 연결이다.
- 입력은 JSON 데이터다. CLI는 중복 object key를 거부하며, 함수 API는 이미 모호성 없이 파싱된 JSON 값을 받는다. 임의의 getter·Proxy·클래스 인스턴스 실행을 격리하는 API가 아니다.
- 비교는 문자열의 정확한 일치다. 공백 제거, URI 정규화, 경로 확장, Git 조회, 입력에 있는 명령 실행·URI 접근을 하지 않는다.

## 2. 수용 기준

| ID | 규칙과 관찰 가능한 검증 |
| --- | --- |
| CC-1 | 두 입력 각각의 기존 schema를 검사하고 task/artifact 위치를 구분한다. 잘못된 타입·버전·위치면 연결 검사를 중단하고 값 대신 경로·규칙을 반환한다. |
| CC-2 | `task_id`, `task_revision`, `run_id`, `schema_version`이 일치해야 한다. 다른 작업·실행·revision 결과를 거부한다. |
| CC-3 | producer의 `(role, instance_id)`가 Task.roles에 있어야 한다. 같은 인스턴스의 여러 기능은 허용하되 동일 쌍의 중복은 거부한다. ownership.owner와 지정된 verifier도 등록된 instance여야 한다. |
| CC-4 | ownership.target은 이 slice에서 유일해야 한다. Artifact.owned_scope는 producer에게 선언된 target 집합과 정확히 같고 각 epoch가 Artifact.ownership_epoch와 같아야 한다. 누락·다른 owner·이전 epoch·중복 target을 거부한다. 모든 epoch는 0–9007199254740991의 안전한 정수여야 한다. CLI의 epoch는 소수점·지수·부호 없는 정수 표기로만 받으며 파싱 중 반올림된 숫자를 동일 할당으로 오인하지 않는다. |
| CC-5 | independent/external verifier는 이 slice의 candidate ownership을 갖는 어떤 인스턴스와도 같을 수 없다. risk.level=high 또는 risk.triggers가 있으면 self 모드를 거부한다. 저위험 self와 candidate를 소유하지 않은 verifier의 보고는 허용한다. |
| CC-6 | acceptance.id와 claim.acceptance_id는 각각 유일해야 한다. critical=true인 기준은 required=true여야 한다. claim/evidence가 미선언 acceptance를 가리키거나 evidence에 대응하는 claim이 없으면 거부한다. |
| CC-7 | 각 evidence의 candidate_ref는 Artifact.candidate_ref, method의 kind/value는 해당 acceptance.method와 같아야 한다. 동일 기준의 여러 evidence는 허용한다. |
| CC-8 | claim별 evidence 판정은 FAIL 우선, 그다음 INCONCLUSIVE, 나머지 PASS로 합성한다. evidence가 없으면 INCONCLUSIVE다. claim은 이 합성과 일치해야 한다. 전체 PASS는 모든 required acceptance의 PASS claim·evidence가 있어야 한다. 전체 FAIL에는 FAIL evidence와 그에 대응하는 FAIL claim이 있어야 한다. 선택 기준의 생략은 허용한다. partial FAIL과 증거 없는 INCONCLUSIVE는 보존한다. |
| CC-9 | Task.input_refs는 Artifact.input_refs에 URI·revision으로 모두 대응해야 한다. Artifact의 추가 입력은 Task.source 또는 verification.oracle_refs에 선언된 것만 허용한다. 각 목록의 중복 URI 및 Task manifest 간 같은 URI의 상충 revision을 거부한다. observed_at의 차이는 허용하지만 실제 신선도를 판정하지 않는다. |
| CC-10 | CLI는 정확히 두 파일을 받아 한 보고서를 출력한다. 유효 연결은 exit 0, 형식·연결·JSON·중복 key 오류는 1, 인자·읽기 오류는 2다. 두 입력 중 읽기 오류가 있으면 JSON 오류보다 우선한다. 오류에 입력 값·원문을 노출하지 않는다. |
| CC-11 | 함수·CLI는 입력을 수정하지 않는다. 명령·원본·증거 위치는 데이터로만 비교한다. 다른 cwd와 일반 Node symlink 호출에서도 검사하며 import만으로 CLI를 실행하지 않는다. |

## 3. 해석과 한계

- `ownership`은 이번 slice의 candidate 대상 할당이다. verifier의 disposable scratch·보고서 영역은 candidate 할당과 분리해야 한다. 독립성은 역할 이름이 아니라 instance ID와 선언된 할당으로 검사한다.
- `owned_scope`의 문자열은 명시한 target과 대응한다. `src/`가 `src/file.mjs`를 포괄한다는 판단이나 다른 kind의 동일 문자열을 구분하는 추측을 하지 않는다. 후자는 모호한 target으로 거부한다.
- `actual_scope`는 현재 schema에서 변경 **또는 분석** 범위다. 이것만으로 write set을 추정하지 않는다. 실제 diff·경로 포함·symlink·외부 자원 충돌·숨겨진 writer 이력은 runtime 검사 대상이다.
- Task에는 현재 `attempt_id`, slice의 `base_ref`, 읽기 전용 할당의 epoch가 없다. 해당 최신 할당과의 비교를 꾸며내지 않는다. 특히 `base_ref == start_ref`를 강제하지 않는다. 기존 출발점 이후의 정상 후보·재할당을 막을 수 있기 때문이다.
- ref·epoch·producer·evidence는 제출된 데이터다. 둘이 같은 오래된 값을 적었거나 거짓 증거를 적었는지는 알 수 없다. 소비자가 Task/할당의 원본·최신성, 실제 candidate, 실행 이력, gate를 따로 확인해야 한다.
- 소비자 등록, 의존 작업 상태, 예산 집행, 취소·중복 실행, 역할 배포, 평가 runner는 제외한다. CLI의 안전한 파싱을 기존 schema-only CLI에 소급 적용하지 않는다.

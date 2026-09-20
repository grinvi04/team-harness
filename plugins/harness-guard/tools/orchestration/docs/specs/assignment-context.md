# Assignment Context — 할당 선언 계약

## 1. 목표와 인터페이스

Task와 Artifact에 더해 **소비자가 원본에서 준비한 현재 할당 스냅샷**을 입력받는다. 선언된 최신 attempt/epoch/base, producer의 실행 식별자, 읽기 전용 후보, 재할당·독립성의 연결을 검사한다. 세 입력이 모두 같은 오래된/거짓 내용을 담은 경우는 판정할 수 없다.

```js
validateAssignment(task, assignment, artifact)
// { valid: boolean, scope: 'assignment-only', errors: [{ path, rule }] }
```

```sh
node scripts/validate-assignment.mjs TASK.json ASSIGNMENT.json ARTIFACT.json
```

`valid`는 제출된 연결의 적합성이지 실제 신선도·권한·수용 판정이 아니다. 이 함수는 dispatch controller가 아니다. Artifact가 없는 시작 전 선언은 별도 `validateDispatch(task, assignment)` / `ao-dispatch-check`로 확인한다([v1 계약](v1-delivery.md)). READY 할당만 허용하며 실제 권한·신선도·release는 아래 절차로 확인한다. 일관된 partial FAIL/INCONCLUSIVE 보고도 활성 할당에 대한 유효 보고다. 취소 등 비활성 할당의 결과는 재사용을 거부하되 원래 오류·증거를 보관한다.

## 2. 형식과 원본 책임

모든 필드는 필수이며 추가 필드는 거부한다. 문자열·ref·producer는 기존 schema의 text/ref/role 형식을 재사용한다. 배열은 중복을 허용하지 않으며 아래에서 빈 배열을 허용한 경우만 빈 값을 받는다.

| 필드 | 형식·의미 |
| --- | --- |
| kind / schema_version | `assignment` / `0.1.0` |
| source / task_ref | 할당 원본과 Task 원본의 `{uri, revision, observed_at}`. task_ref.revision은 Task.task_revision과 같아야 한다. URI를 조회하거나 revision을 content hash로 추정하지 않는다. |
| task_id / task_revision / run_id | Task와 동일한 식별자 |
| producer | 이번 제출자로 할당한 `{role, instance_id}` |
| attempt_id / ownership_epoch / base_ref | 현재 시도·할당 세대·slice 기준. epoch는 0–9007199254740991의 안전한 정수 |
| mode / candidate_ref | `write`이면 candidate_ref는 null(새 결과 미정), `read-only`이면 고정된 후보 ref 문자열 |
| state | 기존 실행 상태 9종; 결과 소비에 유효한 값은 `RUNNING`, `VERIFYING`뿐 |
| bindings | 비어 있지 않은 `{instance_id, agent_id}` 목록. instance와 실제 agent ID는 각각 유일; 같은 인스턴스의 여러 역할은 하나의 binding 공유 |
| candidate_writers / writer_history_ref | 현재 후보의 과거 writer 및 현재 candidate owner의 instance ID 집합(빈 배열 가능), 그 이력 원본 ref. source/config/acceptance/test/oracle writer를 포함 |
| integration_owner / consumers | 통합 책임 instance ID, 비어 있지 않은 다음 소비자 ID 집합. 두 항목과 모든 Task.roles·candidate_writers는 bindings에 있어야 함. 소비자는 이번 Task에서 아직 작업하지 않는 외부 역할일 수 있음 |
| analysis_scope / scratch_paths | 분석할 대상과 후보 밖 disposable 경로의 별도 집합(빈 배열 가능). candidate write ownership은 Task.ownership을 단일 기준으로 사용 |
| runtime_refs | `{ownership: ref, permissions: ref}`. 실제 대상·권한 관찰의 위치이며 내용의 진실성·충분성은 이 검사 범위 밖 |
| previous_attempt | 최초 할당은 null. 같은 run의 재할당은 `{attempt_id, ownership_epoch, stop_ref: ref}`; 이전 시도·세대·정지 증거 위치 |

bindings의 범위는 Task.roles, candidate_writers, integration_owner, consumers의 합집합과 정확히 같아야 한다. 과거 writer는 현재 Task.roles에서 사라져도 이력과 binding을 보존한다. agent ID는 실제 플랫폼 결과에서 얻고 역할명을 바꾸어 새 인스턴스인 척하지 않는다. 외부 소비자 ID도 해당 판정자/실행과 대응한 식별자여야 한다.

할당 원본은 조정자만 갱신하며 worker가 수정하지 못하도록 runtime에서 보호한다. source·task_ref·writer_history_ref·runtime_refs·stop_ref는 별도 제어 입력이며 Artifact.input_refs에 임의로 추가하지 않는다. 실행자가 실제로 읽을 요구·정책·의존 산출물은 미리 Task.input_refs에 선언한다. 실제 변화/분석 구분은 writer_history_ref의 관찰 원본을 따른다. Artifact.actual_scope의 문자열을 실제 write set으로 해석하지 않는다.

## 3. 수용 기준

| ID | 정상·경계·거부 계약 |
| --- | --- |
| AS-1 | 기존 validateContract(task, artifact)와 Assignment schema를 먼저 검사한다. 오류는 `/task`, `/artifact`, `/assignment` 경로로 구분하며 잘못된 입력에서 관계 검사로 진행하지 않는다. |
| AS-2 | task_id/task_revision/run_id/schema_version과 task_ref.revision을 Task에 연결한다. Artifact.producer/attempt_id/ownership_epoch/base_ref는 할당과 정확히 같아야 한다. 공백·대소문자·URI·경로 정규화는 하지 않는다. |
| AS-3 | 모든 Task.roles, candidate_writers, integration_owner, consumers의 instance에 정확히 하나의 binding이 있다. 같은 actual agent ID를 여러 instance로 등록하거나 누락·불필요 binding을 넣으면 거부한다. |
| AS-4 | 모든 현재 Task.ownership.owner가 candidate_writers에 있어야 한다. independent/external verifier는 candidate_writers에 있으면 거부한다. 과거 writer가 현재 소유권을 반환해도 독립 verifier로 쓸 수 없다. 숨긴 실제 이력 자체는 runtime에서 확인한다. |
| AS-5 | read-only producer는 candidate ownership이 없어야 하고 Artifact.candidate_ref가 고정 candidate_ref와 같아야 한다. write producer는 하나 이상의 candidate ownership이 있어야 한다. candidate_ref는 mode에 맞는 타입이어야 한다. ownership 없는 read-only에도 epoch 비교를 수행한다. |
| AS-6 | state가 RUNNING/VERIFYING 외이면 할당 재사용을 거부한다. previous_attempt가 있으면 현재 attempt ID는 달라야 하고 epoch가 증가해야 하며 stop_ref가 필요하다. 현재 epoch와 모든 producer ownership의 epoch가 같아야 한다. 실제 정지·예산 보존·최종 상태 새 run 여부는 소비자가 확인한다. |
| AS-7 | Artifact.consumers의 instance ID는 중복 없이 Assignment.consumers와 같은 집합이어야 한다. Artifact.actual_scope는 producer ownership.target과 analysis_scope의 합집합에 선언된 문자열만 허용한다. 분석 경로를 쓰기 권한으로 승격하지 않는다. scratch_paths가 path-kind candidate target 또는 analysis_scope와 정확히 겹치면 거부한다. 실제 포함·별칭·symlink 겹침은 runtime 범위다. |
| AS-8 | 함수는 입력을 바꾸지 않고 ref·명령·증거 위치를 조회/실행하지 않는다. 입력은 모호성 없이 파싱된 JSON 값이다. getters/Proxy/순환 객체를 격리하지 않는다. |
| AS-9 | CLI는 정확히 세 파일을 읽어 보고서 하나를 출력한다. 유효 연결 exit 0, JSON/schema/관계 오류 1, 인자/읽기 오류 2. 모든 파일의 읽기 오류가 JSON 오류보다 우선하며 값·원문·파일 경로를 오류에 노출하지 않는다. |
| AS-10 | CLI는 중복 JSON key(escape로 같은 key 포함), 안전 범위 밖 epoch, 소수·지수·부호를 쓴 epoch 원문을 거부한다. 다른 cwd/symlink 실행과 import 무실행을 지원한다. 기존 연결 CLI의 안전한 JSON 파싱을 공유하되 기존 API·종료 코드·테스트는 유지한다. |

`start_ref == base_ref`를 강제하지 않는다. write-mode의 candidate는 실제 결과를 관찰해 별도로 확인한다. 입력 정렬·시각 차이는 원본 관찰의 자연스러운 차이일 수 있으며, 같은 집합의 순서는 판정에 영향을 주지 않는다. 이 검사 통과는 producer의 주장/비용·원본 최신성·필수 gate 통과를 검증하지 않는다.

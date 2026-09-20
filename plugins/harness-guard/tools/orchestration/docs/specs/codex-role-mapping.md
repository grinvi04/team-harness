# Native 역할에 계약 연결하기

Team Harness의 native 실행 계약에 연결하는 역할·할당 기준이다. 별도 `ao-*` profile 파일을 설치하지 않는다. 아래 명칭은 기능이며 현재 호스트에서 제공되는 역할과 동일한 ID라는 뜻이 아니다. Codex wrapper는 Team Harness의 `codex/native-runtime.md`를 함께 적용한다. 원래 계약의 권한·독립성 조건을 변경하지 않으며, 요구 조건을 충족하지 못하면 해당 위임을 시작하지 않는다.

## 7. 기술 접근

### 7.1 역할 구성과 책임 연결

탐색·구현·독립 검증·보안 검토는 기능 이름이다. 실제 native 역할 ID와 기능을 현재 호스트에서 연결한다. 기존 built-in·Harness 역할을 덮어쓰거나 프로젝트별 `ao-*` profile을 복사하지 않는다. 조정자는 결과 단위의 주 세션에 남고 영구 역할 세션은 만들지 않는다.

저위험·단일 경계는 주 세션이 구현과 명시된 자기검사를 수행한다. 위임 필요성·독립 검증 trigger와 현재 호스트의 실행 계약이 허용할 때만 별도 인스턴스를 쓴다. model/effort·동시성·권한 적용값은 실제 실행 증거로 확인하며, 역할 이름이나 설정 파일만으로 집행을 추정하지 않는다.

| 역할 계약 해당 절 + Task.goal/non_goals | 실행자: 자신의 산출물 범위를 확인 |
| 입력·신선도 | Task.source/start_ref/input_refs + §7.3 할당 기준 | 실행자·소비자: 원본 revision을 시작 전·소비 직전 재조회 |
| 산출물·소비자 | Artifact 전체 + 역할별 출력 목록, 지정 소비자 명단 | 소비자: 등록·책임 범위·직접 증거 위치 확인 |
| 도구·권한·금지 | Task.authority + 역할 제한 + 실제 권한 관찰 | 조정자: 합집합이 아닌 모든 제한의 교집합 적용; §7.4 |
| 파일·결정·검증 owner | Task.ownership/roles/verification + 실제 변경 이력 | integration owner: 중복 writer·검증자 이해상충 확인 |
| 협업·인수인계 | Task.dependencies/topology + Artifact.consumers | 조정자: 의존 상태 확인, 역할 계약 §5 순서로 전달 |
| 객관적 완료 | Task.acceptance/verification + Artifact.claims/evidence/complete/verdict | 현재 후보의 판정자와 외부 gate; 역할 자체 PASS와 분리 |
| 실패·중단·재시도·상승 | Task.budgets/risk/reversibility/authority + 역할 계약 §2.5·아키텍처 §9–11 | 조정자: 원인·정지·잔여 예산·재개 조건 기록 |

한 Task.acceptance는 **해당 제출자의 slice** 기준이다. 전체 작업 기준과 slice acceptance의 대응은 조정자가 별도로 보존한다. verifier에게는 검증할 기준 전체와 writer 이력을 전달하며, 독립성 검사를 통과시키려고 기존 writer를 등록에서 지우지 않는다. 공개 개발 oracle과 sealed 평가 oracle은 분리하며 후자는 arm 실행자·내부 verifier에게 전달하지 않는다.

### 7.3 최신 할당과 인수인계

기존 [schema](../../schemas/envelopes.schema.json)와 [연결 검사기](../../scripts/validate-contract.mjs)에는 Task 쪽 최신 attempt·slice base·읽기 전용 할당 epoch가 없다. `actual_scope`도 변경/분석을 구분하지 않는다. **Task v0.1.0을 변경하지 않고 별도 [Assignment Context](assignment-context.md)와 [검사기](../../scripts/validate-assignment.mjs)**에서 선언된 할당 관계를 비교한다.

그 입력에는 Task 원본 revision/digest, task/run 식별자, 할당 producer와 실제 agent ID 대응, 현재 attempt·epoch·base, 읽기 전용 검증의 고정 candidate, 활성/중단 상태, integration owner·소비자, candidate 쓰기와 분석/scratch 범위의 구분, 실제 writer 이력·원본·권한·정지 증거 참조가 필요하다. writer의 새 candidate는 실제 변경에서 관찰하며 시작 전에 결과 SHA를 지어내지 않는다. epoch는 읽기 전용 할당에도 부여하고 producer가 소유한 candidate target이 있으면 그 target들의 epoch와 일치시킨다.

원본 요구·정책·의존 산출물은 해당 slice의 Task.input_refs에 선언한 뒤 Task ref를 고정한다. Assignment Context는 그 Task를 참조하는 별도 제어 입력이다. 이를 기존 Artifact에 미지원 필드로 끼워 넣거나 Task와 서로의 digest를 참조하는 순환 구조로 만들지 않는다. 할당 대조 증거는 소비자의 실행 기록에 별도로 남긴다.

최신 할당 원본의 writer는 조정자 한 명이다. 실행자는 그 원본을 수정할 수 없어야 한다. 자기 Artifact에서 비교 기준을 복사하거나 관찰 시각이 최근이라는 이유로 최신이라 판정하지 않는다. 두 입력이 같은 과거 값을 담은 반례는 순수 JSON 비교로 검출할 수 없으므로, 소비자는 제품 쪽 현재 할당과 원본을 다시 읽어야 한다. 원본의 보호·최신성 확인이 불가능하면 실행/소비를 차단한다. 별도 중앙 DB·scheduler는 도입하지 않는다.

1. **할당 전:** 조정자가 현재 Task·할당·의존 상태·권한·예산을 확인한다. 실제 경로 별칭·중첩 디렉터리·공유 자원의 owner를 비교하고 충돌하면 직렬화한다. 필수 입력/집행이 없으면 BLOCKED다.
2. **시작:** fresh context에 필요한 계약 절·Task·할당·원본 위치만 전달한다. 최초 메시지는 입력·실제 cwd/base·권한 확인만 맡기며 candidate 작업을 시작시키지 않는다. 조정자가 반환된 agent ID와 계약 instance ID를 연결하고 확인 결과를 검토한 뒤 실행을 전달한다. 이름 변경으로 이력을 초기화하지 않는다.
3. **제출·소비:** Artifact 형식/연결 검사 후 최신 할당의 attempt·epoch·base·producer와 실제 candidate/diff·원본·증거를 대조한다. 할당 변경과 소비는 같은 owner가 직렬 처리하고 판정 대상 할당 revision을 기록한다. 확인 도중 입력이 바뀌면 재검사하며 오래된 결과를 자동 통합하지 않는다.
4. **통합·판정:** integration owner가 새 통합 ref와 변경 이력을 제출한다. verifier가 그 ref에서 검사하고, 필수 acceptance·사람·Team Harness gate가 모두 현재 후보에 유효할 때만 ACCEPTED다. partial은 기존 FAIL을 보존하거나 INCONCLUSIVE로 남긴다.
5. **취소·재할당:** 새 dispatch와 기존 결과 수용을 먼저 막는다. 중단 요청만으로 정지라 보지 않으며 역할·자식 process·도구 작업의 정지와 외부 효과를 확인하기 전에는 BLOCKED다. 정지 후에만 새 attempt/epoch를 발급하며 예산을 초기화하지 않는다. 최종 상태 재실행은 새 run_id를 사용한다.

이는 **요구되는 절차**이지 실행 가능한 admission controller가 아니다. Assignment Context의 정확한 직렬화/API와 원본 증거 연결은 [할당 계약](assignment-context.md)을 따른다. 최초 준비 메시지는 완성된 실행 할당이 아니며 실제 agent ID를 지어내지 않는다. 완전한 Task·Assignment와 조정자의 명시적 실행 전달 전에는 candidate 작업을 시작하지 않는다. 결과 소비에는 세 입력의 `validateAssignment`를, Artifact 없는 시작 전 선언에는 `validateDispatch(task, assignment)`를 사용한다([사용 안내](../usage.md)). 둘 다 권한·진실성의 증명이나 실행 controller가 아니다.

### 7.4 권한·격리와 native 호출

- explorer/verifier/security의 read-only는 candidate 불변 계약이다. 테스트용 build/cache/report는 명시한 disposable 영역만 허용하고 후보·oracle·할당 원본과 분리한다. 후보 digest 전후 비교는 변조 탐지이지 쓰기 차단의 대체물이 아니다.
- worker의 workspace-write만으로 세부 ownership이 집행된다고 보지 않는다. 허용 경로 밖 쓰기, symlink/부모 경로, 다른 checkout·공유 Git metadata·외부 DB 접근을 실제 통제할 수 있어야 한다. 분리된 checkout은 권한 sandbox가 아니다.
- shell 외에도 연결된 MCP·브라우저·네트워크·외부 쓰기 도구를 목록화한다. Task.authority 문자열이나 skill 사용 여부는 도구 allowlist 집행이 아니다. 필수 금지 행동을 차단하지 못하면 역할 지침의 문구와 무관하게 실행을 차단한다. denial을 다른 에이전트/도구에 넘기지 않는다.
- 현재 호스트의 실제 도구 인자와 유효 권한을 확인한다. 역할 생성만으로 독립 cwd/worktree·권한 격리를 추정하지 않는다. 격리가 필요한 writer는 실제 경로 보호가 확인될 때까지 병렬 실행하지 않는다.
- 해당 호스트의 생성·전달·대기·중단 API를 사용한다. 메시지 전송과 유휴 실행 재개를 구분하고, 중단 요청 응답을 모든 하위 process 정지의 증거로 취급하지 않는다.


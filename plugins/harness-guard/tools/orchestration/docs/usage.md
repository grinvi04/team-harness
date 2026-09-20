# 개발 조정 사용 안내

사용자는 제품에서 “이 기능을 구현해 줘”라고 요청한다. 에이전트는 제품 지침과 현재 원본을 읽고 수용 기준·진행·검증·다음 행동을 관리한다. [조정 절차](coordination-workflow.md)가 기준이며, 단순 작업에 위임이나 JSON을 강제하지 않는다.

## 선택형 검사기 설치

기본 skill과 문서에는 추가 npm 설치가 필요 없다. 기계 검사가 필요할 때 Node.js 22 이상에서 검증한 Team Harness checkout의 `plugins/harness-guard/tools/orchestration` 디렉터리로 이동해 실행한다.

```sh
npm ci --ignore-scripts
npm test
npm run check
npm pack --ignore-scripts --pack-destination /absolute/path/to/product/tools/vendor
```

제품 루트에서 생성된 고정 버전 파일을 기존 개발 의존성에 추가한다. 기존 package.json·lockfile을 덮어쓰지 않는다.

```sh
npm install --save-dev --save-exact --ignore-scripts ./tools/vendor/team-harness-orchestration-0.69.0.tgz
npx --no-install ao-project start . add-feature '승인된 개발 요청'
```

`start`는 정확한 Git 루트 아래 `docs/orchestration/add-feature.md`를 DRAFT로 만든다. 기존 기록과 symlink 부모는 거부하며 요청을 fenced text로 보존한다. 현재 HEAD를 기록하지만 미커밋 후보 전체를 증명하지 않는다. 이는 신뢰된 로컬 저장소의 편의 도구이며 동시 적대적 경로 교체를 막는 sandbox가 아니다. 자동 승인·역할 설치·실행은 하지 않는다. 기존 이슈가 원본이면 새 파일을 만들지 않아도 된다.

## 검사 범위

아래 파일 경로는 제품이 준비한 실제 입력으로 바꾼다. 패키지의 `examples/`는 합성 자료다.

| 명령 | 입력 | 성공의 의미 |
| --- | --- | --- |
| `ao-envelope-check TASK.json ARTIFACT.json` | 하나 이상의 envelope | `schema-only`: JSON/schema 형식 |
| `ao-contract-check TASK.json ARTIFACT.json` | 작업과 결과 | `contract-only`: 선언 연결 |
| `ao-assignment-check TASK.json ASSIGNMENT.json ARTIFACT.json` | 현재 할당과 결과 | `assignment-only`: 선언된 할당과 소비 관계 |
| `ao-dispatch-check TASK.json ASSIGNMENT.json` | READY 시작 전 할당 | `dispatch-only`: 실행 전 선언; 실제 dispatch 없음 |

검사기 종료 코드는 유효 0, JSON/schema/관계 오류 1, 인자·읽기 오류 2다. 결과 verdict가 FAIL/INCONCLUSIVE여도 일관된 보고이면 검사 자체는 성공할 수 있다. 실제 최신성·권한·ID 진실성·증거 실행·인수는 검사하지 않는다.

JS API는 `team-harness-orchestration/envelope`, `/contract`, `/assignment`, `/dispatch`에서 기존 `validateEnvelope`, `validateContract`, `validateAssignment`, `validateDispatch`를 제공한다. schema version은 `0.1.0` 그대로다. 입력의 명령이나 URI를 실행하지 않는다.

## 이전 패키지에서 전환

1. 진행 중인 작업과 변경한 관리 파일을 먼저 확인한다. 기존 package.json·lockfile과 관리 파일의 Git 상태를 보존한다.
2. **기존 패키지가 설치된 상태에서** `npx --no-install ao-project remove .`를 실행한다. 이전 제거기가 manifest에 기록한 hash와 일치하는 skill stub·profile만 제거한다. 변경 파일이 있으면 자동 덮어쓰거나 삭제하지 않는다.
3. 기존 `agent-orchestration-contracts` 개발 의존성을 제거하고 검증된 새 tgz를 추가한다. 다른 의존성을 보존하고 lockfile을 함께 갱신한다.
4. 제품 AGENTS.md/README에서 Team Harness의 `ao-coordinate`와 새 패키지 문서를 가리킨다. 제품의 과거 인수·Task/Assignment/Artifact·실행 증거는 그대로 둔다.
5. 새 bin/API와 실제 제품의 기존 선언을 검사한다. 설치 확인을 새 native skill 로딩·권한 시험으로 보고하지 않는다.

새 `ao-project`에는 `init/status/remove`가 없다. Harness plugin·profile 설치와 제거는 기존 Team Harness 설치 도구가 소유한다. 전환을 철회할 때는 제품 Git에 보존한 이전 의존성·관리 파일을 복원하고 승인된 활성 실행 상태를 먼저 확인한다.

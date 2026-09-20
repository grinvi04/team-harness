# 역할 계약

> 역할 정의는 재사용할 설계 기준이다. 모든 역할의 자동 실행·배포가 구현됐다는 뜻은 아니다. 현재 적용 범위는 [제품 목표 대조](product-direction.md)를 따른다.

- 상태: 전체 검토·보완 후 v0.1 기준 문서
- 기준일: 2026-09-05
- 구현 상태: [Codex 로컬 매핑](specs/codex-role-mapping.md)·할당 검사 구현; native 역할 로딩·권한·배포 미검증
- 기준 문서: [아키텍처](architecture.md)의 Task Envelope, Artifact Envelope, 상태 전이, 소유권 규칙

## 1. 목적과 적용 범위

이 문서는 제품 개발에 필요한 전문 기능을 **직함이나 에이전트 수가 아니라 계약**으로 정의한다. 한 역할 인스턴스는 한 실행에서 여러 기능을 맡을 수 있고, 같은 기능을 여러 인스턴스가 나눠 맡을 수도 있다. 단, 동일 변경의 writer와 독립 verifier처럼 이해상충이 있는 기능은 같은 인스턴스에 배정하지 않는다.

역할 계약은 플랫폼 중립적이다. 플랫폼의 native 역할과 그 지침은 이 계약을 실행에 연결하는 수단이며, 플랫폼 설정이 계약의 권한·독립성·완료 의미를 약화하면 해당 매핑은 `INCONCLUSIVE` 또는 `BLOCKED`다.

이 문서가 다루는 기능은 다음과 같다.

- Product·기획·PM: 문제, 가치, 범위, 우선순위, 수용 기준
- Orchestration·PMO: 작업 계약, 의존성, 상태, 위험, 증거 추적
- UX/Design: 사용자 흐름, 상호작용, 시각·접근성 명세
- Architecture·PL: 기술 경계, 인터페이스, 작업 분해, 통합 순서
- Frontend·Backend·Platform: 지정된 경계의 구현과 단위 검증
- QA: 품질 계획, 테스트 설계, 품질 예방과 검출 체계
- Independent Verification·QC: 후보 산출물의 독립 적합성 판정
- Security: 위협·권한·데이터·공급망 위험 분석과 보안 판정
- Operations·Incident: 운영 준비, 관측·복구, 장애 지휘와 증거 보존

이 문서에서 PM은 제품 범위·가치 책임, PL은 architecture와 기술 통합 책임, PMO는 delivery·의존성·상태·증거 조정 책임을 가리킨다. 조직에서 같은 직함을 다르게 쓰더라도 이름을 맞추기보다 이 책임 묶음과 이해상충 규칙을 매핑한다. QA는 품질을 만들고 검출하는 체계·테스트 설계, QC는 현재 후보의 독립 적합성 판정을 뜻한다.

## 2. 공통 계약

### 2.1 역할과 인스턴스

- **역할 기능**은 책임과 이해상충의 단위다. 예: Product, FE Worker, Independent Verifier.
- **역할 인스턴스**는 특정 Task Envelope에서 그 기능을 수행하는 한 세션 또는 에이전트다.
- **writer**는 파일, 결정 또는 가변 외부 자원을 실제로 변경하는 유일한 인스턴스다.
- **reviewer**는 의견을 낼 수 있지만 승인 권한은 계약에 명시돼야 한다.
- **independent verifier**는 같은 후보 변경의 writer가 아니며 원본 요구사항, 실제 diff와 외부 oracle에 직접 접근한다.
- **integration owner**는 여러 writer의 결과를 현재 기준 ref에 합치는 단일 책임이다. 기본 후보는 Architecture/PL이지만 Task Envelope에서 다른 인스턴스를 지정할 수 있다.

### 2.2 모든 역할이 받는 최소 입력

각 역할의 task slice는 [아키텍처 §8.1](architecture.md#81-task-envelope-필수-필드)의 Task Envelope를 참조하고, 최소한 다음을 포함해야 한다.

| 입력 | 역할이 시작 전에 확인할 것 | 신선도 판정 |
| --- | --- | --- |
| 목표·비목표·수용 기준 | 자신의 산출물로 판정 가능한 항목과 범위 밖 항목 | 원본 issue/요구 문서의 revision 또는 관찰 시각 기록 |
| `start_ref`, slice의 `base_ref`, `input_refs` | 고정 출발점, 현재 할당 기준과 의존 원본 | 최초 checkout은 base_ref와 일치; 자기 변경과 외부 입력 drift를 구분 |
| 정책·승인 조건 | 제품 지침과 Team Harness gate | 현재 제품 ref에서 다시 읽은 문서/설정의 ref 기록 |
| 의존 산출물 | producer, artifact id, 기준 ref, 판정 | 소비 직전 producer ref와 현재 ref 비교 |
| 소유권 | 파일·결정·외부 자원의 writer와 integration owner | 겹치는 write set이 없거나 직렬화 순서가 명시됨 |
| 권한·금지 행동 | 허용 도구, 네트워크, 환경, 승인 경계 | 현재 플랫폼 권한 모드와 계약이 일치하는지 확인 |
| 예산·종료 조건 | 시간, 비용, 재시도, 수정 loop | 숫자 또는 사용자가 승인한 무제한 조건이 있음 |

필수 입력이 없을 때 역할은 결과를 추측해 채우지 않는다. 결과 의미를 바꾸지 않는 형식 누락만 `assumptions`에 기록해 보완할 수 있다. 범위, 보안, 데이터, 호환성, 운영 영향 또는 수용 기준을 바꾸는 누락은 Orchestrator에게 반환하고 상태를 `BLOCKED`로 둔다.

### 2.3 모든 역할이 반환하는 최소 출력

모든 결과는 [아키텍처 §8.2](architecture.md#82-artifact-envelope-필수-필드)의 Artifact Envelope를 만족한다. 특히 다음 소비자가 요약을 믿지 않고 재검사할 수 있어야 한다.

- 생산자 역할과 역할 인스턴스, schema/task revision, task/run/artifact/attempt ID, ownership epoch
- 실제로 읽은 원본과 version/ref, 관찰 시각
- 할당받은 소유 범위와 실제 변경·분석 범위
- 충족한다고 주장하는 acceptance id
- 변경 ref 또는 파일·결정·증거 위치
- 실행한 명령·관찰·환경과 원시 결과 위치
- `PASS`, `FAIL`, `INCONCLUSIVE` 자체 판정과 근거
- 미확인 항목, 잔여 위험, 가정, 예산 소비
- 다음 소비자와 소비 전에 확인할 조건

역할의 `PASS`는 그 역할 산출물의 자체 판정일 뿐 전체 작업의 `ACCEPTED`가 아니다. 전체 수용은 Integration Gate, 현재 후보 검증, 적용되는 사람·Team Harness gate를 필요로 한다. 독립 verifier의 의무 조건은 [아키텍처 §5](architecture.md#5-실행-형태-선택-규칙)를 단일 기준으로 따른다. partial은 `complete=false`이며 확인된 위반이 있으면 `FAIL`, 없으면 `INCONCLUSIVE`로 반환한다.

[로컬 연결 검사](specs/envelope-consistency.md)를 사용할 때는 Task.acceptance를 해당 제출자의 task slice에 맞춘다. 전체 역할 결과의 합성은 이 검사 범위가 아니다. v0.1.0의 `actual_scope`는 변경 또는 분석 범위이므로 그 문자열만으로 write set이나 독립성을 추정하지 않는다. 선언된 candidate ownership과 실제 변경 이력 검증을 구분한다.

[Assignment Context](specs/assignment-context.md)는 소비자가 제공한 현재 할당과 Artifact의 선언된 attempt·epoch·base·실행 ID·writer 이력 관계를 추가 비교한다. 실제 원본 최신성·이력의 진실성·권한 집행은 여전히 소비자의 runtime 확인 대상이다.

### 2.4 공통 권한 원칙

1. 허용 목록에 없는 쓰기, 외부 메시지, 배포, merge, release, secret 접근, 데이터 변경은 금지한다.
2. 권한 거부를 다른 역할, 다른 도구 또는 더 넓은 sandbox로 넘겨 우회하지 않는다.
3. read-only 역할이 수정안을 제안할 때는 patch 또는 finding으로 반환하며 직접 적용하지 않는다.
4. 실제 플랫폼 권한이 계약보다 넓어도 역할 계약의 금지 행동은 유지한다. 플랫폼 권한이 계약보다 좁으면 우회하지 않고 `BLOCKED`다.
5. 같은 파일·결정·가변 외부 자원에는 동시에 writer를 한 명만 둔다.
6. 비가역 운영 변경과 정책 예외는 정확한 대상, 영향, 복구 가능성을 제시하고 사람 승인을 기다린다.
7. read-only는 **판정 대상 후보를 변경하지 않는다는 계약**이다. 테스트에 필요한 build/cache/임시 test data·보고서는 사전 지정된 disposable 영역만 쓸 수 있다. 후보 source/config/oracle을 바꾸는 권한과 구분하며, 실행 전후 candidate digest와 runtime 제한을 확인한다. 필요한 격리를 만들 수 없으면 실행하지 않고 `INCONCLUSIVE`/`BLOCKED`로 반환한다.
8. 문서의 금지 지시나 사후 diff만으로 권한 집행을 대신하지 않는다. 필수 금지 행동을 실제 차단할 수 없는 adapter는 사용할 수 없다.

### 2.5 공통 중단과 에스컬레이션

모든 역할은 다음 상황에서 새 작업을 멈춘다. 산출물 판정은 `PASS/FAIL/INCONCLUSIVE`, 실행 상태는 [아키텍처 §9](architecture.md#9-작업과-산출물의-흐름)의 상태 전이로 별도 기록한다. 중단 신호만으로 실행 자원의 정지가 확인됐다고 추정하지 않는다.

- 기준 ref, 요구사항, 정책 또는 인터페이스가 산출물 의미를 바꿀 만큼 달라짐
- 다른 writer와 소유권이 겹치거나 가변 자원의 현재 상태를 확인할 수 없음
- 승인되지 않은 권한, secret, 운영 접근 또는 외부 조정이 필요함
- acceptance가 서로 충돌하거나 실행 가능한 판정 방법이 없음
- 재시도·시간·비용·수정 loop 한도를 소진함
- 오류를 재현할 수 없고 다음 실험을 구분할 새 가설이나 증거가 없음
- 사용자가 중단을 요청하거나 상위 작업이 `CANCELLED`/`SUPERSEDED`됨

## 3. 소유권과 독립성

### 3.1 기본 소유권 지도

| 대상 | 기본 결정 owner | 기본 writer | 판정·소비자 |
| --- | --- | --- | --- |
| 제품 문제, 목표, 범위, 우선순위 | Product | Product가 지정한 제품 문서 writer | 사람 Product owner, QA, Architecture/PL |
| 사용자 흐름·상호작용·디자인 명세 | UX/Design | 지정된 design asset/spec writer | Product, FE, QA |
| 기술 경계·API/schema·호환성·ADR | Architecture/PL | 지정된 architecture 문서 writer | FE/BE/Platform, Security, Integration Gate |
| 작업 topology·의존성·상태·증거 연결 | Orchestrator/PMO | Orchestrator/PMO | Product, 모든 역할, Team Harness 접점 |
| UI 애플리케이션 코드 | FE Worker | 할당된 FE Worker 한 명 | Integration owner, QA, verifier |
| 서버·도메인·데이터 코드 | BE Worker | 할당된 BE Worker 한 명 | Integration owner, QA, Security, verifier |
| CI·IaC·런타임 설정·운영 자동화 | Platform Worker | 할당된 Platform Worker 한 명 | Operations, Security, verifier, Team Harness |
| 테스트 전략·acceptance test·fixture | QA | 지정된 QA test writer | workers, verifier, Product |
| 보안 위협 모델·finding·보안 판정 | Security | Security analysis writer | Product, PL, workers, verifier |
| 운영 요구·runbook·SLO·복구 기준 | Operations | 지정된 operations 문서 writer | Platform, QA, verifier, Incident Lead |
| 통합 후보 ref | Architecture/PL 또는 명시된 integration owner | integration owner 한 명 | verifier, Team Harness |
| 최종 독립 판정 | Independent Verifier/QC | 격리된 검증·evidence 영역만 작성 | Orchestrator, 사람 승인자, Team Harness |

제품 저장소의 기존 CODEOWNERS, 제품 지침 또는 Team Harness 정책이 이 표보다 우선한다. 기본 owner가 구현 파일의 자동 승인자라는 뜻은 아니다.

### 3.2 결합할 수 있는 기능

아래 결합은 작업 위험과 크기에 따라 한 인스턴스가 맡을 수 있다.

- 저위험·저결합 작업의 Product + Orchestrator/PMO
- 한 경계 안의 Architecture/PL + 해당 구현 worker
- 작고 결합된 vertical slice의 FE + BE worker
- 사전 운영 요구 정리의 Platform + Operations
- 테스트 전략 수립의 QA + read-only Security 검토

결합 사실과 이유를 Task Envelope에 기록한다. 결합된 인스턴스가 writer가 되면 그 결과를 독립적으로 승인할 수 없다.

### 3.3 결합하면 안 되는 기능

- 동일 후보의 source·config·acceptance·테스트 변경 writer + 그 변경의 Independent Verifier/QC
- 보안 수정 writer + 그 수정의 최종 Security 판정자
- acceptance를 임의 변경한 Product 인스턴스 + 변경 사실을 숨긴 최종 verifier
- 충돌한 두 산출물의 writer 중 한 명 + 유일한 integration arbiter
- 운영 변경 실행자 + 복구 성공을 자기 관찰만으로 확정하는 verifier
- 평가 arm 실행자 + hidden oracle 또는 정답 fixture writer

한 사람이 여러 기능을 수행해야 하는 개인 개발 환경에서도 **역할 인스턴스와 증거 시점**을 분리한다. 새 context에서 원본과 외부 oracle을 다시 읽고 검증하더라도 동일 모델·공급자·명세에서 오는 상관 오류는 잔여 위험으로 기록한다. 고위험 작업은 사람 또는 다른 독립 판정자를 추가한다.

## 4. 역할별 계약

### 4.1 Product / Planning / PM

**목적**

- 해결할 사용자·사업 문제, 기대 결과, 범위와 우선순위를 명확히 한다.
- 기능·비기능 acceptance를 관찰 가능하게 만들고 제품 trade-off를 결정한다.
- 발견된 위험이나 비용이 제품 가치에 미치는 영향을 판단한다.

**비목표**

- 기술 구조, 구현 방식, 테스트 결과 또는 보안 위험을 근거 없이 대신 판정하지 않는다.
- 일정 압박을 이유로 Team Harness gate, verifier 또는 사람 승인을 생략하지 않는다.
- 제품별 backlog와 결정을 이 프로젝트나 에이전트 memory에 중앙 복제하지 않는다.

**필수 입력과 신선도**

- 현재 제품 issue/PRD, 사용자 근거, 제약, 성공 지표, 제품 정책을 원본에서 읽는다.
- 기존 결정과 충돌 여부를 제품 repo/GitHub의 최신 revision에서 확인한다.
- 법무·비즈니스·데이터 보존처럼 에이전트가 판단할 수 없는 owner를 식별한다.

**출력과 소비자**

- `product_brief`: problem, target user, outcome, scope/non-goals, priority, acceptance id, open risk. UX, Architecture/PL, QA가 소비한다.
- `product_decision`: 선택지, 판단 기준, 선택, 거부한 대안, 승인자와 원본 위치. Orchestrator와 모든 영향 역할이 소비한다.
- acceptance 변경 시 변경 전후 id와 영향받은 산출물을 명시한 supersession 기록. Orchestrator가 재계산한다.

**권한·금지 행동**

- 제품 범위와 우선순위 제안·결정 권한만 갖는다. 실제 승인자는 제품 Task Envelope에 명시한다.
- 코드, 배포, 운영 데이터, 정책 gate를 직접 변경하지 않는다.
- 기술·보안·운영 owner의 `FAIL`을 문구 변경으로 없애지 않는다. 위험 수용은 사람 승인과 근거를 남긴다.

**소유권·협업**

- 제품 의미와 acceptance 문구를 소유한다. 기술 구현 파일은 소유하지 않는다.
- UX와 사용자 경험, PL과 구현 가능성, QA와 판정 가능성, Security/Operations와 위험·복구 조건을 합의한다.

**완료 조건**

- 모든 범위 항목에 제품 근거와 acceptance id가 있고, 각 acceptance에 명령·관찰 또는 판정자가 있다.
- 비목표, 미결정 owner, 위험 수용 주체가 명시돼 다음 역할이 추측하지 않아도 된다.

**실패·중단·에스컬레이션**

- 사용자 근거가 상충하거나 성공 기준을 판정할 수 없으면 `BLOCKED`로 사람 Product owner에게 올린다.
- 기술·보안·운영 제약이 목표를 바꾸면 기존 brief를 몰래 수정하지 않고 새 revision으로 supersede한다.

### 4.2 Orchestrator / Delivery Coordination / PMO

**목적**

- 원본 요청을 완전한 Task Envelope로 정규화하고 가장 단순한 충분한 실행 형태를 고른다.
- 의존성, owner, 예산, 상태, 위험, 인수인계와 증거 추적을 유지한다.
- 부분 결과를 통합 후보로 모으되 전문 판단과 외부 gate를 대신하지 않는다.

**비목표**

- 모든 작업을 멀티에이전트로 나누거나 모든 산출물을 직접 작성하지 않는다.
- Product 우선순위, PL 기술 결정, QA/QC 판정, Security 위험 수용을 대신하지 않는다.
- 제품 backlog나 장기 실행 상태의 별도 원본 시스템을 만들지 않는다.

**필수 입력과 신선도**

- 현재 제품 요청, `start_ref`, 제품 지침, Team Harness 정책, 역할 계약, 예산을 실행 직전에 확인한다.
- 이전 세션 요약은 탐색 힌트로만 사용하고 결정 입력은 원본 ref에서 재확인한다.

**출력과 소비자**

- 완전한 Task Envelope, topology 선택 근거, 역할·owner map, dependency graph, gate 순서. 모든 역할이 소비한다.
- 상태 전이와 사유, artifact/acceptance trace, 예산 사용, escalation packet. Product, 사람 승인자, Team Harness 접점이 소비한다.
- 통합 후보와 누락·충돌 목록. Integration owner와 verifier가 소비한다.

**권한·금지 행동**

- task slice 할당, read-only 병렬화, 승인된 writer 순서 조정, 한도 내 재시도를 수행한다.
- 권한을 확장하거나, 거부된 행동을 다른 역할에 재지정하거나, merge/release/운영 변경을 자동 승인하지 않는다.
- 동일 파일 writer가 겹치는 상태로 병렬 실행하지 않는다.

**소유권·협업**

- topology, dependency, task status, evidence link의 일관성을 소유한다.
- 전문 산출물의 내용 owner가 아니며, 충돌은 해당 Product/PL/QA/Security/Operations owner에게 보낸다.

**완료 조건**

- 모든 필수 acceptance가 현재 후보의 검증 evidence에 연결되고, 독립 검증 trigger를 충족하며 현재 정책 ref가 기록돼 있다.
- 최종 상태 또는 재개 조건을 가진 `BLOCKED`가 증거와 맞게 정리된다. 재할당 전에 이전 writer 정지와 ownership epoch를 확인한다.

**실패·중단·에스컬레이션**

- owner 충돌, 예산 소진, 반복 실패, stale ref, permission denial을 숨기지 않고 정확한 대상·영향·선택지를 담아 사람에게 올린다.
- worker 실패 후 다른 worker로 재할당할 때 기존 부분 결과와 소유권을 먼저 무효화하거나 직렬화한다.

### 4.3 UX / Design

**목적**

- 제품 목표를 사용자 여정, 정보 구조, 상호작용, 상태, 시각 규칙과 접근성 요구로 변환한다.
- happy path뿐 아니라 empty, loading, error, permission denied, recovery 상태를 정의한다.

**비목표**

- 사용자 근거 없이 제품 범위를 확장하거나 시각 선호를 제품 성공으로 대체하지 않는다.
- 지정되지 않은 FE 코드를 직접 변경하거나 자신의 디자인을 독립적으로 품질 승인하지 않는다.

**필수 입력과 신선도**

- 현재 product brief와 acceptance revision, 기존 디자인 시스템·콘텐츠 정책·지원 플랫폼, 사용자 근거를 확인한다.
- 기존 UI를 변경한다면 실행 중 화면과 현재 design/code ref를 함께 기록한다.

**출력과 소비자**

- user flow, screen/state inventory, interaction rules, content, responsive behavior, accessibility acceptance. FE와 QA가 소비한다.
- 디자인 결정과 대안, source asset/spec ref, 알려진 불확실성. Product와 PL이 소비한다.
- 구현 검토 finding은 위치·상태·expected/actual과 severity로 반환한다. FE와 verifier가 소비한다.

**권한·금지 행동**

- 할당된 디자인 문서·asset만 쓴다. production UI 코드와 외부 디자인 시스템 변경은 별도 writer 권한이 필요하다.
- 접근성·사용성 실패를 단순 미관 차이로 낮추지 않는다.

**소유권·협업**

- 사용자 흐름과 디자인 명세 결정을 소유한다. Product는 제품 범위, PL은 기술 제약, FE는 구현 파일, QA/verifier는 검증 판정을 소유한다.

**완료 조건**

- 모든 사용자 상태와 acceptance가 화면/행동/콘텐츠 규칙에 연결되고 FE가 추측해야 할 핵심 상태가 없다.
- 접근성 요구가 키보드, focus, 이름·역할·값, 대비, 확대·reflow 등 관찰 가능한 조건으로 표현된다.

**실패·중단·에스컬레이션**

- 제품 목표와 접근성 또는 플랫폼 제약이 충돌하면 Product/PL에게 선택지를 올린다.
- source 화면·디자인 시스템이 stale하거나 접근할 수 없으면 `INCONCLUSIVE`로 반환한다.

### 4.4 Architecture / Technical Lead (PL)

**목적**

- 제품 요구를 경계, 인터페이스, 데이터 흐름, 호환성, 마이그레이션·복구 조건으로 변환한다.
- 작업을 검증 가능한 slice로 분해하고 writer ownership과 통합 순서를 고정한다.

**비목표**

- 불필요한 추상화, 범용 플랫폼 또는 미래 요구를 선제 구현하지 않는다.
- Product 우선순위, Security 위험 수용, verifier의 최종 품질 판정을 대신하지 않는다.

**필수 입력과 신선도**

- product/UX acceptance, 현재 code·schema·dependency ref, 제품 ADR, 운영·보안 제약, Team Harness gate를 확인한다.
- 호출부와 소비자를 따라 인터페이스 변경의 전체 영향 범위를 현재 ref에서 다시 계산한다.

**출력과 소비자**

- architecture decision/ADR, component boundary, API/schema contract, compatibility·migration policy. FE/BE/Platform/Security/QA가 소비한다.
- dependency graph, writer map, integration order, rollback boundary. Orchestrator와 integration owner가 소비한다.
- integration report: applied artifact ids, resulting ref, conflicts, discarded/superseded work. verifier가 소비한다.

**권한·금지 행동**

- 기술 결정과 지정된 architecture 문서를 쓸 수 있다. production code 쓰기는 별도 worker 역할을 명시할 때만 가능하다.
- 같은 파일의 동시 writer를 허용하거나 검증되지 않은 interface 변경을 integration하지 않는다.
- 구현자가 된 경우 그 후보의 독립 verifier가 될 수 없다.

**소유권·협업**

- 공유 인터페이스, 기술 경계, compatibility, integration plan을 소유한다.
- Product와 범위 trade-off, UX와 사용자 상태, Security와 trust boundary, Operations와 deploy/rollback 계약을 합의한다.

**완료 조건**

- 모든 consumer가 동일한 versioned interface를 입력으로 받고, 각 write set과 선후 관계가 겹치지 않는다.
- 실패·부분 배포·migration·rollback 경로가 실행 또는 지정된 판정자로 검증 가능하다.

**실패·중단·에스컬레이션**

- 상충 ADR, 호환 불가능 요구, 데이터 손실 가능성, 복구 불가 변경은 사람 기술 owner에게 올린다.
- 현재 ref와 worker start ref가 달라 의미가 바뀌면 해당 artifact를 `SUPERSEDED` 처리하고 재계산한다.

### 4.5 Frontend Implementation Worker

**목적**

- 할당된 UI 경계에서 디자인·API 계약을 충족하는 최소 변경과 관련 테스트를 구현한다.
- 브라우저 상태, 오류 처리, 접근성, 성능 예산의 직접 증거를 남긴다.

**비목표**

- 승인 없이 API/schema, 디자인 시스템, 제품 범위 또는 인접 backend를 바꾸지 않는다.
- unrelated refactor나 전역 포맷 변경으로 write set을 넓히지 않는다.

**필수 입력과 신선도**

- versioned UX states, API contract, source/test start ref, 지원 browser/device, acceptance와 파일 ownership을 확인한다.
- 실행 직전 API/schema ref가 변하지 않았는지 확인한다.

**출력과 소비자**

- 지정 경로의 UI code/test 변경 ref, acceptance-to-test mapping, build·lint·component/E2E 결과. integration owner와 QA/verifier가 소비한다.
- UI 상태별 관찰 증거와 미검증 환경. UX와 verifier가 소비한다.

**권한·금지 행동**

- 할당된 FE source/test 경로만 쓴다. backend, CI, production deploy, secret에는 별도 권한 없이 접근하지 않는다.
- contract mismatch를 임시 hard-code나 mock의 영구 반영으로 숨기지 않는다.

**소유권·협업**

- 할당된 FE 파일의 writer다. interface 의미는 PL, 디자인 의미는 UX, test strategy는 QA가 소유한다.

**완료 조건**

- 할당 acceptance의 정상·오류·권한·경계 상태가 관련 테스트 또는 재현 가능한 관찰로 증명된다.
- 실제 변경 범위 밖 실패와 접근하지 못한 browser/device가 Artifact Envelope에 남아 있다.

**실패·중단·에스컬레이션**

- API/design 충돌, flaky 환경, 소유권 밖 수정 필요, 접근성 요구 불명확 시 각각 PL/UX/QA로 올린다.
- verifier `FAIL`은 재현 후 새 가설이 있는 수정 loop에서만 고친다.

### 4.6 Backend Implementation Worker

**목적**

- 할당된 서비스·도메인·데이터 경계에서 API/schema와 기능·비기능 acceptance를 구현한다.
- 실패 원자성, idempotency, authz, migration·rollback 동작의 증거를 남긴다.

**비목표**

- 승인 없이 외부 API 계약, 데이터 보존 정책, production schema 또는 인접 서비스 범위를 변경하지 않는다.
- 테스트 통과를 위해 보안·검증·관측 기능을 약화하지 않는다.

**필수 입력과 신선도**

- versioned API/data contract, 호출자 목록, authn/authz 요구, migration·rollback 조건, start ref와 test environment를 확인한다.
- schema·dependency·policy가 dispatch 이후 바뀌지 않았는지 실행 전과 handoff 전에 확인한다.

**출력과 소비자**

- 지정 경로의 server/data code와 test 변경 ref, API/schema diff, migration·rollback evidence, 성능·오류 관찰. integration owner, FE, QA, Security, Operations가 소비한다.

**권한·금지 행동**

- 할당된 BE source/test와 승인된 local test database만 변경한다.
- production 데이터, secret, 외부 계정, 배포에는 명시적 별도 권한 없이는 접근하지 않는다.
- 실패한 migration을 성공으로 표시하거나 destructive fallback을 자동 실행하지 않는다.

**소유권·협업**

- 할당된 BE 파일과 migration implementation의 writer다. schema 의미·호환성은 PL, 보안 판정은 Security, 운영 수용은 Operations가 소유한다.

**완료 조건**

- contract/negative/authz/concurrency 또는 데이터 무결성 중 해당 위험 테스트가 현재 후보 ref에서 통과한다.
- migration 전후와 rollback 가능성이 실제 명령 또는 승인된 판정자로 확인된다.

**실패·중단·에스컬레이션**

- 데이터 손실 가능성, 비호환 consumer, 권한 모델 불명확, rollback 불가 시 PL·Security·Operations와 사람 승인자에게 올린다.

### 4.7 Platform Implementation Worker

**목적**

- 할당된 CI, IaC, runtime 설정, observability, deployment·rollback automation을 재현 가능하게 구현한다.
- 환경 차이와 권한 경계를 코드·설정·검증 증거로 드러낸다.

**비목표**

- 명시적 권한 없이 production을 변경하거나 Team Harness 정책을 복제·우회하지 않는다.
- 장기 실행 서버, scheduler, 메시지 버스, 대시보드를 기능 공백 증거 없이 추가하지 않는다.

**필수 입력과 신선도**

- PL interface/dependency, Operations SLO·runbook 요구, Security control, Team Harness 정책 ref, 대상 환경과 rollback 조건을 확인한다.
- 실제 적용 대상, workspace/account/region, dry-run 결과가 Task Envelope와 일치하는지 확인한다.

**출력과 소비자**

- 지정 경로의 config/IaC/CI 변경 ref, plan/dry-run, environment assumptions, rollback 절차와 관측 쿼리. Operations, Security, verifier, Team Harness가 소비한다.

**권한·금지 행동**

- local/ephemeral 환경과 승인된 경로에만 쓴다. apply/deploy/rotate/delete는 별도 명시 권한과 사람 gate가 필요하다.
- secret 값을 산출물·로그·채팅에 기록하지 않는다.

**소유권·협업**

- platform implementation 파일의 writer다. 정책은 Team Harness, 운영 결과 기준은 Operations, security control은 Security가 소유한다.

**완료 조건**

- clean/ephemeral 환경에서 plan 또는 검증 명령이 재현되고, rollback·관측·권한 거부 경로가 판정 가능하다.
- production apply를 하지 않았다면 명확히 `미실행`으로 표시한다.

**실패·중단·에스컬레이션**

- 대상 환경 불명확, drift, secret 필요, destructive change, rollback 부재, 정책 충돌 시 실행하지 않고 사람·Operations·Security에 올린다.

### 4.8 QA / Quality Assurance and Test Design

**목적**

- 요구사항이 검증 가능하도록 quality plan과 oracle을 설계하고 결함을 예방한다.
- 기능·회귀·접근성·호환성·복구 위험에 맞는 테스트와 fixture를 독립적으로 준비한다.

**비목표**

- 테스트 개수나 coverage 수치만으로 제품 품질을 선언하지 않는다.
- production code를 고쳐 테스트를 통과시키거나 자신의 test harness 결함을 제품 결함으로 단정하지 않는다.
- Product acceptance나 Security/Operations 위험 수용을 대신하지 않는다.

**필수 입력과 신선도**

- product/UX/architecture acceptance revision, 위험 분석, supported matrix, 기존 defect와 test baseline을 현재 ref에서 확인한다.
- oracle이 구현 세부에 과적합되지 않았는지, 새 요구를 가리는 snapshot/golden이 없는지 점검한다.

**출력과 소비자**

- quality plan, acceptance-to-test matrix, negative/boundary/recovery cases, fixture와 실행 절차. workers와 verifier가 소비한다.
- test harness 자체 검증 결과와 알려진 blind spot. PL, verifier, Product가 소비한다.
- 실행 finding은 actual/expected, 재현, 환경, severity, acceptance id로 반환한다.

**권한·금지 행동**

- 할당된 test/fixture 경로를 쓸 수 있다. 자신이 만든 테스트·oracle의 유효성을 독립 승인하지 않는다. 판정 대상 후보의 source/config/tests를 수정한 인스턴스는 그 후보의 독립 verifier가 될 수 없다. 후보 밖에 만든 별도 검증 도구도 negative control로 검사한다.
- hidden oracle은 arm 실행자와 분리하고 평가 전에 노출하지 않는다.

공개 개발 테스트와 sealed 평가 oracle은 별도 산출물이다. workers·arm 내부 verifier는 공개 plan/fixture만 받는다. hidden bundle과 정답은 제출 후 외부 evaluator만 소비하며, scored run 안의 수정 feedback으로 돌려주지 않는다.

**소유권·협업**

- 품질 전략, test design, fixture validity를 소유한다. 최종 QC 판정은 Independent Verifier가 맡는다.
- UX·Security·Operations의 전문 acceptance를 테스트 가능한 관찰로 변환하되 의미를 바꾸지 않는다.

**완료 조건**

- 모든 중요 acceptance와 위험 trigger가 최소 하나의 독립 판정 방법에 연결된다.
- expected failure를 검출하는 mutation/negative control 또는 동등한 harness 반증이 있다.

**실패·중단·에스컬레이션**

- oracle이 없거나 서로 충돌하면 `INCONCLUSIVE`로 Product/PL에게 반환한다.
- 환경 불안정과 제품 결함을 구분할 수 없으면 증거를 분리하고 반복 한도 뒤 중단한다.

### 4.9 Independent Verifier / QC

**목적**

- 현재 통합 후보가 acceptance, 역할 계약, 소유권, 외부 oracle과 Team Harness 입력 조건에 맞는지 반례 중심으로 판정한다.
- `PASS`, `FAIL`, `INCONCLUSIVE`를 직접 증거와 함께 반환한다.

**비목표**

- 후보를 고쳐 `PASS`로 만들거나 구현자의 설명을 증거로 대체하지 않는다.
- 사람 승인, Security 위험 수용, merge/release 권한을 대신하지 않는다.
- 중요 실패를 평균 점수로 상쇄하지 않는다.

**필수 입력과 신선도**

- 원본 requirement/acceptance, 현재 candidate ref와 실제 diff, integration report, 독립 test environment, QA oracle, 적용되는 Security·Operations acceptance와 evidence를 직접 읽는다.
- candidate ref와 검증 checkout이 일치하고 test data가 오염되지 않았는지 확인한다.

**출력과 소비자**

- acceptance별 판정, 명령·관찰·환경·시각, finding severity, 재현 절차, evidence location. Orchestrator, writer, 사람 승인자, Team Harness가 소비한다.
- 독립성 제한, 실행하지 못한 항목, test harness 의심, 잔여 위험을 별도로 기록한다.

**권한·금지 행동**

- 후보는 read-only이며 §2.4의 격리된 검증·evidence 영역만 쓴다. 후보 source/config/data와 판정 대상 tests를 변경하지 않는다.
- 수정이 필요하면 `FAIL` finding을 원래 writer에게 반환한다. 직접 수정한 순간 verifier 자격을 잃고 새 verifier가 필요하다.

**소유권·협업**

- 현재 ref에 대한 QC 판정과 evidence sufficiency를 소유한다. requirement 의미, 구현, 보안 위험 수용은 소유하지 않는다.

**완료 조건**

- 모든 필수 acceptance가 현재 ref에서 `PASS`이거나, 하나라도 `FAIL`/`INCONCLUSIVE`이면 전체를 그보다 좋게 표시하지 않는다.
- 권한 초과, stale input, 누락 테스트, 오류 전달, 중복 write의 반례를 위험에 비례해 시도한다.

**실패·중단·에스컬레이션**

- 환경·oracle·권한이 부족하면 `PASS` 대신 `INCONCLUSIVE`다.
- writer와 결론이 충돌하면 재현 증거를 Orchestrator에 보내고, 제품 trade-off는 Product/사람, 기술 oracle 충돌은 PL/QA에 올린다.

### 4.10 Security

**목적**

- trust boundary, authn/authz, secret, 데이터, 입력, dependency·supply chain, abuse와 운영 권한 위험을 분석한다.
- 중요한 보안 acceptance와 검증 증거, 잔여 위험, 사람 위험 수용 조건을 제공한다.

**비목표**

- 범용 스타일 리뷰를 보안 finding으로 부풀리거나 근거 없는 취약점을 확정하지 않는다.
- 승인 없이 공격적 테스트, 외부 시스템 접근, secret 조회, production 변경을 하지 않는다.
- 자신이 구현한 보안 수정의 최종 판정자가 되지 않는다.

**필수 입력과 신선도**

- 현재 architecture/data flow, asset·actor·trust boundary, threat model, 실제 diff와 dependency lock, 제품 정책을 확인한다.
- 공개 advisory나 플랫폼 동작은 현재 공식 원문과 적용 버전을 대조한다.

**출력과 소비자**

- threat model, security acceptance, finding(severity, exploit precondition, affected asset, evidence, remediation boundary), residual risk. PL, workers, Product, Operations, verifier가 소비한다.
- `PASS/FAIL/INCONCLUSIVE` 보안 판정과 위험 수용이 필요한 정확한 주체.

**권한·금지 행동**

- 기본은 read-only 분석·승인된 안전한 scanner다. exploit, credential use, 외부 전송, destructive test는 명시 권한 없이는 금지한다.
- fix를 작성하면 worker로 재분류하고 별도 Security verifier에게 handoff한다.

**소유권·협업**

- 보안 모델, finding 정확성, security evidence를 소유한다. Product/사람은 위험 수용, PL은 기술 경계, worker는 fix를 소유한다.

**완료 조건**

- 중요 asset과 trust boundary마다 위협·control·검증·잔여 위험이 연결된다.
- authz bypass, 최소 권한, secret 노출, untrusted input, dependency 변경 중 적용되는 negative case가 현재 ref에서 판정됐다.

**실패·중단·에스컬레이션**

- 실제 exploit 가능성을 안전하게 확인할 수 없으면 `INCONCLUSIVE`로 표시한다.
- credential 또는 production 접근이 필요하면 정확한 대상과 안전한 대안을 제시하고 사람 승인을 기다린다.

### 4.11 Operations / Incident Response

이 계약은 평시 **Operations Readiness**와 장애 시 **Incident Lead/Operator** 모드를 구분한다. 지휘와 실행은 합칠 수 있지만, 운영 변경 실행자와 복구 성공 판정자는 분리한다. 판정자가 없으면 복구 조치 기록은 남기되 독립 수용 완료를 선언하지 않는다.

**목적**

- 평시에는 SLO/SLI, telemetry, alert, runbook, deploy·rollback, backup·restore와 on-call 조건을 검증 가능하게 만든다.
- 장애 시에는 영향 억제, 사실 기반 상태 공유, 안전한 복구, 시간순 증거와 후속 조치를 관리한다.

**비목표**

- 명시 권한 없이 production에 접속하거나 고객·대외 메시지를 발송하지 않는다.
- 원인 미확정 상태에서 추측을 사실로 발표하거나 postmortem을 개인 책임 추궁에 사용하지 않는다.
- 복구 속도를 이유로 권한·데이터 안전·감사 기록을 우회하지 않는다.

**필수 입력과 신선도**

- 평시: architecture, SLO, deploy topology, data criticality, current runbook, Team Harness release/incident policy를 확인한다.
- 장애 시: incident scope, 현재 시각, environment, change/event timeline, live telemetry source, authorized action matrix와 rollback point를 매 행동 전에 갱신한다.

**출력과 소비자**

- readiness checklist, SLI query, alert expectation, runbook, deploy/rollback/restore evidence. Platform, QA, Security, verifier가 소비한다.
- incident timeline, impact, hypotheses와 confidence, actions/owners, before/after signals, current state, next update, recovery evidence. 사람 Incident Commander, Product, Platform, Security가 소비한다.
- 복구 후 follow-up은 제품 repo/GitHub의 owner와 acceptance를 가진 항목으로 남긴다.

**권한·금지 행동**

- read-only telemetry와 승인된 diagnostic을 기본으로 한다.
- pre-authorized runbook 안의 가역 조치만 자동 실행할 수 있다. deploy, rollback, failover, data repair, credential rotation, delete는 Task Envelope의 정확한 범위와 사람/정책 gate가 필요하다.
- 권한이 없으면 다른 역할을 시켜 우회하지 않는다.

**소유권·협업**

- Operations는 운영 acceptance와 runbook 의미, Incident Lead는 timeline·우선순위·조정, 지정 Operator는 개별 변경 실행을 소유한다.
- Platform은 automation implementation, Security는 보안 영향, Product는 사용자·사업 trade-off, verifier는 복구 판정을 소유한다.

**완료 조건**

- 평시는 SLO 관찰, alert, rollback 또는 restore를 non-production이나 승인된 방식으로 재현하고 blind spot을 기록했을 때 완료다.
- 장애는 영향이 안정화되고 지정된 recovery signal이 관찰되며, 임시 완화와 근본 수정이 구분되고, 후속 owner가 제품 원본에 기록됐을 때 종료 후보가 된다.
- 원인 분석 완료와 서비스 복구 완료는 별도 상태다.

**실패·중단·에스컬레이션**

- 관측이 상충하거나 blast radius가 불명확하면 쓰기보다 진단을 우선하고 사람 Incident Commander에게 올린다.
- 복구 조치가 실패하거나 데이터 손실 위험이 커지면 자동 loop를 중단하고 마지막 안전 지점·시도·현재 영향·필요 권한을 보고한다.

## 5. 역할 간 인수인계

| Producer | 필수 handoff | Consumer가 수락하기 전 확인 | 기본 Consumer |
| --- | --- | --- | --- |
| Product | versioned product brief와 acceptance ids | 판정 가능성, 비목표, 결정 owner | UX, PL, QA |
| UX/Design | 상태별 flow/spec와 accessibility acceptance | product revision, 누락 상태, source asset ref | FE, QA |
| Architecture/PL | versioned interface, dependency, owner map | consumer·호환성·rollback, write set 중복 | FE, BE, Platform, Security |
| Orchestrator/PMO | Task Envelope와 topology 근거 | 필수 필드, 권한, budget, gate | 모든 역할 |
| FE/BE/Platform Worker | 변경 ref, diff 범위, test evidence | start/current ref, ownership, interface version | integration owner |
| QA | 공개 test matrix/fixture와 harness 검증 | acceptance coverage, negative control; hidden bundle은 별도 격리 | workers, verifier; sealed bundle은 외부 evaluator만 |
| Security | threat model/finding/security 판정 | 현재 diff·dependency, severity 근거 | workers, Product, verifier |
| Operations | SLO/runbook/rollback·recovery evidence | 대상 환경, observation source, authority | Platform, verifier, Incident Lead |
| Integration owner | current candidate ref와 integration report | artifact ids, conflict, discarded work, current policy | verifier |
| Independent Verifier/QC | acceptance별 판정과 직접 증거 | 독립성, current ref, 미실행 항목 | Orchestrator, 사람, Team Harness |

Consumer는 필수 필드가 없거나 ref가 낡은 산출물을 조용히 보완해 사용하지 않는다. 의미가 변하지 않는 보완은 새 artifact revision으로 남기고, 의미가 변하면 producer에게 돌려보낸다.

## 6. PM·PL·PMO·QA·QC 기능 추적표

| 조직 기능 | 이 설계의 책임 역할 | 책임지는 결정·활동 | 직접 증거 | 맡지 않는 것 |
| --- | --- | --- | --- | --- |
| 기획 | Product, UX/Design | 문제·사용자·범위·사용 흐름·acceptance | product brief, user flow, decision record | 기술 구현·최종 검증 |
| PM | Product | 제품 우선순위, 범위 trade-off, acceptance owner | versioned product decision | 일정·의존성 원장의 단독 관리, 기술 승인 |
| PMO / delivery | Orchestrator/PMO | Task Envelope, 의존성, 상태, risk/escalation, evidence trace | owner map, state transition, trace matrix | 제품 우선순위·품질 판정 |
| PL / technical lead | Architecture/PL | 기술 경계, interface, 작업 분해, integration·rollback plan | ADR, versioned contract, integration report | 제품 가치·독립 QC 승인 |
| QA | QA | 예방 중심 quality plan, test design, fixture·oracle 품질 | test matrix, negative control, harness evidence | production fix, 최종 제품 수용 |
| QC | Independent Verifier/QC | 현재 후보의 독립 적합성 검사와 판정 | ref별 PASS/FAIL/INCONCLUSIVE report | 후보 수정, 사람·보안 위험 수용 대체 |
| 개발 | FE/BE/Platform Workers | 할당 경계의 최소 구현과 단위 검증 | diff, build/test/migration/plan evidence | 인접 범위 확장·자기 독립 승인 |
| 보안 | Security | 위협 모델, security acceptance, finding·잔여 위험 | threat-control-test trace | 비즈니스 위험 수용·무권한 공격 |
| 운영 | Operations/Incident | 운영 준비, SLO·관측·복구, 장애 조정 | runbook, telemetry, incident timeline | 무권한 production 변경·정책 우회 |

이 추적표는 한 직함마다 별도 에이전트를 만들라는 배치표가 아니다. Task Envelope는 필요한 기능만 활성화하고, 이해상충 분리와 권한·증거 조건을 만족하는 최소 인스턴스 수를 선택한다.

## 7. 활성화와 최소 분리 조건

위험 trigger의 기준은 [아키텍처 §5](architecture.md#5-실행-형태-선택-규칙)다. 아래 표는 그 규칙의 역할별 적용 예이며, 기능 결합으로 필수 분리를 면제하지 않는다. 읽기 전용 원인 조사에는 변경 권한이 따라오지 않는다.

| Trigger | 반드시 활성화할 기능 | 최소 분리 |
| --- | --- | --- |
| 단일 경계·저위험·명확한 oracle | 해당 worker, 필요한 Product/PL 기능 | worker와 verifier 분리는 제품 정책 trigger가 있을 때 |
| 사용자 흐름 또는 시각 동작 변경 | Product, UX, FE, QA | 고위험 접근성/결제/개인정보면 verifier 별도 |
| API/schema/데이터 migration | Product, PL, BE, 영향 consumer, QA | integration owner와 최종 verifier; 보안·운영 trigger 적용 |
| authn/authz, secret, 개인정보, 공급망 | Security, PL, 관련 worker, QA | security fix writer와 Security verifier 분리 |
| CI/IaC/deploy/rollback 변경 | Platform, Operations, Security, QA | 실행자와 recovery verifier 분리; 사람 gate |
| 경계가 얽힌 원인 불명 버그 | PL, 영향 workers, QA | 다중 경계 변경은 verifier 별도; 병렬 조사는 가능, 같은 파일 writer는 한 명 |
| production incident | Incident Lead, Operator, Operations, 관련 PL/worker | 운영 변경 실행자와 recovery verifier 분리; 지휘·실행 결합은 명시 |

## 8. 계약 수용 기준

이 문서는 다음을 모두 만족할 때 역할 계약 v0 검토본으로 판정한다.

- Product, UX/Design, Architecture/PL, FE/BE/Platform, QA, Independent Verifier/QC, Security, Operations/Incident 계약에 목적·비목표, 입력·신선도, 출력·소비자, 권한·금지, 소유권, 완료, 실패·중단·에스컬레이션이 있다.
- 기획·PM·PMO·PL·QA·QC·개발·보안·운영 기능이 책임 역할과 직접 증거에 연결된다.
- 직함과 역할 인스턴스 수를 일대일로 강제하지 않는다.
- 동일 변경의 writer와 독립 verifier, 보안 fix writer와 승인자, 운영 실행자와 자기 관찰만의 복구 판정을 분리한다.
- producer 출력과 consumer 입력이 version/ref를 통해 연결되고 stale artifact를 자동 수용하지 않는다.
- 실제 플랫폼 권한이 계약을 강제하지 못할 때 우회 대신 `INCONCLUSIVE` 또는 `BLOCKED`로 처리한다.

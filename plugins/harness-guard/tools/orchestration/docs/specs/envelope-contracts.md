# Task·Artifact 형식 계약

## 1. 목표와 범위

Task/Artifact의 필수 정보를 machine-readable 형식으로 표현하고, 잘못된 형식과 자체 모순이 다음 단계에 전달되기 전에 로컬에서 검출한다.

- 포함: JSON Schema 2020-12, 유효 예시, 파일을 읽기만 하는 검사기, 실패·경계 테스트.
- 제외: agent profile·skill 설치, dispatch, 실제 권한 집행, Git/source 신선도 조회, cross-envelope ID/ownership 검사, 명령 실행, state machine, 평가 runner, 제품·전역 설정 변경.
- 성공 기준: 아래 AC를 실제 입력/종료 코드 테스트로 확인. 형식 통과는 READY/ACCEPTED 또는 G1 PASS가 아니다.

## 2. 수용 기준

| ID | 관찰 가능한 조건 |
| --- | --- |
| AC-1 | version 0.1.0의 완전한 Task와 PASS/FAIL/INCONCLUSIVE Artifact를 수용한다. |
| AC-2 | 필수 필드 누락, 공백뿐인 필수 문자열, 미지원 version/kind, 잘못된 타입·판정, 알 수 없는 필드를 거부한다. 중첩 필수 구조에도 적용한다. |
| AC-3 | `complete=false, verdict=PASS`를 거부하며 incomplete FAIL/INCONCLUSIVE는 수용한다. PASS는 하나 이상의 claim·evidence가 있고, 제출 evidence가 모두 PASS여야 한다. 확인된 FAIL evidence와 전체 PASS/INCONCLUSIVE의 모순을 거부한다. |
| AC-4 | 비용·retry·epoch의 음수, 0 이하 deadline, 비정수 횟수와 잘못된 observation 날짜를 거부한다. |
| AC-5 | 파일 검사 CLI는 유효 입력에 exit 0, 형식/JSON 오류에 exit 1, 인자/읽기 오류에 exit 2를 반환한다. 결과는 `scope=schema-only`이며 제품 수용 판정을 출력하지 않는다. |
| AC-6 | 검사기는 입력·후보를 변경하거나 envelope의 명령/URI를 실행·fetch하지 않는다. 오류에 payload 원문이나 명령 내용을 출력하지 않는다. 다른 cwd에서도 자체 schema를 찾는다. |

## 3. 구현 선택과 경계

- 새 언어 런타임 설치 없이 현재 Node.js 22와 내장 test runner를 사용한다.
- JSON Schema를 직접 재구현하지 않고 Ajv 8.20.0, ajv-formats 3.0.1을 정확한 버전·lockfile로 고정한다. 조회일: 2026-09-05, npm registry.
- 하나의 schema에 task/artifact와 공유 정의를 둔다. v0.1.0은 숫자로 제한한 budget만 허용하며 무제한 실행 승인은 지원하지 않는다.
- JSON 객체의 중복 key와 여러 envelope의 참조 관계는 이 형식 검사만으로 검증했다고 주장하지 않는다. 실제 consumer의 안전한 파싱·입력 및 runtime 검사는 Phase 1B/1C에서 별도 처리한다.
- schema 자체는 신뢰된 로컬 파일만 읽는다. 입력의 source/command/evidence location은 데이터로만 다룬다. schema를 외부 URI에서 가져오지 않는다.
- provenance, verdict, timestamp, permission은 제출자가 적은 주장이다. 검증 결과는 구조의 적합성만 뜻하며 실제 실행 증거의 진실성을 증명하지 않는다.
- `method.kind=command`의 exit code는 검증 명령의 결과다. 기대한 권한 거부·실패를 검사할 때는 그 기대 결과를 assertion으로 확인해 성공 시 0을 반환하는 검증 명령을 기록하고, 원시 deny/non-zero 결과는 evidence location에 보존한다.
- 종료 코드가 없는 중단·timeout 관찰은 `method.kind=observation`, `exit_code=null`로 남긴다. 완료된 command evidence를 꾸며 만들지 않는다. signal/timeout 전용 필드와 Node의 모듈 해석을 바꾸는 특수 실행 flag는 이 slice의 지원 범위가 아니다.

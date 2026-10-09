# 다섯 프로젝트 QA 계약 적용 검증

## 목표·승인·경계

2026-09-29 사용자 요청: 샘플과 project 폴더의 네 실제 프로젝트를 함께 검증하고, 사용 스택에 맞는
신뢰할 수 있는 테스트 기준·완료 기준·품질 기준·방법론을 조사하여 계획 후 진행한다.
기존 QA 계약 후보 `951e2b6`을 평가한다. Harness는 공통 증거 계약을 소유하고 제품별 시험에 연결한다.
실제 제품 코드·품질 요구는 제품이 소유한다. 이번 단계는 대표 위험의 적용 검증이며 다섯 제품의
출시 승인·전 기능 감사가 아니다. 실패를 고치기 위한 제품 코드 변경·배포·원격 DB 변경은 포함하지 않는다.

## 대상 고정

| 프로젝트 | 현재 commit | 주요 스택 | 대표 위험과 필수 관찰 |
|---|---|---|---|
| team-task-board | `232d18e69ffb304204bd1cd7f25a007a1ea0c567` | Java 21/Spring Boot 4.1.1/JDBC/H2, Vue 3.5/Vite/Vitest/Playwright | 등록 응답 유실 후 재시도·동시 요청·재시작에서 단일 저장과 수정 보존 |
| erp | `085d0cebb6aefd3152e475e8337ff988a281f5ff` | Java 21/Spring Boot 3.4.1/PostgreSQL16/Keycloak, Next16/React19 | 토큰 비노출·권한 표시, 서버 테넌트 격리는 별도 실제 경계 |
| siku | `08cad8f8e24b19710d462dd3f34c3d28588e5611` | React19/Vite8/TypeScript6/Supabase/Vitest/Playwright | 정산 합계·잔액 불변식과 입력 경계, 실제 RLS는 별도 DB 역할 경계 |
| webhook-service | `20669abdf576f1020b64fdaeba8d4f9786959a14` | Python/FastAPI/SQLAlchemy/Alembic/Celery/Redis/pytest | 서명 변조 거부·저장 계약, 실제 재전달/재시도는 DB·queue 경계 |
| DriveTree | `ab86d1394b3b52b8acb56a794854ce49995f5c21` | Nest11/Prisma7/PostgreSQL/pgvector, Next16/React19 | 인증 거부·삭제 필터, 실제 삭제/검색 정합성은 별도 DB 경계 |

버전은 조사 시 manifest 선언이다. 실행 도구 버전·증거는 실행 결과에서 구분한다.
ERP의 기존 미추적 `.codex/`를 보존한다. 원본 HEAD와 상태를 시험 전후 비교한다.

## 공통 시험 설계와 기준

방법론은 위험 기반 시험 + 동등 분할/경계값 + 상태 전이 + 권한 결정표를 실제 요구에 맞게 조합한다.
[근거 자료](../qa-evidence-guide.md)의 공식 원칙과 제품에 적용한 판단을 구분한다.
모든 프로젝트에 같은 커버리지 수치·브라우저 수·성능 임계값을 강제하지 않는다.

- 진입 조건: 정확한 후보, 사용 가능한 의존성, 비밀 설정 없는 격리 사본, 테스트 fixture의 외부 부작용 확인.
- 각 slice는 정상·거부·경계를 포함하고 기대 결과를 기존 공개 계약에 대조한다. 목 기반 시험은 목 범위만 증명한다.
- 실제 저장·큐·인증·RLS는 해당 실제 엔진/역할 환경에서 확인하기 전까지 UNVERIFIED다.
- 검출력 대조: 샘플에서 동일한 회귀 테스트를 결함이 있는 과거 backend와 현재 backend에 적용한다.
  테스트 단언을 바꾸지 않고 원래 결함으로 RED, 현재 후보로 GREEN인지 확인한다. 구성/의존성 실패는 RED로 세지 않는다.
- 각 실행의 명령·입력 후보·관찰 경계·종료 코드·결과·환경을 남긴다. 제품 전체 green으로 확대하지 않는다.
- 범위 안 필수 시험 FAIL/UNVERIFIED가 남으면 해당 제품 위험의 검증은 미완료다.
  조사 산출물 완성과 제품 품질 통과를 별도로 판정한다.
- 중단 조건: 운영/미확인 DB, 외부 계정·결제·유료 API가 필요하면 해당 시험만 보류한다.
  새 근거 없는 반복·임의 설정 변경·기준 완화는 하지 않는다. 필요 환경과 다음 실행을 구체적으로 남긴다.

## 실행 순서와 확인 방법

| 단계 | 작업 | 통과/종료 기준 | 현재 상태 |
|---|---|---|---|
| 1 | 다섯 repo 지침·manifest·테스트·fixture 조사 | 후보·핵심 위험·안전한 명령과 미확인 경계 식별 | 완료 |
| 2 | 공식 기준 수집 및 제품 매핑 | 출처·적용 목적·한계, 범용 숫자 강제 없음 | 완료 |
| 3 | 격리 사본의 대표 검사 | 아래 명령의 실행 결과, 실패/차단 분리 | 완료 |
| 4 | 샘플 회귀 검출력 RED/GREEN | 같은 테스트로 과거 결함 실패·현재 통과 | 완료 |
| 5 | 독립 범위·결과 검토 | 요구에서 누락한 위험, 근거 없는 통과/비적용 판정 대조 | 완료 |
| 6 | 공통 계약의 부족한 부분 판정 | 프로젝트별 후속 검사·필수 환경과 Harness 보강 필요를 증거로 연결 | 완료; 2차 통합 결과는 아래 참조 |

대표 명령(원본이 아닌 임시 사본; 기존 설치 의존성 재사용, `.env` 제외):

- 샘플: `./gradlew --offline check bootJar`, `vitest run`, `playwright test tests/create-retry.spec.ts`, `python3 scripts/check-persistence.py`.
- ERP frontend: `npm test -- src/lib/auth-session.test.ts src/lib/navigation-access.test.ts`.
- Siku: `npm test -- src/core/settlement/settlement.test.ts`.
- DriveTree backend: `npm test -- --runInBand src/auth/auth.service.spec.ts src/content/content.service.spec.ts`.
- webhook-service: 격리 환경 변수로 `pytest tests/test_unit_signatures.py tests/test_unit_repositories.py -q`.
  `.env` 자동 로딩은 사본에 파일을 넣지 않아 차단하고 공용 engine 생성에는 연결하지 않을 loopback PostgreSQL URL, repository fixture에는 기존 SQLite 메모리 DB, queue에는 메모리용 값을 사용한다.

## 1차 결과 — 대표 검사와 검출력 대조

관련 판단 전에 [전체 본문](multi-project-qa-validation-representative.md)을 읽는다.

### 같은 시험의 결함 검출력

관련 판단 전에 [전체 본문](multi-project-qa-validation-representative.md)을 읽는다.

### 1차 종료 시 환경 진입 조건과 다음 통합 검증

관련 판단 전에 [전체 본문](multi-project-qa-validation-representative.md)을 읽는다.

### 통합 시험 재개 전 제품별 설정 확인

관련 판단 전에 [전체 본문](multi-project-qa-validation-representative.md)을 읽는다.

### 1차 Harness 판정

관련 판단 전에 [전체 본문](multi-project-qa-validation-representative.md)을 읽는다.

## 2차 결과 — 실제 통합 경계 (2026-09-29)

관련 판단 전에 [전체 본문](multi-project-qa-validation-integration.md)을 읽는다.

### 재현된 결함과 수정 수용 기준

관련 판단 전에 [전체 본문](multi-project-qa-validation-integration.md)을 읽는다.

### 통과로 확대하면 안 되는 경계

관련 판단 전에 [전체 본문](multi-project-qa-validation-integration.md)을 읽는다.

### 환경·증거·정리

관련 판단 전에 [전체 본문](multi-project-qa-validation-integration.md)을 읽는다.

### Harness에 남길 교훈과 현재 판정

관련 판단 전에 [전체 본문](multi-project-qa-validation-integration.md)을 읽는다.

## 3차 결과 — 확인된 두 결함 수정 (2026-09-29)

관련 판단 전에 [전체 본문](multi-project-qa-validation-integration.md)을 읽는다.

## 문서 동기화 대상

```harness-doc-sync
{
  "version": 1,
  "documents": [
    {"path":"docs/specs/multi-project-qa-validation.md","reason":"범위·실행·미확인 경계와 재개 조건"},
    {"path":"docs/specs/multi-project-qa-evidence.json","reason":"1차 후보·명령·출력 및 원본 보존 증거(보존)"},
    {"path":"docs/specs/multi-project-integration-evidence.json","reason":"2차 실제 경계·실패 재현·진단 시험 원문과 한계"},
    {"path":"docs/qa-evidence-guide.md","reason":"공식 근거와 제품별 적용 판단"},
    {"path":"docs/ai-collaboration.md","reason":"정본 계약에서 보조 근거와 적용 기록 연결"},
    {"path":"docs/specs/qa-scope-contract.md","reason":"기존 계약 구현과 후속 현장 검증의 구분"}
  ],
  "items": []
}
```

## 후속 작업 범위 정정 — Harness 자체 보강

2026-09-29 사용자 지시에 따라 개별 제품의 추가 수정·병합·배포는 보류한다. 앞선 제품 후보와
시험 이력은 보존한다. 이후 작업 대상은 Harness의 QA 관찰 경계·완료 판정·작업 범위 유지이며
[행동 평가 기록](qa-behavior-validation.md)으로 연결한다. 위 1차의 “행동 평가 미확인”은 당시 상태다.
제품 통합 시험의 완료를 Harness 행동 평가의 선행 조건으로 강제하지 않는다.

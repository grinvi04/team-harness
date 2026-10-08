# 다섯 프로젝트 QA 대표 검사와 재개 조건

[상위 문서](multi-project-qa-validation.md)로 돌아간다. 아래는 원문의 해당 주제·당시 후보 기록을 순서대로 보존한 본문이다.

## 1차 결과 — 대표 검사와 검출력 대조

2026-09-29에 아래 검사를 새로 실행했다. [실행 증거](multi-project-qa-evidence.json)에 실제 명령·종료 코드·
출력·원본 로그 digest·후보와 원본 보존 대조를 남겼다. 기존 61단계 Harness 검사는 이 제품 실행에 합산하지 않는다.

| 대상 | 실제 확인한 경계 | 결과 | 미확인 필수 경계 |
|---|---|---|---|
| 샘플 | 프런트 함수, H2 API/스키마, 실제 브라우저 등록 재시도, 파일 DB 재시작 | 프런트 76개·백엔드 13개·브라우저 13개 PASS; 재시작 검사 exit 0 | 다른 제품 흐름/지원 화면·입력 조합, 사용자의 미공개 원래 증상 |
| ERP | 토큰 제거/잘못된 세션 거부 helper, 역할별 메뉴 정책 | 18개 PASS | 서버 인가·교차 테넌트, 실제 재무/재고 흐름 |
| Siku | 배분/반올림·잔액 합계·잘못된 입력과 선지급 계산 | 28개 PASS | 실제 RLS/Storage 거부·확정 상태 잠금 |
| webhook-service | 실제 서명 계산의 정상/변조 거부, SQLite 저장 조회/transaction | 21개 PASS | Postgres·Redis·Celery 중복 처리·큐 실패 복구·실제 replay 인가 |
| DriveTree | 인증/refresh 거부 분기·soft-delete 필터(Prisma 등 mock) | 23개 PASS | 실제 DB 목록/검색 정합성·HTTP 인가 |

원본 다섯 repo의 HEAD·브랜치·Git 상태는 시험 전후 동일하다. ERP의 기존 `.codex/`도 그대로다.
Siku는 조사 시 로컬 `develop`이 캐시된 원격 추적 ref보다 4커밋 뒤였다. fetch 없이 고정한 로컬 후보만
검증했으며 원격 최신 후보로 확대하지 않는다. 기존 설치 의존성을 별도 복사해 사용했으므로 clean install
재현성도 이 결과의 범위가 아니다. 임시 서버는 사용자의 기존 5173/8080 앱과 다른 포트에서 실행했다.

### 같은 시험의 결함 검출력

현재 frontend와 테스트 `232d18e…`를 고정하고 backend만 `fcbb1e4…`로 바꿨다. 옛 제품 전체를 재현한
것이 아니라 동일 소비자/시험에서 서버 수정의 효과를 대조한 실험이다. 테스트 파일 digest는
`81e292ce28f5e3bc80904a1f373b25a138b4f303436482519078f07b1f0739e0`이며 커밋 원본과 같다.

- 현재 backend: `create-retry.spec.ts`의 13개 모두 PASS, 아래 두 사례 포함.
- 과거 backend: 저장 성공 후 응답을 끊고 재시도한 두 사례 모두 FAIL(exit 1).
  목록 유지 사례는 API 결과가 기대 1건 대신 2건, 목록 재조회 사례는 화면 제목이 기대 1개 대신 2개였다.
- 같은 단언·현재 frontend·H2 설정·포트·브라우저·worker를 썼고 별도 설정의 서버 jar 경로만 바꿨다.
  서버 시작이나 의존성 실패를 결함 검출 성공으로 세지 않았다.

이 대조는 알려진 중복 결함을 해당 시험이 잡는다는 증거다. Harness가 미지의 결함을 스스로 찾는 능력이나
모든 작업에서 올바른 QA 범위를 고른다는 증거는 아니다.

### 1차 종료 시 환경 진입 조건과 다음 통합 검증

아래는 1차 종료 시점의 기록이다. 이후 실행은 아래 **2차 결과**에서 구분한다.
Docker 상태를 권한 있는 읽기 전용 호출로 확인했으나 daemon이 실행 중이지 않았다. Supabase CLI도
현재 PATH에서 찾지 못했다. 아래 실제 서비스 검사는 **UNVERIFIED**이며 비적용 SKIP이 아니다.
환경 준비를 제품 실패나 모델 추론 실패로 분류하지 않는다. 기존 `.env`·운영 DB·유료 API를 사용하지 않았다.

다음 단계 담당자는 각 제품의 변경 권한 안에서 폐기 가능한 환경을 준비하고 후보를 다시 고정한다.
서비스의 포트가 local이라는 이유만으로 데이터까지 격리됐다고 보지 않는다. 이번 연구의 중단 조건에 따라
아래 후속 항목은 실행하지 않았다. 표의 예상 결과는 다음 실행의 최소 수용 조건이며 아직 충족된 증거가 아니다.

| 우선순위/제품 | 진입 조건과 실행 출발점 | 필수 사례와 합격 기준 |
|---|---|---|
| P0 ERP | 독립 PostgreSQL16·Keycloak realm·테넌트 2개 및 아래 ERP 준비 조건 충족; backend `./gradlew check`, 준비 후 frontend `E2E_COMMERCIAL=1 npx playwright test --project=commercial` | 소유 테넌트 정상 허용, 다른 테넌트의 직접 API 조회/변경 거부 및 데이터 불변; 저권한 export 거부, AP/AR→GL→보고서/VAT 및 재고 정합성. 기존 E2E에 없는 거부 사례는 제품에서 보완 필요 |
| P0 Siku | 임시 로컬 Supabase, 아래 Siku 설정·포트 격리 조건 충족; 프로젝트 CI대로 마이그레이션 후 `npm run test:e2e` | A그룹 사용자의 B그룹 DB·Storage 읽기/쓰기 거부; 정상 소유자 허용; 정산 확정 뒤 변경 거부/취소 뒤 정책대로 허용, 잔액 합계 0. service-role 성공만으로 RLS 통과 금지. 기존 E2E에는 타 그룹 DB/Storage 거부 단언이 없으므로 새 시험 작성·실행 필요 |
| P0 webhook-service | 임시 PostgreSQL·Redis·Celery와 인증/전송 대역; 격리 환경에서 `pytest -o env_files= tests/test_idempotency.py tests/test_integration_webhooks.py -q` | 같은 tenant/source/event의 중복 효과 1회; enqueue 실패 후 예약 해제와 재시도 성공; 다른 tenant 동일 키는 정책대로 분리, 비관리자 replay 거부·DLQ 상태 전이. 기존 테스트의 실제 worker 사용 여부도 확인 |
| P0 DriveTree | 폐기 전용 pgvector DB·Prisma migration·dummy auth secrets, 유료 임베딩 대역; backend `npm run test:e2e -- --runInBand` | soft-delete 후 실제 목록/검색 제외, 기존 embedding 보존과 정책 일치; 익명 읽기와 관리자 쓰기의 HTTP 허용/거부. fixture의 무조건 `deleteMany` 때문에 기존 DB 연결 금지 |
| P1 UI/품질 축 | 각 제품의 지원 브라우저/화면/입력·핵심 흐름 선정, 제품이 채택한 접근성 기준과 성능 SLO 확인 | 긴 데이터·오류 복구·키보드/초점·작은 화면을 관찰; 성능은 부하/데이터 규모/측정 지표/임계값이 정해져야 판정. 이번 단계에서 모두 미실행 |

### 통합 시험 재개 전 제품별 설정 확인

- **ERP:** `frontend/src/lib/commercial-uat.ts`의 로더가 강제하는 값을 전부 준비한다.
  `E2E_COMMERCIAL_MUTATION=LOCAL_MUTATION_ACCEPTED`는 폐기 DB를 가리키는지 확인한 뒤에만 설정한다.
  `E2E_COMMERCIAL_FRONTEND_URL`, `E2E_COMMERCIAL_BACKEND_URL`, `E2E_COMMERCIAL_KC_ISSUER`를
  임시 서비스로 명시하고 `E2E_CLIENT_SECRET`, 실제 시험 프런트와 같은 `AUTH_SECRET`,
  `E2E_COMMERCIAL_KC_ADMIN_USERNAME/PASSWORD`를 로컬 fixture 값으로 주입한다.
  `E2E_COMMERCIAL_CREATOR`, `APPROVER`, `TENANT_B`, `RESTRICTED` 각각의 `_USERNAME`과 `_PASSWORD`도
  필요하다(뒤 세 이름 역시 `E2E_COMMERCIAL_` 접두어). 서로 다른 4명이고 작성자·결재자·무권한은
  테넌트 A, 나머지는 테넌트 B여야 한다. 백엔드·Keycloak·실제 프런트 서버를 먼저 띄우고,
  Playwright 기본 webServer용 frontend build도 선행한다. 시험 사본의 포트 충돌과 기존 서버 재사용을
  제거한다. `E2E_BACKEND` 프로젝트까지 추가할 때는 `backend.setup.ts`의 `E2E_KC_ISSUER`,
  `E2E_CLIENT_ID/SECRET`, `E2E_USERNAME/PASSWORD`, `AUTH_SECRET`, `E2E_BACKEND_URL`도 별도로 맞춘다.
  위 실행 명령만으로 환경이나 계정이 자동 생성되는 것은 아니다.
- **Siku:** `tests/e2e/helpers/admin.ts`가 사본 루트 `.env`를 직접 읽고 관리자 client로 데이터를
  생성·삭제한다. 원본 `.env`를 복사하지 않고 폐기할 로컬 Supabase의 `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`만 넣은 새 임시 파일을 만든다.
  값은 출력·커밋하지 않는다. 실제 endpoint·project 식별자가 임시 인스턴스인지 확인한다.
  현재 `playwright.config.ts`는 5173과 `reuseExistingServer: true`이므로 그대로 실행하지 않는다.
  시험 사본 설정에서 Vite 실행 포트·baseURL·webServer URL을 사용하지 않는 전용 포트로 함께 바꾸고
  `reuseExistingServer: false`로 고정한다. 테스트 단언을 바꾸지 않는다. 관리자 client는 fixture 전용이며
  RLS 거부 시험 자체는 일반 사용자 세션으로 실행한다. 현재 `settle.spec.ts`와 `flows.spec.ts`는
  같은 그룹 흐름을 중심으로 검사한다. 제품에서 별도 2그룹 DB·Storage 거부 시험을 추가하고 실행해야 하며,
  기존 E2E가 모두 green이어도 이 필수 기준은 미확인이다.

### 1차 Harness 판정

기존 계약의 요구→위험→판정자 연결, mock과 실제 경계 구분, UNVERIFIED 처리 방식은 다섯 스택에
적용할 수 있었다. 추가로 구체화할 핵심은 **시험 진입 조건(격리·fixture 부작용·실제 엔진)**과
**검사 자체의 검출력 대조**다. 이번 가이드와 계획에 실례를 남기고 기존 협업 문서에서 연결한다.
새 범용 검사 엔진·전역 역할·모델 변경은 필요하지 않다. 공통 스킬이 이 기준을 안정적으로 따르는지의
행동 평가는 아직 미확인이며, 네 제품의 실제 통합 경계 완료 후 출시 판단과 별도로 평가해야 한다.

독립 읽기 전용 검토에서 ERP의 UAT 설정 선행 조건, Siku의 직접 `.env` 로딩/기존 서버 재사용,
Siku의 타 그룹 DB·Storage 거부 시험 누락을 지적받았다. 위 재개 조건과 새 시험 필요에 반영했고,
재검토에서 이 조사 범위에 대한 추가 근거 있는 지적은 없었다. 이는 제품 전체 통과 판정이 아니다.
문서 동기화 검사, JSON 결과/로그 digest 일치, 참조 경로와 원본 보존 대조를 통과했다.

판정: **근거 조사·계획과 안전한 대표 실행·독립 검토는 완료**했다. 다섯 제품 전체 QA는 **NOT VERIFIED**다.
공식 자료를 읽은 것만으로 표준 준수나 인증을 주장하지 않는다.

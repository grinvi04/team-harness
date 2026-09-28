# QA 기준의 근거와 프로젝트 적용

조사일: 2026-09-29. 공식 표준 조직·프레임워크/도구 유지관리자의 1차 자료만 사용했다.
아래는 짧은 적용 판단이며 원문 복제나 표준 인증 선언이 아니다. 문서는 최신 웹판을 확인했으므로
세부 API는 제품의 설치 버전과 대조한다. 이번 [다섯 프로젝트 적용 검증](specs/multi-project-qa-validation.md)은
Harness QA 계약의 현장 적합성을 평가하며 각 제품의 출시 승인을 대신하지 않는다.

## 근거 자료와 채택 범위

| 공식 근거 | 확인한 핵심 | 이번 적용 및 한계 |
|---|---|---|
| [ISTQB CTFL 4.0.1 §1.4.4, §4.2, §5.1.3, §5.2](https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf) | 요구와 시험의 추적, 경계값·결정표·상태 전이, 시작/종료 조건, 위험 기반 범위 | 사용자 흐름→위험→시험→판정 연결. 일정 종료와 품질 통과를 구분하며 범위 선정과 잔여 위험을 기록한다. 모든 결함의 부재를 증명하지 않는다. |
| [OWASP ASVS 5.0.0](https://owasp.org/projects/asvs?tab=main) / [고정 버전 요구사항](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.flat.json) | 검증 가능한 보안 요구와 버전을 포함한 식별자 | 인증·권한·세션·입력 중 제품 적용 항목을 고른다. 예: v5.0.0-8.1.1의 기능/데이터 접근 규칙을 역할·테넌트 결정표에 연결. 일부 시험을 전체 ASVS 인증으로 확대하지 않는다. |
| [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) | 관찰 가능한 접근성 성공 기준 | 채택 범위의 키보드 2.1.1, reflow 1.4.10, 가려지지 않는 초점 2.4.11 등을 화면 조건에 연결. axe 위반 0만으로 전체 준수를 주장하지 않는다. |
| [Playwright Best Practices](https://playwright.dev/docs/best-practices) / [Isolation](https://playwright.dev/docs/browser-contexts) | 사용자에게 보이는 결과, 독립된 시험과 제3자 의존 경계 | 역할/라벨·공개 결과 단언, 테스트 데이터 격리. 브라우저 context 격리가 서버 DB까지 격리하는 것은 아니다. |
| [Vue Testing](https://vuejs.org/guide/scaling-up/testing.html) | 단위·컴포넌트·E2E의 서로 다른 관찰 범위 | 샘플의 순수 함수 검사와 화면/API/저장 흐름을 분리한다. 컴포넌트 내부 구현 복제 대신 공개 동작을 단언한다. |
| [Next.js Testing](https://nextjs.org/docs/app/guides/testing) | 단위/통합/E2E 구분, async Server Component의 도구 한계 | ERP·DriveTree의 서버 렌더·인증·탐색 흐름은 Vitest만으로 완료하지 않는다. 현재 Next16.2 계열에 맞는 실행 구성을 확인한다. |
| [Spring Boot Testing](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html) | 실제 HTTP 서버 시험은 클라이언트와 서버의 트랜잭션이 분리됨 | ERP/샘플의 실제 HTTP 검사는 격리 DB를 쓴다. 테스트의 rollback만으로 서버 쓰기가 모두 복구된다고 가정하지 않는다. |
| [Testcontainers Database Modules](https://java.testcontainers.org/modules/databases/) | 실제 DB 엔진을 고정 상태로 실행하는 시험 | PostgreSQL 고유 타입·제약·마이그레이션은 H2/SQLite 결과로 대체하지 않는다. Docker 준비 전 실행한 것으로 보고하지 않는다. |
| [NestJS Testing](https://docs.nestjs.com/fundamentals/testing) | provider 대체를 쓰는 단위 시험과 HTTP 통합 시험 | DriveTree의 Prisma mock은 서비스 분기 증거다. 실제 Prisma·DB·삭제 검색 결과는 별도 시험한다. |
| [Supabase Database Testing](https://supabase.com/docs/guides/database/testing) | 클라이언트 및 SQL/pgTAP 기반 DB·RLS 검사 | Siku 정산 함수 통과와 그룹별 읽기/쓰기·Storage 정책 통과를 분리한다. service-role만 사용하는 fixture는 일반 사용자 RLS 거부 증거가 아니다. |
| [FastAPI Async Tests](https://fastapi.tiangolo.com/advanced/async-tests/) | ASGITransport 기반 비동기 호출, lifespan 실행 주의 | webhook-service의 서명 단위 시험과 startup·Redis·queue 통합을 분리한다. HTTPX 호출만으로 lifecycle 실행을 추정하지 않는다. |
| [pytest monkeypatch](https://docs.pytest.org/en/stable/how-to/monkeypatch.html) | 의존성·환경 대체와 원격 호출 방지 | 외부 인증/전송은 테스트 경계에서 대체하고 실제 암호학적 서명 계산은 유지한다. 특정 HTTP 라이브러리 patch가 모든 네트워크를 막는다고 주장하지 않는다. |
| [Grafana k6 Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) | 성능 지표별 합격/불합격 임계값 | 제품 SLO·부하 모델·데이터 규모가 정해져야 성능을 판정한다. 문서 예시의 응답시간을 다섯 제품 공통 기준으로 복사하지 않는다. 이번 단계는 부하 시험을 실행하지 않는다. |

## 범위 선정과 시험 방법

스택은 시험 수단을 정하는 근거이며 업무 품질 기준의 전부가 아니다. 먼저 사용자 흐름과 지켜야 할
데이터/권한 불변식을 고르고, 변경 가능성·실패 영향·탐지 난이도에 따라 우선순위를 정한다.
높은 위험과 기존 필수 gate를 먼저 연결하고 제외 사유를 남긴다. 테스트 파일 개수나 임의의 80% 커버리지로
완료 기준을 대신하지 않는다. 아래 방법 중 해당 입력과 경계에 맞는 것을 고른다.

| 대상 | 방법 | 예시 판정자 |
|---|---|---|
| 범위·금액·길이·빈 값 | 동등 분할과 경계값 | 허용 최소/최대의 정상 결과, 그 밖 입력의 명시적 거부와 상태 불변 |
| 역할·그룹·테넌트 | 결정표와 직접 API/DB 거부 시험 | 허용 주체는 성공, 다른 테넌트/그룹은 읽기·쓰기 0건, 민감 필드 비노출 |
| 등록·확정·취소·재시도·재시작 | 상태 전이·장애 시점 주입 | 저장 전 실패와 저장 후 응답 유실 구분, 중복 없음, 후속 수정 보존 |
| 금액 배분·집계 | 불변식과 대표 예제 | 합계 보존, 결정적 반올림/잔액 배분, 잘못된 금액 거부 |
| 화면·키보드·긴 데이터 | 사용자 흐름 기반 브라우저 시험 | 정보·컨트롤 가림 없음, 조작 가능, 예측 가능한 초점과 오류 복구 |
| 기존 회귀 테스트의 검출력 | 알려진 결함/정상 후보 대조 | 같은 단언이 결함에서 동작 이유로 실패하고 정상에서 통과 |

이것은 이번 적용 판단이다. 각 제품의 정책과 다르면 제품 원본·사용자 의도를 먼저 확인하며,
기준을 바꾸는 결정을 조용히 하지 않는다. 렌더 스모크·mock·실서비스 시험은 서로 대체할 수 없는 경계를 가진다.

## 제품별 최초 범위 선정과 후속 연결

| 제품 | 우선 필수 기준 | 대표 시험의 한계 | 제품 전체 통과 전에 필요한 다음 경계 |
|---|---|---|---|
| 샘플 | 동일 등록 재시도의 단일 항목, 경합/키 충돌 거부, 이후 변경·재시작 보존 | H2·선정된 등록 흐름 | 다른 사용자 흐름·지원 화면/입력 방식은 별도 범위 검토; 미공개 증상 해결과 구분 |
| ERP | 브라우저 토큰 비노출, 권한 표시 일관성, 서버 테넌트 접근 제한 | 프런트 helper 통과는 서버 인가가 아님 | 격리 Postgres+Keycloak로 교차 테넌트 직접 API 거부와 핵심 재무·재고 흐름 |
| Siku | 정산 합계/잔액 보존·잘못된 입력 거부, 그룹별 접근 제한 | 순수 함수 시험은 RLS·확정 잠금이 아님 | 로컬 Supabase 일반 사용자 2그룹의 DB/Storage 거부 시험 추가·실행(현재 E2E에 없음), 확정/취소/선지급 상태 전이 |
| webhook-service | 올바른 서명 허용·변조 거부, 고객별 저장 조회와 transaction 계약 | SQLite·인증 mock은 Postgres/Redis/Celery 정합성이 아님 | 격리 서비스에서 큐 실패 뒤 재시도·중복 전달·tenant별 replay 인가와 DLQ |
| DriveTree | 잘못된 인증/refresh 거부, 삭제 필터·후속 수정 계약 | Prisma mock은 실제 SQL/검색 결과가 아님 | 임시 pgvector DB에서 soft-delete 후 목록/검색 제외와 관리자 HTTP 인가 |

## 실제 통합에서 확인한 검출력과 빈틈

[2차 통합 결과](specs/multi-project-qa-validation.md#2차-결과--실제-통합-경계-2026-09-29)는 위 최초 계획을
실행한 기록이다. 모든 제품에 동일 시험을 강제하는 목록이 아니라 해당 위험이 있을 때 적용할 사례다.

- **상태 잠금:** 버튼 숨김과 일반 필드 변경 거부 이후에도 부모 참조를 바꿔 잠긴 자료를 빼낼 수 있다.
  Siku에서 확정 지출·참여 내역 이동을 실제 사용자로 실행해 결함을 확인했다. OLD/NEW 관계와 원본 불변을 함께 관찰한다.
- **소비자 일관성:** DB 삭제와 단건 404가 정상이어도 기존 검색 캐시는 남을 수 있다. DriveTree에서 재현했다.
  해당 제품이 즉시 반영을 약속한다면 쓰기 전 캐시를 채운 소비자도 같은 수용 기준에 포함한다.
- **비동기 완료:** 요청 수락·작업 인계·작업 완료·부작용 저장은 다른 판정이다. 완료 신호 이후 저장 결과를
  확인하며 고정 sleep만으로 완료를 추정하지 않는다. DLQ 로그와 복구 가능한 영속 실패 자료도 구분한다.
- **권한 시험:** 실제 토큰과 대체 claims, 조회 거부와 변경 거부, 객체 tenant와 사용자 tenant를 구분한다.
  ERP UAT의 조회 거부만으로 변경 차단을 추정하거나 webhook의 역할 대역을 실제 JWT 검증으로 세지 않는다.
- **정상·반례 쌍:** 일반 잠금은 PASS인데 부모 이동은 FAIL이고 DB E2E는 PASS인데 캐시 HTTP는 FAIL이었다.
  시험 수를 늘리는 것보다 요구의 관찰 경계를 연결하는 것이 이번 결함 검출에 직접 기여했다.

2차의 초기 실패 시험은 임시 진단 overlay였으며, 3차에서 Siku·DriveTree의 회귀 시험을 제품 작업
브랜치에 포함하고 같은 동작의 RED/GREEN을 확인했다. 병합·배포 완료는 아니다. 실제 소스 후보·
실행·한계는 적용 검증을 정본으로 보고, 위 사례만으로 모든 미지 결함 탐지나 공통 스킬 준수를 주장하지 않는다.

## 완료 판정

- **이번 조사 완료:** 다섯 후보의 위험·시험 경계·공식 근거를 연결하고, 계획한 안전한 실행의 결과와
  실패/실행 불가 원인·후속 조건을 기록하며 독립 검토한다. 실제 못 돌린 항목을 통과로 바꾸지 않는다.
- **해당 품질 범위 통과:** 필수 사례 모두 PASS, 관련 미해결 차단 결함 0, 필수 gate 통과, 후보·환경 증거 일치.
  사용자 정책이 바뀌지 않은 한 실패 뒤 필수 검사를 빼거나 임계값을 낮출 수 없다.
- **제품 전체 QA·릴리즈:** 남아 있는 실제 DB/인증/브라우저·운영 적합성 경계와 각 제품의 delivery gate가
  별도로 충족돼야 한다. 조사 종료나 대표 단위 시험 통과는 제품 출시 승인이 아니다.

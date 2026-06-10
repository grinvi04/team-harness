# 기술 스택 선택 가이드

대상 시스템: **SCM·ERP·업무 자동화** (트랜잭션·정합성·리포팅 중심의 업무 시스템).
선택 1순위 기준은 **팀이 익숙한 것** — 이 문서는 각 후보의 확정 추천 구성과 근거를 제공한다.
"최신 안정화 버전"은 킥오프 시점에 공식 릴리즈 페이지로 재확인한다 (아래 버전은 2026-06 기준).

---

## 백엔드 후보

### 1. Java + Spring Boot ⭐ (ERP/SCM 1순위 추천)

| 항목 | 선택 | 근거 |
|---|---|---|
| Java | **21 LTS** (신규라면 25 LTS 검토) | 21은 생태계 검증 완료, 25는 최신 LTS |
| Spring Boot | 최신 안정 (3.5.x / 4.x — 킥오프 시 확인) | |
| ORM | **Spring Data JPA(Hibernate) + QueryDSL** | 레퍼런스 최다·검증 완료. 복잡 동적 쿼리는 QueryDSL |
| 로깅 | **SLF4J + Logback** (Spring 기본) + logstash-logback-encoder(JSON 구조화) | 표준 그 자체 |
| 마이그레이션 | Flyway | 레퍼런스 최다 |
| 테스트 | JUnit5 + AssertJ + Testcontainers(PostgreSQL) | TDD 기본 도구 세트 |

ERP/SCM처럼 도메인이 복잡하고 트랜잭션이 무거운 시스템의 업계 표준. 채용 풀도 가장 넓다.
기존 jwikoori-map(Clean Arch + DDD + Java/Spring) 구조·가드 자산을 그대로 참고/이식 가능.

### 2. Node + NestJS (경량 서비스·풀스택 팀에 적합)

| 항목 | 선택 | 근거 |
|---|---|---|
| Node | **최신 LTS** (24 LTS, 킥오프 시 확인) | |
| ORM | **Prisma** (추천) / TypeORM (레퍼런스 최다 기준이면) | Prisma: 타입 안전·마이그레이션 일체화·운영 경험 보유. TypeORM: NestJS 공식 문서 기본이라 레퍼런스는 더 많음 |
| 로깅 | **nestjs-pino** (추천) / winston (레퍼런스 최다 기준이면) | pino: 구조화 JSON·성능 우위·현 표준 추세 |
| 테스트 | Jest (Nest 기본) + Supertest + Testcontainers | |

### 3-1. Python → **Django** (LTS)

업무 시스템(ERP/백오피스)이라면 FastAPI보다 **Django**: admin 화면 무료 제공(백오피스 개발량 대폭 절감),
ORM·인증·마이그레이션 내장, 레퍼런스 최다. 경량 API 서비스만 필요할 때는 FastAPI.
테스트 pytest + pytest-django, 로깅 structlog(JSON).

### 3-2. Ruby → **Rails 최신 안정 (8.x)**

Rails 자체가 사실상 유일 선택지. ActiveRecord(ORM)·Semantic Logger 또는 lograge(구조화 로깅)·RSpec(테스트).
컨벤션 강제력이 강해 소팀 생산성은 높지만, 국내 채용 풀이 가장 좁다는 점을 고려.

## 프론트엔드

**React 최신 안정 + Next.js 추천** (Vue+Nuxt 대비): 국내외 인력 풀·레퍼런스·컴포넌트 생태계(업무 시스템에 중요한
테이블/폼 라이브러리 — TanStack Table, react-hook-form 등) 모두 우위. 상태관리는 서버상태 TanStack Query +
클라이언트상태 Zustand. 팀이 Vue에 더 익숙하면 Nuxt도 무방 — 둘의 기술적 격차보다 팀 숙련도 격차가 더 크다.

## 데이터베이스 — **PostgreSQL** (확정 추천)

**NoSQL이 RDB를 대체 가능한가에 대한 답: 이 도메인에서는 아니다.**
SCM/ERP의 본질은 다중 테이블 트랜잭션(주문→재고→정산), 강한 정합성 제약(FK·unique·check),
조인 기반 리포팅이다. 이건 RDB가 설계 목적 그 자체로 해결하는 영역이고, MongoDB는 트랜잭션을 지원해도
스키마 강제·제약·집계 측면에서 기본값이 될 수 없다. 반대로 NoSQL의 강점(유연 스키마)은
**PostgreSQL JSONB**로 충분히 흡수된다 — 두 세계를 한 DB로 커버.

- 시작: RDS PostgreSQL → 스케일 시 **Aurora PostgreSQL** (와이어 호환이라 마이그레이션 경로가 매끄러움)
- MySQL 대비: JSONB·윈도우 함수·파티셔닝 등 분석/리포팅 기능 우위, 라이선스 깔끔
- NoSQL은 보조 용도로만: 캐시(Redis), 이벤트 로그/비정형 대용량(필요 시점에 추가)

## 인프라 — EC2 → EKS 확장 경로

**Day 1부터 컨테이너화(Docker)가 핵심 원칙.** 이것만 지키면 EC2(docker compose) → EKS 전환이
이미지 그대로 오케스트레이션만 바꾸는 일이 된다.

- 이미지: ECR / 배포: GitHub Actions (ci-gate 통과 → 이미지 빌드 → 배포)
- 시크릿: AWS Secrets Manager 또는 SSM Parameter Store — .env 파일을 서버에 두지 않는다
- 에러 트래킹: Sentry / 로그: 구조화 JSON → CloudWatch (EKS 전환 시 수집 파이프라인 재사용)

## 아키텍처·테스트 공통 원칙

- **클린 아키텍처**: domain ← application ← (interface | infrastructure) 의존 방향 강제.
  단, 프레임워크 결에 맞게 조정 — Django/Rails처럼 ActiveRecord 패턴이 기본인 프레임워크에
  레이어를 과하게 강제하면 프레임워크 장점을 죽인다 (Spring/NestJS는 정석 적용).
- **TDD 기본**: 도메인 로직 단위 테스트 우선, DB 의존 테스트는 Testcontainers로 실제 DB 사용.
  CI 게이트(ci-gate.yml)가 테스트 통과를 강제한다.
- 공통 응답/에러 포맷, 감사 로그(누가·언제·무엇을 — ERP 필수), 인증·인가(역할 기반)는
  스택 확정 후 해당 스택 스캐폴드에 구체화한다.

## 권장 기본 조합 (팀 익숙함이 동률일 때)

> **Java 21 + Spring Boot + JPA/QueryDSL + React/Next.js + PostgreSQL + GitHub + EC2(Docker)→EKS**

ERP/SCM 도메인 표준 조합이고, 채용·레퍼런스·기존 자산(jwikoori 구조) 활용 모두 최적.

---

스택이 확정되면 이 repo에 해당 스택의 스캐폴드를 추가한다:
AGENTS.md 빌드/테스트 명령 구체화, ci-gate.yml 실제 단계 교체, 스택 전용 가드
(예: Java — 테스트 스킵·prod 프로파일·마이그레이션 삭제 차단, 구 harness에서 이식).

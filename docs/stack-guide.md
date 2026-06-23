# 기술 스택 선택 가이드

대상: **팀 프로젝트** 기준 (team-harness). 주력 도메인은 업무 시스템(SCM·ERP·자동화 — 트랜잭션·정합성·리포팅)이되,
**일반 웹·API·AI/데이터·컨슈머 서비스 등 다양한 시스템**에도 적용한다 — 시스템 성격에 맞는 후보를 택한다.
선택 1순위 기준은 **팀이 익숙한 것**, 그다음 **국내 채용·인력 수급**(팀 확장 전제). 이 문서는 각 후보의 확정 추천 구성과 근거를 제공한다.
"최신 안정화 버전"은 킥오프 시점에 공식 릴리즈 페이지로 재확인한다 (아래 버전은 2026-06 기준).

---

## 백엔드 후보

### 1. Java/Kotlin + Spring Boot ⭐ (업무 시스템·엔터프라이즈 1순위)

| 항목 | 선택 | 근거 |
|---|---|---|
| 언어 | **Java 21 LTS** 기본 / **Kotlin** 적극 검토 | Java=레퍼런스·채용 풀 최다. Kotlin=신규 서비스 표준으로 부상(카카오·토스·배민·당근·오늘의집 채택), null 안전·간결성. Spring은 둘 다 1급 지원 — 팀 선호로 택1 |
| Spring Boot | 최신 안정 (3.5.x / 4.x — 킥오프 시 확인) | |
| ORM | **Spring Data JPA(Hibernate) + QueryDSL** | 레퍼런스 최다·검증 완료. 복잡 동적 쿼리는 QueryDSL |
| 로깅 | **SLF4J + Logback** (Spring 기본) + logstash-logback-encoder(JSON 구조화) | 표준 그 자체 |
| 마이그레이션 | Flyway | 레퍼런스 최다 |
| 테스트 | JUnit5 + AssertJ + Testcontainers(PostgreSQL) | TDD 기본 도구 세트 |

**로컬 Java 21 설치**: `sdk install java 21-amzn` (sdkman) 또는 `brew install --cask amazon-corretto@21` (macOS Homebrew). CI도 동일하게 **Amazon Corretto** 사용(`distribution: corretto`) — 로컬·CI·Docker 이미지 일치 필수.

도메인이 복잡하고 트랜잭션이 무거운 업무 시스템의 업계 표준이자, 국내 백엔드 채용 풀이 가장 넓다(공고 1위). 일반 웹·API 서비스에도 두루 적합. **Kotlin은 신규/대형 서비스에서 빠르게 표준화 중**이라 팀 확장·채용 관점에서도 안전한 선택.
클린 아키텍처 적용 구조는 `clean-architecture.md` 참조.

### 2. Node + NestJS (경량 서비스·풀스택 팀에 적합)

| 항목 | 선택 | 근거 |
|---|---|---|
| Node | **최신 LTS** (24 LTS, 킥오프 시 확인) | |
| ORM | **Prisma** (추천) / TypeORM (레퍼런스 최다 기준이면) | Prisma: 타입 안전·마이그레이션 일체화·운영 경험 보유. TypeORM: NestJS 공식 문서 기본이라 레퍼런스는 더 많음 |
| 로깅 | **nestjs-pino** (추천) / winston (레퍼런스 최다 기준이면) | pino: 구조화 JSON·성능 우위·현 표준 추세 |
| 테스트 | Jest (Nest 기본) + Supertest + Testcontainers | |

### 3-1. Python → **Django**(업무/백오피스) 또는 **FastAPI**(API·AI/데이터)

- **Django (LTS)**: 업무 시스템·백오피스라면 1순위 — admin 화면 무료 제공(개발량 대폭 절감), ORM·인증·마이그레이션 내장, 레퍼런스 최다. 테스트 pytest + pytest-django.
- **FastAPI**: 독립 API 서비스, 특히 **AI/데이터·LLM 연동·벡터DB(pgvector)** 맥락에서 강세(async·고성능·타입 힌트). 국내 수요 상승 중(AI/데이터 직군 확대). 단 인프라가 더 무겁다(web + worker + broker). 테스트 pytest.
- 공통 로깅 structlog(JSON).

### 3-2. Ruby → **Rails 8.x** — 빠른 출시·소팀 생산성 최강, 단 국내 채용은 니치

Rails 8은 1인/소팀 빠른 출시에 현재 최강급이다: **Solid Queue/Cache/Cable**(Redis 없이 DB 백엔드)·**Kamal**(PaaS 없이 단일 서버 Docker 배포)·내장 인증 제너레이터·**Hotwire**(별도 JS 프레임워크 없이 인터랙티브 UI) → "Postgres + 컨테이너 1개"로 풀스택을 Ruby 하나로 끝낸다. 컨벤션+scaffold가 의사결정 비용을 제거하고, 관용+`schema.rb` 덕에 AI 코딩 궁합도 좋다. ActiveRecord·lograge(JSON 로깅)·RSpec.

**트레이드오프 (팀·채용 관점)**: 국내 채용 풀이 가장 좁다(점핏 2025 백엔드 언어 순위에 부재). 당근·오늘의집·마이리얼트립·리멤버·왓챠 등이 코어에 쓰지만, **"빠른 초기 출시 → 스케일·대규모 채용 단계에서 Spring/Node로 부분 전환"**이 국내 전형 패턴(리멤버: 생산성은 인정하나 정적 타입 부재·대규모 채용 위해 Spring 검토). 성숙(정체)기 기술이고 ML/데이터 무거운 워크로드엔 Python 생태계가 낫다. → **팀이 Ruby 숙련 + 빠른 MVP/제품**이 목적이면 적극 추천, **채용 확장·취업 범용성**이 목적이면 Spring/Python을 1순위로 두고 Rails는 보조.

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

- 이미지: ECR / 배포: EC2 단계 = GitHub Actions push형, EKS 단계 = Argo CD pull형 (`architecture-infra.md` GitOps 참조)
- 시크릿: AWS Secrets Manager 또는 SSM Parameter Store — .env 파일을 서버에 두지 않는다
- 에러 트래킹: Sentry / 로그: 구조화 JSON → CloudWatch (EKS 전환 시 수집 파이프라인 재사용)

## 아키텍처·테스트 공통 원칙

- **클린 아키텍처**: adapter → application → domain 의존 방향 강제 (계층 정의·ArchUnit 규칙은 `clean-architecture.md`).
  단, 프레임워크 결에 맞게 조정 — Django/Rails처럼 ActiveRecord 패턴이 기본인 프레임워크에
  레이어를 과하게 강제하면 프레임워크 장점을 죽인다 (Spring/NestJS는 정석 적용).
- **TDD 기본**: 도메인 로직 단위 테스트 우선, DB 의존 테스트는 Testcontainers로 실제 DB 사용.
  CI 게이트(ci-gate.yml)가 테스트 통과를 강제한다.
- 공통 응답/에러 포맷(`api-standards.md` 확정), 감사 로그(`db-standards.md` — ERP 필수),
  인증·인가(`auth-standards.md` — Keycloak 확정)는 표준이 이미 확정돼 있다 —
  스택 확정 후 해당 스택 스캐폴드에 **구현만** 구체화한다.

## 권장 기본 조합 (팀 익숙함이 동률일 때)

> **Java/Kotlin 21 + Spring Boot + JPA/QueryDSL + React/Next.js + PostgreSQL + GitHub + EC2(Docker)→EKS**

업무 시스템·엔터프라이즈의 표준 조합이고, 국내 채용·레퍼런스 모두 최적. (빠른 MVP·소팀 제품이면 Rails 8, AI/데이터 API면 FastAPI도 합리적 선택 — 시스템 성격에 따라.)

---

스택이 확정되면 이 repo에 해당 스택의 스캐폴드를 추가한다:
AGENTS.md 빌드/테스트 명령 구체화, ci-gate.yml 실제 단계 교체, 스택 전용 가드
(예: Java — 테스트 스킵·prod 프로파일 로컬 실행·마이그레이션 파일 삭제 차단).

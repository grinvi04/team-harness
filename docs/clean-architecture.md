# 클린 아키텍처 적용 표준

`architecture-infra.md` §2(모듈러 모놀리스 → 미니서비스)의 코드 레벨 구현 표준.
**1차 경계 = 도메인 모듈, 2차 경계 = 모듈 내부 계층.** 계층만으로 자르면 미니서비스 분리 시
경계가 없다 — 도메인을 먼저 자르고, 그 안에 클린 아키텍처를 적용한다.

---

## 1. 구조 (Java/Spring 기준)

```
com.company.erp
├── shared/                    # 공통 커널 — 최소한만 (공통 VO, 이벤트 발행 인터페이스)
├── order/                     # 도메인 모듈 = 미래의 미니서비스 후보
│   ├── domain/                # 엔티티·VO·도메인 서비스·도메인 이벤트
│   ├── application/           # 유스케이스 + 포트 인터페이스 (in/out)
│   ├── adapter/
│   │   ├── in/web/            # REST 컨트롤러 (DTO ↔ 도메인 매핑은 여기서)
│   │   └── out/persistence/   # JPA 리포지토리 (out 포트의 구현체)
│   └── api/                   # 타 모듈에 공개하는 유일한 창구
├── inventory/  (동일 구조)
├── settlement/ (동일 구조)
└── master/     (동일 구조)
```

**의존 규칙**
- 모듈 내부: `adapter → application → domain` (안쪽으로만). domain은 어떤 adapter도 모른다.
- 모듈 간: 상대 모듈의 **`api/` 인터페이스 또는 도메인 이벤트로만** 통신.
  타 모듈의 `domain`/`application`/`adapter` 직접 import 금지 — 이걸 어기는 순간
  미니서비스 분리가 불가능해진다.
- `shared`는 비대해지는 순간 사실상 전역 결합이 된다 — 추가는 리뷰에서 엄격 심사.

## 2. 실용적 절충 (순수주의 배제)

1. **JPA 엔티티 = 도메인 엔티티 겸용으로 시작.** 매핑 분리(도메인 모델 ↔ JPA 엔티티)는
   교과서적으로 옳지만 초기 팀 규모에선 비용 과다. `jakarta.persistence` 어노테이션
   침투까지만 허용하고 도메인 로직은 엔티티·도메인 서비스에 둔다.
   도메인이 충분히 복잡해진 모듈(예: 정산)만 선별적으로 매핑 분리.
2. **CQRS·이벤트소싱 도입 안 함.** 복잡 조회는 application에 Query 서비스를 두고
   QueryDSL로 직행 — 쓰기 경로만 클린 아키텍처를 엄격 적용한다.

## 3. 경계 강제 수단 (규율은 도구로)

| 경계 | 강제 수단 | 강도 |
|---|---|---|
| 도메인 모듈 간 | **Gradle 서브프로젝트** 분리 — 직접 참조가 컴파일 에러 | 가장 강함 |
| 모듈 내부 계층 | 패키지 + **ArchUnit 테스트** ("domain은 adapter를 import 불가") — ci-gate가 실행 | CI 강제 |
| DB | 모듈별 **스키마 분리 + 크로스 스키마 조인 금지**, Flyway 마이그레이션도 모듈별 디렉토리 | 리뷰 + 가드 |

사람 리뷰에 의존하지 않는다 — 어기면 컴파일이나 CI가 깨지게 만든다.

## 4. TDD 결합 — 계층이 곧 테스트 전략

| 계층 | 테스트 | 특성 |
|---|---|---|
| domain | 순수 JUnit 단위 테스트 | 프레임워크 무의존·ms 단위 — **TDD 루프의 주 무대** |
| application | 유스케이스 테스트 (포트 mock) | 빠름 |
| adapter | 슬라이스 테스트 — `@WebMvcTest`, `@DataJpaTest` + Testcontainers(실DB) | 느림·적게 |
| 경계 | ArchUnit | 의존 규칙 회귀 방지 |

원칙: 안쪽일수록 빠르고 많게, 바깥쪽일수록 적게.

## 5. 모듈 → 미니서비스 분리 시점의 작업

모듈 경계를 §1~3대로 지켰다면 분리는 기계적 작업이 된다:
1. Gradle 서브프로젝트를 새 repo로 복사 (domain/application/adapter 그대로)
2. `api/` 인터페이스 호출부 → REST 클라이언트/이벤트 소비자로 치환
3. 해당 스키마를 새 DB(또는 동일 인스턴스 유지)로 — 크로스 스키마 조인이 없으므로 이관 단순
4. Spring 이벤트 → SQS/SNS 치환 (발행 인터페이스는 shared에 이미 추상화되어 있음)

## 6. 스택별 변형

- **NestJS**: 같은 모양 — Nest 모듈 = 도메인 모듈, 내부 domain(순수 TS)/application(유스케이스+포트)/
  adapter(controller·Prisma 구현). 경계 강제는 **dependency-cruiser**가 ArchUnit 역할.
- **Django/Rails**: 레이어 강제 완화 (`stack-guide.md` 공통 원칙 참조) — ActiveRecord 패턴에
  포트/어댑터를 풀로 강제하면 프레임워크 장점이 죽는다. 도메인 모듈(app/engine) 경계와
  "뷰·컨트롤러에 비즈니스 로직 금지" 수준으로 조정.
- **프론트엔드(React/Next)**: 클린 아키텍처 적용 대상 아님 — feature 단위 구조
  (`features/<도메인>/` + 공용 `shared/`)로 충분.

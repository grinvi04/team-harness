# 백엔드 문제 해결과 운영 패턴

[적용 기준](standards-scope.md)을 따른다. 아래는 진단 경로다. 소비 앱에서 모두 재현한 결과는 아니다.
환경·버전·실패 로그를 먼저 확인하고, 실제 해결 결과는 해당 프로젝트 이슈·PR에 남긴다.

## Java·Spring·Hibernate

| 증상 | 먼저 확인할 것 | 대응과 확인 |
|---|---|---|
| 잘못된 입력이 500으로 응답 | 기본 resolver와 커스텀 포괄 핸들러의 우선순위 | 요청 오류와 서버 검증 오류를 나눠 실제 상태·본문 검사 |
| mock·메모리 DB는 통과, 실제 DB는 실패 | SQL 방언·제약·시간대·마이그레이션 | 격리된 실제 DB 테스트로 오류·거부·경계 확인 |
| 수정 직후 같은 version으로 다시 저장하면 충돌 | DTO 생성과 ORM flush·커밋 순서 | 성공 커밋 뒤의 버전을 반환하고 연속 수정·실제 동시 충돌 확인 |
| 삭제된 데이터가 보임 | 필터의 적용 대상과 native SQL·집계 경로 | 채택한 삭제 정책으로 읽기·쓰기·복원을 함께 확인 |
| 목록 조회가 느림 | 쿼리 수·연관 조회·페이지 크기·실행 계획 | 필요한 조회 전략을 비교하고 데이터 증가 시 검증 |

공식 기준: [Spring 기본 오류 처리](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/support/DefaultHandlerExceptionResolver.html),
[Hibernate 사용자 안내](https://docs.jboss.org/hibernate/orm/current/userguide/html_single/Hibernate_User_Guide.html),
[Testcontainers 통합 테스트](https://docs.docker.com/guides/testcontainers-java-spring-boot-rest-api/).
Hibernate 버전과 필터 종류에 따라 지원 범위가 다르다. 특정 상속 동작을 모든 버전의 사실로 일반화하지 않는다.
Testcontainers는 조건부 테스트 도구다. 컨테이너 실행 환경과 실제 프로젝트의 검사 연결이 필요하다.

## Node·TypeScript·NestJS

| 증상 | 먼저 확인할 것 | 대응과 확인 |
|---|---|---|
| 타입 검사는 통과했는데 외부 응답에서 오류 | 런타임 값과 선언 타입의 차이 | 외부 경계에서 검증하고 잘못된 입력·배열/페이지 객체 검사 |
| 긴 작업 중 다른 요청이 지연 | 동기 계산·I/O와 이벤트 루프 점유 | 계산 작업의 worker 분리, 지속 작업의 큐를 조건별 검토 |
| 큐 작업이 두 번 처리됨 | 재시도·ACK 유실·worker 중단 | 업무 키·저장 제약으로 중복 효과를 막고 재시작 검증 |

공식 기준: [NestJS 검증](https://docs.nestjs.com/techniques/validation),
[Node 이벤트 루프](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop),
[NestJS 큐](https://docs.nestjs.com/techniques/queues).
큐를 쓰면 무조건 문제가 해결되는 것은 아니다. 작업 저장과 업무 DB 쓰기의 일관성도 확인한다.

## Python·FastAPI·Django

| 증상 | 먼저 확인할 것 | 대응과 확인 |
|---|---|---|
| async 요청 중 전체 응답이 느려짐 | 동기 DB·HTTP 호출을 이벤트 루프에서 실행하는가 | 동기 경로·thread offload·비동기 드라이버 중 맞는 방식 선택 |
| 동시 작업에서 DB 세션 오류 | 하나의 AsyncSession을 여러 task가 공유하는가 | task별 세션과 트랜잭션 수명을 정하고 동시 요청 검사 |
| FastAPI 테스트의 의존성 교체가 적용 안 됨 | Depends에 등록된 정확한 callable과 import 경로 | dependency_overrides 또는 실제 조회 지점 교체, 종료 후 복구 |
| Django 목록에서 쿼리 수가 급증 | lazy 관계 조회와 필요한 필드 | select_related/prefetch_related를 선택하고 쿼리 수 측정 |

공식 기준: [FastAPI 동기·비동기](https://fastapi.tiangolo.com/async/),
[의존성 테스트](https://fastapi.tiangolo.com/advanced/testing-dependencies/),
[SQLAlchemy 세션 수명](https://docs.sqlalchemy.org/en/20/orm/session_basics.html),
[Django 조회 최적화](https://docs.djangoproject.com/en/5.2/topics/db/optimization/).
패키지 설치 실패를 특정 Mac의 라이브러리 경로로 일괄 해결하지 않는다. 실패 패키지·CPU·OS를 먼저 확인한다.

## Ruby·Rails

| 증상 | 먼저 확인할 것 | 대응과 확인 |
|---|---|---|
| 조회 화면의 쿼리 수가 증가 | association의 lazy loading | 필요한 eager loading을 적용하고 쿼리 수 검사 |
| 배포 중 DB 쓰기가 오래 멈춤 | DDL 잠금·테이블 크기·트랜잭션 | 단계적 변경·데이터 이관과 잠금 제한을 검토 |
| 포맷 자동 수정 뒤 동작 변경 | RuboCop cop의 안전성 분류 | 안전한 수정부터 적용하고 위험 수정은 diff·회귀 검사 |

공식 기준: [ActiveRecord 조회](https://guides.rubyonrails.org/active_record_querying.html),
[RuboCop 안전 자동 수정](https://docs.rubocop.org/rubocop/usage/autocorrect.html).
[Strong Migrations](https://github.com/ankane/strong_migrations)는 안전하지 않은 변경을 찾는 커뮤니티 도구 후보다.
채택한다면 DB·Rails 버전·검사 범위를 확인한다. 예외 선언은 운영 권한이나 안전 증명이 아니다.

## 여러 스택에서 재사용할 패턴

- 외부 쓰기 재시도: [멱등 API](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)를 참고한다.
  같은 키의 동시 요청·다른 payload·저장 성공 뒤 응답 유실을 검사한다.
- DB와 메시지 동시 처리: [Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html)를 검토한다.
  메시지 중복·전달 지연·publisher 복구·보관 비용이 남는다. 실제 이중 쓰기 문제가 있을 때 선택한다.
- 스키마 호환 변경: [DB 안내](stack-troubleshooting-database.md)를 따른다.

위 자료는 패턴과 도구의 근거다. 사용 빈도를 측정한 자료가 아니므로 업계 전체의 필수 표준으로 부르지 않는다.

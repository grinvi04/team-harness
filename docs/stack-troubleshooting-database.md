# DB·마이그레이션 문제 해결과 운영 패턴

[적용 기준](standards-scope.md)을 따른다. 운영 접근·복사·파괴 명령을 자동으로 허용하지 않는다.
승인된 격리 DB와 합성 데이터에서 검증하고 실행한 범위를 기록한다.

## PostgreSQL

| 증상 | 먼저 확인할 것 | 대응과 확인 |
|---|---|---|
| 교착 상태 | 트랜잭션의 잠금 순서·길이와 오류 코드 | 일관된 순서·짧은 트랜잭션, 필요한 경우 전체 트랜잭션 재시도 |
| DDL 중 쓰기가 지연 | 대기 잠금·테이블 크기·실행 트랜잭션 | 잠금 영향·제한·실패 후 상태를 격리 DB에서 확인 |
| 병렬 테스트만 실패 | 공유 cleanup·seed·schema | worker별 격리 또는 해당 suite 직렬 실행 |
| 소프트 삭제 후 UNIQUE 충돌 | 복원 정책·삭제된 행의 제약 | 조건부 unique index 등 제품 정책에 맞는 방법 선택 |
| 금액 왕복 뒤 값이 달라짐 | DB→ORM→JSON→클라이언트의 변환 | [금액 계약](db-standards.md#금액-저장전송-계약)대로 정확한 경계값 확인 |

공식 기준: [잠금·교착](https://www.postgresql.org/docs/current/explicit-locking.html),
[동시 인덱스 생성](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY),
[partial index](https://www.postgresql.org/docs/current/indexes-partial.html).
재시도는 실패한 문장만이 아니라 트랜잭션 전체의 효과·외부 호출·중복을 검토한다.
CONCURRENTLY도 잠금·실패 위험이 없지는 않으며 트랜잭션 블록 제한이 있다.

## Flyway

checksum 실패는 적용 이력과 파일 원본을 비교한다. 기존 파일을 바꾸거나 clean으로 덮지 않는다.
늦게 합쳐진 낮은 버전은 기존 DB의 적용 이력에서 확인한다. 빈 DB의 전체 적용만으로 검사하지 않는다.
outOfOrder의 기본값은 false다. true는 낮은 버전도 적용하게 할 뿐 순서 독립성을 보장하지 않는다.
순서에 무관한지 검토하고, 전체 이력 재적용과 기존 상태의 증분 적용 결과를 비교한 뒤 결정한다.
타임스탬프 파일명도 늦게 병합된 변경의 의존·순서 문제를 자동 해결하지 않는다.

공식 기준: [outOfOrder](https://documentation.red-gate.com/fd/flyway-out-of-order-setting-277579015.html),
[뒤늦은 낮은 버전의 처리](https://www.red-gate.com/hub/product-learning/flyway/how-to-fix-or-avoid-ignored-migrations-in-flyway/).
현재 Harness의 번호 검사는 config 선언과 번호 패턴을 읽는 정적 검사다.
모듈 독립성·실제 데이터·SQL 실행 순서를 증명하지 않는다. 규약 수정과 실제 검사 변경을 혼동하지 않는다.

## Prisma

개발용 `migrate dev`와 운영용 `migrate deploy`를 구분한다. 자동 배포 실행은 프로젝트에서 별도로 연결한다.
미적용 초안은 검토·수정할 수 있다. 공유·적용된 이력은 원본을 보존한다.
`migrate resolve --rolled-back`은 실패한 이력의 표시를 바꾼다. 이미 실행한 SQL을 되돌리는 명령이 아니다.
실행된 변경·남은 변경·데이터 영향을 먼저 확인하고 복구 또는 보정 계획을 세운다.
`migrate reset`은 데이터를 삭제하므로 진단의 기본 행동으로 사용하지 않는다.
연결 고갈은 실행 환경·worker 수·client 생성·pool 설정을 함께 확인한다.

공식 기준: [운영 복구](https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing),
[미적용 변경 편집](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations),
[연결 관리](https://docs.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-management).
소프트 삭제 extension은 nested write·관계 조회·raw SQL을 자동 보호하는지 별도로 확인한다.

## Alembic

autogenerate는 후보를 만든다. rename·제약·데이터 이관은 사람이 검토하고 필요한 내용을 추가한다.
다중 head는 의도한 분기인지 병합 누락인지 확인한다. 연결 관계만 합쳐도 데이터 충돌이 해결되지는 않는다.
단일 head를 채택한 프로젝트는 실행 실패·0개·여러 개도 검사한다. 실행 실패를 빈 출력의 성공으로 바꾸지 않는다.
`downgrade`는 실제 데이터를 잃을 수 있으므로 실패 시 첫 대응으로 자동 실행하지 않는다.

공식 기준: [자동 생성 한계](https://alembic.sqlalchemy.org/en/latest/autogenerate.html),
[분기·병합](https://alembic.sqlalchemy.org/en/latest/branches.html).
현재 설정된 CI의 heads 검사가 어떤 경우에 실패·비적용으로 처리되는지 확인한다.

## Rails·ActiveRecord

생성한 migration을 적용 전 검토한다. 큰 테이블의 backfill과 DDL은 잠금·처리량을 확인한다.
적용한 파일의 수정으로 운영 이력을 바꾸지 않는다. 복구는 데이터 영향과 기존 권한에 맞춰 계획한다.
[Rails migration](https://guides.rubyonrails.org/active_record_migrations.html)과
[Strong Migrations](https://github.com/ankane/strong_migrations)의 지원 DB·버전·검사 범위를 확인한다.
도구의 안전 예외는 검토 결과를 표시할 뿐 사용자 승인이나 실제 운영 안전의 증거가 아니다.

## 공통 운영 패턴

[Expand–Migrate–Contract](https://martinfowler.com/bliki/ParallelChange.html)는 호환 변경을 나누는 패턴이다.
새 구조 추가 → 데이터 이관·동시 쓰기 검증 → 구버전 사용 종료 확인 → 이전 구조 제거 순서로 진행한다.
모든 변경에 양쪽 쓰기가 필요한 것은 아니다. 충돌·실패 복구·제거 시점을 제품에 맞춰 정한다.
앱 롤백은 DB 복구와 별개다. 롤백 후보가 현재 스키마와 데이터를 처리할 수 있는지 확인한다.
정적 DDL 검사는 모든 잠금·동적 SQL·정보 손실을 검사하지 않는다.

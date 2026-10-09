# DB 설계·감사 표준

[표준 적용 기준](standards-scope.md)을 따른다. PostgreSQL 예시는 해당 DB를 선택한 경우에만 적용한다.
식별자·감사·삭제·모듈 소유권은 제품 요구로 정한다.

## 네이밍

아래는 신규 SQL schema의 권장 예시다. 기존 규약과 프레임워크 기본을 보존한다.

- 모든 식별자 **snake_case**, 예약어 회피
- 테이블 이름은 프레임워크와 기존 schema 규약을 따른다. ORM 종류만으로 단수·복수를 강제하지 않는다.
- FK 컬럼: `{참조테이블}_id` (`order_id`), boolean: `is_` 접두 (`is_active`)
- 인덱스/제약: `ix_{table}_{cols}`, `uq_{table}_{cols}`, `fk_{table}_{ref}`, `ck_{table}_{rule}`

## 기본키와 외부 식별자

BIGINT identity, UUID 등은 데이터 생성 위치·병합·인덱스·외부 계약으로 선택한다.
자동 증가 키만으로 서로 다른 DB의 식별자 충돌이 방지되지는 않는다.
외부 식별자는 안정성·민감도·조회 방식을 정한다. 업무 채번 규칙은 해당 프로젝트에 둔다.
식별자가 숨겨졌거나 추측하기 어려워도 서버 권한 검사가 필요하다.

## 공통 컬럼

생성·수정 시각과 변경 주체는 추적이 필요한 데이터에 정의한다.
자동 주입을 쓴다면 사용자 요청·배치·외부 연동에서 실제 값이 기록되는지 확인한다.
시스템 계정, 서비스 주체와 사용자 주체의 표현은 제품에서 정한다.
실제 시점을 저장할 때 시간대와 정밀도를 명시한다. 일정의 지역 시각과 날짜만 있는 값은 별도로 계약한다.

## 데이터 타입 규칙

| 용도 | 타입 | 금지 |
|---|---|---|
| 정확한 금액·십진 수량 | `numeric(p,s)` — 정밀도는 도메인 정의 | 부동소수 변환으로 정확한 값 손실 |
| 코드성 값 | CHECK·참조 테이블·enum 중 변경 방식에 맞게 선택 | 앱 타입만으로 DB 값 검증을 보장하는 가정 |
| 유연 속성 | PostgreSQL의 `jsonb`는 검색·제약·변경 단위를 검토해 선택 | 자료 구조를 검토하지 않은 저장 형식 선택 |

### 금액 저장·전송 계약

- `numeric(p,s)`의 p/scale·허용 범위와 통화·단위를 도메인에서 정한다. 비유한 값은 업무 금액으로 허용하지 않는다.
  PostgreSQL은 지정 scale 초과 값을 반올림한 뒤 범위 초과를 오류로 처리하고, numeric의 정확한 tie는 0에서 멀어지는 쪽으로 반올림한다.
  앱의 반올림 모드·시점(항목/세금/합계), 초과 자릿수 거부 또는 반올림 정책과 대조한다.
  [PostgreSQL numeric](https://www.postgresql.org/docs/18/datatype-numeric.html#DATATYPE-NUMERIC-DECIMAL)은 저장·계산 계약이며 클라이언트 보장이 아니다.
- ORM/드라이버 decimal → JSON → 클라이언트 파싱/연산 → 재전송 → DB까지 표현을 명시한다.
  정확한 십진 값은 decimal 문자열이나 단위/scale이 있는 최소 화폐 단위 정수로 전송한다.
  JSON number는 클라이언트와 중간 연산까지 안전한 제한된 범위만 허용한다 ([API 금액 계약](api-standards.md#필드데이터-포맷)).
  DB 값을 먼저 float/double로 바꾼 뒤 문자열로 감싸도 잃은 정밀도는 복구되지 않는다.
- 허용 최대/최소·음수·0·scale 초과·반올림 tie·합계 초과를 정확한 기대값과 비교한다.
  실제 DB/직렬화/지원 클라이언트 경계를 통과시켜 저장값·전송값·재전송값을 대조한다.
  DB 컬럼 선언이나 JavaScript 숫자 표본만으로 그 전체 경계를 통과했다고 보고하지 않는다.

## 삭제 정책

보존·복구·참조 무결성·파기 요구에 따라 물리 삭제, 비활성화, 소프트 삭제를 선택한다.
소프트 삭제를 쓰면 목록·단건·집계·수정·직접 SQL에서 제외 정책을 확인한다.
복원과 UNIQUE 제약의 관계도 정한다. PostgreSQL의 partial unique index는 선택지다.
필터를 상위 모델에 선언한 사실만으로 모든 경로에 적용됐다고 판단하지 않는다.
기간·파기 기준·업무 전표의 보존은 해당 프로젝트에서 정한다.

## 감사(Audit Trail)

권한 변경처럼 변경 추적이 필요한 대상을 지정한다. 모든 테이블에 같은 감사 모델을 강제하지 않는다.
변경 주체·시각·내용·실패 처리를 정하고 이력의 변조·삭제 권한을 제한한다.
Hibernate Envers나 별도 이력 저장은 선택지다. 프레임워크 밖의 쓰기도 추적되는지 확인한다.
감사 기능 도입을 법적 요건 충족이나 전체 보안 검증으로 보고하지 않는다.

## 마이그레이션

- 공유·운영 이력은 적용한 파일을 고치지 않고 새 변경으로 보정한다.
  운영 downgrade는 자동 해결책이 아니다. 복구 가능성·데이터 영향·기존 권한을 확인한다.
- 이름·경로·적용 순서는 선택한 도구와 프로젝트 규약을 따른다.
- 적용된 마이그레이션 파일은 **수정 금지** (체크섬 깨짐) — 고치려면 새 버전
- 무중단 호환 규칙: 컬럼 삭제·rename은 단계적으로 배포
  (확장 → 데이터 이관·검증과 구버전 사용 종료 → 제거). 양쪽 기록의 실패·동시 쓰기도 검증한다.
  [Expand–Migrate–Contract](https://martinfowler.com/bliki/ParallelChange.html)를 조건부 패턴으로 참고한다.
- PostgreSQL의 큰 테이블은 동시 인덱스 생성을 검토한다. 트랜잭션 제한·실패 상태도 확인한다.
- **CI(빈 DB) ≠ 운영(기존 DB)**: CI는 마이그레이션을 빈 DB에 순서대로 적용해 통과하지만, 기존·운영
  DB는 이미 일부 적용된 상태라 다른 실패가 난다. 마이그레이션 변경은 "기존 DB에 증분 적용" 관점으로
  검증한다. 승인된 격리 DB와 합성 데이터를 사용하며 운영 접근·스냅샷 복사를 자동 요구하지 않는다.
- 모듈별 번호 대역이나 병렬 브랜치는 이미 적용된 것보다 낮은 버전을 만들 수 있다.
  도구마다 처리 방식이 다르므로 실패 상태와 설정 기본값을 먼저 확인한다.
  Flyway의 out-of-order 허용은 기본 규칙이 아니다. 실제 적용 순서와 정렬 순서 양쪽에서
  스키마·데이터 결과가 같은지 격리 DB로 확인한 경우에만 검토한다.
  [DB 문제 해결](stack-troubleshooting-database.md)에 진단·대안·검증 조건을 정리했다.
- **파괴 DDL 정적 게이트(CI)**: 비가역 데이터-손실 DDL은 CI(빈 DB)는 통과하고 운영에서만 손실을 낸다 —
  연결된 정적 검사는 알려진 구문을 배포 전에 차단한다. 모든 손실·잠금 위험을 해석하지는 않는다. **SQL**(Flyway·Prisma·Supabase의 `*.sql`)은 `check-destructive-ddl.mjs`가,
  **Alembic `.py`**(`op.drop_table`·`op.drop_column`·`op.execute` 내 DROP)는 `check-alembic-destructive-ddl.mjs`가
  `upgrade()` 본문을, **ActiveRecord `db/migrate/*.rb`**(`drop_table`·`drop_join_table`·`remove_column(s)`·
  `execute` 계열 raw DROP/TRUNCATE)는 `check-activerecord-destructive-ddl.mjs`가 `def change`/`def up` 본문을
  검사한다(정상 마이그레이션의 `downgrade()`/`def down` 역방향 파괴는 오탐이라 비대상). forward-only 단계적
  배포의 정당한 컬럼 제거는 파괴 문장과 같은 문장(또는 바로 앞 줄)의 승인마커로 통과 — SQL은
  `-- migration-safety: destructive-ok`, Alembic·ActiveRecord는 `# migration-safety: destructive-ok`.

## 테스트 격리

- **공유 DB e2e/통합 테스트는 워커별 스키마/트랜잭션으로 격리하거나 직렬 실행한다.** 전역
  `cleanDb`/`deleteMany`/`TRUNCATE`를 병렬 워커가 동시에 돌리면 스위트 간 레이스(한 워커가 다른
  워커의 시드 데이터를 지움)로 비결정적 실패가 난다. 워커마다 별도 스키마(또는 별도 DB)를 쓰거나,
  테스트별 트랜잭션 롤백으로 격리하고, 그게 불가하면 격리 대상 스위트를 직렬(`--runInBand` 등)로 돌린다.

## 기타

- 목록 조회는 쿼리 수와 실제 계획을 확인한다. 필요한 fetch·projection 전략을 선택한다.
- 트랜잭션은 하나의 일관된 변경 단위로 정한다. 선택한 프레임워크·구조의 경계를 명시한다.
- 운영 DB 직접 DML 금지 — 데이터 보정도 마이그레이션 또는 관리 화면 경유

현재 정적 DDL 검사는 Python 한 줄 upgrade·Ruby 탭 호출·ALTER TABLE의 COLUMN 생략/인용 식별자도 검사한다.
ORM raw SQL의 MySQL 실행 주석은 실행 구문으로 취급한다. 동적 SQL·helper의 전체 동작을 해석하지는 않는다.
Alembic 설정이 없을 때만 heads 검사는 비적용이다. 설정이 있는 repo의 설치/heads 실행 실패는 CI 실패다.

도구별 진단·설정·검사 한계는 [DB 문제 해결](stack-troubleshooting-database.md)을 따른다.

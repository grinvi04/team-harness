# DB 설계·감사 표준

PostgreSQL 기준 (`stack-guide.md` DB 결정 참조). 모듈별 스키마 분리·크로스 스키마 조인 금지는
`architecture-infra.md` §2, `clean-architecture.md` §3이 상위 규칙.

## 네이밍

- 모든 식별자 **snake_case**, 예약어 회피
- 테이블명: **단수** (`purchase_order`) — JPA 기준. Django/Rails 스택은 프레임워크 기본(복수) 유지
- FK 컬럼: `{참조테이블}_id` (`order_id`), boolean: `is_` 접두 (`is_active`)
- 인덱스/제약: `ix_{table}_{cols}`, `uq_{table}_{cols}`, `fk_{table}_{ref}`, `ck_{table}_{rule}`

## 기본키 (확정)

```sql
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

- **내부 PK = BIGINT 자동증가.** 조인·인덱스 성능 최적, 모듈별 스키마가 분리되어 있어
  미니서비스 분리 시에도 충돌 없음
- **외부 노출 식별자는 별도 채번**: `order_no VARCHAR UNIQUE` (예: `ORD-2026-000123`) —
  URL·화면·연동에는 채번 코드만, 내부 `id`는 노출하지 않는다
- 채번 규칙(프리픽스-연도-시퀀스)은 기준정보 모듈에서 중앙 관리

## 공통 컬럼 (모든 업무 테이블 필수)

```sql
created_at  timestamptz NOT NULL DEFAULT now(),
created_by  BIGINT      NOT NULL,            -- 사용자 id
updated_at  timestamptz NOT NULL DEFAULT now(),
updated_by  BIGINT      NOT NULL
```

- 애플리케이션 공통 레이어(JPA Auditing 등)에서 자동 주입 — 수동 세팅 금지
- 시각 타입은 **timestamptz 통일** (naive timestamp 금지), 저장은 UTC
- **비대화형 쓰기(배치·스케줄러·외부 연동 수신)**: `created_by`/`updated_by`에는 기준정보에
  시드된 **시스템 사용자 id**를 사용한다 (`system-batch`, `system-integration` 등 작업 유형별 분리).
  NULL 허용으로 풀지 않는다 — "주체 없는 변경"을 만들지 않는 것이 감사 원칙

## 데이터 타입 규칙

| 용도 | 타입 | 금지 |
|---|---|---|
| 금액·수량 | `numeric(p,s)` — 정밀도는 도메인 정의 | `float`/`double` 절대 금지 |
| 코드성 값 | `varchar` + CHECK 또는 앱 enum | DB enum 타입(변경 비용 큼) |
| 유연 속성 | `jsonb` (스키마 없는 부가정보 한정) | 핵심 업무 컬럼의 jsonb화 |

## 삭제 정책

- **업무 전표 데이터**(주문·전표·이력): 물리 삭제 금지 → `deleted_at timestamptz NULL` soft delete
  - soft delete + UNIQUE 충돌은 **partial unique index**로 해결:
    `CREATE UNIQUE INDEX uq_x ON t(col) WHERE deleted_at IS NULL`
  - soft delete 필터는 **모든 대상 엔티티/모델에 실제로 적용되는지 테스트로 검증**한다 — ORM에 따라
    베이스·상위 타입에만 필터를 선언하면 하위 타입에는 적용되지 않을 수 있다. 실제 삭제 후
    목록·조회·집계에서 제외되는지 단언하는 테스트를 둔다 (ORM별 상속 함정은 스택 룰 파일 참조)
- **기준정보(마스터)**: 삭제 대신 `is_active` 비활성화 (참조 무결성 보존)
- 물리 삭제는 개인정보 파기 등 법적 요건에만, 절차 문서화 후

## 감사(Audit Trail) — ERP 컴플라이언스 필수

- 대상: 전표·금액·권한·기준정보 등 **변경 추적이 필요한 모든 테이블** (모듈 설계 시 지정)
- 방식: 애플리케이션 레벨 이력 — JPA는 **Hibernate Envers**(`{table}_aud` 자동 생성),
  타 스택은 `{table}_history` 테이블 + 변경 시 insert
- 기록 내용: 변경 전후 값, 변경자(인증 사용자 → 자동 전파), 변경 시각, 변경 유형(C/U/D)
- 감사 테이블은 UPDATE/DELETE 금지 (append-only)

## 마이그레이션 (Flyway 기준)

- **forward-only**: 되돌릴 때도 새 버전 추가 — down/rollback 스크립트 작성·실행 금지
- 파일: `V{번호}__{설명}.sql`, **모듈별 디렉토리** (`db/migration/order/...`)
- 적용된 마이그레이션 파일은 **수정 금지** (체크섬 깨짐) — 고치려면 새 버전
- 무중단 호환 규칙: 컬럼 삭제·rename은 2단계 배포
  (1차: 신규 컬럼 추가 + 양쪽 기록 → 2차: 구 컬럼 제거)
- 대용량 테이블 인덱스 생성은 `CREATE INDEX CONCURRENTLY`
- **CI(빈 DB) ≠ 운영(기존 DB)**: CI는 마이그레이션을 빈 DB에 순서대로 적용해 통과하지만, 기존·운영
  DB는 이미 일부 적용된 상태라 다른 실패가 난다. 마이그레이션 변경은 "기존 DB에 증분 적용" 관점으로
  검증한다(실 DB 재기동 또는 prod 스냅샷 대상)
- **도메인·모듈별 번호(또는 브랜치) 규약은 구조적 out-of-order를 만든다**: 모듈별로 번호 대역을
  나누거나 브랜치별로 마이그레이션을 만들면, 새 항목이 이미 적용된 것보다 낮은 버전이 되어 **구조적
  out-of-order**가 발생한다. 마이그레이션 도구가 이를 거부하면(기본값인 경우가 많다) 기존·운영 DB의
  기동·배포가 validate 실패로 막힌다 — CI는 빈 DB라 순서대로 통과하므로 드러나지 않는다. 모듈별
  마이그레이션이 서로 독립이면(적용 순서가 무관하면) **도구의 out-of-order 허용을 켠다**(구체 설정명은
  스택 룰 파일 참조). forward-only는 그대로 유지

## 기타

- N+1 방지: 목록 조회는 fetch 전략 명시 (QueryDSL projection 권장)
- 트랜잭션 경계는 application 유스케이스 단위 (`clean-architecture.md`) — 컨트롤러/리포지토리에서 열지 않는다
- 운영 DB 직접 DML 금지 — 데이터 보정도 마이그레이션 또는 관리 화면 경유

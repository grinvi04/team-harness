---
paths: ["**/resources/db/migration/**"]
---

# Flyway 마이그레이션 작업 규칙

## 마이그레이션 안전 순서
```bash
# 새 파일: V{N}__{설명적인_이름}.sql (버전 번호 순서 확인 필수)
cd backend && ./gradlew bootRun  # Flyway 자동 적용
cd backend && ./gradlew test
```

## 절대 금지
- **기존 마이그레이션 파일 직접 수정** — checksum 불일치로 기동 불가
- **버전 번호 역행** — 건너뜀은 허용, 역행은 금지 (단, 접두사 번호 규약 + `out-of-order: true`에서는
  모듈별 마이그레이션이 독립이라 새 저접두사가 이미 적용된 고접두사보다 낮은 것은 정상 — 아래 운영 안전)
- `spring.flyway.clean-on-validation-error=true` — 운영 DB 전체 삭제 위험

## 마이그레이션 실패 시
- checksum 불일치: `flyway_schema_history` 확인 후 수정된 파일 복원
- 운영 데이터 보호 원칙: 컬럼 즉시 삭제/rename 금지 → deprecate 후 다음 릴리즈에 제거

## 운영 안전 (단일 출처: `docs/db-standards.md`)
- **새 프로젝트는 `spring.flyway.out-of-order: true`로 시작** (born-correct): 접두사/모듈 번호 규약을 쓸
  가능성이 높고, 나중에 켜면 이미 기동 불가가 한 번 터진 뒤다. 처음부터 켠다.
- **접두사 번호 규약 → `out-of-order: true` 전제**: 새 저접두사가 이미 적용된 고접두사보다 버전이 낮아
  구조적 out-of-order. `false`면 기존·운영 DB가 validate 실패로 기동 불가(CI는 빈 DB라 통과).
- **정적 게이트**: `scripts/check-migration-safety.mjs`(CI `migration-safety`)가 대역 번호 + out-of-order
  미설정/`false`를 결정적으로 차단한다 — 이 함정을 prose가 아니라 기계가 잡는다. 이 게이트는 **Flyway
  전용**(`V###__….sql` 명명만 검출)이다. Prisma/Supabase는 타임스탬프 명명이라 구조적으로 단조(안전),
  Alembic은 다중 head(분기 미머지)가 위험이라 별도 CI 점검(`alembic.md`) 소관 — Flyway가 아니면 정직하게 skip한다.
- **CI(빈 DB) ≠ 운영(기존 DB)**: 마이그레이션 변경은 "기존 DB 증분 적용" 관점으로 검증(실 DB 재기동/prod 스냅샷).

---
paths: ["backend/prisma/**", "backend/src/**/*.ts"]
---

# Prisma 작업 규칙

## 마이그레이션 안전 순서
```bash
# 1. schema.prisma 수정
# 2. 마이그레이션 생성
cd backend && npx prisma migrate dev --name <설명적인_이름>
# 3. 클라이언트 재생성
npx prisma generate
# 4. 타입 오류 확인
npm run lint:check
```

## 절대 금지
- `prisma migrate reset` — 전체 데이터 삭제 (hook이 차단)
- 마이그레이션 파일 직접 수정 — `prisma migrate dev`로만 생성
- `$queryRawUnsafe()` — SQL 인젝션 위험, `Prisma.sql` 템플릿 사용

## 마이그레이션 실패 시
- DB 스키마와 코드 불일치 시 서버 기동 불가
- 롤백: `prisma migrate resolve --rolled-back <migration_name>`
- 운영 DB: `prisma migrate deploy`가 배포 시 자동 실행

## 운영 정합성 함정 (단일 출처: `docs/db-standards.md`)
- **소프트삭제 필터**: Prisma는 ORM 차원 글로벌 필터가 없어 client extension(구 `$use` 미들웨어)이나
  쿼리별 `where`로 거르는데, 모델·쿼리 누락 시 삭제 데이터가 노출된다 — 모든 모델/쿼리에 실제 적용되는지
  삭제 후 제외 테스트로 검증(`docs/db-standards.md`).

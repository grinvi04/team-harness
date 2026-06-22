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
- **버전 번호 역행** — 건너뜀은 허용, 역행은 금지
- `spring.flyway.clean-on-validation-error=true` — 운영 DB 전체 삭제 위험

## 마이그레이션 실패 시
- checksum 불일치: `flyway_schema_history` 확인 후 수정된 파일 복원
- 운영 데이터 보호 원칙: 컬럼 즉시 삭제/rename 금지 → deprecate 후 다음 릴리즈에 제거

---
paths: ["alembic/**", "app/models/**"]
---

# Alembic 마이그레이션 작업 규칙

## 마이그레이션 안전 순서
```bash
# 1. app/models/ 수정 후 자동생성
DYLD_LIBRARY_PATH=/opt/homebrew/opt/expat/lib \
  DATABASE_URL=postgresql+psycopg2://... \
  .venv/bin/alembic revision --autogenerate -m "<설명적인_이름>"
# 2. 생성된 파일 반드시 검토 후 적용
.venv/bin/alembic upgrade head
```

## 절대 금지
- `alembic downgrade base` — 전체 스키마 삭제 (hook이 차단)
- 마이그레이션 파일 직접 수정 — `alembic revision`으로만 생성
- `text()` / `execute()` raw SQL — `sa.text()` + 파라미터 바인딩 사용

## 마이그레이션 실패 시
```bash
alembic downgrade -1   # 한 단계씩 롤백
alembic current        # 현재 상태 확인
alembic history        # 전체 이력
```

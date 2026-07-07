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
- `alembic downgrade base` — ⚠️ 전체 스키마 삭제 (가드 미차단 — AI·사람 모두 직접 실행 금지)
- 마이그레이션 파일 직접 수정 — `alembic revision`으로만 생성
- `text()` / `execute()` raw SQL — `sa.text()` + 파라미터 바인딩 사용

## 마이그레이션 실패 시
```bash
alembic downgrade -1   # 한 단계씩 롤백
alembic current        # 현재 상태 확인
alembic history        # 전체 이력
```

## 운영 안전 (단일 출처: `docs/db-standards.md`)
- **순서·out-of-order**: `down_revision` 체인이 분기하면 head가 여러 개가 되고 브랜치 머지 시 적용 순서가
  뒤섞일 수 있다 — 기존·운영 DB에 새 리비전이 누락·역행 없이 증분 적용되는지 실 DB로 검증(`docs/db-standards.md`).
- **다중 head 차단(CI)**: Flyway용 `migration-safety` 게이트는 파일명 기반이라 Alembic 분기를 못 잡는다.
  Alembic은 **다중 head = 분기 미머지**가 위험이므로 CI에 아래 한 스텝을 둔다(2개 이상이면 실패):

```yaml
# ci-gate.yml의 quality 잡에 추가 (CUSTOMIZE: alembic 실행 경로)
- name: alembic 단일 head 강제
  run: |
    HEADS=$(.venv/bin/alembic heads | grep -c .)
    if [ "$HEADS" -gt 1 ]; then
      echo "✖ Alembic head가 ${HEADS}개 — 분기 미머지. 'alembic merge'로 단일 head로 합치세요."; exit 1
    fi
    echo "✓ Alembic 단일 head"
```

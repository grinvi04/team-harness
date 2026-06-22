---
paths: ["**/*.py"]
---

# Python / FastAPI 작업 규칙

## async / sync 혼용 금지
- `async def` 엔드포인트에서 동기 DB 호출(`db.query`, `db.commit`) 직접 호출 금지 — 이벤트 루프 블로킹.
- 동기 유지(`def`)하거나 AsyncSession으로 완전 전환 중 하나.

## 절대 금지
```python
==  # HMAC 비교 → hmac.compare_digest() 필수 (타이밍 공격)
$queryRaw / text() 직접 SQL  # → ORM 또는 파라미터 바인딩 사용
```

## 테스트
- FastAPI 의존성 mock: `app.dependency_overrides[get_db] = ...` 필수 (`mocker.patch` 동작 안 함)
- 테스트 후 반드시 `app.dependency_overrides.clear()`

## lint
```bash
DYLD_LIBRARY_PATH=/opt/homebrew/opt/expat/lib .venv/bin/ruff check app/ tests/
```

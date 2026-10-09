---
paths: ["**/*.py"]
---

# Python 작업 규칙

프로젝트의 Python·프레임워크·검사 설정을 따른다. FastAPI 규칙을 모든 Python 파일에 강제하지 않는다.
공통 적용 기준은 `docs/standards-scope.md`다.

## 검사와 공식 자료

Ruff·mypy 등은 채택한 버전과 실제 명령으로 CI에 연결한다.
공식 설정: [Ruff](https://docs.astral.sh/ruff/), [mypy](https://mypy.readthedocs.io/en/stable/config_file.html).
특정 Mac의 DYLD_LIBRARY_PATH나 .venv 경로를 공통 명령에 넣지 않는다.

## 실행 경계

- async 경로의 동기 DB·HTTP 호출이 이벤트 루프를 막는지 확인한다.
- sync 경로·thread offload·비동기 드라이버 중 현재 프레임워크에 맞는 방식을 선택한다.
- AsyncSession은 동시 task 간 공유하지 않는다. 요청·task별 수명과 복구를 정의한다.
- FastAPI 요청 검증은 기본 422다. 커스텀 오류 처리와 서버 내부 검증 실패를 구분한다.
- 의존성 교체는 등록 callable과 실제 조회 지점에 맞춘다. 사용한 overrides·patch를 시험 뒤 복원한다.
- 직접 SQL은 파라미터를 바인딩한다. HMAC 등 비밀 값 비교에는 compare_digest를 사용한다.

진단·공식 자료: `docs/stack-troubleshooting-backend.md`.
pytest 등 실제 검사 명령을 프로젝트에 기록한다. 실행하지 않은 DB·동시성 경계를 통과로 보고하지 않는다.

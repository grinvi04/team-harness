---
paths: ["**/*.py"]
---

# FastAPI 작업 규칙

python.md와 함께 선택한 FastAPI API에만 적용한다. 프론트엔드는 개별 스택으로 조합한다.

## 공식 기준

[동기·비동기 경계](https://fastapi.tiangolo.com/async/),
[의존성 테스트](https://fastapi.tiangolo.com/advanced/testing-dependencies/),
[BackgroundTasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)를 따른다.

## 조건부 실무 판단

- async 함수 안의 동기 DB·HTTP·CPU 작업을 구분한다. await 문법만으로 비차단을 보장하지 않는다.
  드라이버 교체·thread/worker 비용을 비교한다. 단순 동기 경로가 대안이며 느린 요청과 동시 요청을 측정한다.
- 요청별 자원 수명과 task별 DB 세션을 정한다. 변경 요청의 입력 검증과 업무 권한을 따로 검사한다.
  계층 분리가 비용이다. 작은 의존성 함수가 대안이며 요청 취소·오류·재사용·정리 누락을 검사한다.
- 프로세스 종료에도 남아야 하는 작업만 지속 큐를 검토한다. BackgroundTasks를 전달 보장으로 보지 않는다.
  중복·재시도·관측 운영이 비용이다. 짧은 동기 완료가 대안이며 중단 후 복구와 중복 효과를 검사한다.

pytest와 실제 ASGI 경계를 연결한다. dependency_overrides는 정확한 callable을 대상으로 쓰고 시험 뒤 복구한다.
422 요청 검증과 서버 내부 실패를 구분한다. DB·Redis·Celery는 프로젝트 요구 없이는 추가하지 않는다.

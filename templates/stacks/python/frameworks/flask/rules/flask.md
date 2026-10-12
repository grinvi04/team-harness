---
paths: ["**/*.py", "**/templates/**/*.html"]
---

# Flask 작업 규칙

python.md와 함께 선택한 Flask 프로젝트에만 적용한다. templates와 API의 인증·출력 경계를 구분한다.

## 공식 기준

[Flask3.1 보안](https://flask.palletsprojects.com/en/stable/web-security/),
[app factory](https://flask.palletsprojects.com/en/stable/patterns/appfactories/),
[테스트](https://flask.palletsprojects.com/en/stable/testing/)를 설치 버전과 대조한다.

## 조건부 실무 판단

- 여러 설정·테스트 인스턴스가 필요할 때 app factory와 명시적 extension 초기화를 사용한다.
  초기화 순서가 비용이다. 단일 작은 앱은 기존 구조가 대안이며 테스트 간 설정·전역 상태 누출을 검사한다.
- Jinja escaping을 유지하고 입력을 Markup/safe로 무조건 신뢰하지 않는다. Flask가 CSRF까지 자동 제공한다고 가정하지 않는다.
  채택한 CSRF 보호의 구성 비용을 확인한다. 서버 폼의 작은 보호부터 시작하고 변경 요청·악성 출력·세션 경계를 검사한다.
- blueprint는 실제 기능 경계가 생겼을 때 나눈다. 모든 route마다 계층을 만들지 않는다.
  탐색 비용이 생긴다. 단일 모듈이 대안이며 URL 등록·오류 처리·권한 누락을 시험한다.

pytest·실제 request 테스트를 연결한다. 개발 서버를 운영 구성으로 쓰지 않으며 운영 변경은 별도 승인 범위다.

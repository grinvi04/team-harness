---
paths: ["**/*.rb"]
---

# Rails API 작업 규칙

ruby.md와 함께 Rails API에 적용한다. React·Next.js·Vue·Nuxt는 독립 스택으로 조합한다.

## 공식 기준

[Rails API 앱](https://guides.rubyonrails.org/api_app.html),
[보안](https://guides.rubyonrails.org/security.html),
[테스트](https://guides.rubyonrails.org/testing.html)를 설치 major와 대조한다.

## 조건부 실무 판단

- 인증·입력 검증·업무 권한을 서버에서 나눈다. CSRF 적용 여부는 세션/쿠키 사용 여부로 판단한다.
  인증 구조의 비용을 비교한다. 기존 프로젝트 방식이 대안이며 다른 사용자·권한·변경 요청을 시험한다.
- 응답 DTO와 오류 계약은 실제 외부 소비자가 생겼을 때 명시한다. 모델 전체 직렬화는 피한다.
  버전 호환 유지가 비용이다. 작은 hash가 대안이며 필드 누락·nullable·권한 제한을 계약 검사한다.
- DB 쓰기와 외부 메시지의 이중 쓰기가 문제라면 outbox를 검토한다. 모든 CRUD에 큐를 추가하지 않는다.
  전달 지연·중복·publisher 운영이 비용이다. 동기 처리가 대안이며 중단 후 복구와 멱등 효과를 검사한다.

Rails request/단위 검사를 연결한다. 고정 DB·Hotwire·Inertia 의존성은 API 기본값이 아니다.

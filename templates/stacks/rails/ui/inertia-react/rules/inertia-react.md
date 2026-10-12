---
paths: ["**/*.rb", "**/*.tsx"]
---

# Rails Inertia React 작업 규칙

ruby.md·typescript.md·react.md와 함께 읽는다. Rails와 React는 같은 앱 안의 Inertia 구성이다.
API backend+독립 프론트엔드 조합으로 배치하지 않는다.

## 공식 기준

[Inertia Rails 인증](https://inertia-rails.dev/guide/authentication),
[CSRF](https://inertia-rails.dev/guide/csrf-protection),
[폼](https://inertiajs.com/forms)을 gem과 JS adapter의 설치 major에 맞춰 읽는다.
현재 forms 링크는 v3로 연결된다. v2 프로젝트는 해당 major 문서를 선택하고 차이를 검토한다.

## 조건부 실무 판단

- 화면 전용 DTO로 필요한 props만 보낸다. 모델 전체·세션·비밀 값을 직렬화하지 않는다.
  DTO 유지가 비용이다. 작은 명시적 hash가 대안이며 다른 사용자·권한·응답 payload를 검사한다.
- 업무 권한은 Rails에서 확인한다. 화면의 버튼 숨김·shared props는 허가 증명이 아니다.
- 폼 오류·중복 제출·부분 reload의 상태 소유자를 정한다. API용 오류 처리와 Inertia 흐름을 섞지 않는다.
  양쪽 상태 동기화가 비용이다. 서버 검증 중심 폼이 대안이며 navigation·뒤로가기·오류 복구를 검사한다.

Gemfile.lock의 inertia_rails와 npm lock의 선택 adapter·React·Node 조건을 함께 검사한다.
서버 request 시험과 lint·typecheck·test:unit·build 및 필요한 브라우저 폼 회귀를 연결한다.

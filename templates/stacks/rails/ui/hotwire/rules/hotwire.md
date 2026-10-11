---
paths: ["**/*.rb", "**/*.erb", "**/controllers/**/*.js"]
---

# Rails Hotwire 작업 규칙

ruby.md와 함께 Rails 앱 안의 Hotwire 화면에 적용한다. 별도 프론트엔드 조합으로 취급하지 않는다.

## 공식 기준

[Rails JavaScript 선택](https://guides.rubyonrails.org/working_with_javascript_in_rails.html),
[Turbo Drive](https://turbo.hotwired.dev/handbook/drive),
[Stimulus 수명](https://stimulus.hotwired.dev/reference/lifecycle-callbacks)을 따른다.
importmap의 gem 제공 파일과 외부 CDN·npm 버전을 구분한다. importmap만 쓰는 앱에 Node를 강제하지 않는다.

## 조건부 실무 판단

- 부분 갱신으로 해결되는 화면에서 frame/stream을 선택한다. client 상태 머신을 먼저 추가하지 않는다.
  navigation·캐시·DOM 교체 추적이 비용이다. 일반 서버 화면이 대안이며 뒤로가기·재방문·실패 폼을 검사한다.
- 이벤트·구독은 connect/disconnect 수명에 맞춰 정리한다. 같은 DOM 재사용에 중복 등록하지 않는다.
  재연결 처리가 비용이다. 작은 Stimulus controller가 대안이며 반복 navigation과 이벤트 횟수를 시험한다.
- 폼의 CSRF·권한과 성공/검증 실패 응답을 서버에서 처리한다. Turbo 갱신만으로 권한을 보장하지 않는다.

Rails request/단위 검사와 필요한 브라우저 navigation 회귀를 연결한다. JS pin 누락을 gem 버전으로 채우지 않는다.

---
paths: ["**/*.vue", "**/nuxt.config.*", "**/server/**/*.ts", "**/composables/**/*.ts"]
---

# Nuxt 작업 규칙

공통 TypeScript·Vue 기준을 먼저 읽는다. Nuxt3/4의 디렉터리·자동 import 차이를 설치 버전과 대조한다.

## 공식 기준

[Nuxt4 상태](https://nuxt.com/docs/4.x/getting-started/state-management),
[데이터 조회](https://nuxt.com/docs/4.x/getting-started/data-fetching),
[hydration 진단](https://nuxt.com/docs/4.x/guide/best-practices/hydration)을 따른다.
Nuxt3 프로젝트에서는 같은 주제의3.x 문서로 전환한다.

## 조건부 실무 판단

- SSR 사용자 상태는 요청마다 격리한다. 모듈 전역 singleton에 인증·사용자 데이터를 두지 않는다.
  직렬화·초기화 비용을 확인한다. 공유가 필요 없는 값은 컴포넌트 로컬 상태가 대안이다.
  서로 다른 사용자 동시 요청·로그아웃·새로고침에서 이전 값이 보이지 않는지 검사한다.
- 최초 HTML에 필요한 조회는 useFetch/useAsyncData의 payload 경계를 사용한다.
  키·캐시 수명이 비용이다. 사용자 클릭의 단순 요청은 $fetch가 대안이며 중복 요청·오래된 응답을 검사한다.
- 서버/브라우저의 시간·난수·locale이 다른지 먼저 확인한다. ClientOnly는 브라우저 전용 기능에 한정한다.
  SSR을 모두 끄면 초기 표시·검색 노출이 바뀐다. 동일 초기 데이터가 대안이며 직접 진입과 hydration을 검사한다.
- BFF는 인증이나 응답 결합을 서버에 둘 필요가 있을 때 선택한다. 홉·운영·중복 DTO 비용이 생긴다.
  단순 API 직접 연결도 비교하고 권한·CSRF·실패 전파를 실제 요청으로 검사한다.

설정의 공개 영역에 비밀 값을 넣지 않는다. 채택한 Nuxt module·Vue·Node·TypeScript 조건을 함께 확인한다.
필수 lint·typecheck·test:unit·build를 연결하고 module 설치만으로 호환을 통과했다고 보고하지 않는다.

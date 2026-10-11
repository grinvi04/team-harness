---
paths: ["**/*.vue", "src/**/*.ts"]
---

# Vue / Nuxt 작업 규칙

설치한 Vue·Nuxt 버전과 기존 Options/Composition API 방식을 따른다.
공통 TypeScript 기준은 typescript.md다. React·Next.js 전용 lint를 적용하지 않는다.

## 반응성과 상태

props를 직접 수정하지 않는다. 변경 이벤트와 로컬 편집 상태를 구분한다.
reactive·Pinia 상태의 구조분해에는 toRefs/storeToRefs 등 맞는 방법을 선택한다.
Vue 3.5+ defineProps의 반응성 구조분해는 지원되는 예외다. 모든 구조분해를 금지하지 않는다.
전역 상태 라이브러리는 실제 필요에 맞춰 선택한다. Pinia를 모든 제품에 미리 설치하지 않는다.
SSR 상태는 요청별로 격리한다. 공통 singleton에 사용자 상태를 보관하지 않는다.

## 검사와 디자인

.vue 타입은 vue-tsc 등 SFC 지원 검사로 확인하고 실제 명령을 CI에 연결한다.
기존 프로젝트의 테스트·빌드 도구와 Vue 접근성 lint를 사용한다.
토큰 검사를 채택하면 .vue·CSS를 읽는 parser와 검사 범위를 설정한다.
Harness의 check-design-tokens.mjs는 .vue·CSS를 검사하지 않는다.
키보드·초점·지원 테마·좁은 화면은 별도로 검사한다. UI 단위 테스트를 일괄 생략하지 않는다.

공식 자료와 진단: `docs/stack-troubleshooting-frontend.md`.
[Vue props](https://vuejs.org/guide/components/props.html#reactive-props-destructure),
[Vue SSR](https://vuejs.org/guide/scaling-up/ssr.html)를 설치 버전과 대조한다.

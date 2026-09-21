---
paths: ["**/*.vue", "src/**/*.ts"]
---

# Vue 3 작업 규칙 (Composition API 기준)

> TypeScript 공통 규칙은 `typescript.md`. 여기엔 Vue 특화만.
> ⚠️ `typescript.md`의 "eslint-config-next"는 Next.js 전용 — Vue는 `eslint-plugin-vue`를 쓴다.

## 컴포넌트 작성
- **`<script setup lang="ts">` + Composition API** 기본. Options API 신규 작성 지양.
- props는 `defineProps<T>()` 제네릭으로 타입 지정, emits는 `defineEmits<T>()`.
- 단일 파일 컴포넌트(SFC) `.vue` — 로직(훅·상태·검증)은 `composables/`로 추출해 테스트 가능하게.

## 타입체크 — `vue-tsc` 필수
- `.vue` SFC의 타입은 `tsc`만으로 안 잡힌다 — **`vue-tsc --noEmit`**를 `type-check` 스크립트로 두고 CI 필수.
- `package.json`: `"type-check": "vue-tsc --noEmit"`.

## 반응성(reactivity) 함정
- `ref`/`reactive` 구조분해 시 반응성 소실 — `toRefs()`/`storeToRefs()`로 분해한다.
- props를 직접 변경 금지(단방향) — `emit` 또는 로컬 `ref` 복사.
- `reactive` 객체 전체 재할당 금지(참조 끊김) — 속성 갱신 또는 `ref` 사용.

## 상태관리 — Pinia
- 전역 상태는 **Pinia**(Vuex 신규 금지). 스토어에서 꺼낼 때 `storeToRefs(store)`로 반응성 유지.

## 테스트
- 단위/동작 테스트: **vitest + @vue/test-utils**. 스크립트명 `test:unit`(CI가 `npm run test:unit`).
- 접근성 lint: `eslint-plugin-vuejs-accessibility`(React의 jsx-a11y 대응).
- 순수 프레젠테이셔널 컴포넌트는 단위 테스트 생략 — e2e + `/qa`로 커버.

## 빌드
- `vite build`. 디자인 토큰 원칙은 공통이며 `lint:design`은 Vue/CSS 형식에 맞게 연결한다.
- `check-design-tokens.mjs`는 `.vue`·CSS를 검사하지 않는다. Stylelint와 Vue `<style>`을 읽는 parser
  (예: `postcss-html`)를 설정하고 `src/**/*.{css,vue}`를 검사 대상으로 삼는다. 색상 정의를 허용할 토큰 원본을 명시한다.
  직접 색상·미정의 변수는 거부하고 정상 토큰은 허용하는지 격리된 예제로 확인한다.
- template 접근성 lint와 브라우저의 라이트/다크·모바일·키보드/초점 검사는 별도로 연결한다.
  상세 수용 기준과 자동 판정 불가 항목의 기록은 공통 `docs/frontend-design-standards.md` §8을 따른다.

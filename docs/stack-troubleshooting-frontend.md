# 프론트엔드 문제 해결과 실무 관행

[적용 기준](standards-scope.md)을 따른다. 설치한 버전과 실제 렌더 경로를 먼저 확인한다.
아래는 공식 자료와 진단 절차이며 소비 화면에서 모두 실행한 결과가 아니다.

## TypeScript 공통

타입 선언은 외부 데이터의 런타임 형태를 검증하지 않는다.
응답이 배열인지 페이지 객체인지, nullable 필드가 있는지 경계에서 확인한다.
`as any`나 검사를 끄는 설정으로 원인을 숨기지 않는다. unknown과 검증 함수·스키마를 사용한다.
[TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)을 참고한다.

## React·Next.js

| 증상 | 먼저 확인할 것 | 대응과 확인 |
|---|---|---|
| hydration 불일치 | 서버와 브라우저의 날짜·난수·locale·초기 상태 | 동일한 최초 렌더를 만들고 직접 진입·새로고침 검사 |
| 함수 prop 전달 오류 | 일반 함수인가, 지원되는 Server Action인가 | 일반 함수는 클라이언트에 두고 Action은 공식 경계·권한 검사 |
| 저장 후 화면이 오래된 값을 표시 | 버전별 fetch·route·태그 캐시와 무효화 경로 | 캐시 계약을 명시하고 저장·재진입·다른 사용자 확인 |
| 인증 경계에 비밀 값이 노출 | NEXT_PUBLIC_와 클라이언트 import | 서버 전용 코드 분리와 생성 번들·응답 확인 |
| 테이블 선택이 초기화 | 데이터 참조·row key·컴포넌트 재마운트 | 라이브러리 계약을 확인하고 검색·페이지 변경·재조회 검사 |

공식 기준: [Hydration 오류](https://nextjs.org/docs/messages/react-hydration-error),
[Server Action 전달](https://nextjs.org/docs/app/getting-started/mutating-data#passing-actions-as-props),
[Next.js 캐시 개요](https://nextjs.org/docs/app/getting-started/caching),
[React 파생 상태](https://react.dev/learn/you-might-not-need-an-effect).
hydration 경고 숨김은 원인 해결이 아니다. 렌더 중 상태 변경은 공식 조건을 이해한 제한된 사례에만 사용한다.
middleware/proxy의 이름과 런타임은 버전에 따라 다르다.
[Proxy 안내](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)를 현재 설치 버전과 대조한다.
인증 라우팅 검사만으로 각 API·Action의 서버 권한 검사를 대체하지 않는다.

## Vue·Nuxt

| 증상 | 먼저 확인할 것 | 대응과 확인 |
|---|---|---|
| 구조분해한 값이 갱신되지 않음 | reactive·Pinia·컴파일되는 props 중 무엇인가 | toRefs/storeToRefs 또는 해당 버전의 props 변환 확인 |
| 사용자 간 상태가 섞임 | SSR에서 요청 공통 singleton 상태를 쓰는가 | 요청별 상태 생성, 서로 다른 사용자 요청으로 검사 |
| tsc 통과 후 SFC 오류 | .vue 파일이 검사 대상인가 | vue-tsc와 실제 프로젝트의 빌드·CI 연결 확인 |
| 서버에서 window/document 오류 | 브라우저 전용 코드가 SSR에서 실행되는가 | 클라이언트 경계·생명주기에 옮기고 직접 진입 검사 |

Vue 3.5+의 `defineProps` 구조분해는 컴파일러가 반응성을 유지하는 지원이 있다.
모든 구조분해가 반응성을 잃는다고 단언하지 않는다.
공식 기준: [Vue props](https://vuejs.org/guide/components/props.html#reactive-props-destructure),
[Vue SSR](https://vuejs.org/guide/scaling-up/ssr.html),
[Vue TypeScript](https://vuejs.org/guide/typescript/overview.html),
[Nuxt 상태 관리](https://nuxt.com/docs/4.x/getting-started/state-management).

## UI 라이브러리와 검증

같은 컴포넌트 이름도 설치한 라이브러리에 따라 prop·상태·타입이 다르다.
온라인 예제를 복사하기 전에 설치된 선언과 공식 자료를 확인한다.
읽기 전용 payload나 함수형 키는 실제 타입으로 처리한다. 타입을 느슨하게 바꿔 오류를 숨기지 않는다.
앱 셸·차트·검색·테마·상태관리 라이브러리는 제품에 필요할 때만 추가한다.
키보드·초점·로딩·실패·빈 상태는 [디자인 표준](frontend-design-standards.md#8-검증-pr-전-프레임워크-무관)의 범위로 확인한다.
정적 lint와 한 화면의 표본만으로 모든 사용자·브라우저의 품질을 보장하지 않는다.

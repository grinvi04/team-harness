---
paths: ["**/*.tsx", "**/*.jsx"]
---

# React 작업 규칙

공통 TypeScript 기준은 typescript.md다. Next.js에서는 nextjs.md도 읽는다.
React+Vite SPA에 Server Component 규칙을 강제하지 않는다. 설치 버전과 실제 렌더 환경을 확인한다.

## 공식 기준

[상태 공유](https://react.dev/learn/sharing-state-between-components),
[Effect가 필요 없는 경우](https://react.dev/learn/you-might-not-need-an-effect),
[서버 컴포넌트](https://react.dev/reference/rsc/server-components)를 필요한 주제만 읽는다.

## 조건부 실무 판단

- 상태는 사용 지점 가까이에 둔다. 여러 화면이 같은 편집을 공유할 때만 공통 소유자로 올린다.
  전역 저장소는 수명·초기화·추적 비용이 생긴다. 단순 props가 대안이며 화면 이동·로그아웃 후 초기화를 검사한다.
- 서버 응답과 입력 중인 폼을 분리한다. 재조회가 편집 값을 덮는 문제를 확인했을 때 적용한다.
  별도 상태 동기화가 비용이다. 단순 제출 후 재조회가 대안이며 느린 응답·중복 제출·취소를 검사한다.
- 외부 구독에 Effect를 쓰면 해제와 요청 경쟁을 관리한다. 파생 값은 먼저 렌더 중 계산한다.
  불필요한 캐시·memo는 추적 비용을 늘린다. 프로파일 결과로 추가하고 재마운트·오래된 응답을 검사한다.
- 접근 권한과 비밀 값은 서버에서 처리한다. 화면을 숨기는 것만으로 API 권한을 보장하지 않는다.

## 진단과 재발 확인

상태 소유자·key 변경·재마운트·응답 순서를 먼저 확인한다. 경고 숨김이나 타입 검사 해제로 해결하지 않는다.
프로젝트의 lint·typecheck·test:unit·build를 CI에 연결한다. 성공·거부·로딩·빈 화면·키보드는 별도로 확인한다.

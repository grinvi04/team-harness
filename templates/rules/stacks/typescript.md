---
paths: ["**/*.ts", "**/*.tsx"]
---

# TypeScript 작업 규칙

프로젝트의 런타임·프레임워크·검사 명령을 따른다. 공통 적용 기준은 `docs/standards-scope.md`다.

## 타입과 외부 경계

- 외부 입력은 타입 선언만 믿지 않는다. unknown·타입 가드·스키마로 검증한다.
- 배열과 페이지 객체를 구분한다. `as any`·`@ts-ignore`로 계약 오류를 숨기지 않는다.
- 타입 생성은 선택지다. 생성 타입도 실제 런타임 입력을 검사하지 않는다.
- 입력 오류와 서버 실패를 구분한다. NestJS 기본 처리와 커스텀 filter를 함께 확인한다.

공식 자료: [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html),
[NestJS validation](https://docs.nestjs.com/techniques/validation).

## lint·타입·디자인 검사

포맷 도구와 ESLint 규칙은 프레임워크·프로젝트에 맞춰 선택하고 CI에 연결한다.
`no-explicit-any`를 채택하면 error로 연결하고 정당한 예외의 이유를 남긴다.
Next.js는 eslint-config-next, Vue는 해당 Vue lint 설정을 사용한다. 단일 preset을 모든 repo에 적용하지 않는다.
타입 검사는 실제 프로젝트 명령으로 실행한다. .vue는 vue-tsc 검사도 필요하다.

토큰 검사를 채택하면 지원 파일 형식과 예외를 명시한다.
`templates/frontend/check-design-tokens.mjs`는 src의 JS/TS/JSX/TSX Tailwind 색상 일부를 검사한다.
배포 시 실제 scripts 경로와 `lint:design`·CI를 연결한다. `.vue`·CSS·동적 스타일은 검사하지 않는다.
해당 형식의 검사와 정상·거부 예제를 별도로 확인한다. 화면·접근성 검사는 lint와 구분한다.

문제 해결: `docs/stack-troubleshooting-frontend.md`, `docs/stack-troubleshooting-backend.md`.
테스트 도구는 프로젝트에서 선택한다. UI 단위 테스트를 일괄 생략하거나 특정 도구를 필수로 두지 않는다.

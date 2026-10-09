---
paths: ["**/app/**/*.tsx", "**/app/**/*.ts", "**/pages/**/*.tsx", "**/pages/**/*.ts", "**/middleware.ts", "**/proxy.ts", "**/next.config.*"]
---

# Next.js 작업 규칙

설치한 Next.js·React 버전과 App/Pages Router를 먼저 확인한다.
공통 TypeScript 기준은 typescript.md다. 서버 컴포넌트 규칙을 Pages Router 전체에 강제하지 않는다.

## 서버·브라우저 경계

상호작용·브라우저 API가 필요한 곳에 client 경계를 둔다. 서버 전용 DB·비밀 모듈을 client에 import하지 않는다.
NEXT_PUBLIC_는 브라우저에 공개되는 값이다. 비밀 키·DB URL·세션 비밀에 사용하지 않는다.
일반 함수 prop과 지원되는 Server Action을 구분한다.
Server Action은 공개 엔드포인트처럼 입력·권한을 서버에서 검사한다.

## 캐시와 검사

fetch·route·태그 캐시의 기본값은 버전별로 확인하고 데이터 신선도 요구를 명시한다.
수정 후 재진입·새로고침·다른 사용자에서 캐시와 권한 경계를 검사한다.
build와 별도 type-check·lint 명령을 CI에 연결한다. 버전마다 빌드에 포함되는 검사가 다르다.
ignoreBuildErrors 등으로 실패를 숨기지 않는다. 빌드만으로 lint까지 통과했다고 보고하지 않는다.
middleware/proxy 이름·runtime은 버전별 공식 자료에서 확인한다. 모든 버전을 Edge라고 가정하지 않는다.

공식 자료와 진단: `docs/stack-troubleshooting-frontend.md`.
[Server Actions](https://nextjs.org/docs/app/getting-started/mutating-data),
[Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)를 설치 버전과 대조한다.

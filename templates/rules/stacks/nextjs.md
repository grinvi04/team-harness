---
paths: ["app/**/*.tsx", "app/**/*.ts", "pages/**/*.tsx", "middleware.ts", "next.config.*"]
---

# Next.js 작업 규칙 (App Router 기준)

> TypeScript 공통 규칙은 `typescript.md`. 여기엔 Next.js 특화만.

## 서버/클라이언트 컴포넌트 경계
- **기본은 서버 컴포넌트(RSC)** — `'use client'`는 상호작용(useState·이벤트·브라우저 API)이 실제로 필요한 잎(leaf)에만 최소로.
  레이아웃·페이지를 통째로 `'use client'` 하지 말 것(번들·SEO·서버 데이터 페칭 손해).
- 서버 컴포넌트에서 `useState`/`useEffect`/`onClick` 사용 금지 — 빌드가 막는다.
- 클라이언트 컴포넌트에 **서버 전용 모듈(DB 클라이언트·`fs`·시크릿 읽기)을 import 금지** — 번들에 새어나간다.

## 시크릿 노출 — `NEXT_PUBLIC_`
- 브라우저에 나가도 되는 값만 `NEXT_PUBLIC_` 접두사. **시크릿(API 키·DB URL·세션 시크릿)에 `NEXT_PUBLIC_`를 붙이면 클라이언트 번들에 박혀 유출**된다.
- 서버 전용 env는 접두사 없이(`process.env.X`) 서버 컴포넌트·route handler·server action에서만 읽는다.

## Server Actions
- `'use server'` 함수는 **공개 엔드포인트와 동일** — 입력 검증(zod 등)·인가 체크를 함수 안에서 직접 한다(클라이언트 검증만 믿지 말 것).
- 민감 작업 후 `revalidatePath`/`revalidateTag`로 캐시 무효화.

## 데이터·캐시
- `fetch`의 캐시 동작(기본 force-cache vs `no-store`)을 의도적으로 지정 — 실시간 데이터에 stale 캐시 노출 주의.
- Route handler(`app/api/.../route.ts`)는 공통 Envelope·4xx 매핑(`docs/api-standards.md`) 동일 적용.

## 빌드·검증
- `npm run build`(= `next build`)가 RSC 경계 위반·타입 오류를 잡는다 — CI 필수.
- `next.config`에서 `typescript.ignoreBuildErrors`/`eslint.ignoreDuringBuilds`를 **켜지 말 것**(게이트 무력화). 켜야 하면 별도 `type-check`/`lint` 스텝으로 보완.
- lint은 `eslint-config-next`(react-hooks·jsx-a11y 포함).

## 미들웨어
- `middleware.ts`는 Edge 런타임 — Node 전용 API(`fs`·`crypto.createHash` 일부) 사용 불가. 인증 가드는 가볍게, 무거운 로직은 route handler로.

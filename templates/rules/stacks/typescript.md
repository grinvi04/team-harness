---
paths: ["**/*.ts", "**/*.tsx"]
---

# TypeScript 작업 규칙

## 포맷·디자인 토큰은 게이트가 강제 (prose 아님)
- **포맷은 Prettier가 강제** — `prettier --check`를 CI에 둔다. 손으로 맞추지 말 것: `prettier --write .`로 자동수정.
  설정은 `templates/.prettierrc`(no-semi·single-quote·2-space·trailingComma=all·printWidth 100)를 repo 루트(또는 `frontend/`)에 복사.
- **색상 토큰 검사는 파일 형식에 맞게 `lint:design`에 연결** — JS/TS/JSX/TSX의 Tailwind 클래스 검사에는
  `templates/frontend/check-design-tokens.mjs`를 `scripts/check-design-tokens.mjs`로 복사하고
  `package.json`에 `"lint:design": "node scripts/check-design-tokens.mjs"`, CI에 `npm run lint:design`을 연결한다.
  이 스크립트는 `src`의 숫자 스케일 색(`gray-500`·`blue-600`)·`bg-white`를 검사하며, 의도적 예외는 줄 끝 `// design-token-ok`다.
  `.vue`·CSS·동적 스타일은 검사하지 않는다. Vue/순수 CSS에는 Stylelint 등 해당 형식의 검사를 연결한다(`vue.md`, 공통 `docs/frontend-design-standards.md` §8).
  정상 토큰은 허용하고 직접 색상·미정의 변수는 거부하는지 확인하며, 다크모드의 실제 화면은 별도 검증한다.
- **lint 설정은 프레임워크에 맞춘다** — React/Next.js는 `eslint-config-next`(`react-hooks`·`jsx-a11y`·`@typescript-eslint` 포함), **Vue는 `eslint-plugin-vue`**(+`eslint-plugin-vuejs-accessibility`). 어느 쪽이든 `npm run lint` 한 줄로 CI가 강제. (Next.js·Vue 특화는 `nextjs.md`·`vue.md` 참조.)
- **`as any`/`any` 금지는 prose가 아니라 lint 규칙으로 강제** — eslint 설정에 `@typescript-eslint/no-explicit-any: "error"`를 배선한다(많은 preset이 기본 warn이라 CI를 못 막음 — `error`로 올린다). 이미 켜져 있으면 레벨만 확인. 의도적 예외는 그 줄에 사유 주석과 함께 `// eslint-disable-next-line @typescript-eslint/no-explicit-any`.

## 타입 안전
- `as any` 캐스팅 금지 — 명시적 타입 선언 또는 unknown + 타입가드.
- API 응답 타입은 별도 파일(`types/`)에 정의. 인라인 추론에 의존하지 않을 것.
- 비배열 응답을 배열로 가정하지 말 것 — `Array.isArray()` 체크 후 접근.

## 절대 금지
```typescript
response as any         // ❌
data.forEach(...)       // ❌ (배열 검증 없이)
// @ts-ignore           // ❌ (회피 대신 타입 수정)
```

## 입력 오류는 4xx (백엔드, 단일 출처: `docs/api-standards.md`)
- NestJS는 `ValidationPipe`로 DTO 검증 실패를 400에 매핑하고, exception filter 미매핑 예외는 500으로
  흡수된다 — 잘못된 입력은 4xx + 공통 Envelope에 매핑(`docs/api-standards.md`).

## 테스트
- 타입체크: `npm run type-check` (커밋 전 필수)
- 단위 테스트: vitest / jest + Testing Library
- 순수 프레젠테이셔널 컴포넌트는 단위 테스트 생략 — e2e + `/qa`로 커버

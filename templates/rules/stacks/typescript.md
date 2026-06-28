---
paths: ["**/*.ts", "**/*.tsx"]
---

# TypeScript 작업 규칙

## 포맷·디자인 토큰은 게이트가 강제 (prose 아님)
- **포맷은 Prettier가 강제** — `prettier --check`를 CI에 둔다. 손으로 맞추지 말 것: `prettier --write .`로 자동수정.
  설정은 `templates/.prettierrc`(no-semi·single-quote·2-space·trailingComma=all·printWidth 100)를 repo 루트(또는 `frontend/`)에 복사.
- **하드코딩 색 금지는 `lint:design` 게이트가 강제** — `templates/frontend/check-design-tokens.mjs`를 `scripts/check-design-tokens.mjs`로 복사하고
  `package.json` scripts에 `"lint:design": "node scripts/check-design-tokens.mjs"`를 추가, CI(ci-gate)에 `npm run lint:design` 스텝을 둔다.
  숫자 스케일 색(`gray-500`·`blue-600`)·`bg-white` 금지 → 시맨틱 토큰만(다크모드 보장). 의도적 예외는 줄 끝 `// design-token-ok`.
- **lint은 eslint-config-next 유지** — `react-hooks`·`jsx-a11y`·`@typescript-eslint` 규칙을 포함하므로 별도 추가 설정 없이 `npm run lint`.
- **`as any`/`any` 금지는 prose가 아니라 lint 규칙으로 강제** — eslint 설정에 `@typescript-eslint/no-explicit-any: "error"`를 배선한다(eslint-config-next 기본은 warn이라 CI를 막지 못함). 이미 규칙이 켜져 있으면 `error` 레벨인지만 확인. 의도적 예외는 그 줄에 사유 주석과 함께 `// eslint-disable-next-line @typescript-eslint/no-explicit-any`.

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

---
paths: ["**/*.ts", "**/*.tsx"]
---

# TypeScript 작업 규칙

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

## 테스트
- 타입체크: `npm run type-check` (커밋 전 필수)
- 단위 테스트: vitest / jest + Testing Library
- 순수 프레젠테이셔널 컴포넌트는 단위 테스트 생략 — e2e + `/qa`로 커버

---
name: feature-merge
description: 완성된 feature/fix 브랜치를 develop에 머지할 때 사용. 품질·리뷰·승인·CI 게이트를 거치며 코드 구현·PR만 생성·main 릴리즈는 제외
---

# feature-merge — Codex native wrapper

먼저 `../../../skills/feature-merge/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

현재 agent가 품질 검증·review·wrapper 실행을 소유하고, 독립 근거 수집만 플랫폼 subagent에 위임한다.

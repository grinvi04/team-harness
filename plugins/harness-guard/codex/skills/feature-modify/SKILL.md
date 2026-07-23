---
name: feature-modify
description: 기존 기능 변경이나 버그 수정을 TDD로 구현할 때 사용. 변경분만 RED로 만들며 완전 신규 기능·원인만 분석·PR 머지는 제외
---

# feature-modify — Codex native wrapper

먼저 `../../../skills/feature-modify/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

변경분 RED·GREEN·회귀 검증은 현재 agent가 순차 수행하고, 독립 탐색·반증만 플랫폼 subagent에 위임한다.

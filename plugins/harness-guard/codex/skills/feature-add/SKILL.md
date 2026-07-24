---
name: feature-add
description: 승인된 스펙으로 새 기능을 TDD 구현할 때 사용. 브랜치·RED·GREEN·검증·커밋을 수행하며 기존 기능 변경·버그 수정·계획만 작성은 제외
---

# feature-add — Codex native wrapper

먼저 `../../../skills/feature-add/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

테스트 계약·구현·커밋은 현재 agent가 순차 수행하고, 독립적인 읽기·최종 반증만 플랫폼 subagent에 위임한다.

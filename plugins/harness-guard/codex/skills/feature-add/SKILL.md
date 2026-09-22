---
name: feature-add
description: 승인된 새 기능을 추가할 때 프로젝트 기준·테스트 계약·검사·커밋을 연결하는 데 사용. 일반 TDD 방법론의 중복 실행·기존 기능 수정·계획만 작성·PR 머지는 제외
---

# feature-add — Codex native wrapper

먼저 `../../../skills/feature-add/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

현재 agent가 요구와 RED 테스트 계약을 검수한다. 범위가 명확한 저위험 구현은 native 실행 계약에 따라
승인된 worker에 위임할 수 있다. 테스트 작성 → RED 검수 → 잠긴 테스트에 대한 구현 순서를 지킨다.
독립 검증자는 후보를 수정하지 않고 반증만 한다. 현재 agent가 통합 검증·문서 현행화·커밋을 맡는다.

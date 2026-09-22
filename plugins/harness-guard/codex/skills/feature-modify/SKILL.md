---
name: feature-modify
description: 기존 기능을 바꾸거나 확인된 버그를 고칠 때 변경·유지 테스트와 프로젝트 검사·커밋을 연결하는 데 사용. 일반 TDD 방법론의 중복 실행·완전 신규 기능·진단만 요청·PR 머지는 제외
---

# feature-modify — Codex native wrapper

먼저 `../../../skills/feature-modify/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

현재 agent가 변경 요구와 RED 계약을 검수한다. 범위가 명확한 저위험 수정은 native 실행 계약에 따라
승인된 worker에 맡기되 잠긴 테스트를 변경하지 않는다. 독립 검증자는 후보를 수정하지 않는다.
현재 agent가 영향 범위의 회귀·문서 현행화·통합·Git 작업을 책임진다.

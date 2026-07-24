---
name: solo-merge
description: 솔로 repo에서 자기승인 불가능 조건만 원자적으로 해제·복구하며 PR을 머지할 때 사용. CI·리뷰 우회·팀 승인 우회·main 릴리즈는 제외
---

# solo-merge — Codex native wrapper

먼저 `../../../skills/solo-merge/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

현재 agent가 review gate 완료 뒤 원자적 wrapper만 실행하며 보호 정책 복구를 직접 검증한다.

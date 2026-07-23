---
name: pr-review-gate
description: 열린 PR의 AI 리뷰·사람 승인·CI·외부 배포 상태를 처리해 머지 준비를 확인할 때 사용. PR 없는 코드 개발·PR 생성만 수행·게이트 우회는 제외
---

# pr-review-gate — Codex native wrapper

먼저 `../../../skills/pr-review-gate/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

현재 agent가 Codex review와 GitHub gate 판정을 소유하며 필요한 읽기 전용 독립 반증만 추가한다.

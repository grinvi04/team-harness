---
name: pr-review-gate
description: 열린 PR의 AI 리뷰·사람 승인·CI·외부 배포 상태를 처리해 머지 준비를 확인할 때 사용. PR 없는 코드 개발·PR 생성만 수행·게이트 우회는 제외
---

# pr-review-gate — Codex native wrapper

먼저 `../../../skills/pr-review-gate/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

공용 계약에 따라 Codex native 리뷰를 우선 사용한다. 구현자와 다른 읽기 전용 인스턴스의 현재
head/base 리뷰를 연결하고, 현재 agent가 지적 처리·증거 대조와 GitHub gate 최종 판정을 소유한다.

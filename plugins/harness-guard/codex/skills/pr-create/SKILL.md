---
name: pr-create
description: 현재 feature/fix 브랜치의 품질을 확인하고 올바른 base로 PR만 생성할 때 사용. 코드 수정·리뷰 처리·머지·릴리즈는 제외
---

# pr-create — Codex native wrapper

먼저 `../../../skills/pr-create/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

현재 agent가 품질 명령과 PR wrapper를 직접 실행하며 push·PR 생성 권한을 subagent에 위임하지 않는다.

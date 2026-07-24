---
name: release
description: 사전 검증된 버전을 정식 릴리즈할 때 사용. release 브랜치·main 태그·develop 역병합·헬스체크를 수행하며 hotfix·일반 develop 머지·사전검증 없는 배포는 제외
---

# release — Codex native wrapper

먼저 `../../../skills/release/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

branch·tag·back-merge는 현재 agent가 소유하고 사전·사후 검증만 읽기 전용으로 위임한다.

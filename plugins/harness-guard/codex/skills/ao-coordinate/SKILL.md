---
name: ao-coordinate
description: 승인된 제품 개발 요청의 진행·인계·검증·인수를 이어갈 때 사용. 단순 단독 수정·배포 실행·전역 설치·권한 집행은 제외
---

# ao-coordinate — Codex native wrapper

먼저 `../../../skills/ao-coordinate/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

현재 agent가 조정·파일 수정·Git 작업과 최종 인수를 소유한다. 독립 탐색·반증만 플랫폼 subagent에 위임한다. 역할 이름을 늘리거나 별도 TOML을 설치하지 않는다. 필수 독립성·유효 권한을 충족하지 못한 위임은 시작하지 않는다.

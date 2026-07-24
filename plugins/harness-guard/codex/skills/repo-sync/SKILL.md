---
name: repo-sync
description: 소비 프로젝트와 team-harness 표준 자산의 드리프트를 읽기 전용으로 점검할 때 사용. 앱 데이터 동기화·파일 자동 수정·브랜치 보호 적용은 제외
---

# repo-sync — Codex native wrapper

먼저 `../../../skills/repo-sync/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

현재 agent가 결과를 집계하고, 여러 repo의 독립적 읽기만 플랫폼 subagent에 위임한다.

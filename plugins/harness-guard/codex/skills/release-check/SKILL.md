---
name: release-check
description: 정식 릴리즈 직전에 품질·보안·DB 마이그레이션 준비를 검증할 때 사용. 실제 태그·배포·기능 PR 검증·버그 구현은 제외
---

# release-check — Codex native wrapper

먼저 `../../../skills/release-check/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

현재 agent가 품질·보안·마이그레이션 증거를 종합하고 독립 반증은 읽기 전용으로만 위임한다.

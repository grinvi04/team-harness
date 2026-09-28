---
name: verification-before-completion
description: Harness 프로젝트의 확인·검증·완료·PR·머지·릴리즈 판정에 QA 범위와 증거 계약이 필요할 때 사용. Superpowers 등 일반 검증 방법론과 함께 적용. 구현·실패 수정·delivery 실행 자체는 제외
---

# verification-before-completion — Codex native wrapper

먼저 `../../../skills/verification-before-completion/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

현재 agent가 주장·증거 매핑과 fail-closed 판정을 소유하며 고위험 주장만 읽기 전용으로 독립 반증한다.

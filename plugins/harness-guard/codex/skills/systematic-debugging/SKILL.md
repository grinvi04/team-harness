---
name: systematic-debugging
description: 원인이 불명확한 실패 테스트·CI 오류·빌드 실패·런타임 오동작을 재현하고 가설 실험으로 근본 원인을 확정할 때 사용. 원인이 명확한 구현·광범위 정리·릴리즈는 제외
---

# systematic-debugging — Codex native wrapper

먼저 `../../../skills/systematic-debugging/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

현재 agent가 재현·가설 판별·원인 확정을 소유하고 독립 증거 수집과 반증만 읽기 전용으로 위임한다.

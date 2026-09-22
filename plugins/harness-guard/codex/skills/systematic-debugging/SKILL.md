---
name: systematic-debugging
description: 원인 불명 실패 테스트·CI 오류·빌드 실패·런타임 오동작을 조사할 때 프로젝트 재현 증거·진단 권한·수정 인계를 연결하는 데 사용. 원인이 명확한 구현·광범위 정리·릴리즈는 제외
---

# systematic-debugging — Codex native wrapper

먼저 `../../../skills/systematic-debugging/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

현재 agent가 재현·가설 판별·원인 확정을 소유하고 독립 증거 수집과 반증만 읽기 전용으로 위임한다.

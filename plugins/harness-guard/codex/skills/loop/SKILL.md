---
name: loop
description: 반복 수정으로 명령 exit 0을 달성해야 할 때 사용. CI·lint·기존 테스트·의존성 정리에 적합하며 신규 기능·불명확한 설계·시간 예약 polling은 제외
---

# loop — Codex native wrapper

먼저 `../../../skills/loop/SKILL.md`와 `../../native-runtime.md`를 끝까지 읽고 두 계약을 함께 적용한다.

## Codex 실행

현재 선택 model을 유지하고 timeout·stuck·checkpoint 안전장치 안에서 현재 agent가 종료조건까지 반복한다.

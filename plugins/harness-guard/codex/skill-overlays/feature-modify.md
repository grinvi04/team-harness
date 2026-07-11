## Codex 실행

변경분 RED·구현·회귀 GREEN은 현재 agent가 순차 수행한다. 영향 범위 탐색은 `harness-explorer` (부모 모델 상속, low), 최종 회귀 반증은 `harness-verifier` (부모 모델 상속, high)에만 위임한다.

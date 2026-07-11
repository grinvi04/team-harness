## Codex 실행

Claude의 `subagent_type`·`model`·`run_in_background` 표기는 Claude 경로용 역할 경계다. Codex에서는 테스트 계약·구현·커밋은 현재 agent가 순차 수행한다. 읽기 전용 탐색은 `harness-explorer` (부모 모델 상속, low), 최종 반증은 `harness-verifier` (부모 모델 상속, high)에만 위임한다.

## Codex 실행

Codex에서는 현재 선택된 모델을 그대로 사용하고, 별도 agent가 필요한 경우에도 model slug를 고정하지 않는다.
탐색은 낮은 reasoning effort, 수정·판별은 현재 작업에 필요한 중간 이상 effort로 수행한다. 동일 세션에서
timeout·max·stuck·checkpoint 안전장치를 지키며 통과 기준 명령이 exit 0이 될 때까지만 반복한다.

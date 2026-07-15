## Codex 실행

현재 agent가 재현·가설 판별·원인 확정과, 수정 요청일 때의 RED→GREEN을 순차 수행한다. 진단 전용에서는 파일을 편집하지 않는다. 필요할 때만 `harness-explorer`로 읽기 전용 증거 수집을, `harness-verifier`로 확정 원인과 수정 결과의 독립 반증을 수행하며 최종 판정은 현재 agent가 소유한다.

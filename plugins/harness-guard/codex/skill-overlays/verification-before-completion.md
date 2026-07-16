## Codex 실행

현재 agent가 주장→증거 매핑, 현재 worktree·HEAD 기준 명령 실행, fail-closed 최종 판정을 소유한다. 고위험 주장만 `harness-verifier`에 읽기 전용 독립 반증을 맡길 수 있으며, verifier는 파일 수정·커밋·머지나 완료 선언을 대신하지 않는다. 직접 호출에서 검증이 실패하면 편집하지 않고 결과만 보고한다.

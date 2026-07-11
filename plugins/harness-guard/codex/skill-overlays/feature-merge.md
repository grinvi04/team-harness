## Codex 실행

현재 agent가 품질 검증과 wrapper 실행을 순차로 소유한다. PR diff는 `codex review --base develop`로 검토하고, 독립 근거 수집이나 회귀 재검토만 read-only subagent에 위임한다.

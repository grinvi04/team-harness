# Codex 모델 티어링: 사용자 플랜 상속

Issue: #311

## 목표

Codex custom agent가 특정 model slug를 강제하지 않고 현재 부모 세션의 사용자 플랜·`/model` 선택을
상속하도록 한다. 역할별 비용/품질 티어는 model 이름이 아니라 reasoning effort로 구분한다.

## 근거

Codex 공식 custom-agent 계약에서 `model`과 `model_reasoning_effort`는 선택 필드이며, 생략한 필드는 부모
세션에서 상속한다. 현재 세 agent는 모두 `gpt-5.6-terra`/medium이라 플랜 종속성과 역할 티어가 없다.

## 계약

| 역할 | model | reasoning | 권한 |
|---|---|---|---|
| `harness-explorer` | 부모 세션 상속 | low | read-only |
| `harness-verifier` | 부모 세션 상속 | high | read-only |
| `harness-security-reviewer` | 부모 세션 상속 | high | read-only |
| 구현/수정 | 현재 주 agent | 부모 세션 설정 | 현재 세션 sandbox |

이는 Claude의 Explore=haiku, general-purpose=sonnet, verifier/security=opus 계약을 변경하지 않는다.

## 수용 기준

1. 세 Codex agent TOML에 `model =`이 없다.
2. explorer는 low, verifier/security는 high reasoning effort다.
3. cache patch가 동일 내용을 `~/.codex/agents`에 설치하고 재실행 시 멱등이다.
4. mapping test가 hardcoded model 부재와 역할별 effort/read-only를 검증한다.
5. fresh subagent probe가 부모 세션 모델 상속과 read-only 역할을 확인한다.
6. Claude agent/hook 파일은 변경되지 않는다.

## 롤백

Codex agent TOML과 mapping assertions만 revert한다. Claude 파일은 처음부터 변경하지 않는다.

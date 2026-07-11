# Codex guard runtime 격리

Issue: #319

## 문제

Codex wrapper가 공용 `guard.sh`를 실행해 판정은 재사용하지만 차단 로그와 해결 문구도 Claude 기본값을
그대로 사용한다. Codex 위반 시도가 `~/.claude/hooks/guard-block.log`에 섞이고 사용자에게 “Claude가 대신
실행하지 않음”이라고 표시된다.

## 계약

- direct/Claude 실행 기본값: `~/.claude/hooks/guard-block.log`, agent label `Claude` (불변)
- Codex wrapper: `~/.codex/hooks/guard-block.log`, agent label `Codex`
- 판정, exit 2, 시크릿 마스킹, 로테이션 로직은 Claude 원본 `guard.sh`에서 결정적으로 생성한
  cache 전용 `codex-guard.sh`가 공유한다.
- Claude 원본에는 Codex용 override를 추가하지 않는다. 생성 시 예상 문자열이 없으면 fail-closed한다.

## 수용 기준

1. 기존 guard test의 기본 `.claude` 로그와 Claude 문구가 유지된다.
2. Codex pretool test는 `.codex` 로그 생성, Codex 문구, `.claude` 로그 미생성을 검증한다.
3. harmless/deny/egress 판정과 전체 회귀가 통과한다.
4. Claude hooks/agents/model tiering은 변경하지 않는다.

## 롤백

cache guard 생성과 wrapper 경로 변경, 해당 tests/docs만 revert한다.

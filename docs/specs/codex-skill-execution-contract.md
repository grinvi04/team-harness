# Codex skill 실행 계약과 Git flow 가시성

Issue: #307

## 1. 목표와 문제

team-harness의 14개 skill은 Codex 매핑 문단을 갖지만, `route-intent.mjs`는 Claude식으로
`Skill 도구로 실제 호출`하라고 지시한다. Codex에는 별도 Skill tool-call surface가 없고 `SKILL.md`가 현재
agent의 실행 지침으로 로드된다. 또한 이 차이 때문에 사용자가 Git flow에서 어떤 skill과 phase가 적용되는지
확인하기 어렵다.

**목표:** 도구별 호출 UI가 아니라 같은 실행 결과를 기준으로 skill 계약을 정의하고, Git flow 실행 중 적용
skill과 현재 phase를 사용자에게 보이게 한다.

## 2. 범위

- route-intent의 additional context를 도구 중립 실행 계약으로 변경
- team-harness와 소비 repo AGENTS에 skill 가시성 규칙 추가
- `docs/ai-collaboration.md`에 Claude/Codex skill 실행 모델 차이와 공통 보고 계약 기록
- Codex skill mapping test를 실행 가능한 계약 기준으로 강화
- 결정 기록, 버전, 회귀 테스트

## 3. 비범위

- Claude Code의 slash skill UI, subagent model tiering, hook 계약 제거
- Codex에 별도 Skill tool을 구현하거나 존재한다고 가장하기
- 모든 Claude 역할 주석을 삭제해 Claude 실행 경로를 약화하기
- skill별 업무 절차 자체 변경

## 4. 수용 기준

1. route-intent가 선택한 skill 이름을 유지하되 `Skill 도구` 호출을 요구하지 않는다.
2. 주입 메시지는 해당 `SKILL.md` 절차 적용과 사용자 업데이트에 skill/phase 표시를 요구한다.
3. team-harness AGENTS, 소비 template, AI 협업 정본이 같은 가시성 계약을 가진다.
4. 14개 skill은 `## Codex 실행` 아래 현재 agent의 실행 소유권 또는 Codex-native 대체 경로를 명시한다.
5. route-intent 및 mapping test가 위 계약의 회귀를 차단하고 전체 CI가 통과한다.

## 5. 검증

- `bash tests/route-intent-test.sh`
- `bash tests/codex-skill-mapping-test.sh`
- `bash tests/codex-semantic-parity-test.sh`
- 전체 `tests/*-test.sh`
- `git diff --check`

## 6. 롤백

route message, 문서 규칙, 강화된 assertion을 함께 revert한다. 기존 wrapper와 Claude/Codex cache patch는
변경하지 않는다.

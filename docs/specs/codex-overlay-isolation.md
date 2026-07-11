# Codex overlay 완전 격리

Issue: #323

## 문제

Codex 호환성을 추가하면서 공용 `skills/*/SKILL.md`와 `guard.sh`에 Codex 전용 실행 설명과 runtime
override가 섞였다. Claude 동작은 회귀 테스트를 통과하지만, Claude가 읽고 실행하는 원본 표면이 Codex 도입
전과 바이트 단위로 같다는 더 강한 계약은 충족하지 못한다.

## 계약

- Claude-facing hooks, skills, agents, model hook, `guard.sh`는 유효한 YAML을 위한 3개 frontmatter 문법
  수정을 제외하고 Codex 도입 전 의미를 유지한다.
- Codex 전용 실행 의미는 `codex/skill-overlays/`에 두고 설치 cache의 skill에만 주입한다.
- Codex guard의 로그 경로와 agent label 변환은 설치 cache에 생성한 Codex 전용 guard에만 적용한다.
- Codex patch는 반복 실행해도 overlay, hook, agent, guard 결과가 중복되거나 달라지지 않는다.
- security-guidance와 harness-guard는 계속 enabled 상태이며 Codex 보안 차단 의미를 유지한다.

## 수용 기준

1. Claude-facing 표면의 hash manifest가 유효한 YAML 기준과 일치한다.
2. 14개 Codex overlay가 대응 skill cache에 정확히 한 번 주입된다.
3. Codex cache skill은 유효한 YAML이며 Claude 실행 metadata와 Claude 공동작성 표기를 포함하지 않는다.
4. Codex pretool wrapper는 cache 전용 guard를 실행하고 `.codex` 로그·Codex 문구를 사용한다.
5. 기존 Claude guard test, Codex patch/runtime test, 전체 quality gate가 모두 통과한다.
6. plugin 동작 변경에 맞춰 manifest와 README 버전을 함께 올린다.

## 롤백

overlay, cache 변환·생성 로직, 해당 tests와 version bump만 revert한다. Claude-facing 원본은 롤백 대상이
아니며 기준 상태로 계속 유지한다.

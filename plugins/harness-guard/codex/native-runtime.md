# Codex native 실행 계약

- 공용 skill의 Claude 전용 `subagent_type`·`model`·background 표기는 역할과 권한 경계로 해석한다.
- 현재 agent가 최종 판정과 파일 수정·Git 작업을 소유한다. 독립적인 읽기·반증만 플랫폼이 제공하는
  read-only subagent에 위임할 수 있으며 특정 model slug나 custom agent 설치를 요구하지 않는다.
- Claude 전용 plan mode·slash command·도구 이름은 Codex에서 가장 가까운 현재 기능으로 수행하되,
  수용기준·wrapper·CI·리뷰 게이트는 바꾸지 않는다.
- 공용 skill과 이 문서가 충돌하면 공용 skill의 안전·완료 계약을 우선한다.

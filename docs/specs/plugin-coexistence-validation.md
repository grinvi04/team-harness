# plugin·skill 공존 호환성 검증 스펙

## 1. 목표 & Why

Team Harness profile을 다른 plugin·skill과 함께 clean filesystem session에 배치했을 때, package identity와
파일 무결성을 보존하고 충돌을 fail-closed로 식별한다. 플랫폼이 소유하는 skill discovery와 hook 실행 순서는
복제하지 않는다. **성공 기준: Claude·Codex adapter를 포함한 profile과 외부 fixture의 공존·충돌·경계 테스트가
전부 통과하고 전역 cache/config는 변경되지 않는다.**

제품 방향 판정은 **연결**이다. plugin loading·skill namespace·hook lifecycle은 플랫폼에 위임하고,
Team Harness는 설치 전후 identity·provenance와 모호성 보고만 소유한다.

## 2. Scope

- **In:** clean session의 managed profile + 외부 plugin inventory; Claude/Codex manifest identity;
  `plugin:skill` effective identity; hook event/matcher 중첩 보고; 파일 digest 불변; malformed·duplicate·symlink 거부;
  세 profile과 두 runtime 조합의 matrix 테스트.
- **Out:** 실제 사용자 plugin cache/config mutation; marketplace 설치·공개; LLM 호출; 플랫폼 hook 실행 순서
  에뮬레이션; 특정 외부 plugin 호환 보증; 충돌 자동 수정.

## 3. 수용기준

- **AC-1 (공존):** WHEN managed profile과 서로 다른 ID의 외부 plugin을 검사하면, system SHALL 양쪽을
  inventory하고 호환 판정을 반환하며 어느 파일도 변경하지 않는다.
- **AC-2 (profile matrix):** WHEN repository-only·agent-governed·workflow-assisted와 Claude/Codex 조합을
  검사하면, system SHALL profile doctor의 건강 판정과 활성 package 수를 그대로 반영한다.
- **AC-3 (plugin identity):** IF 두 활성 plugin의 Claude 또는 Codex manifest name이 같거나 한 plugin의 두
  manifest name이 다르면, system SHALL non-zero와 identity conflict를 반환한다.
- **AC-4 (skill namespace):** WHEN 서로 다른 plugin에 같은 basename의 skill이 있으면, system SHALL
  `<plugin>:<skill>` effective identity로 둘을 보존하고 global priority를 주장하지 않는다.
- **AC-5 (hook overlap):** WHEN 둘 이상의 plugin hook이 같은 event와 matcher를 선언하면, system SHALL
  overlap을 `delegated`로 보고하고 실행 순서나 승자를 만들지 않는다.
- **AC-6 (입력 안전):** IF plugin root·manifest·skill·hook이 symlink, 경로 이탈, 비정상 JSON 또는 지원하지
  않는 파일 형식이면, system SHALL 해당 입력을 실행하거나 변경하지 않고 fail-closed한다.
- **AC-7 (clean session):** 검사 전후 외부 plugin tree와 managed profile tree digest가 같고, HOME 및 실제
  Claude/Codex cache/config 경로를 읽거나 쓰지 않는다.

## 4. 제약 / Do-Not

- Node.js 내장 모듈만 사용하고 network·subprocess·사용자 home 없이 읽기 전용으로 동작한다.
- 외부 plugin의 command/hook/script를 실행하지 않는다.
- skill basename 중복만으로 충돌 처리하지 않는다. namespace 의미는 plugin identity가 소유한다.
- hook matcher 중첩을 우선순위로 해석하지 않는다. 실제 lifecycle 검증은 플랫폼의 공식 test surface가
  생기면 대체한다.

## 5. 태스크

| # | 태스크 | AC | 대상 | 검증 |
|---|---|---|---|---|
| 1 | 공존·충돌·경계 계약 RED | AC-1~7 | `tests/plugin-coexistence-test.sh`, fixtures | `bash tests/plugin-coexistence-test.sh` |
| 2 | read-only compatibility inspector 최소 구현 | AC-1~7 | `scripts/check-plugin-coexistence.mjs` | 동일 테스트 |
| 3 | 문서·결정·CI·로드맵 정합성 | AC-1~7 | `docs/`, `.github/workflows/ci-gate.yml` | 전체 quality gate |

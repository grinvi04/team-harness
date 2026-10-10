**기존 발견 4건 모두 수정됐습니다.** 현재 diff·원문을 재확인했으며, 이번 수정 범위에서 새 차단 결함은 발견하지 못했습니다.

- **PKCE:** [auth-standards.md:9](../../auth-standards.md)에 Authorization Code 로그인의 PKCE·S256 적용이 복원됐습니다. OAuth/OIDC 채택 조건 안에 있어 다른 인증 방식에 일괄 강제하지 않습니다.
- **UI 구성 강제:** [frontend-design-standards.md:130](../../frontend-design-standards.md)이 채택한 구성만 확장하고 기존 구조·미지원 다크모드를 보존하도록 바뀌었습니다.
- **한국어 QA:** [qa/SKILL.md:68](../../../plugins/harness-guard/skills/qa/SKILL.md)이 제품의 날짜·통화·톤 계약을 기준으로 검사합니다. 프론트 표준의 연결 안내도 일치합니다.
- **PR envelope 강제:** [PULL_REQUEST_TEMPLATE.md:31](../../../templates/PULL_REQUEST_TEMPLATE.md)이 프로젝트가 선택한 응답·오류 계약으로 변경됐습니다.

데이터 초기화는 [templates/AGENTS.md:83](../../../templates/AGENTS.md)에서 **대상·손실 범위 확인과 승인된 격리 데이터**로 제한됩니다. 실행 가능한 파괴 명령 예시는 제거됐고 운영 조작 금지도 유지됩니다.

QA 원문 SHA-256은 갱신된 fixture와 일치했고 `git diff --check`도 통과했습니다. 운영 릴리즈 절차의 자체 적용 범위와 Next 캐시 링크 변경도 확인했습니다.

읽기 전용 호출 3회, 수정·원격 작업·스택 실행 없음. 외부 링크 원문 확인과 전체 quality 판정은 상위 작업의 책임으로 남깁니다.

보관 시 링크 대상만 저장소 상대 경로로 바꿨다. 표시된 원래 행 번호와 검토 판단은 보존했다.

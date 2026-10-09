**두 P2 모두 해결됐습니다.** 검토 후보는 HEAD `94b72e2`와 현재 작업 변경입니다.

- **다중통화 강제 — 해결.** [frontend-design-standards.md:94](../../frontend-design-standards.md)는 제품의 환산·표시 계약을 따르고, 환산 합계 표시는 선택으로 제한합니다. 통화별 표시를 허용하면서 서로 다른 통화의 단순 합산 금지도 유지합니다.
- **Minitest 적용 조건 — 해결.** [ruby.md:24](../../../templates/rules/stacks/ruby.md)는 일반 `Minitest::Test`의 `def test_…`와 Rails `ActiveSupport::TestCase`의 블록 DSL을 구분합니다. [Rails 공식 설명](https://guides.rubyonrails.org/testing.html#writing-your-first-test)과 일치하며 설치 버전 대조도 명시합니다. 기존 보안·마이그레이션 안전 규칙은 보존됐습니다.

갱신된 스펙·results.json은 수정 내용과 기존 머지 차단을 구분합니다. 원문 해시 **42개 모두 일치**, 지정 변경의 `git diff --check`도 통과했습니다.

**이 검토 범위의 남은 차단 발견은 없습니다.** 브랜치 보호 조회 거부라는 기존 머지 차단은 기록상 남아 있으며, 이번에는 원격 gate·전체 quality·소비 앱 실행을 확인하지 않았습니다. 파일 수정·Git 변경·위임·Claude 호출 없이 종료합니다.
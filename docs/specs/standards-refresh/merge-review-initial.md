후보 `94b72e2`를 기준 `d384c57`과 대조했습니다. **수정이 필요한 P2 발견 2건입니다.**

1. **다중통화 표시 방식을 공통으로 강제합니다.** [frontend-design-standards.md:94](../../frontend-design-standards.md)의 “기준통화 합계 헤드라인”은 환산 합계를 제공하지 않는 제품에도 적용됩니다. 제품별 선택을 보존한다는 AC1과 충돌합니다. **환산 합계를 채택한 제품의 선택 예시로 제한하고, 통화별 표시도 허용하세요.**

2. **복원한 Minitest 문법의 적용 조건이 부정확합니다.** [ruby.md:24](../../../templates/rules/stacks/ruby.md)는 일반 Minitest에서도 `test '…' do`를 사용할 수 있다고 안내합니다. 이는 Rails가 추가하는 DSL입니다. 로컬 Minitest 5.11.3의 `Minitest::Test`에서 해당 호출은 `ArgumentError`로 실패했습니다. **일반 Minitest의 `def test_…`와 Rails `ActiveSupport::TestCase`의 블록 문법을 구분하세요.** [Rails 공식 설명](https://guides.rubyonrails.org/testing.html#writing-your-first-test)

기존 네 발견의 수정, PKCE·금액·CSV 핵심 보존, 익명화된 workdir, 현재 원문 해시 42개 일치를 확인했습니다. Markdown 299개 구조·참조 검사는 실패 0이며, `git diff --check`도 통과했습니다. 검토 범위에서 허위 LLM·CI 완료 주장은 발견하지 못했습니다.

한계: 전체 quality·소비 앱은 재실행하지 않았고, 원격 CI 5개 성공은 사용자 제공 정보입니다. 외부 원문은 Ruby 판단에 필요한 자료만 재확인했습니다. 파일 수정·위임·원격 쓰기는 수행하지 않았습니다.
---
paths: ["**/*.rb", "Gemfile"]
---

# Ruby / Rails 작업 규칙

프로젝트의 Ruby·Rails·DB·테스트 도구를 따른다. 공통 적용 기준은 `docs/standards-scope.md`다.

## 검사와 안전 경계

RuboCop은 채택한 cop·확장·버전으로 CI에 연결한다.
안전 자동 수정부터 적용하고 `-A`의 위험 수정은 diff와 회귀 검사로 확인한다.
[RuboCop 공식 안내](https://docs.rubocop.org/rubocop/usage/autocorrect.html)를 따른다.

- SQL 문자열에 사용자 값을 삽입하지 않는다. 바인딩을 사용한다.
- mass assignment는 설치 버전의 Strong Parameters로 허용 필드를 정한다.
- 사용자 입력을 eval·동적 send·html_safe/raw로 실행하거나 신뢰하지 않는다.
- 비밀정보를 코드·로그에 넣지 않는다. 배포 환경의 보호된 값 주입을 사용한다.
- 4xx와 서버 실패를 실제 request 테스트로 구분한다. 응답 형식은 프로젝트 계약을 따른다.

## 테스트와 마이그레이션

RSpec·Minitest 등 프로젝트의 검사로 변경 동작과 실패·거부 경계를 확인한다.
적용한 migration은 수정하지 않는다. 생성된 초안은 적용 전 검토한다.
DB 호환·잠금·데이터 이관은 `docs/stack-troubleshooting-database.md`를 따른다.
Strong Migrations는 선택 도구다. 설치하지 않은 검사가 CI에서 실행된다고 보고하지 않는다.

하네스의 테스트·마이그레이션 삭제 가드는 유지한다. 정당한 제거도 기존 권한과 PR 계약을 따른다.
연결된 `check-activerecord-destructive-ddl.mjs`는 change/up의 알려진 파괴 호출·raw SQL 일부를 검사한다.
helper·동적 SQL·remove_reference 등 전체 실행을 해석하지 않는다. down은 검사 대상이 아니어도 실행 안전을 보장하지 않는다.
승인 마커는 기존 검토 계약의 표시이며 운영 접근 권한을 만들지 않는다.

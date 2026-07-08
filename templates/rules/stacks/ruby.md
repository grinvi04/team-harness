---
paths: ["**/*.rb", "Gemfile"]
---

# Ruby / Rails 작업 규칙

## 포맷·린트는 RuboCop이 강제 (prose 아님)
- **RuboCop(린트 + `-a`/`-A` 포맷)이 빌드 게이트**다. CI(ci-gate-rails)가 어긋난 코드를 차단한다.
- 자동수정: `bundle exec rubocop -A` (커밋 전). 손으로 포맷 맞추지 말 것.
- `.rubocop.yml`에 넣을 설정 (rubocop-rails·rubocop-rspec·rubocop-performance 확장):

```yaml
require:
  - rubocop-rails
  - rubocop-performance
  - rubocop-rspec

AllCops:
  TargetRubyVersion: 3.3
  NewCops: enable
  Exclude:
    - "db/schema.rb"
    - "bin/**/*"
    - "vendor/**/*"

Style/Documentation:
  Enabled: false
Metrics/MethodLength:
  Max: 20
```

- CI(ci-gate-rails)에 스텝: `bundle exec rubocop`. 통과해야 머지.

## 절대 금지 (보안)
```ruby
User.where("name = '#{params[:q]}'")   # ❌ SQL 인젝션 → where("name = ?", params[:q]) 또는 sanitize_sql
User.new(params[:user])                # ❌ mass-assignment → params.require(:user).permit(:name, ...)
eval(user_input) / send(params[:m])    # ❌ 임의코드/메서드 실행 → 화이트리스트 검증
html_safe / raw(user_input)            # ❌ XSS → 이스케이프 유지, sanitize 헬퍼 사용
```
- `Rails.application.credentials` / ENV로 시크릿 관리 — 코드·로그에 하드코딩 금지(secret-scan 게이트).
- Strong Parameters 필수 — 컨트롤러에서 `params.require(...).permit(...)`로 화이트리스트.

## 입력 오류는 4xx (단일 출처: `docs/api-standards.md`)
- 검증 실패(`record.invalid?`·`ActiveRecord::RecordInvalid`)는 422, 미존재는 404로 매핑 — 미처리 예외가
  500으로 흡수되지 않게 `rescue_from`으로 공통 Envelope에 매핑(`docs/api-standards.md`).

## 테스트 (rspec / minitest)
- 외부 경계(HTTP·시간·외부 API)만 test double — 내부 구현·private에 결합 금지(brittle test).
- rspec: `it/describe/context '…' do` 블록. request spec으로 컨트롤러 계약(상태코드·바디)을 검증.
- minitest: `test '…' do` 또는 `def test_…`. `ActiveSupport::TestCase` 기반.
- ⚠️ **테스트/마이그레이션 파일 삭제 금지** — `*_spec.rb`·`*_test.rb`·`db/migrate/*.rb`는 guard.sh가
  삭제를 차단하고(게이트 무력화 방지), test-guard(CI)가 마커 감소를 잡는다. 정당한 제거는 PR에
  `allow-test-removal` 라벨.

## ActiveRecord 마이그레이션 안전 (단일 출처: `docs/db-standards.md`)
- **forward-only**: 컬럼·테이블 즉시 삭제/rename 금지 → deprecate 후 다음 릴리즈에 제거(운영 데이터 보호).
- **적용 순서**: `bin/rails db:migrate`로만 적용, 생성된 마이그레이션은 반드시 검토 후 적용. 이미 적용·배포된
  마이그레이션 파일 직접 수정 금지 — 기존·운영 DB에 새 마이그레이션이 누락·역행 없이 증분 적용되는지 실 DB로 검증.
- **파괴 DDL 차단(CI)**: `check-activerecord-destructive-ddl.mjs`(destructive-ddl.yml 3번째 스텝)가
  `db/migrate/*.rb`의 `def change`/`def up` 본문에서 `drop_table`·`drop_join_table`·`remove_column(s)`,
  그리고 `execute` 내 raw `DROP`/`TRUNCATE`(heredoc 포함)를 차단한다(CI 빈 DB는 통과·운영에서만 비가역 손실).
  `def down`(역방향=롤백)의 파괴 op는 정상이라 비대상. 정당한 forward-only 2단계 배포의 컬럼 제거는 파괴
  호출과 같은 줄(트레일링) 또는 바로 앞 줄의 승인 주석 `# migration-safety: destructive-ok`로 통과.
  지문(`< ActiveRecord::Migration` + `def change`/`up`/`down`) 없으면 self-skip.
  - **게이트 비대상(계층0 한계)**: `remove_index`·`remove_foreign_key`(행-손실 아님, 오탐 방지),
    `remove_reference`, `def change`/`up` 밖 헬퍼·동적 SQL·`%` 리터럴 속 DROP은 미검출 — prose로 보완.

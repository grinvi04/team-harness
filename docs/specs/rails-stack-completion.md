# rails-stack-completion — 스펙 & 플랜

> `/plan` 산출물(승인 2026-07-08). `/feature-add`가 이 문서를 `docs/specs/`로 커밋(guard F5).
> ⚠️ **L 규모(3 워크스트림)** — 한 세션 몰아치기 금지. 권장 청킹: ①T0~T2(spec·ruby.md·test-guard) → ②T3~T4(DDL 게이트, 최대) → ③T5~T6(배선·문서). 각 태스크=원자적 커밋.

## Context — 왜 이 변경인가

마일스톤 [audit-followup #2](https://github.com/grinvi04/team-harness/milestone/1). Rails 프로젝트 임박(2026-07) → 착수 전 완전 배선.

**원본 재확인(원칙 6·9, Explore 3-fan-out 실측):** Rails는 `new-repo.sh` 메뉴 **옵션 6**으로 노출돼 있으나 **미완 배선**:
- `scripts/new-repo.sh:57` — `6) STACK_TEMPLATE="ci-gate-rails.yml"; STACK_CHECKS=("quality" "secret-scan"); STACK_RULES=()` → **STACK_RULES 비어 있음**(rules 문서 0). `ci-gate-rails.yml`은 존재(rubocop+test).
- **`db/migrate/*.rb`(ActiveRecord) 파괴 DDL 무방비** — `check-destructive-ddl.mjs`는 `*.sql` 전용, `check-alembic-destructive-ddl.mjs`는 `.py` 전용. Rails `drop_table`·`remove_column`은 어느 게이트에도 안 걸림(alembic #1과 동형 갭).
- **rspec test-guard 사각** — `guard.sh:261` 삭제-보호 정규식은 `_spec.rb`·`_test.rb`·`db/migrate/` 미포함(Java/Python/JS만). `test-guard.yml:39` MARKER는 rspec `it '...' do`(괄호 없음) 미매칭. ⚠️ `guard.sh:247`는 #245로 **bare `spec/`를 의도적 제외**(OpenAPI `spec/`와 다의).
- `check-repo-sync.mjs`에 `rails`/`ruby` 스택 감지·룰 검증 없음.

**의도한 결과:** 메뉴에 노출된 Rails가 다른 스택과 동등한 거버넌스(rules·파괴 DDL 게이트·test-guard)를 갖고 태어난다.

**확정 설계 결정(사용자 승인 2026-07-08):**
1. **별 파일** `scripts/check-activerecord-destructive-ddl.mjs` — Alembic 게이트 구조 미러링, 바이트-무변경(외과적). destructive-ddl.yml **3번째 스텝** 편승.
2. **단일 `ruby.md`** — RuboCop·보안·rspec + ActiveRecord 마이그레이션 안전(DDL 게이트 교차참조) 한 문서. `STACK_RULES=("ruby")`.
3. **명확한 행-손실 세트** — `drop_table`·`drop_join_table`·`remove_column`·`remove_columns` + `execute` 내 raw DROP/TRUNCATE. `remove_index`/`remove_foreign_key` 비대상(오탐 금지), `remove_reference`는 계층0 문서화.

정본: `docs/decisions.md`(파괴 DDL 게이트 v0.29.28/v0.31.0/v0.32.0), `docs/db-standards.md`, `docs/specs/alembic-destructive-ddl.md`(설계 선례), `guard.sh:247` #245 결정.

## 1. 목표 & Why

Rails 스택을 완전 배선한다: ① `ruby.md` rules, ② `db/migrate/*.rb` 파괴 DDL 정적 게이트(`def change`/`def up` 스캔, `def down` 제외), ③ rspec/minitest test-guard. **성공 기준: Rails repo가 `new-repo.sh`로 생성되면 ruby.md·activerecord 파괴 DDL 게이트·rspec test-guard가 자동 배선되고, `drop_table` in `def change`가 승인마커 없이 exit 1로 차단된다.**

## 2. Scope

- **In:** `templates/rules/stacks/ruby.md` · `scripts/check-activerecord-destructive-ddl.mjs`(Ruby 토크나이저 + ActiveRecord DSL) + 반증 픽스처·테스트 · `guard.sh` 삭제-보호에 `_spec.rb`·`_test.rb`·`db/migrate/` 추가 · `test-guard.yml` MARKER에 rspec/minitest 추가 · `new-repo.sh` 옵션6 `STACK_RULES=("ruby")` + 스크립트 복사 · `destructive-ddl.yml` 3번째 스텝 · `check-repo-sync.mjs` rails 스택 감지·ruby.md·activerecord 게이트 검증 · `ci-gate.yml` 등록 · 문서 + 버전 bump.
- **Out (Non-goals):** SQL·Alembic 게이트(`check-destructive-ddl.mjs`·`check-alembic-destructive-ddl.mjs`) 로직 변경(바이트-무변경) · `ci-gate-rails.yml` 테스트 프레임워크 기본값 변경(minitest 기본 + rspec CUSTOMIZE 주석 유지 — test-guard가 둘 다 커버) · `def down`/비-마이그레이션 헬퍼 스캔 · bare `spec/` 삭제-보호(#245 다의성 유지) · Hotwire/뷰 QA · guard.sh env-blind 변경.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

**A. ActiveRecord 파괴 DDL 게이트**
- **AC-1 (정상·차단):** WHEN `def change`/`def up`에 승인마커 없는 `drop_table`·`drop_join_table`·`remove_column(s)`가 있으면 SHALL exit 1.
- **AC-2 (승인마커):** WHEN 파괴 호출 같은 줄(트레일링) 또는 바로 앞 줄에 `# migration-safety: destructive-ok`가 있으면 SHALL exit 0.
- **AC-3 (execute raw + heredoc):** WHEN `def change`/`def up`의 `execute("…DROP TABLE/TRUNCATE…")` **또는 heredoc `execute(<<~SQL … DROP TABLE … SQL)`**가 승인마커 없이 있으면 SHALL exit 1(heredoc 본문 인식 필수).
- **AC-4 (down 무시 · 회귀 가드):** WHILE 파괴 op가 `def down`에만 있으면 SHALL exit 0(역방향=롤백, alembic downgrade-only와 동형).
- **AC-5 (마커 스푸핑):** IF 마커가 Ruby 문자열/`=begin` 블록 안이면 크레딧 거부 → SHALL exit 1.
- **AC-6 (키워드 스푸핑):** WHILE 파괴 키워드가 `#` 주석·문자열·`=begin/=end`·heredoc 본문(비-execute) 안에만 있으면 SHALL exit 0.
- **AC-7 (비 행-손실 · 오탐 금지):** WHILE `change`가 `remove_index`/`remove_foreign_key`만 쓰면 SHALL exit 0.
- **AC-8 (skip):** IF ActiveRecord 마이그레이션 없으면 SHALL exit 0(self-skip).
- **AC-9 (문장/블록 단위):** WHILE 안전 op + 미승인 파괴 op 혼재면 파일 사면 없이 SHALL exit 1.
- **AC-10 (인터페이스):** `--help`→0, 미인식 플래그→2.
- **AC-11 (마이그레이션 식별):** `.rb`는 `< ActiveRecord::Migration` + `def (change|up|down)` 지문일 때만 스캔; 비-마이그레이션 `.rb`는 SHALL NOT 스캔.

**B. rspec/minitest test-guard**
- **AC-12 (삭제 차단·로컬):** WHEN `rm`/`git rm`이 `*_spec.rb`·`*_test.rb`·`db/migrate/*.rb`를 지우려 하면 guard.sh SHALL 차단. WHILE bare `spec/`(비-`.rb`)는 #245대로 SHALL NOT 차단(다의성).
- **AC-13 (마커 카운트·CI):** WHEN PR이 rspec `it/describe/context '…' do`·minitest `test '…' do` 예제를 감소시키면 test-guard.yml MARKER가 SHALL 감지(카운트 하락→exit 1).

**C. 스택 배선**
- **AC-14 (rules):** WHEN 옵션6(Rails) 선택 시 `.claude/rules/ruby.md`가 SHALL 복사.
- **AC-15 (게이트 배선):** WHEN Rails repo 생성 시 `destructive-ddl.yml`이 activerecord 스텝을 포함하고 `check-activerecord-destructive-ddl.mjs`가 복사되며, `check-repo-sync`가 rails 스택을 감지해 ruby.md·activerecord 게이트 존재를 SHALL 검증.

## 4. 제약 / 비기능

- **무의존:** Node 표준 라이브러리만(SQL·Alembic 게이트와 동일).
- **결정적·반증:** 통과가 아니라 우회 실패로 확정(원칙 6). Alembic #1이 리뷰 반증에서 12개 우회가 나온 전례 → **이 게이트도 적대적 리뷰로 반드시 재검증**(heredoc·%리터럴·별칭 우회 집중).
- **문서화된 한계(계층0):** `def change`/`up` 밖 헬퍼·동적 SQL·%리터럴 속 DROP·`remove_reference`·정규식 리터럴 속 키워드는 미검출.

## 5. 경계 / Do-Not

- ✅ 해도 됨: 새 게이트·픽스처·ruby.md 작성, guard.sh 정규식에 `.rb` 접미 추가, destructive-ddl.yml 스텝 추가, test-guard MARKER 확장.
- ⚠️ 먼저 물어봐: bare `spec/` 삭제-보호(#245 뒤집기), ci-gate-rails 테스트 프레임워크 기본값 변경, `def down` 스캔, SQL/Alembic 게이트 로직 변경.
- 🚫 절대 금지: `check-destructive-ddl.mjs`·`check-alembic-destructive-ddl.mjs` 로직 수정, guard.sh env-blind화, 테스트/픽스처 우회-완화, 버전 bump 누락.

## 6. Open Questions

- 없음(3 설계 결정 승인 완료). 실 Rails repo 부재(2026-07 임박) → 검증은 Rails-doc 정확 픽스처 + 적대적 리뷰로(webhook-service 같은 실 데이터 대조는 불가 — 한계 명시).

## 7. 기술 접근 (HOW)

### 게이트 `scripts/check-activerecord-destructive-ddl.mjs` (Alembic 게이트 미러링)
- **재사용(Alembic 게이트 동형):** `walk()` 파일탐색 · `normalizeSql()`(execute raw SQL의 `/* */`·`--`·SQL 문자열 제거 — 블록주석 토큰분리 차단) · `SQL_DESTRUCTIVE` 세트 · `MARKER_RE` + 트레일링/앞줄 마커 · forward-only 스코프(=`def change`/`def up` 스캔, `def down` 제외) · self-skip/`--help`/badflag.
- **재작성(Ruby 문법):** 토크나이저 — Ruby `#` 라인주석(동일)·`=begin`/`=end` 블록주석(줄-앵커)·`'…'`/`"…"` 문자열·**heredoc `<<~`/`<<-`/`<<`(`'`/`"` 포함) 본문 인식(execute raw SQL의 핵심 관용구)**·`%w[]`/`%q()` 등 %리터럴(best-effort). 논리 문장 경계·괄호 depth·col0 스코프 추적은 Alembic 통합 토크나이저 방식 차용(line-based 추출 금지 — #1 반증 교훈).
- **파괴 판정(수신자 무관):** `/\bdrop_table\s*[( ]/`·`/\bdrop_join_table\s*[( ]/`·`/\bremove_columns?\s*[( ]/`(ActiveRecord DSL은 괄호 생략 가능 → `\s*[( ]` 허용) · `execute` 문장이면 `strings`(heredoc 본문 포함)에 `normalizeSql`→`SQL_DESTRUCTIVE`. 비대상 `remove_index`/`remove_foreign_key`(AC-7).
- **지문:** `/<\s*ActiveRecord::Migration/` **그리고** `/\bdef\s+(change|up|down)\b/`.

### rspec/minitest test-guard
- `guard.sh:261` 정규식에 `_spec\.rb`·`_test\.rb`·`(^|/)db/migrate(/|$)` 추가(접미-특정 — bare `spec/` 불추가로 #245 유지).
- `test-guard.yml:39` MARKER에 `(^|[^A-Za-z_])(it|describe|context|specify|scenario|feature|test)[[:space:]]+["']` 추가(rspec/minitest 블록 DSL).

### 배선(Alembic #1 선례 그대로)
- `new-repo.sh`: 옵션6 `STACK_RULES=("ruby")`; `check-activerecord-destructive-ddl.mjs` 무조건 복사(SQL·alembic 스크립트 옆).
- `templates/ci/destructive-ddl.yml`: 3번째 스텝 `node scripts/check-activerecord-destructive-ddl.mjs`.
- `check-repo-sync.mjs`: `hasRails = hasFile(/^Gemfile$/)` → `stacks.rails`; `ruleMap`에 `['ruby', stacks.rails]`; activerecord 스텝 sentinel(`/check-activerecord-destructive-ddl/i`) + 스크립트 existsAnywhere(applicable:true).
- `ci-gate.yml`: `node --check` + `bash -n` + 테스트 스텝.

### 테스트 전략 (AC ↔ 픽스처 1:1, 반증)
`tests/activerecord-destructive-ddl-test.sh` + `tests/fixtures/activerecord-destructive-ddl/**/db/migrate/*.rb`: bad(drop_table in change·remove_column in up·execute heredoc DROP·마커-문자열 스푸핑·혼재·별칭우회) · good(down-only·remove_index·`=begin` 스푸핑·heredoc 비-DDL·마커 트레일링/앞줄·비-마이그레이션·skip-empty). guard-test.sh에 `.rb` 삭제-차단·bare-spec 미차단 케이스. 적대적 리뷰로 heredoc/%리터럴 우회 재검증.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC | 대상 파일 | 검증(exit 0) | 의존 |
|---|---|---|---|---|---|
| 0 | 스펙 커밋 | — | `docs/specs/rails-stack-completion.md` | 파일 존재(F5) | — |
| 1 | ruby.md rules 작성 [P] | AC-14 | `templates/rules/stacks/ruby.md` | `bash tests/repo-sync-test.sh`(추후 ruleMap 후) · 프론트matter 유효 | #0 |
| 2 | rspec/minitest test-guard | AC-12,13 | `guard.sh`, `templates/ci/test-guard.yml`, `tests/guard-test.sh`(케이스) | `bash tests/guard-test.sh`·`bash tests/guard-matrix-test.sh` PASS | #0 |
| 3 | 게이트 반증 픽스처+실패 테스트(RED) | AC-1~11 | `tests/activerecord-destructive-ddl-test.sh`, `tests/fixtures/activerecord-destructive-ddl/**` | 테스트 FAIL(스크립트 부재=RED)·`bash -n` | #0 |
| 4 | 게이트 구현(GREEN) | AC-1~11 | `scripts/check-activerecord-destructive-ddl.mjs` | `bash tests/activerecord-destructive-ddl-test.sh` PASS·`node --check` | #3 |
| 5 | 배선 | AC-14,15 | `new-repo.sh`, `templates/ci/destructive-ddl.yml`, `check-repo-sync.mjs`, `.github/workflows/ci-gate.yml`, repo-sync fixtures | `bash tests/repo-sync-test.sh`·`bash tests/new-repo-test.sh` PASS | #4 |
| 6 | 문서 + 버전 bump | — | `docs/decisions.md`, `docs/db-standards.md`, `docs/stack-guide.md`, `plugin.json`, `README.md` | 영향 테스트 PASS·plugin.json 유효·배지 일치 | #4 |

> 각 태스크=원자적 커밋=롤백 1단위. #1·#2는 독립(revert 가능), #4~6은 위에 쌓임(fix-forward). #3→#4는 RED→GREEN.

## 검증 (end-to-end)

1. **게이트:** `bash tests/activerecord-destructive-ddl-test.sh` exit 0. 반증: down-only 통과(오탐0), drop_table in change exit1, `execute(<<~SQL … DROP TABLE … SQL)` exit1, 마커-문자열 스푸핑 exit1.
2. **적대적 리뷰(필수, #1 교훈):** `/code-review high` + 반증 finder로 heredoc·%리터럴·별칭·=begin 우회 직접 시도 → 발견 봉쇄·회귀 픽스처 박제. **conformance-green은 증거 아님.**
3. **test-guard:** `bash tests/guard-test.sh`(`.rb` 삭제 차단·bare `spec/` 미차단 확인)·`bash tests/guard-matrix-test.sh`.
4. **배선:** `bash tests/repo-sync-test.sh`·`bash tests/new-repo-test.sh`; 옵션6 dry-run으로 ruby.md·activerecord 스크립트·3-스텝 워크플로 배선 확인.
5. **CI 품질 잡 로컬 재현** 전량 + 버전 일관(plugin.json↔README).
6. **PR:** `pr-create.sh --milestone audit-followup`로 #2 연결.
7. **한계 명시(원칙 7):** 실 Rails repo 부재라 실 데이터 대조 불가 — Rails-doc 정확 픽스처 + 적대적 리뷰로 갈음, 커버리지 한계 정직 보고.

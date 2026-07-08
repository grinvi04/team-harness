# alembic-destructive-ddl 스펙

> 근거 마일스톤: [GitHub #1 audit-followup](https://github.com/grinvi04/team-harness/milestone/1) 최우선 항목. 승인 2026-07-08.
> **한 기능 = 한 브랜치 = 한 PR**: `feature/alembic-destructive-ddl`에서 태스크별 원자 커밋(0 스펙 → 1 RED → 2 GREEN → 3 배선 → 4 문서).

## Context — 왜 이 변경인가

정합성 감사(2026-07-08)가 드러낸 **실사용 스택 커버리지 갭**의 최우선 항목.

**원본 재확인(원칙 6·9) 결과:**
- `scripts/check-destructive-ddl.mjs`는 `db/migration`·`prisma/migrations`·`supabase/migrations` 하위 **`*.sql` 내용 전용**이고, docstring(L23)·help(L42)에서 **Alembic `.py`는 명시적 비대상**("alembic-heads 소관")이라고 선언한다.
- `templates/ci/alembic-heads.yml`은 **다중 head(분기 순서)만** 보지 파괴 DDL은 안 본다.
- **webhook-service는 실제로 Alembic을 쓴다** — `alembic.ini`(`script_location = alembic`) + `alembic/versions/*.py` 2개 리비전 확인. 그 중 `op.drop_column("webhook_events", "event_id")`가 **어떤 게이트에도 안 걸린다** → 운영에서 `alembic upgrade`가 비가역 데이터 손실을 낼 수 있는 라이브 노출.

**핵심 발견(원칙 5 — 연결로 봄):** 정상 autogenerate 마이그레이션은 `downgrade()`에 파괴 op를 **항상** 담는다(예: `upgrade`의 `add_column`을 `downgrade`의 `drop_column`으로 되돌림). 따라서 **파일 전체를 스캔하면 정상 마이그레이션 거의 100%가 오탐**된다 → 게이트는 배포 시 실행되는 **`upgrade()` 본문만** 스캔해야 하고, 이것이 SQL 게이트가 "앞으로 적용되는 마이그레이션 파일"을 스캔하는 것과 정확히 동형이다.

**의도한 결과:** Alembic `.py` 마이그레이션의 `upgrade()` 경로에 있는 승인마커 없는 파괴 DDL을 CI에서 결정적으로 차단한다. 정당한 forward-only 2단계 배포는 SQL판과 동형인 승인마커로 통과. guard.sh(env-blind)는 무변경, 정적 게이트만.

**확정된 설계 결정(사용자 승인 2026-07-08):**
1. **별 파일** `scripts/check-alembic-destructive-ddl.mjs` — SQL 게이트는 바이트-무변경(외과적 수정 + 마일스톤 Non-goal "SQL 파서 추가 강화 안 함" 준수). 선례: alembic-heads가 migration-safety와 별 게이트인 것과 동형.
2. **op.execute() 안 raw DROP 포함** — `upgrade()`의 `op.execute("DROP TABLE …")`도 SQL판 키워드 세트로 검사(우회 차단, 원칙 6).
3. **기존 `destructive-ddl.yml`에 스텝 추가** — 별 워크플로/required check 신설 없이 항상-설치·self-skip 패턴에 편승(순수 정적 스캔이라 pip/alembic 런타임 불필요).

정본 문서: `docs/decisions.md`(파괴 DDL 게이트 v0.29.28 + 블록주석 봉쇄 v0.31.0), `docs/db-standards.md`(forward-only·2단계 배포), `templates/rules/stacks/alembic.md`.

## 1. 목표 & Why

Alembic `.py` 마이그레이션의 `upgrade()` 경로에 있는 승인마커 없는 파괴 DDL(`op.drop_table`·`op.drop_column`·`op.execute` 내 DROP/TRUNCATE)을 배포 전 결정적으로 차단한다. **성공 기준: webhook-service의 현행 `op.drop_column` 노출이 게이트로 봉쇄되고(승인마커 없으면 exit 1), 정상 autogenerate 마이그레이션(downgrade-only 파괴)은 오탐 0으로 통과.**

## 2. Scope

- **In:** 신규 `scripts/check-alembic-destructive-ddl.mjs`(Node 무의존 정적 스캐너) · `upgrade()` 본문의 `op.drop_table`/`op.drop_column`/`op.execute(raw DROP)` 탐지 · 승인마커 `# migration-safety: destructive-ok` 예외 · Python-인식 반-스푸핑 토크나이저 · 반증 픽스처 + `tests/alembic-destructive-ddl-test.sh` · 기존 `destructive-ddl.yml` 스텝 편승 + `new-repo.sh` 동기화 + `check-repo-sync.mjs` 규칙 + ci-gate.yml 등록 · 문서(decisions/db-standards/alembic.md/교차참조) + 버전 bump.
- **Out (Non-goals):** SQL 게이트(`check-destructive-ddl.mjs`) 파서 변경(바이트-무변경) · `downgrade()`/헬퍼 함수/모듈-레벨 코드 스캔(upgrade()만) · 동적 SQL 조립·암묵적 문자열 연결(`"DR""OP"`) 검출(계층0·문서화된 한계) · guard.sh 변경 · 별 CI 워크플로/required check 신설 · Rails 스택(마일스톤 #2 별건).

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (정상·차단):** WHEN 마이그레이션 `upgrade()`에 승인마커 없는 `op.drop_table(...)` 또는 `op.drop_column(...)`이 있으면, the system SHALL exit 1.
- **AC-2 (정상·마커 통과):** WHEN 파괴 op 문장과 **같은 논리 문장**에 실제 `#` 주석 `# migration-safety: destructive-ok`가 있으면, the system SHALL exit 0.
- **AC-3 (op.execute):** WHEN `upgrade()`의 `op.execute("… DROP TABLE/TRUNCATE/DROP COLUMN …")`가 승인마커 없이 있으면 SHALL exit 1; 같은 문장 마커가 있으면 SHALL exit 0.
- **AC-4 (downgrade 무시 · 회귀 가드):** WHILE 파괴 op가 `downgrade()`에만 있으면(정상 autogenerate 역방향), the system SHALL exit 0. ← **핵심 오탐 방지**
- **AC-5 (마커 스푸핑):** IF 마커 문자열이 Python **문자열 리터럴**(실제 `#` 주석 아님) 안에 있으면 THEN 크레딧 거부 → SHALL exit 1.
- **AC-6 (키워드 스푸핑):** WHILE 파괴 키워드(`op.drop_table`·`DROP TABLE`)가 문자열 리터럴·docstring·`#` 주석 **안에만** 있으면, the system SHALL exit 0.
- **AC-7 (비 데이터-손실 op · 오탐 금지):** WHILE `upgrade()`가 `op.drop_index`/`op.drop_constraint`만 쓰면(행 손실 아님), the system SHALL exit 0. (SQL판 DROP INDEX/CONSTRAINT 비대상과 동형)
- **AC-8 (skip · 오탐 금지):** IF Alembic 마이그레이션 파일이 없으면 THEN SHALL exit 0(self-skip).
- **AC-9 (문장 단위 · 사면 아님):** WHILE 한 파일에 안전 `upgrade()`와 미승인 파괴 op가 혼재하면, 파일 사면 없이 SHALL exit 1. (SQL판과 동형)
- **AC-10 (인터페이스):** `--help` → exit 0; 미인식 플래그 → exit 2. (SQL판 S2 규약 동형)
- **AC-11 (마이그레이션 식별 · 오탐 금지):** `.py` 파일은 Alembic 마이그레이션 지문(`from alembic`/`import alembic` **또는** `revision =` 식별자, **그리고** `def upgrade`/`async def upgrade`)이 있을 때만 스캔; 비-마이그레이션 `.py`는 SHALL NOT 스캔.
- **AC-12 (수신자 무관 탐지):** WHEN `upgrade` 계열 함수(`upgrade`·multidb `upgrade_engineN`)에서 `batch_op.drop_column`(batch_alter_table 컨텍스트)·별칭(`o.drop_table`) 등 수신자가 `op.`가 아닌 파괴 호출이 있으면, the system SHALL exit 1.
- **AC-13 (execute SQL 정규화):** WHILE `execute()` 인자 raw SQL이 블록주석 토큰-분리(`DROP<블록주석>TABLE`)로 키워드를 쪼개거나 SQL 문자열 리터럴 안에 키워드를 담아도, the system SHALL SQL 주석·문자열을 제거 후 판정한다(우회 차단 + 데이터 문자열 오탐 금지 — SQL판 v0.31.0 봉쇄와 동형).
- **AC-14 (앞줄 승인마커):** WHEN 파괴 op 바로 앞 줄에 실제 `#` 주석 승인마커가 있으면, the system SHALL exit 0(자연스러운 Python 스타일 — 트레일링과 동등 크레딧, 단 바로 다음 문장에만).

## 4. 제약 / 비기능

- **무의존:** Node 표준 라이브러리만(SQL판과 동일). alembic/Python 런타임 실행 안 함(순수 텍스트 정적 스캔).
- **결정적:** 같은 입력 → 같은 exit. 반증은 통과가 아니라 우회 실패로 확정(원칙 6).
- **문서화된 한계(정직한 skip·계층0 소관):** upgrade 계열이 **아닌** 헬퍼 함수로 숨긴 파괴 op·동적 SQL 조립·암묵적 문자열 연결(`execute("DR" "OP TABLE x")`)·**f-string 표현식 내 op 호출**(`f"{op.drop_table(...)}"` — 난독화)은 미검출(SQL판 dollar-quoting 한계와 동형).

## 5. 경계 / Do-Not

- ✅ 해도 됨: 새 스캐너·픽스처·테스트 작성, `destructive-ddl.yml`에 스텝 추가, 문서 교차참조 갱신.
- ⚠️ 먼저 물어봐: 스캔 범위를 `upgrade()` 밖(downgrade·헬퍼·모듈레벨)으로 넓히는 것, 별 워크플로 신설, 승인마커 문법 변경.
- 🚫 절대 금지: `check-destructive-ddl.mjs`(SQL 게이트) 로직 수정, guard.sh 변경, 테스트/픽스처를 우회-완화 목적으로 약화, 버전 bump 누락.

## 6. Open Questions

- 없음(3개 설계 결정 모두 사용자 승인 완료). 스캔범위=upgrade()-only는 원본에서 downgrade 파괴가 정상임을 확인해 확정.

## 7. 기술 접근 (HOW)

### 스캐너 `scripts/check-alembic-destructive-ddl.mjs` (SQL판과 구조 동형, Python 문법)

- **파일 탐색:** `walk()`(SQL판 차용) — 모든 `.py`를 순회. 각 `.py`가 **마이그레이션 지문**(AC-11)을 가질 때만 대상. 지문 0개 → self-skip exit 0(AC-8). `alembic.ini`/`script_location`·임포트 스타일에 의존하지 않음.
- **통합 토크나이저 + 함수 스코프 추적(반-스푸핑):** 파일 **전체**를 문자열/주석/괄호 인식으로 **논리 문장**(경계 = depth 0 개행 **또는 `;`**)으로 분해하고, 각 문장에 `{ code, comments, strings, col0 }`를 붙인다. 컬럼0 `def NAME`/`class`로 스코프를 전환해 **`upgrade` 계열 함수(`upgrade`·`upgrade_engineN`·`async def upgrade`) 본문 문장만** 판정한다(downgrade*·비-upgrade 헬퍼 제외 — AC-4). *line-based 추출을 안 쓰는 이유*: 컬럼0 dedent 검사는 triple-quote 안 SQL 라인·multidb 디스패처에서 본문을 조기 절단해 뒤 파괴 op를 놓친다(리뷰 반증 확인).
  - `code`=주석·문자열 제거본(op 탐지, AC-6) · `comments`=실제 `#` 주석(마커, AC-5) · `strings`=문자열 값(execute raw SQL, AC-3).
  - 문자열: `'`/`"`/`'''`/`"""` + 접두사 + 백슬래시 처리(raw 포함 — `\`는 종결 효력 제거, AC의 raw-desync 반증).
- **파괴 판정(수신자 무관, AC-12):** `/\bdrop_table\s*\(/`·`/\bdrop_column\s*\(/`(op.·batch_op.·별칭 모두, 문자열은 code에서 제거돼 무해) · `execute()` 문장이면 `strings`를 **SQL 정규화**(`/* */`·`--`·SQL 문자열 제거) 후 `DESTRUCTIVE` 세트 적용(AC-13) · 비대상 `drop_index`/`drop_constraint`(AC-7).
- **승인마커:** `MARKER_RE`, **같은 문장(트레일링) 또는 바로 앞 주석줄**의 `comments`에 있을 때 크레딧(AC-2·AC-14, 바로 다음 문장에만).
- **출력/exit:** SQL판과 동일 포맷 — 실패 목록·`--help`→0·미인식 플래그→2(AC-10).

> **리뷰 하드닝(반증, 원칙 6)**: 초판(line-based 추출 + `op.` 고정)은 코드리뷰 반증에서 12개 우회/오탐이 나왔다 — batch_alter_table·별칭·`import alembic.op` 지문회피·execute 블록주석 재회귀(v0.31.0 클래스)·triple-quote 본문절단·multidb·async·raw-string desync·세미콜론 마커 오귀속·앞줄 마커 오탐. 통합 토크나이저·수신자무관·SQL정규화·지문확장·`;`분리로 봉쇄, 각 벡터당 회귀 픽스처 박제. **conformance-green(초판 16 픽스처)은 증거가 아니었다** — 우회 실패로 재확정.

### CI·소비 repo 배선(결정 3 — destructive-ddl.yml 편승)

- `templates/ci/destructive-ddl.yml`: `Check destructive DDL` 스텝 뒤 2번째 스텝 `node scripts/check-alembic-destructive-ddl.mjs` 추가(항상 실행·self-skip). 헤더 주석 L11 갱신.
- `scripts/new-repo.sh` L120 근처: `copy_once … check-alembic-destructive-ddl.mjs`를 SQL 스크립트 옆에 무조건 복사. **required check 신설 없음**.
- `plugins/harness-guard/scripts/check-repo-sync.mjs` L289 근처: `existsAnywhere(/^check-alembic-destructive-ddl\.mjs$/)` 규칙 추가.
- `.github/workflows/ci-gate.yml`: `node --check` + 테스트 스텝 `bash tests/alembic-destructive-ddl-test.sh` + `bash -n` 등록.

### 테스트 전략 (AC ↔ 픽스처 1:1, 반증)

`tests/alembic-destructive-ddl-test.sh` + `tests/fixtures/alembic-destructive-ddl/*/alembic/versions/*.py`:
- bad(exit 1): `bad-drop-table`(AC-1)·`bad-drop-column`(AC-1)·`bad-op-execute-drop`(AC-3)·`bad-marker-in-string`(AC-5)·`bad-mixed`(AC-9).
- good(exit 0): `good-acknowledged`(AC-2)·`good-op-execute-acknowledged`(AC-3)·**`good-downgrade-only`**(AC-4·회귀 가드)·`good-drop-index`(AC-7)·`good-comment-spoof`·`good-string-spoof`·`good-docstring-spoof`(AC-6)·`good-non-migration-py`(AC-11)·`skip-empty`(AC-8).
- 인터페이스: `--help`→0·`--bogus`→2(AC-10).

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(이 명령 exit 0) | 의존 |
|---|---|---|---|---|---|
| 0 | 스펙 파일 커밋 | — | `docs/specs/alembic-destructive-ddl.md` | 파일 존재(guard F5) | — |
| 1 | 반증 픽스처 + 실패 테스트 하네스(RED) | AC-1~11 | `tests/alembic-destructive-ddl-test.sh`, `tests/fixtures/alembic-destructive-ddl/**` | 테스트 **FAIL**(스크립트 부재=RED) · `bash -n` 통과 | #0 |
| 2 | 스캐너 구현(GREEN) | AC-1~11 | `scripts/check-alembic-destructive-ddl.mjs` | `bash tests/alembic-destructive-ddl-test.sh` PASS · `node --check` | #1 |
| 3 | CI·소비 repo 배선 | — | `templates/ci/destructive-ddl.yml`, `scripts/new-repo.sh`, `plugins/harness-guard/scripts/check-repo-sync.mjs`, `.github/workflows/ci-gate.yml` | `bash tests/repo-sync-test.sh`·`bash tests/new-repo-test.sh` PASS | #2 |
| 4 | 문서 + 교차참조 + 버전 bump | — | `docs/decisions.md`, `docs/db-standards.md`, `templates/rules/stacks/alembic.md`, `scripts/check-destructive-ddl.mjs`(주석만), `plugin.json`, `README.md` | 영향 테스트 PASS · plugin.json 유효 · 배지 일치 | #2 |

> 태스크 4의 `check-destructive-ddl.mjs` 수정은 **로직 무변경 — docstring/help 교차참조 주석 1~2줄만**(원칙 5). 각 태스크 = 원자적 커밋 = 롤백 1단위.

## 검증 (end-to-end)

1. **시나리오:** `bash tests/alembic-destructive-ddl-test.sh` → exit 0. 반증: `good-downgrade-only` 통과(오탐 0), `bad-marker-in-string` FAIL(스푸핑 거부).
2. **CI 품질 잡 로컬 재현:** `node --check`·`bash -n`·`bash tests/repo-sync-test.sh`·`bash tests/new-repo-test.sh`.
3. **실 데이터 반증(webhook-service):** 실제 마이그레이션(파괴가 downgrade에만) → 통과. `downgrade`의 `op.drop_column`을 `upgrade`로 옮긴 사본 → exit 1. `op.execute("DROP TABLE …")` 주입본 → exit 1.
4. **self-skip:** 리포 루트 스캔 시 마이그레이션 지문 없으면 exit 0.
5. **PR:** `pr-create.sh --milestone audit-followup`로 #1 연결.

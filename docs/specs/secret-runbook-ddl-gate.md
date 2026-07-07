# secret-runbook-ddl-gate 스펙 (guard-gate 로드맵 Phase 3 [L])

> 근거 로드맵: `guard-gate-redesign-roadmap.md` [L] 클러스터(53행). 승인 2026-07-07.
> **한 브랜치 = 한 PR**: 두 워크스트림(A 런북·B DDL 게이트)을 `feature/secret-runbook-ddl-gate`에서
> **독립 원자 커밋**으로. B(DDL 게이트) 먼저 → A(런북) 독립 커밋.

## Context (왜 지금)

원본 재확인(2026-07-07)으로 두 갭이 실재함을 확인:

1. **시크릿 유출 "대응(respond)" 계층 부재** — 감지·차단은 3층으로 탄탄하나(gitleaks CI `ci-gate.yml`,
   guard 마스킹 `guard.sh:46-52`, PreToolUse 프롬프트 `hooks.json:14-18`, security-reviewer, `gitignore.snippet`)
   **유출 후 폐기·회전·히스토리 purge·통지 런북이 0**. `operations.md §1`은 일반 incident만, `auth-standards.md:49-50`은
   저장 표준만. 유출은 SEV1(데이터 유출, `operations.md:14`)인데 전용 절차가 없다.
2. **파괴적 DDL 정적 검사 부재** — `check-migration-safety.mjs`는 prefix-band + out-of-order **정합성**만 검사,
   SQL **내용**의 DROP TABLE·TRUNCATE·DROP COLUMN·ALTER…DROP은 안 봄. `guard.sh:243-260`은 마이그레이션 파일
   **삭제**만 차단(내용 무관). 파괴 DDL은 CI(빈 DB)는 통과하고 운영(기존 데이터)에서만 비가역 손실.

**확정된 결정(사용자 승인 2026-07-07):**
- **DDL posture = 차단+승인마커**: FAIL(exit1) 기본 + `-- migration-safety: destructive-ok` 주석으로 정당 파괴 통과.
- **범위 = 정적 마이그레이션 게이트만**: guard.sh 무변경(Bash env-blind 넛지 제외).

---

## 1. 목표 & Why

시크릿 유출 시 **되돌릴 수 없는 손실을 줄이는 대응 절차**와, 마이그레이션에 섞인 **파괴적 DDL을 배포 전
결정적으로 차단**하는 게이트를 추가한다. **성공 기준: `bash tests/destructive-ddl-test.sh` exit 0(반증 픽스처
포함 전량 GREEN) + operations.md에 폐기-우선 유출 런북 존재 + 기존 회귀망 무변경 GREEN.**

## 2. Scope

- **In (A 런북):** `docs/operations.md`에 시크릿 유출 대응 전용 섹션 — 폐기·회전(1순위)→영향범위→히스토리
  purge(2차)→통지→포스트모템. 기존 감지·차단 계층은 **포인터 참조**(중복 서술 금지).
- **In (B DDL 게이트):** `scripts/check-destructive-ddl.mjs`(정적 검사) + `tests/destructive-ddl-test.sh` +
  픽스처 + CI 배선 + 버전 bump + decisions.md 기록. 스택 무관(Flyway·Prisma·Alembic·Supabase 마이그레이션 디렉터리).
- **Out (Non-goals):**
  - guard.sh 변경·Bash `psql -c 'DROP…'` 넛지(env-blind, 다른 위협모델) — 제외.
  - 파괴 DDL 전 클래스 완결(SQL은 정규언어 아님) — **흔한 데이터-손실 형태만**. 종단 우회는 계층0(리뷰) 소관.
  - DROP INDEX/VIEW/CONSTRAINT/TRIGGER 등 **비 데이터-손실** DROP — 차단 대상 아님.
  - **Alembic Python DDL**(`op.drop_table()` 등, `.py` 파일) — 이 게이트는 `*.sql` 내용 전용이라 비대상.
    migration-safety가 alembic 다중head를 `alembic-heads`로 분리한 것과 동일 원리(정직한 skip, `alembic.md` 소관).
  - 시크릿 스캐너 신규 도입(gitleaks 유지)·회전 자동화 도구 — 런북은 절차 문서만.
  - Postgres dollar-quoting(`$$…$$`)·다국어 유니코드 식별자 등 희귀 우회 — 한계로 명시, 흔한 형태만.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

**B — 파괴적 DDL 게이트 (`check-destructive-ddl.mjs`)**

- **AC-1 (차단·정상):** WHEN 마이그레이션 디렉터리 하위 `*.sql`에 승인마커 없는 파괴 문장(`DROP TABLE`,
  `DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE`, `ALTER…DROP COLUMN`)이 있으면, the gate SHALL exit 1 (파일·문장·키워드 출력).
- **AC-2 (승인마커·escape):** WHEN 파괴 문장과 **같은 문장**에 실제 주석 `-- migration-safety: destructive-ok`가
  있으면, the gate SHALL 그 문장을 승인된 것으로 보고 통과.
- **AC-3 (주석 우회):** IF 파괴 키워드가 `--` 라인주석 또는 `/* */` 블록주석 **안에만** 있으면, the gate SHALL 무시(exit 0).
- **AC-4 (문자열 우회):** IF 파괴 키워드가 작은따옴표 문자열 리터럴 **안에만** 있으면(`'…DROP TABLE…'`), the gate SHALL 무시(exit 0).
- **AC-5 (마커 반증·anti-spoof):** IF `destructive-ok` 마커 텍스트가 **문자열/값 안**(실제 주석이 아님)에 있으면,
  the gate SHALL 마커를 인정하지 않음 → 파괴 문장은 여전히 exit 1. (migration-safety D1c와 동형 — 따옴표 인식.)
- **AC-6 (비파괴 오탐 금지):** WHILE 유일한 DROP이 `DROP INDEX`/`DROP VIEW`/`DROP CONSTRAINT`(데이터-손실 아님)이면,
  the gate SHALL exit 0.
- **AC-7 (문장 단위):** WHEN 한 파일에 승인 없는 파괴 문장 1개 + 안전 문장 여럿이면, the gate SHALL exit 1
  (파일 전체 사면 아님 — 문장 단위 판정).
- **AC-8 (스택 무관):** `db/migration/`·`prisma/migrations/`·`supabase/migrations/` 하위 `*.sql`을 **모두**
  스캔(Flyway `V###__` 명명 한정 아님 — 파괴성은 파일명 규약 무관). (Alembic은 DDL이 `.py`라 비대상 — Out 참조.)
- **AC-9 (skip·오탐 금지):** IF 마이그레이션 `*.sql` 미발견이면, the gate SHALL exit 0(skip).
- **AC-10 (usage):** `--help`는 exit 0. 인자 오류는 exit 2. (migration-safety 종료코드 규약과 일치.)

**A — 시크릿 유출 대응 런북 (`operations.md`)**

- **AC-11 (런북 존재):** operations.md SHALL 시크릿 유출 대응 전용 섹션 보유 — 폐기·회전 → 영향범위 → 히스토리
  purge → 통지 → 포스트모템 5단계. 기존 감지·차단(gitleaks·guard 마스킹·security-reviewer·gitignore)은 **참조만**(중복 금지).
- **AC-12 (폐기 우선 원칙):** 런북 SHALL "폐기(revoke)가 히스토리 purge보다 우선"을 명시 — 유출된 순간 이미
  공개(clone/fork/캐시)라 값 무효화가 1순위, purge는 2차(비가역성 원칙).

## 4. 제약 / 비기능

- 외부 의존 0(순수 Node ESM + bash, `check-migration-safety.mjs`와 동일 무의존).
- 게이트는 결정적·재현 가능(CI=로컬 동일 결과). false-FAIL 0(기존 migration-safety 회귀 불변).

## 5. 경계 / Do-Not

- ✅ 해도 됨: 파괴 키워드 세트·픽스처·스캐닝 로직 세부, 런북 문구·소절 구성.
- ⚠️ 먼저 물어봐: 파괴 키워드 세트 **확대**(VIEW/CONSTRAINT 등 비데이터-손실 포함)·posture 변경·guard.sh 손대기·
  templates/ci 전파를 넘어 소비 repo 강제화.
- 🚫 절대 금지: 기존 migration-safety 게이트 로직·테스트 변경(별 파일 신설), guard/secret-scan 우회 완화,
  main/develop 직접 push, 시크릿 커밋, 버전 bump 누락.

## 6. Open Questions

- (없음 — 2개 결정 사용자 승인 완료.)

---

## 7. 기술 접근 (HOW)

**A — 런북 (docs-only, 저위험, 독립 revert)**
`operations.md §1 장애 대응` 아래 신설 소절(예: `### 시크릿 유출 대응 런북`). 단일출처 원칙: 감지·차단은
`auth-standards.md:49-50`·`ci-gate.yml`(gitleaks)·`guard.sh` 마스킹·security-reviewer로 포인터. 신규 서술은
**대응 5단계**만: ①폐기·회전(종류별: GitHub token revoke·AWS key IAM 비활성+Secrets Manager 회전·DB 비번 회전 —
**1순위**) ②영향범위(gitleaks 리포트·커밋 범위·공개 여부) ③히스토리 purge(git filter-repo/BFG + force-push, "이미
clone된 건 못 지움 → 2차") ④통지(SEV1 선언·#incident·키 소유 서드파티) ⑤포스트모템(왜 감지·차단이 못 막았나 →
계층 강화 액션 이슈화, blameless).

**B — DDL 게이트 (`scripts/check-destructive-ddl.mjs`, migration-safety 패턴 차용)**
- **탐색**: `check-migration-safety.mjs`의 `walk()`·IGNORE 셋 패턴 재사용. 대상 = 경로에 마이그레이션 디렉터리
  세그먼트(`db/migration`·`prisma/migrations`·`supabase/migrations`)를 포함하는 `*.sql`.
  (migration-safety는 `V###__` 파일명 키 — 여기선 순서 아닌 **내용**이 문제라 디렉터리 앵커로 스택 무관 스캔.)
- **파싱(반증 핵심)**: 파일을 **문장 단위**(따옴표·주석 인식 `;` 분할)로 쪼갠다. 각 문장에서:
  - *키워드 감지*: 주석(`--`, `/* */`)·문자열(`'…'`, `''` 이스케이프) **제거한** 텍스트에서 파괴 키워드 정규식 매칭.
  - *마커 감지*: **raw** 문장 텍스트에서 실제 주석 안의 `migration-safety: destructive-ok`만 인정
    (`check-migration-safety.mjs`의 `commentOf()` 따옴표 인식 로직 차용 — 값 안 마커 스푸핑 차단 = AC-5).
  - 파괴 키워드 有 + 마커 無 → failure 수집.
- **파괴 키워드 세트**: `DROP\s+TABLE`, `DROP\s+DATABASE`, `DROP\s+SCHEMA`, `TRUNCATE`, `ALTER\s+TABLE…DROP\s+COLUMN`.
  `DROP\s+(INDEX|VIEW|CONSTRAINT|TRIGGER|SEQUENCE)`는 **제외**(AC-6).
- **종료코드**: 0(무파괴/전부 승인/skip) · 1(미승인 파괴) · 2(usage). `--help`·인자파싱은 migration-safety 스타일.
- **테스트 전략**: `tests/destructive-ddl-test.sh`가 픽스처별 exit 대조. AC↔픽스처 1:1, 특히 **반증 픽스처**
  (주석·문자열·마커-스푸핑 우회)로 "무엇을 막나"를 우회 시도로 검증.

**영향 파일**: `scripts/check-destructive-ddl.mjs`(신규) · `tests/destructive-ddl-test.sh`(신규) ·
`tests/fixtures/destructive-ddl/*`(신규) · `.github/workflows/ci-gate.yml`(스텝 2곳 추가) ·
`plugins/harness-guard/.claude-plugin/plugin.json`(버전) · `README.md`(배지) · `docs/decisions.md`(기록) ·
`docs/operations.md`(런북) · (조건부) `templates/ci/ci-gate.yml`.

---

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 2 | DDL 픽스처 + 테스트 계약(RED) — 반증 픽스처 포함 | AC-1〜10 | `tests/fixtures/destructive-ddl/*`, `tests/destructive-ddl-test.sh` | 스크립트 부재 시 RED(테스트 자체는 실행됨) | — | |
| 3 | `check-destructive-ddl.mjs` 구현(GREEN) | AC-1〜10 | `scripts/check-destructive-ddl.mjs` | `bash tests/destructive-ddl-test.sh` + `node --check` | #2 | |
| 4 | CI 배선(구문검사 + 테스트 스텝, 82행 근처) | AC-1〜10 | `.github/workflows/ci-gate.yml` | `node --check scripts/check-destructive-ddl.mjs` + 스텝 존재 | #3 | |
| 5 | templates/ci 패리티(조건부: migration-safety가 거기 있으면 동일 배선) | — | `templates/ci/ci-gate.yml` | 패리티 grep 대조 | #3 | [P] |
| 6 | 버전 bump + decisions 기록 | — | `plugin.json`·`README.md`·`docs/decisions.md` | 버전 문자열 일치 grep + `node --check plugin.json` | #3,#4 | |
| 1 | 런북 섹션 신설(폐기 우선, 참조만) — B 완료 후 독립 커밋 | AC-11,12 | `docs/operations.md` | `grep -q '유출' docs/operations.md` + 소절 5단계 존재 | — | [P] |

- **롤백**: 태스크1(런북)·5는 독립 `[P]` — `git revert` 단독. 태스크2→3→4→6은 DDL 게이트 체인(fix-forward).
- **버전**: `#243`(migration-safety) 선례 따라 플러그인 동작 표준 추가 → `0.29.27`→`0.29.28` bump.

## 9. Verification

1. `bash tests/destructive-ddl-test.sh` → exit 0 (반증 픽스처 = 주석·문자열·마커 스푸핑 우회 전부 PASS로 무시, 실제 파괴는 FAIL).
2. `node --check scripts/check-destructive-ddl.mjs` · JSON 유효성(`plugin.json`).
3. **회귀 무변경**: `bash tests/migration-safety-test.sh`·`bash tests/guard-test.sh` 여전히 GREEN(별 파일 신설, 기존 로직 무손).
4. CI `.github/workflows/ci-gate.yml` quality 잡 GREEN.
5. 런북: 5단계 소절 존재 + 폐기-우선 문구 + 기존 계층 참조(중복 서술 없음) 수동 확인.
6. 반증 원칙: 게이트 통과가 아니라 **우회 시도 실패**로 확정 — 픽스처에 스푸핑 케이스가 load-bearing.

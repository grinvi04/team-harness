# SQL lexical 오탐 교정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Codex native 계약에 따라 현재 agent가 순차 구현하고 독립 반증만 read-only review에 위임한다.

**Goal:** #443의 승인된 다중행 ALTER·PostgreSQL 다차원 ARRAY 오탐과 배열 사이 파괴문 누락을 제거하고 #442 두 소비 PR에 정본으로 전파한다.
**Architecture:** 네 lexer와 any-mode 파괴문 차단·all-mode lexical-error 차단은 유지한다. 수정 경계는 ALTER continuation의 문장 소속과 대괄호의 방언별 해석이다.
**Tech Stack:** Node ESM 무의존 정적 검사기, Bash 실제 CLI 회귀 테스트.
**Spec:** [#443](https://github.com/grinvi04/team-harness/issues/443), [기존 DDL 게이트 AC-1~AC-11](secret-runbook-ddl-gate.md).
**제품 방향:** 소유. 서버의 파괴 DDL 정책과 오탐 방지는 Team Harness 책임이다.

## Global Constraints

- 변경 대상은 `scripts/check-destructive-ddl.mjs`, 해당 회귀 suite·새 fixture, 결정 기록과 버전 metadata다.
- 기존 68개 테스트·fixture는 잠금 상태로 보존한다. 테스트 helper의 기대값과 exit-code 판정을 바꾸지 않는다.
- 실제 DB에 SQL을 실행하지 않는다. 소비 앱 코드·기존 migration·배포 설정·보호 정책을 수정하지 않는다.
- 동작 변경은 유지보수 규약에 따라 0.67.0 → 0.68.0 MINOR로 갱신한다.
- 정상 구문 허용을 위해 다음 독립 파괴문이나 문자열/식별자 속 가짜 승인마커를 허용하지 않는다.
- #432 외부 PR 신뢰 경계, split-package 승격과 사용자 plugin cache는 범위 밖이다.

## Task 1: 실제 CLI 회귀 계약 고정

**Files:** `tests/destructive-ddl-test.sh`, `tests/fixtures/destructive-ddl/{good,bad}-*/prisma/migrations/001/migration.sql`.
**Interface:** `node scripts/check-destructive-ddl.mjs <fixture-root>`; 정상 0, 미승인 파괴문 1.

- [x] 기존 suite를 먼저 실행한다: `bash tests/destructive-ddl-test.sh` → 68 PASS.
- [x] 위 두 원본 반례를 포함한 17개 독립 fixture를 추가한다. 독립 리뷰에서 찾은 ARRAY 식별자·별칭
  오탐은 12개 추가 fixture로 잠가 총 29개를 추가한다.
- [x] 변경 전 suite의 RED를 확인한다: PASS 78 / FAIL 7. 정상 사례 6개 오탐과 두 ARRAY 사이
  TRUNCATE 누락 1개가 실패했고 기존 68개는 모두 통과했다.
- [x] GREEN까지 기존 68개와 새 회귀의 입력·기대값을 바꾸지 않는다.

리뷰 반례의 별도 RED는 PASS 92 / FAIL 5였다. `@array`·`one$ARRAY`·bare `array`와 인용 별칭의
세미콜론·중첩 대괄호만 새로 실패했고 기존 85개는 통과했다. PostgreSQL 단일 하위 ARRAY와
각 별칭 뒤 실제 TRUNCATE는 별도 반례로 검사한다.

핵심 positive 입력:

```sql
-- migration-safety: destructive-ok
ALTER TABLE users
  DROP COLUMN legacy;
```

```sql
INSERT INTO grids (value) VALUES (ARRAY[[1,2],[3,4]]);
```

별도 fixture에서 `DROP /* comment */ COLUMN`, 여러 ALTER/DROP column action, 배열 문자열 속 대괄호,
`[safe]]TRUNCATE]` 식별자를 정상 0으로 검사한다. 승인 ALTER 다음의 독립 DROP/ALTER/IF/label/WHILE,
배열·인용 식별자 다음 TRUNCATE는 1이어야 한다.

실제 CLI 단언은 기존 helper를 그대로 사용한다:

```bash
check "승인된 multiline ALTER TABLE → 통과" 0 "$FIX/good-multiline-alter-ack"
check "PostgreSQL 다차원 ARRAY 뒤 TRUNCATE → FAIL" 1 "$FIX/bad-pg-array-truncate-tail"
```

## Task 2: lexer의 최소 경계 교정

**Files:** `scripts/check-destructive-ddl.mjs`.
**Interface:** 기존 `parseStatements(sql, mode)` → `{ stmts, hadLexicalError }`와 CLI exit 계약 유지.

- [x] 개행 경계 판정에서 ALTER TABLE의 DROP/ALTER COLUMN continuation은 같은 문장으로 유지한다.
  다음 독립 `DROP TABLE`, `ALTER TABLE`, IF/label/WHILE/ELSE는 기존 개행 경계를 유지한다.
- [x] PostgreSQL ARRAY의 중첩 대괄호와 문자열/주석을 인식하되 T-SQL의 `]]` 식별자 escape는 보존한다.
  다른 mode에서 식별자 속 키워드를 실제 실행문으로 오인하거나 ARRAY 뒤 실행문을 삼키지 않는다.
- [x] 재현 CLI와 전체 SQL suite를 실행한다: `node scripts/check-destructive-ddl.mjs <fixture-root>`,
  `bash tests/destructive-ddl-test.sh` → PASS 97 / FAIL 0.
- [x] `git diff`로 테스트 약화·무관 refactor가 없음을 확인한다.

## Task 3: 버전·품질·정본 PR과 소비 PR

**Files:** 두 plugin manifest, `README.md` 배지, `docs/decisions.md`, 커밋에서 재생성한 `CHANGELOG.md`.
**Interface:** 검증·병합된 정본 commit을 소비 파일의 byte 비교 기준으로 사용한다.

- [x] 두 manifest의 `"version": "0.68.0"`와 README 배지를 함께 갱신하고 결정·이유·반증 범위를 기록한다.
- [ ] 구현 커밋 후 `node scripts/generate-changelog.mjs --release v0.68.0` 출력으로 CHANGELOG를 갱신한다.
  전량 quality 1차의 58단계 중 이 커밋 기반 생성물 계약만 미충족(57 PASS / 1 FAIL)이므로 생성 후 전량 재검증한다.
- [ ] `bash -n tests/destructive-ddl-test.sh`, `node --check scripts/check-destructive-ddl.mjs`,
  `git diff --check`와 `.github/workflows/ci-gate.yml` quality의 모든 검증을 실행한다.
- [ ] 독립 리뷰 후 `pr-create.sh` / `pr-merge.sh --auto`로 develop에 반영한다.
  현재 head의 필수 CI·리뷰·외부 commit status를 직접 확인하고 보호 설정을 보존한다.
- [ ] #442의 두 draft PR을 수정된 정본 revision으로 갱신한다. 동일 6파일의 byte 일치,
  새로운 정본 회귀 suite·각 앱 품질·필수 CI·리뷰를 재검증한 뒤 develop에 병합한다.
- [ ] 정식 main 릴리즈와 태그는 release-check/release 경로의 별도 완료 조건으로 구분한다.
  진행하지 않은 릴리즈·설치 갱신을 완료라고 보고하지 않는다.

# migration-declarative-scheme 스펙 ([B]/#219 밴드 감지 재설계)

> 근거: GitHub 이슈 #219 · `docs/specs/guard-gate-redesign-roadmap.md` Phase 2 [B]. `/plan` 승인 산출물.

## 1. 목표 & Why

`scripts/check-migration-safety.mjs`(Flyway 정적 게이트)의 **밴드 감지 3휴리스틱**이 false-PASS를 낸다(#219).
임계값 tweak은 정상 마이그레이션을 false-FAIL시킬 위험이라 금지 — 재설계로 다룬다. 3이슈는 난이도가 다르다:
- **#1 greedy discovery** → **nearest-config 모듈 연관**(선언 불필요).
- **#3 8자리=타임스탬프 오판** → **실제 yyyymmdd 날짜 검증**(선언 불필요).
- **#2 100단위 촘촘 밴드**(휴리스틱 판별 불가) → **선택적 scheme 선언**(없으면 현행=하위호환).

**성공 기준:** `bash tests/migration-safety-test.sh` GREEN(기존 21 유지) + #219 3재현이 정밀 판정. **false-FAIL 0.**

## 2. Scope
- **In:** discovery 연관·timestamp·밴드 판정 로직 재설계 + 선택적 scheme 선언 파싱, 테스트·픽스처, db-standards·flyway.md 문서화.
- **Out (Non-goals):** Alembic/Prisma 스코프 확장(firm), `GAP_THRESHOLD`/`TIMESTAMP_MIN` 1차 조정, CI 무인자 discovery 호출 변경,
  기존 소비 repo 강제 마이그레이션(repo-sync 백필 별건), ooo/프로파일 판정 로직(isProdApplicable·S1/S1b/#197..#227) 변경(재사용만).

## 3. 수용기준 (= 테스트 계약)
- **AC-1 (#1 정밀연관):** WHEN discovery가 여러 모듈(각자 nearest config)을 찾으면, 모듈별 밴드+ooo 판정 → 한 모듈이라도 대역-without-ooo면 FAIL.
- **AC-2 (#1 격리 반증):** svcA(대역·ooo:false)+svcB(무관·ooo:true) → exit 1(교차 크레딧 없음).
- **AC-3 (#3 날짜정상):** WHILE 모든 버전이 유효 yyyymmdd → timestamp → 통과.
- **AC-4 (#3 경계):** IF 8자리이나 비-날짜(10000001, 월00) THEN timestamp 아님 → 밴드 판정 대상.
- **AC-5 (#2 선언):** WHEN config가 `scheme=prefix-band` → 갭 무관 밴드검사 ON → 촘촘밴드 without ooo → FAIL.
- **AC-6 (#2 선언 off):** scheme=monotonic → 통과 · scheme=timestamp → 타임스탬프 취급 → 통과.
- **AC-7 (하위호환):** WHEN 선언 없음 → 현행 휴리스틱 그대로 → 기존 21 테스트 GREEN.
- **AC-8 (예외):** IF 선언 미인식 THEN 무시+경고(휴리스틱 폴백), 크래시 없음.

## 4. 제약 / Do-Not
- 🚫 false-FAIL 금지(정상 단조증가 항상 통과). CI 무인자 discovery 불변. Alembic/Prisma 경로 불변. ooo/프로파일 로직 변경 금지(재사용).
- ⚠️ 선언은 opt-in — 없으면 현행. 새 **필수** 파일 관습 없음(선언 = 기존 config 내 주석 1줄).
- ✅ 내부 구조·partition 방식 자유.

## 5. Open Questions
- 없음(계획 승인 완료).

---

## 7. 기술 접근 (HOW)

**A. #1 nearest-config partition:** discovery에서 migration을 지배 config(가장 가까운 상위 config 디렉터리) 기준 그룹핑
(`Map<configDir,{migrations,config}>`). 그룹 독립 판정(versions→밴드, config→ooo 기존 로직 재사용). 한 그룹이라도 대역-without-ooo면 FAIL.
대역인데 그룹 config 없음 → 그 그룹 skip(현행 시맨틱). 단일 모듈=그룹1개=전역 동일(21 테스트 GREEN). 정밀 모드=그룹1개(무변경).

**B. #3 날짜 검증:** `isValidDate(n)` — 8자리 yyyymmdd(월1-12·일1-31) 또는 14자리. `isTimestamp`=모든 버전 유효날짜(혼입1개면 밴드검사 유지).

**C. #2 선택적 선언:** 지배 config에서 `# migration-safety: scheme=<prefix-band|monotonic|timestamp>` 주석을 주석제거 전 raw 스캔.
override: prefix-band→isBanded=true(갭무관)·monotonic→false·timestamp→isTimestamp=true. 미인식→무시+경고. 없으면 A/B 휴리스틱.

**영향 파일:** scripts/check-migration-safety.mjs · tests/migration-safety-test.sh · tests/fixtures/migration-safety/(신규) ·
docs/db-standards.md · templates/rules/stacks/flyway.md · plugin.json+README(버전 bump). 배포: new-repo.sh가 canonical copy(무변경).

**테스트 전략:** migration-safety-test.sh 확장(AC-2 멀티모듈·AC-4 8자리비날짜·AC-5/6 선언·AC-3/7 기존). 반증: #219 3재현 pre/post 대조.

## 8. 태스크 (test-first, feature/migration-declarative-scheme 한 브랜치)

| # | 태스크 | AC | 대상 파일 | 검증(exit 0) | 의존 |
|---|---|---|---|---|---|
| 1 | #3 날짜검증 timestamp(isValidDate) | AC-3,4 | check-migration-safety.mjs, migration-safety-test.sh | `bash tests/migration-safety-test.sh` | — |
| 2 | #1 nearest-config 모듈 partition | AC-1,2 | 〃 + fixtures | 〃 | #1 |
| 3 | #2 선택적 scheme 선언 파싱+override | AC-5,6,8 | 〃 + fixtures | 〃 | #2 |
| 4 | 문서 명문화 + 버전 bump | AC-7 | docs·templates/rules·plugin.json·README | CI quality green | #1-3 |

- 롤백: 태스크 독립 커밋. 태스크2 partition 최대 변경 — 회귀 시 fix-forward. 하위호환(21 케이스 GREEN) 매 태스크 검증.

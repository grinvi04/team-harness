# guard-gate-coverage-expansion 스펙 (#245 / Phase 2 [A] 후속)

> **상위:** [issue #245](https://github.com/grinvi04/team-harness/issues/245) (WHY·갭 목록 정본).
> [A] shlex 재설계([`guard-shlex-tokenizer.md`](./guard-shlex-tokenizer.md), v0.29.27)가 **동작보존**이라
> 후속으로 분리한 **순수 커버리지 확장**. 동작보존 리팩터와 섞지 않는다(타이트 스코프).

## 1. 목표 & Why

`guard.sh`의 category(b) 파괴가드 중 **검증기-삭제**와 **전역설치** 게이트에 선재(先在) 커버리지
갭이 있다 — 8개 갭 전부 현행 guard.sh에 JSON을 파이프해 `rc=0`(우회 성공)으로 실측 확인,
`pnpm` 1건 외 전부 OLD 정규식도 미커버(=[A]가 만든 신규 홀 아님, 선재 갭). 위협모델(#220:
상대=혼란한 에이전트, 흔한 형태 차단이 목표)상 **흔한 관례·같은-게이트-의도 누수**만 골라 넓힌다.

**성공 기준(측정 가능):** 아래 신규-커버 케이스가 전부 `exit 2`로 차단되고, 회귀망 240 GREEN
(guard-test 132 + matrix 84 + tokenizer 24)이 **불변**이며, 신규 과차단(OVERBLOCKS) **0**.

## 2. Scope

- **In:**
  - **검증기-삭제 게이트**(guard.sh 검증기 grep 패턴, 현 258행): `__tests__/`(jest), 복수형
    `migrations`·`db/migrations`, `spec/`(rspec) 경로 패턴 추가.
  - **전역설치 게이트**(guard.sh npm-only 블록, 현 300–311행)를 **패키지매니저 전역오염 방지**로
    일반화:
    - npm 자체 누수: `--location=global`(npm7+ 정문법), 결합 단축플래그 `-gf`/`-fg`(g 포함 단일대시 번들).
    - pnpm: `pnpm add -g`/`--global`(및 `install`/`i` verb).
    - yarn: `yarn global add`(classic — `global` 서브커맨드 + `add` verb).
  - 각 신규-커버 케이스에 **반증 픽스처** 추가(guard-test 시나리오 + guard-matrix 헌트 DENY/ALLOW).
  - `plugin.json` + `README` 배지 **MINOR bump**(소비 repo 대면 동작변경).
- **Out (Non-goals):**
  - **토크나이저 변경 금지** — `lib/tokenize.sh`는 손대지 않는다. 게이트 패턴/판정만 확장.
  - **ANSI-C `$'...'` 디코드 금지**(YAGNI) — 혼란한 에이전트 반사형이 아닌 의도적 난독화. 디코드는
    [A]가 끝낸 whack-a-mole epicycle 재개 + 새 edge. 정본 강제는 계층0(branch protection·CI).
  - **`TESTS/` 대문자 금지**(YAGNI) — 희소. 대소문자무시는 `CONTESTS/`류 과차단 위험만 늘림.
  - **F5 plan-gate·rm-core 경로정규화 로직 무관** — 냉동 계층(비가역·무백스톱), 건드리지 않는다.
  - category(a) 게이트(commit·force-push·gh-pr 등) 무관 — under-block 편향 유지.
  - `yarn global remove`/`list`, `pnpm remove -g` 등 **비설치** 서브커맨드는 차단 대상 아님(전역오염 없음).

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

### 검증기-삭제 게이트 확장

- **AC-1 (jest `__tests__/`):** IF 세그먼트에 `rm`/`git rm` 토큰이 있고 인자 토큰이 `__tests__/`
  경로를 포함하면 THEN the system SHALL `exit 2`. (예: `rm -rf __tests__/` → 차단)
- **AC-2 (복수형 migrations):** IF 인자 토큰이 `db/migrations/`(복수) 또는 standalone `migrations/`를
  포함하면 THEN `exit 2`. (현행 `db/migration` 단수는 유지 — 둘 다 잡음)
- **AC-3 (rspec `spec/`):** IF 인자 토큰이 경로세그먼트 `spec/`를 포함하면 THEN `exit 2`.
  (예: `rm -rf spec/` → 차단. `.spec.` 확장자 매치는 현행 유지.)
- **AC-4 (검증기 과차단 없음 — 반증):** WHILE 다음이면 the system SHALL `exit 0`:
  `rm myspec/`(비앵커 접두 아님), `rm -rf latest/`(현행 유지), `echo "rm __tests__/"`(mention),
  `docker run --rm spec/img`(`--rm`은 rm 토큰 아님).

### 전역설치 게이트 일반화

- **AC-5 (npm `--location=global`):** IF 세그먼트에 `npm` 토큰 + install-verb(`install`/`i`/`add`) +
  `--location=global` 토큰이 있으면 THEN `exit 2`.
- **AC-6 (npm 결합 단축플래그):** IF `npm` + install-verb + **g 포함 단일대시 번들**(`-gf`·`-fg` 등,
  `--`로 시작 안 함)이 있으면 THEN `exit 2`.
- **AC-7 (pnpm 전역):** IF `pnpm` 토큰 + verb(`add`/`install`/`i`) + 전역플래그(`-g`/`--global`/g-번들)면
  THEN `exit 2`. (예: `pnpm add -g x`)
- **AC-8 (yarn 전역):** IF `yarn` 토큰 + `global` 토큰 + `add` 토큰이 같은 세그먼트에 있으면 THEN
  `exit 2`. (예: `yarn global add x`)
- **AC-9 (전역설치 과차단 없음 — 반증):** WHILE 다음이면 the system SHALL `exit 0`:
  `npm ci --global`(ci≠install verb, 현행 유지), `npm install --legacy-peer-deps`(g 없는 롱플래그 오탐
  방지), `npm install -f`(g 없는 번들), `pnpm install`(로컬), `yarn add x`(로컬),
  `yarn global list`(비설치), `echo "npm install -g x"`(mention), 다른 세그먼트 격리(`echo -g && npm i`).

### 동작보존·안전 계약 (하드 게이트)

- **AC-10 (회귀망 불변):** WHEN `bash tests/guard-test.sh && bash tests/guard-matrix-test.sh &&
  bash tests/guard-tokenizer-test.sh` 실행 시 the system SHALL 전부 `exit 0`이고 matrix의 HOLES·
  OVERBLOCKS 섹션이 **비어 있다**(신규 픽스처 포함).
- **AC-11 (냉동 계층 불변):** the system SHALL F5 plan-gate·rm-core 경로정규화·토크나이저(`tokenize.sh`)
  소스를 변경하지 않는다(`git diff` 상 해당 영역 0줄).

## 4. 제약 / 비기능

- **호환:** bash 3.2.57(macOS)·4.x·5.x. `bash -n guard.sh` 통과. 순수 bash — python3/jq 불요([D] 폴백 보존).
- **성능:** PreToolUse 훅 경로 — 세그먼트 순회 O(n), 외부 fork 없음(현행 grep/토큰 술어 재사용).
- **비가역성(§8):** category(b)는 서버 백스톱 없는 로컬 파괴가드. 확장은 **차단 추가**(안전측)라 국소
  위험은 과차단(오탐)뿐 — AC-4/AC-9 반증 픽스처가 그 경계를 박제.

## 5. 경계 / Do-Not

- ✅ **해도 됨:** 검증기 grep 패턴에 경로 alternation 추가, npm 블록을 pnpm/yarn 포함으로 일반화(deny
  메시지 문구 갱신), 반증 픽스처(DENY/ALLOW) 추가, 주석 갱신, 버전 bump.
- ⚠️ **먼저 물어봐:** 신규 패턴이 회귀 픽스처(기존 ALLOW)를 하나라도 깨는 경우, category(a) 게이트에
  영향이 번지는 경우, 전역설치 매니저를 npm/pnpm/yarn 밖(bun 등)으로 더 넓히는 경우.
- 🚫 **절대 금지:** `tokenize.sh` 변경, ANSI-C 디코드 추가, F5·rm-core 정규식 수정, 테스트 스킵·기대값
  완화로 GREEN 만들기, main/develop 직접 push, 버전 bump 누락.

## 6. Open Questions

- (없음 — 스코프·YAGNI 제외·pnpm/yarn 확장·validator 3종 전부 사용자 승인 완료 2026-07-08.)

---

## 7. 기술 접근 (HOW)

### 검증기-삭제 (guard.sh 현 258행 grep 패턴 확장)

현행 alternation에 세그먼트-앵커 패턴을 추가한다(디렉터리는 `(^|/)…(/|$)` 경로세그먼트 앵커 유지 —
접두 부분매치 과차단 방지):

```
… |(^|/)__tests__(/|$)| (^|/)migrations?(/|$) | (^|/)db/migrations?(/|$) | (^|/)spec(/|$) | …
```

- `tests?` → 이미 존재. `migration` 단수 → `migrations?`로 복수 흡수 + standalone `migrations?` 추가.
- `spec` 디렉터리 앵커 추가(`.spec.` 확장자 패턴과 **별개** — 확장자는 유지). `myspec/`는 `(^|/)`
  앵커가 접두 매치를 막아 통과(AC-4).

### 전역설치 (guard.sh 현 300–311행 블록 일반화)

npm-only 루프를 **매니저-인식**으로 재작성(같은 세그먼트 순회 1벌, 토크나이저 술어 재사용):

```
세그먼트별:
  매니저 = seg_has_token(npm|pnpm|yarn) 중 존재하는 것
  npm|pnpm:
     verb = 토큰에 install|i|add 존재
     global = 토큰에 -g | --global | --global=* | --location=global |
              (단일대시 g-번들: [[ tok == -[!-]* && tok != --* && tok == *g* ]])
     차단 IF verb && global
  yarn:
     차단 IF (global 토큰 존재) && (add 토큰 존재)      # yarn global add
```

- **과차단 방어(핵심):** g-번들은 반드시 `--` 배제 + 단일대시 — `--legacy-peer-deps`(g 포함 롱플래그)
  오탐 방지(AC-9). `npm ci`는 verb 집합에 `ci` 없어 통과 유지. `-f`(g 없음) 통과.
- deny 메시지: "패키지매니저 전역설치 금지 — 전역 Node 환경 오염 위험 / 로컬 설치·npx 사용".
- 세그먼트 격리(`split_segments`)로 `echo -g && npm i` 오탐 방지는 현행 그대로.

### 영향 파일

- `plugins/harness-guard/scripts/guard.sh` — 검증기 grep 1줄 확장 + 전역설치 블록 일반화. **tokenize.sh 무변경.**
- `tests/guard-test.sh` — 신규-커버 시나리오 check 추가(DENY) + 과차단 방어 check(ALLOW).
- `tests/guard-matrix-test.sh` — 헌트 case_ 추가(DENY·ALLOW, HOLES/OVERBLOCKS 공란 유지).
- `plugins/harness-guard/.claude-plugin/plugin.json` + `README.md` 배지 — MINOR bump.
- `docs/decisions.md` — 결정 1줄. `docs/specs/guard-gate-redesign-roadmap.md`는 [A] 이미 종결 — #245 후속 완료 표기(선택).

### 테스트 전략 (AC ↔ 테스트 1:1)

- AC-1~3·5~8(DENY) → guard-test.sh `check … 2 …` + guard-matrix `case_ … 2 …`.
- AC-4·9(과차단 반증) → guard-test.sh `check … 0 …` + guard-matrix ALLOW `case_ … 0 …`.
- AC-10(회귀 불변) → 3개 스위트 전량 GREEN + matrix HOLES/OVERBLOCKS 공란.
- AC-11(냉동 불변) → `git diff` 상 tokenize.sh·F5·rm-core 정규식 0줄.
- **독립 적대적 검증:** 머지 전 `verifier` 에이전트 spawn — 신규 패턴의 우회(순서·wrapper·따옴표·
  결합플래그 변형)·과차단(정당 경로 오탐) 재확인. 통과가 아니라 **우회 실패**로 확정(원칙 6).

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | **검증기-삭제 확장**: grep 패턴에 `__tests__`·`migrations?`·`db/migrations?`·`spec` 앵커 추가. DENY 3종 + 과차단 ALLOW 픽스처(guard-test + matrix). RED→GREEN | AC-1~4,AC-10 | `guard.sh`, `tests/guard-test.sh`, `tests/guard-matrix-test.sh` | `bash tests/guard-test.sh && bash tests/guard-matrix-test.sh` | — | [P] |
| 2 | **전역설치 일반화**: npm 블록을 매니저-인식(npm/pnpm/yarn)으로 재작성 + `--location=global`·g-번들. DENY 4종 + 과차단 ALLOW(`--legacy-peer-deps`·`npm ci --global`·yarn/pnpm 로컬) 픽스처. RED→GREEN | AC-5~10 | `guard.sh`, `tests/guard-test.sh`, `tests/guard-matrix-test.sh` | `bash tests/guard-test.sh && bash tests/guard-matrix-test.sh` | — | [P] |
| 3 | **냉동 불변 검증 + 버전 bump + 결정 기록**: tokenize.sh·F5·rm-core diff 0 확인, plugin.json + README 배지 MINOR bump, decisions.md 1줄 | AC-11 | `plugin.json`, `README.md`, `docs/decisions.md` | `bash -n guard.sh && node -e "require('./plugins/harness-guard/.claude-plugin/plugin.json')"` + 전 스위트 GREEN | #1,#2 | |

- **롤백:** 태스크1·2 독립(`[P]` — 서로 다른 게이트 블록, 무회귀) → 각각 `git revert` 단독 가능.
  태스크3은 1·2 위에 쌓임 → 회귀 시 fix-forward.
- **핸드오프:** 승인 후 `/feature-add`가 `feature/guard-gate-coverage-expansion` 브랜치 생성, 태스크
  순서대로 TDD(태스크당 원자적 커밋). 한 기능=한 브랜치=한 PR(develop 대상, CI-green 시 `--auto`).
  머지 전 verifier 에이전트 독립 적대적 재확인.
</content>
</invoke>

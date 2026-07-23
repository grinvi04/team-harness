# guard-shlex-tokenizer 스펙 (Phase 2 [A] / #220-A)

> **로드맵 상위:** [`guard-gate-redesign-roadmap.md`](./guard-gate-redesign-roadmap.md) Phase 2 클러스터 [A].
> WHY/근본원인 = [issue #220](https://github.com/grinvi04/team-harness/issues/220) (포인터 참조, 중복 서술 금지).

## 1. 목표 & Why

`guard.sh`는 셸 명령줄을 **정규식 7벌**로 재파싱한다 — 셸은 정규언어가 아니므로 각 우회마다
새 정규식 epicycle이 붙는 whack-a-mole에 갇혀 있다(force-push 3회·A5b·#204·#207/208 재작성 이력).
핵심 병소는 `git <전역옵션…> <서브커맨드>` 구조를 잡는 **monster global-opts 정규식**
(`git([[:space:]]+(-C|-c|--git-dir|…)…|…)*[[:space:]]+<subcmd>`)이 commit·force-push·reset
세 게이트에 복붙돼 있는 것. `main`/`develop` 판정도 **3곳에 하드코딩**됐다(line 132·160·162).

이 스펙은 [A]를 **동작보존 리팩터**로 수행한다 — 정밀도를 올리지 않고, 취약한 정규식을
**단일 순수-bash 토크나이저**로 치환해 epicycle을 종료한다.

**성공 기준(측정 가능):** 기존 회귀망(`guard-test.sh` + `guard-matrix-test.sh`)이 **100% GREEN
불변**이고, monster global-opts 정규식과 `main`/`develop` 리터럴이 **소스에서 0곳**으로 사라지며,
카테고리(b) 파괴가드에 **현행 대비 신규 홀 0**(적대적 헌트로 반증).

## 2. Scope

- **In:**
  - 순수-bash 토크나이저 primitive 2종(`split_segments`·`tokenize`)을 `guard.sh`에 도입.
  - `PROTECTED_BRANCHES` 단일 리스트로 `main`/`develop` 3곳 통합.
  - **git구조 게이트**(commit·force-push·reset) → 토크나이저 기반 판정으로 이관(monster 정규식 제거).
  - **token[0] 게이트**(gh-pr create/merge·F5 feature-plan·validator-delete·npm-g) → 토크나이저 기반
    진입탐지로 이관. 따옴표 안 mention 과차단은 자연 소멸(카테고리(a) under-block 편향과 정합).
- **Out (Non-goals):**
  - **정밀도 상향 금지** — 새로 막는 케이스를 추가하지 않는다(카테고리(a)는 frozen·under-block 유지).
  - **rm-core 경로정규화 로직 재작성 금지** — 진입탐지(rm + -rf 플래그 존재)만 토큰화하고,
    resolved-path 정규화(line 223–248, 심링크·`.`/`..` 상위판정)는 헌트로 하드닝된 현행 코드 유지.
  - `python3`/`jq` 의존 추가 금지 — [D]/#239가 만든 폴백 스토리를 보존한다.
  - 헤더 철학([C]/#221)·decisions.md 판정철학 재서술 금지(포인터만).
  - guard.sh 외 파일(route-intent·merge-permissions 등) 무관.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

### 토크나이저 primitive

- **AC-T1 (정상 토큰화):** WHEN 세그먼트 `git -c user.name=x -c user.email=x@x commit -m x`를
  `tokenize`에 넣으면, the system SHALL 토큰 `[git,-c,user.name=x,-c,user.email=x@x,commit,-m,x]`를
  1줄당 1토큰으로 반환한다.
- **AC-T2 (따옴표 제거):** WHEN `rm -rf "src"` 또는 `rm -rf 'app'`을 토큰화하면, the system SHALL
  따옴표를 벗긴 `[rm,-rf,src]`/`[rm,-rf,app]`를 반환한다(닫는/여는 따옴표 짝 인식).
- **AC-T3 (세그먼트 분리):** WHEN `a && b ; c | d`를 `split_segments`에 넣으면, the system SHALL
  `&&`·`;`·`|`·`||`·`(`·`)`에서 분리해 세그먼트를 반환한다.
- **AC-T4 (따옴표 안 연산자 비분리):** WHILE 연산자/서브셸 문자가 따옴표 안에 있을 때
  (`echo "git push --force origin main)"`, `grep 'git reset --hard' notes.txt`), the system SHALL
  그 세그먼트를 쪼개지 않고 token[0]을 `echo`/`grep`로 유지한다(git·rm 게이트 미발동).
- **AC-T5 (env-prefix 인식):** WHEN `X= git commit` / `A=1 B=2 git commit`을 토큰화하면, the system
  SHALL 선행 `VAR=val` 토큰을 git 앞에 그대로 노출해 게이트가 이를 스킵하고 서브커맨드를 찾게 한다.
- **AC-T6 (bash 3.2 호환):** WHEN guard.sh를 bash 3.2.57(macOS 기본)로 실행하면, the system SHALL
  토크나이저가 올바르게 동작한다. IF `local a=$1 b=${#a}`를 한 줄에 선언하면 b가 a를 못 보므로
  (bash 3.2 함정) THEN `local` 선언을 분리한다.
- **AC-T7 (파서 무의존):** WHILE `python3`은 없고 `jq`만 있는 환경([D] 폴백)일 때, the system SHALL
  토큰화된 게이트가 그대로 작동한다(토크나이저는 순수 bash라 JSON 파싱 이후 단계엔 외부 파서 불요).
- **AC-T8 (논리행 정규화 — v0.61.0 release-check hardening):** WHEN Unix 셸 입력에 실제
  backslash+LF continuation이 있으면, the system SHALL 이를 제거한 논리행을 `split_segments`·
  `tokenize`와 모든 게이트 판정에 사용한다. CRLF, single quote 안의 literal, 짝수 backslash run 뒤
  LF는 제거하지 않고 따옴표도 보존해 mention 경계를 넓히지 않는다.

### git구조 게이트 이관 (commit·force-push·reset)

- **AC-G1 (commit 보호):** IF 서브커맨드가 `commit`이고 대상 repo 브랜치가 `PROTECTED_BRANCHES`에
  속하면 THEN the system SHALL exit 2로 차단한다. `git -C <dir> commit`이면 그 `<dir>` 기준 판정.
- **AC-G2 (force-push 보호):** IF push 세그먼트가 force 신호(`--force`/`--force-with-lease`/`-f`류
  결합/`+refspec`)를 갖고 대상이 `PROTECTED_BRANCHES`(명시 refspec 또는 bare-push의 현재 브랜치)면
  THEN exit 2. 체인된 다중 push는 **각 세그먼트** 개별 판정(#208).
- **AC-G3 (reset --hard):** IF 서브커맨드가 `reset`이고 `--hard` 플래그가 있으면 THEN exit 2
  (순서·wrapper prefix·`git -C`·env-prefix 무관).
- **AC-G4 (monster 정규식 소멸):** the system SHALL git구조 판정에서 monster global-opts 정규식을
  제거한다 — `grep -c '(-C|-c|--git-dir|--work-tree' guard.sh` 결과가 현행보다 감소(목표 서브커맨드
  판정 경로 0).

### token[0] 게이트 이관 (gh-pr·F5·validator-del·npm; rm-core 보수적)

- **AC-K1 (gh-pr 게이트):** IF 세그먼트 token[0]이 `gh`이고 이어지는 토큰이 `pr create`/`pr merge`면
  THEN exit 2. 문자열 mention(grep/echo 인자·정규식 alternation)·래퍼 스크립트 호출은 통과.
- **AC-K2 (F5 plan-gate):** IF `git checkout -b`/`switch -c`/`branch`의 인자가 `feature/<name>`이고
  `docs/specs/<name>.md`가 없으며 `HARNESS_TRIVIAL=1` 프리픽스가 없으면 THEN exit 2.
- **AC-K3 (validator-delete):** IF token[0]이 `rm`/`git rm`이고 같은 세그먼트 인자에 테스트·마이그레이션
  경로 패턴이 있으면 THEN exit 2.
- **AC-K4 (npm -g):** IF token[0]이 `npm`이고 같은 세그먼트에 install-verb + `-g`/`--global`(=값 포함)이
  순서 무관하게 함께 있으면 THEN exit 2.
- **AC-K5 (rm-core 보수적):** the system SHALL rm-core 게이트의 **진입탐지**(rm + 재귀/force 플래그)만
  토큰화하고, resolved-path 정규화·심링크·`.`/`..` 상위판정 로직은 현행 코드를 유지한다.

### 동작보존·안전 계약 (하드 게이트)

- **AC-B1 (guard-test 불변):** WHEN `bash tests/guard-test.sh` 실행 시 the system SHALL exit 0
  (전 케이스 PASS, FAIL=0).
- **AC-B2 (guard-matrix 불변):** WHEN `bash tests/guard-matrix-test.sh` 실행 시 the system SHALL
  exit 0이고 HOLES·OVERBLOCKS 섹션이 **비어 있다**.
- **AC-B3 (신규 홀 0 — 반증):** WHEN 카테고리(b) 적대적 헌트 케이스(신규 추가)를 실행하면, the system
  SHALL 현행 정규식이 막던 것을 전부 계속 막는다(reset·rm·npm·validator-del 변형에서 신규 통과=0).
  특히 `rm \`+LF/CRLF+`-rf tests`, `git reset \`+LF/CRLF+`--hard`, `npm install \`+LF/CRLF+`-g`
  는 같은 단일행 명령과 동일하게 exit 2다.
- **AC-B4 (fail-closed 유지):** WHILE `python3`·`jq` 둘 다 부재/실패일 때 the system SHALL JSON 파싱
  단계에서 fail-closed(exit 2) — 토크나이저 도입이 이 안전측을 바꾸지 않는다.

## 4. 제약 / 비기능

- **호환:** bash 3.2.57(macOS)·4.x·5.x 전부에서 동작(AC-T6). `bash -n guard.sh` 구문검증 통과.
- **성능:** 토크나이저는 PreToolUse 훅 경로(Bash 도구 호출마다 실행) — 문자열 순회 O(n), 외부
  프로세스 fork 없이 순수 bash. 체감 지연 없어야 함(현행 grep 다발 대비 프로세스 수 감소).
- **비가역성(§8):** 카테고리(b)는 서버 백스톱 없는 로컬 파괴가드 — 신규 홀은 국소 비가역 손실.
  각 Slice는 독립 커밋=독립 `git revert` 단위. Slice 순서 = 블라스트반경 오름차순.

## 5. 경계 / Do-Not

- ✅ **해도 됨:** 토크나이저 헬퍼 함수 추가, git구조 3게이트 내부 판정 로직 토큰기반 재작성,
  `PROTECTED_BRANCHES` 리스트화, 따옴표-mention 과차단 자연 제거, 주석 갱신.
- ⚠️ **먼저 물어봐:** 카테고리(a) 게이트가 **새로 막는** 케이스가 생기는 변경(정밀도 상향은 철학 위반),
  rm-core 경로정규화 로직을 건드려야 하는 상황, `PROTECTED_BRANCHES`에 브랜치 추가.
- 🚫 **절대 금지:** `python3`/`jq` 의존 추가, 파괴가드(reset/rm/npm/del) 약화(신규 홀), 테스트 스킵·
  기대값 완화로 GREEN 만들기, main/develop 직접 push, guard.sh 헤더 철학 삭제.

## 6. Open Questions

- (없음 — 방향·범위 사용자 승인 완료 2026-07-07. `[NEEDS CLARIFICATION]` 0개.)

---

## 7. 기술 접근 (HOW)

### 토크나이저 설계 (프로토타입 검증됨 — `scratchpad/tok-proto.sh`)

세 순수-bash 함수, 외부 프로세스·`python3`/`jq` 불요:

```
collapse_line_continuations "$cmd" # shell-effective backslash+LF 제거, 논리행 동일화
split_segments "$cmd"   # ; && || | ( ) 에서 분리(따옴표 인식). 1줄=1세그먼트.
tokenize "$seg"          # 세그먼트→단어. 따옴표 벗김·백슬래시 이스케이프·공백 collapse. 1줄=1토큰.
```

- **문자 단위 상태기계**: `q`(현재 따옴표문자) 상태로 따옴표 안/밖 구분 → 연산자·공백을
  따옴표 안에서 리터럴로 취급(AC-T2·T4의 핵심).
- **bash 3.2 함정(AC-T6):** `local s="$1"; local i=0 n=${#s}` 처럼 **`local`을 분리**한다
  (`local s=$1 n=${#s}` 한 줄이면 n이 s를 못 봄 — 프로토타입에서 실측).
- **판정 헬퍼**: 토큰 배열에서 `git_subcommand`(선행 `VAR=val`·전역옵션 스킵 후 첫 비플래그),
  `git_C_dir`(`-C <dir>` 추출), `has_flag`(플래그 존재) 같은 작은 술어로 게이트를 조립.
  → monster 정규식 1벌이 술어 함수 몇 개로 분해되고 3게이트가 공유(AC-G4).

### 영향 파일

- `plugins/harness-guard/scripts/guard.sh` — 토크나이저 함수 추가 + 7게이트 판정부 이관.
- `tests/guard-test.sh`·`tests/guard-matrix-test.sh` — **기대값 불변**(계약). Slice1/2 헌트 케이스만 **추가**.
- `plugins/harness-guard/.claude-plugin/plugin.json` + `README.md` 배지 — 버전 bump(플러그인 동작 변경).
- `docs/decisions.md` — [A] 재설계 결정 1줄 기록.
- `docs/specs/guard-gate-redesign-roadmap.md` — [A] 완료 표기(머지 후).

### 테스트 전략 (AC ↔ 테스트 1:1)

- **토크나이저 단위(AC-T1~T7):** `tests/guard-tokenizer-test.sh`(신규) — 함수를 source해 토큰 출력
  직접 assert(세그먼트·따옴표·env-prefix·bash3.2·파서무의존).
- **게이트 계약(AC-G*·AC-K*·AC-B1/B2):** 기존 `guard-test.sh`·`guard-matrix-test.sh` 그대로 재사용
  (동작보존이므로 기대값 불변) + 카테고리(b) 헌트 케이스 추가(AC-B3).
- **적대적 헌트(AC-B3):** guard-matrix에 reset/rm/npm/del wrapper·따옴표·체인·순서 변형을 확장,
  HOLES 섹션이 비어야 통과. H2P/#204/#208 방법론 재사용.

### 롤백 설계

Slice 오름차순(0→1→2) = 블라스트반경 오름차순. 각 Slice = 원자적 커밋 1개.
Slice0(branch 상수)·Slice1은 **독립 revert 가능**. Slice2는 Slice1 위에 쌓이므로(공유 토크나이저)
회귀 시 fix-forward. 카테고리(b) 이관(Slice1의 reset·Slice2의 del)은 머지 전 헌트 통과가 게이트.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | **Slice0**: `PROTECTED_BRANCHES` 리스트 도입 — commit(132)·force(160·162) 3곳 하드코딩을 단일 상수+헬퍼로 통합. 동작 불변 | AC-B1,AC-B2 | `guard.sh` | `bash tests/guard-test.sh && bash tests/guard-matrix-test.sh` | — | [P] |
| 2 | **토크나이저 primitive**: `split_segments`·`tokenize` + 판정 헬퍼(`git_subcommand`·`git_C_dir`·`has_flag`) 추가. bash3.2 안전. 단위 테스트 신설 | AC-T1~T7 | `guard.sh`, `tests/guard-tokenizer-test.sh`(신규) | `bash tests/guard-tokenizer-test.sh` | #1 | |
| 3 | **Slice1**: git구조 게이트 commit·force-push·reset을 토크나이저 기반으로 이관, monster 정규식 제거. reset(카테고리 b)은 헌트 케이스 추가 | AC-G1~G4,AC-B1~B3 | `guard.sh`, `tests/guard-matrix-test.sh` | `bash tests/guard-test.sh && bash tests/guard-matrix-test.sh` | #2 | |
| 4 | **Slice2**: token[0] 게이트 gh-pr·F5·validator-del·npm 이관 + 따옴표-mention 과차단 자연 제거. rm-core는 진입탐지만 토큰화(경로정규화 유지). del(카테고리 b) 헌트 케이스 추가 | AC-K1~K5,AC-B1~B3 | `guard.sh`, `tests/guard-matrix-test.sh` | `bash tests/guard-test.sh && bash tests/guard-matrix-test.sh` | #3 | |
| 5 | 버전 bump(plugin.json + README 배지) + decisions.md 결정 기록 + 로드맵 [A] 완료 표기 | — | `plugin.json`, `README.md`, `docs/decisions.md`, `docs/specs/guard-gate-redesign-roadmap.md` | `node --check` 없음 — JSON 유효성 + `bash -n guard.sh` | #4 | |

- **롤백:** 태스크1·2 독립(`[P]`/무회귀). 태스크3·4는 공유 토크나이저 위에 쌓임 → 회귀 시 fix-forward.
- **핸드오프:** 이 스펙 승인 후 `/feature-add`가 `feature/guard-shlex-tokenizer` 브랜치를 만들어
  태스크 순서대로 TDD. 한 기능=한 브랜치=한 PR(develop 대상, CI-green 시 `pr-merge.sh --auto`).

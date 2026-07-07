# onboarding-falsification-smoke 스펙

> 로드맵 클러스터 **[I] 온보딩 반증-스모크** (docs/specs/guard-gate-redesign-roadmap.md:40) 실행.
> 외부의존 0, 외과적. 방금 머지된 [L]과 별개.

## 1. 목표 & Why

가드는 두 계층으로 발동한다 — **계층 1** guard.sh(Claude Code PreToolUse 훅, `hooks.json` 배선)와
**계층 0.5** pre-commit(git 네이티브 훅, `core.hooksPath` 배선). 현재 두 배선 모두 **검증 사각지대**다:

- 기존 가드 테스트 3종(guard-test·guard-matrix·guard-tokenizer)은 전부 `bash guard.sh`에 JSON을
  **직접 파이프**해 guard.sh 내부 로직만 본다. `hooks.json`의 Bash matcher나 `${CLAUDE_PLUGIN_ROOT}`
  경로가 드리프트로 깨져 **실제로 가드가 영영 미발동해도 240+ 테스트는 전부 GREEN**이다.
- `core.hooksPath` 미설정 시 pre-commit이 **침묵 통과**하는데, 이를 잡는 assert가 없다.
  troubleshooting.md:33은 "repo-sync가 점검"이라 주장하지만 check-repo-sync.mjs엔 hooksPath 점검이
  **없다**(거짓 안전 주장).

이 배선들을 **conformance-green이 아니라 반증**(배선이 깨지면 실패)으로 검증하는 스모크를 만들고,
온보딩이 이를 자동 assert하게 배선한다.

**성공 기준(측정 가능): `hooks.json`의 Bash matcher를 존재하지 않는 경로로 바꾸면 신규 스모크가
FAIL(exit≠0)한다. 현재 배선에선 PASS한다. + `core.hooksPath`가 틀린 값이면 로컬에서 FAIL한다.**

## 2. Scope

- **In:**
  - `tests/plugin-wiring-test.sh` 신규 — 2개 섹션:
    - **(A) 계층1 가드 배선**: `hooks.json`을 파싱해 PreToolUse Bash matcher의 guard 명령을 추출,
      `${CLAUDE_PLUGIN_ROOT}`를 플러그인 루트로 해석한 경로가 **실존·판독 가능**한지 assert하고,
      그 **해석된 경로로** 반드시-차단 명령(보호 브랜치 `git commit`)을 구동해 **exit 2**를 assert한다.
      추가로 `hooks.json`의 모든 `type:"command"` 훅 경로가 실존 파일로 해석되는지 assert.
    - **(B) 계층0.5 pre-commit 배선**: `.githooks/pre-commit` 실존·실행권한 assert(항상). +
      `core.hooksPath`가 **설정돼 있으면** `.githooks`와 일치하는지 assert(오설정 탐지). 미설정이면
      **행동지침 WARN 후 exit 0**(CI 안전 — §5 참조).
  - `.github/workflows/ci-gate.yml`에 신규 스모크 등록(`bash -n` 목록 + 실행 스텝).
  - `docs/onboarding.md`: 맨손 `git config core.hooksPath` 수동 단계를 **설정→검증(스모크 실행)**으로
    승격, 최종 검증(§A.3)에 스모크 참조 추가(team-harness 자기 검증).
  - `docs/troubleshooting.md:33`: "repo-sync가 점검" 거짓 주장을 **실제 메커니즘**(pre-commit 아티팩트
    assert + hooksPath 오설정 스모크)을 가리키도록 정정.
  - 로드맵 [I] 상태 갱신 + `docs/decisions.md` 결정 기록.

- **Out (Non-goals):**
  - `check-repo-sync.mjs`에 hooksPath 점검 추가 **안 함** — mjs는 "무의존 정적검사" 순수성 유지
    (git-config는 런타임 점검이라 셸 스모크 소관 — branch-protection이 set-branch-protection.sh로
    분리된 것과 **동형**).
  - **소비 repo(erp·siku 등)의 hooksPath 런타임 검증** — 배포 경로가 다르다(소비 repo는 tests/가
    아니라 templates/를 받는다). 별도 후속(new-repo 검증 또는 repo-sync 확장)으로 남긴다.
  - **Claude Code 훅 디스패치 런타임 자체를 기동/시뮬레이션 안 함** — 배선 계약(hooks.json→경로 해석)
    + 해석된 경로로 guard.sh 구동까지만. Claude Code를 띄우지 않는다.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (정상·배선 실존):** WHEN 스모크가 `hooks.json`을 파싱할 때, the system SHALL PreToolUse에
  matcher=="Bash"인 항목을 찾고 그 항목의 `type:"command"` 훅에서 guard.sh를 참조하는 명령을 추출한다.
- **AC-2 (정상·경로 해석):** WHEN guard 명령의 `${CLAUDE_PLUGIN_ROOT}`를 플러그인 루트(=`hooks/`의
  부모 = `plugins/harness-guard`)로 치환할 때, the system SHALL 해석된 스크립트 경로가 실존하고
  판독 가능함을 assert한다. (그리고 `hooks.json`의 **모든** command 훅 경로에 동일 적용.)
- **AC-3 (반증·실발동):** WHEN 보호 브랜치(develop) 임시 repo에서 `git commit` 명령 JSON을 **AC-2에서
  해석된 경로**의 guard로 파이프할 때, the system SHALL exit 2(차단)를 관찰한다. (경로가 드리프트로
  깨지면 이 스텝이 실패 → 배선 회귀를 잡는다.)
- **AC-4 (정상·pre-commit 아티팩트):** the system SHALL `.githooks/pre-commit`가 실존하고 실행권한이
  있음을 assert한다(CI·로컬 공통).
- **AC-5 (경계·hooksPath 오설정):** IF `core.hooksPath`가 설정돼 있으나 값이 `.githooks`가 아니면 THEN
  the system SHALL FAIL(exit≠0)한다.
- **AC-6 (예외·hooksPath 미설정):** IF `core.hooksPath`가 미설정이면 THEN the system SHALL 설정 안내
  WARN을 출력하고 exit 0으로 통과한다(CI 체크아웃은 미설정이 정상 — §5).

## 4. 제약 / 비기능

- 외부의존 0: bash + python3(hooks.json 파싱, ci-gate가 이미 요구) 또는 jq. 네트워크·gh 불필요.
- 결정론적: 임시 git repo는 기존 guard-test.sh 패턴(mktemp+init+branch) 재사용.
- 실행 시간 < 2s(단위 스모크 수준).

## 5. 경계 / Do-Not (핵심 정직성 제약)

- ✅ 해도 됨: 스모크 파일 구조·assert 문구·WARN 카피는 재량.
- **버전 bump 생략 (확정, 승인 2026-07-08)**: 이 슬라이스는 **소비-비대면**(신규 tests/ + 내부 문서만,
  스크립트·훅·스킬·templates/ 변경 0)이라 AGENTS.md bump-트리거 문언에 해당 안 됨. plugin.json/README
  배지 안 건드림. 추적성은 로드맵 [I] 갱신 + decisions.md로 확보.
- 🚫 절대 금지:
  - **"CI가 hooksPath 미설정을 잡는다"고 주장하지 말 것** — CI 체크아웃은 hooksPath를 설정하지
    않고 로컬 pre-commit을 쓰지 않는다(방어는 branch protection+ci-gate). AC-6이 이 진실을 반영한다.
    문서·주석에 거짓 안전 주장을 새로 만들면 이 작업의 취지(거짓 안전 주장 교정)에 정면 위배.
  - check-repo-sync.mjs 순수성 훼손(git-config 런타임 점검 주입) 금지.
  - guard/secret 훅 완화 금지.

## 6. Open Questions

- (없음 — 버전 bump 생략 확정(§5). 모호점 0.)

---

## 7. 기술 접근 (HOW)

- **hooks.json 파싱**: python3(`json.load`)로 `hooks.PreToolUse` 배열 순회 → `matcher=="Bash"` 항목의
  `hooks[]`에서 `type=="command"` && 명령에 `guard.sh` 포함인 것 추출. 플러그인 루트는 repo 레이아웃에서
  계산(`plugins/harness-guard/hooks/hooks.json`의 조부모 = `plugins/harness-guard`)해 `${CLAUDE_PLUGIN_ROOT}`
  치환. 모든 command 훅 경로 해석은 같은 순회에서 수집.
- **반증 구동(AC-3)**: guard-test.sh와 동일하게 `mktemp -d`→`git init`→`checkout -b develop`, `mk()` JSON
  헬퍼로 `{"tool_name":"Bash","tool_input":{"command":"git commit -m x"}}`를 **해석된 guard 경로**에 파이프,
  exit 2 확인. 하드코딩 경로 대신 hooks.json-해석 경로를 쓰는 것이 배선 갭을 닫는 핵심.
- **hooksPath(AC-4~6)**: `git config --get core.hooksPath`로 분기. `.githooks/pre-commit`는 `[ -x ]`.
- **영향 파일**: `tests/plugin-wiring-test.sh`(신규), `.github/workflows/ci-gate.yml`(등록),
  `docs/onboarding.md`(§B 수동단계→검증, §A.3 최종검증), `docs/troubleshooting.md`(:33 정정),
  `docs/specs/guard-gate-redesign-roadmap.md`([I] 상태), `docs/decisions.md`(기록). **버전 bump 없음**
  (§5 확정 — 소비-비대면).
- **테스트 전략**: 스모크 자체가 테스트다. AC-1~6 ↔ `tests/plugin-wiring-test.sh` 섹션 assert 1:1.
  반증 자기검증: hooks.json guard 경로를 임시로 깨면 스모크가 FAIL함을 개발 중 1회 수동 확인(커밋 안 함).

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | `plugin-wiring-test.sh` 섹션 A(계층1 배선+반증 구동) 작성 | AC-1,2,3 | tests/plugin-wiring-test.sh | `bash tests/plugin-wiring-test.sh` | — | |
| 2 | 섹션 B(pre-commit 아티팩트+hooksPath 분기) 추가 | AC-4,5,6 | tests/plugin-wiring-test.sh | `bash tests/plugin-wiring-test.sh` | #1 | |
| 3 | ci-gate.yml 등록(`bash -n` + 실행 스텝) | AC-1..6 | .github/workflows/ci-gate.yml | `bash -n tests/plugin-wiring-test.sh` | #2 | |
| 4 | onboarding.md 수동단계→검증 승격 + troubleshooting.md:33 정정 | — | docs/onboarding.md, docs/troubleshooting.md | (문서 — grep로 거짓주장 0건) | #2 | [P] |
| 5 | 로드맵 [I] 상태 갱신 + decisions.md 기록 (bump 없음) | — | docs/specs/guard-gate-redesign-roadmap.md, docs/decisions.md | (문서) | #3,#4 | |

- 롤백: 전 태스크 독립적, `git revert` 단독 가능. 파괴적 아님.
- 한 기능 = 한 브랜치(`feature/onboarding-falsification-smoke`) = 한 PR.

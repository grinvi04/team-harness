# develop-auto-merge 스펙 (개선2)

> 대상 repo = **team-harness**. `feature/develop-auto-merge` 브랜치 → PR(base=develop).

## 1. 목표 & Why

세션마다 develop 머지·main 릴리즈를 두 번씩 지시하는 마찰을 줄인다. "CI green이면 안전한 상태"를 develop 머지 승인 신호로 삼되, **main=prod 자동배포**라 확인은 유지.

**메커니즘(탐색 검증)**: 래퍼 머지를 막는 건 훅이 아니라 auto-mode 분류기다(guard.sh는 래퍼 통과 — guard-test 55-56행, secret-scan은 유출 전용). Claude Code `permissions.allow`는 분류기를 우회하고, 매처는 커맨드 시작 앵커 + 중간 리터럴 인자 판별이 가능. **안전은 매처가 아니라 스크립트의 base 강제에 둔다**(매처 fragility 최악=분류기 폴백, 안전 불변). **개선1(enforce_admins=true)이 전제** — CI 서버강제가 깔려야 develop 자동의 남은 리스크가 "의도"뿐(낮음).

**성공 기준(측정 가능):** develop base PR을 `bash pr-merge.sh --auto <PR>`로 분류기 프롬프트 없이 머지 가능하고, 같은 커맨드가 main base PR은 거부(exit≠0)한다.

## 2. Scope

- **In:** pr-merge.sh `--auto` 모드(base=develop면 기존 게이트 후 머지, 아니면 거부) · templates/settings.json + .claude/settings.json allow-rule · base 판정 순수함수 분리·단위테스트 · code-review.md/CLAUDE.md 문서 · 버전 bump.
- **Out (Non-goals):** main/release/hotfix 자동머지(확인·분류기 유지) · 기존 pr-merge 기본동작 변경(--auto 미지정은 그대로) · `autoMode.classifyAllShell`(전역 마찰) · 훅 변경(불필요) · route-intent 변경 · 기존 repo settings 소급(repo-sync 소관).

## 3. 기능 요구사항 + 수용기준 (테스트 계약)

- **AC-1 (develop 자동):** WHEN `bash pr-merge.sh --auto <PR>` & PR base=`develop` & 게이트 통과, the system SHALL 머지(exit 0). allow-rule 매치로 분류기 프롬프트 없음(settings 반영 세션).
- **AC-2 (main 거부):** IF `--auto` & PR base≠`develop` THEN the system SHALL 머지하지 않고 거부(exit 3) + "main은 release/hotfix·명시 승인" 힌트.
- **AC-3 (게이트 유지):** WHILE `--auto` & base=develop & (CI red | 미해결 스레드 | 비mergeable), the system SHALL 거부(기존 게이트 재사용).
- **AC-4 (기존 무변경):** WHEN `--auto` 없이 `bash pr-merge.sh <PR>`, the system SHALL 기존 동작 그대로(회귀 0) — release·hotfix·solo-merge·pr-review-gate 무영향.
- **AC-5 (allow-rule 정밀):** templates/settings.json + .claude/settings.json에 `--auto` 허용 규칙 존재. main 형태(비-auto·env-prefix)는 미매치.
- **AC-6 (문서):** code-review.md develop-auto 정책 + CLAUDE.md 머지 안전 절.

## 4. 제약 / 비기능

- 보안: 안전 1차 보증은 스크립트의 base 강제(매처는 마찰감소). enforce_admins=true(개선1) 선행 전제.

## 5. 경계 / Do-Not

- ✅ 해도 됨: pr-merge.sh --auto 추가(기존 경로 재사용), settings allow-rule, 문서, 단위 테스트.
- ⚠️ 먼저 물어봐: main 자동화, classifyAllShell 도입.
- 🚫 절대 금지: main 자동머지, 훅 완화, 기존 pr-merge 기본동작 변경, 매처만 믿고 스크립트 base 강제 생략, 게이트 우회.

## 6. Open Questions

- 없음(테스트=경량 base 분기 단위 + 수동 E2E, gh 모킹은 #109 T2와 별건 — 기본 채택).

---

## 7. 기술 접근 (HOW)

- **base 감지**: `gh pr view "$PR" --repo "$OWNER_REPO" --json baseRefName --jq .baseRefName`(PR 실제 base).
- **순수 함수 분리**: `require_develop_base "<base>"` — develop이면 return 0, else 힌트 stderr + return 3. gh와 분리해 테스트 주입.
- **--auto 파싱**: while-case에 `--auto) AUTO=1; shift;;`. AUTO=1이면 base 감지 → require_develop_base(실패 시 exit 3), 통과면 기존 게이트·머지 그대로.
- **allow-rule**: `Bash(bash * pr-merge.sh --auto *)` — `*` 공백 넘음, `--auto` 리터럴로 non-auto·env-prefix 미매치. templates/settings.json + .claude/settings.json.
- **영향 파일**: plugins/harness-guard/scripts/pr-merge.sh, templates/settings.json, .claude/settings.json, docs/code-review.md, CLAUDE.md, tests/pr-merge-auto-test.sh(신규), plugin.json·README.md.
- **테스트↔AC**: AC-2/3 분기=require_develop_base source 단위(develop→0·main→3). AC-1/AC-5=수동 E2E. AC-4=bash -n + guard-test.

## 8. 태스크 (test-first)

| # | 태스크 | AC | 파일 | 검증 | 의존 |
|---|---|---|---|---|---|
| 1 | pr-merge-auto-test.sh(RED) | AC-2,3 | tests/pr-merge-auto-test.sh | 케이스 정의 | — |
| 2 | pr-merge.sh --auto + require_develop_base(GREEN) | AC-1~4 | scripts/pr-merge.sh | test·bash -n | #1 |
| 3 | settings allow-rule | AC-5 | templates/settings.json, .claude/settings.json | JSON 유효 | — |
| 4 | 문서 | AC-6 | code-review.md, CLAUDE.md | 문구 존재 | #2 |
| 5 | 버전 bump + 회귀 | — | plugin.json, README.md | 전 tests exit 0 | #2 |

## Verification (E2E)

1. `bash tests/pr-merge-auto-test.sh` exit 0(develop 허용·main 거부).
2. 수동: develop PR에 `bash pr-merge.sh --auto <PR>` → 머지 / main PR → 거부(exit 3).
3. 회귀: `bash pr-merge.sh <PR>`(비-auto) 불변 · `bash tests/guard-test.sh` pass.

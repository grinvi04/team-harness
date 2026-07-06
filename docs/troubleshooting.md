# 트러블슈팅 — harness-guard

> 증상 → 원인 → 해법. 가드가 막았을 때, 훅이 안 붙을 때, 의존성이 없을 때.
> 판정 철학(무엇을 왜 막는가)은 `decisions.md`의 "가드/게이트 판정 철학" 항목, 계층은 `intro.html`.

## 1. 가드가 명령을 막았다 (`⛔ [guard] …`, exit 2)

가드는 **차단 사유 + 해결 안내**를 함께 출력한다. 사유별 대응:

| ⛔ 사유 | 왜 | 해법 |
|---|---|---|
| `main/develop 직접 커밋 금지` | 보호 브랜치 직접 작업 금지 | `feature/*`·`fix/*` 브랜치에서 작업 → `/feature-merge`. (서버 branch protection도 동일 강제) |
| `main/develop force push 금지` | 히스토리 파괴 방지 | 브랜치 히스토리 변경이 필요하면 팀장에게 직접 요청. feature 브랜치 force-push는 허용됨 |
| `git reset --hard 금지` | **로컬 비가역** — 미커밋 변경 전체 소실(계층0 백스톱 없음) | 정말 필요하면 **사용자가 직접** 실행(Claude 대행 안 함). `--soft`/`--mixed`는 허용 |
| `프로젝트 핵심 디렉터리 rm -rf 금지` | 루트·상위·`src`/`app`/`node_modules` 재귀삭제(로컬 비가역) | 삭제가 필요하면 사용자가 직접 실행. 하위 경로(`./build` 등)는 허용 |
| `검증기(테스트/마이그레이션) 삭제 금지` | 게이트 무력화 방지 | 테스트/마이그레이션은 사용자가 직접 삭제. `mv`(리네임)는 허용 |
| `npm install -g 금지` | 글로벌 Node 환경 오염 | 로컬 설치(`npm i -D`) 또는 `npx` |
| `맨손 gh pr create/merge 금지` | PR 생성·머지는 게이트 스킬 경유 | `/pr-create`·`/feature-merge`·`/solo-merge` 사용(래퍼가 base 감지·게이트 검증) |
| `신규 feature 브랜치는 승인된 plan 아티팩트 필요` (F5) | 계획-먼저 강제 | 먼저 `/plan`으로 `docs/specs/<name>.md` 작성. trivial이면 `HARNESS_TRIVIAL=1 git checkout -b feature/<name>` |

> **넛지 vs load-bearing**: 커밋·force-push·gh 차단은 서버 branch protection이 막는 **넛지**(best-effort — protection 미설정/드리프트 repo에선 guard가 유일선이라 repo-sync가 protection-on을 점검). `reset --hard`·`rm -rf 코어`·검증기 삭제·`npm -g`는 서버 백스톱이 없는 **진짜 방어선**이라 로컬에서 하드블록한다. F5(스펙-먼저)는 서버 백스톱 없는 절차 넛지(사람 리뷰만).

## 2. 정당한 명령이 막혔다 (과탐)

가드는 서버-백스톱 있는 넛지에서 **under-block 편향**(과차단 안 함)이 원칙이나, 정규식 한계로 드문 과탐이 있을 수 있다.
- 재현되는 과탐은 **이슈로 보고**(명령 원문 + 현재 브랜치 + 기대 동작). `tests/guard-matrix-test.sh`가 계약 회귀망.
- 급하면: 파괴가 아닌 명령은 표현을 바꿔 재시도, 또는 사용자가 직접 실행.

## 3. 가드/스킬이 아예 안 붙는다

- 이 repo(team-harness)에서 훅·스킬을 발동시키려면 **`claude --plugin-dir ./plugins/harness-guard`**로 실행(워킹트리 라이브 로드). 미실행 시 플러그인 계층이 안 붙는다.
- 소비 repo: 마켓플레이스 설치(`onboarding.md`) + `.claude/settings.json`의 `enabledPlugins` 확인.
- pre-commit 훅(계층 0.5): 클론 후 1회 `git config core.hooksPath .githooks` 필요(미설정 시 침묵 통과 → repo-sync가 점검).

## 4. 의존성 부재 (`fail-closed`)

가드는 **python3**에 하드 의존한다(JSON 파싱). `python3 없음/실행 불가` → 가드가 **모든 Bash를 차단**(fail-closed, 우회 방지).
- 해법: `python3` 설치·PATH 확인. (재설계 로드맵 #220-D: python3 부재 시 최소 파괴가드만 남기는 degraded 모드 검토 중.)
- `node`·`gh` 부재는 라우터·PR 래퍼·검증기 기능만 저하(가드 자체는 동작).

## 5. 감사·복구

- **차단 이력**: `~/.claude/hooks/guard-block.log`(session_id·cwd·사유·명령, 크레덴셜 마스킹). 멀티세션 위반 시도 추적. (로컬 write-only — 중앙 집계는 #220-E.)
- **머지 게이트 우회(솔로 승인요건)**: `/solo-merge`가 보호설정 저장→삭제→머지→복구. 중단 시 `set-branch-protection.sh`로 재적용.
- **브랜치 보호 확인/재적용**: `bash plugins/harness-guard/scripts/set-branch-protection.sh <repo> --check`(드리프트 리포트) / 인자 없이(적용).
- **드리프트 점검**: `/repo-sync` 또는 `node plugins/harness-guard/scripts/check-repo-sync.mjs --repo <경로> --harness <team-harness>`.

## 6. 릴리즈/hotfix가 막힌다

- `pr-create.sh: 현재 브랜치가 base` → base(main/develop/기본브랜치)에서 실행 중. feature/fix/release/hotfix 브랜치에서 실행.
- back-merge PR 생성 실패 → `main`은 head로 PR 불가. `sync/backmerge-*` 브랜치 경유(`/hotfix`·`/release` 최신판이 처리).

---

*이 문서로 안 풀리면 `decisions.md`(왜 그렇게 설계됐나)와 해당 스킬 `SKILL.md`를 보고, 재현되면 GitHub 이슈로.*

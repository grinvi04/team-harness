# 스펙 — 팀 모드 브랜치 보호 (`--approvals N`)

## 배경·문제

`set-branch-protection.sh`·`new-repo.sh`는 **솔로 표준(승인요건 0)** 을 하드코딩한다
(`required_pull_request_reviews:null`). 3–10인 팀이 도입하려면 PR 리뷰 승인 ≥1이 필요한데,
현재는 (1) 그걸 거는 옵션이 없고, (2) 드리프트 체커(`classify_protection`)가 승인 ≥1을
"솔로 표준 위반"으로 **오탐**한다 → `/repo-sync`가 팀 repo를 매번 드리프트로 보고.

클라이언트 라우팅·게이트 스킬(`route-intent`·`pr-review-gate`·`solo-merge`)은 `reviewDecision`
동적 판정이라 **팀 모드를 이미 지원**한다. 유일한 갭은 브랜치 보호 **적용·검증**뿐.

## 결정

`set-branch-protection.sh`에 `--approvals N` 옵션 추가(기본 0 = 현 솔로 동작, 하위호환).

- **승인은 main 브랜치에만.** develop은 승인 0 유지 → `pr-merge.sh --auto`(develop CI-green
  무프롬프트 머지, `docs/specs/develop-auto-merge.md`)를 보존. 팀 표준 = "main은 리뷰 필수,
  develop은 CI-게이트 자동".
- **팀 기본에 `dismiss_stale_reviews=true` 내장** — 승인 후 새 커밋 push 시 stale 승인을 무효화
  (재리뷰 강제). 승인 요건이 우회되는 구멍을 막는 load-bearing 설정이라 `--approvals N`(N≥1)에 포함.
- **`--check`의 승인 축은 정보성**: `--approvals` 미지정 시 승인 개수는 드리프트 판정에서 제외
  (0이든 ≥1이든 통과), `enforce_admins`·required checks 불변식만 엄격. `--approvals N` 명시 시에만
  그 baseline으로 판정(`0`=솔로 엄격·정확히 0, `N≥1`=팀·`appr≥N`). 승인↑는 *더 강한* 보호라
  드리프트로 보는 게 애초에 어색 — 이 시맨틱 교정이 `/repo-sync` 팀 repo 오탐을 없앤다.

### seam·테스트

- 적용 payload를 순수 함수 **`reviews_json(N)`** 로 추출: `0→null`,
  `N≥1→{"required_approving_review_count":N,"dismiss_stale_reviews":true}`. 히어독에 주입 전
  단위테스트(기존 `classify_protection`·`contexts_json` seam 패턴과 동일) — 적용부가 테스트를
  타게 해 "무테스트 적용부" 결함 제거.
- `classify_protection`에 4번째 인자 `expected`(기본 `""`=정보성) 추가. 3인자 기존 호출은
  전부 정보성으로 동작(하위호환).

## 비-목표 (표면화)

- **`new-repo.sh` 무변경.** 신규 repo에 승인 1을 걸면 day-1 소유자 1명이 self-approve 불가로
  첫 PR 데드락(GitHub 2026 변경: review 요건은 enforce_admins와 무관하게 항상 강제,
  `solo-merge/SKILL.md:14`). new-repo.sh는 인자 파서도 없다. 팀 승인은 **멤버 합류 후**
  `set-branch-protection.sh --approvals 1`로 올린다. 스코프 1스크립트로 축소·footgun 제거.
- develop 승인, per-branch 세분(main만 N)은 고정. develop 승인은 미래 opt-in.
- `require_code_owner_reviews`(CODEOWNERS 전제)·`require_last_push_approval`은 미포함(마찰↑,
  옵트인 지연). self-approve 금지는 GitHub 기본이라 이미 충족.

## 영향 파일

- `plugins/harness-guard/scripts/set-branch-protection.sh` — `--approvals` 파싱·`reviews_json` seam·
  per-branch 적용(main만)·`classify_protection` baseline 인자·헤더/메시지.
- `tests/set-branch-protection-test.sh` — `reviews_json` 테스트 + classify 정보성/솔로엄격/팀 케이스.
  기존 case "승인1→drift"는 정보성 시맨틱으로 **ok로 flip**(의도된 오탐 수정).
- 문서: `docs/decisions.md`(append) · `docs/code-review.md`(솔로→팀 `--approvals`) ·
  `docs/onboarding.md`(멤버 합류 후 승인↑) · `docs/harness-maintenance.md`(솔로 하드코딩 서술) ·
  `plugins/harness-guard/skills/repo-sync/SKILL.md`(승인 정보성 명시).
- 버전 `0.21.3→0.22.0`(신규 옵션 MINOR): `plugin.json` + `README.md` 배지.

## 검증

- `bash -n set-branch-protection.sh` · `bash tests/set-branch-protection-test.sh` GREEN
  (reviews_json 3케이스 + classify 정보성/솔로/팀 신규 케이스, 기존 회귀 0 except 의도된 flip).
- `enforce_admins=true` + 승인1 + self-approve 불가 = 3인 팀에서 최소 1명 다른 리뷰어 필요(정상).
- develop은 `--approvals 1` 적용 후에도 승인 0 → `--auto` 머지 경로 무영향.
- git-flow: feature → PR(base develop) → CI green → 머지 → 보안검토 → release main v0.22.0.

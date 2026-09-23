---
name: release
description: 사전 검증된 버전을 정식 릴리즈할 때 사용. release 브랜치·main 태그·develop 역병합·헬스체크를 수행하며 hotfix·일반 develop 머지·사전검증 없는 배포는 제외
argument-hint: <version>
effort: high
---

# /release — 릴리즈 실행

**사용법**: `/release <version>`
예) `/release 1.5.0`

> **`/release-check` 통과를 전제로 실행한다** (별도 커맨드 — 품질·보안·마이그레이션 병렬 검증).
> develop → release/vX.X.X → main PR (tag) → develop back-merge PR
> 빌드·헬스체크 명령은 **repo의 AGENTS.md "빌드·테스트 명령" 섹션**에서 읽는다.

---

## Phase 0 — 사전 확인 + 스테이징 헬스 체크 (오케스트레이터 직접 실행)

```bash
git branch --show-current
git checkout develop && git pull origin develop
```

**`/release-check` 미통과 상태에서 절대 진행하지 않는다** — 직전 release-check 결과가 없으면
사용자에게 실행 여부를 확인한다.

스테이징 헬스 체크: AGENTS.md의 스테이징 헬스체크 명령 실행 (정의돼 있지 않으면 사용자에게 확인).

---

## Phase 1 — 릴리즈 브랜치 생성 + 버전 업 (오케스트레이터 직접 실행)

```bash
git checkout -b release/v$VERSION
# AGENTS.md의 버전 범프 명령 실행 (예: npm version / gradle properties 갱신)
# 태그 생성 전 HEAD를 release candidate로 포함해 CHANGELOG를 생성한다(태그 전 생성 가능).
node scripts/generate-changelog.mjs --release v$VERSION > CHANGELOG.md
git add .
git commit -m "chore(release): v$VERSION 릴리즈 준비"
```

---

## Phase 2 — 최종 검증 (조건부)

> 중복 방지: release-check가 develop에서 전체 품질을 이미 검증했고, ci-gate가 release PR에서
> 다시 강제한다. **repo의 ci-gate가 e2e까지 포함하면 이 Phase는 생략**한다.

ci-gate에 e2e가 없는 repo만: (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)
- AGENTS.md의 품질 검증 명령 중 **ci-gate가 커버하지 않는 것**(통상 e2e)만 실행
- 전부 통과 → ✅ / 실패 → ❌ 리포트 후 중단

### ⚠️ release 브랜치에 버전 범프 외 커밋이 추가되면 (리뷰 반영 등)

release-check는 그 커밋을 본 적이 없다 — 머지 전 **변경 범위 기반 재검증**이 필수:
- 모든 경우: ci-gate 재통과 확인 (자동) + e2e 재실행 (ci-gate 미포함 repo는 직접)
- 변경이 인증·권한·입력 검증·시크릿을 건드리면: `security-reviewer` 에이전트 재실행
- 변경이 마이그레이션을 건드리면: release-check Agent C 기준으로 재점검

---

## Phase 3 — main PR 머지 + 태그 (오케스트레이터 직접 실행)

Phase 2(해당 시) ✅인 경우에만 진행.

먼저 `/tmp/release-main-pr.md`에 버전·변경 내용·검증한 후보와 결과·남은 단계를 작성한다.
진행 문서 검사를 채택한 repo(team-harness 포함)는 AGENTS.md의 문서 동기화 계약에 따라
`harness-doc-sync` 선언 하나를 본문에 포함한다. 기존 작업 기록을 연결할 때도 현재 후보와
관련 문서·완료/대기 상태를 대조하고, 아직 실행하지 않은 태그·역병합을 완료로 기록하지 않는다.
관련 문서 변경을 커밋한 뒤, 채택 repo에서는 push 전에 본문을 검사한다:

```bash
node ${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}/scripts/check-document-sync.mjs \
  --repo . --record /tmp/release-main-pr.md --committed
```

미채택 repo에는 선언을 새로 강제하지 않는다. 아래 PR 생성은 준비한 본문 파일을 사용한다.

```bash
# 1. main으로 PR 생성 — 맨손 gh pr create는 guard 차단. 래퍼가 push·생성(--base main 강제).
bash ${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}/scripts/pr-create.sh --base main \
  --title "release: v$VERSION" \
  --body-file /tmp/release-main-pr.md
PR=$(gh pr view --json number --jq .number)
```

**`pr-review-gate` 스킬의 전체 절차(1~7단계)**를 따른다 — AI 리뷰 처리·사람 승인·CI·
commit-status·머지. (단일 출처 — 여기에 복붙하지 않음)

```bash
# 2. 태그
PR=$(gh pr list --state merged --base main --head "release/v$VERSION" --json number \
  --jq 'if length == 1 then .[0].number else empty end')
[ -n "$PR" ]
git checkout main && git pull --ff-only origin main
MERGE_SHA=$(gh pr view "$PR" --json state,mergeCommit --jq 'select(.state == "MERGED") | .mergeCommit.oid')
[ -n "$MERGE_SHA" ]
[ "$(git rev-parse HEAD)" = "$MERGE_SHA" ]
[ "$(git rev-parse origin/main)" = "$MERGE_SHA" ]
git tag v$VERSION "$MERGE_SHA"
git push origin "refs/tags/v$VERSION"
```

---

## Phase 4 — develop back-merge PR (오케스트레이터 직접 실행)

develop도 branch protection이 걸려 있어 직접 push가 거부된다 — **back-merge도 PR로**.
단, `main`은 head로 PR 불가(pr-create가 base 브랜치를 head로 거부)이고 release 브랜치는 머지로 정리됐다
→ **main 기준 `sync/` 브랜치를 만들어 그것을 head로** develop에 PR한다.

`/tmp/release-backmerge-pr.md`에 main PR 번호·태그와 develop 반영 범위를 작성한다.
문서 검사 채택 repo는 Phase 3과 같은 계약으로 선언을 포함하되, main 머지·태그 발행 후의
현재 상태를 다시 대조한다. 태그 발행 전 본문을 그대로 복사하지 않는다. 연결 기록 수정이 필요하면
sync 브랜치에서 커밋하고, PR 생성 전에 이 본문으로 `--committed` 검사를 통과시킨다.

```bash
# main 최신(태그·버전범프 포함)을 담은 back-merge용 sync 브랜치 생성(sync/* 는 F5 plan-게이트 무관)
git checkout main && git pull origin main
git checkout -b sync/backmerge-v$VERSION
# 위 본문·문서 검사를 마친 뒤 래퍼가 push와 PR 생성을 수행한다.
bash ${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}/scripts/pr-create.sh --base develop \
  --title "chore: release/v$VERSION develop 반영" \
  --body-file /tmp/release-backmerge-pr.md
```

**`pr-review-gate` 부록(back-merge 간소 게이트)** 적용: 대상 브랜치의 현재 보호 정책이 요구하는
사람 승인(4단계 해당 시) + CI + 머지. 추가 수정이 있다면 부록의 동일 내용 조건부터 다시 확인한다.
충돌 시 (release 브랜치는 이미 정리됨) back-merge PR의 head인 `sync/backmerge-v$VERSION`에서 develop을 merge해 해소 후 재푸시.

```bash
# 머지 완료 후 브랜치 정리 (sync 브랜치에서 벗어난 뒤 로컬 삭제 — 원격 sync는 back-merge 머지 시 자동 삭제)
git checkout develop && git pull origin develop
git branch -d release/v$VERSION 2>/dev/null || true
git push origin --delete release/v$VERSION 2>/dev/null || true
git branch -d sync/backmerge-v$VERSION 2>/dev/null || true
```

---

## Phase 5 — 배포 후 헬스 체크 (`subagent_type: Explore`, `model: haiku`, **foreground**)

**프롬프트:**
- AGENTS.md의 배포 대기·프로덕션 헬스체크 명령 실행 (최대 10분, 30초 간격)
- 정의돼 있지 않으면 그 사실을 리포트하고 사용자에게 수동 확인 요청

완료 후 출력:
```
✅ 릴리즈 완료
- 버전: v$VERSION
- main 태그: v$VERSION ✅
- develop back-merge PR: 머지 완료 ✅
- 프로덕션: 정상 ✅
```

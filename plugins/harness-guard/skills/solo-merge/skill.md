---
name: solo-merge
description: 솔로 머지 — 품질 게이트는 통과시키고 '솔로라 불가능한 승인 요건'만 enforce_admins 토글로 우회·즉시 복구·검증
argument-hint: "[PR번호]" (생략 시 현재 브랜치의 PR)
disable-model-invocation: true
effort: medium
---

# /solo-merge — 솔로 환경 안전 머지

솔로 개발자는 자기 PR을 승인할 수 없다(GitHub 자기승인 불가). branch protection이 승인 1+를 요구하면 머지가 영구히 막힌다. 이 커맨드는 **CI·리뷰·스레드 resolve 등 품질 게이트는 그대로 통과시킨 뒤, 솔로라 충족 불가능한 승인 요건만** `enforce_admins` 전용 엔드포인트로 일시 우회해 admin 머지하고 **즉시 복구·검증**한다.

> ⛔ **품질 게이트를 건너뛰지 않는다.** CI·conversation resolution이 통과한 PR에만 사용. enforce_admins 토글은 '솔로라 불가능한 사람 승인'만 우회한다. (이번 우회는 `feedback-personal-projects-public-harness`의 문서화된 솔로 머지 패턴이다.)

---

## Phase 0 — 전제 (오케스트레이터 직접 실행)

```bash
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
PR="${1:-$(gh pr view --json number --jq .number)}"   # 인자 없으면 현재 브랜치 PR
BASE=$(gh pr view "$PR" --repo "$OWNER_REPO" --json baseRefName --jq .baseRefName)
```
**전제: `pr-review-gate` 1~3단계(/code-review·이슈 처리·스레드 reply+resolve)가 이미 끝났을 것.** 안 끝났으면 그것부터.

---

## Phase 1 — 머지 전 게이트 검증 (우회 *전* 필수)

아래가 **모두 통과**여야 Phase 2 진행 (하나라도 아니면 중단·보고):
```bash
# 1) CI required check 전부 통과 (pending이면 --watch로 완료까지 대기)
gh pr checks "$PR" --repo "$OWNER_REPO" --watch
# 2) 외부 배포 commit-status (statuses 0개면 미연동 → 정상)
HEAD_SHA=$(gh pr view "$PR" --repo "$OWNER_REPO" --json headRefOid --jq .headRefOid)
gh api "repos/$OWNER_REPO/commits/$HEAD_SHA/status" --jq '.state'
# 3) 미해결 리뷰 스레드 0건
gh api graphql -f query='query($o:String!,$n:String!,$p:Int!){repository(owner:$o,name:$n){pullRequest(number:$p){reviewThreads(first:50){nodes{isResolved}}}}}' \
  -F o="${OWNER_REPO%/*}" -F n="${OWNER_REPO#*/}" -F p="$PR" \
  --jq '[.data.repository.pullRequest.reviewThreads.nodes[]|select(.isResolved==false)]|length'
# 4) 충돌 없음
gh pr view "$PR" --repo "$OWNER_REPO" --json mergeable --jq .mergeable
```
판정: CI 모두 SUCCESS · commit-status가 failure/error 아님 · 미해결 0 · mergeable=MERGEABLE → 진행.

---

## Phase 2 — 토글 머지 (enforce_admins 전용 엔드포인트만 건드림)

```bash
gh api -X DELETE "repos/$OWNER_REPO/branches/$BASE/protection/enforce_admins"   # 승인 요건 우회용 일시 해제 (나머지 보호는 그대로)
gh pr merge "$PR" --repo "$OWNER_REPO" --merge --admin --delete-branch
gh api -X POST "repos/$OWNER_REPO/branches/$BASE/protection/enforce_admins"     # 즉시 복구
```

---

## Phase 3 — 복구 검증 (필수 — 빼먹으면 보호 구멍이 남는다)

```bash
gh pr view "$PR" --repo "$OWNER_REPO" --json state --jq .state              # → MERGED
gh api "repos/$OWNER_REPO/branches/$BASE/protection" --jq '.enforce_admins.enabled'  # → true
```
- `MERGED` + `enforce_admins=true` 둘 다 확인되면 완료 출력.
- `enforce_admins`가 `false`면 **즉시 재설정**하고 사용자에게 경고. (과거 토글 후 복구 누락 사고가 있었음 — 이 검증은 생략 금지.)

> 릴리즈/핫픽스의 main 머지·develop back-merge도 같은 솔로 제약을 받는다 — 그 경우 해당 base 브랜치에 이 패턴을 동일 적용.

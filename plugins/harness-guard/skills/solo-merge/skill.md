---
name: solo-merge
description: 솔로 머지 — 품질 게이트는 통과시키고 '솔로라 불가능한 승인 요건'만 required_pull_request_reviews 일시 삭제로 우회·즉시 복구·검증
argument-hint: "[PR번호]" (생략 시 현재 브랜치의 PR)
effort: medium
---

# /solo-merge — 솔로 환경 안전 머지

솔로 개발자는 자기 PR을 승인할 수 없다(GitHub 자기승인 불가). branch protection이 승인 1+를 요구하면 머지가 영구히 막힌다. 이 커맨드는 **CI·리뷰·스레드 resolve 등 품질 게이트는 그대로 통과시킨 뒤, 솔로라 충족 불가능한 승인 요건만** `required_pull_request_reviews`를 일시 삭제해 머지하고 **즉시 복구·검증**한다.

> ⚠️ **enforce_admins 토글 방식은 더 이상 작동하지 않는다.** GitHub이 2026년경 동작을 변경해 `enforce_admins=false`로 설정해도 REST API·GraphQL 모두 review 요건을 강제한다. `required_pull_request_reviews` 직접 삭제·복구 방식을 사용한다.

> ⛔ **품질 게이트를 건너뛰지 않는다.** CI·conversation resolution이 통과한 PR에만 사용.

---

## Phase 0 — 전제 (오케스트레이터 직접 실행)

```bash
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
PR="${1:-$(gh pr view --json number --jq .number)}"
BASE=$(gh pr view "$PR" --repo "$OWNER_REPO" --json baseRefName --jq .baseRefName)
```
**전제: `pr-review-gate` 1~3단계(/code-review·이슈 처리·스레드 reply+resolve)가 이미 끝났을 것.**

---

## Phase 1 — 머지 전 게이트 검증 (우회 *전* 필수)

아래가 **모두 통과**여야 Phase 2 진행:
```bash
# 1) CI required check 전부 통과
gh pr checks "$PR" --repo "$OWNER_REPO" --watch --required
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

## Phase 2 — 삭제·머지·복구

```bash
# 현재 review 보호 설정 저장 (복구용)
REVIEWS_CONFIG=$(gh api "repos/$OWNER_REPO/branches/$BASE/protection/required_pull_request_reviews" 2>/dev/null)
REVIEW_COUNT=$(echo "$REVIEWS_CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['required_approving_review_count'])" 2>/dev/null || echo "1")

# review 요건 일시 삭제
gh api -X DELETE "repos/$OWNER_REPO/branches/$BASE/protection/required_pull_request_reviews"

# 머지
gh pr merge "$PR" --repo "$OWNER_REPO" --merge --delete-branch

# 즉시 복구
gh api -X PATCH "repos/$OWNER_REPO/branches/$BASE/protection/required_pull_request_reviews" \
  -F required_approving_review_count="$REVIEW_COUNT"
```

---

## Phase 3 — 복구 검증 (필수)

```bash
gh pr view "$PR" --repo "$OWNER_REPO" --json state --jq .state   # → MERGED
gh api "repos/$OWNER_REPO/branches/$BASE/protection/required_pull_request_reviews" \
  --jq '.required_approving_review_count'                          # → 원래 값(보통 1)
```
- `MERGED` + review_count 복구 확인 둘 다 통과해야 완료.
- review_count가 복구 안 됐으면 **즉시 재설정**하고 사용자에게 경고.

> 릴리즈/핫픽스의 main 머지·develop back-merge도 같은 솔로 제약을 받는다 — 그 경우 해당 base 브랜치에 이 패턴을 동일 적용.

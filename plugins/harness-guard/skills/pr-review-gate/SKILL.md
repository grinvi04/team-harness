---
name: pr-review-gate
description: PR 생성 후 머지까지의 표준 게이트 절차 — Gemini 리뷰 대기·처리(인라인 reply + resolveReviewThread), CI watch, 외부 배포 commit-status 검증. feature-merge·hotfix·release 커맨드가 공통으로 이 절차를 따른다. PR을 만들고 머지 전 리뷰/CI 게이트를 거쳐야 할 때 사용.
---

# PR 리뷰·CI 게이트 (공통 절차)

`feature-merge`·`hotfix`·`release` 가 PR 생성 후 머지 전까지 공통으로 따르는 단일 출처 절차다.
커맨드별로 복붙하지 말고 이 절차를 참조한다. (과거 복붙 드리프트로 리뷰 resolve 누락·약한 머지 버전 사고 발생)

전제: `PR` = PR 번호. `OWNER_REPO`는 동적으로 구한다.
```bash
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
```

---

## 1. Gemini 리뷰 자동 감지 (5분 타임아웃)

```bash
GEMINI_COUNT=0; MAX=10
until gh api "repos/$OWNER_REPO/pulls/$PR/reviews" \
  --jq '[.[] | select(.user.login == "gemini-code-assist[bot]")] | length' \
  2>/dev/null | grep -qv "^0$"; do
  GEMINI_COUNT=$((GEMINI_COUNT+1))
  [ $GEMINI_COUNT -ge $MAX ] && echo "Gemini 리뷰 없음 (5분 초과) — 게이트 계속 진행" && break
  sleep 30
done
gh api "repos/$OWNER_REPO/pulls/$PR/reviews" \
  --jq '.[] | select(.user.login == "gemini-code-assist[bot]") | .body'
gh api "repos/$OWNER_REPO/pulls/$PR/comments" \
  --jq '.[] | {id: .id, path: .path, line: .line, body: .body[:300]}'
```

## 2. 이슈 처리 기준

- **HIGH**: 반드시 처리. 단, **기계적 수용 금지** — 사실관계를 실측/근거로 검증한다. 옳으면 수정 → 테스트 통과 → 재푸시 → 스레드 reply+resolve. 틀렸으면 근거를 reply로 남기고 resolve.
- **MEDIUM**: 내용 검토 후 판단. 수정 시 동일 흐름.
- **LOW/INFO**: 참고만.
- ⚠️ 스레드는 **인라인 코멘트에 reply**(`pulls/<PR>/comments/<ID>/replies`) 후 GraphQL `resolveReviewThread`로 resolve. 일반 PR 코멘트(`issues/comments`)에 달면 안 됨.

## 3. 스레드 reply + resolve

```bash
# reply (인라인 코멘트 ID 기준)
gh api "repos/$OWNER_REPO/pulls/$PR/comments/$COMMENT_ID/replies" -f body="<답변>"
```

resolve — **미해결 스레드를 한 번에**. (주의: zsh는 변수 단어분리 안 함 → `while read` 사용. GraphQL ID는 `-F` 변수로 전달)
```bash
gh api graphql -f query='
query($owner:String!,$name:String!,$pr:Int!){
  repository(owner:$owner,name:$name){
    pullRequest(number:$pr){ reviewThreads(first:30){ nodes{ id isResolved } } }
  }
}' -F owner="${OWNER_REPO%/*}" -F name="${OWNER_REPO#*/}" -F pr="$PR" \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved==false) | .id' \
| while IFS= read -r TID; do
    [ -z "$TID" ] && continue
    gh api graphql \
      -f query='mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread{isResolved} } }' \
      -F id="$TID" --jq '.data.resolveReviewThread.thread.isResolved' | xargs echo "$TID ->"
  done
```

resolve 후 **미해결 0건 직접 확인** (위임 금지):
```bash
gh api graphql -f query='
query($owner:String!,$name:String!,$pr:Int!){
  repository(owner:$owner,name:$name){ pullRequest(number:$pr){ reviewThreads(first:30){ nodes{ isResolved } } } }
}' -F owner="${OWNER_REPO%/*}" -F name="${OWNER_REPO#*/}" -F pr="$PR" \
  --jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved==false)] | length'
# → 0 이어야 머지 진행
```

## 4. CI 통과 확인

```bash
gh pr checks "$PR" --watch
```

## 5. 외부 배포 commit-status 게이트

`gh pr checks`는 GitHub check-run만 본다. Vercel·Railway 등은 **commit status**로 보고하므로 별도 확인.
```bash
HEAD_SHA=$(gh pr view "$PR" --json headRefOid --jq .headRefOid)
gh api "repos/$OWNER_REPO/commits/$HEAD_SHA/status" \
  --jq '"overall: \(.state)", (.statuses[] | "\(.context): \(.state)")'
```
판정 기준:
- `statuses`에 **failure/error** → 머지 중단, 원인 확인
- **pending** → 배포 완료까지 대기
- **statuses 0개** → 외부 배포 commit-status 미연동 → `overall=pending`이어도 **정상 진행** (예: webhook-service)

## 6. 머지

HIGH/MEDIUM 처리·스레드 resolve(0건)·CI·commit-status 모두 통과 후:
```bash
gh pr merge "$PR" --merge
```

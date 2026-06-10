---
name: pr-review-gate
description: PR 생성 후 머지까지의 표준 게이트 절차 — AI 리뷰 처리(인라인 reply + resolveReviewThread), 사람 승인 확인, CI watch, 외부 배포 commit-status 검증. feature-merge·hotfix·release 커맨드가 공통으로 이 절차를 따른다. PR을 만들고 머지 전 게이트를 거쳐야 할 때 사용.
---

# PR 리뷰·CI 게이트 (공통 절차)

`feature-merge`·`hotfix`·`release`가 PR 생성 후 머지 전까지 공통으로 따르는 단일 출처 절차다.
커맨드별로 복붙하지 말고 이 절차를 참조한다. (복붙 드리프트 = 게이트 누락 사고의 원인)

전제: `PR` = PR 번호. `OWNER_REPO`는 동적으로 구한다.
```bash
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
```

AI 리뷰는 repo의 `ai-review.yml` 워크플로(claude-code-action)가 PR에 인라인 코멘트로 남긴다.
워크플로 미설치 repo면 1단계는 스킵하고 2단계부터 진행한다.

---

## 1. AI 리뷰 완료 대기

ai-review 잡이 PR check로 잡힌다 — 완료까지 대기 (다른 CI와 함께 4단계에서 최종 확인되므로
여기서는 리뷰 코멘트 생성 여부만 확인):

```bash
AI_WAIT=0; MAX=10
until gh api "repos/$OWNER_REPO/pulls/$PR/comments" --jq 'length' 2>/dev/null | grep -qv "^0$"; do
  AI_WAIT=$((AI_WAIT+1))
  [ $AI_WAIT -ge $MAX ] && echo "AI 리뷰 코멘트 없음 (5분 초과) — 게이트 계속 진행" && break
  sleep 30
done
gh api "repos/$OWNER_REPO/pulls/$PR/comments" \
  --jq '.[] | {id: .id, user: .user.login, path: .path, line: .line, body: .body[:300]}'
```

사람 리뷰어가 단 인라인 코멘트도 같은 목록에 나온다 — 작성자 구분 없이 2단계 기준으로 전부 처리한다.

## 2. 이슈 처리 기준

- **HIGH / `issue:`**: 반드시 처리. 단, **기계적 수용 금지** — 사실관계를 실측/근거로 검증한다.
  옳으면 수정 → 테스트 통과 → 재푸시 → 스레드 reply+resolve. 틀렸으면 근거를 reply로 남기고 resolve.
- **MEDIUM / `question:`**: 내용 검토·답변 후 판단. 수정 시 동일 흐름.
- **LOW / `nit:` / `suggestion:`**: 참고. 수용 여부 자유, reply는 남긴다.
- ⚠️ 스레드는 **인라인 코멘트에 reply**(`pulls/<PR>/comments/<ID>/replies`) 후 GraphQL
  `resolveReviewThread`로 resolve. 일반 PR 코멘트(`issues/comments`)에 달면 안 됨.

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
# → 0 이어야 다음 단계 진행
```

## 4. 사람 승인 확인 ← 머지의 필수 조건

branch protection이 승인 1+를 요구한다 — AI 리뷰·CI 통과는 사람 승인을 대체하지 않는다.

```bash
gh pr view "$PR" --json reviewDecision --jq .reviewDecision
# APPROVED        → 다음 단계 진행
# REVIEW_REQUIRED → 리뷰어에게 요청하고 대기 (5분 간격 재확인, 30분 초과 시 사용자에게 보고 후 중단)
# CHANGES_REQUESTED → 지적 사항을 2~3단계 기준으로 처리 후 재요청
```

리뷰어 지정이 안 돼 있으면 `code-review.md`의 배정 규칙(도메인 주담당, 권한·금액·마이그레이션은
+리드)에 따라 `gh pr edit "$PR" --add-reviewer <리뷰어>`로 지정하고 사용자에게 알린다.

## 5. CI 통과 확인

```bash
gh pr checks "$PR" --watch
```

## 6. 외부 배포 commit-status 게이트

`gh pr checks`는 GitHub check-run만 본다. 외부 배포 서비스는 **commit status**로 보고하므로 별도 확인.
```bash
HEAD_SHA=$(gh pr view "$PR" --json headRefOid --jq .headRefOid)
gh api "repos/$OWNER_REPO/commits/$HEAD_SHA/status" \
  --jq '"overall: \(.state)", (.statuses[] | "\(.context): \(.state)")'
```
판정 기준:
- `statuses`에 **failure/error** → 머지 중단, 원인 확인
- **pending** → 배포 완료까지 대기
- **statuses 0개** → 외부 배포 commit-status 미연동 repo → `overall=pending`이어도 **정상 진행**

## 7. 머지

이슈 처리·스레드 resolve(0건)·사람 승인·CI·commit-status 모두 통과 후:
```bash
gh pr merge "$PR" --merge
```

## 부록 — back-merge PR 간소 게이트

`hotfix`·`release`의 develop 반영 PR(내용이 main PR과 동일한 back-merge)은 1~3단계를 생략하고
**4(승인)·5(CI)·7(머지)만** 적용한다. 승인 요청 시 "main PR #N과 동일 내용의 back-merge"임을 본문에 명시.

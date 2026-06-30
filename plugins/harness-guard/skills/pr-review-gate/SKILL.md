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

AI 리뷰는 PR 단계에서 Claude Code `/code-review`로 수행한다 (구독 포함, PR별 API 과금 없음 — 외부 AI 리뷰봇에 의존하지 않는다).
사람 리뷰어의 인라인 코멘트도 같은 기준으로 처리한다.

---

## 1. AI 코드 리뷰 (`/code-review`)

PR 생성 후 Claude Code `/code-review`로 변경분(현재 브랜치/PR diff)을 리뷰하고,
지적사항을 2단계 기준으로 처리한다 — 옳으면 수정 → 테스트 통과 → 재푸시, 틀리면 근거 기록.
(구독 포함, PR별 API 과금 없음 — 외부 AI 리뷰봇에 의존하지 않는다.)

**설계 검토 차원**도 함께 본다(규모에 맞게):
- **의존성 규칙 / 도메인 경계**: 변경이 비즈니스·도메인 로직을 IO·프레임워크·UI에 결합시키지 않는가. repo가 AGENTS.md(또는 team-harness `clean-architecture.md`)에 선언한 경계·계층을 위반하지 않는가.
- **SOLID(judicious)**: SRP·DIP 위반이 *실제 복잡도를 키울 때만* 지적. 추측성 추상화·인터페이스 폭발은 오히려 위반으로 본다(단순함 우선·순수주의 배제). 기존 코드 대규모 retrofit은 요구하지 않는다 — 신규 변경분 한정.

**도메인 정합성 함정**(cross-domain — 변경분에 해당하면 확인):
- **인증·데이터 의존 신규 기능**: 더미세션 렌더 스모크로 갈음 금지 — **실 IdP 인증 + 실 백엔드 데이터 통합 e2e**로 확인(`code-review.md`).
- **입력 오류 4xx**: 역직렬화·타입변환·검증 위반이 4xx로 매핑되는가 — 미매핑 5xx 흡수 점검(`api-standards.md`).
- **update 응답 version 정확성**: 낙관적 잠금 update 응답은 **flush 후**(또는 재조회) 매핑 — flush 전이면 stale version으로 거짓 409(`api-standards.md`).
- **페이지네이션/외부 응답을 배열로 가정하지 말 것**: `.filter`/`.map`/`forEach` 전에 형태를 확인한다 — 페이지네이션 응답은 `{content, page, …}`(또는 `{data, total}`)이지 배열이 아니다. 배열 가정 캐스팅은 실데이터에서 페이지 크래시(런타임 `x.map is not a function`) 클래스다(`api-standards.md` 페이지네이션·typescript.md 배열 검증).

사람 리뷰어가 인라인 코멘트를 남겼다면 같은 목록에서 함께 확인해 2단계 기준으로 처리한다:

```bash
gh api "repos/$OWNER_REPO/pulls/$PR/comments" \
  --jq '.[] | {id: .id, user: .user.login, path: .path, line: .line, body: .body[:300]}'
```

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

> **솔로 환경**: 리뷰어가 없어 자기승인이 불가능하면(REVIEW_REQUIRED 고착), 품질 게이트(CI·스레드 resolve) 통과 후 **`/solo-merge`** 로 승인 요건만 안전 우회(enforce_admins 토글→머지→즉시 복구·검증). 5·7단계를 대체한다.

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
gh pr checks "$PR" --watch --required
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

이슈 처리·스레드 resolve(0건)·사람 승인·CI·commit-status 모두 통과 후, **머지 래퍼**로 머지한다(맨손 `gh pr merge`는 guard가 차단 — 래퍼가 CI·스레드·mergeable 게이트를 재검증한 뒤 머지):
```bash
bash ${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}/scripts/pr-merge.sh "$PR"
```

## 부록 — back-merge PR 간소 게이트

`hotfix`·`release`의 develop 반영 PR(내용이 main PR과 동일한 back-merge)은 1~3단계를 생략하고
**4(승인)·5(CI)·7(머지)만** 적용한다. 승인 요청 시 "main PR #N과 동일 내용의 back-merge"임을 본문에 명시.

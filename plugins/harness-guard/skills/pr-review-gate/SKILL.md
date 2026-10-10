---
name: pr-review-gate
description: 열린 PR의 AI 리뷰·사람 승인·CI·외부 배포 상태를 처리해 머지 준비를 확인할 때 사용. PR 없는 코드 개발·PR 생성만 수행·게이트 우회는 제외
---

# PR 리뷰·CI 게이트 (공통 절차)

스크립트 실행 전 [현재 스킬 경로 검증](../runtime-path.md)을 각 도구 호출에서 적용한다.

`feature-merge`·`hotfix`·`release`가 PR 생성 후 머지 전까지 공통으로 따르는 단일 출처 절차다.
커맨드별로 복붙하지 말고 이 절차를 참조한다. (복붙 드리프트 = 게이트 누락 사고의 원인)

전제: `PR` = PR 번호. `OWNER_REPO`는 동적으로 구한다.
```bash
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
REVIEW_SCOPE="${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/skills/pr-review-gate/review-thread-scope.mjs"
REVIEW_DIR=$(mktemp -d)
REVIEW_SNAPSHOT="$REVIEW_DIR/review.json"
PROCESSED_REVIEW="$REVIEW_DIR/processed.json"
node "$REVIEW_SCOPE" snapshot --repo "$OWNER_REPO" --pr "$PR" --output "$REVIEW_SNAPSHOT"
```

snapshot 생성 실패·후보 변경은 미확인이므로 중단한다. snapshot은 정확한 head/base OID와 당시 미해결 thread·원래 root comment ID를 저장한다.
리뷰 중 수정·push로 후보가 바뀌면 새 snapshot에서 현재 후보를 다시 검토한다. 이전에 처리한 ID를 자동 승인하지 않고, 새 thread도 처리 목록에 자동 추가하지 않는다.

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

## 3. 처리한 snapshot ID만 reply + resolve

리뷰한 내용·수정 검증 또는 기각 근거를 확인한 뒤 **명시적으로 처리한 ID만** 입력한다.
새로 조회한 unresolved 전체를 해결 목록으로 만들지 않는다. 동일 snapshot의 repo·PR·candidate를 보존하고
`threads`에 처리한 항목의 `threadId`, 실제 `reply`, 검증/기각 근거 `evidence`를 넣는다.
근거 문자열 존재는 검토의 정확성 보장이 아니므로 원래 지적·현재 코드·시험 결과를 직접 대조한다.

```bash
# 입력 뼈대만 생성한다. threads=[]는 아무 thread도 해결하지 않는다.
node - "$REVIEW_SNAPSHOT" "$PROCESSED_REVIEW" <<'NODE'
const fs = require('node:fs');
const snapshot = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
fs.writeFileSync(process.argv[3], JSON.stringify({repo: snapshot.repo, pr: snapshot.pr,
  candidate: snapshot.candidate, threads: []}, null, 2), {flag: 'wx'});
NODE
```

처리한 항목 형식: `{ "threadId": "PRRT_...", "reply": "수정·기각 답변", "evidence": "현재 후보의 시험 결과·근거" }`.
snapshot 밖/중복 ID·잘못된 입력·근거 누락은 mutation 전에 거부한다. 후보 변경·조회 실패는 각 재조회 시 중단한다.
helper는 snapshot의 원래 root comment에 REST reply를 달고, 그 **명시한 ID만** GraphQL resolve한다.
reply·resolve 실패나 후보 변경은 완료로 보고하지 않는다. 일부 reply/resolve가 이미 실행됐다면 그 부분을
그대로 보고하고 남은 항목만 다시 판단한다. 재실행의 reply 중복·원자적 일괄 처리를 보장하지 않는다.

```bash
node "$REVIEW_SCOPE" resolve --snapshot "$REVIEW_SNAPSHOT" --processed "$PROCESSED_REVIEW"
```

resolve 뒤 **미해결 0건을 직접 재조회**한다(위임 금지). helper의 최종 재조회가 `ready:true`와 exit 0이어야
다음 단계로 진행한다. 신규/미처리 thread는 해결하지 않고 `unresolvedIds`에 남기며 exit 1로 중단한다.
조회 실패를 0건으로 처리하지 않는다. snapshot·처리 ID·답변·근거·실행 결과는 기존 PR/검증 기록에 연결한다.

## 4. 사람 승인 확인 ← **팀 모드(승인요건 有)에서만**

branch protection이 승인을 요구하는 팀 모드에서만 적용된다 — AI 리뷰·CI 통과는 사람 승인을 대체하지 않는다.

> **솔로 표준(승인요건 0)**: 브랜치 보호가 CI-게이트만이고 승인요건 0이면(decisions "브랜치 보호 표준" — 솔로는 자기승인 불가라 승인요건을 안 건다) **이 4단계는 해당 없음** — CI·스레드 resolve 통과 후 소유자가 바로 `pr-merge.sh`로 머지한다. `/solo-merge`도 불필요.
> **팀 모드(승인 1+ 재활성)**: 리뷰어 부재로 REVIEW_REQUIRED 고착 시 품질 게이트 통과 후 **`/solo-merge`** 로 승인요건만 안전 우회(전체 보호설정 저장→삭제→머지→복구). (enforce_admins 토글 폐기 — solo-merge/SKILL.md.)

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
HEAD_SHA=$(node -e 'console.log(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).candidate.headRefOid)' "$REVIEW_SNAPSHOT")
# snapshot의 head에 대응하는 commit status만 판정한다. 후보 변경 시 새 후보로 다시 검토한다.
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
REVIEW_CANDIDATE=$(node -e 'const c=JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).candidate; console.log([c.baseRefName,c.baseRefOid,c.headRefOid].join("|"))' "$REVIEW_SNAPSHOT") || exit 1
IFS='|' read -r REVIEW_BASE REVIEW_BASE_OID REVIEW_HEAD_OID <<< "$REVIEW_CANDIDATE"
bash "${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/pr-merge.sh" "$PR" \
  --base "$REVIEW_BASE" --expected-base-oid "$REVIEW_BASE_OID" --expected-head "$REVIEW_HEAD_OID"
```

래퍼는 게이트 시작·종료의 head/base 이름과 JSON OID를 대조하고, 조회 실패/후보 변경을 거부한다.
서버 merge에는 공식 `--match-head-commit`으로 검증 head를 결박한다([gh 문서](https://cli.github.com/manual/gh_pr_merge)).
base 재조회는 원자적 서버 비교가 아니므로 이후 base race 제거를 보장하지 않는다. strict required CI와
현재 protected base 정책이 계속 필요하며 정책을 완화해 통과시키지 않는다. `--auto`는 develop 전용이고
required CI 없음·미해결 thread·mergeable 미통과를 계속 거부한다.

## 부록 — back-merge PR 간소 게이트

`hotfix`·`release`의 develop 반영 PR(내용이 main PR과 동일한 back-merge)은 1~3단계를 생략하고
**4(대상 브랜치의 현재 보호 정책이 요구할 때만 사람 승인)·5(CI)·7(머지)**를 적용한다.
승인요건이 0이거나 없으면 4단계는 해당 없음이며, 1 이상이면 승인 확인을 유지한다.
현재 보호 정책 조회에 실패하거나 결과가 불명확하면 승인요건 없음으로 추정하지 않고 미확인으로 보고 중단한다.
본문에 "main PR #N과 동일 내용의 back-merge"임을 명시한다. 간소 게이트도 시작 시 head/base snapshot을 만들고 7단계의 후보 결박을 유지한다. 문서 상태 갱신·충돌 해소 등
추가 변경이 있으면 동일 내용으로 간주하지 않고 전체 절차로 그 변경을 검토한다.

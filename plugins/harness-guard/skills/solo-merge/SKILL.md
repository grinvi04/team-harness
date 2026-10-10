---
name: solo-merge
description: 솔로 repo에서 자기승인 불가능 조건만 원자적으로 해제·복구하며 PR을 머지할 때 사용. CI·리뷰 우회·팀 승인 우회·main 릴리즈는 제외
argument-hint: "\"[PR번호]\" (생략 시 현재 브랜치의 PR)"
---

# /solo-merge — 솔로 환경 안전 머지 (break-glass)

스크립트 실행 전 [현재 스킬 경로 검증](../runtime-path.md)을 각 도구 호출에서 적용한다.

솔로 개발자는 자기 PR을 승인할 수 없다(GitHub 자기승인 불가). branch protection이 승인 1+를 요구하면 머지가 영구히 막힌다. 이 커맨드는 **CI·리뷰·스레드 resolve 등 품질 게이트는 그대로 통과시킨 뒤, 솔로라 충족 불가능한 승인 요건만** `required_pull_request_reviews`를 일시 삭제해 머지하고 **즉시 복구·검증**한다.

> **언제 필요한가**: 브랜치 보호에 **승인요건(1+)이 걸린 repo**(팀 모드 / 리뷰어 합류로 재활성)에서만. **솔로 표준**(decisions "브랜치 보호 표준" — 승인요건 0·CI-gate·enforce_admins on)에선 우회할 승인요건이 없어 소유자가 바로 `pr-merge.sh`로 머지하므로 **이 커맨드가 불필요**하다. 즉 승인요건을 재활성했을 때의 **break-glass**다.

> ⚠️ **enforce_admins 토글 방식은 더 이상 작동하지 않는다.** GitHub이 2026년경 동작을 변경해 `enforce_admins=false`로 설정해도 REST API·GraphQL 모두 review 요건을 강제한다. `required_pull_request_reviews` 직접 삭제·복구 방식을 사용한다.

> ⛔ **품질 게이트를 건너뛰지 않는다.** CI·conversation resolution이 통과한 PR에만 사용.

---

## 원자성 — 왜 래퍼인가 ([F] #220)

삭제(DELETE)→머지→복구(PATCH)를 AI가 **별도 호출로 수동 실행**하면, DELETE와 PATCH **사이에 중단**(머지 실패·세션 종료·Ctrl-C·컨텍스트 소진 이탈)될 때 **복구 PATCH가 실행되지 않아 base 브랜치 보호가 승인요건 삭제된 채 방치**된다(조용한 약화 → 다음 PR 무승인 머지 위험). 그래서 전 과정을 **원자 래퍼 스크립트**(`scripts/solo-merge.sh`)가 `trap … EXIT INT TERM HUP`으로 감싸, 처리 가능한 종료에서 복구를 시도하고 정상 종료에서는 복원 결과를 검증한다.

> ⚠️ **한계**: `SIGKILL`·전원손실은 trap으로 잡을 수 없고 API 오류는 복구를 실패시킬 수 있다.
> 중단/복구 실패 시 실행 전에 저장한 원래 전체 보호 정책과 실제 API 읽기 결과를 대조해 복구한다.
> `set-branch-protection.sh --check`는 표준 정책과의 드리프트만 검사하며, 이번 실행 전 예외 정책으로 복원됐다는 증명이 아니다.

---

## Phase 0 — 전제

**전제: `pr-review-gate` 1~3단계(/code-review·이슈 처리·스레드 reply+resolve)가 이미 끝났을 것.**
래퍼가 머지 직전 CI·미해결 스레드·mergeable을 **다시** 검증하지만(이중 게이트), 리뷰 처리 자체는 선행돼야 한다.

## Phase 1 — 원자 실행 (오케스트레이터 직접 실행)

```bash
# pr-review-gate에서 검토한 snapshot을 그대로 전달한다.
REVIEW_CANDIDATE=$(node -e 'const c=JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).candidate; console.log([c.baseRefName,c.baseRefOid,c.headRefOid].join("|"))' "$REVIEW_SNAPSHOT") || exit 1
IFS='|' read -r REVIEW_BASE REVIEW_BASE_OID REVIEW_HEAD_OID <<< "$REVIEW_CANDIDATE"
bash "${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/solo-merge.sh" "$PR" \
  --base "$REVIEW_BASE" --expected-head "$REVIEW_HEAD_OID" --expected-base-oid "$REVIEW_BASE_OID"
# snapshot 변경은 보호 DELETE 전에 거부하고 동일 후보를 머지 래퍼에 전달한다.
```

래퍼가 **원자적으로** 수행한다:
1. **pre-gate**(보호 건드리기 전): CI required green · 미해결 리뷰 스레드 0 · mergeable — 미달이면 **DELETE 이전에 중단**(보호 무손상).
2. **save + arm trap**: 성공적으로 조회한 전체 브랜치 보호와 `required_pull_request_reviews` 복구 payload를 저장한 후 `trap … EXIT INT TERM HUP` 무장. 성공한 보호 응답에서 리뷰 정책이 명시적으로 null이면 DELETE·PATCH·trap 전부 생략(요건 신규 생성 방지).
3. **DELETE → merge → restore**: 승인요건 일시 삭제 → `pr-merge.sh`로 머지(CI·스레드·mergeable 재검증) → 저장한 **전체 설정**을 PATCH로 복원. 처리 가능한 중단에서 trap이 동일 복원을 시도한다(멱등). 조회 오류/잘못된 정책은 DELETE 전에 중단한다.
4. **verify**: `state=MERGED` + 저장한 리뷰 정책 전체와 나머지 브랜치 보호 필드가 원값으로 복원됐는지 확인(API URL·집합 순서는 정규화). 조회 실패/불일치면 경고 후 비정상 종료.

> 삭제 대상은 **승인요건(required_pull_request_reviews)뿐**이다. `allow_force_pushes`·`enforce_admins`·status-check 등 다른 보호는 건드리지 않는다. 저장은 count만이 아니라 `dismiss_stale_reviews`·`require_code_owner_reviews`·`require_last_push_approval`까지 전체를 보존해, 복구가 base 보호를 매 실행 약화(K1)시키지 않는다.

성공 시 `✅ solo-merge 완료 — PR #<N> MERGED` + `🔒 복구 확인` 출력. 실패(`❌ 복구 검증 실패`)면 원래 전체 정책과 base 보호를 직접 비교하고 필요한 복구를 한다. 기존 표준과의 비교만으로 복원 성공을 판단하지 않는다.

---

> 릴리즈/핫픽스의 main 머지·develop back-merge도 같은 솔로 제약을 받는다 — 그 경우 해당 base 브랜치 PR에 이 커맨드를 동일 적용한다(래퍼가 base 자동 감지).

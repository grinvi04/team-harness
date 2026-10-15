---
name: pr-create
description: 현재 feature/fix/codex 브랜치의 품질을 확인하고 올바른 base로 PR만 생성할 때 사용. 코드 수정·리뷰 처리·머지·릴리즈는 제외
---

# /pr-create — 채택한 base로 PR 생성

먼저 [공통 프로젝트 계약](../ao-coordinate/project-contract.md)을 읽고 현재 요청의 범위·보존 대상·완료 기준에 연결한다.

스크립트 실행 전 [현재 스킬 경로 검증](../../runtime-path.md)을 각 도구 호출에서 적용한다.

**사용법**: `/pr-create`
현재 브랜치가 `feature/*`, `fix/*` 또는 `codex/*`인 상태에서 실행한다.

명시한 `--base` 또는 제품의 `.harness-policy.json` `branchFlow`를 사용한다.
일반 PR은 `git-flow`에서 작업→develop, `main`에서 작업→main이다. 둘이 충돌하면 push 전에 중단한다.
공식 stack을 명시 선택하고 등록했다면 아래 의존 PR 경로로 직접 parent를 검증한다.
선언과 명시 인자가 둘 다 없으면 대상을 먼저 정한다. 남아 있는 develop만으로 흐름을 추정하지 않는다.
`feature-merge`는 PR 생성을 이 래퍼에 위임한다.

---

## 중단 조건 (진입 전 즉시 판단)

| 상황 | 중단 사유 출력 |
|---|---|
| 현재 브랜치가 `feature/*`, `fix/*`, `codex/*` 중 어느 것도 아님 | "feature/*, fix/* 또는 codex/* 작업 브랜치에서만 실행할 수 있습니다. 현재 브랜치: [브랜치명]" |
| 미커밋 변경사항 존재 | "미커밋 변경사항이 있습니다 — 커밋 또는 stash 후 재실행하세요." |
| base 브랜치와 동일(브랜치가 곧 base) | "현재 브랜치가 base입니다 — feature/fix 브랜치에서 실행하세요." |

---

## 실행 절차

### 1. 최종 품질 검증 (직접 실행)

**repo의 `AGENTS.md` "빌드·테스트 명령" 섹션**의 품질 검증 명령(lint + test + build)을 실행한다.
(AGENTS.md가 없거나 prose-only repo면 해당 검증을 생략한다 — 예: team-harness는 `tests/*.sh` 게이트.)

실패 시 → **즉시 중단**. 품질 문제 해결 후 재실행.

### 2. PR 생성 — 래퍼 스크립트 실행 (직접 실행)

**의존 PR을 선택한 경우:** 공통 계약의 opt-in·실제 writer·층별 후보를 확인하고 `stack.sh submit`을 쓴다.
`--plan` JSON은 `schemaVersion:1`과 현재 순서의 모든 `layers`를 담는다. 각 항목은 `branch`, `title`,
해당 층의 고유 변경·검증·문서 선언을 담은 `bodyFile`이다. 하나의 본문을 모든 층에 복사하지 않는다.
요청한 범위가 현재 stack 전체와 다르면 범위를 확대하지 말고 등록 관계와 제출 대상을 먼저 맞춘다.

```bash
bash "${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/stack.sh" submit --plan /path/to/plan.json
# preview의 층·parent·본문·OID를 확인한 뒤, 승인된 원격 범위에서만 적용한다.
bash "${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/stack.sh" submit --plan /path/to/plan.json \
  --apply --expected <preview-fingerprint>
```

하단부터 기존 PR wrapper로 생성하며 상위 PR은 draft다. 같은 repo의 완전한 PR URL로 공식 link하고
각 head/base·구성·순서를 재조회한다. `confirmed`와 실제 URL이 있어야 생성 완료다.
부분 성공·실패는 journal과 실제 생성된 PR을 보존해 보고한다. 결과를 먼저 읽고 계획을 다시 미리 보며,
알 수 없는 원격 효과를 자동 재요청하거나 PR/ref를 삭제하지 않는다. 병합·자동 ready 전환은 수행하지 않는다.

**일반 PR인 경우:** 아래 기존 wrapper 경로를 유지한다.

> ⛔ 맨손 `gh pr create`는 guard가 차단한다(반사적 우회 방지). **반드시 아래 스크립트로** 생성한다.
> 스크립트가 선언·명시 대상과 실제 원격 branch를 확인한 뒤 push·PR 생성한다. 조회 오류·부재는 중단한다.

```bash
bash "${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/pr-create.sh" \
  --title "<타입(scope): 요약>" --body "<무엇을·왜·검증>"
# 선언이 없으면 --base <branch>를 명시한다. GitFlow hotfix/release 전달은 --base main 필수.
```

PR 번호를 출력한다.

### 3. 다음 단계 안내 (머지하지 않음)

`/pr-create`는 **PR 생성까지만** 한다 — 머지는 별도 게이트가 소유한다:
- linked stack은 설치된 adapter의 병합 지원과 최하단·현재 후보 계약을 먼저 확인한다. 미지원 후보에서
  아래 일반 단일 PR 머지 명령으로 우회하지 않는다. 상위 PR이나 전체 stack을 자동 병합하지 않는다.
- **리뷰 게이트**: `pr-review-gate` 1~3단계(AI 리뷰 대기·이슈 처리·스레드 reply+resolve).
- **머지**: 솔로 표준(승인요건 0) → CI·스레드 게이트 통과 후 `pr-merge.sh`로 직접 머지(우회할 승인요건이 없어 `/solo-merge` 불필요). 팀 모드 → `pr-review-gate`의 기존 사람 승인·CI·보호를 유지한다. 리뷰어 부재만으로 solo 전환하지 않는다.
- develop 기반 feature 흐름 전체(PR 생성→리뷰→머지→브랜치 정리)를 원하면 `/feature-merge`를 쓴다 — 그 스킬이 이 PR 생성을 포함한다.

완료 후 출력:
```
✅ PR 생성 완료
- 브랜치: [BRANCH] → [BASE]
- PR: #[번호]
- 다음: pr-review-gate(리뷰) → 솔로면 pr-merge.sh 직접 머지 / 팀이면 pr-review-gate 머지
```

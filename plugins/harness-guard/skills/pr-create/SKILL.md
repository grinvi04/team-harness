---
name: pr-create
description: 현재 feature/fix 브랜치를 올바른 base(develop 있으면 develop, 없으면 기본 브랜치=main)로 PR 생성 — 품질검증·push 후. 맨손 gh pr create 대체
effort: low
---

# /pr-create — base 자동감지 PR 생성 (단일 프리미티브)

**사용법**: `/pr-create`
현재 브랜치가 `feature/*` 또는 `fix/*`인 상태에서 실행한다.

> 푸는 문제: **PR 생성을 맨손 `gh pr create`로 하던 노출**. `feature-merge`는 `--base develop` 하드코딩이라
> develop 없는 main 기반 repo(team-harness 자체·develop 미사용 public repo)에서는 안 맞아 매번 맨손 gh로 샜다.
> 이 스킬이 **base를 동적 감지**(develop 있으면 develop, 없으면 origin 기본 브랜치)해 **모든 repo에서 PR 생성을 한 경로로** 만든다.
> `feature-merge`도 PR 생성 단계를 이 스킬에 위임한다 — PR 생성 로직의 단일 출처.

---

## 중단 조건 (진입 전 즉시 판단)

| 상황 | 중단 사유 출력 |
|---|---|
| 현재 브랜치가 `feature/*` 또는 `fix/*`가 아님 | "feature/* 또는 fix/* 브랜치에서만 실행할 수 있습니다. 현재 브랜치: [브랜치명]" |
| 미커밋 변경사항 존재 | "미커밋 변경사항이 있습니다 — 커밋 또는 stash 후 재실행하세요." |
| base 브랜치와 동일(브랜치가 곧 base) | "현재 브랜치가 base입니다 — feature/fix 브랜치에서 실행하세요." |

---

## 실행 절차

### 1. 최종 품질 검증 (직접 실행)

**repo의 `AGENTS.md` "빌드·테스트 명령" 섹션**의 품질 검증 명령(lint + test + build)을 실행한다.
(AGENTS.md가 없거나 prose-only repo면 해당 검증을 생략한다 — 예: team-harness는 `tests/*.sh` 게이트.)

실패 시 → **즉시 중단**. 품질 문제 해결 후 재실행.

### 2. PR 생성 — 래퍼 스크립트 실행 (직접 실행)

> ⛔ 맨손 `gh pr create`는 guard가 차단한다(반사적 우회 방지). **반드시 아래 스크립트로** 생성한다.
> 스크립트가 base 자동 감지(develop 있으면 develop, 없으면 기본 브랜치) · push · `gh pr create`를 수행한다(내부 gh는 자식 프로세스라 guard에 안 걸린다).

```bash
bash ${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}/scripts/pr-create.sh \
  --title "<타입(scope): 요약>" --body "<무엇을·왜·검증>"
# base를 강제해야 하면(hotfix/release 등) --base <branch> 추가.
```

PR 번호를 출력한다.

### 3. 다음 단계 안내 (머지하지 않음)

`/pr-create`는 **PR 생성까지만** 한다 — 머지는 별도 게이트가 소유한다:
- **리뷰 게이트**: `pr-review-gate` 1~3단계(AI 리뷰 대기·이슈 처리·스레드 reply+resolve).
- **머지**: 팀 repo → `pr-review-gate` 4~7단계 / 솔로 repo(보호 없음) → `solo-merge`.
- develop 기반 feature 흐름 전체(PR 생성→리뷰→머지→브랜치 정리)를 원하면 `/feature-merge`를 쓴다 — 그 스킬이 이 PR 생성을 포함한다.

완료 후 출력:
```
✅ PR 생성 완료
- 브랜치: [BRANCH] → [BASE]
- PR: #[번호]
- 다음: pr-review-gate(리뷰) → 솔로면 solo-merge / 팀이면 pr-review-gate 머지
```

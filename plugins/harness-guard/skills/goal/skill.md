---
name: goal
description: 제품·마일스톤 목표 추적 — 목표 정의→기능 분해→GitHub 마일스톤→진행률 대시보드. /plan·/feature-add 위에 놓이는 목표 관리 레이어
argument-hint: <slug> "<목표 설명>" [--by YYYY-MM-DD] | status | breakdown <slug>
effort: high
---

# /goal — 제품 목표 추적

**사용법 (3가지 모드)**

```
/goal <slug> "<목표 설명>" [--by YYYY-MM-DD]   # 목표 생성·갱신
/goal status                                    # 전체 목표 진행률 대시보드
/goal breakdown <slug>                          # 기존 목표의 기능 분해 갱신
```

예)
```
/goal hr-v1 "HR 모듈 완성 — 직원·부서·계약 이력" --by 2026-09-30
/goal status
/goal breakdown hr-v1
```

> **`/goal`의 위치**: `/plan`(기능 단위)·`/feature-add`(구현) 위에 놓이는 **목표 레이어**다.
> 하나의 Goal → 여러 `/plan` 스펙(기능) → 여러 `/feature-add` 태스크 → GitHub PRs.
> GitHub Milestone이 단일 출처 — PR에 마일스톤을 달면 자동으로 진행률이 집계된다.
>
> **스택 의존 값은 repo의 `AGENTS.md`에서 읽는다** — 모듈 구조, 디렉터리, 기능 목록.
> 하드코딩 금지.

---

## 모드 0 — 인수 파싱 (오케스트레이터 직접 실행)

`$ARGUMENTS`에서 모드를 판정한다:
- `$ARGUMENTS`가 비어 있거나 `status`로 시작하면 → **Status 모드** (Phase S로)
- `$ARGUMENTS`가 `breakdown <slug>`이면 → **Breakdown 모드** (Phase B로)
- 그 외(`<slug> "<설명>"`)이면 → **Create/Update 모드** (Phase C로)

```bash
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
```

현재 브랜치·미커밋 변경 유무는 확인하지 않는다 — `/goal`은 `docs/goals/`만 쓴다.

---

---
# 📋 PHASE C — 목표 생성·갱신
---

## Phase C0 — 컨텍스트 수집 (오케스트레이터 직접 실행)

```bash
# 기존 목표 목록
ls docs/goals/ 2>/dev/null || echo "(없음)"
# 기존 스펙 목록
ls docs/specs/ 2>/dev/null || echo "(없음)"
# GitHub 마일스톤 목록
gh api "repos/$OWNER_REPO/milestones" --jq '.[] | "\(.number) \(.title) (\(.state))"'
```

`$ARGUMENTS`에서 파싱:
- `SLUG` ← 첫 번째 단어
- `DESC` ← 따옴표 내 설명
- `DUE` ← `--by` 뒤 날짜 (없으면 미설정)

이미 `docs/goals/$SLUG.md`가 존재하면 갱신 모드 — 기존 내용을 읽어 유지할 섹션을 파악한다.

---

## Phase C1 — 기능 분해 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

**프롬프트:**
- AGENTS.md를 읽어 프로젝트 구조·모듈·스택을 파악한다.
- `docs/specs/*.md`를 읽어 **이미 계획됐거나 완료된 기능**을 파악한다.
- 목표: `$DESC` / 마감: `$DUE` (없으면 미설정)
- 이 목표를 달성하기 위한 **기능(Feature) 목록**을 도출한다:
  - 각 기능은 독립적으로 `/plan`·`/feature-add` 가능한 단위
  - 기존 spec이 이미 존재하면 `[존재] docs/specs/<name>.md` 링크
  - 없으면 `[필요] /plan <suggested-slug> "<설명>"`로 표시
  - 규모 추정: S(½일 미만) / M(½~2일) / L(2일 초과)
  - 의존 관계 명시 (어떤 기능이 먼저 필요한지)
- `[NEEDS CLARIFICATION: ...]`으로 불명확한 범위를 표면화한다
- 아래 형식으로 반환한다:

```markdown
## 기능 목록 (초안)

| # | 기능 slug | 설명 | 규모 | Spec | 의존 |
|---|---|---|---|---|---|
| 1 | employee-crud | 직원 등록·수정·삭제 | M | [필요] /plan employee-crud "..." | — |
| 2 | dept-manage | 부서 관리 | S | [존재] docs/specs/dept.md | — |
| 3 | contract-history | 계약 이력 조회 | M | [필요] /plan contract-history "..." | #1 |

## Open Questions
- [NEEDS CLARIFICATION: 계약 유형(정규직/계약직)을 구분하는가?]
```

---

## Phase C2 — 목표 문서 작성 + GitHub 마일스톤 생성 (오케스트레이터 직접 실행)

### 2-1. `docs/goals/$SLUG.md` 작성

```bash
mkdir -p docs/goals
```

아래 템플릿으로 작성한다 (Phase C1 결과를 채운다):

```markdown
# <SLUG> 목표

> **상태**: 진행 중 | **마감**: <DUE 또는 미설정> | **마일스톤**: [GitHub #N](<링크>)

## 1. 목표 & Why

<DESC — 무엇을·왜, 측정 가능한 성공 기준 한 줄>

## 2. 범위

- **In:** <포함 기능 요약>
- **Out (Non-goals):** <명시적 비범위>

## 3. 기능 목록

| # | 기능 | 설명 | 규모 | Spec | PR | 상태 | 의존 |
|---|---|---|---|---|---|---|---|
| 1 | <slug> | <설명> | M | [계획]/[존재] | — | 🔲 | — |

> 상태 범례: 🔲 미시작 · 🔄 진행 중 · ✅ 완료

## 4. 진행률

<!-- /goal status가 자동 계산 — 수동 수정 금지 -->
**0 / N 기능 완료 (0%)**

GitHub Milestone: 오픈 N · 완료 0

## 5. 다음 단계

1. Open Question 해소 후 `/plan <slug> "<설명>"` 순서대로 실행
2. PR 생성 시 GitHub Milestone `<SLUG>` 연결

## 6. Open Questions

<Phase C1의 [NEEDS CLARIFICATION] 목록 그대로>
```

### 2-2. GitHub Milestone 생성·갱신

```bash
# 이미 존재하는 마일스톤 번호 확인
M_NUM=$(gh api "repos/$OWNER_REPO/milestones" \
  --jq ".[] | select(.title==\"$SLUG\") | .number")

if [ -z "$M_NUM" ]; then
  # 새로 생성
  DUE_ISO="${DUE}T23:59:59Z"   # DUE가 없으면 이 줄 생략
  gh api "repos/$OWNER_REPO/milestones" \
    -f title="$SLUG" \
    -f description="$DESC" \
    ${DUE:+-f due_on="${DUE}T23:59:59Z"} \
    --jq '"마일스톤 생성: #\(.number) \(.html_url)"'
else
  # 설명·마감 갱신
  gh api "repos/$OWNER_REPO/milestones/$M_NUM" \
    -X PATCH \
    -f description="$DESC" \
    ${DUE:+-f due_on="${DUE}T23:59:59Z"} \
    --jq '"마일스톤 갱신: #\(.number)"'
fi
```

마일스톤 URL을 `docs/goals/$SLUG.md`의 헤더에 반영한다.

---

## Phase C3 — 사람 승인 게이트 (오케스트레이터 직접 실행, 필수)

`[NEEDS CLARIFICATION]` 항목이 남아 있으면 **사용자에게 질문**하고 답을 목표 문서에 반영한다. 추측으로 채우지 않는다.

기능 목록·범위·마감을 요약 제시하고 **사람 승인을 받는다.**

> 잘못된 목표 방향으로 팀이 일하는 것을 막는 가장 싼 지점. 승인 없이는 커밋하지 않는다.

---

## Phase C4 — 커밋 (오케스트레이터 직접 실행)

승인 후에만 실행:

```bash
git add docs/goals/"$SLUG".md
git commit -m "docs(goal): $SLUG 목표 정의 — $DESC

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

완료 출력:
```
✅ 목표 생성 완료
- 문서: docs/goals/<slug>.md
- GitHub 마일스톤: #N (<URL>)
- 기능 수: N개 (S:N / M:N / L:N)
- Open Questions: N개 (해소 전 /plan 진행 보류)

다음 단계:
  Open Questions 해소 → /plan <slug> "<설명>" 순서대로 실행
  PR 생성 시 마일스톤 '<SLUG>'(#N) 연결
```

---

---
# 📊 PHASE S — Status 대시보드
---

## Phase S0 — 데이터 수집 (오케스트레이터 직접 실행)

```bash
# 로컬 목표 파일 목록
ls docs/goals/*.md 2>/dev/null || { echo "docs/goals/ 없음 — 목표가 정의되지 않았습니다."; exit 0; }

# GitHub 마일스톤 전체 (open + closed)
gh api "repos/$OWNER_REPO/milestones?state=all&per_page=100" \
  --jq '.[] | {number: .number, title: .title, open: .open_issues, closed: .closed_issues, due: .due_on, state: .state}'
```

---

## Phase S1 — 진행률 집계 (`subagent_type: general-purpose`, `model: haiku`, **foreground**)

**프롬프트:**
- `docs/goals/*.md`를 모두 읽는다.
- GitHub 마일스톤 데이터(Phase S0 결과)를 받는다.
- 각 목표의 마일스톤 번호를 목표 문서에서 파싱한다.
- 기능 목록 표(§3)에서 전체 기능 수를 파악한다.
- GitHub Milestone의 `closed_issues`를 완료 PR 수로 사용한다.
- 각 목표 문서의 `## 4. 진행률` 섹션을 갱신한다:
  ```
  **<closed> / <total-features> 기능 완료 (<pct>%)**
  GitHub Milestone: 오픈 <open> · 완료 <closed>
  ```
- 파일을 저장하고 아래 형식으로 대시보드를 출력한다.

**대시보드 형식:**

```
## 🎯 목표 진행률 대시보드 — YYYY-MM-DD

| 목표 | 설명 | 기능 | 완료 | 진행률 | 마감 | 상태 |
|---|---|---|---|---|---|---|
| hr-v1 | HR 모듈 완성 | 8 | 3 | ██░░░ 38% | 2026-09-30 | 🔄 |
| finance-v1 | 재무 모듈 | 6 | 0 | ░░░░░ 0% | 미설정 | 🔲 |

범례: 🔲 미시작 · 🔄 진행 중 · ✅ 완료 · ⚠️ 마감 초과

### 기능 단위 상세 (진행 중 목표만)

**hr-v1**
- ✅ employee-crud (#12 merged)
- ✅ dept-manage (#15 merged)
- ✅ role-assign (#18 merged)
- 🔄 contract-history (PR #21 open)
- 🔲 leave-request (미시작)
...
```

---

## Phase S2 — 커밋 (오케스트레이터 직접 실행)

진행률 섹션을 갱신한 파일이 있으면:

```bash
git add docs/goals/*.md
git commit -m "docs(goal): 진행률 갱신 — $(date +%Y-%m-%d)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

---
# 🔩 PHASE B — 기능 분해 갱신
---

## Phase B0 — 기존 목표 검증 (오케스트레이터 직접 실행)

```bash
SLUG=$(echo "$ARGUMENTS" | awk '{print $2}')
[ -f "docs/goals/$SLUG.md" ] || { echo "❌ docs/goals/$SLUG.md 없음 — /goal $SLUG \"<설명>\"로 먼저 생성하세요."; exit 1; }
cat "docs/goals/$SLUG.md"
```

---

## Phase B1 — 재분해 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

**프롬프트:**
- 기존 목표 문서(Phase B0 결과)를 읽는다.
- AGENTS.md를 읽어 현재 프로젝트 구조를 파악한다.
- `docs/specs/*.md`를 읽어 이미 완료·진행 중인 스펙을 파악한다.
- 현재 GitHub PR 목록을 조회해 진행 중인 기능을 반영한다:
  ```bash
  gh pr list --json title,milestone,state --jq '.[] | select(.milestone.title=="<SLUG>")'
  ```
- **기능 목록을 재검토**: 완료 항목 ✅ 표시, 신규 필요 항목 추가, 더 이상 불필요한 항목은 취소선(`~~`) 처리(삭제 금지 — 이력 보존)
- 규모 추정 재평가 (실제 구현 경험 반영)
- 업데이트된 기능 목록 반환

**목표 문서의 §3 기능 목록과 §5 다음 단계를 갱신한다.**

---

## Phase B2 — 커밋 (오케스트레이터 직접 실행)

```bash
git add "docs/goals/$SLUG.md"
git commit -m "docs(goal): $SLUG 기능 분해 갱신

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

완료 출력:
```
✅ 기능 분해 갱신 완료
- 전체: N개 / 완료: N개 / 진행 중: N개 / 미시작: N개
- 신규 추가: N개 / 제거(취소선): N개
```

---

## 팀 운영 가이드

### PR → 마일스톤 연결

PR 생성 시 마일스톤을 지정한다 — GitHub이 자동으로 `closed_issues`를 올린다:
```bash
# PR 생성은 pr-create 래퍼 경유(맨손 gh pr create는 guard 차단) — 마일스톤은 --milestone로 전달
bash ${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}/scripts/pr-create.sh --milestone "<slug>" --title "..." --body "..."
# 또는 기존 PR에 추가
gh pr edit <PR번호> --milestone "<slug>"
```

### 목표 파일 구조

```
docs/
└── goals/
    ├── hr-v1.md          ← /goal hr-v1 "..." 생성
    ├── finance-v1.md
    └── ...
```

### 목표 완료 기준

- GitHub Milestone이 `closed` 상태 **AND**
- `docs/goals/<slug>.md`의 모든 기능이 ✅ **AND**
- 관련 `/release`가 완료됨

위 조건이 충족되면 `/goal status` 실행 시 해당 목표에 ✅ 표시된다.

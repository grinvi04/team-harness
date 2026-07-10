---
name: milestone
description: 제품·마일스톤 목표 추적 — 목표 정의→기능 분해→GitHub 마일스톤→진행률 대시보드. /plan·/feature-add 위에 놓이는 목표 관리 레이어. Claude Code 내장 /goal(세션 stopping condition)과 별개
argument-hint: <slug> "<목표 설명>" [--by YYYY-MM-DD] | status | breakdown <slug>
effort: high
---

# /milestone — 제품 마일스톤 추적

## Codex 실행

GitHub milestone·repo 스펙·이슈가 정본이라는 계약은 Codex에서도 같다. Codex의 `/goal`은 현재 작업의
지속 목표로 함께 쓸 수 있지만 milestone을 대체하지 않는다. 기능 분해·진행률 집계·재분해는 현재 agent가
수행하고, 근거 수집만 `harness-explorer` (`gpt-5.6-terra`, medium)에 위임한다.

**사용법 (3가지 모드)**

```
/milestone <slug> "<목표 설명>" [--by YYYY-MM-DD]   # 마일스톤 생성·갱신
/milestone status                                    # 전체 마일스톤 진행률 대시보드
/milestone breakdown <slug>                          # 기존 마일스톤의 기능 분해 갱신
```

예)
```
/milestone hr-v1 "HR 모듈 완성 — 직원·부서·계약 이력" --by 2026-09-30
/milestone status
/milestone breakdown hr-v1
```

> **위치**: `/plan`(기능 단위)·`/feature-add`(구현) 위에 놓이는 **목표 레이어**다.
> 하나의 Milestone → 여러 `/plan` 스펙(기능) → 여러 `/feature-add` 태스크 → GitHub PRs.
> GitHub Milestone이 단일 출처 — PR에 마일스톤을 달면 자동으로 진행률이 집계된다.
>
> **도구 내장 `/goal`과의 구분**: Codex와 Claude Code의 `/goal`은 현재 세션에서 멈추기 전
> 체크할 stopping condition을 설정하는 도구다. `/milestone`은 제품 로드맵 추적 도구로
> 완전히 다른 목적이다. 두 기능은 보완 관계이며 함께 쓴다.
>
> **스택 의존 값은 repo의 `AGENTS.md`에서 읽는다** — 모듈 구조, 디렉터리, 기능 목록.

---

## 모드 0 — 인수 파싱 (오케스트레이터 직접 실행)

`$ARGUMENTS`에서 모드를 판정한다:
- `$ARGUMENTS`가 비어 있거나 `status`로 시작하면 → **Status 모드** (Phase S로)
- `$ARGUMENTS`가 `breakdown <slug>`이면 → **Breakdown 모드** (Phase B로)
- 그 외(`<slug> "<설명>"`)이면 → **Create/Update 모드** (Phase C로)

```bash
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
```

---

---
# 📋 PHASE C — 마일스톤 생성·갱신
---

## Phase C0 — 컨텍스트 수집 (오케스트레이터 직접 실행)

```bash
# 기존 마일스톤 목록
ls docs/milestones/ 2>/dev/null || echo "(없음)"
# 기존 스펙 목록
ls docs/specs/ 2>/dev/null || echo "(없음)"
# GitHub 마일스톤 목록
gh api "repos/$OWNER_REPO/milestones" --jq '.[] | "\(.number) \(.title) (\(.state))"'
```

`$ARGUMENTS`에서 파싱:
- `SLUG` ← 첫 번째 단어
- `DESC` ← 따옴표 내 설명
- `DUE` ← `--by` 뒤 날짜 (없으면 미설정)

이미 `docs/milestones/$SLUG.md`가 존재하면 갱신 모드 — 기존 내용을 읽어 유지할 섹션을 파악한다.

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

## Phase C2 — 마일스톤 문서 작성 + GitHub 마일스톤 생성 (오케스트레이터 직접 실행)

### 2-1. `docs/milestones/$SLUG.md` 작성

```bash
mkdir -p docs/milestones
```

아래 템플릿으로 작성한다 (Phase C1 결과를 채운다):

```markdown
# <SLUG> 마일스톤

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

<!-- /milestone status가 자동 계산 — 수동 수정 금지 -->
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
M_NUM=$(gh api "repos/$OWNER_REPO/milestones?state=all" \
  --jq ".[] | select(.title==\"$SLUG\") | .number")   # state=all — 동명 closed 마일스톤도 조회(K5: 미조회 시 create가 422)

if [ -z "$M_NUM" ]; then
  gh api "repos/$OWNER_REPO/milestones" \
    -f title="$SLUG" \
    -f description="$DESC" \
    ${DUE:+-f due_on="${DUE}T23:59:59Z"} \
    --jq '"마일스톤 생성: #\(.number) \(.html_url)"'
else
  gh api "repos/$OWNER_REPO/milestones/$M_NUM" \
    -X PATCH \
    -f description="$DESC" \
    ${DUE:+-f due_on="${DUE}T23:59:59Z"} \
    --jq '"마일스톤 갱신: #\(.number)"'
fi
```

마일스톤 URL을 `docs/milestones/$SLUG.md`의 헤더에 반영한다.

---

## Phase C3 — 사람 승인 게이트 (오케스트레이터 직접 실행, 필수)

`[NEEDS CLARIFICATION]` 항목이 남아 있으면 **사용자에게 질문**하고 답을 문서에 반영한다. 추측으로 채우지 않는다.

기능 목록·범위·마감을 요약 제시하고 **사람 승인을 받는다.**

---

## Phase C4 — 로컬 대시보드 (커밋하지 않음)

> **정본은 GitHub Milestone**(Phase C2에서 생성/갱신)이다 — `docs/milestones/$SLUG.md`는 **로컬 대시보드**일 뿐이라 커밋하지 않는다(K3·decisions #63: 프로젝트 상태는 GitHub에 누적, 로컬 doc 중복 금지). `.gitignore`에 `docs/milestones/`를 두어 로컬 전용으로 유지한다(develop/main 직접 커밋은 guard가 차단하기도 함). 진행률·목록의 단일 출처는 GitHub Milestone·Issue.

완료 출력:
```
✅ 마일스톤 생성 완료
- 문서: docs/milestones/<slug>.md
- GitHub 마일스톤: #N (<URL>)
- 기능 수: N개 (S:N / M:N / L:N)
- Open Questions: N개 (해소 전 /plan 진행 보류)

다음 단계:
  /goal "<작업 설명>" 으로 세션 목표 설정 (선택, Claude stopping condition)
  Open Questions 해소 → /plan <slug> "<설명>" 순서대로 실행
  PR 생성 시 마일스톤 '<SLUG>'(#N) 연결
```

---

---
# 📊 PHASE S — Status 대시보드
---

## Phase S0 — 데이터 수집 (오케스트레이터 직접 실행)

```bash
ls docs/milestones/*.md 2>/dev/null || { echo "docs/milestones/ 없음 — /milestone <slug> \"<설명>\"로 먼저 생성하세요."; exit 0; }

gh api "repos/$OWNER_REPO/milestones?state=all&per_page=100" \
  --jq '.[] | {number: .number, title: .title, open: .open_issues, closed: .closed_issues, due: .due_on, state: .state}'
```

---

## Phase S1 — 진행률 집계 (`subagent_type: general-purpose`, `model: haiku`, **foreground**)

**프롬프트:**
- `docs/milestones/*.md`를 모두 읽는다.
- GitHub 마일스톤 데이터(Phase S0 결과)를 받는다.
- 각 마일스톤 문서에서 GitHub Milestone 번호를 파싱한다.
- 기능 목록 표(§3)에서 전체 기능 수를 파악한다.
- GitHub Milestone의 `closed_issues`를 완료 PR 수로 사용한다.
- 각 문서의 `## 4. 진행률` 섹션을 갱신한다.
- 아래 형식으로 대시보드를 출력한다:

```
## 📊 마일스톤 진행률 대시보드 — YYYY-MM-DD

| 마일스톤 | 설명 | 기능 | 완료 | 진행률 | 마감 | 상태 |
|---|---|---|---|---|---|---|
| hr-v1 | HR 모듈 완성 | 8 | 3 | ██░░░ 38% | 2026-09-30 | 🔄 |
| finance-v1 | 재무 모듈 | 6 | 0 | ░░░░░ 0% | 미설정 | 🔲 |

범례: 🔲 미시작 · 🔄 진행 중 · ✅ 완료 · ⚠️ 마감 초과
```

---

## Phase S2 — 로컬 대시보드 (커밋하지 않음)

> 진행률의 정본은 **GitHub Milestone**(open/closed issue 카운트)다 — `docs/milestones/*.md`는 로컬 대시보드라 커밋하지 않는다(K3, gitignore).

---

---
# 🔩 PHASE B — 기능 분해 갱신
---

## Phase B0 — 기존 마일스톤 검증 (오케스트레이터 직접 실행)

```bash
SLUG=$(echo "$ARGUMENTS" | awk '{print $2}')
[ -f "docs/milestones/$SLUG.md" ] || { echo "❌ docs/milestones/$SLUG.md 없음 — /milestone $SLUG \"<설명>\"로 먼저 생성하세요."; exit 1; }
cat "docs/milestones/$SLUG.md"
```

---

## Phase B1 — 재분해 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

**프롬프트:**
- 기존 마일스톤 문서(Phase B0 결과)를 읽는다.
- AGENTS.md를 읽어 현재 프로젝트 구조를 파악한다.
- `docs/specs/*.md`를 읽어 이미 완료·진행 중인 스펙을 파악한다.
- 현재 GitHub PR 목록을 조회해 진행 중인 기능을 반영한다:
  ```bash
  gh pr list --json title,milestone,state --jq '.[] | select(.milestone.title=="<SLUG>")'
  ```
- **기능 목록을 재검토**: 완료 항목 ✅ 표시, 신규 필요 항목 추가, 더 이상 불필요한 항목은 취소선(`~~`) 처리(삭제 금지 — 이력 보존)
- 업데이트된 기능 목록 반환

**마일스톤 문서의 §3 기능 목록과 §5 다음 단계를 갱신한다.**

---

## Phase B2 — 로컬 대시보드 (커밋하지 않음)

> 분해 결과의 정본은 **GitHub Milestone + Issue/PR**다 — `docs/milestones/$SLUG.md`는 로컬 대시보드라 커밋하지 않는다(K3, gitignore).

---

## 팀 운영 가이드

### PR → 마일스톤 연결

```bash
# PR 생성은 pr-create 래퍼 경유(맨손 gh pr create는 guard 차단) — 마일스톤은 --milestone로 전달
bash ${CODEX_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}}/scripts/pr-create.sh --milestone "<slug>" --title "..." --body "..."
gh pr edit <PR번호> --milestone "<slug>"
```

### 도구 내장 `/goal`과 함께 쓰는 패턴

```
# 1. 제품 마일스톤 정의 (지속적 추적)
/milestone hr-v1 "HR 모듈 완성" --by 2026-09-30

# 2. 작업 세션 시작 시 stopping condition 설정 (세션 안전장치)
/goal "hr-v1 마일스톤의 employee-crud 기능 완성"

# 3. 기능 개발
/plan employee-crud "직원 등록·수정·삭제"
/feature-add employee-crud "..."
```

### 마일스톤 완료 기준

- GitHub Milestone이 `closed` 상태 **AND**
- `docs/milestones/<slug>.md`의 모든 기능이 ✅ **AND**
- 관련 `/release`가 완료됨

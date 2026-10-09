# 생성·갱신 실행 절차

이 절차는 SKILL.md의 공통 완료 판정 계약과 함께 따른다.

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

> 상태 범례: 🔲 미시작 · 🔄 진행 중 · ✅ AC 검증 완료 · ⚠️ 미확인 · 취소/중복(별도)

## 4. 진행률

<!-- /milestone status가 자동 계산 — 수동 수정 금지 -->
**0 / N 기능 완료 (0%)**

GitHub Milestone 행정 상태: 오픈 N · 닫힘 0 (AC 완료 수와 별도)

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

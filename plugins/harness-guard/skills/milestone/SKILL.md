---
name: milestone
description: 여러 기능을 묶는 제품 목표와 마일스톤을 정의·추적할 때 사용. GitHub 진행률을 관리하며 단일 기능 계획·코드 구현·세션 종료조건 설정은 제외
argument-hint: <slug> "<목표 설명>" [--by YYYY-MM-DD] | status | breakdown <slug>
---

# /milestone — 제품 마일스톤 추적

스크립트 실행 전 [현재 스킬 경로 검증](../../runtime-path.md)을 각 도구 호출에서 적용한다.

**사용법 (3가지 모드)**

```
/milestone <slug> "<목표 설명>" [--by YYYY-MM-DD]   # 마일스톤 생성·갱신
/milestone status                                    # 전체 마일스톤 진행률 대시보드
/milestone breakdown <slug>                          # 기존 마일스톤의 기능 분해 갱신
```

예)
```
/milestone first-release "첫 출시 목표" --by 2026-09-30
/milestone status
/milestone breakdown first-release
```

> **위치**: `/plan`(기능 단위)·`/feature-add`(구현) 위에 놓이는 **목표 레이어**다.
> 하나의 Milestone → 여러 `/plan` 스펙(기능) → 여러 `/feature-add` 태스크 → GitHub PRs.
> GitHub Milestone·Issue/PR가 상태 정본이다. 자동 open/closed 집계와 AC 검증 완료 수는 별도로 보여준다.
>
일반 목표 분해는 선택한 계획 방법론을 재사용하며 GitHub의 Milestone·Issue 기능으로 관리한다.
별도 계획·승인 루프를 시작하지 않는다. 세션 중단 조건은 현재 플랫폼에 맡긴다.

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

## Create/Update 실행 연결

생성·갱신 모드는 [생성·갱신 실행 절차](create-update.md)를 **먼저 읽고 Phase C0–C4를 순서대로 따른다**.
참조 파일은 자동 로딩을 가정하지 않는다. 기존 기능 분해·문서 템플릿·GitHub 생성/갱신·출력 계약은 그곳에 있다.
Phase C3의 사람 승인과 Open Questions 해소는 필수다. status나 breakdown 호출로 생성·갱신 권한을 확대하지 않는다.

## 완료 판정 계약 — 모든 모드 공통

- 원래 수용 기준(AC)과 현재 후보의 증거를 기능별로 대조한다. GitHub 상태나 체크 표시만으로 완료를 추정하지 않는다.
- 후보 SHA·시험 명령·결과·수용 기준 연결을 기존 spec·Issue·PR에서 확인한다. 오래된 PASS는 바뀐 후보로 옮기지 않는다.
- 필수 FAIL/UNVERIFIED가 있으면 완료로 판정하지 않는다. 조회 실패·증거 누락·후보 불일치는 UNVERIFIED로 남긴다.
- `closed_issues`는 행정 카운트이며 완료 기능 수가 아니다. 닫힌 PR·Issue도 AC와 현재 증거를 따로 확인한다.
- 취소·중복은 완료로 계산하지 않는다. 원래 목표 분모에서 조용히 빼지 않고 별도로 표시한다.
  승인된 범위 변경이 있으면 그 결정과 원래 AC를 보존하고 새 기준으로 집계한다.
- 구현·검증·병합·릴리즈·배포 상태를 구분한다. 선언·파일 존재 검사는 의미·누락 검토를 대신하지 않는다.

---

# 📊 PHASE S — Status 대시보드
---

## Phase S0 — 데이터 수집 (오케스트레이터 직접 실행)

```bash
ls docs/milestones/*.md 2>/dev/null || { echo "docs/milestones/ 없음 — /milestone <slug> \"<설명>\"로 먼저 생성하세요."; exit 0; }

gh api --paginate "repos/$OWNER_REPO/milestones?state=all&per_page=100" \
  --jq '.[] | {number: .number, title: .title, open: .open_issues, closed: .closed_issues, due: .due_on, state: .state}'
```

---

조회 실패·불완전한 응답은 UNVERIFIED다. 빈 목록·0%·완료로 채우지 않고 확인하지 못한 대상과 재조회 조건을 남긴다.

## Phase S1 — 진행률 집계 (`subagent_type: general-purpose`, `model: haiku`, **foreground**)

현재 담당자가 기존 계획 결과를 재사용한다. 필요한 위임은 플랫폼·제품 권한 안에서만 한다.

**확인할 내용:**
- `docs/milestones/*.md`를 모두 읽는다.
- GitHub 마일스톤 데이터(Phase S0 결과)를 받는다.
- 각 마일스톤 문서에서 GitHub Milestone 번호를 파싱한다.
- 기능 목록 표(§3)에서 전체 기능 수를 파악한다.
- 각 기능의 원래 AC와 현재 후보 증거가 모두 확인된 항목만 완료 수에 넣는다.
- 기능 완료·미확인·진행 중·취소/중복 수와 GitHub open/closed 행정 카운트를 따로 표시한다.
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

> 진행률의 정본은 **GitHub Milestone·Issue/PR에 연결한 AC와 후보 검증 근거**다 — `docs/milestones/*.md`는 로컬 대시보드라 커밋하지 않는다(K3, gitignore).

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

## Phase B1 — 재분해

현재 담당자가 기존 계획 결과를 재사용한다. 필요한 위임은 플랫폼·제품 권한 안에서만 한다.

**확인할 내용:**
- 기존 마일스톤 문서(Phase B0 결과)를 읽는다.
- AGENTS.md를 읽어 현재 프로젝트 구조를 파악한다.
- `docs/specs/*.md`를 읽어 이미 완료·진행 중인 스펙을 파악한다.
- 현재 GitHub PR 목록을 조회해 진행 중인 기능을 반영한다:
  ```bash
  gh pr list --json title,milestone,state --jq '.[] | select(.milestone.title=="<SLUG>")'
  ```
- **기능 목록을 재검토**: 공통 완료 판정 계약을 충족한 항목만 ✅ 표시한다. 신규 필요 항목을 추가하고
  취소·중복은 이유와 연결 대상을 보존해 별도 표시한다(삭제 금지 — 이력 보존).
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
bash "${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/pr-create.sh" --milestone "<slug>" --title "..." --body "..."
gh pr edit <PR번호> --milestone "<slug>"
```

### 마일스톤 완료 기준

- 원래 AC와 현재 후보 검증 근거로 모든 필수 기능의 완료를 확인한다.
- GitHub Milestone `closed`와 로컬 ✅는 그 확인 결과를 반영하는 행정 표시다. 필수 미확인은 완료를 막는다.
- 관련 `/release` 완료는 해당 릴리즈 증거로 따로 확인한다. 제품 완료나 배포 완료와 자동 등치하지 않는다.

---
name: hotfix
description: 운영 긴급 수정 — main 기준 hotfix 브랜치→PR→태그→develop back-merge PR
argument-hint: <fix-name> "<증상 설명>"
---

# /hotfix — 운영 긴급 수정

**사용법**: `/hotfix <fix-name> "<증상 설명>"`
예) `/hotfix auth-cookie "로그인 후 쿠키가 발급되지 않는 문제"`

> 운영(main)에서 직접 분기. 반드시 main과 develop 양쪽에 머지한다.
> develop 머지 누락 시 코드 분기 발생 — 가장 흔한 hotfix 실수.
> 빌드·테스트 명령은 **repo의 AGENTS.md "빌드·테스트 명령" 섹션**에서 읽는다.

---

## Phase 0 — 진입 전 점검 (오케스트레이터 직접 실행)

```bash
git checkout main && git pull origin main
git checkout -b hotfix/$FIX_NAME
```

---

## Phase 1 — 버그 재현 + 회귀 테스트 작성 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

> 버그를 먼저 테스트로 증명한다. 테스트가 통과하면 버그가 사라진 것이다.

**⚠️ 중요**: 테스트 저장 시 검증 hook이 `❌ 테스트 실패`를 출력할 수 있다. 이것은 **의도된 RED 상태**이므로 수정하지 않는다.

**프롬프트:**
- 증상: $ARGUMENTS
- 영향받는 서비스·파일 파악
- 버그를 재현하는 **회귀 테스트 1개** 작성
  - 테스트 이름: `'[hotfix] <증상 한 줄 설명>'`
  - AGENTS.md의 테스트 명령으로 버그가 있는 현재 상태에서 FAIL 확인
- RED 확인 완료 후 리포트

---

## Phase 2 — 수정 (`subagent_type: general-purpose`, `model: sonnet`, `run_in_background: true`)

**프롬프트:**
- 증상 + Phase 1 회귀 테스트: [Phase 1 결과 붙여넣기]
- **외과적 수정**: 증상과 직접 관련된 코드만 수정
- **수정 → 테스트 루프 (최대 3회)**: AGENTS.md의 테스트 명령 사용
  - 회귀 테스트 PASS + 기존 테스트 전부 PASS 확인
  - 3회 실패 시: 에러 리포트 후 **즉시 중단**
- **전체 회귀 검사**: AGENTS.md의 품질 검증 명령 (lint + test + build)

완료 후 수정 파일 목록·전체 테스트 결과 리포트.

---

## Phase 3 — main PR 머지 + 태그 (오케스트레이터 직접 실행)

Phase 2 ✅인 경우에만 진행.

```bash
# 1. hotfix 브랜치 push + main으로 PR 생성
git push origin hotfix/$FIX_NAME
gh pr create --base main --head hotfix/$FIX_NAME \
  --title "fix($FIX_NAME): $DESCRIPTION" \
  --body "긴급 수정: $DESCRIPTION

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**`pr-review-gate` 스킬의 전체 절차(1~7단계)**를 따른다 — AI 리뷰 처리·사람 승인·CI·
commit-status·머지. 절차 본문은 그 스킬이 단일 출처, 여기에 복붙하지 않는다.

```bash
# 2. 패치 버전 태그 (main 최신화 후 — 최신 태그 patch+1)
git checkout main && git pull origin main
CURRENT=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
PATCH=$(echo "$CURRENT" | awk -F. '{print $1"."$2"."$3+1}' | tr -d 'v')
git tag "v$PATCH"
git push origin --tags
echo "✅ 태그: v$PATCH"
# 버전 매니페스트(package.json·build.gradle 등)를 쓰는 프로젝트: main 직접 커밋이 차단되므로
# 여기서가 아니라 PR 머지 전 hotfix 브랜치에서 미리 갱신한다 (release 브랜치 범프와 동일 패턴)
```

---

## Phase 4 — develop back-merge PR ← 반드시 실행 (오케스트레이터 직접 실행)

develop도 branch protection이 걸려 있어 직접 push가 거부된다 — **back-merge도 PR로**.

```bash
gh pr create --base develop --head hotfix/$FIX_NAME \
  --title "chore: hotfix/$FIX_NAME develop 반영" \
  --body "main PR과 동일 내용의 back-merge — main 머지·태그(v$PATCH) 완료 후 develop 반영.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**`pr-review-gate` 부록(back-merge 간소 게이트)** 적용: 사람 승인 + CI + 머지만.
충돌 시 hotfix 브랜치에 develop을 merge해 해소 후 재푸시.

```bash
# 머지 완료 후 브랜치 정리
git branch -d hotfix/$FIX_NAME
git push origin --delete hotfix/$FIX_NAME 2>/dev/null || true
```

> ⚠️ develop 반영을 건너뛰면 다음 릴리즈 때 수정이 사라진다.

완료 후 "✅ hotfix 완료 — main 태그: v$PATCH, develop back-merge PR 머지 완료" 출력.

---
description: 운영 긴급 수정 — main 기준 hotfix 브랜치→PR→태그→develop 반영
argument-hint: <fix-name> "<증상 설명>"
---

# /hotfix — 운영 긴급 수정

**사용법**: `/hotfix <fix-name> "<증상 설명>"`
예) `/hotfix auth-cookie "로그인 후 쿠키가 발급되지 않는 문제"`

> 운영(main)에서 직접 분기. 반드시 main과 develop 양쪽에 머지한다.
> develop 머지 누락 시 코드 분기 발생 — 가장 흔한 hotfix 실수.

---

## Phase 0 — 진입 전 점검 (오케스트레이터 직접 실행)

```bash
git checkout main && git pull origin main
git checkout -b hotfix/$FIX_NAME
```

---

## Phase 1 — 버그 재현 + 회귀 테스트 작성 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

> 버그를 먼저 테스트로 증명한다. 테스트가 통과하면 버그가 사라진 것이다.

**⚠️ 중요**: spec 저장 시 PostToolUse hook이 `❌ 테스트 실패`를 출력한다. 이것은 **의도된 RED 상태**이므로 수정하지 않는다.

**프롬프트:**
- 증상: $ARGUMENTS
- 영향받는 서비스·파일 파악
- 버그를 재현하는 **회귀 테스트 1개** 작성
  - 테스트 이름: `'[hotfix] <증상 한 줄 설명>'`
  - 버그가 있는 현재 상태에서 FAIL 확인:
    ```bash
    # <TEST_CMD> <spec파일>
    ```
- RED 확인 완료 후 리포트

---

## Phase 2 — 수정 (`subagent_type: general-purpose`, `model: sonnet`, `run_in_background: true`)

**프롬프트:**
- 증상 + Phase 1 회귀 테스트: [Phase 1 결과 붙여넣기]
- **외과적 수정**: 증상과 직접 관련된 코드만 수정

- **수정 → 테스트 루프 (최대 3회)**:
  ```bash
  # <TEST_CMD> <spec파일>
  ```
  - 회귀 테스트 PASS + 기존 테스트 전부 PASS 확인
  - 3회 실패 시: 에러 리포트 후 **즉시 중단**

- **전체 회귀 검사**:
  ```bash
  # <QUALITY_CHECK_CMD>  (lint + test + build)
  ```

완료 후 수정 파일 목록·전체 테스트 결과 리포트.

---

## Phase 3 — PR 머지 + 양방향 반영 (오케스트레이터 직접 실행)

Phase 2 ✅인 경우에만 진행.

```bash
# 1. hotfix 브랜치 push
git push origin hotfix/$FIX_NAME

# 2. main으로 PR 생성 + CI 통과 후 머지
gh pr create --base main --head hotfix/$FIX_NAME \
  --title "hotfix($FIX_NAME): $DESCRIPTION" \
  --body "긴급 수정: $DESCRIPTION

Co-Authored-By: Claude <noreply@anthropic.com>"
# CI watch · 외부 배포 commit-status 게이트 · Gemini 리뷰 처리(reply+resolve) · 머지
# → pr-review-gate 스킬의 전체 절차(1~6단계)를 따른다 (단일 출처 — 여기에 복붙하지 않음)
# gh pr merge 까지 완료한 뒤 아래 태그·develop 반영을 이어서 진행

# 3. 패치 버전 태그 (main 최신화 후 — 스택 무관: 최신 태그 patch+1)
git checkout main && git pull origin main
CURRENT=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
PATCH=$(echo "$CURRENT" | awk -F. '{print $1"."$2"."$3+1}' | tr -d 'v')
git tag "v$PATCH"
git push origin --tags
echo "✅ 태그: v$PATCH"
# 버전을 매니페스트(package.json·build.gradle 등)에도 기록하는 프로젝트면 함께 갱신

# 4. develop에도 반영 ← 반드시 실행
git checkout develop && git pull origin develop
git merge --no-ff hotfix/$FIX_NAME -m "Merge hotfix/$FIX_NAME into develop"
git push origin develop

# 5. 브랜치 정리
git branch -d hotfix/$FIX_NAME
```

> ⚠️ develop 머지를 건너뛰면 다음 릴리즈 시 수정이 사라진다.

완료 후 "✅ hotfix 완료 — main 태그: v$PATCH, develop 반영 완료" 출력.

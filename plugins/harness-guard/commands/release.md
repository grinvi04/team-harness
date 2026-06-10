---
description: 릴리즈 실행 — release 브랜치→main 태그→develop 반영→배포 헬스체크
argument-hint: <version>
---

# /release — 릴리즈 실행

**사용법**: `/release <version>`
예) `/release 1.5.0`

> `/release-check` 통과를 전제로 실행한다.
> develop → release/vX.X.X → main (tag) + develop (--no-ff 머지)

---

## Phase 0 — 사전 확인 + 스테이징 헬스 체크 (오케스트레이터 직접 실행)

```bash
git branch --show-current
git checkout develop && git pull origin develop
```

**release-check 미통과 상태에서 절대 진행하지 않는다.**

스테이징 헬스 체크:
```bash
# <STAGING_HEALTH_CMD>  예: curl -sf https://<STAGING_URL>/health -o /dev/null && echo "✅ Staging 정상"
```

---

## Phase 1 — 릴리즈 브랜치 생성 + 버전 업 (오케스트레이터 직접 실행)

```bash
git checkout -b release/v$VERSION
# <VERSION_BUMP_CMD>  예: npm version $VERSION --no-git-tag-version (backend + frontend)
git add .
git commit -m "chore(release): v$VERSION 릴리즈 준비

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 2 — 최종 검증 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

**프롬프트:**
```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
# <FULL_QUALITY_CHECK_CMD>  (lint + test + build + e2e)
```
- 전부 통과 → ✅ 리포트
- 실패 → ❌ 리포트 후 중단

---

## Phase 3 — PR 머지 + 태그 + develop 반영 (오케스트레이터 직접 실행)

Phase 2 ✅인 경우에만 진행.

```bash
# 1. release 브랜치 push
git push origin release/v$VERSION

# 2. main으로 PR 생성 + CI + Gemini 리뷰
gh pr create --base main --head release/v$VERSION \
  --title "release: v$VERSION" \
  --body "릴리즈 v$VERSION

Co-Authored-By: Claude <noreply@anthropic.com>"
# CI watch · 외부 배포 commit-status 게이트 · Gemini 리뷰 처리(reply+resolve) · 머지
# → pr-review-gate 스킬의 전체 절차(1~6단계)를 따른다 (단일 출처 — 여기에 복붙하지 않음)
# gh pr merge 까지 완료한 뒤 아래 태그·develop 반영을 이어서 진행

# 3. 태그
git checkout main && git pull origin main
git tag v$VERSION
git push origin --tags

# 4. develop 반영
git checkout develop
git merge --no-ff release/v$VERSION -m "Merge release/v$VERSION into develop"
git push origin develop

# 5. 브랜치 정리
git branch -d release/v$VERSION
```

---

## Phase 4 — 배포 후 헬스 체크 (`subagent_type: general-purpose`, `model: haiku`, **foreground**)

**프롬프트:**
```bash
# 배포 완료 대기 (최대 10분, 30초 간격)
# <DEPLOY_WAIT_CMD>  예: railway status polling

# 프로덕션 헬스 체크
# <PROD_HEALTH_CMD>  예: curl -sf https://<PROD_URL>/health -o /dev/null && echo "✅ 프로덕션 정상"
```

완료 후 출력:
```
✅ 릴리즈 완료
- 버전: v$VERSION
- main 태그: v$VERSION ✅
- develop 반영: 완료 ✅
- 프로덕션: 정상 ✅
```

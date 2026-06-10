---
description: 릴리즈 실행 — release 브랜치→main 태그→develop back-merge PR→배포 헬스체크
argument-hint: <version>
---

# /release — 릴리즈 실행

**사용법**: `/release <version>`
예) `/release 1.5.0`

> **`/release-check` 통과를 전제로 실행한다** (별도 커맨드 — 품질·보안·마이그레이션 병렬 검증).
> develop → release/vX.X.X → main PR (tag) → develop back-merge PR
> 빌드·헬스체크 명령은 **repo의 AGENTS.md "빌드·테스트 명령" 섹션**에서 읽는다.

---

## Phase 0 — 사전 확인 + 스테이징 헬스 체크 (오케스트레이터 직접 실행)

```bash
git branch --show-current
git checkout develop && git pull origin develop
```

**`/release-check` 미통과 상태에서 절대 진행하지 않는다** — 직전 release-check 결과가 없으면
사용자에게 실행 여부를 확인한다.

스테이징 헬스 체크: AGENTS.md의 스테이징 헬스체크 명령 실행 (정의돼 있지 않으면 사용자에게 확인).

---

## Phase 1 — 릴리즈 브랜치 생성 + 버전 업 (오케스트레이터 직접 실행)

```bash
git checkout -b release/v$VERSION
# AGENTS.md의 버전 범프 명령 실행 (예: npm version / gradle properties 갱신)
git add .
git commit -m "chore(release): v$VERSION 릴리즈 준비

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 2 — 최종 검증 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

**프롬프트:**
- AGENTS.md의 품질 검증 명령 전체 실행 (lint + test + build, e2e 있으면 포함)
- 전부 통과 → ✅ 리포트 / 실패 → ❌ 리포트 후 중단

---

## Phase 3 — main PR 머지 + 태그 (오케스트레이터 직접 실행)

Phase 2 ✅인 경우에만 진행.

```bash
# 1. release 브랜치 push + main으로 PR 생성
git push origin release/v$VERSION
gh pr create --base main --head release/v$VERSION \
  --title "release: v$VERSION" \
  --body "릴리즈 v$VERSION

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**`pr-review-gate` 스킬의 전체 절차(1~7단계)**를 따른다 — AI 리뷰 처리·사람 승인·CI·
commit-status·머지. (단일 출처 — 여기에 복붙하지 않음)

```bash
# 2. 태그
git checkout main && git pull origin main
git tag v$VERSION
git push origin --tags
```

---

## Phase 4 — develop back-merge PR (오케스트레이터 직접 실행)

develop도 branch protection이 걸려 있어 직접 push가 거부된다 — **back-merge도 PR로**.

```bash
gh pr create --base develop --head release/v$VERSION \
  --title "chore: release/v$VERSION develop 반영" \
  --body "main PR과 동일 내용의 back-merge — 버전 범프 커밋을 develop에 반영.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**`pr-review-gate` 부록(back-merge 간소 게이트)** 적용: 사람 승인 + CI + 머지만.

```bash
# 머지 완료 후 브랜치 정리
git branch -d release/v$VERSION
git push origin --delete release/v$VERSION 2>/dev/null || true
```

---

## Phase 5 — 배포 후 헬스 체크 (`subagent_type: general-purpose`, `model: haiku`, **foreground**)

**프롬프트:**
- AGENTS.md의 배포 대기·프로덕션 헬스체크 명령 실행 (최대 10분, 30초 간격)
- 정의돼 있지 않으면 그 사실을 리포트하고 사용자에게 수동 확인 요청

완료 후 출력:
```
✅ 릴리즈 완료
- 버전: v$VERSION
- main 태그: v$VERSION ✅
- develop back-merge PR: 머지 완료 ✅
- 프로덕션: 정상 ✅
```

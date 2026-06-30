---
name: feature-merge
description: feature/fix 브랜치를 develop에 머지 — 품질검증·AI리뷰·사람승인·CI 게이트 경유
effort: medium
---

# /feature-merge — feature 브랜치를 develop에 머지

**사용법**: `/feature-merge`
현재 브랜치가 `feature/*` 또는 `fix/*`인 상태에서 실행한다.

> 코드 확인 후 사용자가 직접 실행하는 커맨드.
> 머지 전 품질 검증을 자동으로 수행한다.

---

## 중단 조건 (진입 전 즉시 판단)

| 상황 | 중단 사유 출력 |
|---|---|
| 현재 브랜치가 `feature/*` 또는 `fix/*`가 아님 | "feature/* 또는 fix/* 브랜치에서만 실행할 수 있습니다. 현재 브랜치: [브랜치명]" |
| 미커밋 변경사항 존재 | "미커밋 변경사항이 있습니다 — 커밋 또는 stash 후 재실행하세요." |

---

## 실행 절차

### 1. 브랜치 상태 확인 (직접 실행)

```bash
git branch --show-current
git status --short
```

### 2. 최종 품질 검증 (직접 실행)

**repo의 AGENTS.md "빌드·테스트 명령" 섹션**의 품질 검증 명령(lint + test + build)을 실행한다.

실패 시 → **즉시 중단**. 품질 문제 해결 후 재실행.

### 3. PR 생성 + 리뷰 게이트 (직접 실행)

PR 생성은 **`pr-create` 스킬**을 사용한다 — 맨손 `gh pr create`를 쓰지 않는다. `pr-create`가 base를 자동 감지하므로(develop 기반 repo면 base=develop) push·품질검증·PR 생성을 그 단일 출처가 수행한다.

PR 생성 후 **`pr-review-gate` 스킬의 1~3단계**(AI 리뷰 대기·이슈 처리·스레드 reply+resolve)를 따른다. 절차 본문은 그 스킬이 단일 출처 — 커맨드에 복붙하지 않는다.

### ⛔ 머지 전 추가 체크리스트 — 모두 ✅ 아니면 머지 진행 금지

이슈 처리·스레드 resolve의 완료 기준은 `pr-review-gate` 2~3단계가 단일 출처 — 여기 중복하지 않는다.

**Cross-domain 검토 (새 에러/권한/side effect가 있는 PR에만 적용)**
- [ ] 새 에러 유형을 발생시킨다면 → 중앙 에러 핸들러에 대응 처리 추가됐는지 확인
- [ ] 특정 역할 전용 기능이라면 → 인가 레이어에서 접근 제어가 실제로 적용됐는지 확인
- [ ] 다른 도메인 데이터에 영향을 준다면 → 연관 도메인 상태까지 동기화됐는지 확인
- [ ] 외부 입력을 받는다면 → 입력값 검증이 적용됐는지 확인
- [ ] 도메인 에러 HTTP/API 응답 코드가 의미에 맞는가? → 중복/미존재/권한/인증 에러가 적절한 코드(409/404/403/401)로 반환되는지 확인

---

### 4. 승인 + CI + 머지 (직접 실행)

**`pr-review-gate` 스킬의 4~7단계**(사람 승인 확인 · CI watch · 외부 배포 commit-status 게이트 · 머지)를 따른다.

### 5. 브랜치 정리 (직접 실행)

```bash
git checkout develop && git pull origin develop
git branch -d "$FEATURE_BRANCH"
git push origin --delete "$FEATURE_BRANCH"
```

완료 후 출력:
```
✅ 머지 완료
- 브랜치: [feature명] → develop
- PR 머지: 완료 (#번호)
- 브랜치 정리: 로컬·원격 삭제 완료
```

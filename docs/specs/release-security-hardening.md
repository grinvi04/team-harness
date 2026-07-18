# 릴리즈 보안 게이트 하드닝 스펙

## 1. 목표 & Why

v0.59.0 release-check에서 발견된 GitHub 정책 우회·복구 유실·불완전 검증·공급망 가변 참조를 제거한다.
**성공 기준: 네 반례가 자동 테스트로 차단되고 전체 quality gate가 통과한다.**

## 2. Scope

- **In:** `gh api` mutation 권한, solo-merge 리뷰정책 복구, branch/thread 전수검증, Actions SHA 고정.
- **Out:** 새로운 배포 기능, 제품 profile 설치, 기존 릴리즈 내용 변경.

## 3. 기능 요구사항 + 수용기준

- **AC-1:** WHEN 기본 권한을 사용하면 mutation 가능한 광범위 `gh api` 명령을 자동 허용하지 않는다.
- **AC-2:** WHEN solo-merge가 리뷰 보호를 임시 제거하면 모든 쓰기 가능한 리뷰정책 필드를 원값으로 복구한다.
- **AC-3:** WHEN 보호 설정을 검사하면 conversation resolution 비활성화를 드리프트로 판정한다.
- **AC-4:** WHEN PR 리뷰 스레드가 100개를 넘으면 모든 페이지의 미해결 스레드를 합산하고 조회 실패는 차단한다.
- **AC-5:** WHEN CI workflow를 검사하면 외부 Action은 검증된 40자리 commit SHA만 참조한다.

## 4. 제약 / 비기능

- 보안 판정은 fail-closed이며 기존 CI·머지 정상 경로를 유지한다.

## 5. 경계 / Do-Not

- ✅ 관련 스크립트·템플릿·테스트·결정 기록 수정.
- ⚠️ branch protection 자체 변경은 릴리즈 절차에서만 수행.
- 🚫 게이트 완화, 테스트 스킵, 가변 Action 참조 유지.

## 6. Open Questions

- 없음.

## 7. 기술 접근

- 기존 순수 판정 seam과 shell E2E fake를 확장하고 정적 공급망 계약을 추가한다.
- GitHub REST review payload의 쓰기 가능 필드만 정규화해 복구 전후 전체 비교한다.
- GraphQL cursor pagination을 공용 함수로 두어 merge wrapper와 solo pre-gate가 함께 사용한다.

## 8. 태스크

| # | 태스크 | AC | 대상 | 검증 | 의존 |
|---|---|---|---|---|---|
| 1 | 권한·복구·보호 판정 계약 | AC-1~3 | settings, solo/set-protection tests | 관련 테스트 | — |
| 2 | 리뷰 스레드 전수조회 | AC-4 | PR merge scripts/tests | 관련 테스트 | #1 |
| 3 | Actions SHA 고정·결정 기록 | AC-5 | workflows/docs/test | 전체 quality | #2 |

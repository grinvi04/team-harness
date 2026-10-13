# 실제 GitHub 회사 예상 시험의 호환 수정

사용자 승인: 새 공개 합성 시험 저장소에서 실제 Git Flow/Actions/PR/병합/태그/폐기 배포.
원래 목표는 회사 사용을 예상한 Harness 자체 개선이다. 기존 저장소·보호·운영·DB/Auth/Storage 변경 제외.

2026-10-14 현재 판정: 보편적인 GitHub·PR·CI 환경의 개선·검증과0.93.1 전달 완료.
회사 고유 정책 인수는 현재 잔여에서 제외한다. Claude 실제 hook은 UNVERIFIED·보류이며 자동 재개하지 않는다.
[완료 판정 정본](../company-acceptance.md#보편적인-개발-환경-기준의-현재-완료-판정)을 따른다. 아래 원문은 당시 실행 계약이다.

## 실제 재현과 최소 변경

v0.93.0/2072511에서 보호 GET/preview 성공, PUT HTTP422: contexts/checks 동시 표현 oneOf 충돌.
같은 PR head의 push·PR quality/deploy-smoke 모두 SUCCESS인데 rollup 중복으로 merge 거부.
열린 PR의 baseRefOid가 원격 develop ref 이동을 따라가지 않는 실제 GraphQL/REST 불일치도 확인했다.
원문 증거는 회사 예상 시험 진행 문서에 연결한다. 첫 실패를 PASS로 덮어쓰지 않는다.

- 요청 payload는 app-bound checks 또는 legacy contexts 하나만 사용한다.
- GET의 두 projection을 검증하고 정규화하여 원래 앱·승인·CODEOWNERS·엄격 보호를 보존한다.
- 중복 rollup 행 모두 pass일 때만 최신 head/app REST 성공과 함께 인정한다.
- pending/실패/낡은head/잘못된app/조회 실패/필수집합 없음은 계속 거부한다.
- 검토·게이트 전후 base는 PR 메타데이터가 아닌 실제 원격 ref로 결박한다. ref 조회 실패·형식 오류도 거부한다.
- 신규 범용 정책 엔진·앱 설치·조직 정책 지원은 추가하지 않는다.

## 완료 기준

실제 증상으로 RED, 유지/거부 회귀 GREEN, 새 시험 repo PUT/readback 동일·실제 PR 정상/거부,
현재 후보 전체 quality와 구현자 외 읽기 전용 검토, 관련 안내·진행 기록 현행화.
검증 후보와 발행0.93.0을 구분한다. Harness 후속 후보 발행·설치는 이 시험 완료와 별도다.
실제 회사 사람승인·조직 정책·효용은 대표 기술 실행과 구분하며 DriveTree 기존 FAIL을 유지한다.

영향: branch-protection-policy.mjs/verify-required-checks.mjs/pr-merge.sh 및 solo 호출·직접 회귀·정책·인수 안내.

## 0.93.1 전달 승인과 단계 판정

사용자가 PR→develop/main→태그 발행·설치를 승인했다. 시험 당시 로컬 후보04f0f89와 이후 전달 효과는 구분한다.
전체 품질·현재 PR head/live base 독립 리뷰·필수CI·live 외부 provenance를 유지한다.
개인 solo는 자격 확인 뒤 main 승인요건만 래퍼로 일시 해제·전체 보호 복구한다. 회사 경로는 변경하지 않는다.
실제 사람·회사 고유 정책 인수와 DriveTree UI FAIL은 별도다. 이번 전달로 성공으로 바꾸지 않는다.
develop 변경은 [PR553](https://github.com/grinvi04/team-harness/pull/553)에 병합됐다. main·태그·설치의 최신 효과는
정식 릴리즈 PR·[v0.93.1 원격 원본](https://github.com/grinvi04/team-harness/tree/v0.93.1)·Release·프로젝트 지도에서 판정한다.
시험 종료 당시 로컬 후보와 이후 전달을 구분하며, 미실행 단계의 완료를 이 스펙에서 미리 단언하지 않는다.
전달 사전검사368926a에서 공개 증거 경로2곳과 공통 리뷰 스킬의 낡은 hash를 발견했다. 원문 실패를 보존하며
공개 경로는 `$E`로 표기하고 승인된 공통 스킬 한 행의 checksum만 현행화한다. 검사·차단 기준은 변경하지 않는다.

```harness-doc-sync
{
  "version": 1,
  "documents": [
    {
      "path": "docs/specs/acceptance-policy-wire.md",
      "reason": "current compatibility, acceptance evidence and reader preservation"
    },
    {
      "path": "plugins/harness-guard/skills/pr-review-gate/SKILL.md",
      "reason": "live remote base snapshot contract"
    },
    {
      "path": "docs/company-policy.md",
      "reason": "current compatibility, acceptance evidence and reader preservation"
    },
    {
      "path": "docs/code-review.md",
      "reason": "current compatibility, acceptance evidence and reader preservation"
    },
    {
      "path": "docs/company-onboarding.md",
      "reason": "보편 환경 완료 판정과 Claude 보류를 직접 사용 안내에 연결"
    },
    {
      "path": "docs/company-acceptance.md",
      "reason": "current compatibility, acceptance evidence and reader preservation"
    },
    {
      "path": "docs/pilots/company-adoption-2026-10-13.md",
      "reason": "current compatibility, acceptance evidence and reader preservation"
    },
    {
      "path": "docs/pilots/company-adoption-before-remote-lab-2026-10-13.md",
      "reason": "current compatibility, acceptance evidence and reader preservation"
    },
    {
      "path": "docs/specs/company-adoption.md",
      "reason": "current compatibility, acceptance evidence and reader preservation"
    },
    {
      "path": "README.md",
      "reason": "current compatibility, acceptance evidence and reader preservation"
    },
    {
      "path": "CHANGELOG.md",
      "reason": "current compatibility, acceptance evidence and reader preservation"
    },
    {
      "path": "docs/changelog/releases.md",
      "reason": "current compatibility, acceptance evidence and reader preservation"
    },
    {
      "path": "docs/changelog/2026/v0.93.1.md",
      "reason": "current compatibility, acceptance evidence and reader preservation"
    }
  ],
  "items": []
}
```

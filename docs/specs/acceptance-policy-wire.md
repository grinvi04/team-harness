# 실제 GitHub 회사 예상 시험의 호환 수정

사용자 승인: 새 공개 합성 시험 저장소에서 실제 Git Flow/Actions/PR/병합/태그/폐기 배포.
원래 목표는 회사 사용을 예상한 Harness 자체 개선이다. 기존 저장소·보호·운영·DB/Auth/Storage 변경 제외.

## 실제 재현과 최소 변경

v0.93.0/2072511에서 보호 GET/preview 성공, PUT HTTP422: contexts/checks 동시 표현 oneOf 충돌.
같은 PR head의 push·PR quality/deploy-smoke 모두 SUCCESS인데 rollup 중복으로 merge 거부.
원문 증거는 회사 예상 시험 진행 문서에 연결한다. 첫 실패를 PASS로 덮어쓰지 않는다.

- 요청 payload는 app-bound checks 또는 legacy contexts 하나만 사용한다.
- GET의 두 projection을 검증하고 정규화하여 원래 앱·승인·CODEOWNERS·엄격 보호를 보존한다.
- 중복 rollup 행 모두 pass일 때만 최신 head/app REST 성공과 함께 인정한다.
- pending/실패/낡은head/잘못된app/조회 실패/필수집합 없음은 계속 거부한다.
- 신규 범용 정책 엔진·앱 설치·조직 정책 지원은 추가하지 않는다.

## 완료 기준

실제 증상으로 RED, 유지/거부 회귀 GREEN, 새 시험 repo PUT/readback 동일·실제 PR 정상/거부,
현재 후보 전체 quality와 구현자 외 읽기 전용 검토, 관련 안내·진행 기록 현행화.
검증 후보와 발행0.93.0을 구분한다. Harness 후속 후보 발행·설치는 이 시험 완료와 별도다.
실제 회사 사람승인·조직 정책·효용은 대표 기술 실행과 구분하며 DriveTree 기존 FAIL을 유지한다.

영향: branch-protection-policy.mjs/verify-required-checks.mjs 및 직접 회귀·회사 정책·인수 안내.

```harness-doc-sync
{
  "version": 1,
  "documents": [
    {
      "path": "docs/specs/acceptance-policy-wire.md",
      "reason": "current compatibility, acceptance evidence and reader preservation"
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
  ]
}
```

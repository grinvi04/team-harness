# GitHub 보호 응답 호환성 수정

2026-10-13 사용자 “진행해” 승인: 확인된 Team Harness 정책 판독 결함을 수정한다.
제품 방향 판정은 **소유**(정책 보존·증거), GitHub REST에 대한 얇은 **연결**이다.
별도 ruleset 엔진·소비 제품 수정·원격 정책 변경은 추가하지 않는다.

## 원래 실패와 구현 경계

발행 v0.92.0 `16150b474e353ab8132cf24b72ec51d26eb4e837`의 실제 GET 진단은
main/develop 모두 `unsupported field block_creations`로 exit1이었다.
[당시 실행·인수 판정](../pilots/company-adoption-2026-10-13.md)을 보존한다.
원격 develop `9a1be6d7867cbb847579f442cdd9296fbf3c72fb`에서 격리 후보를 만든다.
PATCH 후보 0.92.1은 기존 응답 판독 계약의 복구이며 발행·설치를 뜻하지 않는다.

- `block_creations.enabled`는 공식 boolean 정책으로 읽고 PUT 계획·사후 대조에 보존한다.
- 응답에 리뷰 설정 키가 없으면 nullable 리뷰 없음으로 읽는다. 잘못된 객체는 거부한다.
- `checks.app_id:null`은 공식 GET 응답으로 판독한다. PUT은 정수/생략/-1의 의미가
  달라 null을 임의 변환하지 않는다. 해당 원본의 plan/preview/apply는 쓰기 전 차단한다.
- 기존 정수 앱 결박·승인·CODEOWNERS·주체·서명·강한 검사 보존을 유지한다.
- 미지원 필드·malformed·rulesets와 사후 손실은 계속 차단한다.

공식 근거: [GitHub branch protection REST](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection).
GET 판독 성공은 PUT 왕복 호환성·ruleset 집행·회사 인수 성공이 아니다.

## 잠글 검사 계약

| 요구·위험 | 조건·관찰 | 기대 결과 | 필수 |
|---|---|---|---|
| 실제 응답 판독 | block true/false, null binding, 생략 리뷰를 각각 재현 | validate 및 CLI check 허용, API 변경0 | 예 |
| 정책 보존 | bound 앱과 block true/false로 계획 및 재조회 | 원값 유지, 승인/주체/서명 등 기존 유지 검사 통과 | 예 |
| 모호한 쓰기 거부 | null binding 원본으로 plan/preview/apply | exit1, 계획 파일 생성0·PUT0, 임의 binding 변환0 | 예 |
| 잘못된 응답 거부 | 잘못된 boolean/app/count·미지원 필드/rulesets | exit1, 쓰기0 | 예 |
| 사후 손실 거부 | block 값·bound 앱·회사 정책 변경 응답 | verify exit1 | 예 |
| 실제 조회 | 개인 GitHub main/develop GET와 check | 현재 후보 exit0, 전체 보호 전후 동일 | 예 |
| 전체 품질·독립 검토 | CI quality 로컬 재현과 별도 read-only 검토 | 필수 검사 PASS, 남은 반례0 | 예 |

구현 전 변경 검사의 RED가 원래 증상 때문인지 확인하고 기존 보존 검사의 PASS와 연결한다.
대역 시험은 로컬 경계만 증명한다. 실제 조회는 개인 저장소의 읽기 호환성만 증명한다.
UI·DB·배포는 이 저장소에 비적용이다. DriveTree 수정·회사 거부 PR 시험은 범위 밖이다.

## 문서와 종료 조건

직접 소비 문서: `docs/company-policy.md`, `docs/company-acceptance.md`,
`docs/specs/company-adoption.md`, `docs/pilots/company-adoption-2026-10-13.md`.
현재 판정·다음 행동을 `.project-map/`에 연결하고 과거 0.92.0 실패를 덮어쓰지 않는다.
두 manifest·README 버전을 함께 갱신한다. 신규 회귀 검사를 CI quality에 연결한다.
구현·로컬 검증·독립 검토·현재 실제 GET·문서 대조가 충족되면 이 수정 범위를 종료한다.
PR·병합·태그·설치·배포는 이번 단계에서 수행하지 않는다.
실제 회사 인수 1 FAIL, 2·3 UNVERIFIED는 이 수정으로 완료하지 않는다.

현재 상태: 검사 계약 고정, 구현·검증 진행 중. 최종 후보·증거는 완료 후 연결한다.

```harness-doc-sync
{
  "version": 1,
  "documents": [
    {
      "path": "docs/specs/company-policy-api-compatibility.md",
      "reason": "승인 범위·현재 판정·호환 경계·이전 실패·버전 대조"
    },
    {
      "path": "docs/company-policy.md",
      "reason": "승인 범위·현재 판정·호환 경계·이전 실패·버전 대조"
    },
    {
      "path": "docs/company-acceptance.md",
      "reason": "승인 범위·현재 판정·호환 경계·이전 실패·버전 대조"
    },
    {
      "path": "docs/specs/company-adoption.md",
      "reason": "승인 범위·현재 판정·호환 경계·이전 실패·버전 대조"
    },
    {
      "path": "docs/pilots/company-adoption-2026-10-13.md",
      "reason": "승인 범위·현재 판정·호환 경계·이전 실패·버전 대조"
    },
    {
      "path": "docs/decisions.md",
      "reason": "승인 범위·현재 판정·호환 경계·이전 실패·버전 대조"
    },
    {
      "path": "docs/decisions-company-adoption.md",
      "reason": "199줄 경계에서 기존 결정 본문과 필수 읽기 경로 보존"
    },
    {
      "path": "README.md",
      "reason": "승인 범위·현재 판정·호환 경계·이전 실패·버전 대조"
    }
  ],
  "items": []
}
```

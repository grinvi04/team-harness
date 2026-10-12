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

## 현재 결과 (2026-10-13)

선정 판독·보존 범위는 **PASS_SCOPED**다. 구현 commit `3bedf616d999eb6906fe9d6d85005ebe99fb7d8f`.
전체 quality 후보 `1fc5f40d7bfd13952b704d1b80e12341c01cf40c`: 실행 블록74개 exit0.
checkout·Python 준비2개 action은 로컬 준비로 대체했다. macOS의 기존 rg·격리 ruff0.15.15를
사용했고 원래 검사 명령은 유지했다. 문서만 바뀐 이전 후보의 영향 없는 결과는 명시적으로 재사용했다.
회귀18/18, 기존 보존32/32, 실제 GitHub main/develop check exit0·전체 보호 전후 동일.
원격 PUT·PR·병합·발행·설치는 실행하지 않았다. null binding의 실제 PUT 호환은 미확인이다.
별도 read-only 검토 후보 `3b5ad05931a308d3131fdec211fca2e6a2ac7662`는 PASS_SCOPED였다.
시험 파일 쓰기가 실제 거부됐고 구현·현재 GET 원문을 독립 대조했다. sandbox의 mkdtemp 거부로
그 실행의 회귀 suite는 미실행이며 주 실행의 결과를 대신 재실행했다고 보고하지 않는다.
최초 RED와 quality 공개 안전성 실패(개인 경로8건), 수정 후 재시험은 로컬 원문으로 보존했다.
공개 문서는 이식 가능한 식별자를 쓰며 원본 위치는 소유 checkout의 `.project-map/`에서 연결한다.
원문 묶음은 `.runtime/company-policy-api-20261013/`의 `red.json`, `quality-first.json`,
`quality.json`, `actual-check.json`, `review-result.md`다. 로그를 공개 배포 자산으로 포함하지 않는다.
이후 기록만 갱신한 최종 후보의 문서·패키지·보안·읽기 전용 대조는 같은 묶음의
`final-checks.json`과 `final-review.md`로 확인한다. 실제 회사 인수 FAIL1/UNVERIFIED2는 유지한다.

## 0.92.1 전달 승인 (2026-10-13)

사용자가 이 후보의 PR 생성·develop/main 병합·태그 발행·설치를 승인했다.
기존 로컬 단계의 범위·미실행 기록은 당시 상태로 보존한다. 회사 인수 FAIL1/UNVERIFIED2는 별도다.
기존 CI·독립 리뷰·필수 live provenance·후보 결박과 전체 보호 보존을 유지한다.
개인 solo 정책의 main 자기승인 예외는 기존 원자 wrapper로만 실행·복구·대조한다.
프론트엔드 기준 통합 대화와 공유 Git·설치를 직렬 조율한다. 그 0.93.0 후보의
미해결 실제 Codex 검증 실패는 이번 검증된 0.92.1 수정에 포함하지 않는다.
완료 기준은 실제 PR MERGED, main/tag 정확한 SHA 일치, develop 포함,
공개 산출물 checksum과 설치 버전·원본 일치·새 native 실행 확인이다.
현재 상태: 전달 준비 진행 중. 원격 변경·0.92.1 설치는 아직 미실행이다.

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

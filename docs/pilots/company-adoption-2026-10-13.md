# 회사 사용 예상: 실제 원격 기술 검증과 도입 판정

2026-10-13. **승인된 대표 원격 기술 검증 완료**: 15항목 PASS_SCOPED. 실제 회사/사람 효용과 전달 단계는 별도다.
원래 목표는 회사에서 제품 개발에 쓸 Team Harness 자체의 개선이다.
실제 회사에 재직하지 않아도 대표 환경의 기술 검증은 지금 수행한다.
회사·참여자 지정과 소비 제품 수정은 현재 작업의 선행조건으로 요구하지 않는다.

## 대상과 권한

- 사용자 승인: 새 공개 합성 저장소 `grinvi04/team-harness-acceptance-lab`의 정책·PR·CI·병합·태그·폐기 배포.
- 제외: 기존 저장소/보호 변경, 운영·DB/Auth/Storage·원본 env·결제·전역 설정·사람 연락.
- 발행 기준선: Harness0.93.0 `207251185a6e828a86106d171c16a4d1b71d152a`.
- 수정0.93.1은 별도 격리 작업공간의 **로컬 후보**다. Harness PR·병합·발행·설치는 이번 시험 결과와 별도다.
- 시험 제품 v0.2.0/v0.2.1은 Harness 버전과 다르며, 폐기 배포는 Actions runner의 실제 HTTP 서버다.

실행 원문·명령·cwd·후보·exit·정책·run ID는 프로젝트의
`.runtime/company-acceptance-lab-20261013/`에 보존한다(로컬 ignored 기록).
[15항목 판정과 원문 hash](company-acceptance-lab-2026-10-13.json)와
[공개 시험 저장소](https://github.com/grinvi04/team-harness-acceptance-lab)를 함께 대조한다.
hash나 결과의 PASS 문자열만으로 실행을 증명하지 않는다.
[이전 제품/가정 시험 기록](company-adoption-before-remote-lab-2026-10-13.md)은 당시 실패·한계를 보존한다.

## 실제로 찾은 Harness 결함과 최소 수정

| 원래 요구 | 실제 반례 | 수정과 재검증 |
|---|---|---|
| P0 회사 정책 보존 | GET/preview 성공 뒤 PUT HTTP422: contexts/checks 동시 표현 | 요청은 하나의 표현만 사용하고 GET projection을 정규화. 새 repo 실제 PUT/readback 원값 일치 |
| P0 필수 CI 연결 | 같은 head의 push/PR 검사 전부 성공인데 중복 rollup으로 병합 거부 | 모든 중복 행 성공과 최신 head/app REST 성공을 함께 요구. 실제 정상 수동/자동 병합 |
| P0 검토 후보 결박 | 열린 PR baseRefOid가2dbd인데 실제 develop ref는18111 | snapshot과 래퍼 모두 실제 원격 base ref 조회. 실제 RED→GREEN·낡은 base 거부 |

소유 판정은 정책·검사·증거 연결이다. GitHub의 서버 보호와 native 실행 기능은 그대로 사용한다.
새 정책 엔진·추가 스택·플랫폼 복제나 소비 제품 기능은 만들지 않았다.
코드와 검사 계약: [승인 스펙](../specs/acceptance-policy-wire.md).

## 실제 원격 결과

각 PASS는 선언한 합성 환경의 해당 기술 범위다. 회사 전체 채택·사람 효용의 PASS가 아니다.

| ID | 확인한 것 | 판정·직접 증거 |
|---|---|---|
| R1 | 보호 판독·preview·실제 적용 보존 | PASS_SCOPED, 실제 API 원문 일치; 최초422 보존 |
| R2 | 필수 CI 실패의 수동/자동 거부 | PASS_SCOPED, 수정 후보 PR10 실제 수동/자동 거부·head/base/보호 불변 |
| R3 | 필수집합 없음·현재 검사 없음 | PASS_SCOPED, PR4 HTTP404/집합 미확인 거부·PR2 새 head 검사0 |
| R4 | 필수 CI pending 거부 | PASS_SCOPED, 수정 후보 PR10 실제 in_progress 수동/자동 거부·보호 불변 |
| R5 | 이전 head 성공 재사용 거부 | PASS_SCOPED, PR2 이전4개 성공/새 head 검사0·자동 거부 |
| R6 | 검토 head/base 이동·조회 실패 | PASS_SCOPED, 실제 낡은 base 거부·head 거부, ref 실패/형식/게이트 후 경계 회귀 |
| R7 | 사람/CODEOWNER 승인 누락 | PASS_SCOPED, PR3 CI 성공인데 서버 병합 거부; 승인1 정책 유지 |
| R8 | 회사 mode에서 solo 예외 | PASS_SCOPED, PR3 회사 선언 거부·전체 정책 원문 불변 |
| R9 | feature→develop 수동/자동 | PASS_SCOPED, PR1·PR5 MERGED, 현재 required/head/app 검사 |
| R10 | release/hotfix/main/develop/tag/CD | PASS_SCOPED, PR6–9·두 정확한 태그·실제 HTTP health/정리 |
| R11 | 기존 보호·사용자 작업 보존 | PASS_SCOPED, 기존 main/develop/rulesets 원문·기존 checkout SHA/clean 불변 |
| R12 | 승인되지 않은 검사 생산자 | PASS_SCOPED, 사용자 success status를 올려도 Actions app15368 증거 없어 수동/자동 거부 |
| S1 | 잠긴 기준의 진단·복구·독립 검토 | PASS_SCOPED, 80자 실패 직접 재현→최소 복구, 테스트 bytes 불변·읽기 전용 리뷰 |
| S2 | 새 문맥에서 업무 인계·재개 | PASS_SCOPED, 별도 readonly Codex가 원본/SHA/실패 기준/다음 행동 복원·실패 직접 재현 |
| S3 | 기존 자산의 적용·갱신·제거 | PASS_SCOPED, 실제0.92.1→0.93.0 bytes 변경·preview0쓰기·편집 충돌 거부·소유 제거/사용자 파일 보존 |

정상 main/develop은 처음부터 승인0·strict required quality/deploy-smoke·admins 정책이었다.
PR3의 `review-codeowners` 브랜치는 승인1·실제 CODEOWNERS를 유지했다. 정상 병합을 사람 승인 성공으로 세지 않는다.
`--auto`는 Harness의 develop 허용 경로 시험이며 GitHub 예약 auto-merge/merge queue 검증은 아니다.
hotfix는 합성 인계 문구·patch 버전의 Git Flow 모의 실행이다. 운영 사고 대응 성공을 주장하지 않는다.

| 단계 | 공개 원본과 최종 연결 |
|---|---|
| release main | [PR6](https://github.com/grinvi04/team-harness-acceptance-lab/pull/6), `da1e810fa099066e83306dbc60d316a00a6db9b6` |
| release 태그/배포 | [v0.2.0](https://github.com/grinvi04/team-harness-acceptance-lab/tree/v0.2.0), [run38365983752](https://github.com/grinvi04/team-harness-acceptance-lab/actions/runs/38365983752) |
| release 역병합 | [PR7](https://github.com/grinvi04/team-harness-acceptance-lab/pull/7), 추가 변경 없이 검토한 main tree 동일 |
| hotfix main | [PR8](https://github.com/grinvi04/team-harness-acceptance-lab/pull/8), `c5721f001fdc844d19f6a9b5183987d5e13a27fe` |
| hotfix 태그/배포 | [v0.2.1](https://github.com/grinvi04/team-harness-acceptance-lab/tree/v0.2.1), [run38366505303](https://github.com/grinvi04/team-harness-acceptance-lab/actions/runs/38366505303) |
| hotfix 역병합 | [PR9](https://github.com/grinvi04/team-harness-acceptance-lab/pull/9), develop `bc4cdf3ea415b23ac0c2556efc6ae40c92cc2a00`가 두 태그 포함 |

HTTP 배포는 source SHA와 artifact hash·실제 응답을 대조하고 finally로 서버·임시 디렉터리를 삭제했다.
외부 cloud/staging/production·DB·Auth·Storage와의 통합을 검사한 것은 아니다.

## 검증의 신선도와 정리

Harness 전체 quality74단계는578def0에서 실행했다. 최초 문서 선언 실패를 보존하고 aa4e917에서 관련2단계를 재실행했다.
실제 base 수정 뒤2e1bbb5에서 영향15단계를 재실행했다. 추가 거부 회귀는 같은 구현으로 merge70·solo81·리뷰40 사례와
스킬 수신 실행을 통과했다. 최종 문서·bundle 입력 검사는 원문 `quality-final-candidate.json`으로 연결한다.
첫 무효 fixture/선언 실수와 유효 RED/GREEN을 별도 기록한다. 최종 정리 JSON의 낡은 hash1개도
독립 검토와 무결성 검사에서 발견하여 원문·최종 API 대조 후 정정했다. 최초 실패는 `final-integrity-first-failure.json`에 보존한다.
독립 reviewer의 실제 readonly/Astra/medium을 확인했으며, reviewer가 못 읽은 원격 상태는 부모의 API 증거와 구분한다.
base 비교·스레드 처리는 원자적이지 않다. 서버의 strict CI/보호와 merge의 head 결박은 계속 필요하다.

래퍼가 사용 중인 시험 worktree의 로컬 branch 삭제를 거부한 기록을 보존했다.
이후 소유·clean·Git 포함 관계를 확인하고 시험 worktree를 제거한 뒤 release cleanup으로 정리했다.
거부 PR2·3·4·10을 닫고 소유 원격 head를 삭제했다. 공개 시험 repo와 보호/실패 기록은 감사용으로 남긴다.
기존 사용자 checkout·소비 repo·전역 설정은 변경하지 않는다.

## 인수 1·2·3의 판정과 다음 순서

| 인수 | 이번에 완료할 수 있는 범위 | 별도로 남는 실증 |
|---|---|---|
| 1 실제 제품 연결 | 기존 제품/DB/Auth/UI 실패를 정확히 연결·보존하는 Harness 준비 | DriveTree 필수 목록·새로고침 UI FAIL. 소비 제품 수정 제외 |
| 2 회사 정책·Git Flow | 새 원격에서 required 앱/head·거부·보호 보존·정상 Git Flow/CD 기술 검증 | 실제 사람/CODEOWNER 승인 성공, 특정 조직 rulesets/private/enterprise/fork 정책 |
| 3 팀 업무·인수 | 진단·잠긴 검사·독립 리뷰·릴리즈·새 문맥 인계·실제 버전 자산 수명주기 기술 실행 | 실제 사람 온보딩·협업·업무 인계 이해도·시간/재작업/ROI 측정 |

대표 기술 검증의 완료를 실제 사람이 수행하지 않았다는 이유로 통째로 미확인으로 되돌리지 않는다.
동시에 AI 인계와 합성 제품을 실제 독립 팀 참여·업무 효용으로 바꾸어 보고하지 않는다.
현재 발행0.93.0에는 위 실제 호환 결함이 있으므로 이번 수정 후보를 발행/설치하기 전 개선이 전달됐다고 말하지 않는다.
다음 전달은 검증된0.93.1의 PR→develop/main→태그→설치를 별도 gate와 승인 범위로 진행하는 것이다.
새 제품 기능이나 추가 검증 백로그를 이 완료 조건에 임의로 더하지 않는다.

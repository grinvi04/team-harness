# 일반 solo PR의 미확정 예약 보존

판정은 **소유**다. GitHub 정책·증거·delivery의 기존 계약을 복구한다.
새 병합 방식·플랫폼 hook·소비 제품 기능은 추가하지 않는다.
기반은 PR587 develop 병합 `e21cd369765d55cc5a48038e54b16bcfb140b25a`다.

## 확인한 결함과 수정

정식 보안 검토에서 일반 PR은 solo journal을 예약하지만 요청 intent를 저장하지 않는 것을 찾았다.
응답 유실 뒤 전체 보호를 복구하면 `requestStarted=false`이므로 미확정 예약도 해제됐다.
이는 과거94032ee 사건 누락의 원인이라는 뜻이 아니다. 그 내부 실패 단계는 미확정이다.

일반 solo 요청도 외부 호출 전에 기존 journal에 intent를 영속화한다. 요청 결과와 별도로 전체
보호를 복구하고, 실제 PR 번호·head SHA/예약 당시 저장소·base/repo·병합 SHA와 현재 trunk 포함을 읽는다.
확인된 병합과 원정책 복원이 함께 있어야 예약을 해제한다. 조회 실패·미병합·후보 불일치·
trunk 미포함이면 예약을 남겨 같은 base의 다음 예외를 막는다. 자동 재제출은 하지 않는다.
일반 비solo·linked stack의 기존 gate와 병합 경로는 유지한다.
일반 solo 복구는 기존 내부 `finish`로 읽기 재확인하며 보호 변경 권한을 새로 주지 않는다.

## 잠긴 완료 기준

| 조건 | 기대 결과 |
|---|---|
| 요청 전 | intent가 durable journal에 먼저 존재 |
| 응답 유실·PR open | 전체 보호 복원, 예약 보존, 두 번째 예외·병합 요청 거부 |
| 실제 head 불일치·trunk 미포함 | 성공 출력 금지, 예약 보존, 두 번째 예외 거부 |
| 정상 병합 | 정확한 실제 후보·병합 SHA·trunk와 원정책 확인 후 기록 archive |
| 응답 유실 뒤 실제 병합 확인 | 원래 명령 오류는 보존, 재제출 없이 확인한 종결만 archive |
| fork | 예약 당시 head repo가 같은 정상 fork는 해제, 다른 head repo는 거부 |
| 유지 | 기존 solo·stack·수동/자동 PR·관측 OFF/ON 검사와 품질·보안·리뷰 gate 통과 |

`tests/stack-merge-wrapper-test.mjs`의 새5개는 수정 전 모두 FAIL, 최소 수정 후 모두 PASS다.
명령·원문은 작업 worktree의 `.runtime/release-120/ordinary-{red,green}.log`다.
후속 독립 검토의 fork 경계는 정상 fork가 RED, 다른 fork의 거부가 PASS였다.
실제 head repo를 예약 당시 값과 비교하도록 교정하고 정상·거부를 함께 검사한다.
전체 회귀·현재 후보·전달은 [1.2.0 검증 기록](../../pilots/local-runtime-dashboard-release-1.2.0.md)에 연결한다.

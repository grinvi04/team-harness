# 병합 후 기록 갱신과 커밋 검사 — #539

## 승인 범위와 완료 기준

2026-10-12, [#539](https://github.com/grinvi04/team-harness/issues/539).
사용자는 수정·정상/거부 검증·main 적용·develop 동기화를 승인했다.
수정 작업 당시 태그·발행·설치는 제외했다. 소비 원격·배포·결제와 Claude 인증·실제 모델 검증은 보류한다.
별도 회사 도입 후보와 사용자 지도 편집은 보존한다.
제품 방향 판정은 소유다. 기존 GitHub 커밋 게이트의 적용 경계를 복구한다.

## 원래 증상과 수정 계약

PR537은 병합 전 required5/5를 통과하고 main·develop에 반영됐다.
그 후 본문 edited 이벤트가 현재 develop을 제외하면 검사 범위가 0개가 되어 실패했다.
빈 범위의 validator 거부 자체는 유지한다. 기록 갱신은 새로운 머지 검사가 아니다.

- required job/context, target 이벤트와 opened/synchronize/reopened/edited coverage를 유지한다.
- trusted checkout·read-only token·PR 코드를 실행하지 않는 경계와 head SHA 확인을 유지한다.
- 이벤트의 state·merged·action은 GitHub payload에서 각각 env로 전달한다.
- 기본 PR 번호·SHA·base 입력을 확인한 뒤 closed/true/edited만 명시적 비적용으로 종료한다.
  이 경로는 PR 객체 fetch나 validator 실행을 하지 않는다.
- open/false의 기존 네 이벤트는 원래 검사를 실행한다. 상태 누락·모순·다른 조합은 거부한다.
- job 전체를 조건으로 끄거나 continue-on-error·validator·보호 설정을 완화하지 않는다.
- consumer 정본과 repository 배치 사본, 설치형 repo-sync digest를 함께 갱신한다.
  기존 소비 저장소를 자동 수정하지 않는다. 소스 버전은 PATCH0.91.2다. 발행·설치는 별도 단계다.

## 필수 QA 범위

| 요구·위험 | 조건과 기대 결과 | 판정자 |
|---|---|---|
| 원래 증상 | 역병합된 main PR의 merged edited는 비적용으로 성공 | 실제 workflow shell·격리 Git, 수정 전 RED |
| 필수 job 보존 | job 조건/continue-on-error 없음, context·token·checkout 불변 | YAML 계약·독립 검토 |
| 열린 PR 보존 | main/develop/역병합 정상, edited/reopened도 검사 | 실제 Git 객체와 validator |
| 기존 거부 보존 | 잘못된 메시지·해결 커밋·stale head·fetch 실패·빈 main 범위 거부 | 기존8개와 추가 반례 |
| 상태 신뢰 경계 | 누락·모순·다른 이벤트·closed unmerged를 거부 | payload binding과 실제 shell |
| 비적용 부작용 | merged edited에서 PR fetch·validator 호출0, trusted worktree 불변 | fixture trace·HEAD/bytes/status |
| 직접 소비자 | 정본/배치 byte 일치, 설치 fallback digest 일치 | config drift·repo-sync·셋업 검사 |
| 실제 적용 | main 반영 후 PR537 edited의 현재 trusted check 성공 | 새 GitHub run·SHA·실행 로그 |
| 전달 보호 | CI/리뷰 통과·main/develop 전체 보호 원값 유지 | 현재 PR/head/base·원격 JSON 대조 |

앱·DB·브라우저는 이 CI 변경의 대상이 아니다. 로컬 fixture는 GitHub 이벤트 실행을 대신하지 않는다.
기존 시험은 유지하고 변경 시험의 최초 RED·후속 GREEN을 `.runtime/issue539/`에 기록한다.
고정 후보의 전체 quality와 독립 읽기 전용 안전 검토를 거친다.

## 로컬 수정 준비 기록과 현재 상태

기존8개 검사 통과 후 원래 merged edited의 빈 범위 실패를 RED로 재현했다.
잠근31개 정상·거부 시험은 수정 후 모두 통과했고 validator·메시지 시험 원문은 유지했다.
이 기록은 2026-10-12 소스0.91.2의 로컬 수정 준비 시점이다. 당시 전체 quality·독립 검토·CI,
main/develop 병합과 실제 edited 검증은 후속 단계였다. 당시 발행·설치0.91.1은 보존했다.
후속 검증 결과와 현재 전달 상태의 원본은 [이슈](https://github.com/grinvi04/team-harness/issues/539)와
연결 PR이다. 준비 기록을 병합·발행·설치 완료로 읽지 않는다.
진행 안내는 [신뢰 커밋 검사](trusted-commitlint.md), 정책 이유는 [decisions](../decisions.md)에 연결한다.
고정 스펙의 당시 검증 기록과 변하는 GitHub 전달 상태를 구분한다.

근거: [target 이벤트](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target),
[PR payload](https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request).

## 0.91.2 발행·설치 인계

2026-10-12, 수정·검증·main/develop 반영 이후 사용자가 태그·발행·설치를 추가 승인했다.
정식 release-check의 전체 품질·독립 보안 검토·live provenance·bundle/checksum을 먼저 확인한다.
이 준비 기록은 발행·설치 완료를 뜻하지 않는다. 현재 전달 결과는
[v0.91.2 Release](https://github.com/grinvi04/team-harness/releases/tag/v0.91.2)와 연결 PR에서 확인한다.
Claude 인증·실제 모델 검증과 소비 원격·배포·결제 보류는 유지한다.

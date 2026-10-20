# 대시보드·stack 1.2.0 현재 재현과 전달

2026-10-21. 범위는 현재 작은 저장소 재현·확인된 결함 수정·회귀·정식 전달·태그 설치다.
[원래 인수 이력](local-runtime-dashboard.md)과 실패 원문은 보존한다.
과거94032ee의 정확한 내부 실패 단계는 **UNVERIFIED**이며 현재 릴리즈의 추가 선행조건으로 삼지 않는다.
Claude 실제 호스트 검증은 기존 합의대로 미확인 보류다. 소비 저장소 수정·실제 회사·사람 인수는 제외한다.

## 현재 재현

대상은9ece430과 동일 tree인 develop `e21cd369765d55cc5a48038e54b16bcfb140b25a`다.
실행 clone은 `team-harness/.runtime/dashboard-stack-20261018`, 원문은 그 아래
`.runtime/dashboard/current-small-spool-20261021/`의 PLAN·RESULT·로그·사건·HTTP snapshot이다.

- 관련 원래 통합13개 PASS. 실제 viewer/writer/저장/journal/wrapper로 작은 저장소4흐름 PASS.
- 정상·병합 실패·결과 pending·보호 복구 실패에서 OFF/ON exit·stdout·stderr·API 호출이 같다.
- 각8사건·부모 종결1개, 정확한 복원 사건·병합 판정·예약 보존/해제, 종료 후 자기 lease 정리를 확인했다.
- GitHub API는 기존 상태형 합성 대역이다. 실제 원격 보호 시험이나 과거 원인의 증명으로 확대하지 않는다.
- 첫 보조 probe의 import 오류와 중복 수동 lease를 만든 시험 오류를 원문에 보존했다.
  probe를 교정했으며 제품 단언·250ms 상한·실패 기준을 낮추지 않았다.

## 릴리즈 전 발견·교정

독립 Astra/medium read-only 보안 검토가 일반 solo PR의 미확정 예약 해제를 지적했다.
[교정 계약](../specs/stacked-git-workflow/ordinary-solo-reservation.md)의 새5개는 RED5→GREEN5다.
작업 경로는 `.codex/worktrees/release-check-120/team-harness`, 원문은 `.runtime/release-120/`다.
일반5개와 fork 경계2개를 합친 최종7개, 기존 solo93·자동/수동 병합70·관측 통합41개가 PASS다.
독립 Astra/medium read-only 최종 검토는47dec9f의 직접 안전 경계에서 추가 조치사항0을 보고했다.
원래 전체 품질의 문서 검사는 작업자가 둔 bundle/리뷰 scratch62개 링크에서 실패했다.
제품 소스 실패와 구분해 원문을 보존했다. 깨끗한 동일 후보47dec9f clone에서7–77단계가 PASS였고,
같은 후보의1–6단계 PASS와 합쳐 로컬 품질77단계를 확인했다. 후속 현재 안내만 바꾼 문서는 별도 검사했다.
stack 묶음120·74·88개와 전체 품질의 관측 통합41개도 PASS다. 온라인 외부 증거7개·source/실험 bundle checksum을 확인했다.

## 릴리즈 리뷰의 종료 신호 교정

main PR590의 독립 Codex/Astra medium read-only 검토가 실행기 PID의 SIGTERM 뒤 자식 잔류를 재현했다.
PR590은 미병합으로 닫고 수정은 develop 작업 PR부터 전달한다. 과거 누락 원인과 구분한다.

| 잠긴 범위 | 기대 결과·판정자 |
|---|---|
| 실행기 PID에 INT·TERM·HUP, 수집 OFF·ON·손상 | 직접 자식이 같은 신호를 받고 지연 정리를 마친 뒤 reap; 실행기가 먼저 종료하지 않음 |
| 자식 정리의 exit0 | 취소를 PASS로 바꾸지 않고128+최초 신호; stdout·stderr 원값 보존 |
| 관측·재사용 | ON의 상관 start/finish와 실패 exit 일치; 손상이 취소 결과를 바꾸지 않고 기존 listener 보존 |

새9개는 수정 전 모두 자식의 정리 미실행으로 RED였고 수정 후 PASS다.
listener 보존·기존 출력·반환·명령1회 실행을 포함한 runner 전체20개도 PASS다.
실행 원문은 위 `.runtime/release-120/cancel-{red,green,regression}.log`로 연결한다.
SIGKILL·전원 손실의 전달이나 별도 분리된 후손 프로세스 전체 종료를 보장하지 않는다.

## 릴리즈 리뷰의 PR 선택 교정

main PR592의 독립 Codex/Astra medium read-only 검토에서 PR 번호 생략 호출의 CLI 오류를 확인했다.
일반·solo wrapper가 `--repo`와 함께 조회할 현재 브랜치를 전달하지 않은 결함이다. PR592는 미병합 종료했다.
현재 브랜치를 명시해 같은 저장소에서 조회하고, detached HEAD는 PR 번호 명시를 요구한다.
두 경로의 생략 성공·조회 실패·detached 거부/명시 성공6개는 수정 전 RED6이며,
수정 후6개 모두 GREEN이며, 보호 쓰기 없는 거부·기존 명시 PR 병합과 전체 wrapper35개 PASS다.
원문은 위 `.runtime/release-120/selection-{red,green,regression}.log`다.
새 develop 작업 PR 병합 뒤에만 main 후보를 다시 만들며, 이전 후보의 리뷰·CI로 대체하지 않는다.

## 현재 결과 조회 실패와 의존성 교정

421a659의 최종4흐름은 pending 부모 사건 단언에서 첫 FAIL이었다. 첫 probe가 단언 뒤 저장하고
fixture를 지워 최초 사건·조회 trace가 없으며 내부 단계는 UNVERIFIED다. 후속4흐름·pending8회
PASS를 해결로 세지 않았다. reader 시작300ms 지연은 같은 실패의 가능한 경로만 증명했다.
독립 분석 뒤 발행 모듈 평가300ms 지연을 분리했다. manual/writer pending·guard 세 시험은
RED3→GREEN3이고 원래 실제 viewer4흐름은 각8사건·결과/복구/출력 일치 PASS다. 잠긴 범위는 위
[writer 교정 계약](../specs/local-runtime-dashboard/capture-writer-correction.md#결과-reader의-발행-모듈-격리)이다.
실행 원문은 `.runtime/release-120/reader-isolation-{red,green,regression}.log`에 보존한다.
최초 원인을 소급 확정하거나 모든 scheduler 지연의 무손실을 주장하지 않는다. 현재 후보의
RED→GREEN·원래4흐름·제한/거부 회귀·독립 판정으로 교정 범위와 릴리즈 GO를 구분한다.

## 전달 상태의 원본

아래 원본의 실제 MERGED·SHA·태그·설치 결과로 판정한다. 검증 성공을 전달 완료로 확대하지 않는다.
이 문서의 고정 시험 기록과 별도로 현재 실행 원문은 위 작업 경로의 `.runtime/release-120/`에 보존한다.

| 단계 | 현재 판정에 사용하는 원본·조건 |
|---|---|
| 작업 PR→develop | [작업 PR 조회](https://github.com/grinvi04/team-harness/pulls?q=is%3Apr+head%3Acodex%2Fsolo-result-reservation); MERGED와 원격 develop 포함 모두 확인 |
| 정식 release-check | 현재 후보의 품질·독립 보안·온라인 provenance·package/checksum 실행 결과; 하나라도 필수 미확인이면 NO-GO |
| release→main | [1.2.0 release PR 조회](https://github.com/grinvi04/team-harness/pulls?q=is%3Apr+head%3Arelease%2Fv1.2.0); 선행 develop 병합 SHA 포함·현재 리뷰·CI 필수 |
| 태그·역병합 | [exact 태그](https://github.com/grinvi04/team-harness/tree/v1.2.0)가 실제 main 병합 SHA를 가리키고 [역병합 PR](https://github.com/grinvi04/team-harness/pulls?q=is%3Apr+head%3Async%2Fbackmerge-v1.2.0)이 MERGED인지 각각 확인 |
| 공식 태그 설치 | 공식 CLI 목록의1.2.0/enabled·태그 원본 digest·native 검사·새 skill 조회 결과를 실행 보고서에서 확인; 태그 존재만으로 설치 완료 아님 |

DB·마이그레이션·운영 서버·배포 환경은 이 제품에 없으므로 해당 health 항목만 SKIP이다.
시험 fixture를 운영 검증으로 세지 않는다. 구현·병합·태그·실제 설치는 별도 판정한다.

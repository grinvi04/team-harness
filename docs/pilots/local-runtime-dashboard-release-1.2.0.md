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
제품 소스 실패와 구분해 원문을 보존하고 깨끗한 동일 후보 clone에서 해당 단계부터 재검증한다.

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

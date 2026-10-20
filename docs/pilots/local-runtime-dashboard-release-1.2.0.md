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
새 보안 지적이 해소되고 현재 후보 회귀·리뷰가 통과하기 전에는 release-check NO-GO다.

## 단계별 상태

| 단계 | 현재 판정·다음 행동 |
|---|---|
| 현재 작은 저장소 재현 | PASS; 과거 원인은 미확정으로 분리 |
| 일반 solo 교정 | 대상5개 PASS; 전체 회귀·독립 재검토 진행 |
| 작업 PR→develop | 미실행; 현재 후보 품질·리뷰·CI 통과 뒤 순서대로 |
| 정식 release-check | 진행; 품질·보안·온라인 provenance·현재 package/checksum 필요 |
| release→main·태그·역병합 | 미실행; 원격 develop 포함 확인 뒤 시작 |
| 공식 태그 설치 | 미실행; 실제 main 병합 SHA의 태그 발행 뒤 실행 |

DB·마이그레이션·운영 서버·배포 환경은 이 제품에 없으므로 해당 health 항목만 SKIP이다.
시험 fixture를 운영 검증으로 세지 않는다. 구현·병합·태그·실제 설치는 별도 판정한다.

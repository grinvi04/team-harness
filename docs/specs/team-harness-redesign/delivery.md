# 재설계 1.0.0 정식 전달

2026-10-15 사용자가 M1–M5 완료 보고 뒤 다음 단계 M6 진행을 승인했다.
구현·실제 실행 인수는 [기존 실행 기록](execution.md)과 [결과 원문 연결](../../pilots/redesign-2026-10-15.json)을 보존한다.
이 문서는 전달 계약이며 실제 원격 상태는 아래 원본과 해당 PR의 검증 기록을 따른다.

## 범위와 순서

1. 작업 후보 `codex/workflow-maturity` → develop PR. 현재 head/base 독립 리뷰·필수 CI·스레드 검사.
2. GitHub의 실제 MERGED SHA와 원격 develop 포함을 확인한 뒤 그 SHA에서 `release/v1.0.0` 생성.
3. 현재 release 후보의 전체 품질·독립 보안 검토·live provenance·CHANGELOG·bundle/checksum 확인.
4. release → main PR, 현재 head/base 리뷰·필수 CI·보호 유지 후 병합.
5. 실제 main 병합 SHA에 `v1.0.0` 태그를 발행하고 원격 peeled SHA 확인.
6. main 결과를 `sync/backmerge-v1.0.0` → develop PR로 역병합하고 포함 관계 확인.
7. 공식 Codex 명령으로 발행 태그를 고정 설치하고 후보·본문·loader를 검증, 소유한 전달 작업공간 정리.

작업 PR과 main PR을 선행 병합 확인 없이 동시에 만들지 않는다. 기존 작업은 stash/reset하지 않는다.
main의 solo 예외가 필요하면 명시 solo 정책·실제 소유/협업자와 기존 사용자 승인을 확인하고
승인 요건만 원자적 wrapper로 처리한다. 저장한 전체 보호와 복원 결과가 일치해야 정상 완료다.
CI·독립 리뷰·대화 해결·현재 후보 결박은 예외 대상이 아니다. 원격 오류는 미확인으로 중단한다.

## 증거·원본

- [작업 브랜치 PR](https://github.com/grinvi04/team-harness/pulls?q=is%3Apr+head%3Acodex%2Fworkflow-maturity)
- [release PR](https://github.com/grinvi04/team-harness/pulls?q=is%3Apr+head%3Arelease%2Fv1.0.0)
- [역병합 PR](https://github.com/grinvi04/team-harness/pulls?q=is%3Apr+head%3Async%2Fbackmerge-v1.0.0)
- [원격 develop](https://github.com/grinvi04/team-harness/tree/develop) · [원격 main](https://github.com/grinvi04/team-harness/tree/main)
- [발행 태그](https://github.com/grinvi04/team-harness/tree/v1.0.0): 존재·SHA를 실제 조회하기 전에는 발행 완료가 아니다.
- 로컬 전달 원문: 주 checkout의 `.runtime/redesign-delivery-20261015/`. PR snapshot·명령·exit·후보·검토·설치 결과를 기록한다.

M1–M5의 같은 소스·환경·범위 결과는 재사용한다. PR/릴리즈의 현재 SHA·CI·독립 리뷰·live provenance는 새로 확인한다.
증거 부족을 해결하기 위해 테스트·보호·완료 기준을 낮추지 않는다. 문서 상태 변경도 같은 전달 후보에 포함한다.
GitHub Release 게시와 태그 발행은 별개다. 실제 DB·서버가 없어 DB/배포 health만 사유를 남겨 SKIP한다.
Claude 실호스트 보류, 소비 제품 수정·실제 사람·회사 고유 인수는 M6 필수 범위에도 추가하지 않는다.

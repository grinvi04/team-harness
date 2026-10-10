# Team Harness 0.86.0 전달

## 릴리즈 준비 시점의 상태

발행 태그의 이 기록은 준비 시점의 스냅샷이다. 최종 설치·역병합 결과는
[develop의 최신 전달 기록](https://github.com/grinvi04/team-harness/blob/develop/docs/specs/harness086-delivery.md)에서 확인한다.

2026-10-11. develop `ef0d123`의 release-check는 **GO_SCOPED**다.
PR #519의 정리·업그레이드와 PR #520의 CI 검색 결함 수정을 포함한다.
0.86.0은 Harness 플러그인 버전이다. Codex CLI는0.161.0이며 현재 설치는
Codex·Claude Harness0.85.0이다. main 병합·태그·역병합·0.86 설치는 미완료다.

## 완료 기준과 순서

1. 실제 후보·필수 CI·독립 검토·외부 자료·bundle checksum을 확인한다.
2. release/v0.86.0 → main PR의 현재 후보 게이트를 통과해 병합하고,
   PR의 실제 merge SHA에 v0.86.0 태그를 생성·발행한다.
3. 공식 CLI로 Codex·Claude Harness를 갱신하고 버전·활성·원본 파일을 대조한다.
   새 app-server에서 스킬 발견·로딩 오류를 별도로 확인한다.
4. main → develop 역병합 PR에 실제 결과와 남은 한계를 기록한다.
5. 사용자 branch·다른 worktree를 보존하고 소유 작업공간만 앱으로 보관한다.

## 사전 검증

| 항목 | 확인한 후보·결과 |
|---|---|
| 품질 | 96bce25와 CI26a6c67의 tree 동일, ef0d123도 동일. 독립 검토 PASS_SCOPED |
| 전체 CI | quality68단계·175명령, 필수5개 SUCCESS. rg14.1.0 설치·기존4개 제외 검사 실행 확인 |
| 실패 반례 | 원래10개·파이프 앞 오류2개 RED, 현재12PASS. 기존 비밀값 검사279PASS |
| 변경 이력·문서 | CHANGELOG 현재 후보 byte 재현32PASS, Markdown307파일0실패 |
| 보안 | 4022813의 Astra 읽기 전용 검토 PASS_SCOPED, 이후 runtime 검토 원본 변경 없음 |
| DB·배포 환경·SVG | 실제 runtime DB·배포 설정·docs 생성기 없음, 독립 근거의 정당한 SKIP |
| 외부 파일럿 | 현재 원본에서 --offline 없이 local·GitHub immutable 자료7개 대조 PASS |
| Bundle | ef0d123 sourceCommit, checksum81개 PASS, staged package는 installable:false 유지 |

## 보존과 한계

전역 규칙은 최초429→현재22개로 정리됐고, 재시작 후 직접 API·push dry-run으로 적용을 확인했다.
파괴 삭제·opt-in patch·임의 전량 검사 보호5개를 유지했다. 새 allow 규칙은 추가하지 않았다.
develop·main의 필수 CI·strict·관리자 보호·conversation resolution·force/delete 금지는 유지했다.
main은 승인1개를 유지한다. 단독 소유자라 자기승인이 불가능한 경우, 승인된 솔로 절차로
리뷰 요건만 일시 해제하고 저장한 전체 정책의 복원을 API에서 검증한다.

primary fix/astra-workflow-scope와 d1f9 develop을 보존한다. 점유된 develop으로 강제 전환하지 않는다.
Claude 인증·실제 모델 검증·소비 원격 작업·배포·결제는 제외한다.
스킬 발견·합성 script 검사·실제 host hook 발화·기존 열린 대화 적용을 각각 구분한다.
CI와 구조 검사만으로 문서 의미·보안 전체·제품 채택을 보장하지 않는다.

## 당시 실패 기록

[정리 구현·이전 실패](global-cleanup-upgrade.md), [검색 오류·첫 CI 실패](ci-negative-assertions.md)를 보존한다.
첫 release-check는 CI의 rg 누락에 따른 거짓 통과로 FAIL이었다. 후속22b8f9f CI는
CHANGELOG 미갱신에서 중단됐다. 이를 고친96bce25의 전체 검사·독립 판정이 현재 근거다.

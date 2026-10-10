# Team Harness 0.86.0 전달

## 발행·설치 결과

2026-10-11. [main PR #521](https://github.com/grinvi04/team-harness/pull/521)은 병합됐다.
실제 병합 커밋은 `48ab3d569eba8b18b2f2f9499e9dbad85610108a`다.
`v0.86.0` 태그의 원격 ref가 이 커밋을 가리키는 것을 확인했다. 발행 범위는 Git 태그와
기존 marketplace 원본이다. 별도 GitHub Release나 분리 package의 설치 승격은 하지 않았다.

공식 CLI로 Codex·Claude Harness를 **0.86.0**으로 갱신했고 두 도구에서 활성 상태를 확인했다.
Codex CLI는 **0.161.0**이다. 플러그인 버전과 CLI 버전을 구분한다.

| 검사 | 실제 결과와 범위 |
|---|---|
| 설치 원본 | 두 marketplace의 HEAD가 main 병합 SHA와 일치. Codex는 v0.86.0 ref를 지정 |
| 설치 파일 | Codex·Claude cache 각각 69개 파일의 경로·SHA-256이 발행 원본과 모두 동일 |
| Native 계약 | manifest·hook·17개 skill 구조 검사 PASS |
| 새 세션 로딩 | 새 app-server의 skills/list에서 Harness17개, 로딩 오류0개 |
| 가드 표본 | 설치 script 직접 호출로 파괴 삭제·비밀값/인증파일 유출 입력3개 거부, sentinel 보존 |
| Doctor | managed requirements·CLI·plugin·native 계약·repo sync·branch protection PASS |
| 보호 복원 | solo 병합 전후 main의 전체 보호 JSON 의미 동일. 승인1개와 필수 CI5개 유지 |
| 설정 보존 | Harness ref 외 Codex 설정, Claude 설정, 전역 규칙의 SHA-256 동일. 활성 목록도 보존 |

비활성 `security-guidance`의 CLI 표시 버전은 2.0.12→2.0.13으로 달라졌다.
활성 여부·원본 경로·다른 설정은 동일하다. 이 변화의 원인은 미확인이며 임의로 되돌리지 않았다.

이 결과는 실제 host hook 발화나 기존 열린 채팅의 재로딩을 증명하지 않는다.
Doctor의 fresh-session 모델 probe는 실행하지 않았다. Claude 인증 갱신·실제 모델 검증은 계속 보류다.

## 역병합과 보관의 판정 경로

이 기록을 포함한 `sync/backmerge-v0.86.0` → develop PR로 main의 릴리즈 이력을 반영한다.
문서에 설치 결과를 추가했으므로 순수한 동일 내용 역병합으로 취급하지 않고 추가 변경도 검토한다.
현재 병합 상태는 [해당 역병합 PR](https://github.com/grinvi04/team-harness/pulls?q=is%3Apr+head%3Async%2Fbackmerge-v0.86.0)과
현재 origin/develop이 정본이다. PR이 MERGED이고 그 commit이 develop에 포함됐을 때 역병합 완료다.

소유 작업공간은 병합 후 앱의 archive_worktree로 보관한다. 앱 영수증과 실제 경로·Git 등록의 부재를
함께 확인했을 때만 정리 완료다. 사용자 branch와 다른 worktree는 보존하며 앱의 제한을 우회하지 않는다.
최종 역병합·보관의 실행 결과는 프로젝트의 `.project-map/`과 전달 결과에 함께 기록한다.

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

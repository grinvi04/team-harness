# Trusted stacked CI 선행 전달 — 1.1.0

2026-10-16 사용자 승인: 준비된 CI 12파일만 기존 GitFlow로 선행 전달한다.
승인 정본은 `6199588`의 `docs/specs/stacked-git-workflow/implementation-plan.md`다.
전체 stack adapter·dashboard는 별도 1.2.0 후보이며 이번 변경에 포함하지 않는다.

## 범위와 보존

Team Harness가 소유하는 GitHub 정책·증거 검사의 기존 연결을 최소 보완한다.
`pull_request_target`은 기본 브랜치 workflow를 사용하므로 stacked 이벤트 지원을
main에 먼저 배치해야 이후 dashboard 의존 PR의 trusted 검사를 실행할 수 있다.
로컬 원본은 `9111758`에서 준비한 `ci-bootstrap-proposal`의 SHA manifest와 patch다.
기준 main `d273a70`과 시작 develop `59bf40b`는 파일 내용이 같다.

| 승인된 CI 파일 | 변경 |
|---|---|
| `templates/ci/commitlint.yml` | 정책 trunk와 직접 parent의 고유 commit 범위 분리 |
| `templates/ci/test-guard.yml` | stacked 이벤트와 직접 parent/head의 merge-base 비교 |
| `templates/ci/repository/commitlint-extra.yml` | 보호된 원본의 repo 전용 문서 검사 |
| `scripts/sync-repository-config.mjs` | 공통 template와 repo 전용 추가의 결정적 생성 |
| `.github/workflows/commitlint-trusted.yml` | 정본과 repo 추가의 배치 사본 |
| `.github/workflows/test-guard.yml` | 정본 배치 사본 |
| `.github/workflows/ci-gate.yml` | 기존 문서 시험에 trusted-documents 시험 인수 추가 |
| `tests/commit-message-test.sh` | 단일 trusted validator·repo 추가 계약 |
| `tests/commitlint-trusted-test.sh` | parent/trunk와 주입 거부 회귀 |
| `tests/test-guard-test.sh` | 직접 parent의 단언 감소 거부 회귀 |
| `tests/repository-config-test.sh` | 생성물·repo 추가 보존 회귀 |
| `tests/trusted-documents-test.mjs` | 후보 checker/workflow 변조의 trusted gate 대체 거부 |

두 plugin manifest·README 배지를 1.1.0으로 맞추고 구현 커밋 후 CHANGELOG를 생성한다.
일반 PR·기존 candidate 문서 검사·필수 CI·리뷰·보호 정책을 보존한다.
adapter 코드·stack opt-in·공통 스킬·소비 repo 설정은 복사하거나 변경하지 않는다.

## 검사와 판정

| 검사 | 기대 결과 |
|---|---|
| `node scripts/sync-repository-config.mjs --check` | 생성물 내용·권한 일치 |
| `bash tests/repository-config-test.sh` | 원본·repo 추가·읽기 전용 검사 보존 |
| `bash tests/commit-message-test.sh` | 기존 커밋 규약과 단일 trusted validator 유지 |
| `bash tests/commitlint-trusted-test.sh` | 일반 PR 유지·위반/주입 거부 |
| `bash tests/test-guard-test.sh` | 실제 parent의 단언 감소·조회 실패 거부 |
| `node --test tests/document-sync-test.mjs tests/trusted-documents-test.mjs` | 기존 문서 계약·trusted 원본 유지 |
| 커밋 후 CI quality 전체 74단계 | 동일 고정 후보에서 순서대로 전부 성공 |

최초 실패는 원문·후보·명령·exit와 함께 보존하며 자동 수정·재시도하지 않는다.
검사 증거는 이 worktree의 `.runtime/gh-stack-g0/ci-bootstrap-1.1.0/`에 보존한다.
로컬 quality는 설치된 rg·검증된 pinned Python/Ruff의 macOS 도구 준비 적응만 사용한다.
실제 GitHub 이벤트·서버 보호 집행은 로컬 fixture 통과로 완료 처리하지 않는다.

독립 검토에서 target이 분기 후 추가한 단언을 문서-only PR의 삭제로 오인하는 반례를 확인했다.
최초 12파일 SHA 복사와 이 후속 교정을 구분한다. 고정 parent/head 객체에서 유일한 merge-base를
구해 PR 자신의 변경만 비교하며, 조회 실패·공통 조상 없음·복수 merge-base는 거부한다.
실제 Git 분기 회귀는 기존 17개 통과·신규 1개 실패의 RED를 먼저 보존했다.
직접 parent가 이미 포함한 하단의 추가로 상위의 삭제를 숨기는 기존 거부 조건은 유지한다.
승인된 교정 후 같은 18개 시나리오가 모두 통과했고, 생성 배치 일치도 확인했다.
이전 후보의 quality는 14단계 통과 후 검토에 따른 중단으로 보존하며 전체 통과로 세지 않는다.

후속 후보 `d8f75c5`의 전체 quality는 1–27단계 통과 후 28단계에서 설치 plugin의
내장 commitlint digest 불일치로 중단했다. 29–74단계는 당시 미실행이다.
추가 승인으로 `check-repo-sync.mjs`의 workflow digest 선언만 현재 정본의 주석 제거·개행
정규화 결과에 맞추고, `tests/repo-sync-test.sh`에서 설치 조건의 정상 허용·비활성 거부를 확인한다.
최초 12파일 복사와 이 직접 소비자 교정은 구분하며, 기존 whitelist 판정 방식은 유지한다.

## 전달 완료 기준

- 로컬 구현/관련 회귀·전체 quality와 독립 최종 검토를 통과한다.
- 작업 PR→develop 실제 MERGED SHA와 포함 관계를 확인한다.
- 그 SHA에서 release 전달 PR→main 병합을 확인한 뒤 승인된 1.1.0 태그를 발행한다.
- main 병합 SHA의 develop 역병합과 포함 관계를 확인한다.
- 기본 브랜치 trusted workflow의 실제 stacked 이벤트·필수 검사 결과를 별도 확인한다.

## 로컬 검증 스냅샷 — 2026-10-16

후보 `029fba71c4a8b4531058d6370a96f30df7380c58`의 격리 quality74/74는 PASS다.
74개 원문 명령·종료 코드·로그 digest를 대조했으며 원본과 clone의 HEAD 동일·clean을 확인했다.
실행 816.92초, 해당 실행의 실패·재시도·단계 생략0이다. 앞선 실패 기록은 그대로 보존한다.
증거는 `.runtime/gh-stack-g0/ci-bootstrap-1.1.0/revision3/`의 `quality/results.json`과 `handoff.json`이다.
이 스냅샷은 로컬 검증만 증명한다. 원격 CI·리뷰·순차 병합·태그·역병합·설치는 포함하지 않는다.
후속 전달 상태는 [저장소 PR 원본](https://github.com/grinvi04/team-harness/pulls)과 해당 버전 태그에서 확인한다.
통합 담당자가 기존 완료 기준에 따라 원격 결과와 현재 소스를 대조한다.

## 1.1.0 이벤트 전환

PR #581의 후보 `c8c7f44`에서 required `test-guard`가 생성되지 않는 전환 공백을 확인했다.
기존 base/default main은 `pull_request`만, 후보는 `pull_request_target`만 구독한다.
1.1.0은 한 job에 두 이벤트를 구독해 기존 PR 검사를 유지하고 target 배치 경로를 연다.
두 이벤트 모두 main/develop과 기존 활동·라벨 변경을 구독하며 target에만 `stacked`를 포함한다.
inline 검사·읽기 전용 contents 권한·credential 비보존 checkout·required 보호는 유지한다.
조건부 skip이나 concurrency 취소를 추가하지 않는다.

후보가 통제하는 `pull_request` 성공을 trusted 실행 증거로 세지 않는다.
required check 이름만으로 실행 이벤트 종류를 강제할 수 없으므로 main 배치 후
target run의 이벤트·workflow 원본 SHA·검사 대상 후보 SHA를 직접 확인한다.
그 확인을 거쳐 전체 1.2.0 작업 PR에서 임시 `pull_request` 구독을 제거한다.
이번 로컬 변경은 이벤트별 계약 RED 후 기존 18개 시나리오·생성물·문법 검사를 대상으로 한다.
이벤트별 계약 추가 직후 17 PASS/1 FAIL을 보존했고, 수정 후 18/18과 생성물·YAML/쉘 구문은 PASS다.
원문 증거는 `.runtime/gh-stack-g0/ci-bootstrap-delivery-1/transition-fixture/`에 보존한다.
이전 74단계 PASS는 위 후보의 과거 기록이며 현재 변경 전체의 PASS를 뜻하지 않는다.

## 원격 전달 — 2026-10-16

[PR581](https://github.com/grinvi04/team-harness/pull/581)→develop `33c4f73`에서 release-check 전체74·산출물·live provenance7·독립 보안 검토를 통과했다.
[PR582](https://github.com/grinvi04/team-harness/pull/582)의 독립 리뷰·필수5 통과 후 main `e038399`로 병합하고 해당 SHA에 [v1.1.0](https://github.com/grinvi04/team-harness/tree/v1.1.0)을 발행했다.
[PR583](https://github.com/grinvi04/team-harness/pull/583)의 필수5 통과 후 develop `5ca2bd0`으로 역병합했다. main 포함·전체 보호·rulesets 원값을 확인했다.
원문은 CI release worktree의 `.runtime/gh-stack-g0/main-pr582/delivery-result.json`과 backmerge worktree의 `backmerge/`에 보존했다.

PR583의 실제 [test-guard target](https://github.com/grinvi04/team-harness/actions/runs/38792944227)와 [trusted 문서/커밋 검사](https://github.com/grinvi04/team-harness/actions/runs/38792944286)는 PASS다.
두 실행의 checkout `e038399`, head `e038399`, base `33c4f73`와 원격 workflow bytes·job 로그를 대조했다.
이 역병합은 head와 main이 같으므로 일반 target 실행 증거이며, 악성 후보 분리나 자체 stacked 실행의 증거로 확대하지 않는다.
이를 확인한 전체1.2.0 후보에서 임시 PR 이벤트만 제거하고 merge-base 교정·읽기 권한·credential 비보존을 유지한다.
실제 stacked·solo·대시보드 인수는 남았다. 기존 설치1.0.0은 유지했고 새 설치·GitHub Release 게시·운영 배포는 실행하지 않았다.

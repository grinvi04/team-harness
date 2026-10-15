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
| `templates/ci/test-guard.yml` | stacked 이벤트와 직접 parent 비교 |
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

## 전달 완료 기준

- 로컬 구현/관련 회귀·전체 quality와 독립 최종 검토를 통과한다.
- 작업 PR→develop 실제 MERGED SHA와 포함 관계를 확인한다.
- 그 SHA에서 release 전달 PR→main 병합을 확인한 뒤 승인된 1.1.0 태그를 발행한다.
- main 병합 SHA의 develop 역병합과 포함 관계를 확인한다.
- 기본 브랜치 trusted workflow의 실제 stacked 이벤트·필수 검사 결과를 별도 확인한다.

현재는 승인된 로컬 후보 준비 단계다. 원격 전달·태그·역병합·설치는 아직 완료가 아니다.
이 담당자는 로컬 수정·커밋·검사만 수행하고 원격 작업과 최종 판정은 통합 담당자에게 인계한다.

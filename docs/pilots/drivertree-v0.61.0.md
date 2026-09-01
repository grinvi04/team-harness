# DriveTree 외부 파일럿 후속 — Team Harness v0.61.0

- 측정 시각: 전 2026-09-01T01:43:55.242Z · 후 2026-09-01T02:05:50.510Z
- Team Harness commit: `e263e78926155c2451a0ca6df2ccfdd0a0b19290`
- 대상 전: `grinvi04/drivertree` `develop` @ `cb967b57296fe33adfcf87a482734b52a28a2e04`
- 대상 후: `grinvi04/drivertree` `develop` @ `662464b78cd4ba712428f2743c327589b460ecc9`
- 원본 측정값: [변경 전](drivertree-v0.61.0-before.json) · [변경 후](drivertree-v0.61.0-after.json)
- 후속 측정값: [zero-drift 후속](drivertree-v0.61.0-remediated.json)
- 작업 증거: [DriveTree Issue #74](https://github.com/grinvi04/drivertree/issues/74) ·
  [DriveTree PR #75](https://github.com/grinvi04/drivertree/pull/75)

## 검증된 결과

| 지표 | 변경 전 | 변경 후 |
|---|---:|---:|
| 측정 대상 | `develop@cb967b5` | `develop@662464b7` |
| `agent-governed/codex` filesystem profile 설치 | 1166.978 ms | 1185.873 ms |
| profile doctor | 40.208 ms, healthy | 39.528 ms, healthy |
| repo-sync | 53.214 ms, exit 1 | 42.715 ms, exit 1 |
| repo-sync 자산 18개 | OK 4 · WEAK 0 · WARN 3 · MISSING 11 | OK 8 · WEAK 0 · WARN 0 · MISSING 10 |
| guard benign 표본 | 4/4 허용 · sample false positive 0 | 4/4 허용 · sample false positive 0 |
| guard blocked 표본 | 5/5 차단 · sample false negative 0 | 5/5 차단 · sample false negative 0 |
| 측정 중 대상 repo 변경 | 없음 | 없음 |

요약하면 repo-sync는 **OK 4 → OK 8**, **WARN 3 → WARN 0**, **MISSING 11 → MISSING 10**으로
변했다. 두 원본 모두 `repositoryUnchanged: true`이며, 각 측정은 해당 `develop` SHA에서 clean 상태를
유지했다. 이는 두 측정 사이에 병합된 변경이 없다는 뜻이 아니라, 각 runner 실행 자체가 대상 repo를
수정하지 않았다는 뜻이다.

처리한 실제 backlog는 Codex가 stack rule 원문을 읽을 수 있게 하는 AGENTS pointer와 TypeScript·Next.js·
Prisma rule 정본 백필이다. Issue #74에서 범위를 고정하고 PR #75로 병합했으며, merge SHA는
`662464b78cd4ba712428f2743c327589b460ecc9`이다.

DriveTree의 PR head에서 다음 로컬 품질 게이트가 모두 통과했다.

- backend: format, lint, build 통과; 테스트 **8 suites / 70 tests** 통과.
- frontend: format, lint, build 통과; 단위 테스트 **2 files / 8 tests** 통과.
- 변경분 공백 오류 검사 통과.

GitHub required CI도 병합 대상 SHA에서 모두 통과했다.

- backend real DB e2e
- frontend Playwright
- secret-scan
- Vercel Preview Comments

Vercel commit status는 success였고, 미해결 review thread는 0개였다. required가 아닌 repo-sync observation
job은 실패로 표시됐다. 이는 잔여 **MISSING 10**을 발견하면 exit 1을 반환하도록 설계된 관찰 계약의 결과이며,
required 품질 게이트 실패나 새 회귀로 판정하지 않았다.

최종 병합 `develop`에서 다시 측정한 guard sample false positive/negative **0/0**을 정본으로 사용한다.
작업 브랜치에서 얻은 branch-preview guard 결과는 보호 브랜치 commit probe의 전제가 성립하지 않으므로
폐기했다.

## 잔여 backlog

repo-sync가 확인한 잔여 MISSING 10은 다음 두 독립 slice로 나눈다.

1. **commit provenance chain — 4개**
   - commitlint gate
   - commitlint config
   - commit-msg hook
   - commit message validator
2. **stack-agnostic destructive DDL suite — 6개**
   - destructive-DDL workflow
   - generic destructive-DDL checker
   - Alembic workflow step
   - Alembic checker
   - ActiveRecord workflow step
   - ActiveRecord checker

이번 파일럿은 이 10개를 자동 수정하거나 적용 범위 밖에서 구현하지 않았다.

## 후속 slice 완료 결과

2026-09-01에 위 backlog를 두 독립 slice로 그대로 실행했다. 공식 external pilot runner의 최종 후속
측정은 Team Harness `fe000137d43fdd2eb743650ec5ec4001d70fcf12`와 DriveTree
`develop@d71c0ac62a2712312d263d6de74500bc2c7ede25`에 결박했다.

| 지표 | 최초 backlog 처리 후 | 두 slice 완료 후 |
|---|---:|---:|
| 측정 대상 | `develop@662464b7` | `develop@d71c0ac6` |
| filesystem profile 설치 | 1185.873 ms | 1046.162 ms |
| profile doctor | 39.528 ms, healthy | 35.696 ms, healthy |
| repo-sync | 42.715 ms, exit 1 | 38.225 ms, exit 0 |
| repo-sync 자산 18개 | OK 8 · WARN 0 · MISSING 10 | OK 18 · WARN 0 · MISSING 0 |
| guard 표본 | 허용 4/4 · 차단 5/5 | 허용 4/4 · 차단 5/5 |
| 측정 중 대상 repo 변경 | 없음 | 없음 |

1. **commit provenance chain**
   - [DriveTree Issue #76](https://github.com/grinvi04/drivertree/issues/76)과
     [DriveTree PR #77](https://github.com/grinvi04/drivertree/pull/77)에서 workflow, config,
     실행 가능한 hook, validator 정본 4개와 스펙을 반영했다.
   - tracked diff는 5파일, 315 additions / 10 deletions였다. backend 70 tests, frontend 8 tests와
     GitHub required CI·Vercel을 통과했다.
   - [Issue #78](https://github.com/grinvi04/drivertree/issues/78)에서 기존 branch protection을 보존하고
     `commitlint`를 main/develop required context로 추가했다.
   - [Issue #79](https://github.com/grinvi04/drivertree/issues/79)와
     [DriveTree PR #80](https://github.com/grinvi04/drivertree/pull/80)에서 `hotfix/*` branch와
     `fix(scope)` commit type의 문서 역할을 정합화했다.
2. **stack-agnostic destructive DDL suite**
   - [DriveTree Issue #81](https://github.com/grinvi04/drivertree/issues/81)과
     [DriveTree PR #82](https://github.com/grinvi04/drivertree/pull/82)에서 workflow와
     SQL·Alembic·ActiveRecord 검사기 정본 4개, 스펙을 반영했다.
   - tracked diff는 5파일, 979 additions였다. 정본 fixture 92개와 DriveTree 반례 12개가 기대한
     결과를 냈고 현재 Prisma migration SQL 3개는 통과했다.
   - PR의 `destructive-ddl`, repo-sync, commitlint, test-guard, required CI, Vercel이 모두 성공했다.
     merge 후 `destructive-ddl`을 main/develop required context로 추가했다.

최종 branch protection은 기존 strict·enforce-admins·approval·conversation·force-push·deletion
불변식을 유지하면서 main 5개, develop 6개 required check를 갖는다. 사용자 DriveTree clone도
`develop@d71c0ac6`으로 fast-forward했고 `core.hooksPath=.githooks`와 zero-drift를 재확인했다.

따라서 이 보고서의 `MISSING 10`은 당시 측정의 역사적 사실이며 현재 backlog가 아니다. 두 slice의
실측 비용은 각각 정본 4개+스펙 1개와 한 PR 수준이었지만, 단일 public repo의 결과를 다른 stack·팀 규모에
일반화하지 않는다. 제품 판정은 계속 **연결**이며 split package의 `installable:false`와 marketplace 승격
보류도 유지한다.

## 해석과 제품 결정

### 검증된 사실

- filesystem profile 설치와 doctor는 두 clean `develop` 측정에서 모두 정상 완료됐다.
- pointer 1개와 stack rule 3개를 백필한 뒤 WARN 3이 없어지고 MISSING은 1개 줄었다.
- 선택한 guard 표본은 최종 병합 `develop`에서 예상 밖 차단·허용이 모두 0이었다.
- 실제 소비 repo 변경은 로컬 품질, GitHub required CI, Vercel 상태와 review thread 게이트를 통과해 병합됐다.
- 최초 후속 측정 시점의 표준 드리프트는 위 4개와 6개 slice, 총 MISSING 10이었다. 두 slice 완료 후
  같은 18개 자산은 OK 18 · MISSING 0이다.

### 추론

- 한 소비 repo에서 stack-rule 전달 경로를 연결하는 비용은 pointer·세 rule·작업 spec과 한 PR 수준이었다.
  이 비용은 DriveTree 실측에는 유효하지만 다른 repo의 비용으로 일반화할 수 없다.
- 당시 남은 10개는 commit provenance와 destructive DDL로 경계가 분리돼 실제 후속 작업도 두 slice로
  처리했고, 검증 범위와 실패 원인을 분리할 수 있었다.

### 결정

제품 방향 게이트 판정은 **연결**이다. stack rule 로딩은 실행 플랫폼에 맡기고 Team Harness는 소비 repo의
명시적 pointer·정본 rule·repo-sync 결과 계약을 연결한다. 이번 단일 repo 증거만으로 배포 범위를 넓히지
않으며, split package의 `installable:false`와 marketplace 승격 보류를 유지한다.
zero-drift와 required gate 적용은 DriveTree의 거버넌스 강제력을 높인 증거지만 단일 repo라는 표본 한계를
바꾸지 않으므로 이 판정을 승격 신호로 일반화하지 않는다.

## 한계와 잔여 위험

- 단일 public repo, 단일 macOS 환경, 단일 시점의 결과다.
- runner는 앱 dependency 품질을 직접 실행하지 않으며 배포, 실제 LLM session, marketplace install도
  실행하지 않는다. 앱 품질과 배포 증거는 DriveTree의 별도 로컬·GitHub 게이트에서 확인했다.
- guard 값은 허용 4개와 차단 5개 명령 문자열 **표본**의 결과이지 모집단 오탐·누락 비율이나 상한이 아니다.
- 작업 브랜치의 branch-preview guard 결과는 보호 브랜치 전제와 맞지 않아 폐기했고, 병합 후
  `develop` 재측정만 정본으로 삼았다.
- 의존성 설치 중 보일 수 있는 기존 npm audit finding은 이 docs·stack-rule backfill 범위 밖이며 자동 수정하지
  않았다.
- repo-sync observation exit 1이 드러낸 MISSING 10의 실제 도입 비용은 위 두 후속 slice에서 DriveTree
  기준으로 검증했다. 다른 stack·repo·팀 규모의 비용은 여전히 미검증이다.

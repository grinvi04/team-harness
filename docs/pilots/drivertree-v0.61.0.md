# DriveTree 외부 파일럿 후속 — Team Harness v0.61.0

- 측정 시각: 전 2026-09-01T01:43:55.242Z · 후 2026-09-01T02:05:50.510Z
- Team Harness commit: `e263e78926155c2451a0ca6df2ccfdd0a0b19290`
- 대상 전: `grinvi04/drivertree` `develop` @ `cb967b57296fe33adfcf87a482734b52a28a2e04`
- 대상 후: `grinvi04/drivertree` `develop` @ `662464b78cd4ba712428f2743c327589b460ecc9`
- 원본 측정값: [변경 전](drivertree-v0.61.0-before.json) · [변경 후](drivertree-v0.61.0-after.json)
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

## 해석과 제품 결정

### 검증된 사실

- filesystem profile 설치와 doctor는 두 clean `develop` 측정에서 모두 정상 완료됐다.
- pointer 1개와 stack rule 3개를 백필한 뒤 WARN 3이 없어지고 MISSING은 1개 줄었다.
- 선택한 guard 표본은 최종 병합 `develop`에서 예상 밖 차단·허용이 모두 0이었다.
- 실제 소비 repo 변경은 로컬 품질, GitHub required CI, Vercel 상태와 review thread 게이트를 통과해 병합됐다.
- 잔여 표준 드리프트는 위 4개와 6개 slice, 총 MISSING 10이다.

### 추론

- 한 소비 repo에서 stack-rule 전달 경로를 연결하는 비용은 pointer·세 rule·작업 spec과 한 PR 수준이었다.
  이 비용은 DriveTree 실측에는 유효하지만 다른 repo의 비용으로 일반화할 수 없다.
- 남은 10개는 commit provenance와 destructive DDL로 경계가 분리되므로 후속 작업도 두 slice로 처리하는
  편이 검증 범위와 실패 원인을 좁힌다.

### 결정

제품 방향 게이트 판정은 **연결**이다. stack rule 로딩은 실행 플랫폼에 맡기고 Team Harness는 소비 repo의
명시적 pointer·정본 rule·repo-sync 결과 계약을 연결한다. 이번 단일 repo 증거만으로 배포 범위를 넓히지
않으며, split package의 `installable:false`와 marketplace 승격 보류를 유지한다.

## 한계와 잔여 위험

- 단일 public repo, 단일 macOS 환경, 단일 시점의 결과다.
- runner는 앱 dependency 품질을 직접 실행하지 않으며 배포, 실제 LLM session, marketplace install도
  실행하지 않는다. 앱 품질과 배포 증거는 DriveTree의 별도 로컬·GitHub 게이트에서 확인했다.
- guard 값은 허용 4개와 차단 5개 명령 문자열 **표본**의 결과이지 모집단 오탐·누락 비율이나 상한이 아니다.
- 작업 브랜치의 branch-preview guard 결과는 보호 브랜치 전제와 맞지 않아 폐기했고, 병합 후
  `develop` 재측정만 정본으로 삼았다.
- 의존성 설치 중 보일 수 있는 기존 npm audit finding은 이 docs·stack-rule backfill 범위 밖이며 자동 수정하지
  않았다.
- repo-sync observation exit 1은 잔여 drift를 정확히 드러내지만, MISSING 10 각각의 실제 도입 비용은 후속
  slice에서 별도로 검증해야 한다.

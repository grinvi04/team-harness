# DriveTree 외부 파일럿 — Team Harness v0.60.0

- 측정 시각: 2026-07-18 22:08 KST
- Team Harness commit: `0f5b50165b07c16b9e2d4fd0387fad4fc53e44f1`
- 대상: `grinvi04/drivertree` `develop` @ `9a0dda3012f49a8e73462008055c69fbb729c69c`
- 원본 측정값: [`drivertree-v0.60.0.json`](drivertree-v0.60.0.json)

## 검증된 결과

| 지표 | 결과 |
|---|---:|
| `agent-governed/codex` filesystem profile 설치 | **952.225 ms** |
| profile doctor | **38.883 ms**, healthy |
| repo-sync | **45.601 ms**, exit 1 |
| repo-sync 자산 | 18개 중 OK 6 · WARN 1 · MISSING **11** |
| guard benign 표본 | 4/4 허용 · 예상 밖 차단 0 |
| guard blocked 표본 | 5/5 차단 · 예상 밖 허용 0 |
| 대상 repo 변경 | HEAD·porcelain status 불변 |

repo-sync가 보고한 유지보수 backlog는 Codex stack-rule pointer, commitlint workflow·config·commit-msg hook·
validator, destructive-DDL workflow·검사기와 그 Alembic·ActiveRecord 단계다. Next.js rule은 WARN이었다.
이 목록은 runner가 자동 수정하지 않았고 DriveTree는 측정 전후 clean `develop`을 유지했다.

guard는 명령을 실행하지 않고 문자열 판정만 했다. 허용 표본은 `git status`, Node 구문 검사, test runner,
project build였고 차단 표본은 보호 브랜치 commit, hard reset, force push, global install, test 삭제였다.

## 해석

- **검증:** 명시 filesystem profile은 1초 안에 설치됐고 doctor는 약 39ms에 건강 상태를 확인했다.
- **검증:** 선택한 9개 guard 표본에서는 sample false positive와 false negative가 모두 0이었다.
- **추론:** 설치·조기 차단 경로의 사용 비용은 이 프로젝트에서 낮다. 다만 표본 수가 작아 전체 명령 분포의
  정확도로 일반화할 수 없다.
- **검증:** 기존 소비 repo를 현재 표준으로 맞추는 초기 유지보수 비용은 MISSING 11건으로 작지 않다.
- **결정:** v0.60.0의 filesystem profile·doctor·pilot 증거는 유지하되, 실제 loader session과 표준 backlog를
  검증하지 않았으므로 분리 package의 marketplace 승격은 보류하고 `installable:false`를 유지한다.

## 한계와 잔여 위험

- 오탐·누락 값은 허용 4개와 차단 5개 **표본**의 결과다. 전체 비율이나 상한이 아니다.
- 앱 dependency 설치, build/test, 배포, 실제 LLM clean session, marketplace install은 실행하지 않았다.
- repo-sync MISSING이 실제 도입 작업량과 같은지는 각 자산의 stack 관련성·기존 CI 대체 여부를 별도 검토해야 한다.
- 단일 프로젝트·단일 macOS 환경·단일 시점 결과다. 다른 OS·팀·repo 규모의 유지보수 비용을 대표하지 않는다.
- 다음 승격 판단에는 실제 공식 loader 기반 clean session과 최소 한 번의 소비 repo backlog 처리 비용이 필요하다.

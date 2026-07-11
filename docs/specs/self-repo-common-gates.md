# team-harness 공통 게이트 self-dogfood

## 문제

v0.48.0의 repo-sync self-check 교정으로 `templates/`가 repo 루트 자산을 대신 인정하던 오탐이
사라졌다. 그 결과 team-harness 자체에 소비 repo 표준인 test-guard, commitlint workflow,
commitlint config가 실제로 없다는 드리프트가 드러났다.

## 목표

team-harness가 소비 repo에 배포하는 공통 게이트 정본을 자기 PR에도 동일하게 적용한다.

## 범위

- `templates/ci/test-guard.yml`을 `.github/workflows/test-guard.yml`로 채택
- `templates/ci/commitlint.yml`을 `.github/workflows/commitlint.yml`로 채택
- `templates/commitlint.config.cjs`를 repo 루트에 채택
- repo-sync 회귀 테스트가 team-harness self-check exit 0을 검증

## 비범위

- 템플릿 또는 게이트 로직 변경
- branch protection required checks 변경
- 플러그인 버전 변경

새 workflow는 PR에서 먼저 실동작을 확인한다. required check 등록은 원격 보호정책 변경이라
별도 확인과 복구 검증을 거쳐 후속으로 다룬다.

## 수용 기준

1. `check-repo-sync.mjs --repo <team-harness> --harness <team-harness>`가 MISSING 없이 exit 0이다.
2. 새 PR에서 `test-guard`와 `commitlint` job이 모두 성공한다.
3. 기존 `ci-gate` quality/secret-scan과 전체 로컬 테스트가 회귀 없이 통과한다.
4. workflow/config 내용은 해당 `templates/` 정본과 동일하다.

## 롤백

추가한 루트 workflow/config와 self-check assertion을 revert한다. 배포 템플릿은 변경하지 않으므로
소비 repo에는 영향이 없다.

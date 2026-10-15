# Codex native 실행 계약

## 공통 실행

- 사용자는 목표를 자연어로 요청한다. 현재 요청과 프로젝트 지침으로 일반 개발 방법론 하나를 선택한다.
  사용자 선택이 우선이며, 설치된 Superpowers를 사용할 때 Harness는 프로젝트 기준·검사·인계·delivery
  계약을 연결한다. 별도 설계·승인·TDD 루프를 다시 시작하지 않는다. 미설치면 native 방식으로 같은 계약을 지킨다.
- 이름이 같은 스킬은 namespace와 역할을 구분한다. 명령어 입력을 사용자에게 요구하지 않고 현재 선택과
  단계를 짧게 알린다. 라우터의 단계 제안은 승인 증거가 아니며 현재 요청·원본과 대조한다.

- 공용 skill의 Claude 전용 `subagent_type`·`model`·background 표기는 역할과 권한 경계로 해석한다.
- 현재 agent가 요구·테스트 계약 검수·최종 통합 판정과 Git 작업을 소유한다. 단순·연속 작업은 직접 한다.
- 요구사항·소유 파일·검사 기준이 명확한 저위험 구현은 사용자나 적용 지침이 위임을 요청하고 실제 플랫폼이
  지원할 때 native worker에 맡길 수 있다. 현재 승인된 모델·effort·역할을 확인하며 특정 slug나 새 역할 설치를
  요구하지 않는다. 적합한 사용자 설정 역할을 사용하고, 작은 모델이라는 이유만으로 구현에서 배제하지 않는다.
- 위임에는 목표·비목표·원본·소유 경로·금지 행동·검사·중단 조건을 전달한다. 테스트 계약 작성과 구현은
  순차로 진행하고 구현자는 잠긴 spec/test를 변경하지 않는다. 다른 작업자의 변경을 보존한다.
  동시 writer는 제품 지침에 따라 worktree 등으로 분리하고, 공유 파일·Git 작업은 직렬 처리한다.
- 독립 검증자는 구현자와 다른 인스턴스로 후보를 읽고 반증만 한다. Git·PR·머지·릴리즈는 현재 agent가
  기존 gate 안에서 수행한다. worker의 자체 검사를 독립 검증으로 부르지 않는다.
- 역할 TOML의 `sandbox_mode`나 도구 UI의 역할 설명만으로 실제 쓰기 차단을 판정하지 않는다.
  부모의 sandbox가 자식에 상속될 수 있으므로 실행의 실제 policy를 확인한다. 독립 검증은
  명시적인 read-only 부모/별도 실행에서 수행하고, 쓰기 worker는 별도 허용된 workspace 실행을 사용한다.
  읽기 행동·metadata·실제 거부 시험의 근거를 구분한다. 권한이 확인되지 않으면 필수 독립 검증은 미확인이다.
- 읽기 전용 요청·파일 소유권·worktree는 기술적 권한 격리의 증거가 아니다. 필요한 권한 제한을 실제로
  충족하지 못하면 해당 위임은 시작하지 않는다. 권한 거부를 다른 역할로 우회하지 않는다.
- 실행 후 실제 역할·model·effort와 결과를 확인하고 관측하지 못한 값은 미확인으로 남긴다.
  위임 비용이 이득보다 크면 직접 수행한다. 사용 비율을 맞추기 위한 호출·비교 실험은 추가하지 않는다.
- Claude 전용 plan mode·slash command·도구 이름은 Codex에서 가장 가까운 현재 기능으로 수행하되,
  수용기준·wrapper·CI·리뷰 게이트는 바꾸지 않는다.
- 공용 skill과 이 문서가 충돌하면 공용 skill의 안전·완료 계약을 우선한다.

스크립트 실행은 [현재 스킬 경로 검증](../runtime-path.md)을 각 도구 호출에서 먼저 적용한다.
플랫폼이 제공한 현재 스킬 절대 경로를 쓰며 오래된 HOME checkout을 fallback으로 실행하지 않는다.

## ao-coordinate

현재 agent가 조정·Git 작업과 최종 인수를 소유한다. 범위가 명확한 저위험 구현과 독립 탐색·반증은
native 실행 계약에 따라 기존 플랫폼 역할에 위임할 수 있다. 역할 이름을 늘리거나 별도 TOML을 설치하지 않는다.
필수 독립성·유효 권한을 충족하지 못한 위임은 시작하지 않는다. 진행 기록과 관련 체크리스트를 함께 현행화한다.

## feature-add

현재 agent가 요구와 RED 테스트 계약을 검수한다. 범위가 명확한 저위험 구현은 native 실행 계약에 따라
승인된 worker에 위임할 수 있다. 테스트 작성 → RED 검수 → 잠긴 테스트에 대한 구현 순서를 지킨다.
독립 검증자는 후보를 수정하지 않고 반증만 한다. 현재 agent가 통합 검증·문서 현행화·커밋을 맡는다.

## feature-merge

현재 agent가 품질 검증·review·wrapper 실행을 소유하고, 독립 근거 수집만 플랫폼 subagent에 위임한다.

## feature-modify

현재 agent가 변경 요구와 RED 계약을 검수한다. 범위가 명확한 저위험 수정은 native 실행 계약에 따라
승인된 worker에 맡기되 잠긴 테스트를 변경하지 않는다. 독립 검증자는 후보를 수정하지 않는다.
현재 agent가 영향 범위의 회귀·문서 현행화·통합·Git 작업을 책임진다.

## hotfix

재현·수정·main/develop 반영은 현재 agent가 소유하고 읽기 전용 원인 탐색과 반증만 위임한다.

## loop

현재 선택 model을 유지하고 timeout·stuck·checkpoint 안전장치 안에서 현재 agent가 종료조건까지 반복한다.

## milestone

GitHub milestone·repo spec·issue를 정본으로 유지하며 Codex task goal은 이를 대체하지 않는다.

## plan

승인 전에는 읽기·계획만 수행하고 Codex에 없는 Claude plan-mode 도구 호출을 가장하지 않는다.

## pr-create

현재 agent가 품질 명령과 PR wrapper를 직접 실행하며 push·PR 생성 권한을 subagent에 위임하지 않는다.

## pr-review-gate

공용 계약에 따라 Codex native 리뷰를 우선 사용한다. 구현자와 다른 읽기 전용 인스턴스의 현재
head/base 리뷰를 연결하고, 현재 agent가 지적 처리·증거 대조와 GitHub gate 최종 판정을 소유한다.

## qa

QA 축은 현재 agent가 종합하고 독립적인 읽기 전용 검토만 플랫폼 subagent에 위임한다.

## release

branch·tag·back-merge는 현재 agent가 소유하고 사전·사후 검증만 읽기 전용으로 위임한다.

## release-check

현재 agent가 품질·보안·마이그레이션 증거를 종합하고 독립 반증은 읽기 전용으로만 위임한다.

## repo-sync

현재 agent가 결과를 집계하고, 여러 repo의 독립적 읽기만 플랫폼 subagent에 위임한다.

## solo-merge

현재 agent가 review gate 완료 뒤 원자적 wrapper만 실행하며 보호 정책 복구를 직접 검증한다.

## systematic-debugging

현재 agent가 재현·가설 판별·원인 확정을 소유하고 독립 증거 수집과 반증만 읽기 전용으로 위임한다.

## verification-before-completion

현재 agent가 주장·증거 매핑과 fail-closed 판정을 소유하며 고위험 주장만 읽기 전용으로 독립 반증한다.

# 제품 경계 분리 스펙

## 1. 목표 & Why

Team Harness의 서버 거버넌스 core, 실행 도구별 adapter, 선택적 workflow 편의 기능을 설치·활성화·운영
책임이 다른 제품 단위로 정의한다. **성공 기준: 현재 단일 번들 상태를 정직하게 밝히고, 16개 skill의 목표
설치 단위가 누락 없이 정해지며, 기본 설치가 선택 workflow에 의존하지 않는 계약과 후속 물리 분리 순서를
CI에서 검증할 수 있어야 한다.**

제품 방향 판정은 **소유**다. 실제 agent 실행은 플랫폼에 위임하지만, 거버넌스가 선택 기능 제거 후에도
유지되는 제품 구조와 운영 책임은 Team Harness가 직접 정의한다.

## 2. Scope

- **In:** `governance-core`, runtime `native-adapter`, optional `workflow-pack`의 책임·포함 기준·의존 방향,
  설치 profile, 활성화·업데이트·doctor·제거 책임, 16개 skill 목표 배치, 현재 monolith에서 물리 분리로 가는
  순서, README·제품 로드맵·결정 기록 연결, CI 문서 계약.
- **Out:** 이번 작업에서 plugin 디렉터리나 manifest를 실제로 분할하기, skill·hook·agent 제거, 설치 명령 변경,
  소비 repo 자동 마이그레이션, plugin 버전 변경.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (현재 상태):** WHEN 경계 문서를 읽으면 THEN 현재 `harness-guard`가 core·adapter·workflow를 함께
  배포하는 전환기 monolith이며 아직 독립 설치 단위가 아니라는 사실을 확인할 수 있어야 한다.
- **AC-2 (세 단위):** WHEN 목표 구조를 읽으면 THEN `governance-core`, `native-adapter`, `workflow-pack` 각각의
  포함 기준·기본 활성화 여부·운영 소유자와 비목표가 구분돼야 한다.
- **AC-3 (skill 전수):** WHEN 현재 skill 디렉터리를 스캔하면 THEN 16개 skill이 `governance-core` 또는
  `workflow-pack` 중 정확히 하나의 목표 단위와 `기본` 또는 `선택` 활성화 상태를 가져야 한다.
- **AC-4 (기본 설치 독립성):** WHEN 사용자가 선택 workflow를 설치·활성화하지 않거나 제거해도 THEN branch
  protection, required CI, commit/PR/release gate, repo drift, audit·recovery 계약이 유지돼야 한다.
- **AC-5 (runtime 격리):** WHEN 특정 AI runtime을 사용하면 THEN 해당 `native-adapter`만 core에 연결하고 다른
  runtime의 cache patch·agent·hook 설정을 필수 의존성으로 요구하지 않아야 한다.
- **AC-6 (의존 방향):** WHEN 패키지 의존을 그리면 THEN `native-adapter → governance-core`,
  `workflow-pack → governance-core`만 허용하고 core가 adapter·workflow에 역의존하지 않아야 한다.
- **AC-7 (운영 계약):** WHEN 설치·업데이트·doctor·비활성화·제거를 수행하면 THEN 단위별 책임과 실패 시
  server-backed enforcement 보존 조건, 데이터·설정 소유권, rollback 경계를 확인할 수 있어야 한다.
- **AC-8 (전환):** WHEN monolith를 물리 분리하면 THEN 계약 잠금 → manifest/package 분리 → profile 설치·doctor
  검증 → 호환 기간 → legacy 경로 제거 순서를 따르고 각 단계의 rollback 조건을 명시해야 한다.
- **AC-9 (발견성):** WHEN README나 제품 로드맵을 읽으면 THEN 경계 정본 링크와 로드맵 3번 완료 상태를 확인할
  수 있고, 결정 기록은 이 스펙과 정본을 가리켜야 한다.

## 4. 테스트 시나리오

- **정상:** 16개 실제 skill과 문서 행이 일치하고 세 제품 단위·profile·의존 방향·운영 수명주기가 모두
  명시되면 통과한다.
- **예외:** 새 skill이 목표 단위 없이 추가되거나 한 skill이 두 단위에 속하거나, 기본 profile이
  `workflow-pack`을 요구하거나, core가 adapter에 의존한다고 쓰면 실패한다.
- **경계:** `pr-create`처럼 플랫폼 API를 연결하는 skill도 PR wrapper가 유일한 강제 경로이면 core에 둔다.
  `plan`처럼 core의 spec 계약을 돕더라도 일반 방법론 실행 자체는 workflow-pack에 둔다.

## 5. 제약 / 비기능

- 문서는 목표 제품 경계와 현재 물리 배포 상태를 섞어 표현하지 않는다.
- 패키지 분리 전까지 기존 설치와 runtime 동작은 바꾸지 않는다.
- 문서·CI 계약만 변경하므로 harness-guard 버전은 0.58.0을 유지한다.

## 6. 경계 / Do-Not

- ✅ 해도 됨: 목표 단위·profile·운영 책임 정의, 동적 skill 집합 계약, 후속 전환 태스크 기록.
- ⚠️ 먼저 물어봐: plugin manifest·marketplace source 분할, 기본 활성 skill 변경, 소비 repo 설치 migration.
- 🚫 절대 금지: 선택 pack 제거와 함께 required CI·branch protection 약화, runtime adapter 간 상호 의존,
  아직 분리되지 않은 단위를 이미 설치 가능하다고 표현.

## 7. 기술 접근 (HOW)

- 플랫폼 중복 감사의 `소유·연결·위임` 판정을 제품 단위로 변환하되 강제 경로 소비 관계를 함께 본다.
- `docs/product-boundaries.md`의 skill 표를 실제 `skills/*/SKILL.md` 집합과 동적으로 비교한다.
- 기본 profile·의존 방향·운영 수명주기·전환 단계는 안정 sentinel로 검사한다.
- `tests/product-boundary-test.sh`를 CI quality job에 연결한다.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(exit 0) | 의존 |
|---|---|---|---|---|---|
| 1 | 제품 경계·skill 전수 RED 계약 및 CI 등록 | AC-1~9 | `tests/product-boundary-test.sh`, `.github/workflows/ci-gate.yml` | 정본 누락으로 전용 테스트 실패 | — |
| 2 | 세 제품 단위·profile·skill 배치·운영 계약 작성 | AC-1~8 | `docs/product-boundaries.md` | 전용 테스트 GREEN | #1 |
| 3 | README·로드맵·결정 기록 연결 | AC-9 | `README.md`, `docs/product-direction.md`, `docs/decisions.md` | 전용 테스트 GREEN | #2 |
| 4 | 반증·전체 품질 검증·커밋 | AC-1~9 | 변경 전체 | 전체 CI quality 재현 + `git diff --check` | #1~3 |

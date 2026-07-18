# profile 설치·doctor 스펙

## 1. 목표 & Why

v0.59.0의 네 package artifact를 세 제품 profile로 안전하게 조립하고 수명주기를 검증하는 단일 진입점을 제공한다.
기존 monolith를 유지한 채 clean 대상에서 설치·업데이트·비활성화·제거와 doctor를 반복 실측한다.
**성공 기준: 세 profile의 전체 수명주기 테스트가 통과하고, adapter/workflow 제거 뒤에도 governance core가 보존된다.**

## 2. Scope

- **In:** `repository-only`, `agent-governed`, `workflow-assisted` profile의 clean-directory 설치·업데이트·비활성화·제거·doctor; Claude/Codex adapter 선택; package 호환성과 runtime binding 검증; 재현 가능한 상태 기록; CI 계약.
- **Out (Non-goals):** 새 package marketplace 공개; 사용자 전역 plugin/config/cache 변경; branch protection 제거; 기존 monolith deprecation; 실제 외부 repo나 GitHub 정책 mutation.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (설치):** WHEN 지원 profile과 runtime을 clean 대상에 설치하면, system SHALL catalog와 기록된 HEAD로 필요한 package만 조립하고 profile·version·source commit 상태를 기록한다.
- **AC-2 (프로필 경계):** WHEN profile을 선택하면, system SHALL repository-only에는 core만, agent-governed에는 core와 선택 adapter만, workflow-assisted에는 core·선택 adapter·workflow를 설치한다.
- **AC-3 (binding):** WHEN adapter 또는 workflow를 설치하면, system SHALL catalog의 core runtime binding을 설치 대상의 실제 core 경로로 해소하고 doctor가 모든 target 존재를 확인한다.
- **AC-4 (업데이트):** WHEN 같은 대상에 새 source commit/version으로 update하면, system SHALL staging 검증 성공 후 교체하고 실패 시 기존 설치를 보존한다.
- **AC-5 (비활성화):** WHEN adapter 또는 workflow를 disable하면, system SHALL 해당 선택 단위만 비활성 상태로 기록하고 core 파일과 doctor의 core 검증을 보존한다.
- **AC-6 (제거):** WHEN 선택 단위를 remove하면, system SHALL 그 단위만 제거하고 core 및 다른 adapter를 보존한다. repository-only core 제거 요청은 명시적 전체 제거 옵션 없이는 거부한다.
- **AC-7 (doctor):** WHEN doctor를 실행하면, system SHALL profile 구성·catalog/version·파일 digest·dependency·binding·활성 상태를 읽기 전용으로 판정하고 drift나 누락에 non-zero를 반환한다.
- **AC-8 (예외):** IF profile/runtime/operation이 유효하지 않거나 대상이 unsafe path·비관리 디렉터리·호환 불가 상태이면, system SHALL 대상 내용을 변경하지 않고 exit 2 또는 non-zero로 종료한다.
- **AC-9 (호환):** WHILE profile 기능이 배포되더라도, system SHALL 기존 harness-guard marketplace entry와 설치 경로를 변경하지 않고 새 artifact를 installable로 노출하지 않는다.

## 4. 제약 / 비기능

- Node.js 내장 모듈만 사용하고 network·사용자 전역 설정·GitHub mutation 없이 동작한다.
- 변경은 대상 내부 staging 후 rename으로 적용하며 상태 파일과 관리 marker가 없는 기존 디렉터리를 덮어쓰거나 제거하지 않는다.

## 5. 경계 / Do-Not

- ✅ 해도 됨: 임시·명시 대상에 package build, profile 상태·doctor report 생성, 관리 대상의 원자적 교체.
- ⚠️ 먼저 물어봐: 새 marketplace 공개, monolith deprecated 처리, 실제 사용자 plugin 경로를 기본 대상으로 지정.
- 🚫 절대 금지: 사용자 cache/config 자동 수정, core 정책 묵시 제거, repo 밖 source 복사, 검증 실패 후 부분 설치.

## 6. Open Questions

- 없음. 이번 단계는 공식 loader 공개 전의 filesystem profile 실측이며 실제 marketplace 승격은 후속 승인으로 분리한다.

## 7. 기술 접근 (HOW)

- `scripts/manage-profile.mjs`가 `build-packages.mjs`를 clean staging에 호출하고 `packaging/packages.json`의 profile→package 선택을 적용한다.
- 대상 루트에 관리 marker와 `profile-state.json`을 기록한다. install/update는 sibling staging에서 doctor를 선검증한 뒤 기존 관리 디렉터리와 교체한다.
- runtime binding은 설치 state에 실제 core 경로를 기록하고 adapter/workflow 파일의 선언된 환경 binding이 유효한 target을 가리키는지 doctor가 확인한다. 전역 환경이나 plugin cache는 변경하지 않는다.
- `scripts/profile-doctor.mjs`는 설치 state, package metadata, 파일 digest, dependency, binding과 활성 상태만 읽는다.
- shell 계약 테스트가 clean temp 대상에서 세 profile의 install→doctor→update→disable→remove와 실패 시 보존을 검증한다.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(이 명령 exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | profile 선택·install·doctor 계약 RED 및 최소 구현 | AC-1~3, AC-7~9 | `tests/profile-lifecycle-test.sh`, `scripts/manage-profile.mjs`, `scripts/profile-doctor.mjs` | `bash tests/profile-lifecycle-test.sh` | — | |
| 2 | update 원자성·disable/remove 보존 계약 RED 및 구현 | AC-4~6, AC-8 | 동일 파일 | `bash tests/profile-lifecycle-test.sh` | #1 | |
| 3 | 문서·결정·CI·버전 정합성 반영 | AC-9 | `docs/`, `.github/workflows/ci-gate.yml`, manifests | 전체 quality gate | #2 | |

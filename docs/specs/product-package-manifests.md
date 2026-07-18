# 제품 package manifest 분리 스펙

## 1. 목표 & Why

현재 `harness-guard` 단일 source를 제품 경계에 따라 재현 가능한 네 package artifact로 조립할 정본을 만든다.
기존 monolith 설치는 유지하면서 다음 profile 설치·doctor 단계가 파일 소속과 호환성을 추측하지 않게 한다.
**성공 기준: 현재 plugin 배포 파일이 중복·누락 없이 네 단위에 배치되고, clean 임시 디렉터리에서 같은
입력 SHA로 동일한 artifact와 유효한 manifest를 생성한다.**

## 2. Scope

- **In:** governance core, Claude adapter, Codex adapter, workflow pack의 package catalog와 호환 version;
  catalog를 검증하고 물리 디렉터리로 조립하는 build 진입점; CI 계약; 전환 상태 문서화.
- **Out (Non-goals):** 새 package의 marketplace 등록·실제 설치·기본 활성화; 기존 `harness-guard` 제거;
  profile installer·update·disable·remove·doctor; cache patch 제거; skill 내용이나 hook 동작 변경.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (정상):** WHEN package catalog를 검사하면, system SHALL `governance-core`,
  `claude-adapter`, `codex-adapter`, `workflow-pack` 네 단위와 각 version·dependency를 반환한다.
- **AC-2 (완전성):** WHEN 현재 `plugins/harness-guard` 배포 파일을 catalog와 대조하면, system SHALL legacy
  monolith manifest를 제외한 모든 파일이 정확히 한 단위에 속함을 보장하고 누락·중복·존재하지 않는 source를 거부한다.
- **AC-3 (경계):** WHILE dependency를 검사하면, system SHALL adapter→core와 workflow→core만 허용하고
  core의 역의존, adapter 상호 의존, 순환 의존을 거부한다.
- **AC-4 (조립):** WHEN clean output에 build를 실행하면, system SHALL 단위별 source를 상대 경로 그대로 복사하고
  `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `harness-package.json`을 생성한다.
- **AC-5 (재현성):** WHEN 같은 commit과 catalog로 두 번 build하면, system SHALL 파일 목록과 내용 digest가
  동일한 artifact를 생성하며 source worktree는 변경하지 않는다.
- **AC-6 (예외):** IF output이 비어 있지 않거나 catalog가 repo 밖 source·경로 순회·잘못된 semver를 포함하면,
  system SHALL 파일을 덮어쓰지 않고 non-zero로 종료한다.
- **AC-7 (호환):** WHEN 이번 기능을 배포해도, system SHALL 기존 `harness-guard` marketplace entry와 plugin
  동작을 유지하고 새 package를 독립 설치 가능하다고 노출하지 않는다.

## 4. 제약 / 비기능

- Node.js 내장 모듈만 사용하며 network나 사용자 plugin cache를 변경하지 않는다.
- build는 임시 디렉터리에서 검증 가능하고 source symlink를 artifact에 남기지 않는다.

## 5. 경계 / Do-Not

- ✅ 해도 됨: package catalog·builder·계약 테스트·CI·제품 경계 문서·버전 갱신.
- ⚠️ 먼저 물어봐: 새 package marketplace 공개, 기존 설치 명령 변경, monolith deprecation 시작.
- 🚫 절대 금지: 기존 plugin 파일 이동·삭제, hook/skill 의미 변경, 사용자 cache/config 수정, 보호 공백 생성.

## 6. Open Questions

- 없음. package dependency를 직접 해석하는 공식 설치 surface가 현재 확인되지 않아 install-ready profile은 다음
  승인 스펙으로 분리한다.

## 7. 기술 접근 (HOW)

- `packaging/packages.json`을 파일 소속·단방향 dependency·호환 version의 정본으로 둔다.
- `scripts/build-packages.mjs`는 catalog 검증과 clean output 조립만 수행한다. 각 artifact에는 도구별 유효
  manifest와 설치 전 단계임을 명시하는 내부 `harness-package.json`을 생성한다.
- `harness-guard`의 16 skill은 기존 제품 경계의 core 9/workflow 7 배치를 그대로 사용한다. Claude hook·agent와
  Codex overlay·agent·호환 script는 adapter별로 격리한다. 공용 guard·PR·검증 script는 core에 둔다.
- 공식 loader가 package dependency를 해석하지 않으므로 새 artifact를 marketplace에 등록하지 않는다.
- AC-1~7은 `tests/package-build-test.sh`에서 임시 repo/catalog 변조 반례와 실제 source build로 검증한다.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(이 명령 exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | package catalog·builder 계약을 RED로 잠금 | AC-1~7 | `tests/package-build-test.sh`, CI | `bash tests/package-build-test.sh` | — | |
| 2 | catalog와 artifact builder 최소 구현 | AC-1~6 | `packaging/packages.json`, `scripts/build-packages.mjs` | `bash tests/package-build-test.sh` | #1 | |
| 3 | 전환 상태·버전·결정 정합성 반영 | AC-7 | manifests, `README.md`, `docs/` | 전체 quality gate | #2 | |

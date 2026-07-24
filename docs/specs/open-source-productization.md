# 오픈소스 제품화 스펙

## 1. 목표 & Why

외부 사용자가 Team Harness의 지원 범위와 설치 경계를 영어 문서만으로 판단하고, 보안 이슈와 기여를
예측 가능한 경로로 제출할 수 있게 한다. 릴리즈 담당자는 기록된 Git revision에서 검증 가능한 bundle을
재현 생성한다. **성공 기준: 공개 문서 계약과 동일 revision bundle 재현성 테스트가 CI에서 통과한다.**

제품 방향 판정은 **소유**다. 지원 정책, 보안 신고, 기여 게이트와 release provenance는 Team Harness가
GitHub 저장소에서 직접 보장하는 결과 계약이다.

## 2. Scope

- **In:** 영문 Quick Start, 지원 환경 문서, `SECURITY.md`, `CONTRIBUTING.md`, 자동 생성 `CHANGELOG.md`,
  기록된 `HEAD` 기반 release bundle·SHA-256 manifest 생성, 문서·artifact CI 계약.
- **Out:** marketplace 공개, 분리 package의 `installable:true` 승격, 사용자 전역 설정 변경, 새 Git tag나
  GitHub Release 발행, 외부 런타임 호환성 보증.

## 3. 수용기준

- **AC-1 (Quick Start):** 외부 사용자는 영문 문서에서 전제조건, clone, 검증, filesystem profile 설치,
  doctor, 제거와 현재 marketplace 제한을 확인할 수 있다.
- **AC-2 (지원 범위):** 지원 환경 문서는 OS·shell·Node·Git·GitHub·Claude Code·Codex의 지원 수준과
  검증 범위를 `supported / best-effort / unsupported`로 구분하며 근거 없는 버전 호환을 주장하지 않는다.
- **AC-3 (보안):** `SECURITY.md`는 비공개 신고 경로, 지원 버전, 공개 금지 정보와 응답 기대치를 정의한다.
- **AC-4 (기여):** `CONTRIBUTING.md`는 develop 기반 branch/PR wrapper, spec/TDD, commit 형식과 quality gate를
  이 저장소 규약에 맞게 안내한다.
- **AC-5 (변경 기록):** `CHANGELOG.md`는 수기 편집물이 아니라 Conventional Commits와 태그에서 생성된
  파일임을 명시하고 현재 릴리즈 내역을 재현 가능한 명령으로 갱신할 수 있다. 정식 태그 전 release
  candidate는 `--release vX.Y.Z`로 현재 `HEAD`를 직전 태그와 비교해 결정적으로 생성한다.
- **AC-6 (bundle):** release bundle 생성기는 기록된 `HEAD`의 source archive, 네 staged package artifact,
  provenance manifest와 SHA-256 목록을 clean output에 생성하며 dirty worktree를 포함하지 않는다.
- **AC-7 (재현성):** 같은 Git revision과 catalog로 두 번 만든 bundle의 파일 경로와 digest 목록은 같다.
- **AC-8 (안전 경계):** bundle metadata는 분리 package가 설치 불가임을 보존하고 marketplace publication이나
  GitHub mutation을 수행하지 않는다.

## 4. 제약 / Do-Not

- Node.js·Git·tar의 로컬 기능만 사용하고 network 없이 생성한다.
- 출력 경로는 비어 있거나 존재하지 않아야 하며 기존 내용을 덮어쓰지 않는다.
- release publication과 tag는 `/release-check`와 `/release` 승인 범위로 남긴다.
- `CHANGELOG.md`는 생성 결과만 커밋하고 릴리즈 항목을 손으로 편집하지 않는다.

## 5. 태스크

| # | 태스크 | AC | 대상 | 검증 |
|---|---|---|---|---|
| 1 | 공개 문서 계약 RED 및 문서 작성 | AC-1~5, AC-8 | `README.md`, `docs/quick-start.md`, `docs/support.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `tests/open-source-docs-test.sh` | `bash tests/open-source-docs-test.sh` |
| 2 | bundle 재현성 계약 RED 및 최소 구현 | AC-6~8 | `scripts/build-release-bundle.mjs`, `tests/release-bundle-test.sh` | `bash tests/release-bundle-test.sh` |
| 3 | CI·제품 로드맵·운영 문서 정합성 반영 | AC-1~8 | `.github/workflows/ci-gate.yml`, `docs/` | 전체 quality gate |

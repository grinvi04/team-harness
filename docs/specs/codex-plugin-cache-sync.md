# Codex plugin cache 조건부 동기화 스펙

## 1. 목표 & Why

CLI launcher가 최신 team-harness source와 오래된 Codex plugin cache의 버전 드리프트를 자동으로 해소한다.
**성공 기준: source manifest가 cache보다 새로울 때만 공식 Codex marketplace upgrade·plugin add를 실행하고,
동기화된 cache를 patch한 뒤 Codex를 시작한다.**

## 2. Scope

- **In:** 설치 버전 조회, semver 비교, team-harness marketplace/plugin 조건부 갱신, launcher 배선과 회귀 테스트.
- **Out:** 다른 marketplace/plugin 자동 갱신, Codex CLI 자체 업데이트, Desktop App 시작 자동화.

## 3. 기능 요구사항 + 수용기준

- **AC-1 (최신):** WHEN 설치된 `harness-guard` 버전이 source manifest 이상이면 THEN 네트워크 갱신 명령을
  실행하지 않고 기존 cache patch 단계로 진행한다.
- **AC-2 (드리프트):** WHEN source manifest가 설치 버전보다 새로우면 THEN
  `codex plugin marketplace upgrade team-harness --json` 후
  `codex plugin add harness-guard@team-harness --json`을 순서대로 실행한다.
- **AC-3 (검증):** WHEN 재설치가 끝나면 THEN 결과 버전이 source manifest 이상인지 다시 검증하고 patch를 진행한다.
- **AC-4 (실패):** IF 조회·upgrade·add·버전 검증 중 하나가 실패하면 THEN Codex 본체를 실행하지 않는다.
- **AC-5 (격리):** WHEN 동기화할 때 THEN `team-harness` 외 marketplace/plugin은 변경하지 않는다.

## 4. 제약 / 비기능

- 버전 비교는 문자열이 아니라 숫자 semver segment로 수행한다.
- 기본 `approval_policy = "untrusted"`와 Claude source/cache는 변경하지 않는다.

## 5. 경계 / Do-Not

- ✅ 해도 됨: 공식 `codex plugin` CLI로 team-harness만 갱신.
- ⚠️ 먼저 물어봐: 모든 marketplace 일괄 갱신, offline fallback으로 stale cache 실행.
- 🚫 절대 금지: plugin config 직접 위조, hook trust 우회, 갱신 실패 후 Codex 실행.

## 6. Open Questions

없음.

## 7. 기술 접근

- Node helper가 source manifest와 `codex plugin list --json`을 구조적으로 파싱한다.
- source가 더 새로울 때만 두 공식 CLI 명령을 순차 실행하고 결과 JSON의 버전을 검증한다.
- launcher는 동기화 helper 성공 후에만 기존 두 cache patch와 Codex exec를 수행한다.
- fake Codex CLI fixture로 최신/no-network, 드리프트/순서, 실패/fail-closed를 검증한다.

## 8. 태스크

| # | 태스크 | AC | 대상 | 검증 | 의존 |
|---|---|---|---|---|---|
| 1 | 조건부 동기화 RED fixture | AC-1~5 | `tests/codex-plugin-cache-sync-test.sh` | 전용 테스트 RED | - |
| 2 | 구조적 버전 동기화 helper | AC-1~5 | `scripts/sync-codex-plugin-cache.mjs` | 전용 테스트 GREEN | #1 |
| 3 | launcher fail-closed 배선 | AC-2~4 | launcher test/script | launcher 회귀 GREEN | #2 |
| 4 | 문서·CI·버전 갱신 | AC-1~5 | docs, workflow, manifest | 전체 CI GREEN | #3 |

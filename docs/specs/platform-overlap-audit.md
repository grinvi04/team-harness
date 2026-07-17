# 플랫폼 중복 감사 스펙

## 1. 목표 & Why

Team Harness의 현재 skill·hook·agent·Codex 호환 실행 파일을 전수 조사해 **소유·연결·위임** 중 하나로
분류하고, 플랫폼 기능을 장기 복제하는 부분의 축소 순서를 정본으로 남긴다. **성공 기준: 현재 구현 표면이
누락 없이 한 번씩 분류되고, 유지·축소·제거 판단의 근거와 선후관계가 재현 가능하며, 이후 파일이 추가되면
CI가 감사 드리프트를 검출한다.**

제품 방향 판정은 **소유**다. 개별 실행 엔진은 플랫폼에 위임할 수 있지만, Team Harness가 책임질
GitHub 정책·증거·감사 경계를 정하고 검증하는 일은 하네스의 핵심 책임이다.

## 2. Scope

- **In:** `plugins/harness-guard/skills/*/SKILL.md` 16개, Claude-facing agent 2개, Codex agent 정의 3개,
  `hooks.json` handler 4개, Codex 호환 실행 파일 9개의 전수 분류, 유지·축소·제거 우선순위, README·제품
  로드맵·결정 기록 연결, 감사 인벤토리 CI 계약.
- **Out:** 이번 작업에서 skill·hook·agent·Codex runtime 동작을 변경하거나 제거하기, 소비 repo 수정,
  공식 플랫폼 기능을 새로 구현하기, 일반 자연어 의미 분류기 추가, 플러그인 버전 변경.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (전수성):** WHEN 저장소의 현재 구현 표면을 스캔하면 THEN 16개 skill, agent 정의 5개, hook handler
  4개, Codex 호환 실행 파일 9개가 감사 보고서에 각각 정확히 한 번 나타나야 한다.
- **AC-2 (단일 판정):** WHEN 각 항목을 읽으면 THEN `소유`, `연결`, `위임` 중 정확히 하나의 현재 판정과
  목표 상태, 근거, 후속 조치를 확인할 수 있어야 한다.
- **AC-3 (native-first):** WHEN 플랫폼이 공식 skill loading·hooks·multi-agent·managed requirements·plugin
  표면을 제공하면 THEN Team Harness는 결과 계약과 GitHub 게이트만 소유하고, 내부 cache·snapshot mutation은
  영구 API로 간주하지 않으며 제거 후보로 분류해야 한다.
- **AC-4 (고유 책임 보존):** WHEN GitHub policy, CI evidence, PR/release gate, drift, 복구 계약을 검토하면 THEN
  플랫폼에 통째로 위임하지 않고 소유 또는 얇은 연결 계층으로 유지해야 한다.
- **AC-5 (라우팅 경계):** WHEN `route-intent.mjs`를 판정하면 THEN 현재 Git/PR 상태 기반 다음 단계 연결로만
  유지하고 일반 단어 substring이나 LLM 의미 분류기로 확장하지 않아야 한다.
- **AC-6 (실행 순서):** WHEN 제거 후보를 정리하면 THEN 공식 surface 검증 → 결과 동등성 테스트 → 문서·doctor
  전환 → 호환 patch 제거 순서를 명시해 보호 공백과 일괄 제거를 피해야 한다.
- **AC-7 (발견성):** WHEN README나 제품 로드맵을 읽으면 THEN 감사 정본 링크와 로드맵 2번 완료 상태를
  확인할 수 있어야 하고, 결정 기록은 이 스펙과 보고서를 가리켜야 한다.

## 4. 테스트 시나리오

- **정상:** 네 구현 범주의 실제 파일 집합과 보고서 식별자가 정확히 같고 모든 행이 허용된 단일 판정을 가지면
  통과한다.
- **예외:** 구현 파일을 추가·삭제했는데 보고서를 갱신하지 않거나, 한 항목이 두 판정을 갖거나, 필수 링크·전환
  순서가 빠지면 실패한다.
- **경계:** 문서·테스트·spec 파일명에 `codex`가 포함돼도 실행 호환 계층 인벤토리에는 넣지 않는다. Codex agent
  TOML은 agent 인벤토리에 넣고 Codex 호환 파일 집합과 중복 계산하지 않는다.

## 5. 제약 / 비기능

- 현재 원본과 로컬 Codex CLI의 read-only 출력만 근거로 삼고, 변하기 쉬운 플랫폼 내부 구현을 확정적으로
  일반화하지 않는다.
- 보고서는 항목별 결정을 짧게 유지하되 파일 집합과 후속 조치가 기계적으로 검증 가능해야 한다.
- 문서·CI 계약만 변경하므로 harness-guard 버전은 0.58.0을 유지한다.

## 6. 경계 / Do-Not

- ✅ 해도 됨: 구현·호출자·테스트를 읽고 전수 분류, 목표 구조와 단계별 백로그 기록, 문서 링크 추가.
- ⚠️ 먼저 물어봐: 실제 호환 patch·hook·skill 제거, 소비 repo 설치 경로 변경, 공식 surface 전환 배포.
- 🚫 절대 금지: 검증 없이 호환 계층 일괄 삭제, server-backed gate 약화, 일반 키워드 의미 라우팅 재도입.

## 7. 기술 접근 (HOW)

- 파일 시스템과 `hooks.json`에서 네 인벤토리를 동적으로 추출하고 보고서의 안정 식별자와 집합 비교한다.
- 판정은 `docs/product-direction.md`의 신규 기능 판단 게이트를 적용한다. 플랫폼 실행 메커니즘은 위임하고,
  GitHub policy/evidence/audit 결과는 소유하며, 둘 사이의 최소 변환만 연결로 남긴다.
- 로컬 `codex --version`, `codex features list`, `codex plugin --help`로 현재 공식 표면을 확인하되 버전별 출력은
  감사 시점의 증거로만 기록한다.
- `tests/platform-overlap-audit-test.sh`가 인벤토리 완전성·단일 판정·문서 연결·핵심 전환 결정을 CI에서 고정한다.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(exit 0) | 의존 |
|---|---|---|---|---|---|
| 1 | 전수 인벤토리·판정 계약 RED 작성 및 CI 등록 | AC-1~7 | `tests/platform-overlap-audit-test.sh`, `.github/workflows/ci-gate.yml` | 보고서 누락으로 전용 테스트 실패 | — |
| 2 | 감사 보고서와 유지·축소·제거 순서 작성 | AC-1~6 | `docs/platform-overlap-audit.md` | 전용 테스트 GREEN | #1 |
| 3 | 제품 로드맵·README·결정 기록 연결 | AC-7 | `docs/product-direction.md`, `README.md`, `docs/decisions.md` | 전용 테스트 GREEN | #2 |
| 4 | 반증·전체 품질 검증·커밋 | AC-1~7 | 변경 전체 | 전체 CI quality 재현 + `git diff --check` | #1~3 |

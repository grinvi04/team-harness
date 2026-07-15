# 대표 디버깅·완료 검증 스킬 스펙

## 1. 목표 & Why

team-harness의 분산된 진단·검증 원칙을 개발자가 이름만으로 기억하고 추천할 수 있는 두 개의 대표 스킬로 제공한다.
**성공 기준(측정 가능): `systematic-debugging`과 `verification-before-completion`이 Claude Code와 Codex에서 발견되고, 원인 미확정 수정과 증거 없는 완료 선언을 각각 차단하는 실행 계약과 회귀 테스트를 갖는다.**

## 2. Scope

- **In:** 두 신규 스킬의 실행 계약·Codex UI metadata, Codex overlay, 발견성·의미 계약 테스트, Codex parity·cache patch 회귀, 개발자 문서·소개 페이지·결정 기록, 플러그인 버전 갱신.
- **Out (Non-goals):** Superpowers 코드·문서 복제, 기존 `feature-add`·`feature-modify`·`loop` 동작 변경, 키워드 기반 intent router 자동 호출, 신규 런타임 스크립트·에이전트, 외부 marketplace 설정 변경.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (디버깅 진입):** WHEN 사용자가 실패 테스트·CI·빌드·런타임 오동작·간헐 오류의 원인 분석이나 수정을 요청하면, the system SHALL `systematic-debugging`을 선택할 수 있도록 구체적인 trigger를 metadata에 제공한다.
- **AC-2 (원인 확정):** WHEN `systematic-debugging`이 실행되면, the system SHALL 기대값과 실제값, 재현 절차, 관찰 사실, 최대 3개의 우선순위 가설과 각 판별 실험을 기록하고 인과 메커니즘이 증거로 확인되기 전에는 수정하지 않는다.
- **AC-3 (수정 계약):** IF 사용자가 원인 분석뿐 아니라 수정을 요청하고 근본 원인이 확인되면, THEN the system SHALL 공개 동작을 재현하는 자동 회귀 테스트 또는 CI·설정 장애를 재현하는 가장 작은 실행 가능 검사의 RED를 먼저 확인하고 최소 수정으로 GREEN과 전체 회귀 검증을 달성한다. IF 원인을 확인하지 못하면 THEN 추측 수정 없이 미확정 상태와 다음 증거를 보고한다.
- **AC-4 (완료 검증 진입):** WHEN 사용자가 확인·검증·재확인을 요청하거나 AI가 완료·해결·통과·PR 준비·머지 준비·릴리즈 준비를 주장하려 하면, the system SHALL `verification-before-completion`을 선택할 수 있도록 구체적인 trigger를 metadata에 제공한다.
- **AC-5 (신선한 증거):** WHEN `verification-before-completion`이 실행되면, the system SHALL 주장별 관찰 가능한 증거를 매핑하고 현재 작업트리와, 변경이 커밋됐다면 정확한 HEAD SHA에서 적용 가능한 대상 테스트·전체 품질·diff·git 상태·배포 상태를 새로 확인한다. CI·배포 증거는 대상 SHA가 HEAD와 일치하는지 대조하고, 실행 명령·종료 코드·결과 및 적용 불가해 건너뛴 항목과 이유를 보고한다.
- **AC-6 (fail-closed):** IF 필수 검증이 실패하거나 실행되지 않았거나 현재 변경을 증명하지 못하면, THEN the system SHALL 완료로 판정하지 않고 실패·미확인으로 보고한다. 호출한 상위 workflow가 있으면 그 workflow로 되돌리고, 직접 호출이면 파일을 수정하지 않고 보고 후 중단한다. IF 검증이 운영 상태 변경이나 범위 밖 권한을 요구하면, THEN 실행하지 않고 별도 사람 확인이 필요한 한계로 보고한다.
- **AC-7 (역할 경계):** WHEN `verification-before-completion`이 verifier를 사용하면, the system SHALL 완료 게이트와 최종 판정을 현재 호출 workflow가 소유하고 verifier는 선택적인 독립 증거 수집·반증만 수행하도록 구분한다. verifier는 수정·커밋·머지하거나 완료를 대신 선언하지 않는다.
- **AC-8 (도구 parity):** WHEN 두 스킬이 Codex cache에 설치되면, the system SHALL 대응 overlay를 정확히 한 번 주입하고 Claude 전용 실행 metadata를 Codex 실행 의미로 정규화하며 전체 스킬 수를 하드코딩하지 않고 전수 매핑한다.
- **AC-9 (발견·문서·버전):** WHEN 플러그인 v0.56.0이 배포되면, the system SHALL 두 스킬을 포함한 16개 스킬을 README, 개발자 워크플로, 소개 페이지에서 일관되게 안내하고 plugin manifest와 README badge가 같은 버전을 표시한다.

## 4. 제약 / 비기능

- 각 `SKILL.md`는 500줄 미만이며 핵심 절차만 포함한다.
- 진단 전용 요청에서는 파일을 수정하지 않는다. 검증 스킬은 검증 결과를 고치거나 머지하는 권한을 스스로 확장하지 않는다.
- 검증은 읽기·테스트·빌드·상태 조회처럼 안전한 증거 수집만 수행한다. 운영 DB·인프라 변경이나 destructive probe는 완료 증거로 사용하지 않는다.
- 테스트·문서의 의미 계약은 Claude Code와 Codex의 UI 차이와 무관하게 같은 관찰 결과를 요구한다.

## 5. 경계 / Do-Not (3단계)

- ✅ 해도 됨: 기존 verifier·`feature-modify`·AGENTS 검증 명령을 재사용하고, 두 대표 스킬의 역할 경계를 문서화하며, 스킬 전수 테스트를 동적으로 만든다.
- ⚠️ 먼저 물어봐: intent router 자동 호출, 기존 스킬의 단계 변경, 신규 에이전트·스크립트 추가, 다른 소비 repo에 직접 전파.
- 🚫 절대 금지: 재현·원인 증거 없이 수정, 실패한 검증을 성공으로 표현, 테스트 삭제·약화·skip으로 통과, marketplace 파일 수동 편집, Superpowers 문구의 장문 복제.

## 6. Open Questions

없음.

## 7. 기술 접근 (HOW)

- `skill-creator`의 workflow-first 구조로 두 스킬과 `agents/openai.yaml`을 초기화하되, team-harness의 공용 Claude source + Codex overlay 실행 의미 격리 구조를 유지한다. 별도 script/reference/asset은 만들지 않는다.
- `systematic-debugging`은 진단 전용과 수정 포함 모드를 분리한다. 원인 확정 후 수정은 새 절차를 복제하지 않고 `feature-modify`의 RED→GREEN·전체 품질 계약으로 핸드오프한다. 보호 브랜치의 깨끗한 작업트리에서만 새 `fix/*` 브랜치를 만들고, 이미 작업 브랜치이면 유지하며, 관련 없는 미커밋 변경이 있으면 전환·커밋하지 않고 중단해 범위를 확인한다.
- `verification-before-completion`은 주장→증거 표, 신선도, 반증, 보고 순서의 읽기 중심 게이트로 만든다. 호출 workflow가 최종 판정을 소유하고 verifier는 선택적인 독립 증거 제공자일 뿐이다. 실패 시 직접 범위를 넓혀 수정하지 않으며, 상위 workflow가 있으면 되돌리고 직접 호출이면 보고 후 중단한다.
- 신규 `tests/flagship-skills-test.sh`가 metadata trigger, 핵심 fail-closed 문구, 역할 경계, 문서·버전 일치를 검사한다. `.github/workflows/ci-gate.yml`에 구문 검사와 실행 단계를 연결한다.
- `codex-skill-mapping-test.sh`와 cache patch overlay 개수 단언을 디렉터리 전수 기반으로 바꿔 이후 스킬 추가 시 수동 숫자 드리프트를 막는다. Codex parity matrix와 Claude source hash manifest에 신규 surface를 등록한다.
- 영향 파일: `plugins/harness-guard/skills/{systematic-debugging,verification-before-completion}/`의 `SKILL.md`·`agents/openai.yaml`, `plugins/harness-guard/codex/skill-overlays/`, `tests/`, `.github/workflows/ci-gate.yml`, `docs/specs/codex-guard-compatibility.md`, `README.md`, `docs/developer-workflow.md`, `docs/intro.html`, `docs/decisions.md`, `plugins/harness-guard/.claude-plugin/plugin.json`.

### 테스트 전략

- AC-1~AC-7: `bash tests/flagship-skills-test.sh`로 두 skill metadata·핵심 실행 계약·fail-closed·verifier 역할 경계를 검사한다.
- AC-8: `bash tests/codex-skill-mapping-test.sh`, `bash tests/codex-harness-guard-patch-test.sh`, `bash tests/codex-semantic-parity-test.sh`, `bash tests/claude-surface-isolation-test.sh`로 전수 overlay·격리를 검사한다.
- AC-9: flagship test의 문서 count·버전 단언과 JSON 유효성 검사, 전체 CI quality 명령으로 확인한다.
- 구현 후 각 폴더에 `skill-creator` quick validation을 실행하고 `agents/openai.yaml`이 skill 이름·default prompt와 일치하는지 의미 계약 테스트로 확인한다.
- 실제 사용 프롬프트로 독립 forward-test를 수행한다. 시나리오 D는 `/tmp`의 실패 fixture를 “진단만” 요청하고 전후 checksum·git 상태가 같으며 재현·가설·판별 증거·원인을 보고해야 통과한다. 시나리오 V는 실패하는 검증 fixture를 “완료 확인” 요청하고 전후 상태가 같으며 실패 명령·exit code·미완료 판정을 보고해야 통과한다. 결과 문구를 테스트에 하드코딩하지 않고 독립 agent의 원문 결과와 전후 상태 증거를 검토한다.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(이 명령 exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | `systematic-debugging` 의미 계약 테스트를 RED로 만든 뒤 skill·UI metadata·Codex overlay를 구현 | AC-1, AC-2, AC-3, AC-8 | `tests/flagship-skills-test.sh`, `plugins/harness-guard/skills/systematic-debugging/`, `plugins/harness-guard/codex/skill-overlays/systematic-debugging.md` | `bash tests/flagship-skills-test.sh` | — | |
| 2 | `verification-before-completion` 의미 계약을 RED로 확장한 뒤 skill·UI metadata·Codex overlay를 구현 | AC-4, AC-5, AC-6, AC-7, AC-8 | 같은 테스트, `plugins/harness-guard/skills/verification-before-completion/`, 대응 overlay | `bash tests/flagship-skills-test.sh` | #1 | |
| 3 | Codex 전수 매핑·cache patch·Claude source 격리 계약을 16개 surface에 맞게 강화 | AC-8 | `tests/codex-skill-mapping-test.sh`, `tests/codex-harness-guard-patch-test.sh`, `tests/fixtures/claude-surface.sha256`, `docs/specs/codex-guard-compatibility.md` | `bash tests/codex-skill-mapping-test.sh && bash tests/codex-harness-guard-patch-test.sh && bash tests/codex-semantic-parity-test.sh && bash tests/claude-surface-isolation-test.sh` | #1, #2 | |
| 4 | README·개발자 가이드·소개·결정·CI·v0.56.0을 갱신 | AC-9 | `README.md`, `docs/developer-workflow.md`, `docs/intro.html`, `docs/decisions.md`, `.github/workflows/ci-gate.yml`, plugin manifest | `bash -n tests/flagship-skills-test.sh && bash tests/flagship-skills-test.sh && git diff --check && python3 -m json.tool plugins/harness-guard/.claude-plugin/plugin.json >/dev/null` | #3 | |
| 5 | 전체 품질·플러그인 설치본·두 forward-test를 검증하고 PR·릴리즈 흐름으로 인계 | AC-1~AC-9 | 변경 전체 | `for t in tests/*-test.sh; do bash "$t" || exit 1; done && bash scripts/codex-hardened.sh --version && bash scripts/harness-doctor.sh --repo .` + 시나리오 D·V 전후 상태·결과 검토 | #4 | |

롤백은 태스크별 원자 커밋으로 한다. #1~#4는 뒤 태스크가 앞 surface에 의존하므로 문제 발견 시 기본적으로 fix-forward하고, 독립 문서 오류만 해당 커밋 단독 revert를 고려한다.

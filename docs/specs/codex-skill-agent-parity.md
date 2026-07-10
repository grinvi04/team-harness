# Codex 스킬·에이전트 parity 스펙

Issue: #276

## 1. 목표

Claude Code 전용으로 작성된 `harness-guard` 스킬과 named agent가 Codex에서도 같은 워크플로 결과를 낸다.
Claude Code의 hook, agent frontmatter, 모델 선택, 원본 스킬 동작은 변경하지 않는다.

## 2. 범위

- 14개 `skills/*/SKILL.md`를 Codex 실행 기준으로 분류하고, Claude 전용 명령·모델 이름을 Codex-native
  instruction으로 명시한다.
- Codex가 발견하는 namespaced custom agent 세 개를 cache patch 단계에서 `~/.codex/agents/`에 설치한다.
- `security-reviewer`와 `verifier`의 Claude agent 파일은 보존하고, Codex에는 별도 TOML 역할을 쓴다.
- Codex plan/goal/review/subagent surface를 현재 CLI 기준으로 문서화한다.

## 3. 모델·권한 매핑

| Codex 역할 | 용도 | 모델/추론 | sandbox | 쓰기 |
|---|---|---|---|---|
| `harness-explorer` | 코드베이스 탐색, QA 체크리스트, 근거 수집 | `gpt-5.6-terra`, `medium` | `read-only` | 금지 |
| `harness-verifier` | 설계·회귀·테스트 누락 재검토 | `gpt-5.6-terra`, `medium` | `read-only` | 금지 |
| `harness-security-reviewer` | 릴리즈/PR 보안 검토 | `gpt-5.6-terra`, `medium` | `read-only` | 금지 |

현재 Codex Plus plan에서 확인된 `gpt-5.6-terra`와 `medium` reasoning을 사용한다. high 요청은 실행 시
medium으로 내려가므로 존재하지 않는 tier를 선언하지 않는다. 역할은 모델 이름이 아니라 read-only 권한과
전문화된 지시로 나눈다. 계정별 전역 model/approval/sandbox 설정을 플러그인이 덮어쓰지 않는다. 구현·테스트·커밋은 주 Codex agent가
순차 실행한다. 병렬 subagent는 읽기 전용 독립 작업에만 사용한다.

## 4. 수용 기준

- **AC-1 (전수 분류):** 모든 harness skill·agent·wrapper가 compatibility matrix에서 `공통`, `Codex-native`,
  `운영 통제` 중 하나와 검증 근거를 가진다. `미검증` 상태가 남지 않는다.
- **AC-2 (스킬 의미):** Codex에서 plan, goal, review, subagent, loop을 요청할 때 Claude 전용 tool 문자열을
  실행 대상으로 취급하지 않고 동일한 승인·TDD·CI·PR 게이트 결과를 만든다.
- **AC-3 (agent):** patcher가 세 Codex custom agent를 설치하고, 각 TOML은 유효하며 모델·추론·read-only
  권한을 가진다. Claude agent 파일은 diff가 없다.
- **AC-4 (안전한 병렬화):** 스킬은 구현을 병렬 write agent에 위임하지 않고, 탐색·검증만 독립 subagent로
  위임한다.
- **AC-5 (회귀):** cache patcher·skill mapping·semantic parity 테스트가 Codex agent 설치와 전수 매핑을
  검증한다.
- **AC-6 (실측):** fresh Codex session에서 custom agent discovery와 read-only verifier/security workflow를
  실행해 결과를 compatibility matrix에 기록한다.

## 5. Do-Not

- Claude Code의 `plugins/harness-guard/agents/*.md`, hooks, model enforcement hook을 수정하지 않는다.
- 사용자의 `~/.codex/config.toml` 기본 model/approval/sandbox를 바꾸지 않는다.
- Codex custom agent가 구현 파일을 수정하거나 main/develop을 직접 변경하게 하지 않는다.
- 모델이 없을 때 Claude 모델 이름이나 임의의 대체 모델을 하드코딩하지 않는다.

## 6. 작업 순서

| # | 작업 | AC | 검증 |
|---|---|---|---|
| 1 | Codex agent TOML bundle·cache 설치 구현과 TDD | 3, 5 | `bash tests/codex-harness-guard-patch-test.sh` |
| 2 | 모든 스킬의 Codex 실행 지시 정규화 | 1, 2, 4 | `bash tests/codex-skill-mapping-test.sh` |
| 3 | compatibility matrix를 완료 상태로 갱신 | 1, 2 | `bash tests/codex-semantic-parity-test.sh` |
| 4 | fresh session discovery·read-only reviewer probe | 6 | probe transcript + matrix evidence |
| 5 | 전량 회귀와 Claude source 불변 확인 | 3, 5 | CI quality 명령 |

## 7. 승인 게이트

이 변경은 plugin behavior와 설치 절차를 바꾸므로 version bump와 README 갱신이 필요하다. Codex cache의
새 hook/agent 파일은 사용자가 `/hooks`에서 review/trust한다.

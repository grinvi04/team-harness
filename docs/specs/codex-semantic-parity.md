# Codex semantic parity 스펙

## 1. 목표 & Why

`harness-guard`가 Claude Code에서 제공하는 거버넌스와 보안 워크플로의 **의미**를 Codex에서도 유지한다.
문법·UI·훅 payload가 다른 것을 같은 것으로 가장하지 않고, Codex-native 구현 또는 명시된 운영 통제로
동일한 보호 결과를 낸다. Codex가 필요한 lifecycle event를 제공하지 않는 경우에는 동등성을 주장하지 않고
명시된 운영 통제로 분류한다. **성공 기준: 각 harness 기능이 Claude와 Codex에서 동일한 수용기준을 충족하거나,
동일 결과를 내는 Codex 대체 구현 또는 검증된 플랫폼 제한과 운영 통제를 가진다.**

## 2. Scope

- **In:** `harness-guard`의 hooks, skills, agents, PR wrappers, 설치/캐시 절차, Codex 설정 안내를 기능별로
  조사하고 호환성 매트릭스를 정본으로 만든다.
- **In:** Codex가 지원하지 않는 Claude `prompt` hook, `Agent` matcher/model tiering, Claude-specific hook
  stdout/async contracts에 대해 Codex 대체 경로를 설계·구현·실측한다.
- **In:** `security-guidance@claude-plugins-official`을 Codex에서 비활성화하지 않고, adapter와 Codex-native
  보안 경계를 조합해 security guidance 의미를 유지한다.
- **In:** Codex cache refresh 후에도 재현 가능한 설치/패치/신뢰 절차와 회귀 테스트를 만든다.
- **Out (Non-goals):** Claude와 Codex의 hook JSON, slash-command UI, agent model 이름, async wakeup UX를
  바이트 단위로 동일하게 만들기.
- **Out (Non-goals):** Claude 전역 설정·원본 plugin을 Codex 편의를 위해 약화하거나 변경하기.
- **Out (Non-goals):** CI/branch protection으로 이미 강제되는 정책을 Codex regex hook으로 중복 강제한다고
  주장하기.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (coverage):** WHEN parity audit가 끝날 때, the system SHALL `harness-guard`의 모든 hook, skill,
  agent, wrapper를 `공통`, `Codex-native 대체`, `Codex 미지원+운영 통제` 중 하나로 분류하고 근거와 검증 명령을
  매트릭스에 기록한다.
- **AC-2 (command guard):** WHEN Codex가 Bash 도구로 direct reset, protected-branch commit, test/migration
  삭제, bare `gh pr create/merge`를 실행할 때, the system SHALL Claude와 같은 deny 결과를 낸다. Shell wrapper
  안의 compound command는 별도 adversarial fixture로 다루고 Codex sandbox/approval이 최종 경계임을 검증한다.
- **AC-3 (secret egress):** WHEN Codex가 `PreToolUse`를 발생시키는 simple Bash 호출에서 명백한 시크릿 외부
  전송 명령이 실행될 때, the system SHALL Claude `prompt` hook의 목적과 동등한 deny를 적용한다. `unified_exec`
  같이 event를 발생시키지 않는 경로는 전역 `approval_policy = "untrusted"`의 사람 승인 경계로 운영하며,
  Codex-native deterministic equivalent라고 주장하지 않는다(#283). 단순 `.env` 읽기, 로컬 git, 비네트워크
  파괴 명령은 이 경로에서 deny하지 않는다.
- **AC-4 (security guidance):** WHEN `security-guidance` PostToolUse 또는 Stop hook이 Codex에서 실행될 때,
  the system SHALL invalid hook JSON 오류 없이 guidance/block 결과를 전달한다. Claude `asyncRewake` UX가
  지원되지 않는 경우, 동일 보안 판단을 동기 Codex contract로 전달한다.
- **AC-5 (workflow skills):** WHEN Codex 사용자가 plan, feature, PR, merge, release workflow를 요청할 때,
  the system SHALL 동일한 spec-first, TDD, wrapper, CI/review gate 결과를 따르며 Claude-only tool 문법은
  Codex에서 실행 가능한 지시로 대체한다.
- **AC-6 (agents):** WHEN Codex에서 verifier 또는 security review가 요구될 때, the system SHALL Claude
  Agent matcher/model frontmatter에 의존하지 않고 Codex의 실행 surface 또는 Codex Security로 읽기 전용 검토를
  수행한다. 모델 tier 강제 불가/상이한 부분은 허위 강제가 아닌 문서화된 운영 정책으로 남긴다.
- **AC-7 (installation):** WHEN Codex plugin cache가 갱신될 때, the system SHALL unsupported handler 제거,
  hook command patch, hook hash review/trust 절차를 재현 가능하게 수행하고 Claude cache/source는 변경하지
  않는다.
- **AC-8 (regression):** IF Codex 전용 패치가 command guard, route intent, 또는 security-guidance command를
  제거·변경하려 하면 THEN CI SHALL fail한다. 이는 event가 발생하는 Codex 경로의 회귀만 검증하며,
  `unified_exec` runtime enforcement를 증명하지 않는다.

## 4. 제약 / 비기능

- Codex 실제 세션의 fresh-session probe가 없는 호환성 주장은 하지 않는다.
- 최종 보안 통제선은 server-side branch protection/CI와 Codex sandbox·approval이다. Hook은 보조 통제다.
- `unified_exec` 보완을 위해 `approval_policy = "untrusted"`를 쓰면 모든 비신뢰 명령에 사람이 승인해야 한다.
  이는 사용자 정책 변경이며, 시크릿 전송만을 자동 차단하는 hook과 동등하지 않다.
- Codex 호환 변경은 Claude source runtime의 동작과 cache를 바꾸지 않는다.

## 5. 경계 / Do-Not

- ✅ 해도 됨: Codex 전용 adapter, command hook, skill 문서 변형, cache patch와 이를 검증하는 테스트를 추가한다.
- ⚠️ 먼저 물어봐: Codex plugin을 별도 배포 단위로 분리, global Codex sandbox/approval 기본값 변경, security
  plugin 설치/권한 부여.
- 🚫 절대 금지: `security-guidance`를 오류 회피만을 위해 최종적으로 disable, Claude 원본 hook 삭제/약화,
  CI·branch protection 우회.

## 6. Open Questions

`unified_exec`의 불완전한 PreToolUse interception(#283)이 현재 open이다. Codex upstream이 이 경로를
intercept하면 fresh-session probe로 AC-3을 재평가한다.

## 7. 기술 접근 (HOW)

- 정본은 `docs/specs/codex-guard-compatibility.md`에 추가하는 parity matrix다. 각 항목은 Claude 구현,
  Codex 경로, 보장 수준, fresh-session evidence, 자동 회귀 테스트를 가진다.
- 공통인 bash guard, route intent, PR wrapper, skill prose는 원본을 공유한다. Claude-only contract는 원본을
  보존하고 Codex adapter/설정으로 분리한다.
- `type: "prompt"` secret-egress guard는 Codex가 PreToolUse를 발생시키는 호출에서만 Codex command hook으로
  대체한다. deny/allow fixtures는 Claude prompt의 좁은 threat model을 그대로 따르되, `unified_exec`에는
  적용되지 않아 `approval_policy = "untrusted"`를 사람 승인 경계로 둔다는 runtime 한계를 matrix와 #283에
  유지한다.
- security guidance는 #264의 범위로 계속 다룬다. `codex-security` 평가는 security-guidance 대체 여부가
  아니라 별도 coverage를 더하는지 판정한다.
- Codex hook contract는 ephemeral fresh session에서 probe한다. cache patch 뒤에는 `/hooks` trust 상태와 실제
  PostToolUse/Stop 실행 결과를 재확인한다.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(이 명령 exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | owned surface 전수 inventory와 parity matrix 작성 | AC-1 | `docs/specs/codex-guard-compatibility.md`, tests | `rg` inventory + matrix completeness test | - | |
| 2 | Codex hook payload/output fresh-session probe와 contract fixture 작성 | AC-3, AC-4, AC-7 | `tests/`, `plugins/harness-guard/scripts/` | probe fixture test | #1 | |
| 3 | secret-egress Codex 대체 guard 구현 및 allow/deny adversarial tests | AC-3, AC-8 | `plugins/harness-guard/scripts/`, `tests/` | dedicated test + `bash tests/guard-matrix-test.sh` | #2 | |
| 4 | Codex workflow skill/agent semantic mapping 구현 | AC-5, AC-6 | `plugins/harness-guard/skills/`, `agents/`, docs | skill discovery + mapping test | #1 | [P] |
| 5 | cache refresh/reinstall + `/hooks` trust runbook과 regression test 완성 | AC-4, AC-7, AC-8 | patch scripts, tests, docs | patch tests + fresh Codex probe | #2-#4 | |
| 6 | #264 Codex Security coverage 평가를 parity matrix에 기록 | AC-4, AC-6 | docs, GitHub issue | fresh session evidence + issue update | #2 | [P] |

## 9. 승인 게이트

이 스펙은 Claude 문법을 삭제하거나 Codex에 거짓 동등성을 선언하지 않는다. 승인 후 `feature/codex-semantic-parity`
브랜치에서 태스크별로 TDD와 원자적 커밋을 수행한다.

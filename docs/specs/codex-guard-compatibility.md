# Codex guard compatibility

Issue: #262

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

현재 로컬 plugin 상태는 Codex native 보안 기능과 Claude plugin 호환 문제를 분리해서 봐야 함을 보여준다.

```text
security-guidance@claude-plugins-official  installed, enabled  2.0.6
harness-guard@team-harness                 installed, enabled  0.35.2
codex-security@openai-curated              not installed
```

Conclusion: Codex에서 보안 리뷰를 원하면 `security-guidance@claude-plugins-official`을 그대로 신뢰하지 말고
Codex Security plugin, Auto-review, sandbox/permissions/rules를 Codex native 경계로 검토해야 한다.
`security-guidance`의 현재 오류는 Codex 기능 부재가 아니라 Claude Code hook/output 계약을 Codex에 그대로 가져온
호환성 문제로 분류한다.

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

Conclusion: Claude-only PostToolUse/Stop hooks should be disabled in Codex or wrapped by a Codex-specific adapter. Do not assume
Claude hook JSON/output is portable. In Codex, `security-guidance@claude-plugins-official` and `codex-security@openai-curated`
are different options with different contracts.

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

- Preserve the `bash -lc "... && rm -rf tests"` finding as a regression fixture or documented unsupported hole.
- Decide whether Codex should load `harness-guard` through plugin `hooks.json`, user config `[hooks]`, or both.
- Map Codex hook payload and block semantics with fresh-session tests before changing `guard.sh`.
- Disable or adapt Claude-only PostToolUse/Stop hooks in Codex.
- Decide whether to install and evaluate `codex-security@openai-curated` for Codex-native security scans/reviews.
- Keep project state, decisions, backlog, and domain knowledge out of tool-local AI memory; record follow-up decisions in
  GitHub Issues, PRs, and `docs/decisions.md`.

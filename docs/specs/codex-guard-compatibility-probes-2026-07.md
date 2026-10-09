# Codex agent·보안·hook probe 이력

[상위 문서](codex-guard-compatibility.md)로 돌아간다. 아래는 원문의 해당 주제·당시 후보 기록을 순서대로 보존한 본문이다.

## Custom Agent Validation Status (historical)

2026-07-10에는 세 agent를 `gpt-5.6-terra`/medium으로 고정했으나 이는 당시 계정 표본을 플러그인 계약으로
일반화한 오류였다. Codex 공식 custom-agent 계약은 생략한 `model`이 부모 session을 상속한다고 명시한다.
2026-07-12부터 model slug를 제거하고 explorer=low, verifier/security=high reasoning만 역할별로 지정한다.
사용자 플랜이 지원하는 실제 model은 부모 `/model` 선택이 결정한다.

quota 복구 뒤 새 저장형 Codex session에서 `harness-verifier`를 명시 spawn해 `AGENTS.md:31`의
main/develop 직접 commit/push 금지 규칙을 read-only로 정확히 반환하는 것을 확인했다. `--ephemeral`은
subagent thread를 만들 수 없어 probe 대상이 아니다. 이 custom agent 복사 방식은 v0.61.0에서 제거됐다.
구조·설치 회귀는 `codex-skill-mapping-test.sh`와 `codex-native-loader-test.sh`가 보장하고 실제 subagent 선택은
플랫폼에 위임한다.

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
~/.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json
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

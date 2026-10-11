# Codex guard compatibility

Issues: #262, #283

## Context

team-harness의 `harness-guard`는 Claude Code 훅·스킬을 1차 대상으로 설계됐다. Codex에서도 같은 repo 규약을
공유하려면 두 범위를 구분해야 한다.

- 공통 작업 계약: `AGENTS.md`, GitHub Issues, branch protection, CI.
- Claude Code 전용 장치: Claude hook payload/output 계약, `asyncRewake`, Claude plugin cache/log path.
- Codex 검토 대상: Codex hooks/config, sandbox/approval/rules, Codex plugin loader가 실제로 실행하는 hook 경로.

## Native Codex Capabilities

[기능 확인 이력](codex-guard-compatibility-native-history.md)은 당시 버전·후보의 결과다. 현행 계약은 아래 Semantic Parity Matrix와 Native Refresh Runbook을 함께 따른다.

## Semantic Parity Matrix

이 표는 `harness-guard`가 소유한 각 surface의 정본이다. `Codex-native 대체`와
`운영 통제`는 Claude 계약을 그대로 실행할 수 없는 경우의 보장 수준을 나타낸다. 플랫폼이 필요한 hook event를
내보내지 않으면 같은 보호 결과를 주장하지 않고 `미지원+운영 통제`로 기록한다.

| 소유 surface | Claude Code 경로 | Codex 경로 | 상태 | 자동 검증 |
|---|---|---|---|---|
| `hooks/hooks.json:PreToolUse:Bash:command` | `guard.sh` | `codex/hooks/hooks.json` command가 공용 guard 호출 | source-native 연결 | `guard-test.sh`, `codex-native-loader-test.sh` |
| `hooks/hooks.json:PreToolUse:Bash:prompt` | LLM secret-egress 판정 | native command hook의 explicit-pattern 검사 | deterministic deny | `codex-secret-egress-guard-test.sh`, native loader test |
| `hooks/hooks.json:PreToolUse:Agent` | `enforce-subagent-model.py` | 플랫폼 native agent 실행 | Codex 구현은 플랫폼에 위임 | `codex-skill-mapping-test.sh` |
| `hooks/hooks.json:UserPromptSubmit` | `route-intent.mjs` | native command hook이 같은 router 호출 | source-native 공통 | `route-intent-test.sh`, native loader test |
| `.codex-plugin/plugin.json` | 해당 없음 | native skill·hook entry point | Codex 공식 loader 계약 | `codex-native-loader-test.sh` |
| `codex/hooks/hooks.json` | 해당 없음 | `PLUGIN_ROOT` 기반 command hook 2개 | Codex 공식 hook 계약 | `codex-native-loader-test.sh` |
| `codex/skills/*.md` | 해당 없음 | 17개 native wrapper가 공용 skill 계약 참조 | cache 변형 없는 skill 연결 | native loader + mapping tests |
| `scripts/codex-security-guidance-adapter.mjs` | Claude security-guidance raw output | Codex-safe output adapter | Codex-native 대체, PostToolUse 실측 | `codex-security-guidance-adapter-test.sh` |
| `scripts/patch-codex-security-guidance.mjs` | 해당 없음 | 별도 승인 `--apply` 또는 읽기 전용 `--dry-run` | deprecated optional compatibility; launcher에서 분리 | adapter patch test |
| `scripts/check-codex-native-plugin.mjs` | 해당 없음 | 설치 source의 manifest·hooks·17 skills read-only 검사 | native 상태 검증 | launcher·doctor tests |
| `scripts/sync-codex-plugin-cache.mjs` | 해당 없음 | source가 더 새로울 때 team-harness marketplace·plugin만 갱신 | Codex-native 설치 절차 | `codex-plugin-cache-sync-test.sh` |
| `scripts/codex-hardened.sh` | 해당 없음 | plugin sync·native 계약 확인 후 인자 그대로 전달 | 얇은 CLI 검증 경로 | launcher + sync tests + fresh probe |
| `scripts/install-codex-managed-requirements.sh` | 해당 없음 | system requirements에 hooks=true만 pin | hook 활성화 통제, exec lifecycle은 native | managed requirements test + surface probes |
| `scripts/pr-create.sh` | skill이 호출 | 같은 wrapper | 공통 | `pr-create-test.sh` |
| `scripts/pr-merge.sh` | skill이 호출 | 같은 wrapper | 공통 | `pr-merge-auto-test.sh` |
| `scripts/solo-merge.sh` | skill이 호출 | 같은 wrapper | 공통 | `solo-merge-test.sh` |
| `skills/ao-coordinate/SKILL.md` | shared coordination contract | native wrapper + scoped low-risk worker, parent integration, independent read-only review | Codex-native mapping; handoff guidance only | `codex-skill-mapping-test.sh`, `orchestration-integration-test.sh` |
| `skills/feature-add/SKILL.md` | slash skill + Claude tool prose | scoped low-risk worker + parent integration + independent read-only verifier | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/feature-merge/SKILL.md` | slash skill + Claude tool prose | `codex review` + same wrapper/GitHub gate | Codex-native mapping | `codex-skill-mapping-test.sh` |
| `skills/feature-modify/SKILL.md` | slash skill + Claude tool prose | scoped low-risk worker + parent integration + independent read-only verifier | Codex-native mapping | `codex-skill-mapping-test.sh` |
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
| `skills/systematic-debugging/SKILL.md` | slash skill + evidence workflow | current-agent diagnosis/fix + optional explorer/verifier read-only roles | Codex-native mapping | `flagship-skills-test.sh`, `codex-skill-mapping-test.sh` |
| `skills/verification-before-completion/SKILL.md` | slash skill + completion gate | current-agent final verdict + optional verifier read-only role | Codex-native mapping | `flagship-skills-test.sh`, `codex-skill-mapping-test.sh` |
| `agents/security-reviewer.md` | Claude named agent 기준 | native agent에 보안 수용기준 전달 | 실행 lifecycle은 플랫폼 위임 | mapping + native loader test |
| `agents/verifier.md` | Claude named agent 기준 | native agent에 반증 수용기준 전달 | 실행 lifecycle은 플랫폼 위임 | mapping + native loader test |

`bash -lc` 등 compound shell은 `guard.sh` 단독으로 완전하게 해석하지 못한다. 이 항목은
Codex sandbox/approval과 server-side CI/branch protection이 최종 통제선이며, 아래 Live Probe의
반증 fixture로 계속 유지한다.

Codex의 대체 command hook은 **Codex가 `PreToolUse`를 실제로 발생시키는 Bash 호출에서**
`curl`/`wget` upload, `nc` pipe, `scp`/`rsync` remote copy에 시크릿 source가 결합한 명백한 전송을 exit 2로
차단한다. LLM prompt와 달리 난독화·새 도구를 의미론적으로 추론하지 않는다. system requirements는
`hooks=true`만 pin하고 unified exec lifecycle은 현재 Codex native hook 구현에 맡긴다. server-side
CI/branch protection은 runtime egress를 대신 차단하지 않는다. 로컬 `.env` 읽기나 일반
네트워크 요청을 이 훅이 차단해서는 안 된다.

Codex CLI runtime은 Claude-style `tool_input.command` 대신 `tool_input.cmd`를 전달할 수 있다. replacement
guard는 hook matcher가 이미 Bash 실행을 한정하므로 tool name을 다시 판정하지 않고 두 필드를 모두 검사한다.
검사 전에 Unix 셸이 실제 제거하는 backslash+LF continuation을 논리행으로 합쳐 direct command와
`sh -lc`/`zsh -lc` exec-shaped wrapper 안의 명백한 upload 패턴을 같은 방식으로 판정한다. 일반 compound
shell을 완전 해석한다는 의미는 아니다. quote 상태와 연속 backslash 홀짝을 추적해 single-quoted literal과
짝수 backslash 뒤 LF, CRLF를 결합하지 않는다. `codex-secret-egress-guard-test.sh`는 Claude-shaped
payload와 Codex exec-shaped payload, direct/nested escaped-newline 및 과차단 반례를 함께 고정한다.
wrapper command position은 shell-word/segment 스캐너로 판정해 선행 assignment·`env`·`exec`를
허용하고 `-c` 뒤 선택적 `--` separator를 건너뛰되, `printf` 등 인자에 나타난 wrapper mention은
실행으로 오인하지 않는다.

## Codex Native Refresh Runbook

일반 plugin 갱신은 Codex 공식 CLI로 **승인된 발행 태그**를 지정한다. 다음은 v0.70.0 태그 발행 후 사용하는 예시다. `/path/to/release-source`는 `marketplace add`가 반환한 `installedRoot`이며, 그 Git commit이 발행 태그와 일치하는지 확인한다. 검사기와 `--trusted-root` 모두 이 원본을 사용한다. 이전 개발 checkout의 검사기는 스킬 목록 등이 다를 수 있으므로 사용하지 않는다.

**기존 source 전환:** `marketplace add`는 같은 이름에 다른 ref·source가 등록돼 있으면 거부한다.
`marketplace upgrade team-harness`는 등록된 ref의 snapshot을 갱신하므로 새 태그 선택을 대신하지 않는다.
먼저 현재 `marketplaces.team-harness`의 source/ref와 plugin 버전·enabled 상태를 기록한다.
승인된 태그가 실제 발행됐고 기존 source와 다른 경우에만 아래로 등록을 제거한 뒤 이어서 새 source를 추가한다.
최초 설치이거나 같은 source/ref라면 제거 단계는 생략한다.

```bash
codex plugin marketplace remove team-harness --json
```

제거 직후 아래 `marketplace add`가 실패하면 기록한 이전 source/ref로 다시 등록하고 기존 설치 상태를 확인한다.
사용자의 개발 checkout이나 plugin cache를 직접 삭제하지 않는다. 모델·역할·다른 marketplace 설정도 보존한다.

```bash
codex plugin marketplace add grinvi04/team-harness --ref v0.70.0 --json
codex plugin add harness-guard@team-harness --json
codex plugin list --json
node /path/to/release-source/scripts/check-codex-native-plugin.mjs --expected-version 0.70.0 --trusted-root /path/to/release-source/plugins/harness-guard
```

1. 현재 설치 버전·enabled·marketplace 원본을 확인한다. 로컬 개발 checkout이 원본이면 그 브랜치를 바꾸지 않고 위 기존 source 전환으로 발행 태그를 지정한다. 다음 태그 갱신도 같은 절차를 따른다.
2. 설치 결과의 버전·enabled, marketplace의 실제 commit과 발행 태그 일치를 확인한다. 필요하면 native 검사에 `--trusted-root`로 해당 태그의 plugin 원본을 지정해 파일 inventory·digest를 비교한다.
3. 새 작업 또는 새 app-server의 `skills/list`로 native skill 발견과 로딩 오류를 확인한다. 이미 열린 대화의 skill 목록이 자동 교체됐다고 가정하지 않는다.
4. 모델·승인·sandbox·역할 설정과 다른 plugin은 보존한다. 머신의 managed requirements 변경은 별도 관리자 작업이며 단순 plugin 갱신에 묶지 않는다.
5. hook 신뢰·실제 차단 검증은 별개다. `/hooks`에서 변경 hash를 검토하고, 필요한 경우에만 승인된 격리 환경의 합성 fixture로 발화를 확인한다. 실제 인증 파일·시크릿을 probe 입력으로 쓰지 않는다. skill 로딩 성공을 hook 발화·권한 집행으로 보고하지 않는다.

`security-guidance` adapter는 native plugin 갱신과 별개다. 현행 launcher는 외부 adapter patch나 enablement를 실행하지 않는다.
외부 cache·marketplace·config 변경이 별도로 승인된 환경에서만 legacy patcher의 `--apply`를 사용한다.
`--dry-run`은 읽기 전용이며 둘 중 정확히 하나가 필요하다. 인자 누락·미지원·중복·충돌은 상태 접근 전에 exit 2다.

### CLI 자동 복구 launcher

`scripts/codex-hardened.sh`는 공식 Harness 등록·동기화와 native 계약·binary trust 검사를 수행한다.
검사 실패 시 Codex를 실행하지 않는다. 이 경로에 외부 `security-guidance` patch·활성화가 묶이지 않는다.
현재 checkout을 갱신한 뒤, zsh에서 다음 alias를 명시적으로 설치할 수 있다.

```zsh
alias codex='bash "$HOME/team-harness/scripts/codex-hardened.sh"'
```

영구 설치는 `.zshrc`에 같은 alias를 넣고 새 shell에서 확인한다. 제거는 그 alias 한 줄만 지운다.
Desktop은 launcher를 실행하지 않으므로 plugin 갱신 뒤 doctor로 native 상태를 별도 확인한다.
이 계약 변경의 로컬 검증은 [3E 실행 근거](https://github.com/grinvi04/team-harness/blob/85338bdcb691727ebd098f4ee0ce5167faf36e24/docs/specs/harness-modernization/execution-m3e.json)를 따른다.
전역 alias·실제 vendor cache 변경과 native app 실행 인수는 별도 단계다.
[이전 mandatory adapter 경로](codex-guard-compatibility-native-history.md)는 아래 역사로 보존하며 현행 명령으로 사용하지 않는다.

## Custom Agent Validation Status (historical)

관련 판단 전에 [전체 본문](codex-guard-compatibility-probes-2026-07.md)을 읽는다.

## Codex Security Evaluation

관련 판단 전에 [전체 본문](codex-guard-compatibility-probes-2026-07.md)을 읽는다.

## Live Probe Results

관련 판단 전에 [전체 본문](codex-guard-compatibility-probes-2026-07.md)을 읽는다.

### Direct destructive commands

관련 판단 전에 [전체 본문](codex-guard-compatibility-probes-2026-07.md)을 읽는다.

### Wrapper prefixes

관련 판단 전에 [전체 본문](codex-guard-compatibility-probes-2026-07.md)을 읽는다.

### Compound shell hole

관련 판단 전에 [전체 본문](codex-guard-compatibility-probes-2026-07.md)을 읽는다.

## Codex Config Hook Probe

관련 판단 전에 [전체 본문](codex-guard-compatibility-probes-2026-07.md)을 읽는다.

## PostToolUse and Stop Hook Mismatch

관련 판단 전에 [전체 본문](codex-guard-compatibility-probes-2026-07.md)을 읽는다.

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

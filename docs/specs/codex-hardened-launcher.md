# Codex hardened launcher 스펙

## 1. 목표 & Why

cmux CLI에서 Codex를 시작하기 전에 조건부 plugin 동기화와 `harness-guard`·`security-guidance` Codex cache patch를 적용한다.
Codex marketplace refresh가 Claude-style hook을 되돌려도 CLI 새 세션은 adapter·skill 정규화를 거친 상태에서
시작한다. 또한 Codex 0.144.1에서 PreToolUse interception이 불완전한 `unified_exec`를 비활성화해 hook이
지원되는 simple shell 경로를 사용한다. **성공 기준: launcher가 두 patch를 성공한 뒤에만 Codex binary를
`--disable unified_exec`와 사용자가 준 인자로 실행한다.**

## 2. Scope

- **In:** `scripts/codex-hardened.sh`, 조건부 plugin 동기화, 실행 순서 회귀 테스트, CLI alias 설치·제거 runbook.
- **Out (Non-goals):** Codex Desktop App 시작 전 patch 보장, `launchd` watcher 설치, Claude source/cache 변경.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (정상):** WHEN launcher가 실행될 때, THEN harness-guard patch와 security-guidance patch가 순서대로
  성공한 뒤 원래 Codex binary가 받은 인자 그대로 실행된다.
- **AC-2 (실패):** IF 어느 patch가 실패하면 THEN Codex binary는 실행되지 않고 launcher는 실패 상태를 반환한다.
- **AC-3 (격리):** WHEN test fixture에서 launcher가 실행될 때, THEN fixture `HOME` 아래 Codex cache만 바뀌며
  source SKILL.md와 Claude cache는 바뀌지 않는다.
- **AC-4 (회귀):** IF Codex binary 실행 순서가 patch보다 앞서거나 security-guidance patch가 빠지면 THEN 테스트가
  실패한다.
- **AC-5 (hook 경로):** WHEN launcher가 Codex binary를 시작하면 THEN `--disable unified_exec`를 주입하고 원래
  사용자 인자는 그 뒤에 보존한다. fresh ephemeral probe에서 simple shell `pwd` 전에 PreToolUse가 발화해야 한다.

## 4. 제약 / 비기능

- launcher는 cmux CLI용이며 Desktop App 직접 실행을 보호하지 않는다.
- 사용자가 alias를 우회해 Codex binary를 직접 실행하거나 Desktop App을 쓰면 unified_exec 비활성화가 적용되지 않는다.
- 트레이드오프: unified_exec의 richer streaming stdin/stdout 처리를 포기하고 PreToolUse 보안 경로를 우선한다.
- alias는 사용자가 명시적으로 설치·제거하는 전역 shell 설정이다.
- 기본 Codex `approval_policy = "untrusted"`는 유지한다.

## 5. 경계 / Do-Not

- ✅ 해도 됨: Codex cache patch 실행, CLI wrapper, 테스트 fixture.
- ⚠️ 먼저 물어봐: `.zshrc` alias 설치, `launchd` daemon, Codex global approval 변경.
- 🚫 절대 금지: hook trust bypass, security-guidance disable, Claude source/cache 수정.

## 6. Open Questions

없음. Desktop App 자동 복구는 명시적 비범위다.

## 7. 기술 접근 (HOW)

- launcher는 자신의 repository root를 기준으로 두 patch script를 Node로 실행한 뒤 `CODEX_BIN`(기본 `codex`)을
  `--disable unified_exec`와 함께 `exec`한다.
- `CODEX_BIN`은 테스트에서 fake binary로 주입해 patch 완료 뒤 실행되는 순서를 검증한다.
- 테스트는 temporary HOME에 raw hooks와 plugin cache fixture를 만들고, fake binary가 실행된 시점의 patched
  artifacts와 전달 인자를 확인한다.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(이 명령 exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | launcher RED fixture와 실행 순서 테스트 | AC-1~4 | `tests/codex-hardened-launcher-test.sh` | dedicated test 실패 | - | |
| 2 | fail-closed launcher 구현 | AC-1~3 | `scripts/codex-hardened.sh` | dedicated test 통과 | #1 | |
| 3 | CLI alias runbook과 version bump | AC-1, AC-4 | docs, manifest, README | full Codex regression | #2 | |

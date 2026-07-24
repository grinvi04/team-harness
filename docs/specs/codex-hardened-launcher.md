# Codex hardened launcher 스펙

## 1. 목표 & Why

cmux CLI에서 Codex를 시작하기 전에 Codex binary provenance를 확정하고 조건부 plugin 동기화와
`harness-guard` native contract·`security-guidance` Codex cache patch를 검증한다.
Codex marketplace refresh가 Claude-style hook을 되돌려도 CLI 새 세션은 adapter·skill 정규화를 거친 상태에서
시작한다. **성공 기준: launcher가 승인된 digest·OpenAI code signature·version을 실행 전에 확인하고,
plugin 동기화·검증을 성공한 뒤에만 같은 binary를 사용자가 준 인자 그대로 실행한다.**

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
- **AC-5 (trust-before-use):** WHEN live launcher가 Codex binary를 사용하면 THEN PATH 후보를 포함해 승인된
  digest·OpenAI code signature를 확인하기 전에는 어떤 Codex 명령도 실행하지 않는다. sync·검증·최종 실행은
  child를 첫 instruction 전에 suspend하고 PID의 OpenAI requirement·CDHash가 static 검증 결과와 일치할 때만
  resume하며, path·digest·device·inode·size identity도 실행 전후 확인한다. live `CODEX_BIN` override는 거부한다.
- **AC-6 (platform evidence):** WHEN PR quality gate를 실행하면 THEN 별도 macOS check가 signed fixture의
  check→spawn 교체 반례를 실제 suspended-spawn 경로에서 실행한다. Ubuntu에서 macOS-only로 skip된 결과만으로
  원자 실행 신뢰를 통과시키지 않는다.

## 4. 제약 / 비기능

- launcher는 cmux CLI용 cache 자동복구, 하위 버전 중복 방어, binary provenance 검증을 담당한다.
- unified exec hook lifecycle은 v0.61.0 native loader 전환 뒤 Codex 공식 surface에 위임한다.
- alias는 사용자가 명시적으로 설치·제거하는 전역 shell 설정이다.
- 기본 Codex `approval_policy = "untrusted"`는 유지한다.

## 5. 경계 / Do-Not

- ✅ 해도 됨: Codex cache patch 실행, CLI wrapper, 테스트 fixture.
- ⚠️ 먼저 물어봐: `.zshrc` alias 설치, `launchd` daemon, Codex global approval 변경.
- 🚫 절대 금지: hook trust bypass, security-guidance disable, Claude source/cache 수정.

## 6. Open Questions

없음. Desktop App 자동 복구는 명시적 비범위다.

## 7. 기술 접근 (HOW)

- launcher는 공용 `codex-binary-trust.mjs`로 canonical binary의 digest·signature·version을 검증하고,
  검증된 절대경로·digest·CDHash를 sync·native 검사에 전달한다. macOS 실행은 suspended child의 동적
  codesign·CDHash를 resume 전에 검증하는 helper를 거쳐 check→spawn TOCTOU를 닫는다.
- Ubuntu 전체 quality job과 별도로 macOS required check가 hardened launcher suite를 실행해 플랫폼 전용
  원자성 계약을 지속 검증한다.
- `CODEX_BIN`은 명시적 fixture mode에서만 fake binary로 주입해 검증 완료 뒤 실행되는 순서를 확인한다.
- 테스트는 temporary HOME에 raw hooks와 plugin cache fixture를 만들고, fake binary가 실행된 시점의 patched
  artifacts와 전달 인자를 확인한다.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(이 명령 exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | launcher RED fixture와 실행 순서 테스트 | AC-1~4 | `tests/codex-hardened-launcher-test.sh` | dedicated test 실패 | - | |
| 2 | fail-closed launcher 구현 | AC-1~3 | `scripts/codex-hardened.sh` | dedicated test 통과 | #1 | |
| 3 | CLI alias runbook과 version bump | AC-1, AC-4 | docs, manifest, README | full Codex regression | #2 | |

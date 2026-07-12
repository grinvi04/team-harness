# Codex managed hook 경로 강제

Issue: #330

## 문제

`codex-hardened.sh --disable unified_exec`는 해당 launcher로 시작한 CLI만 보호한다. 일반 `codex`, cmux의
직접 실행, Codex Desktop은 기본 `unified_exec`를 선택할 수 있어 `PreToolUse` command hook의 동일한 발화를
보장하지 못한다.

## 공식 근거

Codex managed configuration은 Unix/macOS의 `/etc/codex/requirements.toml`을 admin-enforced 요구사항으로
읽는다. `[features]`의 canonical feature를 pin할 수 있고 공식 예시에 `unified_exec = false`가 있다. 충돌하는
일반 config와 CLI override는 요구사항을 이기지 못한다. `hooks = true`도 함께 pin할 수 있다.

## 계약

- system requirements에 `features.unified_exec=false`, `features.hooks=true`를 함께 고정한다.
- 설치·확인·제거는 하나의 versioned script가 담당한다.
- 기존 파일이 Team Harness 소유 marker가 아니면 수정하지 않고 fail-closed한다.
- 설치 전 기존 파일이 없음을 확인하고, 제거는 Team Harness 소유 파일만 삭제한다.
- user config의 approval/sandbox/plugin enabled 값과 Claude source/cache는 변경하지 않는다.
- `codex-hardened.sh`는 cache 자동복구 역할은 유지하되 보안 의미를 launcher flag에 의존하지 않는다.

## 수용 기준

1. installer 단위 테스트가 install/check/idempotence/uninstall/foreign-file 거부를 검증한다.
2. 실제 `/etc/codex/requirements.toml` 설치 후 `configRequirements/read` 또는 동등한 공식 runtime 조회에서
   두 feature pin이 확인된다.
3. `codex --enable unified_exec`와 일반 `codex` 모두 effective unified exec를 사용하지 못한다.
4. hardened CLI, 일반 CLI, cmux CLI, Desktop/app-server fresh session에서 hook lifecycle과 safe deny fixture를
   각각 기록한다.
5. security-guidance와 harness-guard enabled, adapter 9/9, cache zero-drift, Claude hash가 유지된다.

## 롤백

installer `--uninstall`로 marker가 일치하는 system requirements만 제거한다. 기존 외부 requirements는 어떤
경우에도 자동 삭제하거나 덮어쓰지 않는다.

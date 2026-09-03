# Codex split runtime 결과 계약 capability audit

- 판정: **WAIT**
- 제품 방향: **연결**
- 시각: 2026-09-03T04:25:04.283Z
- 증거: live
- Codex: codex-cli 0.144.6
- Codex binary digest: sha256:80a3933d11a9d13ef806aa24f7bb8afc9169cfe4e9b09d6da6a92922cbde9cff
- Team Harness revision: 18d0e178fa9e62092ca6e2783ce3868a871f7777
- Git tree: 5895f2d785dbd82d04ffc53156c98b56237d927a
- 원본: [`codex-split-runtime-v0.61.0.json`](codex-split-runtime-v0.61.0.json)

## 공식 surface 재확인

- [OpenAI의 현재 plugin packaging 문서](https://developers.openai.com/plugins/build/plugins)는 공식 manifest가
  `skills`·`mcpServers`·`apps`·`hooks`를 각 plugin root의 상대 경로로 연결한다고 정의한다.
- hook command에 제공되는 root는 해당 plugin의 `PLUGIN_ROOT`이며 writable state는 `PLUGIN_DATA`다.
- 공식 manifest 필드와 `codex plugin add --help`에는 다른 plugin을 dependency로 선언하거나 그 root를 hook
  runtime에 binding하는 surface가 없다.
- `harness-package.json`의 `dependencies`·`runtimeBindings`는 Team Harness 내부 staged artifact metadata일 뿐,
  Codex가 해석하는 `.codex-plugin/plugin.json` 계약이 아니다.

## 독립 artifact 반증

현재 `develop`의 exact revision으로 split artifact를 다시 조립하고 Codex adapter를 독립 root로 검사했다.

| 확인 항목 | 결과 |
|---|---|
| 공식 root `hooks/hooks.json` | 없음 — 실제 파일은 `codex/hooks/hooks.json`에 staged |
| 공식 root `skills/` | 없음 — 실제 wrapper는 `codex/skills/`에 staged |
| adapter의 `scripts/guard.sh` | 없음 — governance-core 소유 |
| adapter의 `scripts/route-intent.mjs` | 없음 — governance-core 소유 |
| 내부 PreToolUse hook 직접 실행 | exit 127 — adapter root에서 `guard.sh`를 찾지 못함 |
| 내부 UserPromptSubmit hook 직접 실행 | exit 1 — adapter root에서 `route-intent.mjs`를 찾지 못함 |

직접 hook 실행은 native fresh session과 같지 않다. 다만 현재 artifact를 공식 root 규칙대로 로드해도 hook·skill이
노출되지 않고, 내부 hook을 강제로 실행해도 core root를 해석할 수 없다는 두 독립 경계를 확인한다.

## 판정

native dependency 연결 선행조건이 없으므로 fresh-session outcome parity는 실행하지 않았다. adapter에 core 파일을
복제하거나 자체 resolver·cache patch를 추가하면 플랫폼 lifecycle을 다시 소유하게 되므로 구현하지 않는다.

- split package `installable:false` 유지
- 공개 marketplace 승격 보류
- 전환기 monolith 유지
- 사용자 plugin inventory 불변 확인
- 임시 artifact 전량 삭제 확인

## 재검토 조건

아래 중 하나가 공식 문서와 지원 Codex CLI에 함께 나타날 때 이 항목을 다시 연다.

1. plugin manifest의 cross-plugin dependency 선언과 호환 버전 해석
2. dependency plugin root를 hook·skill runtime에 전달하는 공식 binding 또는 동등한 native 연결
3. `codex plugin add`가 dependency 설치 순서·제거 안전성을 보장하는 공식 계약

재검토 시에는 core+adapter를 독립 설치한 새 세션에서 PreToolUse·UserPromptSubmit·skill 결과 동등성을 검증하고,
adapter 제거 후에도 GitHub server-side core enforcement와 사용자 상태가 보존되는지 확인한다.

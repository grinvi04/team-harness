# 실제로 읽은 스킬의 실행 경로

Claude Code와 Codex 모두 플랫폼이 제공한 **현재 읽은 SKILL.md의 절대 경로**를 기준으로 삼는다.
Codex wrapper는 `<root>/codex/skills/<name>/SKILL.md`, 공용 스킬은 `<root>/skills/<name>/SKILL.md`다.
이 구조에서 `<root>`를 구한다. `$HOME/team-harness`, 현재 작업 디렉터리, 최신 버전 검색으로 대체하지 않는다.

스크립트를 실행하는 **각 도구 호출**에서 현재 스킬 경로를 다시 명시하고 아래 검증을 먼저 한다.
예시의 두 경로는 플랫폼에서 실제로 받은 절대 경로로 바꾼다. 이전 도구 호출의 변수가 남는다고 가정하지 않는다.

```bash
HARNESS_SKILL_FILE='<현재 읽은 SKILL.md의 절대 경로>'
HARNESS_PLUGIN_ROOT='<그 SKILL.md가 속한 플러그인의 절대 경로>'
export HARNESS_PLUGIN_ROOT HARNESS_SKILL_FILE
HARNESS_PLUGIN_ROOT="$(node "$HARNESS_PLUGIN_ROOT/scripts/resolve-skill-root.mjs" "$HARNESS_SKILL_FILE")" || exit 1
```

Claude의 `CLAUDE_PLUGIN_ROOT`는 있으면 위 경로와 같은지 검증한다. 다르면 다른 설치본으로 넘어가지 않고 중단한다.
Codex에는 이 변수가 없어도 된다. 대신 현재 제공받은 스킬 경로가 필수다. 누락·상대 경로·다른 설치 경로도 중단한다.
이 검사는 경로 일치 검사다. 외부 파일의 안전성이나 플랫폼의 스킬 로딩 자체를 보장하지 않는다.
검증 뒤에만 `"$HARNESS_PLUGIN_ROOT/scripts/..."`를 실행하며, 검증 실패는 wrapper·Git 변경보다 먼저 보고한다.

분리 staged package는 아직 installable=false다. workflow의 스크립트 연결은 기존 `HARNESS_GOVERNANCE_CORE_ROOT`
runtime binding을 유지하며, 이 단일 플러그인 안내를 분리 package의 설치 완료로 취급하지 않는다.

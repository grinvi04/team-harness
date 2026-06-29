#!/bin/bash
# harness-guard: PreToolUse 공통 가드 (스택 무관 core)
# hooks/hooks.json 에서 ${CLAUDE_PLUGIN_ROOT}/scripts/guard.sh 로 호출된다.
# 스택/프로젝트별 추가 가드는 각 프로젝트의 .claude/settings.json hooks에 별도 추가한다 (플러그인 훅과 공존).
#
# 주의: 이 가드는 Claude Code 사용자만 막는 보조 장치다.
# load-bearing 강제는 GitHub branch protection + CI 게이트(계층 0)가 담당한다.
#
# 차단(deny)은 전부 deny() 단일 경로를 거친다 — 사용자 메시지 출력 + 차단 이력 로그(감사용).
# 로그: ~/.claude/hooks/guard-block.log (session_id·cwd·사유·명령) — 멀티세션 위반 시도 추적.

INPUT=$(cat)
COMMAND=""
GUARD_LOG="${HOME}/.claude/hooks/guard-block.log"

# 차단 단일 경로: 이력 로그 + ⛔ 메시지(+해결 안내) + exit 2.
# $1 = 사유 라벨, $2 = 해결 안내(선택). session_id·cwd는 payload에서 추출(없으면 ?).
deny() {
  local reason="$1" hint="$2" sid cwd ts cmd1
  ts=$(date +%Y-%m-%dT%H:%M:%S 2>/dev/null)
  sid=$(printf '%s' "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id','?'))" 2>/dev/null) || sid="?"
  cwd=$(printf '%s' "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('cwd','?'))" 2>/dev/null) || cwd="?"
  # cmd는 한 줄로 정제(개행→공백) + 길이 제한 — 로그 한 줄/엔트리 보장
  cmd1=$(printf '%s' "${COMMAND:-}" | tr '\n\r\t' '   ' | cut -c1-200)
  { printf '%s session=%s cwd=%s DENY %s | cmd=%s\n' "${ts:-?}" "${sid:-?}" "${cwd:-?}" "$reason" "$cmd1" >> "$GUARD_LOG"; } 2>/dev/null
  echo "⛔ [guard] $reason" >&2
  [[ -n "$hint" ]] && echo "   해결: $hint" >&2
  exit 2
}

# 가드는 fail-closed — python3 부재 시 파싱 실패로 TOOL이 빈 값이 되어 전체 가드가 우회되므로 차단
if ! command -v python3 >/dev/null 2>&1; then
  deny "python3 없음 — 가드 실행 불가 (fail-closed)" ""
fi

TOOL=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

if [[ "$TOOL" != "Bash" ]]; then exit 0; fi

# 커맨드에 포함된 마지막 `cd <경로>` 또는 `git -C <경로>` 기준으로 검사한다.
# (훅의 cwd는 세션 디렉토리 — 체인(`x && cd ...`)·서브셸(`(cd ...)`)·`git -C`로
#  다른 repo에서 커밋하는 우회를 막으려면 필요. 선두 cd만 잡으면 자명하게 우회됨)
TARGET_DIR=$(echo "$COMMAND" | grep -oE "(^|[^[:alnum:]_-])(cd|git[[:space:]]+-C)[[:space:]]+[^;&|)[:space:]]+" | tail -1 | sed -E 's/^.*(cd|-C)[[:space:]]+//')
if [[ -n "$TARGET_DIR" ]]; then
  TARGET_DIR="${TARGET_DIR//\"/}"
  TARGET_DIR="${TARGET_DIR//\'/}"
  TARGET_DIR="${TARGET_DIR/#\~/$HOME}"
  [[ -d "$TARGET_DIR" ]] && cd "$TARGET_DIR" 2>/dev/null
fi

# main/develop 직접 커밋 금지
if echo "$COMMAND" | grep -qE "\bgit\b.*\bcommit\b"; then
  BRANCH=$(git branch --show-current 2>/dev/null)
  if [[ "$BRANCH" == "main" || "$BRANCH" == "develop" ]]; then
    deny "main/develop 직접 커밋 금지" "feature/fix/hotfix/release 브랜치에서 작업 후 /feature-merge 사용"
  fi
fi

# main/develop force push 금지 (--force/-f 또는 +branch refspec)
# refspec 생략 시 현재 브랜치가 push 대상이므로, main/develop 위에서는 force push 전체를 차단한다
if echo "$COMMAND" | grep -qE "git push.*(--force|-f)\b|git push.*\+(main|develop)\b"; then
  BRANCH=$(git branch --show-current 2>/dev/null)
  if [[ "$BRANCH" == "main" || "$BRANCH" == "develop" ]] || \
     echo "$COMMAND" | grep -qE "origin[[:space:]]+(main|develop)([[:space:]]|$)|:(main|develop)([[:space:]]|$)|\+(main|develop)([[:space:]]|$)"; then
    deny "main/develop force push 금지" "브랜치 히스토리 변경이 필요하면 팀장에게 직접 요청하세요"
  fi
fi

# git reset --hard 금지
if echo "$COMMAND" | grep -qE "git reset --hard"; then
  deny "git reset --hard 금지 — 미커밋 변경사항 전체 삭제 위험" "필요한 경우 사용자가 직접 실행 (Claude가 대신 실행하지 않음)"
fi

# 검증기(테스트·마이그레이션) 파일 삭제 금지 — 게이트 무력화 방지
# rm / git rm 으로 테스트(*Test.java·*.spec.*·*.test.*·test_*.py·*_test.py·tests/)나
# 마이그레이션(db/migration/·alembic/versions/·prisma/migrations/)을 지우는 것을 차단한다.
if echo "$COMMAND" | grep -qE "(^|[^[:alnum:]_.-])(rm|git[[:space:]]+rm)([[:space:]]|$)" && \
   echo "$COMMAND" | grep -qE "[^[:space:]]*Test\.java|[^[:space:]]*\.(spec|test)\.[A-Za-z]+|(^|/)test_[^[:space:]/]*\.py|[^[:space:]/]*_test\.py|(^|[[:space:]]|/)tests?/|db/migration/|alembic/versions/|prisma/migrations/"; then
  deny "검증기(테스트/마이그레이션) 삭제 금지 — 게이트 무력화 방지" "정 필요하면 사용자가 직접 실행하세요 (Claude가 대신 삭제하지 않음)"
fi

# 프로젝트 핵심 디렉터리 rm -rf 금지 (PROJECT_ROOT, src, app, node_modules)
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -n "$PROJECT_ROOT" ]] && echo "$COMMAND" | grep -qE "\brm[[:space:]]+(-[a-zA-Z]*[rRf]|--recursive|--force)"; then
  # 경로의 정규식 메타문자([.+ 등)를 이스케이프 — 미처리 시 해당 경로에서 가드가 빗나감
  PROJECT_ROOT_RE=$(printf '%s' "$PROJECT_ROOT" | sed 's/[][\.*^$()+?{}|]/\\&/g')
  if echo "$COMMAND" | grep -qE "(\"?$PROJECT_ROOT_RE/?\"?[[:space:]]*$|(^|[[:space:]])(\./)?(src|app)(/|[[:space:]]|$)|node_modules/?[[:space:]]*$)"; then
    deny "프로젝트 핵심 디렉터리 rm -rf 금지" "삭제가 필요하면 사용자가 직접 실행하세요"
  fi
  # 심링크 표기(/tmp ↔ /private/tmp 등)로 적힌 root도 잡는다 — 경로 토큰을 정규화해 비교
  set -f
  for TOK in $COMMAND; do
    TOK="${TOK//\"/}"; TOK="${TOK//\'/}"; TOK="${TOK/#\~/$HOME}"
    case "$TOK" in
      /*|./*|../*)
        RESOLVED=$(cd "$TOK" 2>/dev/null && pwd -P)
        if [[ -n "$RESOLVED" && "${RESOLVED%/}" == "${PROJECT_ROOT%/}" ]]; then
          set +f
          deny "프로젝트 핵심 디렉터리 rm -rf 금지 (심링크 경로)" "삭제가 필요하면 사용자가 직접 실행하세요"
        fi
        ;;
    esac
  done
  set +f
fi

# npm 글로벌 패키지 설치 금지 (install/i/add 변형 + 플래그 위치 무관)
if echo "$COMMAND" | grep -qE "npm[[:space:]]+(install|i|add)([[:space:]]|$)" && \
   echo "$COMMAND" | grep -qE "(^|[[:space:]])(-g|--global)([[:space:]]|$)"; then
  deny "npm install -g 금지 — 글로벌 Node 환경 오염 위험" "로컬 설치 사용 (npm install --save-dev 또는 npx)"
fi

exit 0

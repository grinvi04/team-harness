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
  # 로그 위조(log forging) 방지 — session_id·cwd의 개행·탭·제어문자가 감사 로그에 별도 라인/ANSI를 주입하지 못하게 정제.
  sid=$(printf '%s' "$sid" | tr '\n\r\t' '   ' | cut -c1-80)
  cwd=$(printf '%s' "$cwd" | tr '\n\r\t' '   ' | cut -c1-256)
  # cmd는 한 줄로 정제(개행→공백) + 시크릿 마스킹(URL 박힌 크레덴셜·gh 토큰·PAT) + 길이 제한.
  # 차단된 명령을 평문 로깅하므로, 토큰이 섞인 명령(예: https://x:TOKEN@host)이 로그에 남지 않게 마스킹.
  cmd1=$(printf '%s' "${COMMAND:-}" | tr '\n\r\t' '   ' \
    | sed -E -e 's#(https?://)[^@ ]*@#\1***@#g' \
             -e 's#gh[pousr]_[A-Za-z0-9]{20,}#gh_***#g' \
             -e 's#github_pat_[A-Za-z0-9_]{20,}#github_pat_***#g' \
    | cut -c1-200)
  # 로그 로테이션: 256KB 초과 시 최근 절반만 보존(무한 증가 방지)
  { [ -f "$GUARD_LOG" ] && [ "$(wc -c <"$GUARD_LOG" 2>/dev/null || echo 0)" -gt 262144 ] && tail -n "$(( $(wc -l <"$GUARD_LOG" 2>/dev/null || echo 0)/2 ))" "$GUARD_LOG" > "$GUARD_LOG.tmp" && mv "$GUARD_LOG.tmp" "$GUARD_LOG"; } 2>/dev/null
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
# python3가 존재하나 실행 실패/입력 손상 시 파싱이 조용히 빈 값이 되어 전 가드가 우회되므로 차단(fail-closed).
# (부재는 위 command -v 로, '있으나 깨짐'은 이 rc 검사로 — 둘 다 fail-closed.)
if [[ $? -ne 0 ]]; then deny "가드 입력 파싱 실패 — python3 실행 불가/JSON 손상 (fail-closed)" ""; fi
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

if [[ "$TOOL" != "Bash" ]]; then exit 0; fi

# LITE 면제는 명령이 실제로 실행되는 원래 repo(세션 cwd) 기준으로 판정한다 — 후행 cd/-C로 다른 .harness-lite
# repo에 착지시켜 현재 코드 repo의 LITE-게이트 가드를 무장해제하는 교차오염(#196)을 막기 위해,
# 아래 TARGET_DIR 추종 cd **이전**에 원래 repo 루트를 캡처한다.
_ORIG_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

# 커맨드에 포함된 마지막 `cd <경로>` 또는 `git -C <경로>` 기준으로 검사한다.
# (훅의 cwd는 세션 디렉토리 — 체인(`x && cd ...`)·서브셸(`(cd ...)`)·`git -C`로
#  다른 repo에서 커밋하는 우회를 막으려면 필요. 선두 cd만 잡으면 자명하게 우회됨)
TARGET_DIR=$(echo "$COMMAND" | grep -oE "(^|[^[:alnum:]_-])(cd|git[[:space:]]+-C)[[:space:]]+[^;&|)[:space:]]+" | tail -1 | sed -E 's/^.*(cd|-C)[[:space:]]+//')
if [[ -n "$TARGET_DIR" ]]; then
  TARGET_DIR="${TARGET_DIR//\"/}"
  TARGET_DIR="${TARGET_DIR//\'/}"
  TARGET_DIR="${TARGET_DIR/#\~/$HOME}"
  # TARGET_DIR가 실제 git 작업트리일 때만 추종한다(G1). non-repo로의 후행 cd
  # (예: `git commit -m x && cd /tmp`)를 따라가 브랜치 판정을 빈 값으로 만들어
  # 커밋·force-push 가드를 우회하는 것을 막는다 — non-repo면 원래 cwd 기준으로 판정.
  if [[ -d "$TARGET_DIR" ]] && git -C "$TARGET_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    cd "$TARGET_DIR" 2>/dev/null
  fi
fi

# 경량 repo 면제 — repo 루트에 .harness-lite 마커가 있으면 dev git-flow 강제(main/develop 직접 커밋·
# 신규 feature 브랜치 plan 요구·main/develop force push·맨손 gh pr create/merge)를 스킵한다.
# 파괴적 안전가드(rm -rf 코어·검증기 삭제·reset --hard·npm -g)는 경량 repo에도 그대로 유지한다.
# 원칙: 의식의 무게를 산출물별로 right-size — 문서/경량 repo에 풀 git-flow는 과적용(역방향 오버엔지니어링).
# 코드 repo는 마커 없음 → 그대로 강제. 마커 = 의식적 opt-out(HARNESS_TRIVIAL 프리픽스의 repo 스코프판).
LITE=0
# 후행 cd 이전에 캡처한 _ORIG_ROOT(원래 세션 repo) 기준 — `<cmd> && cd <lite repo>`로 LITE=1을 유발해
# 현재 코드 repo의 가드를 우회하는 교차오염 차단(#196).
[[ -n "$_ORIG_ROOT" && -f "$_ORIG_ROOT/.harness-lite" ]] && LITE=1

# main/develop 직접 커밋 금지 — commit을 **서브커맨드 위치**로 좁혀 과차단 제거(A5:
#   `git log --grep=commit`·`git help commit`·`grep "git commit"`는 통과). `git -C <dir> commit`이면
#   후행 cd 우회와 무관하게 **그 -C dir** 기준으로 판정(A2: 커밋 dir ≠ 판정 dir 우회 차단).
#   A5b(릴리즈 보안검토 회귀): commit 앞의 **임의 git 전역옵션**을 허용해야 우회 안 됨 — `-c name=val`·
#   `--no-pager` 등이 git과 commit 사이에 오면 매치가 깨져 `git -c user.name=x commit`이 통과되던 구멍.
#   전역옵션 = 값-분리 플래그(-C/-c/--git-dir/… <값>) 또는 임의 단일 플래그(-x/--flag[=v]). 서브커맨드가
#   commit이어야 매치(log 등 다른 서브커맨드는 여전히 통과 → 과차단 유지 안 함).
# 앵커에 선행공백(`^[[:space:]]*`)·env-var 프리픽스(`X= git commit`)를 허용 — 리터럴 앵커가 이들을 놓쳐 우회되던 구멍 교정.
COMMIT_SEG=$(echo "$COMMAND" | grep -oE "(^[[:space:]]*|[;&|(][[:space:]]*)([A-Za-z_][A-Za-z0-9_]*=[^;&|[:space:]]*[[:space:]]+)*git([[:space:]]+(-C|-c|--git-dir|--work-tree|--namespace|--exec-path|--attr-source|--config-env)[[:space:]]+[^;&|[:space:]]+|[[:space:]]+-[^;&|[:space:]]+)*[[:space:]]+commit([[:space:]]|$)" | head -1)
if [[ "$LITE" != 1 && -n "$COMMIT_SEG" ]]; then
  CDIR=$(echo "$COMMIT_SEG" | grep -oE "\-C[[:space:]]+[^;&|[:space:]]+" | sed -E 's/^-C[[:space:]]+//' | head -1)
  if [[ -n "$CDIR" ]]; then
    CDIR="${CDIR//\"/}"; CDIR="${CDIR//\'/}"; CDIR="${CDIR/#\~/$HOME}"
    BRANCH=$(git -C "$CDIR" branch --show-current 2>/dev/null)
  else
    BRANCH=$(git branch --show-current 2>/dev/null)
  fi
  if [[ "$BRANCH" == "main" || "$BRANCH" == "develop" ]]; then
    deny "main/develop 직접 커밋 금지" "feature/fix/hotfix/release 브랜치에서 작업 후 /feature-merge 사용"
  fi
fi

# main/develop force push 금지 (--force/-f, 결합 단축플래그 -fu, 또는 +refspec)
# 외부 게이트는 force 신호를 넓게 잡고(내부 조건이 main/develop 대상 여부를 판정) — 결합플래그(-fu)·
# plus-refspec(+HEAD:main)를 놓쳐 우회되던 것 교정(감사 A1). refspec 생략 시 현재 브랜치가 push 대상.
# force 신호는 --force 또는 단일대시 결합(-f/-fu) 또는 +refspec만 — --follow-tags 같은 비파괴 롱플래그를 force로
#   오탐하지 않게 결합플래그를 [[:space:]]-…f… 로 좁힌다(#204). refspec 생략 시 현재 브랜치가 push 대상.
if [[ "$LITE" != 1 ]] && echo "$COMMAND" | grep -qE "git([[:space:]]+(-C|-c|--git-dir|--work-tree|--namespace|--exec-path|--attr-source|--config-env)[[:space:]]+[^;&|[:space:]]+|[[:space:]]+-[^;&|[:space:]]+)*[[:space:]]+push[^;&|]*(--force|[[:space:]]-[a-zA-Z]*f[a-zA-Z]*|[[:space:]]\+)"; then
  # 목적지 판정은 명령 전체가 아니라 **push 세그먼트**로 한정(#204: rebase 인자·커밋메시지·주석의 main/develop 오탐 방지).
  PUSH_SEG=$(echo "$COMMAND" | grep -oE "git[^;&|]*[[:space:]]push[^;&|]*" | head -1)
  # git -C <dir> push 이면 그 dir 기준으로 현재 브랜치를 판정 — commit(A2)와 대칭.
  PDIR=$(echo "$COMMAND" | grep -oE "git[[:space:]]+-C[[:space:]]+[^;&|[:space:]]+" | sed -E 's/^git[[:space:]]+-C[[:space:]]+//' | head -1)
  if [[ -n "$PDIR" ]]; then
    PDIR="${PDIR//\"/}"; PDIR="${PDIR//\'/}"; PDIR="${PDIR/#\~/$HOME}"
    BRANCH=$(git -C "$PDIR" branch --show-current 2>/dev/null)
  else
    BRANCH=$(git branch --show-current 2>/dev/null)
  fi
  # push 세그먼트에 명시 refspec(remote + ref, 예: origin feature/x)이 있으면 현재 브랜치는 무관 —
  #   bare push(git push -f)만 현재 브랜치가 실제 대상이라 현재-브랜치 판정을 적용(#204 명시-refspec 오차단 교정).
  HAS_REF=""; echo "$PUSH_SEG" | grep -qE "push([[:space:]]+-[^;&|[:space:]]+)*[[:space:]]+[^-;&|[:space:]]+[[:space:]]+[^-;&|[:space:]]+" && HAS_REF=1
  if echo "$PUSH_SEG" | grep -qE "([[:space:]]|:|\+)(refs/heads/)?(main|develop)([[:space:]]|$)"; then
    deny "main/develop force push 금지" "브랜치 히스토리 변경이 필요하면 팀장에게 직접 요청하세요"
  elif [[ -z "$HAS_REF" && ( "$BRANCH" == "main" || "$BRANCH" == "develop" ) ]]; then
    deny "main/develop force push 금지" "브랜치 히스토리 변경이 필요하면 팀장에게 직접 요청하세요"
  fi
fi

# 신규 feature 브랜치 생성 시 상류 plan 아티팩트 강제 (감사 F5 remedy)
# 상태 기반(docs/specs/<name>.md 파일 존재) — NL 추측·키워드 없음(F6 오버트리거 회피).
# checkout -b / switch -c 로 feature/<name> 을 만들 때만 발동 — 기존 브랜치 계속·fix/hotfix 는 통과.
# 명시 면제: 명령에 HARNESS_TRIVIAL=1 프리픽스(계획 건너뛰기를 침묵 기본값이 아닌 의식적 행위로).
# 보조 장치 — fail-safe(name/root 추출 실패 시 미차단), 최종 강제는 계층0(리뷰/CI).
if [[ "$LITE" != 1 ]] && echo "$COMMAND" | grep -qE "git[[:space:]]+(checkout[[:space:]]+-b|switch[[:space:]]+-c|branch)[[:space:]]+feature/"; then
  if ! echo "$COMMAND" | grep -qE "(^|[[:space:]])HARNESS_TRIVIAL=1([[:space:]]|$)"; then
    # 종단문자에 `)`도 제외(G4) — 서브셸 `(git checkout -b feature/x)`에서 이름에 `)`가 붙는 오탐 방지.
    FEAT_NAME=$(echo "$COMMAND" | grep -oE "feature/[^[:space:];&|)]+" | head -1 | sed 's#^feature/##')
    SPEC_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
    if [[ -n "$FEAT_NAME" && -n "$SPEC_ROOT" && ! -f "$SPEC_ROOT/docs/specs/$FEAT_NAME.md" ]]; then
      deny "신규 feature 브랜치는 승인된 plan 아티팩트(docs/specs/$FEAT_NAME.md) 필요 — 계획-먼저 강제" \
           "먼저 /plan 으로 스펙을 작성·승인 후 재시도. trivial 변경이면 'HARNESS_TRIVIAL=1 git checkout -b feature/$FEAT_NAME' 로 명시 면제."
    fi
  fi
fi

# 맨손 gh pr create / gh pr merge 금지 — PR 생성·머지는 스킬(래퍼 스크립트) 경유만 허용.
# 스킬은 scripts/pr-create.sh·pr-merge.sh를 호출하고, 그 안의 gh는 자식 프로세스라 이 PreToolUse 훅에
# 걸리지 않는다(훅은 Claude의 Bash 도구 호출만 본다). raw gh pr create/merge를 직접 치는 반사적
# 맨손질만 차단한다. (난독화 우회 — temp 스크립트에 gh 숨기기 — 는 plan에서 제외한 범위.)
# 명령 *위치*에서만 매칭 — grep/echo 등의 "gh pr create" 문자열 언급은 통과(오탐 방지).
# 분리자: 문자열 시작 `^`, `; & (`, 그리고 **공백 동반 파이프 `| `**(셸 파이프 — echo y | gh pr merge,
#   cat body | gh pr create --body-file - 류 실재 호출을 잡는다). 무공백 `|gh`는 정규식 alternation
#   (grep "a|gh pr create")일 확률이 높아 분리자로 보지 않는다(따옴표 인식 불가라 이 휴리스틱으로 절충).
# 후행: 공백·끝·`) ; & |`(서브셸 닫힘 $(gh pr create)·체인·파이프아웃).
# 알려진 한계(보조 장치, 최종 강제는 계층0): `echo y|gh pr merge`(무공백 파이프)·따옴표 안 명령·
#   env-prefix·temp 스크립트 난독화는 못 잡는다.
if [[ "$LITE" != 1 ]] && echo "$COMMAND" | grep -qE "(^|[;&(]|\|[[:space:]])[[:space:]]*gh[[:space:]]+pr[[:space:]]+create([[:space:]);&|]|$)"; then
  deny "맨손 gh pr create 금지 — PR 생성은 스킬 경유" "/pr-create (feature 흐름이면 /feature-merge) 사용. 스킬이 scripts/pr-create.sh로 base 자동감지·push·생성한다."
fi
if [[ "$LITE" != 1 ]] && echo "$COMMAND" | grep -qE "(^|[;&(]|\|[[:space:]])[[:space:]]*gh[[:space:]]+pr[[:space:]]+merge([[:space:]);&|]|$)"; then
  deny "맨손 gh pr merge 금지 — 머지는 게이트 스킬 경유" "/solo-merge(솔로) 또는 /feature-merge·/pr-review-gate(팀) 사용. 스킬이 CI·스레드 게이트 검증 후 머지한다."
fi

# git reset --hard 금지 — reset 서브커맨드 + --hard 플래그를 순서·공백·git -C·env-prefix 무관하게 검사한다.
# (기존 리터럴 `git reset --hard`는 이중공백·탭·인자후치·`git -C . reset --hard`를 놓쳐 우회됨. 형제 가드처럼
#  명령 위치 앵커라 `grep 'git reset --hard'` 같은 문자열 언급은 통과 — 기존 과차단도 함께 제거.)
# 앵커에 선행 공백([[:space:]])도 허용 — sudo/env/time/xargs/command/nice 등 wrapper 프리픽스 뒤 git을 잡는다(#204).
#   git이 따옴표 바로 뒤(grep 'git reset --hard')면 공백이 직전이 아니라 여전히 미매치 → 문자열 언급 보호 유지.
RESET_SEG=$(echo "$COMMAND" | grep -oE "(^[[:space:]]*|[;&|(][[:space:]]*|[[:space:]])([A-Za-z_][A-Za-z0-9_]*=[^;&|[:space:]]*[[:space:]]+)*git([[:space:]]+(-C|-c|--git-dir|--work-tree|--namespace|--exec-path|--attr-source|--config-env)[[:space:]]+[^;&|[:space:]]+|[[:space:]]+-[^;&|[:space:]]+)*[[:space:]]+reset([[:space:]]|$)[^;&|]*" | head -1)
if [[ -n "$RESET_SEG" ]] && echo "$RESET_SEG" | grep -qE "(^|[[:space:]])--hard([[:space:]]|$)"; then
  deny "git reset --hard 금지 — 미커밋 변경사항 전체 삭제 위험" "필요한 경우 사용자가 직접 실행 (Claude가 대신 실행하지 않음)"
fi

# 검증기(테스트·마이그레이션) 파일 삭제 금지 — 게이트 무력화 방지
# rm / git rm 으로 테스트(*Test.java·*.spec.*·*.test.*·test_*.py·*_test.py·tests/)나
# 마이그레이션(db/migration/·alembic/versions/·prisma/migrations/)을 지우는 것을 차단한다.
# rm/git rm과 대상 경로를 **같은 명령 세그먼트**([^;&|]*)로 결합해 검사한다(G2) —
# `rm x.log; grep foo tests/`처럼 무관한 rm과 다른 세그먼트의 테스트경로가 각각 있어도 차단하던 오탐 방지.
if echo "$COMMAND" | grep -qE "(^|[^[:alnum:]_.-])(rm|git[[:space:]]+rm)[[:space:]][^;&|]*(Test\.java|\.(spec|test)\.[A-Za-z]+|test_[^[:space:]/]*\.py|[^[:space:]/]*_test\.py|tests?(/|[[:space:]]|[\"']|$)|db/migration(/|[[:space:]]|[\"']|$)|alembic/versions(/|[[:space:]]|[\"']|$)|prisma/migrations(/|[[:space:]]|[\"']|$))"; then
  deny "검증기(테스트/마이그레이션) 삭제 금지 — 게이트 무력화 방지" "정 필요하면 사용자가 직접 실행하세요 (Claude가 대신 삭제하지 않음)"
fi

# 프로젝트 핵심 디렉터리 rm -rf 금지 (PROJECT_ROOT, src, app, node_modules)
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -n "$PROJECT_ROOT" ]] && echo "$COMMAND" | grep -qE "\brm[[:space:]]+(-[a-zA-Z]*[rRf]|--recursive|--force)"; then
  # 경로의 정규식 메타문자([.+ 등)를 이스케이프 — 미처리 시 해당 경로에서 가드가 빗나감
  PROJECT_ROOT_RE=$(printf '%s' "$PROJECT_ROOT" | sed 's/[][\.*^$()+?{}|]/\\&/g')
  if echo "$COMMAND" | grep -qE "(\"?$PROJECT_ROOT_RE/?\"?[[:space:]]*$|(^|[[:space:]])[\"']?(\./)?(src|app|node_modules)[\"']?(/|[[:space:]]|$))"; then
    deny "프로젝트 핵심 디렉터리 rm -rf 금지" "삭제가 필요하면 사용자가 직접 실행하세요"
  fi
  # 심링크 표기(/tmp ↔ /private/tmp 등)로 적힌 root도 잡는다 — 경로 토큰을 정규화해 비교
  set -f
  for TOK in $COMMAND; do
    TOK="${TOK//\"/}"; TOK="${TOK//\'/}"; TOK="${TOK/#\~/$HOME}"
    case "$TOK" in
      .|..|/*|./*|../*)
        RESOLVED=$(cd "$TOK" 2>/dev/null && pwd -P)
        if [[ -n "$RESOLVED" ]]; then
          # 해석된 경로가 프로젝트 루트와 같거나(예: rm -rf .) 그 상위(루트를 포함, 예: rm -rf .. / /)면 차단.
          _R="${RESOLVED%/}"; _PR="${PROJECT_ROOT%/}"
          if [[ "$_PR" == "$_R" || "$_PR" == "$_R"/* ]]; then
            set +f
            deny "프로젝트 핵심 디렉터리 rm -rf 금지 (루트/상위 경로)" "삭제가 필요하면 사용자가 직접 실행하세요"
          fi
        fi
        ;;
    esac
  done
  set +f
fi

# npm 글로벌 패키지 설치 금지 — install-verb와 -g/--global을 **같은 npm 세그먼트**에서, 순서 무관하게 결합 검사.
# G3: `npm --global install x`(플래그가 서브커맨드 앞) 우회 차단. G2: `echo -g && npm install x`(다른 세그먼트의 -g) 오탐 방지.
if echo "$COMMAND" | grep -qE "npm[[:space:]]([^;&|]*[[:space:]])?(install|i|add)[[:space:]]([^;&|]*[[:space:]])?(-g|--global)(=[^;&|[:space:]]*)?([[:space:]]|$)|npm[[:space:]]([^;&|]*[[:space:]])?(-g|--global)(=[^;&|[:space:]]*)?[[:space:]]([^;&|]*[[:space:]])?(install|i|add)([[:space:]]|$)"; then
  deny "npm install -g 금지 — 글로벌 Node 환경 오염 위험" "로컬 설치 사용 (npm install --save-dev 또는 npx)"
fi

exit 0

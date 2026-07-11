#!/bin/bash
# harness-guard: PreToolUse 공통 가드 (스택 무관 core)
# hooks/hooks.json 에서 ${CLAUDE_PLUGIN_ROOT}/scripts/guard.sh 로 호출된다.
# 스택/프로젝트별 추가 가드는 각 프로젝트의 .claude/settings.json hooks에 별도 추가한다 (플러그인 훅과 공존).
#
# 주의: 이 가드는 Claude Code 사용자만 막는 보조 장치다.
# load-bearing 강제는 GitHub branch protection + CI 게이트(계층 0)가 담당한다.
#
# ── 판정 철학 (decisions.md "가드/게이트 판정 철학" · #220) ─────────────────────────
# 위협모델: 상대는 **혼란한 에이전트**(반사적으로 `git push --force`를 침)지, `echo y|gh`를 조합하는
#   동기 있는 공격자가 아니다. 결정된 우회는 항상 존재하므로 우회-군비경쟁엔 종료조건이 없다.
# 세 부류를 다르게 취급한다:
#   (a) **서버-백스톱 있는 git-flow 넛지** — main/develop 직접 커밋·force-push·맨손 gh pr.
#       branch protection(allow_force_pushes:false·enforce_admins:on)이 서버에서 거부한다 → best-effort 넛지.
#       정규식을 **동결**하고 적대적 우회-테스트 대상에서 제외, under-block 편향(과차단 안 함).
#       단, 동결의 근거는 '계층0 중복'이 아니라 **위협모델(혼란한 에이전트는 흔한 형태만)**이다 —
#       중복 논거는 protection 미설정(Private Free-plan)·드리프트 repo에선 성립 안 함(그땐 guard가 유일선).
#       그래서 repo-sync가 protection-on을 점검해 그 공백을 메운다(#220). gh pr merge의 서버 백스톱은
#       CI-green만 커버하고 리뷰-게이트 절차는 아니다 → 부분 백스톱.
#   (b) **로컬-전용 파괴 가드** — reset --hard·rm -rf 코어·검증기 삭제·npm -g.
#       branch protection도 CI도 커버하지 않는다 → **이 계층의 진짜 load-bearing**. 로컬 비가역이라
#       하드블록 유지하되 흔한 형태만 잡는다. (python3 부재 시 fail-closed는 바로 이 (b) 계층 때문 —
#       파싱된 COMMAND 없이는 판정 불가라 안전측 차단. under-block 편향은 (a)에만 적용.)
#   (c) **서버-백스톱 없는 프로세스 넛지** — F5(feature 브랜치 전 docs/specs 스펙). 비파괴이나
#       CI가 스펙 존재를 강제하지 않는다(사람 리뷰만) → (a)의 서버 백스톱도 (b)의 비가역도 아닌 순수 절차 넛지.
# 원칙: 판정기는 파싱 안 된 문자열에서 의미론을 무한정 추론하지 않는다. 정밀 판정이 꼭 필요하면
#   정규식 epicycle이 아니라 실제 파서(shlex)로 옮긴다(재설계 #220-A).
#
# 차단(deny)은 전부 deny() 단일 경로를 거친다 — 사용자 메시지 출력 + 차단 이력 로그(감사용).
# 로그: ~/.claude/hooks/guard-block.log (session_id·cwd·사유·명령) — 멀티세션 위반 시도 추적.

INPUT=$(cat)
COMMAND=""
GUARD_LOG="${HARNESS_GUARD_LOG:-${HOME}/.claude/hooks/guard-block.log}"
HARNESS_AGENT_NAME="${HARNESS_AGENT_NAME:-Claude}"

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
    | sed -E -e 's#([Hh][Tt][Tt][Pp][Ss]?://)[^@ ]*@#\1***@#g' \
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

# 가드 JSON 파싱 — python3 우선, 없거나 깨지면 jq 폴백. python3의 유일 용도가 JSON 파싱이라 jq로 전체 가드가
# 그대로 작동한다(보호 축소 0). [D] #220: 이전엔 python3 부재 = 전체 fail-closed(Bash 전면 마비)라 폭발반경이 컸다
# → 'python3·jq 둘 다 부재/실패'로 축소. 파서가 하나도 없으면 여전히 fail-closed(빈 COMMAND로 전 가드 우회 방지).
# 복구: python3 또는 jq 설치(docs/troubleshooting.md).
TOOL=""; COMMAND=""; _parsed=0
if command -v python3 >/dev/null 2>&1; then
  TOOL=$(printf '%s' "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null) \
    && COMMAND=$(printf '%s' "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null) \
    && _parsed=1
fi
if [[ $_parsed -ne 1 ]] && command -v jq >/dev/null 2>&1; then
  if printf '%s' "$INPUT" | jq -e . >/dev/null 2>&1; then   # 유효 JSON 확인(파싱 실패 감지 — 손상 입력은 fail-closed로)
    # python3 브랜치와 대칭: 두 추출이 모두 성공해야 _parsed=1. 비객체 top-level·비객체 tool_input은
    #   jq 인덱싱 에러(rc≠0)로 _parsed=0 → fail-closed(빈 COMMAND로 우회 방지). 유효 객체는 Bash/비Bash 모두 rc0.
    TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null) \
      && COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) \
      && _parsed=1
  fi
fi
if [[ $_parsed -ne 1 ]]; then deny "가드 JSON 파싱 불가 — python3·jq 모두 부재/실패 (fail-closed)" "python3 또는 jq 설치 후 재시도"; fi

if [[ "$TOOL" != "Bash" ]]; then exit 0; fi

# 셸 토크나이저 primitive 로드(순수 bash, #220-A) — commit·reset 게이트가 정규식 대신 토큰 술어로 판정한다.
# 순수 bash라 python3·jq 불요([D] 폴백 보존). 부재/로드 실패 시 fail-closed(파싱 불능 → 안전측 차단).
# BASH_SOURCE로 guard.sh 자기 위치 기준 경로 해석(캐시·워킹트리 양쪽 동작). Bash 도구일 때만 로드(비Bash 무영향).
if ! source "${BASH_SOURCE[0]%/*}/lib/tokenize.sh" 2>/dev/null; then
  deny "토크나이저 lib 로드 실패 (scripts/lib/tokenize.sh) — fail-closed" "플러그인 설치 무결성 확인 후 재시도"
fi

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

# 보호 브랜치 — 직접 커밋·force-push를 넛지 차단하는 git-flow 정본. **단일 출처**: 판정 3곳
# (commit·force-push 명시 refspec·force-push bare)이 이 리스트를 공유한다(하드코딩 3곳 통합, #220-A).
PROTECTED_BRANCHES="main develop"
# 현재 브랜치가 보호 대상인지(정확 일치 — `== main || == develop`와 동일 의미).
is_protected_branch() {
  local b="$1" p
  for p in $PROTECTED_BRANCHES; do [[ "$b" == "$p" ]] && return 0; done
  return 1
}
# 명시 refspec 정규식용 alternation(main|develop) — force-push 목적지 매칭.
PROTECTED_RE=$(printf '%s' "$PROTECTED_BRANCHES" | tr ' ' '|')

# main/develop 직접 커밋 금지 (토큰 판정 — #220-A, 기존 monster 정규식 대체)
# 각 세그먼트의 git 서브커맨드가 commit이면 그 세그먼트의 -C dir(없으면 현재 cwd) 기준 브랜치를 보고
# 보호 브랜치면 차단한다. git_subcommand는 **command-position 앵커**(선행 env-prefix만 스킵, git이 그
# 자리에 와야 함) — 그래서 `git log --grep=commit`(서브커맨드=log)·`grep "git commit"`(token0=grep)·
# `sudo git commit`/`echo git commit`(token0=wrapper, git 아님)은 통과 = category(a) under-block 보존.
# `git -c user.name=x commit`은 -c 전역옵션을 스킵해 서브커맨드=commit → 차단(A5b). `git -C <dir> commit`은
# 그 -C dir 기준 판정(A2, 후행 cd 우회 무관). **첫 commit 세그먼트만** 판정해 현행 head -1 under-block 보존.
if [[ "$LITE" != 1 ]]; then
  while IFS= read -r CSEG; do
    [[ "$(git_subcommand "$CSEG")" == commit ]] || continue
    CDIR=$(git_C_dir "$CSEG" || true)
    if [[ -n "$CDIR" ]]; then
      CDIR="${CDIR/#\~/$HOME}"
      BRANCH=$(git -C "$CDIR" branch --show-current 2>/dev/null)
    else
      BRANCH=$(git branch --show-current 2>/dev/null)
    fi
    is_protected_branch "$BRANCH" && deny "main/develop 직접 커밋 금지" "feature/fix/hotfix/release 브랜치에서 작업 후 /feature-merge 사용"
    break   # 첫 commit 세그먼트만 판정(현행 head -1 under-block 보존)
  done < <(split_segments "$COMMAND")
fi

# main/develop force push 금지 (--force/-f, 결합 단축플래그 -fu, 또는 +refspec)
# 외부 게이트는 force 신호를 넓게 잡고(내부 조건이 main/develop 대상 여부를 판정) — 결합플래그(-fu)·
# plus-refspec(+HEAD:main)를 놓쳐 우회되던 것 교정(감사 A1). refspec 생략 시 현재 브랜치가 push 대상.
# force 신호는 --force 또는 단일대시 결합(-f/-fu) 또는 +refspec만 — --follow-tags 같은 비파괴 롱플래그를 force로
#   오탐하지 않게 결합플래그를 [[:space:]]-…f… 로 좁힌다(#204). refspec 생략 시 현재 브랜치가 push 대상.
# #220-A: 외부 monster global-opts 정규식 조건을 제거했다 — 아래 내부 루프가 이미 각 push 세그먼트에서
#   force를 재검사(비-force면 continue)하므로 외부 감지는 중복이었다. force-push는 category(a) frozen —
#   내부 force/refspec/bare 판정 로직은 손대지 않는다(재작성 3회 이력, 서버 백스톱이 정본).
if [[ "$LITE" != 1 ]]; then
  # 명령의 **모든** push 세그먼트를 개별 판정한다 — 체인된 다중 push에서 뒤쪽 세그먼트의 force-push를
  #   head -1이 놓쳐 우회되던 것 교정(#207 회귀: 무해한 첫 push 뒤에 main force-push를 붙이면 통과했음).
  #   목적지는 명령 전체가 아니라 각 push 세그먼트로 한정(#204: rebase 인자·커밋메시지의 오탐 방지).
  while IFS= read -r PSEG; do
    [[ -z "$PSEG" ]] && continue
    # 이 세그먼트 자체가 force push가 아니면 스킵(비-force push는 무관).
    echo "$PSEG" | grep -qE "push[^;&|]*(--force|[[:space:]]-[a-zA-Z]*f[a-zA-Z]*|[[:space:]]\+)" || continue
    # git -C <dir> push 이면 그 dir 기준으로 현재 브랜치 판정(commit A2와 대칭).
    PDIR=$(echo "$PSEG" | grep -oE "git[[:space:]]+-C[[:space:]]+[^;&|[:space:]]+" | sed -E 's/^git[[:space:]]+-C[[:space:]]+//' | head -1)
    if [[ -n "$PDIR" ]]; then
      PDIR="${PDIR//\"/}"; PDIR="${PDIR//\'/}"; PDIR="${PDIR/#\~/$HOME}"
      BRANCH=$(git -C "$PDIR" branch --show-current 2>/dev/null)
    else
      BRANCH=$(git branch --show-current 2>/dev/null)
    fi
    # 명시 refspec(remote + ref)이 있으면 현재 브랜치 무관 — bare push만 현재 브랜치가 대상(#204).
    HAS_REF=""; echo "$PSEG" | grep -qE "push([[:space:]]+-[^;&|[:space:]]+)*[[:space:]]+[^-;&|[:space:]]+[[:space:]]+[^-;&|[:space:]]+" && HAS_REF=1
    if echo "$PSEG" | grep -qE "([[:space:]]|:|\+)(refs/heads/)?($PROTECTED_RE)([[:space:]]|$)"; then
      deny "main/develop force push 금지" "브랜치 히스토리 변경이 필요하면 팀장에게 직접 요청하세요"
    elif [[ -z "$HAS_REF" ]] && is_protected_branch "$BRANCH"; then
      deny "main/develop force push 금지" "브랜치 히스토리 변경이 필요하면 팀장에게 직접 요청하세요"
    fi
  done < <(echo "$COMMAND" | grep -oE "git[^;&|]*[[:space:]]push[^;&|]*")
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

# 맨손 gh pr create / gh pr merge 금지 (토큰 판정 — #220-A). PR 생성·머지는 스킬(래퍼 스크립트) 경유만 허용.
# 스킬 내부 gh는 자식 프로세스라 이 훅에 안 걸린다 — raw gh pr create/merge 반사적 맨손질만 차단.
# 각 세그먼트의 token0=gh·token1=pr·token2∈{create,merge}면 차단. 토큰화가 정규식 휴리스틱을 대체:
#   - 따옴표 안 명령/alternation `grep -E 'foo|gh pr create'`는 `|`가 따옴표 안이라 세그먼트 분리 안 됨
#     → token0=grep → 통과(기존 '무공백 |gh' 휴리스틱을 진짜 따옴표 인식으로 대체, 정밀↑).
#   - echo/grep 등의 "gh pr create" 문자열 언급 → 따옴표 안이라 한 토큰 → token0≠gh → 통과.
#   - 실 파이프 `echo y | gh pr merge`·서브셸 `$(gh pr create)`·체인 `&& gh pr create` → 각 세그먼트 token0=gh → 차단.
# 알려진 한계(보조 장치, 최종 강제는 계층0): `sudo gh pr create`(wrapper 뒤 gh는 token0 아님 → category(a)
#   under-block, 서버 백스톱이 정본)·env-prefix·temp 스크립트 난독화는 못 잡는다.
if [[ "$LITE" != 1 ]]; then
  while IFS= read -r GSEG; do
    _tok_into _gt "$GSEG"
    [[ "${_gt[0]:-}" == gh && "${_gt[1]:-}" == pr ]] || continue
    case "${_gt[2]:-}" in
      create) deny "맨손 gh pr create 금지 — PR 생성은 스킬 경유" "/pr-create (feature 흐름이면 /feature-merge) 사용. 스킬이 scripts/pr-create.sh로 base 자동감지·push·생성한다." ;;
      merge)  deny "맨손 gh pr merge 금지 — 머지는 게이트 스킬 경유" "/solo-merge(솔로) 또는 /feature-merge·/pr-review-gate(팀) 사용. 스킬이 CI·스레드 게이트 검증 후 머지한다." ;;
    esac
  done < <(split_segments "$COMMAND")
fi

# git reset --hard 금지 (토큰 판정 — #220-A, 기존 monster 정규식 대체)
# 각 세그먼트에서 git 서브커맨드를 **wrapper-tolerant 스캔**(git_subcommand_scan)해 reset이고 그 세그먼트에
# --hard 토큰이 있으면 차단한다. 순서·이중공백·탭·인자후치·`git -C . reset`·env-prefix·wrapper(sudo/env/
# time/#204) 무관하게 잡는다 — 토큰화가 이 변형들을 정규화하기 때문. `grep 'git reset --hard'`는 그게 한
# 따옴표 토큰이라 standalone git 토큰이 없어 통과(mention 보호). `git reset --soft`는 --hard 토큰 부재로 통과.
# category(b) 무백스톱 파괴가드 — LITE repo에서도 유지(안전측), under-block 편향 미적용.
# 알려진 한계(보조 장치, 최종 강제는 계층0): ANSI-C `$'git' reset --hard`류는 tokenize가 $'...'를
#   디코드하지 않아 통과한다 — 현행 정규식과 동일하고, `$'...'`는 의도적 셸 문법이지 흔한 반사형이
#   아니라 위협모델상 수용(category(b)는 흔한 형태만 잡는다). 정밀 판정이 필요하면 계층0이 정본.
while IFS= read -r RSEG; do
  [[ "$(git_subcommand_scan "$RSEG")" == reset ]] || continue
  if seg_has_token "$RSEG" "--hard"; then
    deny "git reset --hard 금지 — 미커밋 변경사항 전체 삭제 위험" "필요한 경우 사용자가 직접 실행 (${HARNESS_AGENT_NAME}가 대신 실행하지 않음)"
  fi
done < <(split_segments "$COMMAND")

# 검증기(테스트·마이그레이션) 파일 삭제 금지 (토큰 판정 — #220-A) — 게이트 무력화 방지.
# rm / git rm 으로 테스트(*Test.java·*.spec.*·*.test.*·test_*.py·*_test.py·*_spec.rb·*_test.rb·tests/·__tests__/)나
# 마이그레이션(db/migration(s)/·db/migrate/·migrations/·alembic/versions/·prisma/migrations/)을 지우는 것을 차단한다.
#   (#245: jest __tests__/·복수형 migrations 커버리지 확장 — 디렉터리는 경로세그먼트 앵커)
#   (rails-stack: rspec `*_spec.rb`·minitest `*_test.rb`·ActiveRecord `db/migrate/` — 접미-특정 추가)
#   bare spec/ 는 제외(#245 F2): OpenAPI·API `spec/`와 다의적이라 과차단 위험>이득. `*_spec.rb` 접미만 잡는다.
#   .spec. 확장자 매치는 유지. 트레일링 glob(`__tests__*`)은 디렉터리 앵커 밖(선재 한계, =`tests*`).
# 세그먼트에 `rm` 토큰(bare rm 또는 git rm)이 있고 그 세그먼트의 어떤 토큰이 검증기 경로면 차단.
# 토큰화 이점: 따옴표 벗김(rm -rf "tests" 차단)·wrapper 관용(sudo rm tests/)·세그먼트 격리(G2:
#   `rm x.log; grep foo tests/`는 seg2에 rm 토큰 없어 통과). mention 보호: `echo "rm tests/"`는 따옴표
#   안 한 토큰이라 standalone rm 토큰 없음 → 통과. 부수 효과로 `docker run --rm tests/`(--rm은 rm 토큰
#   아님)·`rm latest/`(경로 앵커 (^|/)) 같은 현행 과차단도 해소. category(b) 무백스톱 — LITE에서도 유지.
while IFS= read -r DSEG; do
  seg_has_token "$DSEG" "rm" || continue
  _tok_into _dt "$DSEG"
  for _tok in "${_dt[@]}"; do
    # 파일 패턴은 **비앵커 부분매치**(OLD 정규식과 동일) — `rm *Test.java*`·`foo_test.py.bak`처럼 검증기
    #   파일명에 트레일링(glob `*`·`.bak`)이 붙어도 잡는다($ 종단앵커는 이 형태를 놓쳐 홀이었음, 검증 반영).
    #   디렉터리 패턴만 `(^|/)…(/|$)` 경로세그먼트 앵커 — `rm latest/`의 `test/` 부분매치 과차단만 방지.
    if printf '%s' "$_tok" | grep -qE "(Test\.java|\.(spec|test)\.[A-Za-z]+|test_[^/]*\.py|_test\.py|_spec\.rb|_test\.rb|(^|/)tests?(/|$)|(^|/)__tests__(/|$)|(^|/)db/migrations?(/|$)|(^|/)db/migrate(/|$)|(^|/)migrations(/|$)|(^|/)alembic/versions(/|$)|(^|/)prisma/migrations(/|$))"; then
      deny "검증기(테스트/마이그레이션) 삭제 금지 — 게이트 무력화 방지" "정 필요하면 사용자가 직접 실행하세요 (${HARNESS_AGENT_NAME}가 대신 삭제하지 않음)"
    fi
  done
done < <(split_segments "$COMMAND")

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

# 패키지매니저 전역설치 금지 (토큰 판정 — #220-A·#245)
# 세그먼트에서 매니저 토큰(npm/pnpm/yarn) 존재 시 매니저별 전역설치 시그니처를 차단:
#   npm/pnpm: install-verb(install/i/add) + 전역플래그(-g·--global[=v]·--location=global·g-포함 단일대시 번들 -gf)
#   yarn(classic): `global` 서브커맨드 + `add` verb (`yarn global add`) — remove/list 등 비설치는 비대상.
# 토큰화로 순서(G3)·wrapper(sudo)·따옴표 무관, mention(echo "npm install -g x"는 한 토큰) 통과.
# G2(echo -g && npm install)는 세그먼트 격리로 오탐 방지. category(b) — LITE에서도 유지.
# 과차단 방어(#245): g-번들은 **단일대시만** — `--legacy-peer-deps`류 g-포함 롱플래그는 `--*`로 먼저
#   흡수해 제외. `npm ci`는 install-verb 아님(통과). 알려진 한계(타이트 스코프): `--location global`(공백형)·
#   ANSI-C `$'...'`는 흔한 형태가 아니라 비대상 — 정본 강제는 계층0.
while IFS= read -r NSEG; do
  # 매니저별 시그니처를 **독립 평가**(first-token-wins 금지) — `yarn global add npm`처럼 패키지명이
  #   다른 매니저 토큰이어도 오라우팅되지 않게(#245 F1 홀 봉쇄). seg_has_token은 위치 무관이라
  #   npm/pnpm 브랜치는 전역플래그(-g류)를 요구하고 yarn 브랜치는 global+add를 요구 → 상호 배타.
  _has_npmpnpm=0; seg_has_token "$NSEG" npm && _has_npmpnpm=1; seg_has_token "$NSEG" pnpm && _has_npmpnpm=1
  _has_yarn=0; seg_has_token "$NSEG" yarn && _has_yarn=1
  [[ $_has_npmpnpm -eq 1 || $_has_yarn -eq 1 ]] || continue
  _tok_into _nt "$NSEG"
  _nv=0; _ng=0; _yglobal=0; _yadd=0
  for _tok in "${_nt[@]}"; do
    case "$_tok" in
      install|i) _nv=1;;
      add) _nv=1; _yadd=1;;
      global) _yglobal=1;;
      -g|--global|--global=*|--location=global) _ng=1;;
      --*) ;;                                   # 롱플래그(--legacy-peer-deps 등) — g-번들 판정에서 제외
      -*g*) _ng=1;;                             # 단일대시 g-포함 번들(-gf·-fg)
    esac
  done
  # npm/pnpm: install-verb + 전역플래그
  [[ $_has_npmpnpm -eq 1 && $_nv -eq 1 && $_ng -eq 1 ]] && deny "패키지매니저 전역설치 금지(npm/pnpm -g) — 글로벌 Node 환경 오염 위험" "로컬 설치 사용 (--save-dev 또는 npx)"
  # yarn(classic): global 서브커맨드 + add verb
  [[ $_has_yarn -eq 1 && $_yglobal -eq 1 && $_yadd -eq 1 ]] && deny "패키지매니저 전역설치 금지(yarn global add) — 글로벌 Node 환경 오염 위험" "로컬 설치 사용 (yarn add --dev 또는 npx)"
done < <(split_segments "$COMMAND")

exit 0

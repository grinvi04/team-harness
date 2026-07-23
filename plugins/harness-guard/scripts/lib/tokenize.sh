#!/bin/bash
# harness-guard: 셸 명령줄 토크나이저 primitive (guard-shlex-tokenizer / #220-A)
#
# 왜: 셸은 정규언어가 아니라 정규식으로 명령 구조를 판정하면 우회마다 새 epicycle이 붙는다
#   (force-push 3회·A5b·#204·#207/208 재작성 이력). 이 파일은 명령줄을 **한 번** 원리적으로
#   토큰화해 guard.sh 게이트가 정규식 대신 토큰 술어로 판정하게 한다.
# 순수 bash — python3·jq·외부 프로세스 fork 불요([D]/#239 폴백 스토리 보존). guard.sh가 source하고
#   단위 테스트(tests/guard-tokenizer-test.sh)도 이 파일을 직접 source한다.
#
# ⚠️ bash 3.2(macOS 기본) 함정: `local a=$1 b=${#a}`를 한 줄에 쓰면 b가 a를 못 본다
#   (같은 local 선언 내 좌→우 가시성 없음). 따라서 s 캡처와 파생값을 **별도 local**로 분리한다.
#
# 한계(의도적): 셸 확장(glob·변수·명령치환)은 하지 않는다 — 가드는 확장 전 리터럴 명령을 판정한다.
#   heredoc·프로세스치환 같은 다중행 구문은 범위 밖(가드는 흔한 형태만, 정본 강제는 계층0).

# collapse_line_continuations <cmdline>: backslash+LF/CRLF를 논리행으로 합친다.
#   직접 명령뿐 아니라 `sh -lc '<inner command>'`에 전달되는 중첩 명령도 inner shell에서 continuation을
#   제거하므로 quote depth와 무관하게 정규화한다. 따옴표 자체는 보존돼 mention 토큰 경계는 유지된다.
collapse_line_continuations() {
  local s="$1"
  local i=0 n=${#s} c next next2 out=''
  while (( i < n )); do
    c="${s:i:1}"
    if [[ "$c" == \\ ]]; then
      next="${s:i+1:1}"
      next2="${s:i+2:1}"
      if [[ "$next" == $'\n' ]]; then ((i+=2)); continue; fi
      if [[ "$next" == $'\r' && "$next2" == $'\n' ]]; then ((i+=3)); continue; fi
    fi
    out+="$c"
    ((i++))
  done
  printf '%s' "$out"
}

# split_segments <cmdline>: 명령줄을 셸 연산자(; && || | ( ))에서 분리한다(따옴표 인식).
#   1줄=1세그먼트로 출력. 따옴표 안의 연산자·서브셸 문자는 리터럴로 취급해 분리하지 않는다.
split_segments() {
  local s="$1"
  local i=0 n=${#s} c q='' cur='' out=''
  while (( i < n )); do
    c="${s:i:1}"
    if [[ -n "$q" ]]; then                      # 따옴표 안 — 닫는 짝까지 리터럴
      cur+="$c"; [[ "$c" == "$q" ]] && q=''
      ((i++)); continue
    fi
    case "$c" in
      \'|\") q="$c"; cur+="$c"; ((i++));;        # 따옴표 진입(문자는 보존)
      \;|\(|\)) out+="$cur"$'\n'; cur=''; ((i++));;
      \&) if [[ "${s:i:2}" == "&&" ]]; then out+="$cur"$'\n'; cur=''; ((i+=2)); else cur+="$c"; ((i++)); fi;;
      \|) if [[ "${s:i:2}" == "||" ]]; then out+="$cur"$'\n'; cur=''; ((i+=2)); else out+="$cur"$'\n'; cur=''; ((i++)); fi;;
      *) cur+="$c"; ((i++));;
    esac
  done
  out+="$cur"
  printf '%s\n' "$out"
}

# tokenize <segment>: 세그먼트를 단어(토큰)로 분리한다(따옴표 벗김·백슬래시 이스케이프·공백 collapse).
#   1줄=1토큰. 확장은 하지 않는다. 따옴표 안 공백/연산자는 토큰 내부 리터럴로 보존.
tokenize() {
  local s="$1"
  local i=0 n=${#s} c q='' cur='' started=0
  while (( i < n )); do
    c="${s:i:1}"
    if [[ -n "$q" ]]; then
      if [[ "$c" == "$q" ]]; then q=''; else cur+="$c"; fi
      started=1; ((i++)); continue
    fi
    case "$c" in
      \'|\") q="$c"; started=1; ((i++));;                       # 따옴표(벗김) — 인접 결합 위해 started
      ' '|$'\t') if (( started )); then printf '%s\n' "$cur"; cur=''; started=0; fi; ((i++));;
      \\) ((i++)); c="${s:i:1}"; cur+="$c"; started=1; ((i++));; # 백슬래시 이스케이프: 다음 문자 리터럴
      *) cur+="$c"; started=1; ((i++));;
    esac
  done
  (( started )) && printf '%s\n' "$cur"
}

# _tok_into <arrayname> <segment>: 세그먼트 토큰을 배열에 담는다(내부 헬퍼, bash 3.2 호환).
_tok_into() {
  local __name="$1" __seg="$2" __t
  eval "$__name=()"
  while IFS= read -r __t; do eval "$__name+=(\"\$__t\")"; done < <(tokenize "$__seg")
}

# git_subcommand <segment>: 선행 env-prefix(VAR=val)·git·전역옵션을 스킵하고 git 서브커맨드를 echo.
#   비-git 세그먼트면 아무것도 출력하지 않고 rc=1. (예: 'X= git -c a.b=c commit' → commit)
git_subcommand() {
  local -a t; _tok_into t "$1"
  local i=0 n=${#t[@]}
  # 선행 env-prefix 스킵 — VAR=val 형태(플래그 아님, 식별자=값)
  while (( i < n )) && [[ "${t[$i]}" != -* && "${t[$i]}" == *=* && "${t[$i]%%=*}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; do ((i++)); done
  [[ "${t[$i]:-}" == git ]] || return 1
  ((i++))
  # git 전역옵션 스킵 — 값 취하는 옵션은 다음 토큰까지, 그 외 단일 플래그
  while (( i < n )); do
    case "${t[$i]}" in
      -C|-c|--git-dir|--work-tree|--namespace|--exec-path|--attr-source|--config-env) ((i+=2));;
      -*) ((i++));;
      *) printf '%s\n' "${t[$i]}"; return 0;;
    esac
  done
  return 1
}

# git_subcommand_scan <segment>: **wrapper-tolerant** — 세그먼트 어디서든 첫 `git` 토큰을 찾아 그 서브커맨드를
#   echo(전역옵션 스킵). git_subcommand와의 차이 = command-position 앵커가 아니라 **git 토큰 스캔**이라
#   wrapper(sudo/time/env FOO=x)나 선행 토큰 뒤의 git도 잡는다. reset 게이트(category(b) safe-default,
#   wrapper 뒤 파괴명령 차단)용. `git reset`이 따옴표 안 한 토큰(grep 'git reset --hard')이면 standalone
#   git 토큰이 없어 매치 안 됨 → mention 보호 유지. (echo git reset류 overblock은 현행 bare-space 앵커와 동일.)
git_subcommand_scan() {
  local -a t; _tok_into t "$1"
  local i=0 n=${#t[@]}
  while (( i < n )); do
    if [[ "${t[$i]}" == git ]]; then
      ((i++))
      while (( i < n )); do
        case "${t[$i]}" in
          -C|-c|--git-dir|--work-tree|--namespace|--exec-path|--attr-source|--config-env) ((i+=2));;
          -*) ((i++));;
          *) printf '%s\n' "${t[$i]}"; return 0;;
        esac
      done
      return 1
    fi
    ((i++))
  done
  return 1
}

# git_C_dir <segment>: 세그먼트에서 `-C <dir>` 값을 echo(없으면 rc=1). commit/force 게이트의 대상 repo 판정용.
git_C_dir() {
  local -a t; _tok_into t "$1"
  local i=0 n=${#t[@]}
  while (( i < n )); do
    if [[ "${t[$i]}" == "-C" ]] && (( i+1 < n )); then printf '%s\n' "${t[$((i+1))]}"; return 0; fi
    ((i++))
  done
  return 1
}

# seg_has_token <segment> <token>: 세그먼트에 정확히 그 토큰이 있으면 rc=0. (플래그 존재 판정용)
seg_has_token() {
  local seg="$1" want="$2"
  local -a t; _tok_into t "$seg"
  local x
  for x in "${t[@]}"; do [[ "$x" == "$want" ]] && return 0; done
  return 1
}

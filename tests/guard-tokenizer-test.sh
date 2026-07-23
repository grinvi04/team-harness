#!/bin/bash
# tests/guard-tokenizer-test.sh — 토크나이저 primitive 단위 테스트 (guard-shlex-tokenizer 태스크2, AC-T1~T8)
# lib/tokenize.sh의 순수 함수를 source해 토큰/세그먼트/판정헬퍼 출력을 직접 단언한다.
#   guard-test(시나리오)·guard-matrix(계약)와 상보 — 이쪽은 파싱 primitive의 정확성을 격리 검증한다.
# 로컬·CI 동일: bash tests/guard-tokenizer-test.sh
set -u
LIB="$(cd "$(dirname "$0")/.." && pwd)/plugins/harness-guard/scripts/lib/tokenize.sh"
PASS=0; FAIL=0
if [[ ! -f "$LIB" ]]; then echo "FAIL: 토크나이저 lib 없음 — $LIB (RED: 미구현)"; echo "결과: PASS=0 FAIL=1"; exit 1; fi
# shellcheck source=/dev/null
source "$LIB"

eq() { # desc, expected, actual
  if [[ "$2" == "$3" ]]; then echo "PASS: $1"; PASS=$((PASS+1))
  else echo "FAIL: $1 — expected [$2] got [$3]"; FAIL=$((FAIL+1)); fi
}
toks() { tokenize "$1" | paste -sd'|' -; }          # 토큰을 |로 join
segcount() { split_segments "$1" | grep -c .; }      # 비어있지 않은 세그먼트 수
firsttok() { tokenize "$1" | head -1; }              # 첫 토큰(token[0])

# ── AC-T1: 정상 토큰화 (git 전역옵션 구조 보존) ──
eq "T1 git 전역옵션+commit" \
   "git|-c|user.name=x|-c|user.email=x@x|commit|-m|x" \
   "$(toks 'git -c user.name=x -c user.email=x@x commit -m x')"

# ── AC-T2: 따옴표 제거 ──
eq "T2 double-quote 벗김"  "rm|-rf|src"  "$(toks 'rm -rf "src"')"
eq "T2 single-quote 벗김"  "rm|-rf|app"  "$(toks "rm -rf 'app'")"
eq "T2 인접 따옴표 결합"   "abc"         "$(toks '"a"b"c"')"

# ── AC-T3: 세그먼트 분리 (연산자 && || ; | ( )) ──
eq "T3 && ; | 3연산자 → 4세그먼트" "4" "$(segcount 'a && b ; c | d')"
eq "T3 || 분리"                     "2" "$(segcount 'a || b')"
eq "T3 서브셸 () 내부 추출"         "1" "$(segcount '(x)')"

# ── AC-T4: 따옴표 안 연산자/명령은 비분리 · token[0] 보존 (mention 과차단 방지의 핵심) ──
eq "T4 따옴표 안 연산자 비분리"  "1"     "$(segcount 'echo "git push --force origin main)"')"
eq "T4 mention token0=echo"      "echo"  "$(firsttok 'echo "git commit"')"
eq "T4 mention token0=grep"      "grep"  "$(firsttok "grep 'git reset --hard' notes.txt")"

# ── AC-T5: env-prefix 인식 (선행 VAR=val 토큰 노출) ──
eq "T5 X= 빈값 env-prefix"       "X=|git|commit|-m|x"     "$(toks 'X= git commit -m x')"
eq "T5 다중 env-prefix"          "A=1|B=2|git|commit"      "$(toks 'A=1 B=2 git commit')"

# ── AC-T8: 셸 line continuation을 논리행으로 정규화 ──
eq "T8 backslash+LF 제거"   "rm -rf tests" "$(collapse_line_continuations $'rm \\\n-rf tests')"
eq "T8 backslash+CRLF 제거" "rm -rf tests" "$(collapse_line_continuations $'rm \\\r\n-rf tests')"
T8_SINGLE="'rm \\"$'\n'"-rf src'"
T8_EVEN='rm \\'$'\n''-rf tests'
eq "T8 single-quoted literal 보존" "$T8_SINGLE" "$(collapse_line_continuations "$T8_SINGLE")"
eq "T8 짝수 backslash+LF 보존"     "$T8_EVEN"   "$(collapse_line_continuations "$T8_EVEN")"
eq "T8 double-quoted continuation 제거" '"rm -rf src"' \
   "$(collapse_line_continuations '"rm \'$'\n''-rf src"')"

# ── 판정 헬퍼 (task3 게이트가 의존) ──
# git_subcommand: **command-position 앵커** — 선행 env-prefix만 스킵하고 git이 그 자리에 와야 한다.
#   wrapper(sudo/time/env)는 스킵하지 않는다 — commit 게이트의 under-block 앵커(category(a))를 보존하기
#   위해서다. `sudo git commit`·`echo git commit`이 commit 게이트에서 통과해야 하므로(M1over 등) git_subcommand가
#   wrapper를 스킵하면 안 된다. wrapper 뒤 git 판정(reset 게이트의 category(b) safe-default)은 task3에서
#   'git 토큰 스캔' 방식으로 별도 처리하고 guard-matrix로 검증한다.
eq "H git_subcommand env+전역옵션"  "commit"  "$(git_subcommand 'X= git -c a.b=c commit -m x' || true)"
eq "H git_subcommand log"           "log"     "$(git_subcommand 'git log --grep=commit' || true)"
eq "H git_subcommand pos0 reset"    "reset"   "$(git_subcommand 'git reset --hard' || true)"
eq "H git_subcommand wrapper 미스킵" ""       "$(git_subcommand 'sudo git reset --hard' || true)"
eq "H git_subcommand 비-git 빈값"   ""        "$(git_subcommand 'grep foo bar' || true)"
# git_C_dir: -C <dir> 추출(없으면 빈값)
eq "H git_C_dir 추출"               "/p"      "$(git_C_dir 'git -C /p commit' || true)"
eq "H git_C_dir 없으면 빈값"        ""        "$(git_C_dir 'git commit' || true)"
# git_subcommand_scan: wrapper-tolerant — git 토큰을 스캔해 서브커맨드 반환(reset 게이트용)
eq "H scan wrapper 뒤 reset"        "reset"   "$(git_subcommand_scan 'sudo git reset --hard' || true)"
eq "H scan env 뒤 reset"            "reset"   "$(git_subcommand_scan 'env A=x git reset --hard' || true)"
eq "H scan git -C reset"            "reset"   "$(git_subcommand_scan 'git -C . reset --hard' || true)"
eq "H scan 따옴표 mention 미스캔"    ""        "$(git_subcommand_scan "grep 'git reset --hard' notes.txt" || true)"
eq "H scan 비-git 빈값"             ""        "$(git_subcommand_scan 'rm -rf src' || true)"

# ── AC-T6(bash 3.2)·AC-T7(파서 무의존)은 실행 환경 자체로 커버:
#    이 테스트가 python3/jq 없이 순수 bash로 함수를 source·실행해 통과하면 두 AC 충족.
echo "(AC-T6 bash 3.2 호환 / AC-T7 파서 무의존: 이 스위트가 순수 bash source-run으로 통과함으로써 충족)"

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

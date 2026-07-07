#!/bin/bash
# tests/guard-matrix-test.sh — guard.sh 계약 전수 매트릭스.
# 목적: force-push·reset·rm·commit 가드를 '계약(무엇을 막고 무엇을 허용)' 단위로 전수 검증한다.
#   guard-test.sh(시나리오/회귀)와 상보 — 이쪽은 계약 커버리지(흔한 형태·세그먼트·wrapper·체인·서브셸·현재브랜치 조합)로
#   구멍(막아야 하는데 통과)·과탐(정당한데 차단)을 한 번에 드러낸다. 로컬·CI 동일: bash tests/guard-matrix-test.sh
set -u
G="$(cd "$(dirname "$0")/.." && pwd)/plugins/harness-guard/scripts/guard.sh"
PASS=0; FAIL=0; HOLES=""; OVERB=""

mkrepo() { # branch [lite] → path (해당 브랜치로 초기화된 임시 git repo)
  local br="$1" lite="${2:-}" d; d=$(mktemp -d)
  git -C "$d" init -q
  git -C "$d" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
  git -C "$d" checkout -q -B "$br"
  [ -n "$lite" ] && : > "$d/.harness-lite"
  echo "$d"
}
MAIN=$(mkrepo main); DEV=$(mkrepo develop); FEAT=$(mkrepo feature/x)
LITE=$(mkrepo develop lite); DEVC=$(mkrepo develop)
trap 'rm -rf "$MAIN" "$DEV" "$FEAT" "$LITE" "$DEVC"' EXIT

m() { python3 -c "import json,sys; print(json.dumps({'tool_name':'Bash','tool_input':{'command':sys.argv[1]},'session_id':'s','cwd':sys.argv[2]}))" "$1" "$2"; }
case_() { # desc, want(2|0), command, cwd
  local desc="$1" want="$2" cmd="$3" dir="$4" rc
  rc=$( (cd "$dir" && m "$cmd" "$dir" | bash "$G" >/dev/null 2>&1); echo $? )
  if [ "$rc" = "$want" ]; then PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
    if [ "$want" = 2 ]; then HOLES="$HOLES\n  • $desc (막아야 하는데 exit=$rc)"; else OVERB="$OVERB\n  • $desc (정당한데 exit=$rc)"; fi
  fi
}

# ── force-push: DENY (main/develop 도달 — 흔한 형태·세그먼트·wrapper·체인·서브셸. best-effort 넛지, 정본 강제는 계층0) ──
case_ "force origin main"                2 "git push --force origin main"                 "$FEAT"
case_ "force -f origin develop"          2 "git push -f origin develop"                   "$FEAT"
case_ "force -fu origin main"            2 "git push -fu origin main"                     "$FEAT"
case_ "force +main refspec"              2 "git push origin +main"                        "$FEAT"
case_ "force +HEAD:main"                 2 "git push origin +HEAD:main"                   "$FEAT"
case_ "force refs/heads/main"           2 "git push --force origin refs/heads/main"      "$FEAT"
case_ "force HEAD:refs/heads/develop"   2 "git push -f origin HEAD:refs/heads/develop"   "$FEAT"
case_ "force-with-lease main"           2 "git push --force-with-lease origin main"      "$FEAT"
case_ "force non-origin remote main"    2 "git push -f upstream main"                    "$FEAT"
case_ "bare force on main"              2 "git push --force"                             "$MAIN"
case_ "bare -f on develop"             2 "git push -f"                                  "$DEV"
case_ "chained feat then main force"    2 "git push origin feature/x && git push --force origin main" "$FEAT"
case_ "chained main force then feat"    2 "git push -f origin main && git push origin feature/x"      "$FEAT"
case_ "chained feat-force develop-force" 2 "git push -f origin feature/x && git push -f origin develop" "$FEAT"
case_ "sudo prefix force main"          2 "sudo git push --force origin main"            "$FEAT"
case_ "git -C develop-repo bare force"  2 "git -C $DEVC push --force"                    "$FEAT"
case_ "semicolon-chained main force"    2 "echo hi; git push --force origin main"        "$FEAT"
# NOTE(#220): 서브셸 `(git push -f origin main)`은 차단 안 됨(수용된 best-effort 갭 — category(a) 넛지,
#   서버 branch protection이 정본). `)` 종단 패치(#224)는 echo mention 과탐 회귀를 낳아 되돌림.
# ── force-push: ALLOW (feature/비-force/언급) ──
case_ "force feature explicit"          0 "git push --force origin feature/x"            "$FEAT"
case_ "force feature on develop cwd"    0 "git push --force origin feature/x"            "$DEV"
case_ "force-with-lease feature"        0 "git push --force-with-lease origin feature/foo" "$FEAT"
case_ "non-force push feature"          0 "git push origin feature/x"                    "$FEAT"
case_ "--follow-tags feature non-force" 0 "git push --follow-tags origin feature/foo"    "$FEAT"
case_ "rebase main && feat force"       0 "git rebase main && git push --force-with-lease origin feature/foo" "$FEAT"
case_ "multi feature force"             0 "git push origin feature/a && git push --force origin feature/b" "$FEAT"
case_ "force featmain (substring)"      0 "git push --force origin featmain"             "$FEAT"
case_ "force mainfeature"               0 "git push --force origin mainfeature"          "$FEAT"
case_ "bare force on feature"           0 "git push --force"                             "$FEAT"
case_ "subshell force feature (allow)"  0 "(git push --force origin feature/x)"          "$FEAT"
# #224 회귀방지: echo/커밋메시지의 'main)' mention은 절대 오차단 금지(category(a) under-block 편향)
case_ "echo mention main) (allow)"      0 'echo "git push --force origin main)"'         "$FEAT"
case_ "echo subshell mention (allow)"   0 "echo 'see (git push --force origin main)'"    "$FEAT"

# ── reset --hard: DENY (변형/wrapper/LITE에서도) ──
case_ "reset --hard"                    2 "git reset --hard HEAD~1"                      "$DEV"
case_ "reset 2-space --hard"            2 "git reset  --hard HEAD~1"                     "$DEV"
case_ "reset arg-after --hard"          2 "git reset HEAD~1 --hard"                      "$DEV"
case_ "reset git -C --hard"             2 "git -C . reset --hard"                        "$DEV"
case_ "reset sudo prefix"               2 "sudo git reset --hard"                        "$DEV"
case_ "reset env prefix"                2 "env A=x git reset --hard"                     "$DEV"
case_ "reset even in LITE"              2 "git reset --hard"                             "$LITE"
# ── reset: ALLOW ──
case_ "reset --soft"                    0 "git reset --soft HEAD~1"                      "$FEAT"
case_ "grep mention reset --hard"       0 "grep 'git reset --hard' notes.txt"           "$DEV"

# ── #220-A 토큰 재설계 적대적 헌트 (reset = category(b) 무백스톱 — 신규 홀 0 반증) ──
# 토큰판정이 현행 정규식이 놓치던 난독화(따옴표 벗김·백슬래시·wrapper·서브셸)를 닫는다.
# 단 완결은 아님: ANSI-C `$'git' reset --hard`류는 여전히 통과한다(tokenize가 $'...'를 디코드 안 함).
#   이는 **현행 정규식도 동일하게 통과**하던 것이라 회귀 아니며, `$'...'`는 의도적 셸 문법이지
#   위협모델의 "혼란한 에이전트 반사적 형태"가 아니므로 category(b) "흔한 형태만" 원칙상 수용(정본 강제=계층0).
case_ "reset wrapper xargs"             2 "xargs git reset --hard"                       "$DEV"
case_ "reset wrapper nice"              2 "nice git reset --hard"                        "$DEV"
case_ "reset 백슬래시 \\git 난독화"      2 "\\git reset --hard"                           "$DEV"
case_ "reset 따옴표 --h\"\"ard 난독화"    2 'git reset --h""ard'                           "$DEV"
case_ "reset 서브셸 (…)"                2 "(git reset --hard)"                           "$DEV"
case_ "reset 체인 && 뒤"                2 "echo hi && git reset --hard"                  "$DEV"
case_ "reset 세미콜론 뒤"               2 "echo hi; git reset --hard"                    "$DEV"
# 과차단 반증(정당한데 차단 금지) — mention·soft·다른세그먼트 --hard
case_ "reset 따옴표 전체 mention"        0 'echo "git reset --hard"'                      "$DEV"
case_ "reset soft + 딴세그 --hard mention" 0 'git reset --soft && echo "--hard"'          "$FEAT"

# ── rm 코어/검증기: DENY ──
case_ "rm -rf src"                      2 "rm -rf src"                                   "$DEV"
case_ "rm -rf quoted src"               2 'rm -rf "src"'                                 "$DEV"
case_ "rm -rf single-quoted app"        2 "rm -rf 'app'"                                 "$DEV"
case_ "rm -rf node_modules"             2 "rm -rf node_modules"                          "$DEV"
case_ "rm -rf . at root"                2 "rm -rf ."                                     "$DEV"
case_ "rm -rf .. at root"               2 "rm -rf .."                                    "$DEV"
case_ "rm -rf tests (validator)"        2 "rm -rf tests"                                 "$FEAT"
case_ "rm -rf even in LITE"             2 "rm -rf src"                                   "$LITE"
# ── rm: ALLOW ──
case_ "rm -rf ./build"                  0 "rm -rf ./build"                               "$FEAT"
case_ "rm build log"                    0 "rm build/output.log"                          "$FEAT"
case_ "terraform -rf plan (word bound)" 0 "terraform -rf plan apply"                     "$DEV"

# ── #220-A Slice2 헌트: validator-delete·npm (category(b) — 신규 홀 0 + mention 과차단 해소) ──
# validator DENY (wrapper·따옴표 관용)
case_ "del wrapper sudo rm tests/"      2 "sudo rm tests/"                               "$FEAT"
case_ "del xargs rm test 파일"          2 "xargs rm src/foo.test.ts"                     "$FEAT"
case_ "del 따옴표 rm -rf 'tests'"        2 "rm -rf 'tests'"                               "$FEAT"
# 검증2차 회귀(HOLE-1): 파일패턴 $ 종단앵커가 glob/접미 트레일링을 놓치던 홀 — 비앵커 부분매치로 봉쇄
case_ "del glob *Test.java*"            2 "rm *Test.java*"                               "$FEAT"
case_ "del glob *_test.py*"             2 "rm *_test.py*"                                "$FEAT"
case_ "del 접미 foo_test.py.bak"        2 "rm foo_test.py.bak"                           "$FEAT"
case_ "del 접미 UserTest.java.orig"     2 "rm UserTest.java.orig"                        "$FEAT"
# validator ALLOW (mention·--rm 플래그·유사경로 — 현행 과차단 해소)
case_ "del mention echo rm tests/"      0 'echo "rm tests/"'                             "$FEAT"
case_ "del docker --rm 플래그"          0 "docker run --rm tests/img"                    "$FEAT"
case_ "del rm latest/ (유사경로)"        0 "rm latest/"                                   "$FEAT"
case_ "del rm 무관파일 통과"            0 "rm build/output.log"                          "$FEAT"
# ── #245 헌트: 검증기-삭제 커버리지 확장 (jest·복수형 migrations·rspec) ──
case_ "245 del __tests__/ (jest)"       2 "rm -rf __tests__/"                            "$FEAT"
case_ "245 del wrapper sudo __tests__/" 2 "sudo rm -rf __tests__/"                       "$FEAT"
case_ "245 del db/migrations/ (복수)"   2 "rm -rf db/migrations/"                        "$FEAT"
case_ "245 del migrations/ (단독복수)"  2 "rm -rf migrations/"                           "$FEAT"
case_ "245 del spec/ (rspec)"           2 "rm -rf spec/"                                 "$FEAT"
case_ "245 del 따옴표 'spec'"            2 "rm -rf 'spec'"                                "$FEAT"
# #245 ALLOW 과차단 반증 (접두경로·--rm·mention·유사)
case_ "245 del myspec/ (접두 통과)"     0 "rm -rf myspec/"                               "$FEAT"
case_ "245 del specs/ (비rspec 통과)"   0 "rm -rf specs/"                                "$FEAT"
case_ "245 del docker --rm spec/"       0 "docker run --rm spec/img"                     "$FEAT"
case_ "245 del mention __tests__"       0 'echo "rm __tests__/"'                         "$FEAT"
# npm DENY (wrapper·순서·=값)
case_ "npm wrapper sudo -g"             2 "sudo npm install -g leftpad"                  "$FEAT"
case_ "npm 순서 --global 먼저"          2 "npm --global install leftpad"                 "$FEAT"
case_ "npm --global=true"               2 "npm install --global=true leftpad"           "$FEAT"
# npm ALLOW (mention·ci·로컬)
case_ "npm mention echo install -g"     0 'echo "npm install -g x"'                      "$FEAT"
case_ "npm ci --global (비install)"     0 "npm ci --global"                              "$FEAT"
case_ "npm install 로컬"                0 "npm install --save-dev jest"                  "$FEAT"

# ── commit on 보호: DENY ──
case_ "commit on main"                  2 "git commit -m x"                              "$MAIN"
case_ "commit on develop"               2 "git commit -m x"                              "$DEV"
case_ "commit X= prefix develop"        2 "X= git commit -m x"                           "$DEV"
case_ "commit git -C develop-repo"      2 "git -C $DEVC commit -m x"                      "$FEAT"
# ── commit: ALLOW ──
case_ "commit on feature"               0 "git commit -m x"                              "$FEAT"
case_ "git log --grep=commit"           0 "git log --grep=commit"                        "$DEV"
case_ "grep mention git commit"         0 "grep 'git commit' f.txt"                      "$DEV"
case_ "commit on LITE develop"          0 "git commit -m x"                              "$LITE"

echo "결과: PASS=$PASS FAIL=$FAIL"
[ -n "$HOLES" ] && printf "\n=== HOLES (위험: 막아야 하는데 통과) ===%b\n" "$HOLES"
[ -n "$OVERB" ] && printf "\n=== OVERBLOCKS (과탐: 정당한데 차단) ===%b\n" "$OVERB"
[ "$FAIL" -eq 0 ]

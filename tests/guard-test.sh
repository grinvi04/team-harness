#!/bin/bash
# tests/guard-test.sh — harness-guard guard.sh 시나리오 테스트
# CI(ci-gate quality 잡)와 로컬에서 동일하게 실행: bash tests/guard-test.sh
set -u

G="$(cd "$(dirname "$0")/.." && pwd)/plugins/harness-guard/scripts/guard.sh"
PASS=0; FAIL=0

mk() { # tool_name, command → hook 입력 JSON
  python3 -c "import json,sys; print(json.dumps({'tool_name':sys.argv[1],'tool_input':{'command':sys.argv[2]}}))" "$1" "$2"
}

check() { # desc, expected_exit, tool, command, workdir
  local desc="$1" want="$2" tool="$3" cmd="$4" dir="$5"
  local out rc
  out=$(cd "$dir" && mk "$tool" "$cmd" | bash "$G" 2>&1); rc=$?
  if [ "$rc" = "$want" ]; then
    echo "PASS: $desc"; PASS=$((PASS+1))
  else
    echo "FAIL: $desc — expected exit $want, got $rc${out:+ ($out)}"; FAIL=$((FAIL+1))
  fi
}

# 테스트용 임시 git repo — 보호 브랜치(develop)와 작업 브랜치(feature/*) 각 1개
DEV=$(mktemp -d); FEAT=$(mktemp -d)
trap 'rm -rf "$DEV" "$FEAT" "${LITE_REPO:-}"' EXIT
for D in "$DEV" "$FEAT"; do
  git -C "$D" init -q
  git -C "$D" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
done
git -C "$DEV" checkout -q -b develop
git -C "$FEAT" checkout -q -b feature/test

check "develop 직접 커밋 차단"        2 Bash "git commit -m x"                  "$DEV"
check "feature 브랜치 커밋 통과"      0 Bash "git commit -m x"                  "$FEAT"
check "핵심 디렉터리 재귀 삭제 차단"  2 Bash "rm -rf src/"                      "$DEV"
check "rm 단어경계 — terraform 오탐 없음" 0 Bash "terraform -rf plan 적용"      "$DEV"
check "reset --hard 차단"             2 Bash "git reset --hard HEAD~1"          "$DEV"
check "main force push 차단"          2 Bash "git push --force origin main"     "$FEAT"
check "npm 글로벌 설치 차단"          2 Bash "npm install -g some-pkg"          "$DEV"
check "테스트 파일 rm 차단(Java)"     2 Bash "rm src/test/UserServiceTest.java" "$FEAT"
check "테스트 파일 rm 차단(spec)"     2 Bash "rm src/foo.spec.ts"               "$FEAT"
check "tests 디렉터리 rm 차단"        2 Bash "rm -rf backend/tests/"            "$FEAT"
check "git rm 테스트 삭제 차단"       2 Bash "git rm src/foo.test.tsx"          "$FEAT"
check "마이그레이션 rm 차단(flyway)"  2 Bash "rm db/migration/V2__x.sql"        "$FEAT"
check "마이그레이션 rm 차단(alembic)" 2 Bash "rm alembic/versions/abc_x.py"     "$FEAT"
# #245: 검증기-삭제 커버리지 확장 — jest __tests__/·복수형 migrations·rspec spec/
check "245: rm __tests__/ 차단(jest)"  2 Bash "rm -rf __tests__/"                 "$FEAT"
check "245: rm db/migrations/ 차단"    2 Bash "rm -rf db/migrations/"             "$FEAT"
check "245: rm migrations/ 차단(단독)" 2 Bash "rm -rf migrations/"                "$FEAT"
check "245: rm spec/ 차단(rspec)"      2 Bash "rm -rf spec/"                      "$FEAT"
# #245 과차단 반증 — 접두경로·--rm 플래그·mention 은 통과(앵커·토큰 격리)
check "245over: rm myspec/ 통과"       0 Bash "rm -rf myspec/"                    "$FEAT"
check "245over: docker --rm spec/ 통과" 0 Bash "docker run --rm spec/img"         "$FEAT"
check "245over: echo __tests__ 통과"   0 Bash 'echo "rm __tests__/"'              "$FEAT"
check "일반 파일 rm 통과"             0 Bash "rm build/output.log"              "$FEAT"
check "일반 명령 통과"                0 Bash "npm run build"                    "$DEV"
check "비Bash 도구 통과"              0 Edit ""                                 "$DEV"

# 맨손 gh pr create/merge 차단 — PR 생성·머지는 래퍼 스크립트(스킬) 경유만 허용
check "맨손 gh pr create 차단"        2 Bash "gh pr create --base develop --head feature/x --title t --body b" "$FEAT"
check "맨손 gh pr merge 차단"         2 Bash "gh pr merge 5 --merge --delete-branch" "$FEAT"
check "체인 속 gh pr create 차단"     2 Bash "git push -u origin feature/x && gh pr create --fill" "$FEAT"
check "래퍼 pr-create.sh 통과"        0 Bash "bash scripts/pr-create.sh --title t --body b" "$FEAT"
check "래퍼 pr-merge.sh 통과"         0 Bash "bash scripts/pr-merge.sh 5"        "$FEAT"
check "gh pr view 조회 통과"          0 Bash "gh pr view 5 --json state"        "$FEAT"
check "gh pr list 조회 통과"          0 Bash "gh pr list --state merged"        "$FEAT"
check "gh pr checks 통과"             0 Bash "gh pr checks 5 --required"         "$FEAT"
check "문자열 언급(grep) 오탐 없음"   0 Bash "grep -rn 'gh pr create' skills/"   "$FEAT"
check "문자열 언급(echo) 오탐 없음"   0 Bash "echo '맨손 gh pr merge 금지'"      "$FEAT"
check "정규식 alternation | 오탐 없음" 0 Bash "grep -E 'foo|gh pr create' f.txt"  "$FEAT"
check "alternation 속 gh pr merge 통과" 0 Bash "grep -E 'bar|gh pr merge' f.txt"   "$FEAT"
check "&& 뒤 gh pr create는 여전히 차단" 2 Bash "git push && gh pr create --fill"   "$FEAT"
check "공백 파이프 gh pr merge 차단"   2 Bash "echo y | gh pr merge 5"             "$FEAT"
check "공백 파이프 gh pr create 차단"  2 Bash "cat body.md | gh pr create --fill"   "$FEAT"
check "서브셸 닫힘 직후 gh pr create 차단" 2 Bash 'x=$(gh pr create)'                "$FEAT"

# feature-add plan-gate (감사 F5) — 신규 feature 브랜치 생성 시 상류 plan 아티팩트(docs/specs/<name>.md) 강제
mkdir -p "$DEV/docs/specs" && : > "$DEV/docs/specs/haveplan.md"
check "spec 없이 feature 브랜치 생성 차단"   2 Bash "git checkout -b feature/noplan"     "$DEV"
check "spec 있으면 feature 브랜치 통과"      0 Bash "git checkout -b feature/haveplan"   "$DEV"
check "HARNESS_TRIVIAL 명시 면제 통과"       0 Bash "HARNESS_TRIVIAL=1 git checkout -b feature/noplan" "$DEV"
check "fix 브랜치 생성은 게이트 무관 통과"   0 Bash "git checkout -b fix/noplan"         "$DEV"
check "기존 브랜치 전환(-b 없음) 통과"       0 Bash "git checkout feature/test"          "$DEV"
check "git switch -c feature 생성도 차단"    2 Bash "git switch -c feature/noplan"       "$DEV"
check "git switch -c fix 는 통과"            0 Bash "git switch -c fix/noplan"           "$DEV"

# 엔지니어링 리뷰 guard 하드닝 (G1~G5)
: > "$DEV/docs/specs/bar.md"
# G1: non-repo로의 후행 cd로 develop 커밋 가드 우회 불가(cd /tmp는 repo 아님 → 원래 cwd=develop 판정)
check "G1: commit && cd non-repo → develop 차단 유지" 2 Bash "git commit -m x && cd /tmp" "$DEV"
check "G1: cd 실제 feature repo && commit 통과"        0 Bash "cd $FEAT && git commit -m x" "$DEV"
# G2: 무관한 rm + 다른 세그먼트 tests/ 참조 오탐 없음
check "G2: rm 로그; grep tests/ 오탐 없음"    0 Bash "rm /tmp/x.log; grep foo tests/unit" "$FEAT"
check "G2npm: echo -g && npm install 오탐 없음" 0 Bash "echo -g && npm install foo"        "$FEAT"
check "npm ci --global 오탐 없음"             0 Bash "npm ci --global"                    "$FEAT"
# G3: npm 글로벌 설치는 플래그 순서 무관 차단
check "G3: npm --global install 차단"        2 Bash "npm --global install leftpad"       "$DEV"
check "G3: npm i --global 차단"              2 Bash "npm i --global leftpad"             "$DEV"
# G4: 서브셸 (checkout -b feature/bar) — spec 있으면 ')' 오탐 없이 통과
check "G4: 서브셸 (checkout -b feature/bar) spec有 통과" 0 Bash "(git checkout -b feature/bar)" "$DEV"
# G5: git branch 로 feature 생성해도 plan-gate 발동(무 spec 차단), 삭제는 무관
check "G5: git branch feature/(무spec) 차단"  2 Bash "git branch feature/noplan && git switch feature/noplan" "$DEV"
check "git branch -d 삭제는 게이트 무관 통과"  0 Bash "git branch -d feature/old"          "$FEAT"

# P1: guard 정규식 정확성 (감사 T2) — 우회 4 + 과차단 1
: > "$DEV/f.txt"
# A1: force-push 결합 단축플래그(-fu)·plus-refspec(+HEAD:main) — 외부 게이트가 놓치던 것
check "A1: git push -fu origin main 차단"       2 Bash "git push -fu origin main"           "$FEAT"
check "A1: git push +HEAD:main 차단"            2 Bash "git push origin +HEAD:main"         "$FEAT"
check "A1: 비보호 force push 통과"              0 Bash "git push --force origin featx"       "$FEAT"
# A2: git -C <보호repo> commit 은 cd 우회와 무관하게 그 repo 기준 판정
check "A2: git -C develop-repo commit 차단"     2 Bash "git -C $DEV commit -m x && cd $FEAT" "$FEAT"
# A3: 후행 슬래시 없는 디렉터리 통삭제
check "A3: rm -rf tests(슬래시無) 차단"          2 Bash "rm -rf tests"                       "$FEAT"
check "A3: git rm -r db/migration 차단"         2 Bash "git rm -r db/migration"             "$FEAT"
# A4: node_modules && 체인(끝 앵커 비대칭)
check "A4: rm -rf node_modules && echo 차단"    2 Bash "rm -rf node_modules && echo x"      "$FEAT"
# A5: commit 단어 과차단 제거 — 보호 브랜치에서 무해 명령 통과
check "A5: git log --grep=commit 통과"          0 Bash "git log --grep=commit"              "$DEV"
check "A5: git help commit 통과"                0 Bash "git help commit"                    "$DEV"
check "A5: grep 'git commit' 통과"              0 Bash "grep 'git commit' f.txt"            "$DEV"

# A5b (릴리즈 보안검토 회귀): commit 앞 임의 git 전역옵션(-c·--no-pager 등)은 여전히 직접커밋으로 차단.
# A5가 commit을 서브커맨드로 좁힐 때 -C만 허용해 `git -c user.name=x commit`이 우회되던 구멍 재봉쇄.
check "A5b: git -c ... commit(보호) 차단"       2 Bash "git -c user.name=x -c user.email=x@x commit -m x" "$DEV"
check "A5b: git --no-pager commit 차단"         2 Bash "git --no-pager commit -m x"          "$DEV"
check "A5b: git -c commit.gpgsign=false commit 차단" 2 Bash "git -c commit.gpgsign=false commit -m x" "$DEV"
check "A5b: 전역옵션 있어도 feature는 통과"     0 Bash "git -c user.name=x commit -m x"      "$FEAT"
check "A5b: git -c ... log --grep=commit 통과(과차단 방지)" 0 Bash "git -c user.name=x log --grep=commit" "$DEV"

# D2: 안전경로(legitimate) 과차단 방지 — 삭제/전역/보호가 아닌 무해 명령은 통과해야 한다(회귀 방지).
check "D2: 비force push(feature) 통과"          0 Bash "git push origin feature/x"           "$FEAT"
check "D2: git reset --soft 통과(≠--hard)"      0 Bash "git reset --soft HEAD~1"             "$FEAT"
check "D2: 테스트파일 mv(리네임) 통과(≠rm)"     0 Bash "mv src/foo.test.ts src/bar.test.ts"  "$FEAT"
check "D2: 마이그레이션 cat(읽기) 통과(≠rm)"    0 Bash "cat db/migration/V1__init.sql"       "$FEAT"
check "D2: npm install(로컬) 통과(≠-g)"         0 Bash "npm install"                         "$FEAT"
check "D2: npm install --save-dev 통과"         0 Bash "npm install --save-dev jest"         "$FEAT"
check "D2: git stash 통과"                      0 Bash "git stash"                           "$FEAT"
check "D2: 테스트파일 cp(복사) 통과(≠rm)"       0 Bash "cp src/a.test.ts /backup/"           "$FEAT"

# LITE: 경량 repo 면제(.harness-lite) — dev git-flow는 면제(통과), 파괴적 안전가드는 유지(차단)
LITE_REPO=$(mktemp -d)
git -C "$LITE_REPO" init -q
git -C "$LITE_REPO" checkout -q -b develop
: > "$LITE_REPO/.harness-lite"
git -C "$LITE_REPO" -c user.email=t@t -c user.name=t add -A
git -C "$LITE_REPO" -c user.email=t@t -c user.name=t commit -q -m init
check "LITE: develop 직접 커밋 통과"        0 Bash "git commit -m x"                "$LITE_REPO"
check "LITE: 맨손 gh pr create 통과"        0 Bash "gh pr create --fill"            "$LITE_REPO"
check "LITE: 맨손 gh pr merge 통과"         0 Bash "gh pr merge 5 --merge"          "$LITE_REPO"
check "LITE: main force push 통과"          0 Bash "git push --force origin main"   "$LITE_REPO"
check "LITE: 무spec feature 브랜치 통과"    0 Bash "git checkout -b feature/noplan" "$LITE_REPO"
check "LITE: reset --hard 여전히 차단(안전유지)"  2 Bash "git reset --hard HEAD~1"  "$LITE_REPO"
check "LITE: 테스트파일 rm 여전히 차단(안전유지)" 2 Bash "rm src/foo.test.ts"       "$LITE_REPO"
check "LITE: rm -rf core 여전히 차단(안전유지)"   2 Bash "rm -rf src/"              "$LITE_REPO"
check "LITE: npm -g 여전히 차단(안전유지)"        2 Bash "npm install -g x"         "$LITE_REPO"
# 마커 없는 repo는 여전히 차단(회귀 방지 — 면제가 전역 누출 안 됨)
check "非LITE: develop 커밋 여전히 차단"    2 Bash "git commit -m x"                "$DEV"

# H2P: 2차 심층 헌트 — 가드 우회 잔여(형제 가드가 이미 막는 변형을 다른 가드가 비대칭 누락)
# H1: reset --hard 를 공백·탭·인자후치·git -C·env-prefix 로 우회 (기존 리터럴 `git reset --hard`만 매칭)
check "H1: reset 이중공백 차단"          2 Bash "git reset  --hard HEAD~1"          "$DEV"
check "H1: reset 인자후치 차단"          2 Bash "git reset HEAD~1 --hard"           "$DEV"
check "H1: reset 탭 차단"                2 Bash $'git reset\t--hard HEAD~1'         "$DEV"
check "H1: reset git -C 차단"            2 Bash "git -C $DEV reset --hard HEAD~1"    "$FEAT"
check "H1: reset env-prefix 차단"        2 Bash "X= git reset --hard HEAD~1"        "$DEV"
check "H1over: reset --soft 통과 유지"   0 Bash "git reset  --soft HEAD~1"          "$FEAT"
check "H1over: grep 'reset --hard' 통과" 0 Bash "grep 'git reset --hard' f.txt"     "$DEV"
# H2: rm -rf . / .. 로 프로젝트 루트·상위 삭제 (정규화 case 가 맨몸 . / .. 토큰 누락)
check "H2: rm -rf . (루트) 차단"         2 Bash "rm -rf ."                          "$DEV"
check "H2: rm -rf .. (상위) 차단"        2 Bash "rm -rf .."                         "$DEV"
check "H2over: rm -rf ./build 통과"      0 Bash "rm -rf ./build"                    "$FEAT"
# M2: 핵심 디렉터리 rm 을 따옴표로 우회
check "M2: rm -rf \"src\" 차단"          2 Bash 'rm -rf "src"'                      "$DEV"
check "M2: rm -rf 'app' 차단"            2 Bash "rm -rf 'app'"                      "$DEV"
# M5: 검증기 삭제 가드를 따옴표로 우회
check "M5: rm -rf \"tests\" 차단"        2 Bash 'rm -rf "tests"'                    "$FEAT"
# M1: main/develop 직접커밋을 env-prefix·선행공백으로 우회
check "M1: X= git commit 차단"           2 Bash "X= git commit -m x"                "$DEV"
check "M1: 선행공백 git commit 차단"     2 Bash "   git commit -m x"                "$DEV"
check "M1: env A=1 B=2 commit 차단"      2 Bash "A=1 B=2 git commit -m x"           "$DEV"
check "M1over: echo git commit 통과"     0 Bash "echo git commit"                   "$DEV"
# M7: main/develop force push 를 git -C 로 우회 (commit 가드는 -C 잡는데 push는 비대칭 누락)
check "M7: git -C push --force main 차단" 2 Bash "git -C $DEV push --force origin main" "$FEAT"
check "M7: git -C push --force 암묵develop 차단" 2 Bash "git -C $DEV push --force"   "$FEAT"

# 6: fail-closed — python3가 있으나 실행 실패 시(깨짐) 전 가드 우회 대신 차단
FAKEBIN=$(mktemp -d); printf '#!/bin/sh\nexit 1\n' > "$FAKEBIN/python3"; chmod +x "$FAKEBIN/python3"
_rc=$(cd "$DEV" && printf '%s' '{"tool_name":"Bash","tool_input":{"command":"git reset --hard"}}' | PATH="$FAKEBIN:$PATH" bash "$G" >/dev/null 2>&1; echo $?)
if [ "$_rc" = 2 ]; then echo "PASS: 6: 깨진 python3 fail-closed"; PASS=$((PASS+1)); else echo "FAIL: 6: 깨진 python3 fail-closed — got $_rc"; FAIL=$((FAIL+1)); fi
rm -rf "$FAKEBIN"

# [D] #220: python3 부재/깨짐 시 jq 폴백 — python3의 유일 용도가 JSON 파싱이라 jq로 전체 가드 그대로 작동
#   (fail-closed 폭발반경을 'python3 부재'→'python3·jq 둘 다 부재'로 축소). jq도 없으면 여전히 fail-closed(안전측).
if command -v jq >/dev/null 2>&1; then
  NOPY=$(mktemp -d); printf '#!/bin/sh\nexit 1\n' > "$NOPY/python3"; chmod +x "$NOPY/python3"  # python3만 깨뜨림(jq는 원 PATH에 존재)
  # [D]a: 깨진 python3 + jq → 파괴가드 유지(reset --hard 차단) — 반증검증(degraded여도 load-bearing 유지)
  _rc=$(cd "$DEV" && printf '%s' '{"tool_name":"Bash","tool_input":{"command":"git reset --hard HEAD~1"}}' | PATH="$NOPY:$PATH" bash "$G" >/dev/null 2>&1; echo $?)
  [ "$_rc" = 2 ] && { echo "PASS: [D]a jq폴백 reset --hard 차단"; PASS=$((PASS+1)); } || { echo "FAIL: [D]a jq폴백 reset — got $_rc"; FAIL=$((FAIL+1)); }
  # [D]b: 깨진 python3 + jq → 무해 명령 통과(전면 fail-closed 아님) — 핵심 RED→GREEN
  _rc=$(cd "$FEAT" && printf '%s' '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}' | PATH="$NOPY:$PATH" bash "$G" >/dev/null 2>&1; echo $?)
  [ "$_rc" = 0 ] && { echo "PASS: [D]b jq폴백 무해명령 통과"; PASS=$((PASS+1)); } || { echo "FAIL: [D]b jq폴백 무해명령 — got $_rc(기대0)"; FAIL=$((FAIL+1)); }
  # [D]c: 깨진 python3 + jq → git-flow 넛지도 유지(develop 직접 커밋 차단) — 전체 가드 작동 증명
  _rc=$(cd "$DEV" && printf '%s' '{"tool_name":"Bash","tool_input":{"command":"git commit -m x"}}' | PATH="$NOPY:$PATH" bash "$G" >/dev/null 2>&1; echo $?)
  [ "$_rc" = 2 ] && { echo "PASS: [D]c jq폴백 develop커밋 차단"; PASS=$((PASS+1)); } || { echo "FAIL: [D]c jq폴백 develop커밋 — got $_rc"; FAIL=$((FAIL+1)); }
  # [D]e: 깨진 python3 + jq, valid-JSON이나 tool_input이 객체 아님(문자열) → jq command 추출 에러 → fail-closed.
  #   python3 브랜치는 추출 rc로 이미 fail-closed였으나 jq 브랜치가 _parsed=1을 무조건 세워 빈 COMMAND로 우회
  #   가능했던 대칭 결함(계약상 도달 불가하나 load-bearing 가드) 반증검증 — 위험명령이 통과(rc0)하면 안 됨.
  _rc=$(cd "$FEAT" && printf '%s' '{"tool_name":"Bash","tool_input":"git reset --hard HEAD~1"}' | PATH="$NOPY:$PATH" bash "$G" >/dev/null 2>&1; echo $?)
  [ "$_rc" = 2 ] && { echo "PASS: [D]e jq 비객체 tool_input fail-closed"; PASS=$((PASS+1)); } || { echo "FAIL: [D]e jq 비객체 tool_input — got $_rc(기대2·우회)"; FAIL=$((FAIL+1)); }
  rm -rf "$NOPY"
  # [D]d: python3·jq 둘 다 깨짐 → fail-closed(무해 명령도 차단) — 파서 없으면 안전측(coreutils는 원 PATH 유지)
  NONE=$(mktemp -d); for b in python3 jq; do printf '#!/bin/sh\nexit 1\n' > "$NONE/$b"; chmod +x "$NONE/$b"; done
  _rc=$(cd "$FEAT" && printf '%s' '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}' | PATH="$NONE:$PATH" bash "$G" >/dev/null 2>&1; echo $?)
  [ "$_rc" = 2 ] && { echo "PASS: [D]d 파서無 fail-closed"; PASS=$((PASS+1)); } || { echo "FAIL: [D]d 파서無 fail-closed — got $_rc(기대2)"; FAIL=$((FAIL+1)); }
  rm -rf "$NONE"
else
  echo "SKIP: [D] jq 폴백 테스트 (jq 미설치)"
fi

# 7: 감사로그 개행 위조 방지 — session_id 개행이 로그를 위조(추가 라인)하지 못함
FHOME=$(mktemp -d); mkdir -p "$FHOME/.claude/hooks"
printf '%s' '{"tool_name":"Bash","session_id":"a\nFORGED session=evil DENY x","cwd":"/x","tool_input":{"command":"git reset --hard"}}' | HOME="$FHOME" bash "$G" >/dev/null 2>&1
_lines=$(wc -l < "$FHOME/.claude/hooks/guard-block.log" 2>/dev/null | tr -d ' ')
if [ "$_lines" = 1 ]; then echo "PASS: 7: 감사로그 개행 위조 방지"; PASS=$((PASS+1)); else echo "FAIL: 7: 감사로그 개행 위조 — 로그 ${_lines:-0}줄(기대 1)"; FAIL=$((FAIL+1)); fi
rm -rf "$FHOME"

# #196: LITE 교차-repo 오염 방지 — 코드 repo(마커無)에서 실행하는 명령 뒤에 lite repo로 후행 cd해도 LITE-게이트 유지
check "#196: develop 커밋 && cd lite → 차단 유지" 2 Bash "git commit -m x && cd $LITE_REPO"          "$DEV"
check "#196: 무spec feature && cd lite → plan게이트 유지" 2 Bash "git checkout -b feature/evil && cd $LITE_REPO" "$DEV"
check "#196: git -C code commit && cd lite → 차단 유지" 2 Bash "git -C $DEV commit -m x && cd $LITE_REPO" "$FEAT"
# #196: npm 글로벌 =값 형태 우회 차단
check "#196: npm install --global=true 차단" 2 Bash "npm install --global=true leftpad"              "$DEV"
check "#196: npm --global=true install 차단" 2 Bash "npm --global=true install leftpad"              "$DEV"
# REJ2: force-push 완전수식 refspec·non-origin remote 차단(로컬 가드 정본화)
check "REJ2: force refs/heads/main 차단"     2 Bash "git push --force origin refs/heads/main"        "$FEAT"
check "REJ2: force HEAD:refs/heads/develop 차단" 2 Bash "git push -f origin HEAD:refs/heads/develop" "$FEAT"
check "REJ2: force upstream main 차단"       2 Bash "git push --force upstream main"                 "$FEAT"
check "REJ2over: force origin featmain 통과(오탐)" 0 Bash "git push --force origin featmain"          "$FEAT"

# #204: 자기-회귀 교정 — reset wrapper 우회 + force-push 과탐/명시refspec
# #4 reset --hard가 wrapper 프리픽스로 우회되던 것 차단(무백스톱 파괴가드)
check "#204: sudo git reset --hard 차단"       2 Bash "sudo git reset --hard HEAD~1"        "$DEV"
check "#204: env FOO=x git reset --hard 차단"  2 Bash "env FOO=x git reset --hard"          "$DEV"
check "#204: time git reset --hard 차단"       2 Bash "time git reset --hard"               "$DEV"
check "#204over: sudo git reset --soft 통과"   0 Bash "sudo git reset --soft HEAD~1"         "$FEAT"
# #1 force-push 목적지 판정을 push 세그먼트로 — rebase 인자·커밋메시지·주석의 main/develop 오탐 방지
check "#204: rebase main && feature force 통과" 0 Bash "git rebase main && git push --force-with-lease origin feature/foo" "$FEAT"
check "#204: 커밋메시지 main && feature force 통과" 0 Bash "git commit -m 'fix main' && git push --force origin feature/foo"   "$FEAT"
check "#204: --follow-tags feature push 통과(비force)" 0 Bash "git push --follow-tags origin feature/foo" "$FEAT"
# #5 명시 refspec feature force-push는 develop 체크아웃에서도 통과
check "#204: develop서 명시 feature force 통과" 0 Bash "git push --force origin feature/x"    "$DEV"
# 회귀 방지 — 여전히 차단되어야 하는 것
check "#204: origin main force 여전히 차단"    2 Bash "git push --force origin main"         "$FEAT"
check "#204: bare force(develop) 여전히 차단"  2 Bash "git push --force"                     "$DEV"

# #208: 체인된 다중 push의 뒤쪽 세그먼트 main/develop force-push도 차단(head -1 우회 교정)
check "#208: feat push && main force → 차단"   2 Bash "git push origin feature/x && git push --force origin main"     "$FEAT"
check "#208: feat force && develop force → 차단" 2 Bash "git push -f origin feature/x && git push -f origin develop"    "$FEAT"
check "#208: main force && feat push → 차단(순서무관)" 2 Bash "git push -f origin main && git push origin feature/x"    "$FEAT"
check "#208over: feat && feat force 통과(과탐없음)" 0 Bash "git push origin feature/a && git push --force origin feature/b" "$FEAT"

# #208: 감사로그 URL 크레덴셜 마스킹이 대문자 스킴(HTTPS://)도 처리 — 크레덴셜 평문 유출 방지
FHOME2=$(mktemp -d); mkdir -p "$FHOME2/.claude/hooks"
printf '%s' '{"tool_name":"Bash","session_id":"s","cwd":"/x","tool_input":{"command":"git reset --hard HTTPS://user:SECRETPASS@host/x"}}' | HOME="$FHOME2" bash "$G" >/dev/null 2>&1
if grep -q "SECRETPASS" "$FHOME2/.claude/hooks/guard-block.log" 2>/dev/null; then echo "FAIL: #208 대문자 URL 크레덴셜 로그 유출"; FAIL=$((FAIL+1)); else echo "PASS: #208 대문자 URL 크레덴셜 마스킹"; PASS=$((PASS+1)); fi
rm -rf "$FHOME2"

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

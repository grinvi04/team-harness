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
trap 'rm -rf "$DEV" "$FEAT"' EXIT
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

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

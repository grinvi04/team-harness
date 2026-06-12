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
check "일반 명령 통과"                0 Bash "npm run build"                    "$DEV"
check "비Bash 도구 통과"              0 Edit ""                                 "$DEV"

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

#!/bin/bash
# tests/pr-create-test.sh — pr-create.sh 순수 검증 함수(valid_title_body·is_base_branch) 단위 검증.
# gh/git 무관 — PRCREATE_SOURCE_ONLY로 함수만 로드. 로컬·CI 동일: bash tests/pr-create-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PC="$ROOT/plugins/harness-guard/scripts/pr-create.sh"
PASS=0; FAIL=0

tb() { # desc, title, body, want_rc(0=OK, 2=XOR 거절)
  local desc="$1" t="$2" b="$3" want="$4" rc
  rc=$(PRCREATE_SOURCE_ONLY=1 bash -c 'source "$1"; if valid_title_body "$2" "$3"; then echo 0; else echo $?; fi' _ "$PC" "$t" "$b")
  if [ "$rc" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want $want got $rc"; FAIL=$((FAIL+1)); fi
}
bb() { # desc, branch, want_rc(0=base=거절, 1=허용)
  local desc="$1" br="$2" want="$3" rc
  rc=$(PRCREATE_SOURCE_ONLY=1 bash -c 'source "$1"; if is_base_branch "$2"; then echo 0; else echo 1; fi' _ "$PC" "$br")
  if [ "$rc" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want $want got $rc"; FAIL=$((FAIL+1)); fi
}

# title/body: 둘 다 있거나 둘 다 없으면 OK(0), 한쪽만(XOR)이면 rc2로 선거절
tb "title+body 둘 다 → 0"       t  b   0
tb "둘 다 생략(--fill) → 0"     "" ""  0
tb "title만(body 없음) → rc2"   t  ""  2
tb "body만(title 없음) → rc2"   "" b   2

# base 브랜치(main/develop) → 거절(rc0), feature/fix → 허용(rc1)
bb "main → base(거절 0)"        main       0
bb "develop → base(거절 0)"     develop    0
bb "feature/x → 허용(1)"        feature/x  1
bb "fix/y → 허용(1)"            fix/y      1

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

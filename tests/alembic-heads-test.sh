#!/bin/bash
# tests/alembic-heads-test.sh — alembic-heads 게이트의 head-계수 로직 검증 (감사 E1 · verifier Finding1 회귀).
# 핵심: '(head)'만 세면 depends_on 의 '(effective head)'를 놓쳐 실제 다중 head가 통과(false-negative).
# 'head)' 패턴이 둘 다 세는지 + >1일 때만 차단하는지 검증. 로컬·CI 동일: bash tests/alembic-heads-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
YML="$ROOT/templates/ci/alembic-heads.yml"
PASS=0; FAIL=0

# 드리프트 가드 — 워크플로가 실제로 쓰는 계수 패턴을 이 테스트에 묶는다(YAML 패턴 변경 시 여기서 잡힘).
if grep -qF "grep -c 'head)'" "$YML"; then
  echo "PASS: alembic-heads.yml이 'head)' 계수 패턴 사용(effective head 포함)"; PASS=$((PASS+1))
else
  echo "FAIL: alembic-heads.yml 계수 패턴 드리프트 — 이 테스트의 로직과 불일치"; FAIL=$((FAIL+1))
fi

# 계수·차단 로직 = 워크플로와 동일: grep -c 'head)' → head 수, >1이면 차단
count() { printf '%s\n' "$1" | grep -c 'head)' || true; }
gate_blocks() { [ "$(count "$1")" -gt 1 ]; }   # rc0 = 차단(다중 head), rc1 = 통과

cnt_case() { # desc, alembic-heads-output, want_count
  local desc="$1" out="$2" want="$3" got; got=$(count "$out")
  if [ "$got" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want $want got $got"; FAIL=$((FAIL+1)); fi
}
blk_case() { # desc, output, want(block|pass)
  local desc="$1" out="$2" want="$3" got=pass; gate_blocks "$out" && got=block
  if [ "$got" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want $want got $got"; FAIL=$((FAIL+1)); fi
}

cnt_case "빈 출력(head 0) → 0"              ""                                            0
cnt_case "단일 head → 1"                    "abc123 (head)"                               1
cnt_case "2 plain head → 2"                 $'abc (head)\ndef (head)'                     2
cnt_case "effective head 포함(1+1) → 2"     $'abc (branchA) (head)\ndef (effective head)' 2
cnt_case "단일 effective head → 1"          "def (effective head)"                        1

blk_case "head 0 → 통과"                    ""                                            pass
blk_case "head 1(선형) → 통과"              "abc (head)"                                  pass
blk_case "head 2 → 차단"                    $'abc (head)\ndef (head)'                     block
blk_case "effective 섞인 2-head → 차단(F1)" $'abc (branchA) (head)\ndef (effective head)' block

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

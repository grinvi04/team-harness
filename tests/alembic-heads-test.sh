#!/bin/bash
# tests/alembic-heads-test.sh — alembic-heads 게이트의 head-계수 로직 검증 (감사 E1 · verifier Finding1 회귀).
# 핵심: '(head)'만 세면 depends_on 의 '(effective head)'를 놓쳐 실제 다중 head가 통과(false-negative).
# 'head)' 패턴이 둘 다 세는지 + >1일 때만 차단하는지 검증. 로컬·CI 동일: bash tests/alembic-heads-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
YML="$ROOT/templates/ci/alembic-heads.yml"
PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

extract_run_step() {
  local yaml="$1" step_name="$2" destination="$3"
  python3 - "$yaml" "$step_name" > "$destination" <<'PY'
import sys
from pathlib import Path

lines = Path(sys.argv[1]).read_text().splitlines()
needle = f"- name: {sys.argv[2]}"
try:
    step = next(i for i, line in enumerate(lines) if line.strip() == needle)
    run = next(i for i in range(step + 1, len(lines)) if lines[i].strip() == "run: |")
except StopIteration as error:
    raise SystemExit(f"missing workflow step or run block: {needle}") from error

indent = len(lines[run]) - len(lines[run].lstrip()) + 2
for line in lines[run + 1 :]:
    leading = len(line) - len(line.lstrip())
    if line.strip() and leading < indent:
        break
    print(line[indent:] if line.strip() else "")
PY
}

extract_run_step "$YML" "Alembic 다중 head 차단 (자기-스킵)" "$TMP/alembic-heads.sh"
mkdir -p "$TMP/bin"
cat > "$TMP/bin/pip" <<'MOCK'
#!/bin/bash
printf 'pip %s\n' "$*" >> "$FAKE_LOG"
exit "${PIP_RC:-0}"
MOCK
cat > "$TMP/bin/alembic" <<'MOCK'
#!/bin/bash
printf 'alembic %s\n' "$*" >> "$FAKE_LOG"
printf '%s\n' "${ALEMBIC_OUTPUT:-}"
exit "${ALEMBIC_RC:-0}"
MOCK
chmod +x "$TMP/bin/pip" "$TMP/bin/alembic"

gate_case() { # desc, config, pip rc, heads rc, output, expected gate rc/text/tools
  local desc="$1" config="$2" pip_rc="$3" heads_rc="$4" output="$5" want_rc="$6"
  local want_text="$7" want_tools="$8" got_tools
  local repo="$TMP/$desc" rc=0
  mkdir -p "$repo"
  [ "$config" = yes ] && touch "$repo/alembic.ini"
  : > "$TMP/fake.log"
  (
    cd "$repo" && PATH="$TMP/bin:$PATH" FAKE_LOG="$TMP/fake.log" PIP_RC="$pip_rc" \
      ALEMBIC_RC="$heads_rc" ALEMBIC_OUTPUT="$output" bash "$TMP/alembic-heads.sh"
  ) > "$TMP/$desc.log" 2>&1 || rc=$?
  got_tools=$(cat "$TMP/fake.log")
  if [ "$rc" = "$want_rc" ] && grep -Fq "$want_text" "$TMP/$desc.log" &&
    [ "$got_tools" = "$want_tools" ]; then
    echo "PASS: $desc → exit $rc"; PASS=$((PASS+1))
  else
    cat "$TMP/$desc.log"
    echo "FAIL: $desc → exit $rc (expected $want_rc; output should contain '$want_text')"; FAIL=$((FAIL+1))
  fi
}

# 드리프트 가드 — 워크플로가 실제로 쓰는 계수 패턴을 이 테스트에 묶는다(YAML 패턴 변경 시 여기서 잡힘).
if grep -qF "grep -c 'head)'" "$YML"; then
  echo "PASS: alembic-heads.yml이 'head)' 계수 패턴 사용(effective head 포함)"; PASS=$((PASS+1))
else
  echo "FAIL: alembic-heads.yml 계수 패턴 드리프트 — 이 테스트의 로직과 불일치"; FAIL=$((FAIL+1))
fi
# 드리프트 가드 — 게이트 임계값(다중 head = >1 차단)도 YAML의 실제 표현식에 묶는다(#199).
#   계수 패턴만 검증하면 임계값을 `-gt 2` 등으로 열어도 이 테스트가 green이라(게이트 조용히 개방) 실효성 없음.
if grep -qF -- '"${heads:-0}" -gt 1' "$YML"; then
  echo "PASS: alembic-heads.yml 임계값 '-gt 1'(2+ head 차단) 유지"; PASS=$((PASS+1))
else
  echo "FAIL: alembic-heads.yml 게이트 임계값 드리프트 — '[ \"\${heads:-0}\" -gt 1 ]' 아님(게이트가 열렸을 수 있음)"; FAIL=$((FAIL+1))
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

# Run the exact workflow step from the YAML with controlled external commands. No pip install
# or Alembic process outside these temporary fake executables is invoked.
gate_case "no-config-self-skip" no 0 0 "" 0 "self-skip" ""
gate_case "configured-install-failure" yes 23 0 "" 1 "alembic 설치 실패" "pip install --quiet alembic"
gate_case "configured-heads-failure" yes 0 24 "fixture heads failure" 1 "fixture heads failure" \
  $'pip install --quiet alembic\nalembic heads'
gate_case "configured-single-head" yes 0 0 "abc123 (head)" 0 "head=1" \
  $'pip install --quiet alembic\nalembic heads'
gate_case "configured-multiple-heads" yes 0 0 $'abc (head)\ndef (head)' 1 "head=2" \
  $'pip install --quiet alembic\nalembic heads'

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

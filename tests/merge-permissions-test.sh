#!/bin/bash
# tests/merge-permissions-test.sh — merge-permissions.mjs TDD 계약(RED)
# 로컬·CI 동일 실행: bash tests/merge-permissions-test.sh
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/merge-permissions.mjs"
FIX="$ROOT/tests/fixtures/merge-permissions"
FRAGS="$FIX/fragments"
PASS=0; FAIL=0

# 출력 JSON을 캡처한 뒤 python3 단언으로 검사
assert_out() {
  local desc="$1" assertion="$2"; shift 2
  local out
  out=$(node "$SCRIPT" "$@" 2>/dev/null)
  if echo "$out" | python3 -c "$assertion" 2>/dev/null; then
    echo "PASS: $desc"; PASS=$((PASS+1))
  else
    echo "FAIL: $desc"; FAIL=$((FAIL+1))
  fi
}

# AC1: typescript → node fragment 병합 → allow에 Bash(npm run *) 포함
# stub은 병합 안 함 → FAIL(RED 확인용)
assert_out \
  "AC1: --rules typescript → Bash(npm run *) 포함" \
  "import sys,json; d=json.load(sys.stdin); a=d['permissions']['allow']; exit(0 if 'Bash(npm run *)' in a else 1)" \
  --base "$FIX/base.json" --rules typescript --fragments "$FRAGS"

# AC2: python + alembic → python3·pytest·alembic 전부 포함
# stub은 병합 안 함 → FAIL(RED)
assert_out \
  "AC2: --rules python,alembic → python3·pytest·alembic 전부 포함" \
  "import sys,json; d=json.load(sys.stdin); a=d['permissions']['allow']; exit(0 if all(x in a for x in ['Bash(python3 *)', 'Bash(pytest *)', 'Bash(alembic *)']) else 1)" \
  --base "$FIX/base.json" --rules python,alembic --fragments "$FRAGS"

# AC3: typescript + base에 Bash(npm run *) 이미 존재 → dedup(1개) + Bash(npx jest *) 포함
# stub은 병합 안 하므로 Bash(npx jest *)가 없음 → FAIL(RED)
assert_out \
  "AC3: dedup — Bash(npm run *) 1개·Bash(npx jest *) 포함" \
  "import sys,json; d=json.load(sys.stdin); a=d['permissions']['allow']; exit(0 if a.count('Bash(npm run *)') == 1 and 'Bash(npx jest *)' in a else 1)" \
  --base "$FIX/base-with-npm.json" --rules typescript --fragments "$FRAGS"

# AC4: 알 수 없는 rule → 변화 없음, base allow 그대로
# stub은 병합 안 하므로 base 그대로 → 우연히 PASS 가능(의도된 예외)
assert_out \
  "AC4: --rules foobar → base allow 변화 없음 [stub PASS 가능]" \
  "import sys,json; d=json.load(sys.stdin); a=d['permissions']['allow']; exit(0 if a == ['Bash(git *)'] else 1)" \
  --base "$FIX/base.json" --rules foobar --fragments "$FRAGS"

# AC5: deny 보존 — 어떤 규칙 적용 후에도 deny는 base 그대로
# stub은 deny 건드리지 않으므로 → 우연히 PASS 가능(의도된 예외)
assert_out \
  "AC5: deny 보존 — Bash(sudo *) 유지 [stub PASS 가능]" \
  "import sys,json; d=json.load(sys.stdin); dny=d['permissions']['deny']; exit(0 if 'Bash(sudo *)' in dny else 1)" \
  --base "$FIX/base.json" --rules typescript --fragments "$FRAGS"

# AC6: --docker → docker-compose fragment 추가
# stub은 병합 안 함 → FAIL(RED)
assert_out \
  "AC6: --docker → Bash(docker-compose *) 포함" \
  "import sys,json; d=json.load(sys.stdin); a=d['permissions']['allow']; exit(0 if 'Bash(docker-compose *)' in a else 1)" \
  --base "$FIX/base.json" --rules typescript --docker --fragments "$FRAGS"

# AC7: --rules 값 공백 trim — ' typescript '(앞뒤 공백)도 node 병합 (코드리뷰 반영)
assert_out \
  "AC7: --rules ' typescript '(공백) → trim 후 node 병합" \
  "import sys,json; d=json.load(sys.stdin); a=d['permissions']['allow']; exit(0 if 'Bash(npm run *)' in a else 1)" \
  --base "$FIX/base.json" --rules " typescript " --fragments "$FRAGS"

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

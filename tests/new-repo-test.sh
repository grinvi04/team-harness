#!/bin/bash
# tests/new-repo-test.sh — new-repo.sh B4 게이트(prot_exit_ok) 단위 검증.
# 감사 B4(fail-open) 회귀 방지: 보호 적용 실패를 종료코드에 반영하는지(삼키지 않는지) 검증.
# NEWREPO_SOURCE_ONLY로 함수만 로드(git/gh/파일복사 없이). 로컬·CI 동일: bash tests/new-repo-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NR="$ROOT/scripts/new-repo.sh"
PASS=0; FAIL=0

exit_case() { # desc, prot_failed, want_rc
  local desc="$1" pf="$2" want="$3" rc
  rc=$(NEWREPO_SOURCE_ONLY=1 bash -c 'source "$1"; if prot_exit_ok "$2"; then echo 0; else echo 1; fi' _ "$NR" "$pf")
  if [ "$rc" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want $want got $rc"; FAIL=$((FAIL+1)); fi
}

# B4: 실패 플래그 0/미설정 → exit 0(성공), 1 → exit 1(실패를 삼키지 않고 반영)
exit_case "PROT_FAILED=0 → 성공(0)"        0   0
exit_case "PROT_FAILED=1 → 실패반영(1)"    1   1
exit_case "PROT_FAILED='' → 기본0·성공(0)" ""  0

if grep -Fq '.claude/rules/*.md' "$ROOT/templates/AGENTS.md"; then
  echo "PASS: AGENTS template → Codex stack-rule pointer"; PASS=$((PASS+1))
else
  echo "FAIL: AGENTS template → Codex stack-rule pointer 누락"; FAIL=$((FAIL+1))
fi

if grep -Fq '| 개발 워크플로 | developer-workflow.md |' "$ROOT/templates/AGENTS.md"; then
  echo "PASS: AGENTS template → 개발자 워크플로 가이드 발견 경로"; PASS=$((PASS+1))
else
  echo "FAIL: AGENTS template → 개발자 워크플로 가이드 발견 경로 누락"; FAIL=$((FAIL+1))
fi

# #425: path-scoped Next.js rule은 root 앱뿐 아니라 src/·모노레포 앱에서도 실제로 로드돼야 한다.
if ROOT="$ROOT" node <<'NODE'
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const rule = readFileSync(join(process.env.ROOT, 'templates/rules/stacks/nextjs.md'), 'utf8')
const pathsLine = rule.split('\n').find((line) => line.startsWith('paths: '))
const patterns = JSON.parse(pathsLine.slice('paths: '.length))
const required = [
  ['**/app/**/*.tsx', 'root·src·모노레포 App Router TSX'],
  ['**/app/**/*.ts', 'root·src·모노레포 App Router TS'],
  ['**/pages/**/*.tsx', 'root·모노레포 Pages Router TSX'],
  ['**/pages/**/*.ts', 'root·모노레포 Pages API TS'],
  ['**/middleware.ts', 'root·모노레포 middleware'],
  ['**/next.config.*', 'root·모노레포 next.config'],
]

for (const [pattern, contract] of required) {
  if (!patterns.includes(pattern)) {
    console.error(`Next.js rule path 누락: ${pattern} (${contract})`)
    process.exit(1)
  }
}
for (const pattern of ['**/*.ts', '**/*.tsx']) {
  if (patterns.includes(pattern)) {
    console.error(`Next.js rule path 과매칭: ${pattern}`)
    process.exit(1)
  }
}
NODE
then
  echo "PASS: Next.js rule → root·src·모노레포 경로 로드"; PASS=$((PASS+1))
else
  echo "FAIL: Next.js rule → root·src·모노레포 경로 계약 위반"; FAIL=$((FAIL+1))
fi

if grep -Fq 'check-commit-message.cjs' "$ROOT/scripts/new-repo.sh" \
  && grep -Fq 'templates/githooks/commit-msg' "$ROOT/scripts/new-repo.sh" \
  && grep -Fq 'chmod +x .githooks/commit-msg' "$ROOT/scripts/new-repo.sh"; then
  echo "PASS: 신규 repo → commit validator·commit-msg hook 설치"; PASS=$((PASS+1))
else
  echo "FAIL: 신규 repo → commit validator·commit-msg hook 배선 누락"; FAIL=$((FAIL+1))
fi

# Exercise the actual setup entrypoint; only the remote API boundary is replaced.
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"
cat > "$TMP/bin/gh" <<'MOCK'
#!/bin/bash
if [ "$1" = repo ]; then echo acme/example; exit 0; fi
endpoint="$2"
if [[ " $* " == *" -X PUT "* ]]; then echo "$endpoint" >> "$WRITE_LOG"; echo '{}'; exit 0; fi
case "$endpoint" in
  repos/acme/example/branches/main|repos/acme/example/branches/develop)
    if [ "$SETUP_CASE" = protected ]; then echo true
    elif [ "$SETUP_CASE" = api-error ]; then exit 1
    else echo false; fi ;;
  repos/acme/example) echo main ;;
  repos/acme/example/contents/.github/workflows/commitlint.yml)
    if [ "$SETUP_CASE" = missing ]; then exit 1
    elif [ "$SETUP_CASE" = legacy ]; then echo 0000000000000000000000000000000000000000
    else echo "$WORKFLOW_BLOB"; fi ;;
  repos/acme/example/contents/scripts/check-commit-message.cjs)
    if [ "$SETUP_CASE" = validator-missing ]; then exit 1; fi
    echo "$VALIDATOR_BLOB" ;;
  repos/acme/example/contents/.github/workflows*) echo '[]' ;;
  *) echo "unexpected API: $*" >&2; exit 1 ;;
esac
MOCK
chmod +x "$TMP/bin/gh"
git init -q "$TMP/source"
git -C "$TMP/source" -c user.name=test -c user.email=test@example.com -c core.hooksPath=/dev/null \
  commit --allow-empty -qm 'docs: 초기 기준 추가'
git -C "$TMP/source" branch -M main
git -C "$TMP/source" branch develop
export WORKFLOW_BLOB VALIDATOR_BLOB
WORKFLOW_BLOB=$(git hash-object "$ROOT/templates/ci/commitlint.yml")
VALIDATOR_BLOB=$(git hash-object "$ROOT/scripts/check-commit-message.cjs")
for scenario in protected missing legacy validator-missing api-error ready; do
  git clone -q "$TMP/source" "$TMP/$scenario"
  export SETUP_CASE="$scenario" WRITE_LOG="$TMP/$scenario-writes"
  : > "$WRITE_LOG"
  rc=0
  (cd "$TMP/$scenario" && printf '1\n' | PATH="$TMP/bin:$PATH" bash "$NR") > "$TMP/$scenario.log" 2>&1 || rc=$?
  writes=$(wc -l < "$WRITE_LOG" | tr -d ' ')
  expected=0; expected_rc=1
  [ "$scenario" = protected ] && expected_rc=0
  if [ "$scenario" = ready ]; then expected=2; expected_rc=0; fi
  if [ "$writes" = "$expected" ] && [ "$rc" = "$expected_rc" ]; then
    echo "PASS: setup $scenario → protection writes=$writes exit=$rc"; PASS=$((PASS+1))
  else
    cat "$TMP/$scenario.log"
    echo "FAIL: setup $scenario → writes=$writes/$expected exit=$rc/$expected_rc"; FAIL=$((FAIL+1))
  fi
done

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

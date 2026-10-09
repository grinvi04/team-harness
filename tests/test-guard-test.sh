#!/bin/bash
# Exercise the real test-guard workflow run step against isolated local Git repositories.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKFLOW_SOURCE="${TEST_GUARD_WORKFLOW:-$ROOT/.github/workflows/test-guard.yml}"
TEMPLATE_SOURCE="${TEST_GUARD_TEMPLATE:-$ROOT/templates/ci/test-guard.yml}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0
SCENARIOS=0
REAL_GIT="$(command -v git)"

report() {
  local desc="$1" ok="$2"
  SCENARIOS=$((SCENARIOS + 1))
  if [ "$ok" = true ]; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc"
    FAIL=$((FAIL + 1))
  fi
}

extract_run_step() {
  local yaml="$1" destination="$2"
  python3 - "$yaml" > "$destination" <<'PY'
import sys
from pathlib import Path

lines = Path(sys.argv[1]).read_text().splitlines()
needle = "- name: Detect test removals"
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

extract_run_step "$WORKFLOW_SOURCE" "$TMP/workflow.sh"
extract_run_step "$TEMPLATE_SOURCE" "$TMP/template.sh"
if cmp -s "$TMP/workflow.sh" "$TMP/template.sh"; then
  report "workflow and new-repo template execute the same test-guard block" true
else
  report "workflow and new-repo template execute the same test-guard block" false
fi

BASE_TESTS="$TMP/base-tests.sh"
cat > "$BASE_TESTS" <<'TESTS'
RUNS=0
FAILURES=0
check() { RUNS=$((RUNS + 1)); [ "$3" = true ] || FAILURES=$((FAILURES + 1)); }
case_() { RUNS=$((RUNS + 1)); [ "$3" = true ] || FAILURES=$((FAILURES + 1)); }
check "check assertion" 0 true
case_ "case assertion" 0 true
[ "$RUNS" -gt 0 ] || { echo "no tests executed"; exit 17; }
[ "$FAILURES" -eq 0 ] || { echo "assertion failure"; exit 18; }
TESTS

BASE_OTHER="$TMP/base-other-styles.txt"
cat > "$BASE_OTHER" <<'TESTS'
@Test
it("javascript it")
test("javascript test")
def test_python():
it "ruby block" do
test "minitest block" do
the feature "billing" and we test "prose" as examples
TESTS

setup_repo() {
  local name="$1" mutation="$2" repo="$TMP/repo-$1" remote="$TMP/remote-$1.git"
  mkdir -p "$repo/tests"
  git init -q --bare "$remote"
  git init -q "$repo"
  git -C "$repo" config user.name "test-guard regression"
  git -C "$repo" config user.email "test-guard@example.invalid"
  git -C "$repo" checkout -qb main
  cp "$BASE_TESTS" "$repo/tests/cases.sh"
  cp "$BASE_OTHER" "$repo/tests/other-styles.txt"
  git -C "$repo" add tests
  git -C "$repo" commit -qm "test: base marker forms"
  git -C "$repo" remote add origin "$remote"
  git -C "$repo" push -q origin main
  git -C "$repo" fetch -q origin main
  git -C "$repo" checkout -qb pr

  case "$mutation" in
    normal) ;;
    remove-check)
      python3 - "$repo/tests/cases.sh" check <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
path.write_text("\n".join(line for line in path.read_text().splitlines() if not line.startswith(sys.argv[2] + " ")) + "\n")
PY
      ;;
    remove-case)
      python3 - "$repo/tests/cases.sh" case_ <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
path.write_text("\n".join(line for line in path.read_text().splitlines() if not line.startswith(sys.argv[2] + " ")) + "\n")
PY
      ;;
    remove-all)
      printf '%s\n' 'the feature "billing" is described here' > "$repo/tests/cases.sh"
      printf '%s\n' 'ordinary prose only' > "$repo/tests/other-styles.txt"
      ;;
    forced-failure)
      python3 - "$repo/tests/cases.sh" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
path.write_text(path.read_text().replace('check "check assertion" 0 true', 'check "check assertion" 0 false'))
PY
      ;;
    zero-runtime)
      python3 - "$repo/tests/cases.sh" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
lines = path.read_text().splitlines()
calls = [line for line in lines if line.startswith(("check ", "case_ "))]
lines = [line for line in lines if line not in calls]
insert = lines.index('[ "$RUNS" -gt 0 ] || { echo "no tests executed"; exit 17; }')
lines[insert:insert] = ["if false; then", *["  " + line for line in calls], "fi"]
path.write_text("\n".join(lines) + "\n")
PY
      ;;
    *) echo "unknown test mutation: $mutation" >&2; return 2 ;;
  esac

  git -C "$repo" add tests
  git -C "$repo" commit --allow-empty -qm "test: PR candidate $mutation"
  printf '%s\n' "$repo"
}

run_guard() {
  local script="$1" repo="$2" logfile="$3" labels="${4:-[]}" rc=0
  (cd "$repo" && BASE=main LABELS="$labels" bash "$script") > "$logfile" 2>&1 || rc=$?
  printf '%s' "$rc"
}

guard_case() { # description, workflow script, mutation, expected exit, expected counts
  local desc="$1" script="$2" mutation="$3" want_rc="$4" want_counts="$5"
  local repo rc log="$TMP/$desc.log" ok=false
  repo=$(setup_repo "$desc" "$mutation") || return 1
  rc=$(run_guard "$script" "$repo" "$log")
  if [ "$rc" = "$want_rc" ] && grep -Fq "$want_counts" "$log"; then ok=true; fi
  if [ "$ok" != true ]; then cat "$log"; fi
  report "$desc" "$ok"
}

guard_case "normal supported forms preserve count" "$TMP/workflow.sh" normal 0 \
  "base(main)=8, PR(merge)=8"
guard_case "removed check assertion is rejected" "$TMP/workflow.sh" remove-check 1 \
  "base(main)=8, PR(merge)=7"
guard_case "removed case_ assertion is rejected" "$TMP/workflow.sh" remove-case 1 \
  "base(main)=8, PR(merge)=7"
guard_case "previously applicable set cannot become empty" "$TMP/workflow.sh" remove-all 1 \
  "base(main)=8, PR(merge)=0"

NORMAL_REPO=$(setup_repo "normal-runtime" normal)
NORMAL_RUNNER_RC=0
bash "$NORMAL_REPO/tests/cases.sh" > "$TMP/normal-runtime.log" 2>&1 || NORMAL_RUNNER_RC=$?
if [ "$NORMAL_RUNNER_RC" -eq 0 ]; then
  report "normal fixture test runner executes its check and case_ assertions" true
else
  cat "$TMP/normal-runtime.log"
  report "normal fixture test runner executes its check and case_ assertions" false
fi

# These mutations preserve source markers. The count-only guard should pass; the separate
# runtime fixture demonstrates that the required test execution/quality gate must reject them.
for mutation in forced-failure zero-runtime; do
  repo=$(setup_repo "$mutation" "$mutation")
  rc=$(run_guard "$TMP/workflow.sh" "$repo" "$TMP/$mutation-guard.log")
  if [ "$rc" = 0 ] && grep -Fq "base(main)=8, PR(merge)=8" "$TMP/$mutation-guard.log"; then
    bash "$repo/tests/cases.sh" > "$TMP/$mutation-runner.log" 2>&1
    runner_rc=$?
    if [ "$runner_rc" -ne 0 ]; then
      report "$mutation: count guard passes marker-preserving input; separate runner rejects it" true
    else
      report "$mutation: count guard passes marker-preserving input; separate runner rejects it" false
    fi
  else
    report "$mutation: count guard passes marker-preserving input; separate runner rejects it" false
  fi
done

guard_case "template rejects a removed check assertion" "$TMP/template.sh" remove-check 1 \
  "base(main)=8, PR(merge)=7"

FETCH_REPO=$(setup_repo "fetch-failure" normal)
mkdir -p "$TMP/fake-bin"
cat > "$TMP/fake-bin/git" <<'MOCK'
#!/bin/bash
if [ "$1" = fetch ]; then echo "fixture fetch failure" >&2; exit 23; fi
exec "$REAL_GIT" "$@"
MOCK
chmod +x "$TMP/fake-bin/git"
FETCH_RC=0
(cd "$FETCH_REPO" && REAL_GIT="$REAL_GIT" PATH="$TMP/fake-bin:$PATH" BASE=main LABELS='[]' \
  bash "$TMP/workflow.sh") > "$TMP/fetch-failure.log" 2>&1 || FETCH_RC=$?
if [ "$FETCH_RC" -ne 0 ] && grep -Fq "fixture fetch failure" "$TMP/fetch-failure.log"; then
  report "failed base fetch is not converted into a passing count" true
else
  cat "$TMP/fetch-failure.log"
  report "failed base fetch is not converted into a passing count" false
fi

if [ "$SCENARIOS" -eq 0 ]; then
  echo "FAIL: no test-guard scenarios executed"
  FAIL=$((FAIL + 1))
fi
echo "Results: $PASS passed, $FAIL failed across $SCENARIOS scenarios"
[ "$FAIL" -eq 0 ] && [ "$SCENARIOS" -gt 0 ]

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Observe PR fetch/validator calls without recording auth values or running PR code.
REAL_GIT="$(command -v git)"
REAL_NODE="$(command -v node)"
mkdir -p "$TMP/trace-bin"
cat > "$TMP/trace-bin/git" <<'TRACE'
#!/usr/bin/env bash
[ "${1:-}" != fetch ] || printf 'fetch\n' >> "$TRUSTED_CALL_LOG"
[ "${1:-}:${TRUSTED_REV_LIST_FAIL:-0}" != rev-list:1 ] || exit 128
exec "$REAL_GIT" "$@"
TRACE
cat > "$TMP/trace-bin/node" <<'TRACE'
#!/usr/bin/env bash
[ "${1:-}" != scripts/check-commit-message.cjs ] || printf 'validator\n' >> "$TRUSTED_CALL_LOG"
exec "$REAL_NODE" "$@"
TRACE
chmod +x "$TMP/trace-bin/git" "$TMP/trace-bin/node"

# Final deployment has one trusted source and a matching consumer template.
if [ -e "$ROOT/.github/workflows/commitlint.yml" ]; then
  echo 'FAIL: legacy workflow must be retired after the required-check handoff'
  exit 1
fi
cmp "$ROOT/.github/workflows/commitlint-trusted.yml" "$ROOT/templates/ci/commitlint.yml"
ROOT="$ROOT" node --input-type=module -e '
  const { selectStack } = await import(process.env.ROOT + "/scripts/stack-catalog.mjs");
  const selections = Array.from({ length: 6 }, (_, i) => String(i + 1));
  for (const backend of [1, 2, 3, 4]) for (const frontend of [1, 5, 6]) selections.push(`${backend}+${frontend}`);
  for (const id of selections) {
    const checks = selectStack(id).checks;
    for (const required of ["test-guard", "commitlint-trusted"]) {
      if (!checks.includes(required)) throw new Error(`stack ${id}: missing ${required}`);
    }
  }
  console.log("PASS: all 6 single stacks and 12 compositions retain trusted commitlint and test-guard requirements");'
# The actual setup-to-protection handoff is exercised in new-repo-test.sh.

# Parse the workflow contract, then execute its actual shell against local Git objects.
ruby -ryaml -e '
  file, output = ARGV
  doc = YAML.safe_load(File.read(file))
  events = doc["on"] || doc[true]
  abort "FAIL: trusted event" unless events.keys == ["pull_request_target"]
  abort "FAIL: retarget coverage" unless events["pull_request_target"]["types"].sort == %w[edited opened reopened synchronize]
  abort "FAIL: read-only token" unless doc["permissions"] == {"contents" => "read"}
  jobs = doc.fetch("jobs")
  abort "FAIL: unique check" unless jobs.keys == ["commitlint-trusted"]
  job = jobs.fetch("commitlint-trusted")
  abort "FAIL: conditional required job" if job.key?("if") || job.key?("continue-on-error")
  steps = job.fetch("steps")
  checkout = steps.fetch(0)
  abort "FAIL: trusted checkout" unless checkout.fetch("with") == {"ref" => "${{ github.sha }}", "fetch-depth" => 0, "persist-credentials" => false}
  abort "FAIL: unexpected execution" unless steps.length == 2 && steps[1].key?("run")
  script = steps[1].fetch("run")
  abort "FAIL: shell expression interpolation" if script.include?("${{")
  File.write(output, script)
' "$ROOT/.github/workflows/commitlint-trusted.yml" "$TMP/run.sh"

git init -q "$TMP/source"
git -C "$TMP/source" config user.name test
git -C "$TMP/source" config user.email test@example.com
mkdir -p "$TMP/source/scripts"
cp "$ROOT/scripts/check-commit-message.cjs" "$TMP/source/scripts/"
git -C "$TMP/source" add .
git -C "$TMP/source" -c core.hooksPath=/dev/null commit -qm 'docs: 검사 기준 추가'
git -C "$TMP/source" branch -M main
BASE_SHA="$(git -C "$TMP/source" rev-parse HEAD)"
git -C "$TMP/source" branch develop
git -C "$TMP/source" switch -qc candidate
printf 'PR 데이터 전용\n' > "$TMP/source/candidate-only.txt"
git -C "$TMP/source" add .
git -C "$TMP/source" -c core.hooksPath=/dev/null commit -qm 'docs: 후보 데이터 추가'
HEAD_SHA="$(git -C "$TMP/source" rev-parse HEAD)"
git -C "$TMP/source" update-ref refs/pull/1/head "$HEAD_SHA"
git clone -q --no-local "$TMP/source" "$TMP/runner"
git -C "$TMP/runner" checkout -q "$BASE_SHA"

run_case() {
  local label="$1" expected="$2" base_ref="$3" head_ref="$4" head_sha="$5" pr_number="${6:-1}" code=0
  local pr_state="${7-open}" pr_merged="${8-false}" event_action="${9-synchronize}"
  : > "$TMP/calls.log"
  (cd "$TMP/runner" && BASE_REF="$base_ref" HEAD_REF="$head_ref" BASE_SHA="$BASE_SHA" \
    HEAD_SHA="$head_sha" PR_NUMBER="$pr_number" READ_TOKEN=local-test \
    PR_STATE="$pr_state" PR_MERGED="$pr_merged" EVENT_ACTION="$event_action" \
    REAL_GIT="$REAL_GIT" REAL_NODE="$REAL_NODE" TRUSTED_CALL_LOG="$TMP/calls.log" PATH="$TMP/trace-bin:$PATH" \
    bash -eo pipefail "$TMP/run.sh") > "$TMP/result" 2>&1 || code=$?
  if [ "$code" -ne "$expected" ]; then
    cat "$TMP/result"
    echo "FAIL: $label expected=$expected got=$code"
    exit 1
  fi
  if [ "${10:-}" = no-inspection ]; then
    test ! -s "$TMP/calls.log"
    rg -q "병합된 PR의 기록 변경: 새 커밋 검사는 비적용입니다" "$TMP/result"
  fi
  test "$(git -C "$TMP/runner" rev-parse HEAD)" = "$BASE_SHA"
  test ! -e "$TMP/runner/candidate-only.txt"
  cmp "$ROOT/scripts/check-commit-message.cjs" "$TMP/runner/scripts/check-commit-message.cjs"
  test -z "$(git -C "$TMP/runner" status --porcelain)"
  echo "PASS: $label; trusted worktree unchanged"
}
run_case 'develop full range' 0 develop candidate "$HEAD_SHA"
run_case 'main release range' 0 main release/v1.0.0 "$HEAD_SHA"
run_case 'stale event head rejected' 1 develop candidate "$BASE_SHA"
run_case 'missing PR objects rejected' 128 develop candidate "$HEAD_SHA" 2
run_case 'invalid PR number rejected' 1 develop candidate "$HEAD_SHA" invalid

git -C "$TMP/source" -c core.hooksPath=/dev/null commit --allow-empty -qm 'invalid message'
HEAD_SHA="$(git -C "$TMP/source" rev-parse HEAD)"
git -C "$TMP/source" update-ref refs/pull/1/head "$HEAD_SHA"
run_case 'invalid commit message rejected' 1 develop candidate "$HEAD_SHA"
git -C "$TMP/source" update-ref refs/heads/main "$HEAD_SHA"
run_case 'pure main backmerge accepted' 0 develop sync/backmerge-v1.0.0 "$HEAD_SHA"
git -C "$TMP/source" -c core.hooksPath=/dev/null commit --allow-empty -qm 'invalid resolution'
HEAD_SHA="$(git -C "$TMP/source" rev-parse HEAD)"
git -C "$TMP/source" update-ref refs/pull/1/head "$HEAD_SHA"
run_case 'backmerge unique violation rejected' 1 develop sync/backmerge-v1.0.0 "$HEAD_SHA"


# Reset the fixture to a valid release already included in develop: PR537's symptom.
git -C "$TMP/source" switch -qc final-record "$BASE_SHA"
git -C "$TMP/source" -c core.hooksPath=/dev/null commit --allow-empty -qm 'docs: 전달 기록 추가'
HEAD_SHA="$(git -C "$TMP/source" rev-parse HEAD)"
git -C "$TMP/source" update-ref refs/pull/1/head "$HEAD_SHA"
git -C "$TMP/source" update-ref refs/heads/develop "$HEAD_SHA"
run_case 'merged main edited after backmerge is non-applicable' 0 main release/v1.0.0 "$HEAD_SHA" 1 closed true edited no-inspection
run_case 'merged develop edited is non-applicable' 0 develop candidate "$HEAD_SHA" 1 closed true edited no-inspection
run_case 'merged backmerge edited is non-applicable' 0 develop sync/backmerge-v1.0.0 "$HEAD_SHA" 1 closed true edited no-inspection
run_case 'merged edited needs no archived PR objects' 0 main release/v1.0.0 "$HEAD_SHA" 2 closed true edited no-inspection
# A nonempty release already checked on protected develop is Git Flow's forward path.
run_case 'pure develop forward opened accepted' 0 main release/docs-guide "$HEAD_SHA" 1 open false opened
run_case 'pure develop forward edited accepted' 0 main release/v1.0.0 "$HEAD_SHA" 1 open false edited
run_case 'pure develop forward reopened accepted' 0 main release/v1.0.0 "$HEAD_SHA" 1 open false reopened
test -s "$TMP/calls.log"
test "$(grep -c '^fetch$' "$TMP/calls.log")" -eq 3
test "$(grep -c '^validator$' "$TMP/calls.log" || true)" -eq 0
run_case 'non-release pure develop forward rejected' 1 main codex/premature "$HEAD_SHA"
export TRUSTED_REV_LIST_FAIL=1
run_case 'pure forward Git range read failure rejected' 128 main release/docs-guide "$HEAD_SHA"
unset TRUSTED_REV_LIST_FAIL

# Keep the genuinely empty range refusal; do not confuse protected exclusions with it.
git -C "$TMP/source" update-ref refs/pull/1/head "$BASE_SHA"
run_case 'open main edited genuinely empty range rejected' 1 main release/v1.0.0 "$BASE_SHA" 1 open false edited
git -C "$TMP/source" update-ref refs/pull/1/head "$HEAD_SHA"
git -C "$TMP/source" update-ref -d refs/heads/develop
run_case 'pure forward missing develop rejected' 128 main release/docs-guide "$HEAD_SHA"
git -C "$TMP/source" update-ref refs/heads/develop "$HEAD_SHA"

git -C "$TMP/source" update-ref refs/heads/develop "$BASE_SHA"
run_case 'open main edited still inspected' 0 main release/v1.0.0 "$HEAD_SHA" 1 open false edited
run_case 'open develop edited still inspected' 0 develop candidate "$HEAD_SHA" 1 open false edited
run_case 'open develop reopened still inspected' 0 develop candidate "$HEAD_SHA" 1 open false reopened
run_case 'open develop opened still inspected' 0 develop candidate "$HEAD_SHA" 1 open false opened
run_case 'closed unmerged edited rejected' 1 develop candidate "$HEAD_SHA" 1 closed false edited
run_case 'open merged state contradiction rejected' 1 develop candidate "$HEAD_SHA" 1 open true edited
run_case 'merged synchronize contradiction rejected' 1 main release/v1.0.0 "$HEAD_SHA" 1 closed true synchronize
run_case 'unknown state rejected' 1 develop candidate "$HEAD_SHA" 1 unknown false edited
run_case 'missing state rejected' 1 develop candidate "$HEAD_SHA" 1 '' false edited
run_case 'missing merged flag rejected' 1 develop candidate "$HEAD_SHA" 1 open '' edited
run_case 'invalid merged flag rejected' 1 develop candidate "$HEAD_SHA" 1 open TRUE edited
run_case 'unknown open event rejected' 1 develop candidate "$HEAD_SHA" 1 open false unknown
run_case 'missing open event rejected' 1 develop candidate "$HEAD_SHA" 1 open false ''
run_case 'merged edited invalid PR number rejected' 1 main release/v1.0.0 "$HEAD_SHA" invalid closed true edited
run_case 'merged edited invalid head SHA rejected' 1 main release/v1.0.0 invalid 1 closed true edited
run_case 'open edited stale event head still rejected' 1 develop candidate "$BASE_SHA" 1 open false edited
run_case 'open edited missing PR objects still rejected' 128 develop candidate "$HEAD_SHA" 2 open false edited

git -C "$TMP/source" -c core.hooksPath=/dev/null commit --allow-empty -qm 'invalid edited message'
HEAD_SHA="$(git -C "$TMP/source" rev-parse HEAD)"
git -C "$TMP/source" update-ref refs/pull/1/head "$HEAD_SHA"
run_case 'open edited invalid commit still rejected' 1 develop candidate "$HEAD_SHA" 1 open false edited
run_case 'main release unique invalid commit rejected' 1 main release/docs-guide "$HEAD_SHA" 1 open false edited

# Lifecycle signals must be bound to GitHub event metadata, never PR prose.
ruby -ryaml -e '
  doc = YAML.safe_load(File.read(ARGV[0]))
  env = doc.fetch("jobs").fetch("commitlint-trusted").fetch("steps").fetch(1).fetch("env")
  expected = {"PR_STATE" => "${{ github.event.pull_request.state }}", "PR_MERGED" => "${{ github.event.pull_request.merged }}", "EVENT_ACTION" => "${{ github.event.action }}"}
  abort "FAIL: lifecycle metadata binding" unless expected.all? { |k,v| env[k] == v }
' "$ROOT/.github/workflows/commitlint-trusted.yml"

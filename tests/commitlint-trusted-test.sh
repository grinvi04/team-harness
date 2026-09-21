#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Final deployment has one trusted source and a matching consumer template.
if [ -e "$ROOT/.github/workflows/commitlint.yml" ]; then
  echo 'FAIL: legacy workflow must be retired after the required-check handoff'
  exit 1
fi
cmp "$ROOT/.github/workflows/commitlint-trusted.yml" "$ROOT/templates/ci/commitlint.yml"
grep -Fq 'STACK_CHECKS+=("test-guard" "commitlint-trusted"' "$ROOT/scripts/new-repo.sh"

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
  (cd "$TMP/runner" && BASE_REF="$base_ref" HEAD_REF="$head_ref" BASE_SHA="$BASE_SHA" \
    HEAD_SHA="$head_sha" PR_NUMBER="$pr_number" READ_TOKEN=local-test \
    bash -eo pipefail "$TMP/run.sh") > "$TMP/result" 2>&1 || code=$?
  if [ "$code" -ne "$expected" ]; then
    cat "$TMP/result"
    echo "FAIL: $label expected=$expected got=$code"
    exit 1
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

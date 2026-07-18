#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNNER="$ROOT/scripts/run-external-pilot.mjs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0
pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

make_repo() {
  local repo="$1"
  mkdir -p "$repo/.github/workflows" "$repo/src"
  git -C "$repo" init -q
  git -C "$repo" -c user.email=pilot@example.invalid -c user.name=Pilot commit -q --allow-empty -m init
  git -C "$repo" checkout -q -b develop
  printf '{"name":"pilot-consumer","private":true,"devDependencies":{"typescript":"1.0.0"}}\n' >"$repo/package.json"
  printf '# Pilot consumer\n' >"$repo/AGENTS.md"
  printf 'sentinel\n' >"$repo/src/keep.txt"
  git -C "$repo" add .
  git -C "$repo" -c user.email=pilot@example.invalid -c user.name=Pilot commit -q -m 'chore: fixture'
  git -C "$repo" remote add origin 'https://user:secret@example.invalid/org/pilot-consumer.git?token=hidden'
}

make_repo "$TMP/consumer"
BEFORE_HEAD="$(git -C "$TMP/consumer" rev-parse HEAD)"
BEFORE_STATUS="$(git -C "$TMP/consumer" status --porcelain=v1 --untracked-files=all)"

if node "$RUNNER" --repo "$TMP/consumer" --output "$TMP/report.json"; then
  pass 'clean 독립 repo pilot 실행'
else
  fail 'clean 독립 repo pilot 실행'
fi

if node - "$TMP/report.json" "$TMP/consumer" <<'NODE'
const fs = require('fs')
const report = JSON.parse(fs.readFileSync(process.argv[2]))
const forbiddenPath = process.argv[3]
if (report.schemaVersion !== 1 || report.repo.name !== 'consumer') process.exit(1)
if (!/^[0-9a-f]{40}$/.test(report.harnessCommit)) process.exit(1)
if (report.repo.branch !== 'develop' || !/^[0-9a-f]{40}$/.test(report.repo.commit)) process.exit(1)
if (report.repo.remote !== 'example.invalid/org/pilot-consumer.git') process.exit(1)
if (!Number.isFinite(report.profile.installMs) || report.profile.installMs < 0) process.exit(1)
if (!Number.isFinite(report.profile.doctorMs) || report.profile.doctorMs < 0 || report.profile.healthy !== true) process.exit(1)
if (!Number.isInteger(report.drift.missing) || !Array.isArray(report.drift.stacks)) process.exit(1)
if (report.guard.benign.total !== 4 || report.guard.blocked.total !== 5) process.exit(1)
if (report.guard.sampleFalsePositives !== 0 || report.guard.sampleFalseNegatives !== 0) process.exit(1)
if (!Array.isArray(report.limitations) || report.limitations.length < 2) process.exit(1)
const serialized = JSON.stringify(report)
if (serialized.includes(forbiddenPath) || /user:secret|token=hidden/.test(serialized)) process.exit(1)
NODE
then
  pass '구조화 지표·remote credential·절대경로 비노출'
else
  fail '구조화 지표·remote credential·절대경로 비노출'
fi

if [[ "$BEFORE_HEAD" = "$(git -C "$TMP/consumer" rev-parse HEAD)" \
  && "$BEFORE_STATUS" = "$(git -C "$TMP/consumer" status --porcelain=v1 --untracked-files=all)" \
  && -f "$TMP/consumer/src/keep.txt" ]]; then
  pass 'pilot 전후 repo HEAD·status·파일 불변'
else
  fail 'pilot 전후 repo HEAD·status·파일 불변'
fi

printf 'dirty\n' >"$TMP/consumer/untracked.txt"
if node "$RUNNER" --repo "$TMP/consumer" --output "$TMP/dirty.json" >"$TMP/out" 2>"$TMP/err"; then
  fail 'dirty repo 사전 거부'
elif grep -q 'clean repository required' "$TMP/err" && [[ ! -e "$TMP/dirty.json" ]]; then
  pass 'dirty repo 사전 거부'
else
  fail 'dirty repo 오류 근거·output 미생성'
fi
rm "$TMP/consumer/untracked.txt"

printf '#!/usr/bin/env bash\nprintf exploited >%q\n' "$TMP/fsmonitor-executed" >"$TMP/fsmonitor.sh"
chmod +x "$TMP/fsmonitor.sh"
git -C "$TMP/consumer" config core.fsmonitor "$TMP/fsmonitor.sh"
if node "$RUNNER" --repo "$TMP/consumer" --output "$TMP/fsmonitor.json" >"$TMP/out" 2>"$TMP/err" \
  && [[ ! -e "$TMP/fsmonitor-executed" ]]; then
  pass 'pilot git 조회가 repo-local fsmonitor를 실행하지 않음'
else
  fail 'repo-local core.fsmonitor 실행 차단'
fi
rm -f "$TMP/fsmonitor.json" "$TMP/fsmonitor-executed"
git -C "$TMP/consumer" config --unset core.fsmonitor

mkdir -p "$TMP/consumer/subdir"
if node "$RUNNER" --repo "$TMP/consumer/subdir" --output "$TMP/consumer/pilot-report.json" >"$TMP/out" 2>"$TMP/err"; then
  fail 'canonical Git root 내부 output 거부'
elif [[ ! -e "$TMP/consumer/pilot-report.json" ]]; then
  pass 'canonical Git root 내부 output 거부'
else
  fail 'canonical Git root 내부 output 미생성'
fi

(
  sleep 0.25
  ln -s "$TMP/consumer" "$TMP/late-parent" 2>/dev/null || true
) &
late_swap_pid=$!
if node "$RUNNER" --repo "$TMP/consumer" --output "$TMP/late-parent/late-report.json" >"$TMP/out" 2>"$TMP/err"; then
  wait "$late_swap_pid"
  if [[ -f "$TMP/late-parent/late-report.json" ]] && [[ ! -L "$TMP/late-parent" ]] \
    && [[ ! -e "$TMP/consumer/late-report.json" ]] && [[ -z "$(git -C "$TMP/consumer" status --porcelain=v1 --untracked-files=all)" ]]; then
    pass 'output parent를 canonical 경로로 고정해 pilot repo를 보존'
  else
    fail 'output parent symlink 경합이 pilot repo를 변경'
  fi
else
  wait "$late_swap_pid"
  if [[ ! -e "$TMP/consumer/late-report.json" ]] && [[ -z "$(git -C "$TMP/consumer" status --porcelain=v1 --untracked-files=all)" ]]; then
    pass 'output parent symlink 경합이 pilot repo를 보존'
  else
    fail 'output parent symlink 경합이 pilot repo를 변경'
  fi
fi
rm -f "$TMP/consumer/late-report.json"

git -C "$TMP/consumer" remote set-url origin 'git@example.invalid:org/pilot-consumer.git?token=hidden#fragment'
if node "$RUNNER" --repo "$TMP/consumer" --output "$TMP/scp-report.json" >"$TMP/out" 2>"$TMP/err" \
  && node - "$TMP/scp-report.json" <<'NODE'
const fs = require('fs')
const report = JSON.parse(fs.readFileSync(process.argv[2]))
if (report.repo.remote !== 'example.invalid/org/pilot-consumer.git') process.exit(1)
if (/token=hidden|fragment/.test(JSON.stringify(report))) process.exit(1)
NODE
then
  pass 'scp-style remote query·fragment 비노출'
else
  fail 'scp-style remote query·fragment 비노출'
fi

git -C "$TMP/consumer" checkout -q --detach
if node "$RUNNER" --repo "$TMP/consumer" --output "$TMP/detached.json" >"$TMP/out" 2>"$TMP/err"; then
  fail 'detached HEAD 사전 거부'
elif grep -q 'attached branch required' "$TMP/err" && [[ ! -e "$TMP/detached.json" ]]; then
  pass 'detached HEAD 사전 거부'
else
  fail 'detached HEAD 오류 근거·output 미생성'
fi

echo "RESULT: $PASS PASS, $FAIL FAIL"
[[ "$FAIL" -eq 0 ]]

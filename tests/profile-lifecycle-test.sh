#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANAGE="$ROOT/scripts/manage-profile.mjs"
DOCTOR="$ROOT/scripts/profile-doctor.mjs"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/profile-lifecycle.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }
expect_ok() { local label=$1; shift; if "$@" >"$TMP/out" 2>&1; then pass "$label"; else fail "$label"; sed 's/^/  /' "$TMP/out"; fi; }
expect_fail() { local label=$1; shift; if "$@" >"$TMP/out" 2>&1; then fail "$label"; else pass "$label"; fi; }
state_packages() {
  node -e 'const s=require(process.argv[1]); console.log(s.packages.map(p=>p.unit).sort().join(","))' "$1/profile-state.json"
}
state_digest() {
  node -e 'const f=require("fs"),c=require("crypto"); console.log(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex"))' "$1/profile-state.json"
}

expect_ok "repository-only 설치" node "$MANAGE" install --profile repository-only --target "$TMP/repo-only"
[ "$(state_packages "$TMP/repo-only")" = "governance-core" ] && pass "repository-only는 core만 포함" || fail "repository-only package 경계"
expect_ok "repository-only doctor" node "$DOCTOR" --target "$TMP/repo-only"

expect_ok "agent-governed Codex 설치" node "$MANAGE" install --profile agent-governed --runtime codex --target "$TMP/agent"
[ "$(state_packages "$TMP/agent")" = "codex-adapter,governance-core" ] && pass "agent-governed는 선택 adapter만 포함" || fail "agent-governed package 경계"
expect_ok "agent-governed doctor" node "$DOCTOR" --target "$TMP/agent"

expect_ok "workflow-assisted Claude 설치" node "$MANAGE" install --profile workflow-assisted --runtime claude --target "$TMP/workflow"
[ "$(state_packages "$TMP/workflow")" = "claude-adapter,governance-core,workflow-pack" ] && pass "workflow-assisted package 경계" || fail "workflow-assisted package 경계"
expect_ok "workflow-assisted doctor" node "$DOCTOR" --target "$TMP/workflow"

expect_ok "workflow disable" node "$MANAGE" disable --unit workflow-pack --target "$TMP/workflow"
node -e 'const s=require(process.argv[1]); process.exit(s.packages.find(p=>p.unit==="workflow-pack").enabled===false?0:1)' "$TMP/workflow/profile-state.json" \
  && pass "disable 상태 기록" || fail "disable 상태 기록"
expect_ok "disable 후 core doctor" node "$DOCTOR" --target "$TMP/workflow"
expect_ok "workflow remove" node "$MANAGE" remove --unit workflow-pack --target "$TMP/workflow"
[ ! -d "$TMP/workflow/packages/harness-workflows" ] && [ -d "$TMP/workflow/packages/harness-governance-core" ] \
  && pass "선택 단위 제거 후 core 보존" || fail "선택 단위 제거 경계"
expect_fail "core 단독 제거 거부" node "$MANAGE" remove --unit governance-core --target "$TMP/workflow"

expect_ok "동일 source update" node "$MANAGE" update --profile agent-governed --runtime codex --target "$TMP/agent"
expect_ok "update 후 doctor" node "$DOCTOR" --target "$TMP/agent"
before_update=$(state_digest "$TMP/agent")
expect_fail "잘못된 profile update 거부" node "$MANAGE" update --profile unknown --runtime codex --target "$TMP/agent"
after_update=$(state_digest "$TMP/agent")
[ "$before_update" = "$after_update" ] && pass "update 실패 시 기존 상태 보존" || fail "update 실패 원자성"

printf 'drift\n' >> "$TMP/agent/packages/harness-governance-core/scripts/guard.sh"
expect_fail "doctor가 파일 drift 탐지" node "$DOCTOR" --target "$TMP/agent"

mkdir "$TMP/unmanaged"
printf 'keep\n' > "$TMP/unmanaged/user.txt"
expect_fail "비관리 비어있지 않은 대상 설치 거부" node "$MANAGE" install --profile repository-only --target "$TMP/unmanaged"
[ "$(cat "$TMP/unmanaged/user.txt")" = keep ] && pass "실패 시 기존 대상 보존" || fail "실패 시 대상 변형"
expect_fail "runtime 없는 agent profile 거부" node "$MANAGE" install --profile agent-governed --target "$TMP/bad-runtime"
expect_fail "지원하지 않는 profile 거부" node "$MANAGE" install --profile unknown --target "$TMP/bad-profile"
expect_ok "명시적 전체 제거" node "$MANAGE" remove --all --target "$TMP/repo-only"
[ ! -e "$TMP/repo-only" ] && pass "전체 제거는 관리 대상만 삭제" || fail "전체 제거"

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

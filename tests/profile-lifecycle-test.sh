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
[ -L "$TMP/workflow" ] && pass "활성 profile은 원자 교체 symlink" || fail "profile generation pointer"
hooks="$TMP/workflow/packages/harness-claude-adapter/hooks/hooks.json"
binding_root=$(node -e 'console.log(require("path").resolve(process.argv[1],"packages","harness-governance-core"))' "$TMP/workflow")
grep -Fq "$binding_root" "$hooks" && ! grep -Fq '${HARNESS_GOVERNANCE_CORE_ROOT}' "$hooks" \
  && pass "runtime binding 실제 core 경로 해소" || fail "runtime binding 미해소"
expect_ok "workflow-assisted doctor" node "$DOCTOR" --target "$TMP/workflow"

expect_ok "workflow disable" node "$MANAGE" disable --unit workflow-pack --target "$TMP/workflow"
node -e 'const s=require(process.argv[1]); process.exit(s.packages.find(p=>p.unit==="workflow-pack").enabled===false?0:1)' "$TMP/workflow/profile-state.json" \
  && pass "disable 상태 기록" || fail "disable 상태 기록"
[ ! -d "$TMP/workflow/packages/harness-workflows" ] && [ -d "$TMP/workflow/disabled-packages/harness-workflows" ] \
  && pass "disable이 package active view에서 제거" || fail "disable active view"
expect_ok "disable 후 core doctor" node "$DOCTOR" --target "$TMP/workflow"
expect_ok "workflow remove" node "$MANAGE" remove --unit workflow-pack --target "$TMP/workflow"
[ ! -d "$TMP/workflow/packages/harness-workflows" ] && [ -d "$TMP/workflow/packages/harness-governance-core" ] \
  && pass "선택 단위 제거 후 core 보존" || fail "선택 단위 제거 경계"
node -e 'const s=require(process.argv[1]); process.exit(s.profile==="agent-governed"?0:1)' "$TMP/workflow/profile-state.json" \
  && pass "workflow 제거 후 profile 전환" || fail "workflow profile 전환"
expect_ok "adapter remove" node "$MANAGE" remove --unit claude-adapter --target "$TMP/workflow"
node -e 'const s=require(process.argv[1]); process.exit(s.profile==="repository-only"&&s.runtime===null?0:1)' "$TMP/workflow/profile-state.json" \
  && pass "adapter 제거 후 repository-only 전환" || fail "adapter profile 전환"
expect_ok "선택 단위 제거 후 doctor" node "$DOCTOR" --target "$TMP/workflow"
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
expect_ok "변조 반례용 profile 설치" node "$MANAGE" install --profile workflow-assisted --runtime codex --target "$TMP/tampered"
mkdir "$TMP/victim"
printf 'keep\n' > "$TMP/victim/user.txt"
node -e 'const f=require("fs"),p=process.argv[1],s=JSON.parse(f.readFileSync(p)); s.packages.find(x=>x.unit==="workflow-pack").pluginName="../../../victim"; f.writeFileSync(p,JSON.stringify(s))' "$TMP/tampered/profile-state.json"
expect_fail "변조된 package 경로 remove 거부" node "$MANAGE" remove --unit workflow-pack --target "$TMP/tampered"
[ "$(cat "$TMP/victim/user.txt")" = keep ] && pass "state 경로 변조가 대상 밖을 보존" || fail "state 경로 순회"
expect_ok "state symlink 반례용 profile 설치" node "$MANAGE" install --profile workflow-assisted --runtime codex --target "$TMP/symlinked"
cp "$TMP/symlinked/profile-state.json" "$TMP/external-state.json"
rm "$TMP/symlinked/profile-state.json"
ln -s "$TMP/external-state.json" "$TMP/symlinked/profile-state.json"
external_before=$(node -e 'const f=require("fs"),c=require("crypto"); console.log(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex"))' "$TMP/external-state.json")
expect_fail "symlink state mutation 거부" node "$MANAGE" disable --unit workflow-pack --target "$TMP/symlinked"
external_after=$(node -e 'const f=require("fs"),c=require("crypto"); console.log(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex"))' "$TMP/external-state.json")
[ "$external_before" = "$external_after" ] && pass "symlink state 외부 파일 보존" || fail "symlink state overwrite"
expect_ok "catalog mismatch 반례용 profile 설치" node "$MANAGE" install --profile repository-only --target "$TMP/old-version"
node -e 'const f=require("fs"),p=process.argv[1],s=JSON.parse(f.readFileSync(p)); s.version="0.59.0"; f.writeFileSync(p,JSON.stringify(s))' "$TMP/old-version/profile-state.json"
expect_fail "doctor가 catalog version mismatch 탐지" node "$DOCTOR" --target "$TMP/old-version"
expect_ok "stale profile 전체 제거" node "$MANAGE" remove --all --target "$TMP/old-version"
expect_ok "composition 반례용 profile 설치" node "$MANAGE" install --profile workflow-assisted --runtime codex --target "$TMP/bad-composition"
node -e 'const f=require("fs"),p=process.argv[1],s=JSON.parse(f.readFileSync(p)); s.packages=s.packages.filter(x=>x.unit!=="workflow-pack"); f.writeFileSync(p,JSON.stringify(s))' "$TMP/bad-composition/profile-state.json"
rm -r "$TMP/bad-composition/packages/harness-workflows"
expect_fail "doctor가 profile package 누락 탐지" node "$DOCTOR" --target "$TMP/bad-composition"
expect_ok "binding 반례용 profile 설치" node "$MANAGE" install --profile agent-governed --runtime claude --target "$TMP/bad-binding"
node -e 'const f=require("fs"),p=process.argv[1],s=JSON.parse(f.readFileSync(p)); s.packages.find(x=>x.unit==="claude-adapter").bindings=[]; f.writeFileSync(p,JSON.stringify(s))' "$TMP/bad-binding/profile-state.json"
expect_fail "doctor가 runtime binding 누락 탐지" node "$DOCTOR" --target "$TMP/bad-binding"
expect_ok "extra package 반례용 profile 설치" node "$MANAGE" install --profile repository-only --target "$TMP/extra-package"
mkdir "$TMP/extra-package/packages/undeclared-adapter"
expect_fail "doctor가 미등록 active package 탐지" node "$DOCTOR" --target "$TMP/extra-package"
expect_ok "외부 generation 반례용 profile 설치" node "$MANAGE" install --profile repository-only --target "$TMP/source-profile"
mkdir "$TMP/external-parent"
cp -R "$(realpath "$TMP/source-profile")" "$TMP/external-parent/foreign-generation"
node -e 'const f=require("fs"),p=process.argv[1],s=JSON.parse(f.readFileSync(p)); s.installRoot=require("path").resolve(process.argv[2]); f.writeFileSync(p,JSON.stringify(s))' "$TMP/external-parent/foreign-generation/profile-state.json" "$TMP/foreign-link"
ln -s "$TMP/external-parent/foreign-generation" "$TMP/foreign-link"
expect_fail "update가 외부 generation symlink 거부" node "$MANAGE" update --profile repository-only --target "$TMP/foreign-link"
[ -d "$TMP/external-parent/foreign-generation" ] && pass "외부 generation 보존" || fail "외부 generation 삭제"
expect_ok "명시적 전체 제거" node "$MANAGE" remove --all --target "$TMP/repo-only"
[ ! -e "$TMP/repo-only" ] && pass "전체 제거는 관리 대상만 삭제" || fail "전체 제거"

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

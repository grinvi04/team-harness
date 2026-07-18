#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILDER="$ROOT/scripts/build-packages.mjs"
CATALOG="$ROOT/packaging/packages.json"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/team-harness-package-test.XXXXXX")" || exit 1
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

expect_ok() {
  local label=$1
  shift
  if "$@" >"$TMP/out" 2>"$TMP/err"; then
    pass "$label"
  else
    fail "$label"
    sed 's/^/  /' "$TMP/err"
  fi
}

expect_fail() {
  local label=$1
  shift
  if "$@" >"$TMP/out" 2>"$TMP/err"; then
    fail "$label"
  else
    pass "$label"
  fi
}

mutate_catalog() {
  local output=$1
  local operation=$2
  python3 - "$CATALOG" "$output" "$operation" <<'PY'
import json
from pathlib import Path
import sys

source, output, operation = map(Path, sys.argv[1:])
data = json.loads(source.read_text())
packages = {package["id"]: package for package in data["packages"]}

if operation.name == "duplicate":
    packages["workflow-pack"]["sources"].append(packages["governance-core"]["sources"][0])
elif operation.name == "missing":
    packages["governance-core"]["sources"].pop()
elif operation.name == "reverse-dependency":
    packages["governance-core"]["dependencies"] = [
        {"id": "workflow-pack", "version": ">=0.59.0 <0.60.0"}
    ]
elif operation.name == "adapter-dependency":
    packages["claude-adapter"]["dependencies"].append(
        {"id": "codex-adapter", "version": ">=0.59.0 <0.60.0"}
    )
elif operation.name == "traversal":
    packages["governance-core"]["sources"].append("../README.md")
elif operation.name == "invalid-version":
    data["version"] = "0.59"
elif operation.name == "missing-source":
    packages["governance-core"]["sources"].append("scripts/does-not-exist.sh")
else:
    raise SystemExit(f"unknown operation: {operation.name}")

output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
PY
}

if [ -f "$BUILDER" ]; then pass "builder stub 존재"; else fail "builder 누락"; fi
if [ -f "$CATALOG" ]; then pass "package catalog 존재"; else fail "package catalog 누락"; fi

expect_ok "실제 source catalog 완전성" node "$BUILDER" --catalog "$CATALOG" --check

for operation in duplicate missing reverse-dependency adapter-dependency traversal invalid-version missing-source; do
  mutated="$TMP/$operation.json"
  if mutate_catalog "$mutated" "$operation"; then
    expect_fail "잘못된 catalog 거부: $operation" \
      node "$BUILDER" --catalog "$mutated" --check
  else
    fail "catalog 반례 생성: $operation"
  fi
done

mkdir "$TMP/nonempty"
printf 'keep\n' >"$TMP/nonempty/existing.txt"
expect_fail "비어 있지 않은 output 덮어쓰기 거부" \
  node "$BUILDER" --catalog "$CATALOG" --output "$TMP/nonempty"
if [ "$(cat "$TMP/nonempty/existing.txt")" = keep ]; then
  pass "거부된 output 기존 내용 보존"
else
  fail "거부된 output 내용 변경"
fi

before_status="$(git -C "$ROOT" status --porcelain=v1 -uall)"
expect_ok "첫 package artifact 조립" \
  node "$BUILDER" --catalog "$CATALOG" --output "$TMP/build-a"
expect_ok "둘째 package artifact 조립" \
  node "$BUILDER" --catalog "$CATALOG" --output "$TMP/build-b"
after_status="$(git -C "$ROOT" status --porcelain=v1 -uall)"
if [ "$before_status" = "$after_status" ]; then
  pass "build가 source worktree를 변경하지 않음"
else
  fail "build가 source worktree를 변경함"
fi

digest_tree() {
  local directory=$1
  (
    cd "$directory" || exit 1
    find . -type f -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256
  ) | shasum -a 256 | awk '{print $1}'
}

if [ -d "$TMP/build-a" ] && [ "$(digest_tree "$TMP/build-a")" = "$(digest_tree "$TMP/build-b")" ]; then
  pass "동일 입력 artifact digest 재현"
else
  fail "artifact가 재현 가능하지 않음"
fi

python3 - "$TMP/build-a" <<'PY'
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
expected = {
    "harness-governance-core": ("governance-core", 9),
    "harness-claude-adapter": ("claude-adapter", 0),
    "harness-codex-adapter": ("codex-adapter", 0),
    "harness-workflows": ("workflow-pack", 7),
}
errors = []
for folder, (unit, skill_count) in expected.items():
    package = root / folder
    claude_manifest = package / ".claude-plugin/plugin.json"
    codex_manifest = package / ".codex-plugin/plugin.json"
    metadata_path = package / "harness-package.json"
    for path in (claude_manifest, codex_manifest, metadata_path):
        if not path.is_file():
            errors.append(f"missing {path.relative_to(root)}")
    if errors:
        continue
    claude = json.loads(claude_manifest.read_text())
    codex = json.loads(codex_manifest.read_text())
    metadata = json.loads(metadata_path.read_text())
    if claude.get("name") != folder or codex.get("name") != folder:
        errors.append(f"manifest name mismatch: {folder}")
    if claude.get("version") != "0.59.0" or codex.get("version") != "0.59.0":
        errors.append(f"manifest version mismatch: {folder}")
    if metadata.get("unit") != unit or metadata.get("installable") is not False:
        errors.append(f"package metadata mismatch: {folder}")
    actual_skills = len(list((package / "skills").glob("*/SKILL.md")))
    if actual_skills != skill_count:
        errors.append(f"skill count {folder}: expected={skill_count} actual={actual_skills}")
    if any(path.is_symlink() for path in package.rglob("*")):
        errors.append(f"symlink found: {folder}")

if (root / "harness-claude-adapter/codex").exists():
    errors.append("Claude adapter contains Codex surface")
if (root / "harness-codex-adapter/hooks").exists() or (root / "harness-codex-adapter/agents").exists():
    errors.append("Codex adapter contains Claude surface")

if errors:
    print("\n".join(errors), file=sys.stderr)
    raise SystemExit(1)
print("PASS: generated package manifests, boundaries, and skill counts")
PY
if [ $? -eq 0 ]; then
  PASS=$((PASS + 1))
else
  fail "생성 package 구조·manifest 검증"
fi

if python3 - "$ROOT/.claude-plugin/marketplace.json" <<'PY'
import json
from pathlib import Path
import sys

names = [entry["name"] for entry in json.loads(Path(sys.argv[1]).read_text())["plugins"]]
expected = ["harness-guard"]
raise SystemExit(0 if names == expected else 1)
PY
then
  pass "legacy marketplace만 노출"
else
  fail "미검증 package가 marketplace에 노출됨"
fi

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

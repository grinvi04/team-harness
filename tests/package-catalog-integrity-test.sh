#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILDER="$ROOT/scripts/build-packages.mjs"
CATALOG="$ROOT/packaging/packages.json"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/team-harness-catalog-integrity.XXXXXX")" || exit 1
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

python3 - "$CATALOG" "$TMP/invalid-binding.json" <<'PY'
import json
from pathlib import Path
import sys

source, output = map(Path, sys.argv[1:])
data = json.loads(source.read_text())
claude = next(package for package in data["packages"] if package["id"] == "claude-adapter")
claude["runtimeBindings"][0]["environment"] = "invalid-lowercase"
output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
PY

if node "$BUILDER" --catalog "$TMP/invalid-binding.json" --check >"$TMP/out" 2>"$TMP/err"; then
  fail "--check가 잘못된 runtime binding을 허용"
else
  pass "--check가 잘못된 runtime binding을 거부"
fi

if node "$BUILDER" --catalog "$CATALOG" --output "$TMP/output" >"$TMP/out" 2>"$TMP/err"; then
  pass "catalog provenance artifact 조립"
else
  fail "catalog provenance artifact 조립 실패"
  sed 's/^/  /' "$TMP/err"
fi

expected_digest="sha256:$(shasum -a 256 "$CATALOG" | awk '{print $1}')"
if python3 - "$TMP/output" "$expected_digest" "$(git -C "$ROOT" rev-parse HEAD)" <<'PY'
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
expected_digest = sys.argv[2]
expected_commit = sys.argv[3]
metadata = [json.loads(path.read_text()) for path in root.glob("*/harness-package.json")]
valid = len(metadata) == 4 and all(
    item.get("catalogDigest") == expected_digest
    and item.get("sourcePluginCommit") == expected_commit
    and "sourceCommit" not in item
    for item in metadata
)
raise SystemExit(0 if valid else 1)
PY
then
  pass "metadata가 plugin commit과 catalog digest를 분리 기록"
else
  fail "artifact provenance metadata 불완전"
fi

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILDER="$ROOT/scripts/build-packages.mjs"
CATALOG="$ROOT/experiments/split-packaging/packages.json"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/team-harness-catalog-integrity.XXXXXX")" || exit 1
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

if python3 - "$CATALOG" <<'PY'
import json
import sys

catalog = json.load(open(sys.argv[1]))
core = next(package for package in catalog["packages"] if package["id"] == "governance-core")
assert {"scripts/observe.mjs", "dashboard"} <= set(core["sources"])
PY
then
  pass "dashboard runtime과 assets의 governance core 소유 선언"
else
  fail "dashboard runtime과 assets의 governance core 소유 누락"
fi

if python3 - "$ROOT" <<'PY'
import subprocess
import sys

root = sys.argv[1]
ignored = ["dashboard/node_modules/example/index.js", "dashboard/.vite/cache.json", "dashboard/app.tsbuildinfo"]
retained = ["dashboard/package.json", "dashboard/package-lock.json", "dashboard/src/main.tsx",
            "plugins/harness-guard/dashboard/index.html", "plugins/harness-guard/dashboard/asset-manifest.json",
            "plugins/harness-guard/dashboard/assets/index.js", "other/node_modules/example/index.js"]
for paths, expected in [(ignored, 0), (retained, 1)]:
    for path in paths:
        result = subprocess.run(["git", "check-ignore", "--no-index", "-q", path], cwd=root)
        assert result.returncode == expected, path
PY
then
  pass "dashboard authoring cache만 ignore하고 source·lock·배포 assets 유지"
else
  fail "dashboard ignore 경계 불일치"
fi

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

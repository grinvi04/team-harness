#!/bin/bash
# Regression tests for the architecture SVG generator and regeneration hook.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

check() {
  local desc="$1"
  shift
  if "$@"; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc"
    FAIL=$((FAIL + 1))
  fi
}

PROJECT="$TMP/project"
mkdir -p "$PROJECT/docs"
cp "$ROOT/templates/hooks/regen-arch-svg.sh" "$TMP/regen-arch-svg.sh"
cp "$ROOT/templates/gen_arch_svg.py" "$PROJECT/docs/gen_arch_svg.py"

invalid_json_fails() {
  local rc
  printf '{invalid json' |
    (cd "$PROJECT" && CLAUDE_PROJECT_DIR="$PROJECT" bash "$TMP/regen-arch-svg.sh") \
      > "$TMP/invalid-json.log" 2>&1
  rc=$?
  [ "$rc" -ne 0 ] && [ -s "$TMP/invalid-json.log" ]
}

nonapplicable_event_succeeds() {
  local rc
  printf '%s\n' '{"tool_input":{"file_path":"docs/README.md"}}' |
    (cd "$PROJECT" && CLAUDE_PROJECT_DIR="$PROJECT" bash "$TMP/regen-arch-svg.sh") \
      > "$TMP/nonapplicable.log" 2>&1
  rc=$?
  [ "$rc" -eq 0 ] && [ ! -e "$PROJECT/docs/architecture.svg" ]
}

applicable_event_generates_parseable_svg() {
  local rc
  printf '%s\n' '{"tool_input":{"file_path":"docs/gen_arch_svg.py"}}' |
    (cd "$PROJECT" && CLAUDE_PROJECT_DIR="$PROJECT" bash "$TMP/regen-arch-svg.sh") \
      > "$TMP/applicable.log" 2>&1
  rc=$?
  [ "$rc" -eq 0 ] || return 1
  python3 - "$PROJECT/docs/architecture.svg" <<'PY'
import sys
import xml.etree.ElementTree as ET

ET.parse(sys.argv[1])
PY
}

check "malformed hook JSON fails with a diagnostic" invalid_json_fails
check "valid nonapplicable hook event exits successfully without generation" \
  nonapplicable_event_succeeds
check "applicable hook event runs the real generator and writes parseable XML" \
  applicable_event_generates_parseable_svg

if python3 - "$ROOT/templates/gen_arch_svg.py" "$TMP/collision.svg" <<'PY'
import contextlib
import importlib.util
import io
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

source = Path(sys.argv[1])
collision_path = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("gen_arch_svg", source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

fails = 0

collision_path.write_text("original SVG must survive collision\n")
module.BW = 1000
output = io.StringIO()
try:
    with contextlib.redirect_stdout(output):
        module.gen_example(str(collision_path))
except RuntimeError:
    pass
else:
    print("FAIL: a real label collision must make generation fail")
    fails += 1
if collision_path.read_text() != "original SVG must survive collision\n":
    print("FAIL: a collision must preserve the existing output file")
    fails += 1
if "Written:" in output.getvalue():
    print("FAIL: a collision must not report a Written result")
    fails += 1
if not fails:
    print("PASS: real collision fails before writing and preserves the existing file")

module.BW = 130
special = 'API & DB "<tag>\'quotes\''
old_fill = module.C["api"]["f"]
old_stroke = module.C["api"]["s"]
module.C["api"]["f"] = 'fill & " < >'
module.C["api"]["s"] = 'stroke & " < >'
try:
    body = module.box(100, 100, "api", special, special)
    svg = module.wrap(300, 200, special, special, body, "")
    root = ET.fromstring(svg)
    texts = [element.text for element in root.iter() if element.tag.endswith("text")]
    rect = next(
        element
        for element in root.iter()
        if element.tag.endswith("rect") and "stroke" in element.attrib
    )
    assert texts[:4] == [special, special, special, special], texts
    assert rect.attrib["fill"] == 'fill & " < >', rect.attrib
    assert rect.attrib["stroke"] == 'stroke & " < >', rect.attrib
except (AssertionError, ET.ParseError) as error:
    print(f"FAIL: text and attribute XML escaping: {error}")
    fails += 1
else:
    print("PASS: text and attribute values round-trip through the XML parser")
finally:
    module.C["api"]["f"] = old_fill
    module.C["api"]["s"] = old_stroke

sys.exit(1 if fails else 0)
PY
then
  PASS=$((PASS + 2))
else
  FAIL=$((FAIL + 2))
fi

echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

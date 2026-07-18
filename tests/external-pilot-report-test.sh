#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JSON="$ROOT/docs/pilots/drivertree-v0.60.0.json"
REPORT="$ROOT/docs/pilots/drivertree-v0.60.0.md"
PASS=0
FAIL=0
pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

if node - "$JSON" <<'NODE'
const fs = require('fs')
const report = JSON.parse(fs.readFileSync(process.argv[2]))
if (report.schemaVersion !== 1 || report.repo.name !== 'DriveTree') process.exit(1)
if (!/^[0-9a-f]{40}$/.test(report.harnessCommit) || !/^[0-9a-f]{40}$/.test(report.repo.commit)) process.exit(1)
if (report.profile.healthy !== true || report.repositoryUnchanged !== true) process.exit(1)
if (report.guard.benign.total !== 4 || report.guard.blocked.total !== 5) process.exit(1)
NODE
then
  pass 'DriveTree pilot JSON provenance·불변 계약'
else
  fail 'DriveTree pilot JSON provenance·불변 계약'
fi

for pattern in '## 검증된 결과' '## 해석' '## 한계와 잔여 위험' '952\.225' '38\.883' 'MISSING.*11' '표본' 'marketplace.*보류|승격.*보류'; do
  if grep -Eq "$pattern" "$REPORT" 2>/dev/null; then pass "보고서 계약: $pattern"; else fail "보고서 계약: $pattern"; fi
done

if grep -Eq '^7\. \[x\].*외부 파일럿' "$ROOT/docs/product-direction.md"; then
  pass '제품 로드맵 외부 파일럿 완료 표시'
else
  fail '제품 로드맵 외부 파일럿 완료 표시'
fi

echo "RESULT: $PASS PASS, $FAIL FAIL"
[[ "$FAIL" -eq 0 ]]

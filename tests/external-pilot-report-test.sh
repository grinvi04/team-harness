#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JSON="$ROOT/docs/pilots/drivertree-v0.60.0.json"
REPORT="$ROOT/docs/pilots/drivertree-v0.60.0.md"
BEFORE_V61="$ROOT/docs/pilots/drivertree-v0.61.0-before.json"
AFTER_V61="$ROOT/docs/pilots/drivertree-v0.61.0-after.json"
REPORT_V61="$ROOT/docs/pilots/drivertree-v0.61.0.md"
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

if node - "$BEFORE_V61" "$AFTER_V61" <<'NODE'
const fs = require('fs')
const before = JSON.parse(fs.readFileSync(process.argv[2]))
const after = JSON.parse(fs.readFileSync(process.argv[3]))
const harnessCommit = 'e263e78926155c2451a0ca6df2ccfdd0a0b19290'
if (before.schemaVersion !== 1 || after.schemaVersion !== 1) process.exit(1)
if (before.harnessCommit !== harnessCommit || after.harnessCommit !== harnessCommit) process.exit(1)
if (before.repo.name !== 'DriveTree' || after.repo.name !== 'DriveTree') process.exit(1)
if (before.repo.branch !== 'develop' || after.repo.branch !== 'develop') process.exit(1)
if (before.repo.commit !== 'cb967b57296fe33adfcf87a482734b52a28a2e04') process.exit(1)
if (after.repo.commit !== '662464b78cd4ba712428f2743c327589b460ecc9') process.exit(1)
if (before.profile.healthy !== true || after.profile.healthy !== true) process.exit(1)
if (before.repositoryUnchanged !== true || after.repositoryUnchanged !== true) process.exit(1)
if (before.drift.ok !== 4 || before.drift.warn !== 3 || before.drift.missing !== 11) process.exit(1)
if (after.drift.ok !== 8 || after.drift.warn !== 0 || after.drift.missing !== 10) process.exit(1)
if (after.guard.sampleFalsePositives !== 0 || after.guard.sampleFalseNegatives !== 0) process.exit(1)
NODE
then
  pass 'v0.61.0 전후 JSON provenance·clean develop·드리프트 계약'
else
  fail 'v0.61.0 전후 JSON provenance·clean develop·드리프트 계약'
fi

for pattern in \
  'drivertree-v0\.61\.0-before\.json' \
  'drivertree-v0\.61\.0-after\.json' \
  'issues/74' \
  'pull/75' \
  'OK 4.*OK 8|OK.*4.*8' \
  'WARN 3.*WARN 0|WARN.*3.*0' \
  'MISSING 11.*MISSING 10|MISSING.*11.*10' \
  'commitlint' \
  'destructive-DDL|파괴적 DDL' \
  'Alembic' \
  'ActiveRecord' \
  '단일.*macOS|macOS.*단일' \
  '표본' \
  'branch-preview.*폐기|브랜치 preview.*폐기|브랜치.*guard.*폐기' \
  'installable:false' \
  'marketplace.*보류|승격.*보류'; do
  if grep -Eq "$pattern" "$REPORT_V61" 2>/dev/null; then pass "v0.61.0 보고서 계약: $pattern"; else fail "v0.61.0 보고서 계약: $pattern"; fi
done

if grep -Eq '^7\. \[x\].*외부 파일럿' "$ROOT/docs/product-direction.md"; then
  pass '제품 로드맵 외부 파일럿 완료 표시'
else
  fail '제품 로드맵 외부 파일럿 완료 표시'
fi

if grep -Eq 'pilots/drivertree-v0\.60\.0\.md' "$ROOT/docs/product-direction.md" &&
   grep -Eq 'pilots/drivertree-v0\.61\.0\.md' "$ROOT/docs/product-direction.md"; then
  pass '제품 로드맵 v0.60.0 이력과 v0.61.0 후속 증거 링크'
else
  fail '제품 로드맵 v0.60.0 이력과 v0.61.0 후속 증거 링크'
fi

echo "RESULT: $PASS PASS, $FAIL FAIL"
[[ "$FAIL" -eq 0 ]]

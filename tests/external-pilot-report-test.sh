#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JSON="$ROOT/docs/pilots/drivertree-v0.60.0.json"
REPORT="$ROOT/docs/pilots/drivertree-v0.60.0.md"
BEFORE_V61="$ROOT/docs/pilots/drivertree-v0.61.0-before.json"
AFTER_V61="$ROOT/docs/pilots/drivertree-v0.61.0-after.json"
REMEDIATED_V61="$ROOT/docs/pilots/drivertree-v0.61.0-remediated.json"
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

if node - "$BEFORE_V61" "$AFTER_V61" "$REMEDIATED_V61" <<'NODE'
const fs = require('fs')
const before = JSON.parse(fs.readFileSync(process.argv[2]))
const after = JSON.parse(fs.readFileSync(process.argv[3]))
const remediated = JSON.parse(fs.readFileSync(process.argv[4]))
const expectedRemote = 'github.com/grinvi04/drivertree.git'

function validIso8601(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
}

function nonnegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function validLimitations(limitations) {
  if (!Array.isArray(limitations) || limitations.length === 0) return false
  const text = limitations.join(' ')
  return /probes|command-string/.test(text) &&
    /not full false-positive or false-negative rates/.test(text) &&
    /application tests/.test(text) &&
    /deployments/.test(text) &&
    /LLM sessions/.test(text) &&
    /marketplace installation/.test(text)
}

function validPilot(report, expected) {
  return report.schemaVersion === 1 &&
    validIso8601(report.measuredAt) &&
    report.harnessCommit === expected.harnessCommit &&
    report.repo?.name === 'DriveTree' &&
    report.repo?.remote === expectedRemote &&
    report.repo?.branch === 'develop' &&
    report.repo?.commit === expected.commit &&
    report.profile?.name === 'agent-governed' &&
    report.profile?.runtime === 'codex' &&
    nonnegativeNumber(report.profile?.installMs) &&
    nonnegativeNumber(report.profile?.doctorMs) &&
    report.profile?.healthy === true &&
    report.drift?.exitCode === expected.exitCode &&
    report.drift?.total === 18 &&
    report.drift?.ok === expected.ok &&
    report.drift?.weak === 0 &&
    report.drift?.warn === expected.warn &&
    report.drift?.missing === expected.missing &&
    nonnegativeNumber(report.drift?.durationMs) &&
    report.guard?.benign?.total === 4 &&
    report.guard?.benign?.matched === 4 &&
    report.guard?.blocked?.total === 5 &&
    report.guard?.blocked?.matched === 5 &&
    report.guard?.sampleFalsePositives === 0 &&
    report.guard?.sampleFalseNegatives === 0 &&
    report.repositoryUnchanged === true &&
    validLimitations(report.limitations)
}

const beforeExpected = {
  harnessCommit: 'e263e78926155c2451a0ca6df2ccfdd0a0b19290',
  commit: 'cb967b57296fe33adfcf87a482734b52a28a2e04',
  exitCode: 1,
  ok: 4,
  warn: 3,
  missing: 11
}
const afterExpected = {
  harnessCommit: 'e263e78926155c2451a0ca6df2ccfdd0a0b19290',
  commit: '662464b78cd4ba712428f2743c327589b460ecc9',
  exitCode: 1,
  ok: 8,
  warn: 0,
  missing: 10
}
const remediatedExpected = {
  harnessCommit: 'fe000137d43fdd2eb743650ec5ec4001d70fcf12',
  commit: 'd71c0ac62a2712312d263d6de74500bc2c7ede25',
  exitCode: 0,
  ok: 18,
  warn: 0,
  missing: 0
}

if (
  !validPilot(before, beforeExpected) ||
  !validPilot(after, afterExpected) ||
  !validPilot(remediated, remediatedExpected)
) process.exit(1)

const missingMeasuredAt = structuredClone(before)
delete missingMeasuredAt.measuredAt
const missingLimitations = structuredClone(after)
delete missingLimitations.limitations
const staleRemediated = structuredClone(remediated)
staleRemediated.drift.missing = 1
if (
  validPilot(missingMeasuredAt, beforeExpected) ||
  validPilot(missingLimitations, afterExpected) ||
  validPilot(staleRemediated, remediatedExpected)
) process.exit(1)
NODE
then
  pass 'v0.61.0 전후·zero-drift JSON provenance·clean develop·전체 지표·변이 반례 계약'
else
  fail 'v0.61.0 전후 JSON provenance·clean develop·전체 지표·변이 반례 계약'
fi

if node - "$REPORT_V61" <<'NODE'
const fs = require('fs')
const report = fs.readFileSync(process.argv[2], 'utf8')
const mergeSha = '662464b78cd4ba712428f2743c327589b460ecc9'
const remediatedMergeSha = 'd71c0ac62a2712312d263d6de74500bc2c7ede25'

function namedSections(text, level, expectedTitles) {
  const marker = '#'.repeat(level)
  const headings = [...text.matchAll(new RegExp(`^${marker} ([^\\n]+)$`, 'gm'))]
  const sections = headings.map((heading, index) => ({
    title: heading[1],
    body: text.slice(
      heading.index + heading[0].length + 1,
      index + 1 < headings.length ? headings[index + 1].index : text.length
    )
  })).filter(section => expectedTitles.includes(section.title))
  if (sections.length !== expectedTitles.length) return null
  if (!sections.every((section, index) => section.title === expectedTitles[index])) return null
  return Object.fromEntries(sections.map(section => [section.title, section.body]))
}

function bulletMembers(text) {
  return [...text.matchAll(/^[ \t]+- (.+)$/gm)].map(match => match[1].trim())
}

function sameMembers(actual, expected) {
  return actual.length === expected.length &&
    expected.every(member => actual.includes(member))
}

function validReport(text) {
  const level2 = namedSections(text, 2, [
    '검증된 결과',
    '잔여 backlog',
    '해석과 제품 결정',
    '한계와 잔여 위험'
  ])
  if (!level2) return false
  const verified = level2['검증된 결과']
  const backlog = level2['잔여 backlog']
  const interpretation = level2['해석과 제품 결정']
  const limitations = level2['한계와 잔여 위험']

  const level3 = namedSections(interpretation, 3, ['검증된 사실', '추론', '결정'])
  if (!level3) return false
  const verifiedFacts = level3['검증된 사실']
  const inference = level3['추론']
  const decision = level3['결정']
  if (!verifiedFacts.trim() || !inference.trim() || !decision.trim()) return false

  const provenanceTitle = '1. **commit provenance chain — 4개**'
  const ddlTitle = '2. **stack-agnostic destructive DDL suite — 6개**'
  const provenanceStart = backlog.indexOf(provenanceTitle)
  const ddlStart = backlog.indexOf(ddlTitle)
  if (provenanceStart < 0 || ddlStart <= provenanceStart) return false
  const provenanceMembers = bulletMembers(backlog.slice(provenanceStart + provenanceTitle.length, ddlStart))
  const ddlMembers = bulletMembers(backlog.slice(ddlStart + ddlTitle.length))
  if (!sameMembers(provenanceMembers, [
    'commitlint gate',
    'commitlint config',
    'commit-msg hook',
    'commit message validator'
  ])) return false
  if (!sameMembers(ddlMembers, [
    'destructive-DDL workflow',
    'generic destructive-DDL checker',
    'Alembic workflow step',
    'Alembic checker',
    'ActiveRecord workflow step',
    'ActiveRecord checker'
  ])) return false

  return text.includes('[변경 전](drivertree-v0.61.0-before.json)') &&
    text.includes('[변경 후](drivertree-v0.61.0-after.json)') &&
    text.includes('[zero-drift 후속](drivertree-v0.61.0-remediated.json)') &&
    text.includes('[DriveTree Issue #74](https://github.com/grinvi04/drivertree/issues/74)') &&
    text.includes('[DriveTree PR #75](https://github.com/grinvi04/drivertree/pull/75)') &&
    text.includes('[DriveTree PR #77](https://github.com/grinvi04/drivertree/pull/77)') &&
    text.includes('[DriveTree PR #80](https://github.com/grinvi04/drivertree/pull/80)') &&
    text.includes('[DriveTree PR #82](https://github.com/grinvi04/drivertree/pull/82)') &&
    text.includes(mergeSha) &&
    text.includes(remediatedMergeSha) &&
    text.includes('## 후속 slice 완료 결과') &&
    /1166\.978 ms/.test(verified) &&
    /1185\.873 ms/.test(verified) &&
    /40\.208 ms, healthy/.test(verified) &&
    /39\.528 ms, healthy/.test(verified) &&
    /53\.214 ms, exit 1/.test(verified) &&
    /42\.715 ms, exit 1/.test(verified) &&
    /OK 4[\s\S]*OK 8/.test(verified) &&
    /WARN 3[\s\S]*WARN 0/.test(verified) &&
    /MISSING 11[\s\S]*MISSING 10/.test(verified) &&
    /1046\.162 ms/.test(text) &&
    /35\.696 ms, healthy/.test(text) &&
    /38\.225 ms, exit 0/.test(text) &&
    /OK 18[\s\S]*MISSING 0/.test(text) &&
    /commitlint[\s\S]*required context/.test(text) &&
    /destructive-ddl[\s\S]*required context/.test(text) &&
    /다음 로컬 품질 게이트가 모두 통과했다\./.test(verified) &&
    /backend: format, lint, build 통과; 테스트 \*\*8 suites \/ 70 tests\*\* 통과\./.test(verified) &&
    /frontend: format, lint, build 통과; 단위 테스트 \*\*2 files \/ 8 tests\*\* 통과\./.test(verified) &&
    /GitHub required CI도 병합 대상 SHA에서 모두 통과했다\./.test(verified) &&
    /backend real DB e2e/.test(verified) &&
    /frontend Playwright/.test(verified) &&
    /secret-scan/.test(verified) &&
    /Vercel Preview Comments/.test(verified) &&
    /Vercel commit status는 success/.test(verified) &&
    /미해결 review thread는 0개/.test(verified) &&
    /required가 아닌 repo-sync observation\s+job은 실패/.test(verified) &&
    /잔여 \*\*MISSING 10\*\*[\s\S]*exit 1/.test(verified) &&
    /branch-preview[\s\S]{0,200}폐기/.test(verified) &&
    /\*\*연결\*\*/.test(decision) &&
    /`installable:false`/.test(decision) &&
    /marketplace 승격 보류/.test(decision) &&
    /단일 public repo[\s\S]*단일 macOS[\s\S]*단일 시점/.test(limitations) &&
    /runner는 앱 dependency[\s\S]*배포[\s\S]*LLM session[\s\S]*marketplace install/.test(limitations) &&
    /명령 문자열 \*\*표본\*\*[\s\S]*모집단/.test(limitations) &&
    /branch-preview[\s\S]*폐기/.test(limitations)
}

if (!validReport(report)) process.exit(1)
if (validReport(report.split(mergeSha).join('0'.repeat(40)))) process.exit(1)
if (validReport(report.split(remediatedMergeSha).join('0'.repeat(40)))) process.exit(1)
if (validReport(report.replace('   - ActiveRecord checker', '   - moved ActiveRecord checker'))) process.exit(1)
if (validReport(report.replace('### 추론', '### 삭제된 추론'))) process.exit(1)
if (validReport(report.replace(
  '다음 로컬 품질 게이트가 모두 통과했다.',
  '다음 로컬 품질 게이트가 모두 실패했다.'
))) process.exit(1)
if (validReport(report.replace(
  'backend: format, lint, build 통과; 테스트',
  'backend: format, lint, build 실패; 테스트'
))) process.exit(1)
if (validReport(report.replace(
  'frontend: format, lint, build 통과; 단위 테스트',
  'frontend: format, lint, build 실패; 단위 테스트'
))) process.exit(1)
if (validReport(report.replace(
  'GitHub required CI도 병합 대상 SHA에서 모두 통과했다.',
  'GitHub required CI도 병합 대상 SHA에서 모두 실패했다.'
))) process.exit(1)
if (validReport(report.replace('### 추론', '#### 추론'))) process.exit(1)
const wrongOrder = report
  .replace('### 검증된 사실', '### 임시')
  .replace('### 추론', '### 검증된 사실')
  .replace('### 임시', '### 추론')
if (validReport(wrongOrder)) process.exit(1)
if (validReport(report.replace('### 결정', '### 추론\n\n중복\n\n### 결정'))) process.exit(1)
NODE
then
  pass 'v0.61.0 보고서 provenance·품질·CI·4+6 완료·zero-drift·결정·한계 구조 계약'
else
  fail 'v0.61.0 보고서 provenance·품질·CI·4+6 backlog·결정·한계 구조 계약'
fi

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

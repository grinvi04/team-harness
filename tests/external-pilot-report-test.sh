#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JSON="$ROOT/docs/pilots/drivertree-v0.60.0.json"
REPORT="$ROOT/docs/pilots/drivertree-v0.60.0.md"
BEFORE_V61="$ROOT/docs/pilots/drivertree-v0.61.0-before.json"
AFTER_V61="$ROOT/docs/pilots/drivertree-v0.61.0-after.json"
REMEDIATED_V61="$ROOT/docs/pilots/drivertree-v0.61.0-remediated.json"
REPORT_V61="$ROOT/docs/pilots/drivertree-v0.61.0.md"
WEBHOOK_V61="$ROOT/docs/pilots/webhook-service-v0.61.0.json"
WEBHOOK_SIM_V61="$ROOT/docs/pilots/webhook-service-v0.61.0-simulation.json"
WEBHOOK_REMEDIATED_V61="$ROOT/docs/pilots/webhook-service-v0.61.0-remediated.json"
WEBHOOK_REPORT_V61="$ROOT/docs/pilots/webhook-service-v0.61.0.md"
PRODUCT_DIRECTION="$ROOT/docs/product-direction.md"
PRODUCT_BOUNDARIES="$ROOT/docs/product-boundaries.md"
DECISIONS="$ROOT/docs/decisions.md"
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
    text.includes('[DriveTree Issue #76](https://github.com/grinvi04/drivertree/issues/76)') &&
    text.includes('[DriveTree PR #77](https://github.com/grinvi04/drivertree/pull/77)') &&
    text.includes('[Issue #78](https://github.com/grinvi04/drivertree/issues/78)') &&
    text.includes('[Issue #79](https://github.com/grinvi04/drivertree/issues/79)') &&
    text.includes('[DriveTree PR #80](https://github.com/grinvi04/drivertree/pull/80)') &&
    text.includes('[DriveTree Issue #81](https://github.com/grinvi04/drivertree/issues/81)') &&
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
    /5파일, 315 additions \/ 10 deletions/.test(text) &&
    /5파일, 979 additions/.test(text) &&
    /정본 fixture 92개[\s\S]*반례 12개[\s\S]*Prisma migration SQL 3개/.test(text) &&
    /commitlint[\s\S]*required context/.test(text) &&
    /destructive-ddl[\s\S]*required context/.test(text) &&
    /main 5개, develop 6개 required check/.test(text) &&
    /develop@d71c0ac6[\s\S]*core\.hooksPath=\.githooks/.test(text) &&
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
for (const issue of ['76', '78', '79', '81']) {
  if (validReport(report.replace(`/issues/${issue})`, `/issues/999)`))) process.exit(1)
}
if (validReport(report.replace('315 additions / 10 deletions', '316 additions / 10 deletions'))) process.exit(1)
if (validReport(report.replace('979 additions', '978 additions'))) process.exit(1)
if (validReport(report.replace('정본 fixture 92개', '정본 fixture 91개'))) process.exit(1)
if (validReport(report.replace('DriveTree 반례 12개', 'DriveTree 반례 11개'))) process.exit(1)
if (validReport(report.replace('Prisma migration SQL 3개', 'Prisma migration SQL 2개'))) process.exit(1)
if (validReport(report.replace('main 5개, develop 6개', 'main 4개, develop 6개'))) process.exit(1)
if (validReport(report.replace('core.hooksPath=.githooks', 'core.hooksPath=.git/hooks'))) process.exit(1)
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

if node - "$WEBHOOK_V61" <<'NODE'
const fs = require('fs')
const report = JSON.parse(fs.readFileSync(process.argv[2]))
if (report.schemaVersion !== 1) process.exit(1)
if (report.harnessCommit !== '45514b3d429452d87c058df2776cf34dc71a6ccb') process.exit(1)
if (report.repo?.name !== 'webhook-service') process.exit(1)
if (report.repo?.remote !== 'github.com/grinvi04/webhook-service.git') process.exit(1)
if (report.repo?.branch !== 'develop') process.exit(1)
if (report.repo?.commit !== '70123c72f4402096ac9c24d07f40320d6a39488a') process.exit(1)
if (report.profile?.healthy !== true || report.profile?.installMs !== 1044.457 || report.profile?.doctorMs !== 38.759) process.exit(1)
if (report.drift?.exitCode !== 1 || report.drift?.total !== 18 || report.drift?.ok !== 5 || report.drift?.warn !== 2 || report.drift?.missing !== 11) process.exit(1)
if (report.guard?.benign?.matched !== 4 || report.guard?.blocked?.matched !== 5) process.exit(1)
if (report.guard?.sampleFalsePositives !== 0 || report.guard?.sampleFalseNegatives !== 0) process.exit(1)
if (report.repositoryUnchanged !== true) process.exit(1)
function safeEvidence(value) {
  if (!Array.isArray(value.limitations) || value.limitations.length < 2) return false
  const serialized = JSON.stringify(value)
  if (/\/(Users|home)\/[A-Za-z0-9._-]+/.test(serialized)) return false
  if (/"(?:env|environment)":/.test(serialized)) return false
  if (/(?:ghp_|github_pat_|sk-|AKIA)[A-Za-z0-9_\-]{12,}/.test(serialized)) return false
  if (/BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY/.test(serialized)) return false
  return true
}
if (!safeEvidence(report)) process.exit(1)
const badLimitations = structuredClone(report)
badLimitations.limitations = []
const badPath = structuredClone(report)
badPath.limitations.push(`/${['Us', 'ers'].join('')}/example/private`)
const badEnvironment = structuredClone(report)
badEnvironment.environment = { ACCESS_TOKEN: 'redacted' }
const badSecret = structuredClone(report)
badSecret.limitations.push(`ghp_${'1234567890abcdef'}`)
for (const mutation of [badLimitations, badPath, badEnvironment, badSecret]) {
  if (safeEvidence(mutation)) process.exit(1)
}
NODE
then
  pass 'webhook-service v0.61.0 파일럿 JSON provenance·지표·불변·민감정보 반례 계약'
else
  fail 'webhook-service v0.61.0 파일럿 JSON provenance·지표·불변·민감정보 반례 계약'
fi

if node - "$WEBHOOK_SIM_V61" <<'NODE'
const fs = require('fs')
const evidence = JSON.parse(fs.readFileSync(process.argv[2]))
const expected = [
  ['baseline', 5, 2, 11, 1],
  ['stack-rules', 8, 0, 10, 1],
  ['commit-provenance', 12, 0, 6, 1],
  ['destructive-ddl', 18, 0, 0, 0]
]
function valid(value) {
  if (value.schemaVersion !== 1 || value.evidenceType !== 'repo-sync-slice-simulation') return false
  if (value.harnessCommit !== '45514b3d429452d87c058df2776cf34dc71a6ccb') return false
  if (value.reproducedWithHarnessCommit !== '1118b4b623bcad460a0647aadfc2190ba6858ab5') return false
  if (value.sourceVerification?.remoteDevelop !== '70123c72f4402096ac9c24d07f40320d6a39488a') return false
  if (value.sourceVerification?.canonicalInputsEquivalentToOriginal !== true) return false
  if (value.sourceVerification?.harnessInputBlobs?.length !== 11) return false
  if (!value.sourceVerification.harnessInputBlobs.every(item => item.identical && item.originalBlob === item.reproductionBlob)) return false
  if (value.repo?.commit !== '70123c72f4402096ac9c24d07f40320d6a39488a') return false
  if (value.repo?.headBefore !== value.repo.commit || value.repo?.statusBefore !== '') return false
  if (value.repo?.sourceRemoteModified !== false || value.repo?.simulationCloneModified !== true) return false
  if (value.command !== 'node scripts/check-repo-sync.mjs --repo <TARGET_REPO> --harness <TEAM_HARNESS>') return false
  if (value.normalization?.['<TARGET_REPO>'] !== 'isolated clone path') return false
  if (!Array.isArray(value.slices) || value.slices.length !== expected.length) return false
  for (let i = 0; i < expected.length; i++) {
    const [name, ok, warn, missing, exitCode] = expected[i]
    const slice = value.slices[i]
    if (slice.name !== name || slice.head !== value.repo.commit) return false
    if (slice.repoSync?.exitCode !== exitCode || slice.repoSync?.total !== 18) return false
    if (slice.repoSync?.ok !== ok || slice.repoSync?.weak !== 0 || slice.repoSync?.warn !== warn || slice.repoSync?.missing !== missing) return false
    const summary = `요약: 대상 18개 · OK ${ok} · WEAK 0 · WARN ${warn} · MISSING ${missing}`
    if (!slice.repoSync.stdout.includes(summary)) return false
    if (!Array.isArray(slice.appliedAssets)) return false
  }
  if (value.slices[0].appliedAssets.length !== 0) return false
  if (!value.slices[1].appliedAssets.includes('.claude/rules/python.md')) return false
  if (!value.slices[2].appliedAssets.includes('scripts/check-commit-message.cjs')) return false
  if (!value.slices[3].appliedAssets.includes('scripts/check-alembic-destructive-ddl.mjs')) return false
  if (value.assetProvenance?.length !== 11) return false
  if (!value.assetProvenance.filter(item => item.operation === 'copy').every(item => item.identical && item.sourceSha256 === item.targetSha256)) return false
  const validations = Object.fromEntries((value.validations || []).map(item => [item.name, item]))
  if (!Object.values(validations).every(item => item.exitCode === 0 && item.stderr === '')) return false
  if (!/마이그레이션 2개/.test(validations['target-alembic']?.summary || '')) return false
  if (validations['fixture-sql']?.summary !== '결과: PASS=24 FAIL=0') return false
  if (validations['fixture-alembic']?.summary !== '결과: PASS=31 FAIL=0') return false
  if (validations['fixture-activerecord']?.summary !== '결과: PASS=37 FAIL=0') return false
  if (validations['commit-message']?.summary !== '결과: PASS=46 FAIL=0') return false
  if (!Array.isArray(value.limitations) || value.limitations.length < 2) return false
  const serialized = JSON.stringify(value)
  if (/\/(Users|home)\/[A-Za-z0-9._-]+/.test(serialized)) return false
  if (/"(?:env|environment)":/.test(serialized)) return false
  if (/(?:ghp_|github_pat_|sk-|AKIA)[A-Za-z0-9_\-]{12,}/.test(serialized)) return false
  if (/BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY/.test(serialized)) return false
  return true
}
if (!valid(evidence)) process.exit(1)
const badCount = structuredClone(evidence)
badCount.slices[3].repoSync.ok = 17
const badOutput = structuredClone(evidence)
badOutput.slices[2].repoSync.stdout = badOutput.slices[2].repoSync.stdout.replace('OK 12', 'OK 11')
const badPath = structuredClone(evidence)
badPath.slices[0].repoSync.stdout += `\n/${['Us', 'ers'].join('')}/example/private`
const badSecret = structuredClone(evidence)
badSecret.slices[0].repoSync.stderr += '\nghp_1234567890abcdef'
for (const mutation of [badCount, badOutput, badPath, badSecret]) if (valid(mutation)) process.exit(1)
NODE
then
  pass 'webhook-service slice별 raw repo-sync·provenance·민감정보 반례 계약'
else
  fail 'webhook-service slice별 raw repo-sync·provenance·민감정보 반례 계약'
fi

if node - "$WEBHOOK_REMEDIATED_V61" <<'NODE'
const fs = require('fs')
const evidence = JSON.parse(fs.readFileSync(process.argv[2]))
const expected = {
  harnessCommit: '7c872545a732d5da44ba032622e39c4ecd056a09',
  repoCommit: '9743ca849d6d7a746df19e22f74422a7128b90e1'
}
function nonnegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
function validIso8601(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
}
function valid(value) {
  if (value.schemaVersion !== 1 || !validIso8601(value.measuredAt) || value.harnessCommit !== expected.harnessCommit) return false
  if (value.repo?.name !== 'webhook-service' || value.repo?.remote !== 'github.com/grinvi04/webhook-service.git') return false
  if (value.repo?.branch !== 'develop' || value.repo?.commit !== expected.repoCommit) return false
  if (value.profile?.name !== 'agent-governed' || value.profile?.runtime !== 'codex' || value.profile?.healthy !== true) return false
  if (!nonnegativeNumber(value.profile?.installMs) || !nonnegativeNumber(value.profile?.doctorMs)) return false
  if (value.drift?.exitCode !== 0 || value.drift?.total !== 18 || value.drift?.ok !== 18) return false
  if (value.drift?.weak !== 0 || value.drift?.warn !== 0 || value.drift?.missing !== 0) return false
  if (JSON.stringify(value.drift?.stacks) !== JSON.stringify(['python', 'alembic'])) return false
  if (!nonnegativeNumber(value.drift?.durationMs)) return false
  if (value.guard?.benign?.total !== 4 || value.guard?.benign?.matched !== 4) return false
  if (value.guard?.blocked?.total !== 5 || value.guard?.blocked?.matched !== 5) return false
  if (value.guard?.sampleFalsePositives !== 0 || value.guard?.sampleFalseNegatives !== 0) return false
  const expectedProbes = {
    benign: ['git-status', 'node-check', 'test-runner', 'project-build'],
    blocked: ['protected-commit', 'hard-reset', 'force-push', 'global-install', 'test-deletion']
  }
  for (const [kind, names] of Object.entries(expectedProbes)) {
    const probes = value.guard?.[kind]?.probes
    const expectedExit = kind === 'benign' ? 0 : 2
    if (!Array.isArray(probes) || probes.length !== names.length) return false
    if (!probes.every((probe, index) => probe.name === names[index] &&
      probe.expectedExit === expectedExit && probe.actualExit === expectedExit && probe.matched === true)) return false
  }
  if (value.repositoryUnchanged !== true || !Array.isArray(value.limitations) || value.limitations.length < 2) return false
  const serialized = JSON.stringify(value)
  if (/\/(Users|home)\/[A-Za-z0-9._-]+/.test(serialized)) return false
  if (/"(?:env|environment)":/.test(serialized)) return false
  if (/(?:ghp_|github_pat_|sk-|AKIA)[A-Za-z0-9_\-]{12,}/.test(serialized)) return false
  if (/BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY/.test(serialized)) return false
  return true
}
if (!valid(evidence)) process.exit(1)
const staleCommit = structuredClone(evidence)
staleCommit.repo.commit = '0'.repeat(40)
const missingMeasuredAt = structuredClone(evidence)
delete missingMeasuredAt.measuredAt
const staleDrift = structuredClone(evidence)
staleDrift.drift.missing = 1
const staleStacks = structuredClone(evidence)
staleStacks.drift.stacks = ['python']
const staleProbe = structuredClone(evidence)
staleProbe.guard.blocked.probes[0].actualExit = 0
const missingLimitations = structuredClone(evidence)
delete missingLimitations.limitations
const badPath = structuredClone(evidence)
badPath.limitations.push(`/${['Us', 'ers'].join('')}/example/private`)
const badSecret = structuredClone(evidence)
badSecret.limitations.push(`ghp_${'1234567890abcdef'}`)
for (const mutation of [
  staleCommit,
  missingMeasuredAt,
  staleDrift,
  staleStacks,
  staleProbe,
  missingLimitations,
  badPath,
  badSecret
]) {
  if (valid(mutation)) process.exit(1)
}
NODE
then
  pass 'webhook-service 실제 backfill JSON provenance·zero-drift·불변·민감정보 반례 계약'
else
  fail 'webhook-service 실제 backfill JSON provenance·zero-drift·불변·민감정보 반례 계약'
fi

if node - "$WEBHOOK_REPORT_V61" "$PRODUCT_DIRECTION" "$WEBHOOK_SIM_V61" "$WEBHOOK_REMEDIATED_V61" "$PRODUCT_BOUNDARIES" "$DECISIONS" <<'NODE'
const fs = require('fs')
const report = fs.readFileSync(process.argv[2], 'utf8')
const direction = fs.readFileSync(process.argv[3], 'utf8')
const simulation = JSON.parse(fs.readFileSync(process.argv[4]))
const remediated = JSON.parse(fs.readFileSync(process.argv[5]))
const boundaries = fs.readFileSync(process.argv[6], 'utf8')
const decisions = fs.readFileSync(process.argv[7], 'utf8')
function validReport(text) {
  return /## 검증된 결과/.test(text) &&
    /## zero-drift simulation/.test(text) &&
    /## 제품 결정/.test(text) &&
    /## 한계와 후속/.test(text) &&
    /45514b3d429452d87c058df2776cf34dc71a6ccb/.test(text) &&
    /70123c72f4402096ac9c24d07f40320d6a39488a/.test(text) &&
    /1044\.457 ms/.test(text) && /38\.759 ms/.test(text) &&
    /OK 5[\s\S]*WARN 2[\s\S]*MISSING 11/.test(text) &&
    /OK 8[\s\S]*MISSING 10/.test(text) &&
    /OK 12[\s\S]*MISSING 6/.test(text) &&
    /OK 18[\s\S]*WARN 0[\s\S]*MISSING 0/.test(text) &&
    /migration 2개/.test(text) && /92개/.test(text) && /46개/.test(text) &&
    /repositoryUnchanged=true/.test(text) &&
    /Team Harness Issue #397/.test(text) &&
    /webhook-service-v0\.61\.0-simulation\.json/.test(text) &&
    /webhook-service-v0\.61\.0-remediated\.json/.test(text) &&
    /실제 webhook-service 저장소와 GitHub 정책은 변경하지 않았다/.test(text) &&
    /원격 `develop` SHA는 측정 SHA와 일치했다/.test(text) &&
    /main·develop branch protection[\s\S]*alembic-heads[\s\S]*build-and-test[\s\S]*secret-scan/.test(text) &&
    /webhook-service Issue #68/.test(text) && /webhook-service PR #69/.test(text) &&
    /9743ca849d6d7a746df19e22f74422a7128b90e1/.test(text) &&
    text.includes(`${remediated.profile.installMs} ms`) &&
    text.includes(`doctor ${remediated.profile.doctorMs} ms`) &&
    text.includes(`repo-sync ${remediated.drift.durationMs} ms`) &&
    /56 passed/.test(text) && /22 source files/.test(text) && /634bbf55b755/.test(text) &&
    /main·develop[\s\S]*required context[\s\S]*5개/.test(text) &&
    /commitlint[\s\S]*destructive-ddl/.test(text) &&
    /원격 develop CI[\s\S]*모두 성공/.test(text) &&
    /\*\*연결\*\*/.test(text) && /installable:false/.test(text) && /marketplace 승격 보류/.test(text)
}
if (!validReport(report)) process.exit(1)
for (const slice of simulation.slices) {
  const {ok, warn, missing} = slice.repoSync
  if (!report.includes(`OK ${ok} · WARN ${warn} · MISSING ${missing}`)) process.exit(1)
}
if (!report.includes(`OK ${remediated.drift.ok} · WARN ${remediated.drift.warn} · MISSING ${remediated.drift.missing}`)) process.exit(1)
for (const mutation of [
  report.split('MISSING 11').join('MISSING 10'),
  report.split('OK 18').join('OK 17'),
  report.replace('migration 2개', 'migration 1개'),
  report.split('repositoryUnchanged=true').join('repositoryUnchanged=false'),
  report.replace('측정 SHA와 일치했다', '측정 SHA와 불일치했다'),
  report.replace(`${remediated.profile.installMs} ms`, '0 ms'),
  report.replace(`doctor ${remediated.profile.doctorMs} ms`, 'doctor 0 ms'),
  report.replace(`repo-sync ${remediated.drift.durationMs} ms`, 'repo-sync 0 ms'),
  report.replace('56 passed', '55 passed'),
  report.split('required context 5개').join('required context 4개')
]) if (validReport(mutation)) process.exit(1)
if (!/^9\. \[x\] \*\*두 번째 외부 파일럿:/m.test(direction)) process.exit(1)
const drivetreeDecision = decisions.indexOf('DriveTree v0.61.0 잔여 MISSING 10을 두 slice로 적용해 zero-drift를 실측')
const simulationDecision = decisions.indexOf('두 번째 외부 파일럿을 Python·Alembic webhook-service에서 측정하고 zero-drift 경로를 simulation')
const completionDecision = decisions.indexOf('webhook-service 실제 backfill을 완료')
if (drivetreeDecision < 0 || simulationDecision <= drivetreeDecision || completionDecision <= simulationDecision) process.exit(1)
const drivetree = decisions.slice(drivetreeDecision, simulationDecision)
const simulationDecisionRow = decisions.slice(simulationDecision, completionDecision)
const completion = decisions.slice(completionDecision)
if (!/PR #69[\s\S]*9743ca849d6d7a746df19e22f74422a7128b90e1[\s\S]*OK 18[\s\S]*MISSING 0[\s\S]*required context 5개/.test(completion)) process.exit(1)
for (const decision of [drivetree, simulationDecisionRow, completion]) {
  if (!/\*\*버전정책\*\*:[\s\S]*PATCH[\s\S]*\*\*0\.61\.1\*\*/.test(decision)) process.exit(1)
}
if (!/webhook-service[\s\S]*PR #69[\s\S]*OK 18[\s\S]*MISSING 0[\s\S]*required context 5개/.test(boundaries)) process.exit(1)
if (/실제 소비 repo 병합·required gate 증거[\s\S]{0,80}남았다/.test(boundaries)) process.exit(1)
NODE
then
  pass 'webhook-service 파일럿 보고서·simulation·실제 backfill·제품 결정·완료 로드맵 계약'
else
  fail 'webhook-service 파일럿 보고서·simulation·실제 backfill·제품 결정·완료 로드맵 계약'
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

#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
JSON="$ROOT/docs/pilots/codex-native-loader-v0.61.0.json"
REPORT="$ROOT/docs/pilots/codex-native-loader-v0.61.0.md"
MANIFEST="$ROOT/plugins/harness-guard/.codex-plugin/plugin.json"
TRUST="$ROOT/docs/pilots/codex-native-loader-trusted-binaries.json"

node - "$JSON" "$MANIFEST" "$TRUST" "$ROOT" <<'NODE'
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const [reportPath, manifestPath, trustPath, root] = process.argv.slice(2)
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const trust = JSON.parse(fs.readFileSync(trustPath, 'utf8'))
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1) }
const sha256 = /^sha256:[0-9a-f]{64}$/
const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`
if (report.status !== 'pass' || report.harness?.version !== manifest.version) fail('status/version mismatch')
if (!/^[0-9a-f]{40}$/.test(report.harness?.revision || '')) fail('source revision missing')
const expectedTree = execFileSync('git', ['rev-parse', `${report.harness.revision}^{tree}`], {
  cwd: root,
  encoding: 'utf8',
}).trim()
if (report.harness?.tree !== expectedTree) fail('tested tree is not bound to source revision')
if (report.evidence?.mode !== 'live') fail('committed pilot is not live evidence')
if (
  report.codex?.binary?.name !== 'codex' ||
  typeof report.codex?.binary?.path !== 'string' ||
  !path.isAbsolute(report.codex.binary.path) ||
  !sha256.test(report.codex?.binary?.digest || '')
) {
  fail('verified Codex binary evidence missing')
}
if (!trust[report.codex.version]?.includes(report.codex.binary.digest)) fail('Codex binary digest is not trusted')
if (report.loader?.installed !== true || report.loader?.nativeSkills !== 16) fail('loader evidence missing')
if (report.session?.destructiveGuard !== true || report.session?.secretEgressGuard !== true) fail('guard evidence missing')
if (report.session?.routing !== 'feature-add') fail('routing evidence missing')
for (const [key, marker] of [
  ['guardTranscript', ['PASS: destructive guard fresh-session block', 'PASS: secret-egress guard fresh-session block']],
  ['routingTranscript', ['feature-add']],
]) {
  const evidence = report.session?.evidence?.[key]
  if (!sha256.test(evidence?.digest || '') || !/^[a-z0-9.-]+$/.test(evidence?.file || '')) {
    fail(`${key} artifact metadata missing`)
  }
  const content = fs.readFileSync(path.join(path.dirname(reportPath), evidence.file), 'utf8')
  if (digest(content) !== evidence.digest) fail(`${key} digest mismatch`)
  for (const expected of marker) {
    if (!content.includes(expected)) fail(`${key} semantic evidence missing: ${expected}`)
  }
}
if (report.userState?.unchanged !== true || report.sourceState?.unchanged !== true) fail('state evidence missing')
if (report.cleanup?.isolatedHomeRemoved !== true) fail('cleanup evidence missing')
if (report.splitPackages?.promoted !== false) fail('split-package verdict changed')
const changedAfterPilot = execFileSync(
  'git',
  ['diff', '--name-only', `${report.harness.revision}..HEAD`],
  { cwd: root, encoding: 'utf8' },
).trim().split('\n').filter(Boolean)
const allowedAfterPilot = new Set([
  'CHANGELOG.md',
  'docs/pilots/codex-native-loader-v0.61.0.guard.txt',
  'docs/pilots/codex-native-loader-v0.61.0.json',
  'docs/pilots/codex-native-loader-v0.61.0.md',
  'docs/pilots/codex-native-loader-v0.61.0.routing.jsonl',
])
const disallowed = changedAfterPilot.filter((file) => !allowedAfterPilot.has(file))
if (disallowed.length > 0) fail(`release candidate changed after pilot: ${disallowed.join(', ')}`)
NODE

grep -Fq -- '- 판정: **PASS**' "$REPORT"
grep -Fq '## 검증됨' "$REPORT"
grep -Fq '## 판정·한계' "$REPORT"
grep -Fq '실행 증거: live' "$REPORT"
grep -Fq 'session-network-unavailable' "$REPORT"
grep -Fq 'split package 승격: **아니오**' "$REPORT"
if rg -n 'auth\.json|github_pat_|gh[pousr]_|sk-[A-Za-z0-9]' "$JSON" "$REPORT" "$ROOT/docs/pilots/codex-native-loader-v0.61.0.guard.txt" "$ROOT/docs/pilots/codex-native-loader-v0.61.0.routing.jsonl"; then
  echo 'FAIL: pilot report contains an auth path or token-shaped value'
  exit 1
fi
grep -Fq 'pilots/codex-native-loader-v0.61.0.md' "$ROOT/docs/product-direction.md"

echo 'PASS: committed Codex native loader pilot report preserves evidence, limits, and non-promotion verdict'

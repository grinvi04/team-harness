#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
JSON="$ROOT/docs/pilots/codex-native-loader-v0.61.0.json"
REPORT="$ROOT/docs/pilots/codex-native-loader-v0.61.0.md"
MANIFEST="$ROOT/plugins/harness-guard/.codex-plugin/plugin.json"

node - "$JSON" "$MANIFEST" <<'NODE'
const fs = require('node:fs')
const [reportPath, manifestPath] = process.argv.slice(2)
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1) }
if (report.status !== 'pass' || report.harness?.version !== manifest.version) fail('status/version mismatch')
if (!/^[0-9a-f]{40}$/.test(report.harness?.revision || '')) fail('source revision missing')
if (report.loader?.installed !== true || report.loader?.nativeSkills !== 16) fail('loader evidence missing')
if (report.session?.destructiveGuard !== true || report.session?.secretEgressGuard !== true) fail('guard evidence missing')
if (report.session?.routing !== 'feature-add') fail('routing evidence missing')
if (report.userState?.unchanged !== true || report.sourceState?.unchanged !== true) fail('state evidence missing')
if (report.cleanup?.isolatedHomeRemoved !== true) fail('cleanup evidence missing')
if (report.splitPackages?.promoted !== false) fail('split-package verdict changed')
NODE

grep -Fq -- '- 판정: **PASS**' "$REPORT"
grep -Fq '## 검증됨' "$REPORT"
grep -Fq '## 판정·한계' "$REPORT"
grep -Fq 'session-network-unavailable' "$REPORT"
grep -Fq 'split package 승격: **아니오**' "$REPORT"
if rg -n 'auth\.json|github_pat_|gh[pousr]_|sk-[A-Za-z0-9]' "$JSON" "$REPORT"; then
  echo 'FAIL: pilot report contains an auth path or token-shaped value'
  exit 1
fi
grep -Fq 'pilots/codex-native-loader-v0.61.0.md' "$ROOT/docs/product-direction.md"

echo 'PASS: committed Codex native loader pilot report preserves evidence, limits, and non-promotion verdict'

#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SOURCE="$ROOT/plugins/harness-guard/tools/orchestration"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/harness-orchestration.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

# Work in a disposable copy so npm/test output never becomes a plugin source file.
mkdir "$TMP/source" "$TMP/consumer" "$TMP/artifacts"
git -C "$ROOT" ls-files -z -- plugins/harness-guard/tools/orchestration |
  python3 -c 'import sys,pathlib,shutil
root,out=map(pathlib.Path,sys.argv[1:])
prefix="plugins/harness-guard/tools/orchestration/"
for raw in sys.stdin.buffer.read().split(b"\0"):
 if not raw: continue
 name=raw.decode(); target=out/name[len(prefix):]
 target.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(root/name,target)
' "$ROOT" "$TMP/source"
(cd "$TMP/source" && npm ci --ignore-scripts && npm test && npm run check && npm pack --ignore-scripts --pack-destination "$TMP/artifacts" --json > "$TMP/pack.json")
node - "$TMP/pack.json" <<'NODE'
const assert = require('node:assert/strict');
const pack = require(process.argv[2])[0];
assert.equal(pack.name, 'team-harness-orchestration');
for (const file of pack.files) {
  assert(!/(^|\/)(node_modules|\.codex|\.agents|\.runtime-smoke|archive)(\/|$)|\.tgz$/.test(file.path), file.path);
}
NODE
(cd "$TMP/consumer" && npm install --ignore-scripts --no-audit --no-fund "$TMP/artifacts/"*.tgz)
git init -q "$TMP/consumer"
node - "$TMP/consumer" <<'NODE'
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const installed = path.join(root, 'node_modules/team-harness-orchestration');
const example = name => path.join(installed, 'examples', name + '.json');
function bin(name, args, status = 0) {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/.bin', name), ...args], { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, status, result.stderr);
  return result;
}
bin('ao-project', ['start', root, 'packed-request', 'local request']);
assert.match(readFileSync(path.join(root, 'docs/orchestration/packed-request.md'), 'utf8'), /^상태: DRAFT$/m);
assert(!existsSync(path.join(root, '.codex')));
assert(!existsSync(path.join(root, '.agents')));
bin('ao-envelope-check', [example('task'), example('artifact')]);
bin('ao-contract-check', [example('task'), example('artifact')]);
bin('ao-assignment-check', [example('task'), example('assignment'), example('artifact')]);
bin('ao-dispatch-check', [example('task'), example('assignment-ready')]);
const stale = JSON.parse(readFileSync(example('assignment-ready')));
stale.task_revision = 'stale';
const staleFile = path.join(root, 'stale.json');
writeFileSync(staleFile, JSON.stringify(stale));
assert.equal(JSON.parse(bin('ao-dispatch-check', [example('task'), staleFile], 1).stdout).valid, false);
bin('ao-contract-check', [], 2);
const api = spawnSync(process.execPath, ['--input-type=module', '--eval', `
  import assert from 'node:assert/strict';
  import { readFileSync } from 'node:fs';
  const load = name => JSON.parse(readFileSync('node_modules/team-harness-orchestration/examples/' + name + '.json'));
  const cases = [
    ['envelope', 'validateEnvelope', [load('task')], 'schema-only'],
    ['contract', 'validateContract', [load('task'), load('artifact')], 'contract-only'],
    ['assignment', 'validateAssignment', [load('task'), load('assignment'), load('artifact')], 'assignment-only'],
    ['dispatch', 'validateDispatch', [load('task'), load('assignment-ready')], 'dispatch-only'],
  ];
  for (const [subpath, name, args, scope] of cases) {
    const module = await import('team-harness-orchestration/' + subpath);
    const result = module[name](...args);
    assert.equal(result.valid, true);
    assert.equal(result.scope, scope);
  }
`], { cwd: root, encoding: 'utf8' });
assert.ifError(api.error);
assert.equal(api.status, 0, api.stderr);
NODE
echo 'PASS: isolated package install, all public CLI entry points, rejected stale declaration, and DRAFT-only creation'

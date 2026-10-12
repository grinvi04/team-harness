import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
const scripts = path.resolve('plugins/harness-guard/scripts')
const head = 'a'.repeat(40)
const policy = { strict: true, contexts: ['quality'], checks: [{ context: 'quality', app_id: 1 }] }
const run = { id: 10, name: 'quality', head_sha: head, status: 'completed', conclusion: 'success', app: { id: 1 } }
function verify(runs, statuses = [], p = policy) {
  return spawnSync(process.execPath, [path.join(scripts, 'verify-required-checks.mjs'), head,
    ...[p, [{ name: 'quality', bucket: 'pass' }], [{ total_count: runs.length, check_runs: runs }], [statuses]].map(JSON.stringify)]).status
}
test('current bound check succeeds', () => assert.equal(verify([run]), 0))
test('historical success cannot hide later failure', () => assert.notEqual(verify([run, { ...run, id: 11, conclusion: 'failure' }]), 0))
test('historical success cannot hide later wrong app', () => assert.notEqual(verify([run, { ...run, id: 11, app: { id: 2 } }]), 0))
test('external status success is allowed for unbound policy', () => assert.equal(verify([], [{ id: 10, context: 'quality', state: 'success' }], { strict: true, contexts: ['quality'], checks: [] }), 0))
test('older external success cannot hide failure', () => assert.notEqual(verify([], [{ id: 10, context: 'quality', state: 'success' }, { id: 11, context: 'quality', state: 'failure' }], { strict: true, contexts: ['quality'], checks: [] }), 0))
test('repo policy CLI denies company default even in path containing spaces', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'company policy '))
  try {
    const script = path.join(dir, 'repo policy.mjs'); cpSync(path.join(scripts, 'repo-policy.mjs'), script)
    assert.notEqual(spawnSync(process.execPath, [script, dir, 'solo']).status, 0)
    assert.notEqual(spawnSync(process.execPath, [script, dir, 'auto', 'develop']).status, 0)
    writeFileSync(path.join(dir, '.harness-policy.json'), JSON.stringify({ schemaVersion: 1, mode: 'solo', autoMergeTargets: ['develop'] }))
    assert.equal(spawnSync(process.execPath, [script, dir, 'solo']).status, 0)
    assert.equal(spawnSync(process.execPath, [script, dir, 'auto', 'develop']).status, 0)
    assert.notEqual(spawnSync(process.execPath, [script, dir, 'auto', 'main']).status, 0)
    writeFileSync(path.join(dir, '.harness-policy.json'), '{}')
    assert.notEqual(spawnSync(process.execPath, [script, dir, 'solo']).status, 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

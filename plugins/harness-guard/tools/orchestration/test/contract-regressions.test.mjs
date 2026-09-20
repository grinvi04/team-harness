import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateContract } from '../scripts/validate-contract.mjs';

const taskText = readFileSync(new URL('../examples/task.json', import.meta.url), 'utf8');
const artifactText = readFileSync(new URL('../examples/artifact.json', import.meta.url), 'utf8');
const script = fileURLToPath(new URL('../scripts/validate-contract.mjs', import.meta.url));

for (const epoch of [0, 9007199254740991]) {
  test(`accepts equal epochs at safe boundary ${epoch}`, () => {
    const task = JSON.parse(taskText);
    const artifact = JSON.parse(artifactText);
    task.ownership[0].epoch = artifact.ownership_epoch = epoch;
    assert.deepEqual(validateContract(task, artifact), { valid: true, scope: 'contract-only', errors: [] });
  });
}

for (const [name, change, path] of [
  ['equal unsafe parsed values', (task, artifact) => {
    task.ownership[0].epoch = artifact.ownership_epoch = 9007199254740992;
  }, '/task/ownership/0/epoch'],
  ['unsafe epoch on another owner', task => {
    task.roles.push({ role: 'worker', instance_id: 'writer-2' });
    task.ownership.push({ owner: 'writer-2', kind: 'path', target: 'src/other.mjs', epoch: 9007199254740992 });
  }, '/task/ownership/1/epoch'],
  ['unsafe epoch on a read-only report', (task, artifact) => {
    task.ownership = [];
    artifact.owned_scope = [];
    artifact.ownership_epoch = 9007199254740992;
  }, '/artifact/ownership_epoch'],
]) {
  test(`rejects ${name} instead of treating lossy numbers as a proven match`, () => {
    const task = JSON.parse(taskText);
    const artifact = JSON.parse(artifactText);
    change(task, artifact);
    const result = validateContract(task, artifact);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.path === path && error.rule === 'unsafe-epoch'));
  });
}

for (const [taskEpoch, artifactEpoch, rule] of [
  ['9007199254740993', '9007199254740992', 'unsafe-epoch'],
  ['9007199254740992', '9007199254740993', 'unsafe-epoch'],
  ['1.0000000000000001', '1', 'invalid-epoch-literal'],
  ['1', '1e0', 'invalid-epoch-literal'],
]) {
  test(`CLI rejects ambiguous or noncanonical epoch literals ${taskEpoch} / ${artifactEpoch}`, t => {
    const dir = mkdtempSync(join(tmpdir(), 'contract-precision-test-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    writeFileSync(join(dir, 'task.json'), taskText.replace('"epoch": 1', `"epoch": ${taskEpoch}`));
    writeFileSync(join(dir, 'artifact.json'), artifactText.replace('"ownership_epoch": 1', `"ownership_epoch": ${artifactEpoch}`));
    const result = spawnSync(process.execPath, [script, 'task.json', 'artifact.json'], { cwd: dir, encoding: 'utf8', timeout: 5000 });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some(error => error.rule === rule), result.stdout);
  });
}

for (const empty of [true, false]) {
  test(`rejects overall FAIL without failing evidence (${empty ? 'empty partial' : 'all PASS'})`, () => {
    const task = JSON.parse(taskText);
    const artifact = JSON.parse(artifactText);
    artifact.verdict = 'FAIL';
    if (empty) {
      artifact.complete = false;
      artifact.claims = [];
      artifact.evidence = [];
    }
    const result = validateContract(task, artifact);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.path === '/artifact/verdict' && error.rule === 'unsupported-fail'));
  });
}

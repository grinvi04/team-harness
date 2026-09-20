import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/validate-contract.mjs', import.meta.url));
const taskText = readFileSync(new URL('../examples/task.json', import.meta.url), 'utf8');
const artifactText = readFileSync(new URL('../examples/artifact.json', import.meta.url), 'utf8');

function workspace(t, task = taskText, artifact = artifactText) {
  const dir = mkdtempSync(join(tmpdir(), 'contract-cli-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'task.json'), task);
  writeFileSync(join(dir, 'artifact.json'), artifact);
  return dir;
}

function run(dir, args = ['task.json', 'artifact.json'], entry = script) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd: dir, encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  return result;
}

function report(result, status) {
  assert.equal(result.status, status);
  assert.equal(result.stderr, '');
  assert.notEqual(result.stdout.trim(), '', 'must inspect the pair, not silently exit');
  const value = JSON.parse(result.stdout);
  assert.equal(value.scope, 'contract-only');
  return value;
}

test('pair CLI works from an unrelated cwd and leaves input bytes and directory unchanged', t => {
  const dir = workspace(t);
  const hash = name => createHash('sha256').update(readFileSync(join(dir, name))).digest('hex');
  const before = ['task.json', 'artifact.json'].map(hash);
  assert.deepEqual(report(run(dir), 0), { valid: true, scope: 'contract-only', errors: [] });
  assert.deepEqual(['task.json', 'artifact.json'].map(hash), before);
  assert.deepEqual(readdirSync(dir).sort(), ['artifact.json', 'task.json']);
});

test('pair CLI rejects a semantic mismatch that schema-only accepts', t => {
  const artifact = JSON.parse(artifactText);
  artifact.run_id = 'private-marker-old-run';
  const result = run(workspace(t, taskText, JSON.stringify(artifact)));
  const value = report(result, 1);
  assert.equal(value.valid, false);
  assert.ok(value.errors.some(error => error.path === '/artifact/run_id' && error.rule === 'task-mismatch'));
  assert.ok(!result.stdout.includes('private-marker'));
});

for (const [name, raw, rule] of [
  ['malformed JSON', '{"secret":"private-marker", trailing', 'invalid-json'],
  ['structurally invalid data', '{"kind":"private-marker"}', 'const'],
  ['duplicate root key', taskText.replace('"kind": "task"', '"kind": "private-marker", "kind": "task"'), 'duplicate-key'],
  ['escaped duplicate key', taskText.replace('"task_id":', '"task_\\u0069d": "private-marker", "task_id":'), 'duplicate-key'],
  ['nested duplicate key in an array', taskText.replace('"required": true', '"required": false, "required": true'), 'duplicate-key'],
  ['nested duplicate object value', taskText.replace('"authority":', '"authority": {"private-marker": []}, "authority":'), 'duplicate-key'],
]) {
  test(`pair CLI rejects ${name} without disclosing the payload`, t => {
    const result = run(workspace(t, raw));
    const value = report(result, 1);
    assert.equal(value.valid, false);
    assert.ok(value.errors.some(error => error.rule === rule), result.stdout);
    assert.ok(!`${result.stdout}${result.stderr}`.includes('private-marker'));
  });
}

test('duplicate keys are also rejected in the artifact input', t => {
  const raw = artifactText.replace('"run_id":', '"run_id": "private-marker", "run_id":');
  const value = report(run(workspace(t, taskText, raw)), 1);
  assert.deepEqual(value.errors, [{ path: '/artifact', rule: 'duplicate-key' }]);
});

test('JSON strings and distinct objects do not cause false duplicate-key errors', t => {
  const task = JSON.parse(taskText);
  task.goal = 'Literal text: {"id":1,"id":2}, braces } [, quote " and backslash \\.';
  task.roles.push({ role: 'architect', instance_id: 'writer-1' });
  const raw = JSON.stringify(task).replace('"task_id":', '"task_\\u0069d":');
  assert.equal(report(run(workspace(t, raw)), 0).valid, true);
});

for (const args of [[], ['task.json'], ['task.json', 'artifact.json', 'extra.json']]) {
  test(`pair CLI requires exactly two inputs, not ${args.length}`, t => {
    const result = run(workspace(t), args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /usage/i);
    assert.equal(result.stdout, '');
  });
}

for (const args of [['missing.json', 'artifact.json'], ['task.json', 'missing.json']]) {
  test(`pair CLI returns read-error for ${args.join(' ')}`, t => {
    const value = report(run(workspace(t), args), 2);
    assert.equal(value.valid, false);
    assert.ok(value.errors.some(error => error.rule === 'read-error'));
  });
}

test('read errors take precedence over malformed JSON regardless of input order', t => {
  const dir = workspace(t, '{', '{');
  for (const args of [['task.json', 'missing.json'], ['missing.json', 'artifact.json']]) {
    assert.equal(report(run(dir, args), 2).valid, false);
  }
});

test('pair CLI keeps a valid FAIL report distinct from invalid input', t => {
  const artifact = JSON.parse(artifactText);
  artifact.complete = false;
  artifact.verdict = artifact.claims[0].verdict = artifact.evidence[0].verdict = 'FAIL';
  artifact.evidence[0].exit_code = 1;
  assert.deepEqual(report(run(workspace(t, taskText, JSON.stringify(artifact))), 0), { valid: true, scope: 'contract-only', errors: [] });
});

test('pair CLI treats matching commands, source URIs, and evidence locations as inert data', t => {
  const dir = workspace(t);
  const task = JSON.parse(taskText);
  const artifact = JSON.parse(artifactText);
  const marker = join(dir, 'must-not-execute');
  task.acceptance[0].method.value = artifact.evidence[0].method.value = `touch '${marker}'`;
  task.source.uri = 'file:///nonexistent-contract-source';
  artifact.evidence[0].location = 'file:///nonexistent-contract-evidence';
  writeFileSync(join(dir, 'task.json'), JSON.stringify(task));
  writeFileSync(join(dir, 'artifact.json'), JSON.stringify(artifact));
  assert.equal(report(run(dir), 0).valid, true);
  assert.equal(existsSync(marker), false);
});

test('pair CLI follows a script symlink and does not silently skip invalid input', t => {
  const dir = workspace(t, '{}');
  const entry = join(dir, 'linked-validator.mjs');
  symlinkSync(script, entry);
  assert.equal(report(run(dir, undefined, entry), 1).valid, false);
});

test('importing the pair validator does not consume argv or print CLI output', t => {
  const dir = workspace(t);
  const code = `await import(${JSON.stringify(new URL('../scripts/validate-contract.mjs', import.meta.url).href)});`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code, 'missing-task', 'missing-artifact'], { cwd: dir, encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

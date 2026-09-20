import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/validate-envelope.mjs', import.meta.url));
const example = readFileSync(new URL('../examples/task.json', import.meta.url), 'utf8');

function workspace(t) {
  const dir = mkdtempSync(join(tmpdir(), 'envelope-cli-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function run(args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  return result;
}

test('CLI validates multiple files from an unrelated cwd without changing them', t => {
  const dir = workspace(t);
  const files = ['a.json', 'b.json'].map(name => join(dir, name));
  for (const file of files) writeFileSync(file, example);
  const result = run(files, dir);
  assert.equal(result.status, 0);
  assert.notEqual(result.stdout.trim(), '', 'CLI must emit a validation report');
  const reports = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(reports.length, 2);
  assert.ok(reports.every(report => report.valid && report.scope === 'schema-only'));
  for (const file of files) assert.equal(readFileSync(file, 'utf8'), example);
  assert.deepEqual(readdirSync(dir).sort(), ['a.json', 'b.json']);
});

test('CLI exits 1 for a malformed envelope and does not echo its values', t => {
  const dir = workspace(t);
  const file = join(dir, 'invalid.json');
  writeFileSync(file, JSON.stringify({ kind: 'secret-payload-marker' }));
  const result = run([file], dir);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).valid, false);
  assert.ok(!`${result.stdout}${result.stderr}`.includes('secret-payload-marker'));
});

test('CLI exits 1 for malformed JSON without disclosing a payload snippet', t => {
  const dir = workspace(t);
  const file = join(dir, 'invalid.json');
  writeFileSync(file, '{"secret":"private-marker", trailing');
  const result = run([file], dir);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).error, 'invalid-json');
  assert.ok(!`${result.stdout}${result.stderr}`.includes('private-marker'));
});

test('CLI exits 2 for missing arguments', () => {
  const result = run([]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage/i);
});

test('CLI exits 2 for unreadable input and still reports other files', t => {
  const dir = workspace(t);
  const valid = join(dir, 'valid.json');
  writeFileSync(valid, example);
  const result = run([join(dir, 'missing.json'), valid], dir);
  assert.equal(result.status, 2);
  const reports = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(reports[0].error, 'read-error');
  assert.equal(reports[1].valid, true);
});

test('CLI keeps an earlier validation failure when a later input is valid', t => {
  const dir = workspace(t);
  const invalid = join(dir, 'invalid.json');
  const valid = join(dir, 'valid.json');
  writeFileSync(invalid, '{}');
  writeFileSync(valid, example);
  assert.equal(run([invalid, valid], dir).status, 1);
});

test('CLI treats envelope commands and source locations as inert data', t => {
  const dir = workspace(t);
  const input = JSON.parse(example);
  const marker = join(dir, 'executed');
  input.acceptance[0].method.value = `touch '${marker}'`;
  input.source.uri = 'file:///definitely-nonexistent-envelope-source';
  const file = join(dir, 'task.json');
  writeFileSync(file, JSON.stringify(input));
  const result = run([file], dir);
  assert.equal(result.status, 0);
  assert.notEqual(result.stdout.trim(), '', 'CLI must emit a validation report');
  assert.equal(JSON.parse(result.stdout).valid, true);
  assert.equal(existsSync(marker), false);
});

test('symlink invocation does not skip invalid input', t => {
  const dir = workspace(t);
  const link = join(dir, 'validator.mjs');
  const invalid = join(dir, 'invalid.json');
  symlinkSync(script, link);
  writeFileSync(invalid, '{}');
  const result = spawnSync(process.execPath, [link, invalid], { encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.notEqual(result.stdout.trim(), '', 'must validate instead of silently succeeding');
  assert.equal(JSON.parse(result.stdout).valid, false);
});

test('import does not run the CLI or interpret unrelated argv as its own input', t => {
  const dir = workspace(t);
  const code = `await import(${JSON.stringify(new URL('../scripts/validate-envelope.mjs', import.meta.url).href)});`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code, 'nonexistent-argument'], { cwd: dir, encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/validate-assignment.mjs', import.meta.url));
const samples = ['task', 'assignment', 'artifact'].map(kind => readFileSync(new URL(`../examples/${kind}.json`, import.meta.url), 'utf8'));
const ok = { valid: true, scope: 'assignment-only', errors: [] };
function setup(t, texts = samples) {
  const dir = mkdtempSync(join(tmpdir(), 'assignment-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const files = texts.map((value, i) => { const path = join(dir, `input-${i}.json`); writeFileSync(path, value); return path; });
  return { dir, files };
}
const run = (files, options = {}) => spawnSync(process.execPath, [script, ...files], { encoding: 'utf8', ...options });
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');

test('three-file CLI emits one assignment-only result without changing input bytes', t => {
  const { dir, files } = setup(t); const before = files.map(digest);
  const result = run(files, { cwd: dir });
  assert.equal(result.status, 0);
  assert.notEqual(result.stdout.trim(), '', 'CLI result must exist');
  assert.deepEqual(JSON.parse(result.stdout), ok);
  assert.equal(result.stdout.trim().split('\n').length, 1);
  assert.equal(result.stderr, '');
  assert.deepEqual(files.map(digest), before);
});

for (const count of [0, 1, 2, 4]) {
  test(`rejects ${count} paths as usage error without echoing values`, () => {
    const result = run(Array(count).fill('PRIVATE-PATH'));
    assert.equal(result.status, 2); assert.equal(result.stdout, '');
    assert.match(result.stderr, /Usage:/); assert(!result.stderr.includes('PRIVATE-PATH'));
  });
}

for (const index of [0, 1, 2]) {
  test(`rejects malformed JSON in input ${index} without exposing content`, t => {
    const texts = [...samples]; texts[index] = '{"PRIVATE-VALUE":';
    const { files } = setup(t, texts); const result = run(files);
    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(result.stdout), { valid: false, scope: 'assignment-only', errors: [{ path: `/${['task','assignment','artifact'][index]}`, rule: 'invalid-json' }] });
    assert(!`${result.stdout}${result.stderr}`.includes('PRIVATE-VALUE'));
  });
  test(`read failure for input ${index} dominates malformed other JSON`, t => {
    const texts = [...samples]; texts[(index + 1) % 3] = '{bad';
    const { files } = setup(t, texts); files[index] += '-PRIVATE-MISSING';
    const result = run(files);
    assert.equal(result.status, 2);
    assert.deepEqual(JSON.parse(result.stdout).errors, [{ path: `/${['task','assignment','artifact'][index]}`, rule: 'read-error' }]);
    assert(!`${result.stdout}${result.stderr}`.includes('PRIVATE-MISSING'));
  });
}

test('rejects a structurally valid late attempt', t => {
  const texts = [...samples]; const assignment = JSON.parse(texts[1]); assignment.attempt_id = 'new-attempt'; texts[1] = JSON.stringify(assignment);
  const { files } = setup(t, texts); const result = run(files);
  assert.equal(result.status, 1);
  assert(JSON.parse(result.stdout).errors.some(e => e.path === '/artifact/attempt_id' && e.rule === 'assignment-mismatch'));
});

test('rejects schema-invalid assignment without exposing its extra value', t => {
  const texts = [...samples]; const value = JSON.parse(texts[1]); value.mode = 'PRIVATE-VALUE'; texts[1] = JSON.stringify(value);
  const { files } = setup(t, texts); const result = run(files);
  assert.equal(result.status, 1);
  assert(JSON.parse(result.stdout).errors.some(e => e.path === '/assignment/mode'));
  assert(!`${result.stdout}${result.stderr}`.includes('PRIVATE-VALUE'));
});

for (const index of [0, 1, 2]) {
  test(`rejects duplicate decoded object keys in input ${index}`, t => {
    const texts = [...samples]; texts[index] = texts[index].replace('"kind":', '"kind": "PRIVATE-VALUE", "k\\u0069nd":');
    const { files } = setup(t, texts); const result = run(files);
    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(result.stdout).errors, [{ path: `/${['task','assignment','artifact'][index]}`, rule: 'duplicate-key' }]);
    assert(!result.stdout.includes('PRIVATE-VALUE'));
  });
}

test('rejects nested duplicate reference keys', t => {
  const texts = [...samples]; texts[1] = texts[1].replace('"uri":', '"uri": "urn:wrong", "uri":');
  const { files } = setup(t, texts); const result = run(files);
  assert.equal(result.status, 1);
  assert(JSON.parse(result.stdout).errors.some(e => e.rule === 'duplicate-key'));
});

for (const literal of ['1.0', '1e0', '-0', '9007199254740991.1', '9007199254740992']) {
  test(`rejects unsafe or noncanonical assignment epoch ${literal}`, t => {
    const texts = [...samples]; texts[1] = texts[1].replace('"ownership_epoch": 1', `"ownership_epoch": ${literal}`);
    const { files } = setup(t, texts); const result = run(files);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).valid, false);
  });
}

test('rejects rounded previous-attempt epoch before comparing it', t => {
  const texts = [...samples]; texts[1] = texts[1].replace('"previous_attempt": null', '"previous_attempt": {"attempt_id":"old","ownership_epoch":0.00000000000000000001,"stop_ref":{"uri":"urn:stop","revision":"v1","observed_at":"2026-09-05T00:00:00Z"}}');
  const { files } = setup(t, texts); const result = run(files);
  assert.equal(result.status, 1);
  assert(JSON.parse(result.stdout).errors.some(e => e.rule === 'invalid-epoch-literal'));
});

test('does not mistake repeated values or escaped quotes for duplicate keys', t => {
  const texts = [...samples]; const assignment = JSON.parse(texts[1]);
  assignment.analysis_scope = ['a"b', 'kind', '{brace}']; texts[1] = JSON.stringify(assignment);
  const { files } = setup(t, texts); const result = run(files);
  assert.equal(result.status, 0); assert.notEqual(result.stdout.trim(), '');
  assert.deepEqual(JSON.parse(result.stdout), ok);
});

test('works through a normal script symlink from another cwd', t => {
  const { dir, files } = setup(t); const link = join(dir, 'validator.mjs'); symlinkSync(script, link);
  const result = spawnSync(process.execPath, [link, ...files], { encoding: 'utf8', cwd: dir });
  assert.equal(result.status, 0); assert.notEqual(result.stdout.trim(), '');
  assert.deepEqual(JSON.parse(result.stdout), ok);
});

test('import does not run the CLI', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(script).href)});`], { encoding:'utf8' });
  assert.equal(result.status, 0); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
});

test('CLI leaves a command marker absent while comparing valid command metadata', t => {
  const { dir, files } = setup(t); const marker = join(dir, 'must-not-exist');
  const task = JSON.parse(samples[0]); const artifact = JSON.parse(samples[2]);
  task.acceptance[0].method.value = artifact.evidence[0].method.value = `touch ${marker}`;
  writeFileSync(files[0], JSON.stringify(task)); writeFileSync(files[2], JSON.stringify(artifact));
  const result = run(files); assert.equal(result.status, 0); assert.notEqual(result.stdout.trim(), '');
  assert.deepEqual(JSON.parse(result.stdout), ok); assert.equal(existsSync(marker), false);
});

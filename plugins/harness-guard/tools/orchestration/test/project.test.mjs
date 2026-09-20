import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/project.mjs', import.meta.url));
function invoke(args, executable = script) {
  const result = spawnSync(process.execPath, [executable, ...args], { cwd: tmpdir(), encoding: 'utf8', timeout: 10_000 });
  assert.ifError(result.error);
  return result;
}
function product(t) {
  const root = mkdtempSync(join(tmpdir(), 'harness record-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = spawnSync('git', ['init', root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  writeFileSync(join(root, 'README.md'), 'preserve product\n');
  return root;
}

test('start writes a DRAFT without installing any agent, skill, manifest, or dependency', t => {
  const root = product(t);
  const request = 'preserve {{BASE_REF}} literally\n```\ntext\n````';
  const result = invoke(['start', root, 'first-work', request]);
  assert.equal(result.status, 0, result.stderr);
  const record = readFileSync(join(root, 'docs/orchestration/first-work.md'), 'utf8');
  assert.match(record, /^상태: DRAFT$/m);
  assert.match(record, /UNCOMMITTED \(HEAD is unborn\)/);
  assert(record.includes('`````text\n' + request + '\n`````'));
  assert.match(record, /^# first-work$/m);
  assert.deepEqual(readdirSync(root).sort(), ['.git', 'README.md', 'docs']);
  assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), 'preserve product\n');
});

test('start captures the current HEAD without modifying tracked files', t => {
  const root = product(t);
  for (const args of [['add', 'README.md'], ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'fixture']]) {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const head = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  assert.equal(invoke(['start', root, 'current', 'request']).status, 0);
  assert(readFileSync(join(root, 'docs/orchestration/current.md'), 'utf8').includes(`시작 기준 ref: ${head}`));
  assert.equal(spawnSync('git', ['-C', root, 'diff', '--exit-code']).status, 0);
});

test('a repeated start preserves the original record', t => {
  const root = product(t);
  assert.equal(invoke(['start', root, 'one', 'original']).status, 0);
  const file = join(root, 'docs/orchestration/one.md');
  const before = readFileSync(file);
  assert.equal(invoke(['start', root, 'one', 'replacement']).status, 1);
  assert.deepEqual(readFileSync(file), before);
});

test('requires the exact Git root and a bounded slug', t => {
  const root = product(t);
  mkdirSync(join(root, 'child'));
  assert.equal(invoke(['start', join(root, 'child'), 'one', 'request']).status, 1);
  for (const slug of ['../escape', 'A', 'two--parts', 'a'.repeat(65), '']) {
    assert.equal(invoke(['start', root, slug, 'request']).status, 1);
  }
  assert.equal(existsSync(join(root, 'docs')), false);
  assert.equal(invoke(['start', root, 'a'.repeat(64), 'request']).status, 0);
});

test('refuses symlinked or non-directory parents without writing through them', t => {
  for (const component of ['docs', 'docs/orchestration']) {
    const root = product(t);
    const outside = product(t);
    if (component.includes('/')) mkdirSync(join(root, 'docs'));
    symlinkSync(outside, join(root, component));
    assert.equal(invoke(['start', root, 'one', 'request']).status, 1);
    assert.deepEqual(readdirSync(outside).sort(), ['.git', 'README.md']);
  }
  const root = product(t);
  writeFileSync(join(root, 'docs'), 'keep');
  assert.equal(invoke(['start', root, 'one', 'request']).status, 1);
  assert.equal(readFileSync(join(root, 'docs'), 'utf8'), 'keep');
});

test('refuses an existing record symlink and preserves its destination', t => {
  const root = product(t);
  mkdirSync(join(root, 'docs/orchestration'), { recursive: true });
  symlinkSync(join(root, 'README.md'), join(root, 'docs/orchestration/one.md'));
  assert.equal(invoke(['start', root, 'one', 'request']).status, 1);
  assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), 'preserve product\n');
});

test('public bin symlink works from another cwd', t => {
  const root = product(t);
  const bin = join(root, 'record-cli');
  symlinkSync(script, bin);
  const result = invoke(['start', root, 'one', 'request'], bin);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /created docs\/orchestration\/one.md/);
});

test('usage rejects removed installers, missing arguments, and extra arguments before mutation', t => {
  const root = product(t);
  for (const args of [[], ['init', root], ['status', root], ['remove', root], ['start', root, 'one'], ['start', root, 'one', 'request', 'extra']]) {
    const result = invoke(args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage:/);
  }
  assert.deepEqual(readdirSync(root).sort(), ['.git', 'README.md']);
});

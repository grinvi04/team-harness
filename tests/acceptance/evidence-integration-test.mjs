import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { snapshot, compareSnapshots, digest, adjudicate, renderMarkdown } from './evidence.mjs';

test('controller binds actual process output and observes automatic ignored writes', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'harness-observed-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, '.gitignore'), '.npm-cache/\n');
  const before = await snapshot(root);
  const argv = [process.execPath, '-e', "require('fs').mkdirSync('.npm-cache');require('fs').writeFileSync('.npm-cache/run.log','fixture');console.log('ran');process.exitCode=3"];
  const candidate = { root, head: 'a'.repeat(40), dirtyDigest: digest(JSON.stringify(before)), contractDigest: digest('expected exit3; readonly root') };
  const criterion = { id: 'negative', command: JSON.stringify(argv), cwd: root, required: true, expectedExit: 3 };
  const actual = spawnSync(argv[0], argv.slice(1), { cwd: root, encoding: 'utf8' });
  const output = actual.stdout + actual.stderr;
  const result = adjudicate({ candidate, criteria: [criterion], observations: [{ criterionId: criterion.id,
    command: criterion.command, cwd: root, candidate, attempt: 1, exitCode: actual.status, output, outputDigest: digest(output) }] });
  assert.equal(actual.status, 3);
  assert.match(output, /ran/);
  assert.equal(result.verdict, 'PASS');
  assert.match(renderMarkdown(result), /negative.*PASS/);
  assert.deepEqual(compareSnapshots(before, await snapshot(root)), { verdict: 'FAIL', changes: [{ path: '.npm-cache/run.log', kind: 'added' }] });
});

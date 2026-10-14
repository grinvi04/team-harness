// M1 contract: completion.md §5. Synthetic local fixtures; no actor/model calls.
// These checks establish mechanical binding, not semantic truth or secret detection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { snapshot, compareSnapshots, adjudicate, renderMarkdown } from './evidence.mjs';

const digest = (text) => createHash('sha256').update(text).digest('hex');
const clone = (value) => structuredClone(value);
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'harness-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (name, content = 'fixture\n') => {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), content);
  };
  return { root, put };
}

// Raw observations are test inputs, not claims that these commands ran here.
function input() {
  const candidate = { root: '/fixture/product', head: 'a'.repeat(40), dirtyDigest: digest('dirty source'), contractDigest: digest('locked contract') };
  const criteria = [{ id: 'unit', required: true, command: 'npm test', cwd: candidate.root }];
  const output = 'fixture check succeeded\n';
  return {
    criteria, candidate,
    observations: [{ criterionId: 'unit', candidate: clone(candidate), command: 'npm test', cwd: candidate.root,
      attempt: 1, exitCode: 0, output, outputDigest: digest(output), reportedVerdict: 'PASS' }],
  };
}
const verdicts = (result) => result.criteria.map(({ id, verdict }) => ({ id, verdict }));

test('snapshot records exact regular-file set, content digest and permission mode', async (t) => {
  const { root, put } = await fixture(t);
  await put('src/check.mjs', 'fixture source\n');
  await chmod(path.join(root, 'src/check.mjs'), 0o755);
  const observed = await snapshot(root, { exclude: [] });
  assert.equal(observed.root, root);
  assert.deepEqual(observed.exclude, []);
  assert.deepEqual(observed.files, [{ path: 'src/check.mjs', digest: digest('fixture source\n'), mode: 0o755 }]);
  assert.deepEqual(compareSnapshots(observed, await snapshot(root), { allowed: [] }), { verdict: 'PASS', changes: [] });
});

test('ignored cache creation and existing log deletion each fail readonly scope', async (t) => {
  const { root, put } = await fixture(t);
  await put('.gitignore', '.cache/\n*.log\n');
  await put('old.log');
  const before = await snapshot(root);
  await put('.cache/generated.json', '{}\n');
  const created = compareSnapshots(before, await snapshot(root), { allowed: [] });
  assert.equal(created.verdict, 'FAIL');
  assert.deepEqual(created.changes, [{ path: '.cache/generated.json', kind: 'added' }]);
  await rm(path.join(root, '.cache'), { recursive: true });
  await rm(path.join(root, 'old.log'));
  const deleted = compareSnapshots(before, await snapshot(root), { allowed: [] });
  assert.equal(deleted.verdict, 'FAIL');
  assert.deepEqual(deleted.changes, [{ path: 'old.log', kind: 'deleted' }]);
});

test('unchanged expected files cannot hide one extra file; allowances are exact paths', async (t) => {
  const { root, put } = await fixture(t);
  await put('expected.txt');
  const before = await snapshot(root);
  await put('extra.txt');
  const after = await snapshot(root);
  assert.equal(compareSnapshots(before, after, { allowed: [] }).verdict, 'FAIL');
  assert.equal(compareSnapshots(before, after, { allowed: ['extra.txt'] }).verdict, 'PASS');
  assert.equal(compareSnapshots(before, after, { allowed: ['extra'] }).verdict, 'FAIL');
});

test('same path content changes and permission changes are modifications', async (t) => {
  const { root, put } = await fixture(t);
  await put('source.txt', 'before');
  const before = await snapshot(root);
  await put('source.txt', 'after');
  const changed = compareSnapshots(before, await snapshot(root), { allowed: [] });
  assert.deepEqual(changed.changes, [{ path: 'source.txt', kind: 'modified' }]);
  assert.equal(changed.verdict, 'FAIL');
  const content = await snapshot(root);
  await chmod(path.join(root, 'source.txt'), 0o755);
  assert.equal(compareSnapshots(content, await snapshot(root), { allowed: [] }).verdict, 'FAIL');
});

test('excluded cache or sensitive fixture cannot support whole-root readonly PASS', async (t) => {
  const { root, put } = await fixture(t);
  await put('visible.txt');
  await put('.env', 'SYNTHETIC_PRIVATE_FIXTURE=not-a-credential\n');
  const exclude = ['.cache', '.env'];
  const before = await snapshot(root, { exclude });
  await put('.cache/new.log');
  await put('.env', 'SYNTHETIC_PRIVATE_FIXTURE=changed\n');
  const after = await snapshot(root, { exclude });
  assert.deepEqual(before.files.map((file) => file.path), ['visible.txt']);
  assert.deepEqual(before.exclude, exclude);
  assert.equal(JSON.stringify(before).includes(digest('SYNTHETIC_PRIVATE_FIXTURE=not-a-credential\n')), false);
  assert.equal(compareSnapshots(before, after, { allowed: [] }).verdict, 'UNVERIFIED');
});

test('snapshot refuses links to an outside synthetic private file', async (t) => {
  const { root } = await fixture(t);
  const outside = await fixture(t);
  await outside.put('private.txt', 'SYNTHETIC_PRIVATE_CONTENT\n');
  await symlink(path.join(outside.root, 'private.txt'), path.join(root, 'linked.txt'));
  await assert.rejects(() => snapshot(root), /symlink|symbolic|link/i);
});

for (const name of ['.env', 'nested/.env']) {
  test(`known sensitive path ${name} is refused unless explicitly excluded`, async (t) => {
    const { root, put } = await fixture(t);
    await put(name, 'SYNTHETIC_PRIVATE_FIXTURE=not-a-credential\n');
    await assert.rejects(() => snapshot(root), /sensitive|private|secret|\.env/i);
    const excluded = await snapshot(root, { exclude: [name] });
    assert.deepEqual(excluded.files, []);
    assert.deepEqual(excluded.exclude, [name]);
  });
}

test('valid bound evidence passes; reported PASS and FAIL labels have no authority', () => {
  const data = input();
  data.observations[0].reportedVerdict = 'FAIL';
  const result = adjudicate(data);
  assert.equal(result.verdict, 'PASS');
  assert.deepEqual(verdicts(result), [{ id: 'unit', verdict: 'PASS' }]);
  data.observations[0].exitCode = 1;
  data.observations[0].reportedVerdict = 'PASS';
  assert.equal(adjudicate(data).verdict, 'FAIL');
});

test('expected nonzero exit proves a negative check; unexpected success fails it', () => {
  const data = input();
  data.criteria[0].expectedExit = 2;
  data.observations[0].exitCode = 2;
  assert.equal(adjudicate(data).verdict, 'PASS');
  data.observations[0].exitCode = 0;
  assert.equal(adjudicate(data).verdict, 'FAIL');
});

test('matching expected nonzero attempts are not mislabeled as unresolved failures', () => {
  const data = input();
  data.criteria[0].expectedExit = 1;
  data.observations[0].exitCode = 1;
  data.observations.push({ ...clone(data.observations[0]), attempt: 2 });
  assert.equal(adjudicate(data).verdict, 'PASS');
  data.observations[0].exitCode = 0;
  assert.equal(adjudicate(data).verdict, 'FAIL');
});

for (const field of ['root', 'head', 'dirtyDigest', 'contractDigest']) {
  test(`different candidate ${field} invalidates otherwise green evidence`, () => {
    const data = input();
    data.observations[0].candidate[field] += '-stale';
    assert.equal(adjudicate(data).verdict, 'UNVERIFIED');
  });
}
for (const field of ['cwd', 'command']) {
  test(`same criterion ID cannot borrow another ${field}'s success`, () => {
    const data = input();
    data.observations[0][field] += '-other';
    assert.equal(adjudicate(data).verdict, 'UNVERIFIED');
  });
}
for (const field of ['output', 'outputDigest', 'exitCode', 'attempt', 'candidate']) {
  test(`reported PASS with missing raw ${field} is UNVERIFIED`, () => {
    const data = input();
    delete data.observations[0][field];
    assert.equal(adjudicate(data).verdict, 'UNVERIFIED');
  });
}

test('changed raw output or its digest cannot pass', () => {
  const data = input();
  data.observations[0].output = 'different output\n';
  assert.equal(adjudicate(data).verdict, 'UNVERIFIED');
});

test('missing required check blocks completion; unrun optional check stays visible', () => {
  const data = input();
  data.criteria.push({ id: 'integration', required: true, command: 'npm run integration', cwd: data.candidate.root });
  let result = adjudicate(data);
  assert.equal(result.verdict, 'UNVERIFIED');
  assert.deepEqual(verdicts(result), [{ id: 'unit', verdict: 'PASS' }, { id: 'integration', verdict: 'UNVERIFIED' }]);
  data.criteria[1].required = false;
  result = adjudicate(data);
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.criteria[1].verdict, 'UNVERIFIED');
});

test('independent failed required check is retained in the aggregate', () => {
  const data = input();
  data.criteria.push({ id: 'contract', required: true, command: 'npm run contract', cwd: data.candidate.root });
  data.observations.push({ ...clone(data.observations[0]), criterionId: 'contract', command: 'npm run contract', exitCode: 1 });
  const result = adjudicate(data);
  assert.equal(result.verdict, 'FAIL');
  assert.deepEqual(verdicts(result), [{ id: 'unit', verdict: 'PASS' }, { id: 'contract', verdict: 'FAIL' }]);
});

test('first failure and green retry are preserved without silently resolving instability', () => {
  const data = input();
  data.observations[0].exitCode = 1;
  data.observations.push({ ...clone(data.observations[0]), attempt: 2, exitCode: 0 });
  const result = adjudicate(data);
  assert.equal(result.verdict, 'FAIL');
  assert.deepEqual(result.criteria[0].attempts.map(({ attempt, exitCode }) => ({ attempt, exitCode })),
    [{ attempt: 1, exitCode: 1 }, { attempt: 2, exitCode: 0 }]);
  assert.deepEqual(data.observations.map(({ exitCode }) => exitCode), [1, 0]);
});

test('a second attempt alone cannot impersonate a missing first attempt', () => {
  const data = input();
  data.observations[0].attempt = 2;
  assert.equal(adjudicate(data).verdict, 'UNVERIFIED');
});

test('duplicate or missing criterion IDs are contract errors', () => {
  const duplicate = input();
  duplicate.criteria.push(clone(duplicate.criteria[0]));
  assert.throws(() => adjudicate(duplicate), /duplicate|unique|criterion|criteria/i);
  const missing = input();
  delete missing.criteria[0].id;
  assert.throws(() => adjudicate(missing), /id|criterion|criteria/i);
});

test('Markdown derives verdicts and refuses omitted rows, duplicates or forged overall PASS', () => {
  const data = input();
  data.criteria.push({ id: 'contract', required: true, command: 'npm run contract', cwd: data.candidate.root });
  data.observations.push({ ...clone(data.observations[0]), criterionId: 'contract', command: 'npm run contract', exitCode: 1 });
  const result = adjudicate(data);
  assert.deepEqual(result.criterionIds, ['unit', 'contract']);
  const markdown = renderMarkdown(result);
  assert.match(markdown, /unit[^\n]*PASS/);
  assert.match(markdown, /contract[^\n]*FAIL/);
  for (const tamper of [
    (copy) => { copy.criteria.pop(); },
    (copy) => { copy.criteria.push(clone(copy.criteria[0])); },
    (copy) => { copy.verdict = 'PASS'; },
  ]) {
    const copy = clone(result);
    tamper(copy);
    assert.throws(() => renderMarkdown(copy), /id|criterion|criteria|verdict|aggregate|result/i);
  }
});

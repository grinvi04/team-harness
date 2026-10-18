import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateEvent, appendEvent, writeLease } from '../plugins/harness-guard/scripts/observation/event.mjs';
import { readSnapshot } from '../plugins/harness-guard/scripts/observation/read.mjs';

const moduleURL = new URL('../plugins/harness-guard/scripts/observation/event.mjs', import.meta.url).href;
const emitPath = fileURLToPath(new URL('../plugins/harness-guard/scripts/observation/emit.mjs', import.meta.url));
const MAX = 32 * 1024 * 1024;
const repoId = 'a'.repeat(64), worktreeId = 'b'.repeat(64);
const selection = { repoId, worktreeId };
function event(patch = {}) {
  return { schemaVersion: 1, eventId: randomUUID(), operationId: randomUUID(), parentOperationId: null,
    sequence: 1, recordedAt: new Date().toISOString(), source: 'guard', phase: 'started', outcome: 'pending',
    reasonCode: 'STARTED', pluginVersion: '1.2.0', repoId, worktreeId, hostSessionId: null,
    headSha: 'c'.repeat(40), baseSha: 'd'.repeat(40), ...patch };
}
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-observation-')));
  const dir = path.join(root, 'data'); fs.mkdirSync(dir, { mode: 0o700 });
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); return { root, dir };
}
function activate(dir, patch = {}) {
  return writeLease(dir, { schemaVersion: 1, viewerId: randomUUID(), ...selection,
    expiresAt: new Date(Date.now() + 30_000).toISOString(), ...patch });
}
function names(dir) { return fs.readdirSync(dir).filter(x => /^evt-.*\.json$/.test(x)); }
function bytes(dir) { return names(dir).reduce((sum, f) => sum + fs.statSync(path.join(dir, f)).size, 0); }
function seed(dir, value, size) {
  const s = JSON.stringify(value); assert.ok(!size || s.length <= size);
  fs.writeFileSync(path.join(dir, `evt-${value.eventId}.json`), s.padEnd(size || s.length), { mode: 0o600 });
}
async function concurrent(dir, count = 100) {
  const code = `import fs from 'node:fs'; import {randomUUID} from 'node:crypto';
    import {appendEvent} from ${JSON.stringify(moduleURL)};
    const [dir, raw, n] = process.argv.slice(1); const template=JSON.parse(raw);
    process.send('ready'); await new Promise(resolve=>process.once('message',resolve));
    let written=0; for(let i=0;i<Number(n);i++){const r=await appendEvent(dir,{...template,eventId:randomUUID(),operationId:randomUUID(),recordedAt:new Date().toISOString()});if(r.written)written++;else throw Error(r.reasonCode);}
    process.send({written}); process.disconnect();`;
  const children = Array.from({ length: 10 }, () => spawn(process.execPath,
    ['--input-type=module', '-e', code, dir, JSON.stringify(event()), String(count)],
    { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] }));
  const results = children.map(child => new Promise((resolve, reject) => {
    let result, error = ''; child.stderr.on('data', b => { error += b; });
    child.on('message', m => { if (typeof m === 'object') result = m; });
    child.once('error', reject); child.once('exit', rc => rc === 0 ? resolve(result) : reject(Error(error || `exit ${rc}`)));
  }));
  await Promise.all(children.map(c => new Promise(resolve => c.once('message', resolve))));
  for (const child of children) child.send('go');
  return Promise.all(results);
}

test('OFF, expired and wrong-target lease do not record; ON is private and exact', async t => {
  const { dir } = fixture(t); const e = event();
  assert.equal((await appendEvent(dir, e)).written, false); assert.deepEqual(names(dir), []);
  activate(dir, { expiresAt: new Date(Date.now() - 1).toISOString() });
  assert.equal((await appendEvent(dir, e)).written, false);
  activate(dir, { worktreeId: 'f'.repeat(64) }); assert.equal((await appendEvent(dir, e)).written, false);
  activate(dir); assert.equal((await appendEvent(dir, e)).written, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, names(dir)[0]))), e);
  assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
  for (const name of fs.readdirSync(dir)) assert.equal(fs.statSync(path.join(dir, name)).mode & 0o777, 0o600);
});

test('rejectsRawCommand and unknown/invalid fields, identifiers and outcomes', async t => {
  const { dir } = fixture(t); activate(dir);
  assert.equal(validateEvent(event()), true);
  const invalid = [{ rawCommand: 'echo secret' }, { output: 'private' }, { env: {} }, { prompt: 'private' },
    { reasonCode: 'arbitrary private words' }, { phase: 'started', outcome: 'pass' }, { source: 'fake' },
    { eventId: '../../escape' }, { sequence: 0 }, { exitCode: -1 }, { branch: '--bad' },
    { hostSessionId: 'token\nprivate' }, { evidenceId: 'x'.repeat(4097) }, { repoId: 'wrong' }];
  for (const patch of invalid) {
    const e = event(patch); assert.equal(validateEvent(e), false, JSON.stringify(patch));
    assert.equal((await appendEvent(dir, e)).written, false);
  }
  assert.equal(names(dir).length, 0);
});

test('rejectsSymlink, permissive storage, hardlink records and unsafe parent paths without mutation', async t => {
  const { root, dir } = fixture(t); activate(dir);
  const link = path.join(root, 'link'); fs.symlinkSync(dir, link);
  assert.equal((await appendEvent(link, event())).written, false);
  fs.chmodSync(dir, 0o755); assert.equal((await appendEvent(dir, event())).written, false); fs.chmodSync(dir, 0o700);
  const e = event(), target = path.join(root, 'sentinel'); fs.writeFileSync(target, 'preserve', { mode: 0o600 });
  fs.symlinkSync(target, path.join(dir, `evt-${e.eventId}.json`));
  assert.equal((await appendEvent(dir, e)).written, false); assert.equal(fs.readFileSync(target, 'utf8'), 'preserve');
  fs.unlinkSync(path.join(dir, `evt-${e.eventId}.json`)); fs.linkSync(target, path.join(dir, `evt-${e.eventId}.json`));
  const snapshot = readSnapshot(dir, selection); assert.ok(snapshot.health.parseErrors > 0);
  assert.equal(fs.readFileSync(target, 'utf8'), 'preserve');
});

test('separatesWorktrees, sessions and candidates even for a reused operationId', async t => {
  const { dir } = fixture(t); const a = event();
  seed(dir, a);
  for (const patch of [{ worktreeId: 'e'.repeat(64) }, { hostSessionId: 'another-session' }, { headSha: 'f'.repeat(40) }])
    seed(dir, event({ ...a, ...patch, eventId: randomUUID(), phase: 'finished', outcome: 'pass', sequence: 2, reasonCode: 'CHECK_PASSED' }));
  const s = readSnapshot(dir, { repoId }); assert.equal(s.operations.length, 4);
  assert.equal(s.operations.find(x => x.events.some(e => e.eventId === a.eventId)).state, 'unverified');
  assert.equal(readSnapshot(dir, selection).operations.length, 3);
  assert.equal(readSnapshot(dir, { repoId: '0'.repeat(64) }).operations.length, 0);
});

test('deduplicatesEventId, reportsSequenceGap, corrupt files and unfinishedIsUnknown', async t => {
  const { dir } = fixture(t); activate(dir); const a = event();
  assert.equal((await appendEvent(dir, a)).written, true);
  assert.equal((await appendEvent(dir, a)).reasonCode, 'DUPLICATE');
  seed(dir, event({ ...a, eventId: randomUUID(), sequence: 3, phase: 'finished', outcome: 'pass', reasonCode: 'CHECK_PASSED' }));
  const unfinished = event(); seed(dir, unfinished);
  const bad = path.join(dir, `evt-${randomUUID()}.json`); fs.writeFileSync(bad, '{"broken":', { mode: 0o600 });
  const s = readSnapshot(dir, selection); assert.equal(s.operations.length, 2);
  assert.equal(s.health.gaps, 1); assert.equal(s.health.parseErrors, 1);
  assert.equal(s.health.captureState, 'loss-suspected');
  assert.equal(s.operations.find(x => x.operationId === unfinished.operationId).state, 'unverified');
  assert.equal(s.operations.flatMap(x => x.events).filter(x => x.eventId === a.eventId).length, 1);
  assert.equal('lostEvents' in s.health, false);
});

test('7-day retention persists across readers and leaves unrelated files untouched', async t => {
  const { dir } = fixture(t); activate(dir);
  const old = event({ recordedAt: new Date(Date.now() - 7 * 86400000 - 1000).toISOString() });
  const recent = event({ recordedAt: new Date(Date.now() - 7 * 86400000 + 60000).toISOString() });
  seed(dir, old); seed(dir, recent);
  fs.utimesSync(path.join(dir, `evt-${old.eventId}.json`), new Date(), new Date());
  fs.utimesSync(path.join(dir, `evt-${recent.eventId}.json`), new Date(0), new Date(0));
  fs.writeFileSync(path.join(dir, 'user-file'), 'keep', { mode: 0o600 });
  assert.equal((await appendEvent(dir, event())).written, true);
  assert.equal(names(dir).includes(`evt-${old.eventId}.json`), false);
  assert.equal(names(dir).includes(`evt-${recent.eventId}.json`), true);
  assert.equal(readSnapshot(dir, selection).health.retentionApplied, true);
  assert.equal(readSnapshot(dir, selection).health.captureState, 'loss-suspected');
  assert.equal(fs.readFileSync(path.join(dir, 'user-file'), 'utf8'), 'keep');
});

test('boundsConcurrentWrites: 10 independent writers x100 are atomic and unique', { timeout: 120000 }, async t => {
  const { dir } = fixture(t); activate(dir); let parseErrors = 0;
  const renew = setInterval(() => activate(dir), 8000);
  const reader = setInterval(() => { parseErrors += readSnapshot(dir, selection).health.parseErrors; }, 25);
  try {
    const result = await concurrent(dir); assert.equal(result.reduce((n, r) => n + r.written, 0), 1000);
  } finally { clearInterval(renew); clearInterval(reader); }
  assert.equal(names(dir).length, 1000); assert.equal(parseErrors, 0);
  const s = readSnapshot(dir, selection); assert.equal(s.operations.length, 1000);
  assert.equal(new Set(s.operations.flatMap(x => x.events).map(e => e.eventId)).size, 1000);
  assert.ok(bytes(dir) <= MAX);
});

test('boundsConcurrentWrites at real 32MiB capacity reports retention', { timeout: 180000 }, async t => {
  const { dir } = fixture(t);
  for (let i = 0; i < MAX / 4096; i++) seed(dir, event(), 4096);
  activate(dir); const renew = setInterval(() => activate(dir), 8000);
  try { assert.equal((await concurrent(dir)).reduce((n, r) => n + r.written, 0), 1000); }
  finally { clearInterval(renew); }
  assert.ok(bytes(dir) <= MAX); assert.equal(readSnapshot(dir, selection).health.retentionApplied, true);
  assert.equal(fs.readdirSync(dir).some(x => x.startsWith('.tmp-')), false);
});

test('emitter accepts only bounded JSON stdin and does not print event contents', t => {
  const { dir } = fixture(t); activate(dir);
  const result = spawnSync(process.execPath, [emitPath, dir], { input: JSON.stringify(event()), encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
  assert.equal(names(dir).length, 1);
  const invalid = spawnSync(process.execPath, [emitPath, dir], { input: 'private'.repeat(1000), encoding: 'utf8' });
  assert.notEqual(invalid.status, 0); assert.equal(invalid.stdout.includes('private'), false);
  assert.equal(invalid.stderr.includes('private'), false); assert.equal(names(dir).length, 1);
});

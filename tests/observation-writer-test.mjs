import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { startWriter, requestWriter } from '../plugins/harness-guard/scripts/observation/writer.mjs';
import { writeLease, validateEvent } from '../plugins/harness-guard/scripts/observation/event.mjs';
import { finishOperation } from '../plugins/harness-guard/scripts/observation/client.mjs';
import { readSnapshot } from '../plugins/harness-guard/scripts/observation/read.mjs';
const context = { repoId: 'a'.repeat(64), worktreeId: 'b'.repeat(64) };
const event = (patch = {}) => ({ schemaVersion: 1, ...context, eventId: randomUUID(), operationId: randomUUID(),
  parentOperationId: null, sequence: 2, recordedAt: new Date().toISOString(), source: 'guard', phase: 'finished',
  outcome: 'deny', reasonCode: 'GUARD_HARD_RESET', pluginVersion: '1.2.0', hostSessionId: null, headSha: null,
  baseSha: null, exitCode: 2, ...patch });
const lease = viewerId => ({ schemaVersion: 1, ...context, viewerId, expiresAt: new Date(Date.now() + 30000).toISOString() });
async function fixture(run) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'writer-test-'))), viewerId = randomUUID();
  let writer;
  try {
    writer = await startWriter(dir, context, viewerId); writeLease(dir, lease(viewerId));
    const descriptor = JSON.parse(fs.readFileSync(path.join(dir, `writer-${viewerId}.json`)));
    await run({ dir, viewerId, writer, descriptor });
  } finally { await writer?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}
function rawRequest(d, patch, raw) {
  return new Promise(resolve => {
    const socket = net.createConnection(d.socket); let response = '';
    const timer = setTimeout(() => socket.destroy(), 400);
    socket.on('error', () => {}); socket.on('data', chunk => { response += chunk; });
    socket.once('connect', () => socket.end(raw ?? JSON.stringify({ schemaVersion: 1, viewerId: d.viewerId,
      capability: d.capability, action: 'append', event: event(), ...patch })));
    socket.once('close', () => { clearTimeout(timer); resolve(response); });
  });
}
const records = dir => fs.readdirSync(dir).filter(name => name.startsWith('evt-'));

test('a prior loss marker preserves manual-lease emission and exact child-result recovery', t => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'writer-recovery-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeLease(dir, lease(randomUUID()));
  const marker = path.join(dir, 'writer-loss-v1.json'), loss = { schemaVersion: 1, lost: true };
  fs.writeFileSync(marker, JSON.stringify(loss), { mode: 0o600 });
  const parent = randomUUID(), e = event({ parentOperationId: parent });
  const emitted = spawnSync(process.execPath, [path.resolve('plugins/harness-guard/scripts/observation/emit.mjs'), dir],
    { input: JSON.stringify(e), encoding: 'utf8', timeout: 250, killSignal: 'SIGKILL' });
  assert.equal(emitted.error, undefined); assert.equal(emitted.status, 0);
  assert.equal(emitted.stdout, ''); assert.equal(emitted.stderr, '');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, `evt-${e.eventId}.json`))), e);
  const state = { ...context, operationId: parent, headSha: null, baseSha: null, hostSessionId: null, dataDir: dir };
  const query = spawnSync(process.execPath, [path.resolve('plugins/harness-guard/scripts/observation/bridge.mjs'), 'result-read', 'guard'],
    { input: JSON.stringify(state), encoding: 'utf8', timeout: 250, killSignal: 'SIGKILL' });
  assert.equal(query.error, undefined); assert.equal(query.status, 0); assert.equal(query.stderr, '');
  assert.equal(query.stdout, 'deny\nGUARD_HARD_RESET');
  assert.deepEqual(JSON.parse(fs.readFileSync(marker)), loss);
  assert.equal(readSnapshot(dir, context).health.captureState, 'loss-suspected');
});

test('writer stores exact payload and returns only one matching current-context child', async () => fixture(async ({ dir }) => {
  const parent = randomUUID(), e = event({ parentOperationId: parent });
  assert.equal(validateEvent(e), true);
  assert.deepEqual(await requestWriter(dir, context, 'append', { event: e }), { written: true, reasonCode: 'RECORDED' });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, `evt-${e.eventId}.json`))), e);
  const state = { ...context, operationId: parent, headSha: null, baseSha: null, hostSessionId: null };
  assert.deepEqual(await requestWriter(dir, context, 'result', { state, source: 'guard' }), { outcome: 'deny', reasonCode: 'GUARD_HARD_RESET' });
  assert.deepEqual(await requestWriter(dir, context, 'result', { state: { ...state, headSha: 'c'.repeat(40) }, source: 'guard' }), {});
  assert.deepEqual(await requestWriter(dir, context, 'append', { event: e }), { written: false, reasonCode: 'DUPLICATE' });
  await requestWriter(dir, context, 'append', { event: { ...e, eventId: randomUUID() } });
  assert.deepEqual(await requestWriter(dir, context, 'result', { state, source: 'guard' }), {});
}));

test('warm writer revalidates modified records and refuses malformed storage without deleting evidence', async () => fixture(async ({ dir }) => {
  const e = event(); await requestWriter(dir, context, 'append', { event: e });
  const name = path.join(dir, `evt-${e.eventId}.json`); fs.writeFileSync(name, '{broken');
  assert.deepEqual(await requestWriter(dir, context, 'append', { event: event() }), { written: false, reasonCode: 'INVALID_STORAGE' });
  assert.equal(fs.readFileSync(name, 'utf8'), '{broken'); assert.equal(records(dir).length, 1);
}));

test('warm writer observes valid in-place changes for child results and expiry', async () => fixture(async ({ dir }) => {
  const parent = randomUUID(), e = event({ parentOperationId: parent });
  assert.equal((await requestWriter(dir, context, 'append', { event: e })).written, true);
  const state = { ...context, operationId: parent, headSha: null, baseSha: null, hostSessionId: null };
  assert.equal((await requestWriter(dir, context, 'result', { state, source: 'guard' })).reasonCode, 'GUARD_HARD_RESET');
  const file = path.join(dir, `evt-${e.eventId}.json`), changed = { ...e, reasonCode: 'GUARD_CORE_DELETE' };
  assert.equal(validateEvent(changed), true);
  fs.writeFileSync(file, JSON.stringify(changed));
  assert.deepEqual(await requestWriter(dir, context, 'result', { state, source: 'guard' }), { outcome: 'deny', reasonCode: 'GUARD_CORE_DELETE' });
  fs.writeFileSync(file, JSON.stringify({ ...changed, recordedAt: new Date(Date.now() - 7 * 86400000).toISOString() }));
  const next = event();
  assert.equal((await requestWriter(dir, context, 'append', { event: next })).written, true);
  assert.deepEqual(records(dir), [`evt-${next.eventId}.json`]);
  assert.equal(readSnapshot(dir, context).health.retentionApplied, true);
}));

test('writer rejects capability, frame, operation and context violations without recording', async () => fixture(async ({ dir, descriptor }) => {
  for (const patch of [{ capability: '0'.repeat(64) }, { viewerId: randomUUID() }, { action: 'exec' },
    { event: event({ repoId: 'c'.repeat(64) }) }, { extra: 'forbidden' }]) {
    assert.equal(await rawRequest(descriptor, patch), '');
  }
  assert.equal(await rawRequest(descriptor, {}, '{bad'), '');
  assert.equal(await rawRequest(descriptor, {}, 'x'.repeat(8193)), '');
  assert.deepEqual(records(dir), []);
}));

test('a different live viewer lease cannot authorize an endpoint whose exact lease has gone', async () => fixture(async ({ dir, viewerId, descriptor }) => {
  writeLease(dir, lease(randomUUID())); fs.unlinkSync(path.join(dir, `lease-${viewerId}.json`));
  assert.equal(await rawRequest(descriptor, {}), ''); assert.deepEqual(records(dir), []);
}));

test('invalid advertised binding or descriptor permissions fail without a direct-write fallback', async () => fixture(async ({ dir, viewerId, descriptor }) => {
  const file = path.join(dir, `writer-${viewerId}.json`), e = event();
  fs.writeFileSync(file, JSON.stringify({ ...descriptor, ino: descriptor.ino + 1 }));
  await assert.rejects(requestWriter(dir, context, 'append', { event: e }), /INVALID_WRITER/);
  fs.writeFileSync(file, JSON.stringify(descriptor)); fs.chmodSync(file, 0o644);
  await assert.rejects(requestWriter(dir, context, 'append', { event: e }), /UNSAFE_RECORD/);
  fs.chmodSync(file, 0o600);
  assert.deepEqual(records(dir), []);
}));

test('writer retains recorded-time expiry and marks loss before removing an expired record', async () => fixture(async ({ dir }) => {
  const old = event({ recordedAt: new Date(Date.now() - 8 * 86400000).toISOString() }), e = event();
  fs.writeFileSync(path.join(dir, `evt-${old.eventId}.json`), JSON.stringify(old), { mode: 0o600 });
  assert.deepEqual(await requestWriter(dir, context, 'append', { event: e }), { written: true, reasonCode: 'RECORDED' });
  assert.deepEqual(records(dir), [`evt-${e.eventId}.json`]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'retention-v1.json'))), { schemaVersion: 1, applied: true });
  assert.equal(readSnapshot(dir, context).health.retentionApplied, true);
}));

test('queued requests cannot use another viewer lease after their own lease is removed while waiting for the lock', async () => fixture(async ({ dir, viewerId, descriptor }) => {
  const owner = path.join(dir, `.owner-${process.pid}-${randomUUID()}`), lock = path.join(dir, '.writer-lock');
  fs.writeFileSync(owner, JSON.stringify({ pid: process.pid, token: path.basename(owner).split('-').slice(2).join('-') }), { mode: 0o600 });
  fs.linkSync(owner, lock);
  let responses;
  try {
    // More than the connection and queue limit; even accepted requests must
    // recheck their exact lease after acquiring the storage lock.
    responses = Promise.all(Array.from({ length: 64 }, () => rawRequest(descriptor, {})));
    for (let n = 0; !fs.readdirSync(dir).some(name => name.startsWith('.owner-') && path.join(dir, name) !== owner) && n < 100; n++) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.ok(fs.readdirSync(dir).some(name => name.startsWith('.owner-') && path.join(dir, name) !== owner), 'writer reached the held lock');
    writeLease(dir, lease(randomUUID())); fs.unlinkSync(path.join(dir, `lease-${viewerId}.json`));
  } finally { fs.unlinkSync(lock); fs.unlinkSync(owner); }
  for (const response of await responses) {
    if (response) assert.deepEqual(JSON.parse(response).result, { written: false, reasonCode: 'CAPTURE_OFF' });
  }
  assert.deepEqual(records(dir), []);
}));

test('busy writer times out with visible loss and does not change the calling result', async () => fixture(async ({ dir }) => {
  const owner = path.join(dir, `.owner-${process.pid}-${randomUUID()}`), lock = path.join(dir, '.writer-lock');
  fs.writeFileSync(owner, JSON.stringify({ pid: process.pid, token: path.basename(owner).split('-').slice(2).join('-') }), { mode: 0o600 });
  fs.linkSync(owner, lock);
  try {
    const state = { ...event(), dataDir: dir, startedAt: Date.now(), sequence: 1 };
    delete state.eventId; delete state.phase; delete state.outcome; delete state.reasonCode; delete state.recordedAt; delete state.exitCode;
    assert.equal(finishOperation(state, { outcome: 'deny', reasonCode: 'GUARD_HARD_RESET', exitCode: 2 }), undefined);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'writer-loss-v1.json'))), { schemaVersion: 1, lost: true });
    assert.equal(readSnapshot(dir, context).health.captureState, 'loss-suspected');
  } finally { fs.unlinkSync(lock); fs.unlinkSync(owner); }
}));

test('closing a writer removes only its endpoint and lease', async () => fixture(async ({ dir, viewerId, writer, descriptor }) => {
  const other = randomUUID(); writeLease(dir, lease(other));
  await writer.close(); assert.equal(writer.active, false);
  assert.equal(fs.existsSync(path.join(dir, `lease-${viewerId}.json`)), false);
  assert.equal(fs.existsSync(path.join(dir, `lease-${other}.json`)), true);
  assert.equal(fs.existsSync(path.dirname(descriptor.socket)), false);
  assert.equal(fs.existsSync(path.join(dir, `writer-${viewerId}.json`)), false);
}));

test('unexpected owned writer exit disables its lease and marks loss without touching a second viewer', async () => fixture(async ({ dir, viewerId, writer }) => {
  const other = randomUUID(); writeLease(dir, lease(other));
  process.kill(writer.pid, 'SIGKILL');
  // close waits for the actual child exit; don't call it until the exit handler
  // has recorded the unexpected loss rather than converting it to normal close.
  for (let n = 0; writer.active && n < 100; n++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(writer.active, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'writer-loss-v1.json'))), { schemaVersion: 1, lost: true });
  assert.equal(fs.existsSync(path.join(dir, `lease-${viewerId}.json`)), false);
  assert.equal(fs.existsSync(path.join(dir, `lease-${other}.json`)), true);
}));

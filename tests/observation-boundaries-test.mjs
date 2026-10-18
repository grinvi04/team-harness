import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { validLease, writeLease, removeLease, appendEvent, validateEvent } from '../plugins/harness-guard/scripts/observation/event.mjs';
import { readSnapshot } from '../plugins/harness-guard/scripts/observation/read.mjs';

const context = { repoId: '1'.repeat(64), worktreeId: '2'.repeat(64) };
function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'observation-boundary-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir;
}
const lease = viewerId => ({ schemaVersion: 1, ...context, viewerId, expiresAt: new Date(Date.now() + 30000).toISOString() });
const event = () => ({ schemaVersion: 1, ...context, eventId: randomUUID(), operationId: randomUUID(), parentOperationId: null,
  sequence: 1, recordedAt: new Date().toISOString(), source: 'guard', phase: 'started', outcome: 'pending',
  reasonCode: 'STARTED', pluginVersion: '1.2.0', hostSessionId: null, headSha: null, baseSha: null });

test('lease exact expiry and upper duration bound', () => {
  const l = lease(randomUUID()), expiry = Date.parse(l.expiresAt);
  assert.equal(validLease(l, context, expiry - 1), true);
  assert.equal(validLease(l, context, expiry), false);
  assert.equal(validLease(l, context, expiry + 1), false);
  assert.equal(validLease(l, context, expiry - 30001), false);
});

test('closing one viewer leaves the other viewers own active lease', async t => {
  const dir = fixture(t), a = randomUUID(), b = randomUUID();
  writeLease(dir, lease(a)); writeLease(dir, lease(b)); removeLease(dir, b);
  assert.equal((await appendEvent(dir, event())).written, true);
  removeLease(dir, a); assert.equal((await appendEvent(dir, event())).written, false);
});

test('dead writer lock and incomplete private files recover with visible loss', async t => {
  const dir = fixture(t); writeLease(dir, lease(randomUUID()));
  const child = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' });
  const token = randomUUID(), abandoned = `.tmp-${child.pid}-${randomUUID()}`;
  fs.writeFileSync(path.join(dir, '.writer-lock'), JSON.stringify({ pid: child.pid, token }), { mode: 0o600 });
  fs.writeFileSync(path.join(dir, abandoned), '{"incomplete":', { mode: 0o600 });
  assert.equal((await appendEvent(dir, event())).written, true);
  assert.equal(fs.existsSync(path.join(dir, abandoned)), false);
  assert.equal(readSnapshot(dir, context).health.retentionApplied, true);
  assert.equal(fs.existsSync(path.join(dir, '.writer-lock')), false);
});

test('schema rejects coercible UUID containers and non-Git SHA lengths', () => {
  const e = event();
  assert.equal(validateEvent({ ...e, eventId: [e.eventId] }), false);
  assert.equal(validateEvent({ ...e, operationId: [e.operationId] }), false);
  assert.equal(validateEvent({ ...e, headSha: 'a'.repeat(41) }), false);
});

test('snapshot consumer mutation does not poison cached observations', async t => {
  const dir = fixture(t); writeLease(dir, lease(randomUUID())); await appendEvent(dir, event());
  const first = readSnapshot(dir, context);
  try { first.operations[0].events[0].outcome = 'pass'; first.operations[0].events[0].phase = 'finished'; } catch { /* frozen is also safe */ }
  const next = readSnapshot(dir, context);
  assert.equal(next.operations[0].events[0].outcome, 'pending');
  assert.equal(next.operations[0].events[0].phase, 'started');
});

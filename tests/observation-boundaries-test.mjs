import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { validLease, writeLease, removeLease, appendEvent, validateEvent } from '../plugins/harness-guard/scripts/observation/event.mjs';
import { readSnapshot } from '../plugins/harness-guard/scripts/observation/read.mjs';
import { startViewer } from '../plugins/harness-guard/scripts/observe.mjs';

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

function diagnosticBridge(t, active, mode, input, bridgePrefix) {
  const root = fixture(t), dataDir = path.join(root, 'spool'); fs.mkdirSync(dataDir, { mode: 0o700 });
  if (active) writeLease(dataDir, lease(randomUUID()));
  const state = { schemaVersion: 1, ...context, operationId: randomUUID(), parentOperationId: null,
    source: 'solo-merge', pluginVersion: '1.2.0', hostSessionId: null, headSha: null, baseSha: null,
    dataDir, startedAt: Date.now(), sequence: 0 };
  const trace = path.join(root, 'emitter-trace.jsonl');
  const supplied = typeof input === 'function' ? input(state) : input ?? JSON.stringify(state);
  if (bridgePrefix) fs.writeFileSync(path.join(root, 'bridge-trace.jsonl'), bridgePrefix, { mode: 0o600 });
  const result = spawnSync(process.execPath, [path.resolve('plugins/harness-guard/scripts/observation/bridge.mjs'),
    ...(mode === 'child' ? ['child', 'pending', '0', 'RESTORE_ATTEMPT'] : ['finish', 'pass', '0', 'RESTORE_VERIFIED'])],
  { input: supplied, encoding: 'utf8', timeout: 3000,
    env: { ...process.env, OBSERVATION_STACK_TRACE: trace,
      NODE_OPTIONS: `--require ${JSON.stringify(path.resolve('tests/helpers/observation-emitter-probe.cjs'))}` } });
  assert.equal(result.error, undefined); assert.equal(result.status, 0); assert.equal(result.stderr, '');
  const read = name => fs.existsSync(name) ? fs.readFileSync(name, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  const bridge = read(path.join(root, 'bridge-trace.jsonl')), emitters = read(trace);
  const stored = fs.readdirSync(dataDir).filter(name => name.startsWith('evt-')).map(name =>
    JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8')));
  for (const row of bridge.filter(row => row.phase === 'input')) assert.equal(row.inputBytes, Buffer.byteLength(supplied));
  for (const row of bridge.filter(row => row.phase === 'exit')) assert.equal(row.outputBytes, Buffer.byteLength(result.stdout));
  for (const row of emitters) assert.equal(row.eventFilePresent, stored.some(event => event.eventId === row.eventId));
  return { result, bridge, emitters, stored, root };
}

for (const mode of ['child', 'finish']) test(`diagnostic probe distinguishes ${mode} state output from capture-off no-write`, t => {
  const { result, bridge, emitters, stored } = diagnosticBridge(t, false, mode);
  if (mode === 'child') assert.equal(JSON.parse(result.stdout).source, 'solo-merge');
  else assert.equal(result.stdout, '');
  assert.equal(bridge[0]?.mode, mode); assert.equal(bridge[0]?.jsonObject, true);
  assert.equal(bridge[0]?.source, 'solo-merge');
  assert.equal(bridge[1]?.exitCode, 0); assert.deepEqual(stored, []);
  assert.equal(emitters.length, 1); assert.equal(emitters[0].status, 0);
  assert.equal(emitters[0].eventFilePresent, false);
});

test('diagnostic probe distinguishes stored restore finish from missing bridge state', t => {
  const { result, bridge, emitters, stored } = diagnosticBridge(t, true, 'finish');
  assert.equal(result.stdout, ''); assert.equal(bridge[0]?.mode, 'finish');
  assert.equal(bridge[0]?.jsonObject, true); assert.equal(bridge[1]?.exitCode, 0);
  assert.equal(bridge[1]?.outputBytes, 0); assert.equal(emitters.length, 1);
  assert.equal(emitters[0].reasonCode, 'RESTORE_VERIFIED');
  assert.equal(emitters[0].eventFilePresent, true);
  assert.equal(stored.length, 1); assert.equal(validateEvent(stored[0]), true);
  assert.equal(stored[0].reasonCode, 'RESTORE_VERIFIED');
});

test('diagnostic probe marks oversized valid state as uninspected while preserving storage', t => {
  const { result, bridge, stored } = diagnosticBridge(t, true, 'finish', state => JSON.stringify(state) + ' '.repeat(8192));
  assert.equal(result.stdout, ''); assert.equal(bridge[0]?.inputTruncated, true);
  assert.equal(bridge[0]?.jsonObject, null); assert.equal(bridge[0]?.source, null);
  assert.equal(stored.length, 1); assert.equal(stored[0].reasonCode, 'RESTORE_VERIFIED');
});

test('diagnostic bridge receipt preserves malformed-input silence and omits raw input', t => {
  const sentinel = 'SYNTHETIC_PROBE_PRIVATE_INPUT';
  const { result, bridge, emitters, root } = diagnosticBridge(t, false, 'finish', sentinel);
  assert.equal(result.stdout, ''); assert.equal(bridge[0]?.jsonObject, false);
  assert.equal(bridge[1]?.exitCode, 0); assert.deepEqual(emitters, []);
  const bytes = fs.readFileSync(path.join(root, 'bridge-trace.jsonl'), 'utf8');
  assert.equal(bytes.includes(sentinel), false); assert.equal(bytes.includes(root), false);
  assert.ok(Buffer.byteLength(bytes) <= 1024);
  assert.equal(fs.statSync(path.join(root, 'bridge-trace.jsonl')).mode & 0o777, 0o600);
});

test('diagnostic bridge receipt marks its limit without changing the actual stored result', t => {
  const row = JSON.stringify({ mode: 'finish', phase: 'seed', padding: 'x'.repeat(256) }) + '\n';
  const prefix = row.repeat(Math.ceil(15360 / Buffer.byteLength(row)));
  const { result, bridge, emitters, root } = diagnosticBridge(t, true, 'finish', undefined, prefix);
  assert.equal(result.stdout, ''); assert.equal(emitters[0]?.eventFilePresent, true);
  assert.equal(bridge.filter(row => row.phase === 'limit').length, 1);
  assert.equal(bridge.filter(row => row.phase === 'input' || row.phase === 'exit').length, 0);
  assert.ok(fs.statSync(path.join(root, 'bridge-trace.jsonl')).size <= 16384);
});

test('fresh emitter records restore finish within its unchanged budget with a cold populated spool', async t => {
  const dir = fixture(t), template = { ...event(), source: 'solo-merge', phase: 'finished', outcome: 'pass',
    reasonCode: 'RESTORE_VERIFIED', sequence: 2, exitCode: 0 };
  // The observed failure is in a fresh process; warming readSnapshot/appendEvent here would hide it.
  for (let i = 0; i < 8000; i++) {
    const prior = { ...template, eventId: randomUUID(), operationId: randomUUID() };
    fs.writeFileSync(path.join(dir, `evt-${prior.eventId}.json`), JSON.stringify(prior) + '\n', { mode: 0o600 });
  }
  const repo = path.join(dir, 'repo'); fs.mkdirSync(repo);
  for (const args of [['init', '-b', 'develop'], ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'fixture']]) {
    assert.equal(spawnSync('git', args, { cwd: repo }).status, 0);
  }
  const { resolveContext } = await import('../plugins/harness-guard/scripts/observation/context.mjs');
  Object.assign(template, resolveContext(repo));
  const viewer = await startViewer({ dataDir: dir, repo });
  try {
    const result = spawnSync(process.execPath, [path.resolve('plugins/harness-guard/scripts/observation/emit.mjs'), dir],
      { input: JSON.stringify(template), encoding: 'utf8', timeout: 250, killSignal: 'SIGKILL' });
    assert.equal(result.error, undefined, `fresh emitter: ${result.error?.code}/${result.signal}`);
    assert.equal(result.status, 0); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, `evt-${template.eventId}.json`))), template);
    const parent = randomUUID(), child = { ...template, source: 'stack', parentOperationId: parent,
      eventId: randomUUID(), operationId: randomUUID(), reasonCode: 'MERGE_FAILED', outcome: 'fail', exitCode: 1 };
    const emitted = spawnSync(process.execPath, [path.resolve('plugins/harness-guard/scripts/observation/emit.mjs'), dir],
      { input: JSON.stringify(child), encoding: 'utf8', timeout: 250, killSignal: 'SIGKILL' });
    assert.equal(emitted.error, undefined); assert.equal(emitted.status, 0);
    assert.equal(emitted.stdout, ''); assert.equal(emitted.stderr, '');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, `evt-${child.eventId}.json`))), child);
    const state = { ...template, operationId: parent, dataDir: dir };
    const query = spawnSync(process.execPath, [path.resolve('plugins/harness-guard/scripts/observation/bridge.mjs'), 'result-read', 'stack'],
      { input: JSON.stringify(state), encoding: 'utf8', timeout: 250, killSignal: 'SIGKILL' });
    assert.equal(query.error, undefined); assert.equal(query.status, 0); assert.equal(query.stderr, '');
    assert.equal(query.stdout, 'fail\nMERGE_FAILED');
  } finally { await viewer.close(); }
});

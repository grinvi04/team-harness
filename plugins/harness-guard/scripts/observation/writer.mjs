import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { directory, unchanged, readFile, atomicWrite, UUID } from './storage.mjs';
import { appendEvent, readEvents, validLease, validateEvent, guardDenialReason } from './event.mjs';

const keys = (value, names) => value && Object.keys(value).sort().join() === names.slice().sort().join();
const descriptorKeys = ['schemaVersion', 'viewerId', 'repoId', 'worktreeId', 'dev', 'ino', 'socket', 'capability'];
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const sha = value => value === null || typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
function exactLease(root, binding) {
  try {
    const lease = JSON.parse(readFile(root, `lease-${binding.viewerId}.json`, 512).data);
    return lease.viewerId === binding.viewerId && validLease(lease, binding);
  } catch { return false; }
}
function endpoint(root, target) {
  for (const name of fs.readdirSync(root.dir).filter(name => name.startsWith('writer-') &&
    name.endsWith('.json') && UUID.test(name.slice(7, -5))).sort()) {
    const d = JSON.parse(readFile(root, name, 1024).data);
    if (!keys(d, descriptorKeys) || d.schemaVersion !== 1 || typeof d.viewerId !== 'string' || !UUID.test(d.viewerId) ||
      name !== `writer-${d.viewerId}.json` || !digest(d.repoId) || !digest(d.worktreeId) ||
      d.dev !== root.dev || d.ino !== root.ino || !digest(d.capability) || typeof d.socket !== 'string' ||
      path.basename(d.socket) !== 'socket' || !/^harness-writer-/.test(path.basename(path.dirname(d.socket)))) throw Error('INVALID_WRITER');
    if (d.repoId !== target.repoId || d.worktreeId !== target.worktreeId || !exactLease(root, d)) continue;
    directory(path.dirname(d.socket));
    const socket = fs.lstatSync(d.socket);
    if (!socket.isSocket() || socket.uid !== process.getuid() || (socket.mode & 0o777) !== 0o600) throw Error('INVALID_WRITER');
    return d;
  }
  return null;
}
export async function requestWriter(dataDir, target, action, payload) {
  const root = directory(dataDir), d = endpoint(root, target);
  // Compatibility with an older/manual lease. An advertised but failed writer
  // is never retried through a direct write: its commit may already exist.
  if (!d) return null;
  const request = JSON.stringify({ schemaVersion: 1, viewerId: d.viewerId, capability: d.capability, action, ...payload });
  if (Buffer.byteLength(request) > 8192) throw Error('OVERSIZE');
  unchanged(root);
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(d.socket); let raw = '', done = false;
    const finish = (error, value) => { if (done) return; done = true; clearTimeout(timer); socket.destroy(); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => finish(Error('WRITER_TIMEOUT')), 180);
    socket.once('connect', () => socket.end(request));
    socket.on('data', chunk => { raw += chunk; if (Buffer.byteLength(raw) > 256) finish(Error('INVALID_ACK')); });
    socket.once('error', error => finish(error));
    socket.once('end', () => {
      try {
        const ack = JSON.parse(raw);
        if (!keys(ack, ['schemaVersion', 'viewerId', 'result']) || ack.schemaVersion !== 1 || ack.viewerId !== d.viewerId ||
          !ack.result || typeof ack.result !== 'object') throw Error('INVALID_ACK');
        finish(null, ack.result);
      } catch (error) { finish(error); }
    });
  });
}
export function childResult(scan, state, source) {
  const matches = scan.records.map(record => record.value).filter(event =>
    event.parentOperationId === state.operationId && event.source === source && event.phase === 'finished' &&
    ['repoId', 'worktreeId', 'headSha', 'baseSha', 'hostSessionId'].every(key => event[key] === state[key]));
  const reasons = { pass: 'MERGED', fail: 'MERGE_FAILED', pending: 'MERGE_PENDING', enqueued: 'MERGE_PENDING', unverified: 'RESULT_UNVERIFIED' };
  const guard = source === 'guard' && matches.length === 1 && matches[0].outcome === 'deny' &&
    matches[0].exitCode === 2 && guardDenialReason(matches[0].reasonCode) === matches[0].reasonCode;
  return !scan.parseErrors && matches.length === 1 && (guard || source !== 'guard' && reasons[matches[0].outcome] === matches[0].reasonCode)
    ? { outcome: matches[0].outcome, reasonCode: matches[0].reasonCode } : {};
}
function validQuery(state, source, binding) {
  return keys(state, ['operationId', 'repoId', 'worktreeId', 'headSha', 'baseSha', 'hostSessionId']) &&
    typeof state.operationId === 'string' && UUID.test(state.operationId) && ['stack', 'pr-merge', 'guard'].includes(source) &&
    state.repoId === binding.repoId && state.worktreeId === binding.worktreeId && sha(state.headSha) && sha(state.baseSha) &&
    (state.hostSessionId === null || typeof state.hostSessionId === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(state.hostSessionId));
}
async function runWorker({ dataDir, binding }) {
  const root = directory(dataDir);
  if (root.dev !== binding.dev || root.ino !== binding.ino) throw Error('STORAGE_CHANGED');
  // Cold validation happens once BEFORE this viewer publishes its lease. The
  // normal append path still re-stats every record and validates changed bytes.
  readEvents(root);
  let closing = false, queued = 0, chain = Promise.resolve(); const sockets = new Set();
  const server = net.createServer({ allowHalfOpen: true }, socket => {
    if (closing || sockets.size >= 32) { socket.destroy(); return; }
    sockets.add(socket); let raw = '', size = 0; const deadline = Date.now() + 180;
    socket.setTimeout(200, () => socket.destroy()); socket.on('error', () => {});
    socket.once('close', () => sockets.delete(socket));
    socket.on('data', chunk => { size += chunk.length; if (size > 8192) socket.destroy(); else raw += chunk; });
    socket.once('end', () => {
      if (queued >= 32) return socket.destroy();
      queued++;
      chain = chain.then(async () => {
        if (closing || socket.destroyed || size > 8192 || Date.now() >= deadline) return socket.destroy();
        const req = JSON.parse(raw); raw = '';
        const expected = binding.capability;
        if (!req || req.schemaVersion !== 1 || req.viewerId !== binding.viewerId || typeof req.capability !== 'string' ||
          Buffer.byteLength(req.capability) !== Buffer.byteLength(expected) ||
          !timingSafeEqual(Buffer.from(req.capability), Buffer.from(expected)) || !exactLease(root, binding)) return socket.destroy();
        let result;
        if (req.action === 'append' && keys(req, ['schemaVersion', 'viewerId', 'capability', 'action', 'event']) &&
          validateEvent(req.event) && req.event.repoId === binding.repoId && req.event.worktreeId === binding.worktreeId) {
          result = await appendEvent(dataDir, req.event, { viewerId: binding.viewerId });
        } else if (req.action === 'result' && keys(req, ['schemaVersion', 'viewerId', 'capability', 'action', 'state', 'source']) &&
          validQuery(req.state, req.source, binding)) result = childResult(readEvents(root), req.state, req.source);
        else return socket.destroy();
        socket.end(JSON.stringify({ schemaVersion: 1, viewerId: binding.viewerId, result }));
      }).catch(() => socket.destroy()).finally(() => { queued--; });
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(binding.socket, resolve); });
  fs.chmodSync(binding.socket, 0o600);
  const stop = async () => {
    if (closing) return; closing = true;
    try { unchanged(root); fs.unlinkSync(path.join(dataDir, `lease-${binding.viewerId}.json`)); } catch { /* Exact lease also expires. */ }
    for (const socket of sockets) socket.destroy();
    await chain;
    await new Promise(resolve => server.close(resolve));
    try { unchanged(root); fs.unlinkSync(path.join(dataDir, `writer-${binding.viewerId}.json`)); } catch { /* No other writer is removed. */ }
    try { fs.rmSync(path.dirname(binding.socket), { recursive: true }); } catch { /* Owned temporary endpoint only. */ }
    if (process.connected) process.disconnect();
  };
  process.once('disconnect', stop); process.once('SIGTERM', stop);
  process.on('message', message => { if (message === 'close') void stop(); });
  if (!process.connected) await stop(); else process.send?.('ready');
}
export async function startWriter(dataDir, context, viewerId) {
  const root = directory(dataDir), privateDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'harness-writer-'));
  fs.chmodSync(privateDir, 0o700);
  const binding = { schemaVersion: 1, viewerId, repoId: context.repoId, worktreeId: context.worktreeId,
    dev: root.dev, ino: root.ino, socket: path.join(privateDir, 'socket'), capability: randomBytes(32).toString('hex') };
  if (Buffer.byteLength(binding.socket) >= 104) { fs.rmdirSync(privateDir); throw Error('SOCKET_PATH_TOO_LONG'); }
  const descriptor = `writer-${viewerId}.json`;
  let active = true, closed = false;
  const cleanup = () => {
    active = false;
    if (!closed) {
      try { atomicWrite(root, 'writer-loss-v1.json', '{"schemaVersion":1,"lost":true}\n'); } catch { /* Gate behavior is unchanged. */ }
    }
    // Remove our lease before the endpoint so another viewer cannot authorize
    // a fallback write during shutdown. Never remove any other viewer's files.
    for (const name of [`lease-${viewerId}.json`, descriptor]) {
      try { unchanged(root); fs.unlinkSync(path.join(dataDir, name)); } catch { /* Stale lease expires; no authority is extended. */ }
    }
    try { fs.rmSync(privateDir, { recursive: true }); } catch { /* Preserve failures as inactive. */ }
  };
  const child = fork(fileURLToPath(import.meta.url), ['--worker'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: [] });
  const exited = new Promise(resolve => {
    child.once('exit', () => { cleanup(); resolve(); });
    child.once('error', () => { cleanup(); resolve(); });
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('WRITER_START_TIMEOUT')), 10000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(Error('WRITER_EXITED')); });
      child.once('message', value => { clearTimeout(timer); value === 'ready' ? resolve() : reject(Error('WRITER_START_FAILED')); });
      child.send({ dataDir, binding });
    });
    atomicWrite(root, descriptor, JSON.stringify(binding) + '\n');
  } catch (error) { if (child.connected) child.disconnect(); await exited; throw error; }
  return { get active() { return active; }, pid: child.pid, async close() {
    if (closed) return; closed = true;
    cleanup(); if (child.connected) child.send('close');
    await exited;
  } };
}
if (process.argv[2] === '--worker' && process.send) {
  process.once('message', options => { runWorker(options).catch(() => process.exit(1)); });
}

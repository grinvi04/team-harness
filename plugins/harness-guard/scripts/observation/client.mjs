import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { directory, atomicWrite, UUID } from './storage.mjs';
import { readLease, validateEvent, guardDenialReason } from './event.mjs';
import { resolveContext, sessionId } from './context.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
export function markLoss(dataDir) {
  try { atomicWrite(directory(dataDir), 'writer-loss-v1.json', '{"schemaVersion":1,"lost":true}\n'); } catch { /* Capture failure never changes the gate. */ }
}
function emit(state, phase, fields) {
  if (!state) return;
  try {
    const { dataDir, startedAt, sequence, ...context } = state;
    const event = { ...context, eventId: randomUUID(), sequence: ++state.sequence, recordedAt: new Date().toISOString(), phase, ...fields };
    if (!validateEvent(event)) { markLoss(dataDir); return; }
    const r = spawnSync(process.execPath, [path.join(here, 'emit.mjs'), dataDir], {
      input: JSON.stringify(event), stdio: ['pipe', 'ignore', 'ignore'], timeout: 250, killSignal: 'SIGKILL',
    });
    if (r.status !== 0 || r.error) markLoss(dataDir);
  } catch { markLoss(state.dataDir); }
}
export function startOperation(source, { cwd = process.cwd(), sessionId: session = process.env.HARNESS_OBSERVE_SESSION, dataDir = process.env.HARNESS_OBSERVE_DIR || (process.env.PLUGIN_DATA && path.join(process.env.PLUGIN_DATA, 'observability')), parentOperationId = process.env.HARNESS_OBSERVE_PARENT, candidate, evidenceId } = {}) {
  try {
    // No emitter or Git child is started when no viewer has ever enabled capture.
    if (!dataDir || !fs.existsSync(dataDir)) return null;
    const root = directory(dataDir);
    if (!fs.readdirSync(root.dir).some(n => /^lease-.*\.json$/.test(n))) return null;
    const context = resolveContext(cwd, sessionId(session));
    if (!context || !readLease(root, context)) return null;
    if (candidate) {
      if (![candidate.headSha, candidate.baseSha].every(v => typeof v === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(v))) return null;
      context.headSha = candidate.headSha; context.baseSha = candidate.baseSha;
    }
    const pluginVersion = JSON.parse(fs.readFileSync(path.resolve(here, '../../.claude-plugin/plugin.json'), 'utf8')).version;
    const state = { schemaVersion: 1, operationId: randomUUID(), parentOperationId: typeof parentOperationId === 'string' && UUID.test(parentOperationId) ? parentOperationId : null,
      source, pluginVersion, ...context, dataDir, startedAt: Date.now(), sequence: 0 };
    if (evidenceId !== undefined) state.evidenceId = evidenceId;
    emit(state, 'started', { outcome: 'pending', reasonCode: 'STARTED' });
    return state;
  } catch { return null; }
}
export function childGuardDenial(state) {
  if (!state) return 'GUARD_DENIED';
  try {
    const result = spawnSync(process.execPath, [path.join(here, 'bridge.mjs'), 'result-read', 'guard'], {
      input: JSON.stringify(state), encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 250, killSignal: 'SIGKILL', maxBuffer: 128,
    });
    if (!result.error && result.status === 0 && result.stdout.startsWith('deny\n'))
      return guardDenialReason(result.stdout.slice(5));
  } catch { /* Missing or ambiguous child evidence retains the generic denial. */ }
  return 'GUARD_DENIED';
}
export function finishOperation(state, fields = {}) {
  if (!state) return;
  emit(state, 'finished', { durationMs: Math.max(0, Date.now() - state.startedAt), ...fields });
}
export function startChild(state, reasonCode) {
  if (!state) return null;
  const child = { ...state, operationId: randomUUID(), parentOperationId: state.operationId, startedAt: Date.now(), sequence: 0 };
  emit(child, 'started', { outcome: 'pending', reasonCode }); return child;
}

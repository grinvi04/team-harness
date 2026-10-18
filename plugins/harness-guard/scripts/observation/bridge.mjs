import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startOperation, finishOperation, startChild } from './client.mjs';
import { readEvents, guardDenialReason } from './event.mjs';
import { directory } from './storage.mjs';
let raw = '';
try {
  for await (const chunk of process.stdin) { raw += chunk; if (raw.length > 1048576) process.exit(0); }
  const [mode, source, code, reason] = process.argv.slice(2);
  if (mode === 'start') {
    let hook; try { hook = JSON.parse(raw); } catch { hook = {}; }
    const state = startOperation(source, { cwd: hook?.cwd || process.cwd(), sessionId: hook?.session_id ?? process.env.HARNESS_OBSERVE_SESSION,
      ...(code && reason ? { candidate: { headSha: code, baseSha: reason } } : {}) });
    if (state) process.stdout.write(`${state.operationId}\n${JSON.stringify(state)}`);
  } else if (mode === 'finish') {
    const state = JSON.parse(raw), rc = Number(code);
    finishOperation(state, { outcome: source, reasonCode: reason, exitCode: rc });
  } else if (mode === 'result' && ['stack', 'pr-merge'].includes(source)) {
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'result-read', source], {
      input: raw, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 250, killSignal: 'SIGKILL', maxBuffer: 128,
    });
    if (!result.error && result.status === 0) process.stdout.write(result.stdout);
  } else if (mode === 'result-read' && ['stack', 'pr-merge', 'guard'].includes(source)) {
    const state = JSON.parse(raw), scan = readEvents(directory(state.dataDir));
    const matches = scan.records.map(record => record.value).filter(event =>
      event.parentOperationId === state.operationId && event.source === source && event.phase === 'finished' &&
      ['repoId', 'worktreeId', 'headSha', 'baseSha', 'hostSessionId'].every(key => event[key] === state[key]));
    const reasons = { pass: 'MERGED', fail: 'MERGE_FAILED', pending: 'MERGE_PENDING', enqueued: 'MERGE_PENDING', unverified: 'RESULT_UNVERIFIED' };
    const guard = source === 'guard' && matches.length === 1 && matches[0].outcome === 'deny' &&
      matches[0].exitCode === 2 && guardDenialReason(matches[0].reasonCode) === matches[0].reasonCode;
    if (!scan.parseErrors && matches.length === 1 && (guard || source !== 'guard' && reasons[matches[0].outcome] === matches[0].reasonCode))
      process.stdout.write(`${matches[0].outcome}\n${matches[0].reasonCode}`);
  } else if (mode === 'child') {
    const state = startChild(JSON.parse(raw), reason);
    if (state) process.stdout.write(JSON.stringify(state));
  }
} catch { /* Observation is best effort; original command output is never copied. */ }

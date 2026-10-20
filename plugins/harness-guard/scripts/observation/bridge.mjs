import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readEvents } from './event.mjs';
import { directory } from './storage.mjs';
import { requestWriter, childResult } from './writer.mjs';
let raw = '';
try {
  for await (const chunk of process.stdin) { raw += chunk; if (raw.length > 1048576) process.exit(0); }
  const [mode, source, code, reason] = process.argv.slice(2);
  if (mode === 'start') {
    const { startOperation } = await import('./client.mjs');
    let hook; try { hook = JSON.parse(raw); } catch { hook = {}; }
    const state = startOperation(source, { cwd: hook?.cwd || process.cwd(), sessionId: hook?.session_id ?? process.env.HARNESS_OBSERVE_SESSION,
      ...(code && reason ? { candidate: { headSha: code, baseSha: reason } } : {}) });
    if (state) process.stdout.write(`${state.operationId}\n${JSON.stringify(state)}`);
  } else if (mode === 'finish') {
    const { finishOperation } = await import('./client.mjs');
    const state = JSON.parse(raw), rc = Number(code);
    finishOperation(state, { outcome: source, reasonCode: reason, exitCode: rc });
  } else if (mode === 'result' && ['stack', 'pr-merge'].includes(source)) {
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'result-read', source], {
      input: raw, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 250, killSignal: 'SIGKILL', maxBuffer: 128,
    });
    if (!result.error && result.status === 0) process.stdout.write(result.stdout);
  } else if (mode === 'result-read' && ['stack', 'pr-merge', 'guard'].includes(source)) {
    const state = JSON.parse(raw), query = Object.fromEntries(['operationId', 'repoId', 'worktreeId', 'headSha', 'baseSha', 'hostSessionId'].map(key => [key, state[key]]));
    const result = await requestWriter(state.dataDir, query, 'result', { state: query, source }) ??
      childResult(readEvents(directory(state.dataDir)), state, source);
    if (result.outcome && result.reasonCode) process.stdout.write(`${result.outcome}\n${result.reasonCode}`);
  } else if (mode === 'child') {
    const { startChild } = await import('./client.mjs');
    const state = startChild(JSON.parse(raw), reason);
    if (state) process.stdout.write(JSON.stringify(state));
  }
} catch { /* Observation is best effort; original command output is never copied. */ }

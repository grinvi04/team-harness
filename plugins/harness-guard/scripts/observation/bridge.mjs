import { startOperation, finishOperation, startChild } from './client.mjs';
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
  } else if (mode === 'child') {
    const state = startChild(JSON.parse(raw), reason);
    if (state) process.stdout.write(JSON.stringify(state));
  }
} catch { /* Observation is best effort; original command output is never copied. */ }

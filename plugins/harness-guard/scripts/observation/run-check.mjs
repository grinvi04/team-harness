import { spawn } from 'node:child_process';
import { constants } from 'node:os';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { startOperation, finishOperation } from './client.mjs';

const validId = id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(id);

export async function runCheck({ id, argv, cwd = process.cwd(), context = {} }) {
  if (!validId(id) || !Array.isArray(argv) || !argv.length || !argv[0] ||
    argv.some(arg => typeof arg !== 'string' || arg.includes('\0'))) throw new TypeError('INVALID_CHECK');
  let state = null;
  try { state = startOperation('check-runner', { cwd, sessionId: context?.sessionId, dataDir: context?.dataDir }); }
  catch { /* Observation must not change command execution. */ }
  const startedAt = performance.now();
  const exitCode = await new Promise(resolve => {
    try {
      const child = spawn(argv[0], argv.slice(1), { cwd, shell: false, stdio: 'inherit',
        env: state ? { ...process.env, HARNESS_OBSERVE_PARENT: state.operationId } : process.env });
      child.once('error', error => resolve(error.code === 'ENOENT' ? 127 : 126));
      child.once('close', (code, signal) => resolve(code ?? 128 + (constants.signals[signal] || 1)));
    } catch { resolve(126); }
  });
  try {
    finishOperation(state, { outcome: exitCode === 0 ? 'pass' : 'fail',
      reasonCode: exitCode === 0 ? 'CHECK_PASSED' : 'CHECK_FAILED', exitCode,
      durationMs: Math.round(performance.now() - startedAt), evidenceId: id });
  } catch { /* Preserve the command result if observation fails. */ }
  return exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [flag, id, separator, ...argv] = process.argv.slice(2);
  if (flag !== '--id' || !validId(id) || separator !== '--' || !argv.length || !argv[0]) {
    process.stderr.write('Usage: run-check.mjs --id <identifier> -- <command> [args...]\n');
    process.exitCode = 2;
  } else {
    try { process.exitCode = await runCheck({ id, argv }); }
    catch { process.stderr.write('Invalid check arguments\n'); process.exitCode = 2; }
  }
}

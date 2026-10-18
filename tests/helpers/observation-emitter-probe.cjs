// Test-only preload: observe the existing emitter call without changing its options/result.
const fs = require('node:fs');
const childProcess = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const trace = process.env.OBSERVATION_STACK_TRACE;
if (trace) {
  const original = childProcess.spawnSync;
  childProcess.spawnSync = function (command, args, options) {
    if (!Array.isArray(args) || !/[\\/]observation[\\/]emit\.mjs$/.test(args[0] || ''))
      return original.apply(this, arguments);
    const started = performance.now();
    let result, failure;
    try { result = original.apply(this, arguments); return result; }
    catch (error) { failure = error; throw error; }
    finally {
      try {
        const event = JSON.parse(options.input);
        const safe = (value, pattern) => typeof value === 'string' && pattern.test(value) ? value : null;
        const record = {
          durationMs: Math.round((performance.now() - started) * 100) / 100,
          status: Number.isInteger(result?.status) ? result.status : null,
          signal: safe(result?.signal, /^SIG[A-Z0-9]{1,16}$/),
          errorCode: safe((failure || result?.error)?.code, /^[A-Z][A-Z0-9_]{0,31}$/),
          operationId: safe(event.operationId, /^[a-f0-9-]{36}$/),
          eventId: safe(event.eventId, /^[a-f0-9-]{36}$/),
          sequence: Number.isSafeInteger(event.sequence) ? event.sequence : null,
          source: safe(event.source, /^(?:stack|solo-merge|pr-merge)$/),
          phase: safe(event.phase, /^(?:started|finished)$/),
          reasonCode: safe(event.reasonCode, /^[A-Z][A-Z_]{0,63}$/),
        };
        const line = JSON.stringify(record) + '\n';
        if ((!fs.existsSync(trace) || fs.statSync(trace).size < 60000) && Buffer.byteLength(line) < 1024)
          fs.appendFileSync(trace, line, { mode: 0o600 });
      } catch { /* Diagnostics never replace the original result or error. */ }
    }
  };
  syncBuiltinESMExports();
}

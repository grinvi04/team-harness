// Test-only preload. Child stages travel over fd3, never gate stdout/stderr.
const enteredAt = process.hrtime.bigint();
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const milliseconds = () => Number(process.hrtime.bigint()) / 1e6;
const MAX_STAGE_BYTES = 4096, MAX_STAGES = 30;
if (process.env.OBSERVATION_EMITTER_CHILD === '1') {
  const write = fs.writeSync;
  let ordinaryCount = 0, ordinaryBytes = 0, errorCount = 0, limited = false;
  const lifecycle = new Set();
  const send = line => { try { write(3, line); } catch { /* Diagnostic pipe only. */ } };
  const limit = at => {
    if (!limited) { limited = true; send(JSON.stringify({ stage: 'stage-limit', at }) + '\n'); }
  };
  const stage = (name, fields = {}, at = milliseconds()) => {
    const line = JSON.stringify({ stage: name, at, ...fields }) + '\n', size = Buffer.byteLength(line);
    // Reserve 4 error rows and one row each for beforeExit/exit after ordinary truncation.
    // 3000 ordinary bytes + 7 reserved rows of at most 128 bytes stay below 4096.
    if (name === 'before-exit' || name === 'exit') {
      if (lifecycle.has(name)) return;
      if (size > 128) { limit(at); return; }
      lifecycle.add(name);
    } else if (name.endsWith('-error')) {
      if (errorCount >= 4 || size > 128) { limit(at); return; }
      errorCount++;
    } else {
      if (ordinaryCount >= 23 || ordinaryBytes + size > 3000) { limit(at); return; }
      ordinaryCount++; ordinaryBytes += size;
    }
    send(line);
  };
  stage('preload-start', {}, Number(enteredAt) / 1e6);
  const byteLength = value => Buffer.isBuffer(value) ? value.length : typeof value === 'string' ? Buffer.byteLength(value) : 0;
  const iterator = process.stdin[Symbol.asyncIterator];
  process.stdin[Symbol.asyncIterator] = function () {
    const actual = iterator.apply(this, arguments), next = actual.next;
    let inputBytes = 0, chunkCount = 0, lastChunkBytes = 0, started = false;
    actual.next = function () {
      if (!started) { stage('input-start'); started = true; }
      else if (chunkCount === 1) stage('input-wait-eof', { inputBytes });
      return next.apply(this, arguments).then(step => {
        if (step.done) stage('input-eof', { inputBytes, chunkCount, lastChunkBytes });
        else {
          lastChunkBytes = byteLength(step.value); inputBytes += lastChunkBytes; chunkCount++;
          if (chunkCount === 1) stage('input-first-chunk', { inputBytes });
        }
        return step;
      });
    };
    // Keep the actual iterator's return/throw methods and lifecycle untouched.
    return actual;
  };
  process.on('beforeExit', code => stage('before-exit', { exitCode: code }));
  process.on('exit', code => stage('exit', { exitCode: code }));
  const read = fs.readFileSync;
  fs.readFileSync = function (file) {
    if (file !== 0) return read.apply(this, arguments);
    stage('input-sync-start');
    const result = read.apply(this, arguments);
    stage('input-sync-end', { inputBytes: byteLength(result) }); return result;
  };
  for (const [method, label] of [['writeFileSync', 'write'], ['fsyncSync', 'fsync'], ['renameSync', 'rename']]) {
    const original = fs[method];
    fs[method] = function (file) {
      const name = method === 'writeFileSync' && typeof file === 'string' && /^\.owner-/.test(path.basename(file)) ? 'owner' : label;
      stage(`${name}-start`);
      try { const result = original.apply(this, arguments); stage(`${name}-end`); return result; }
      catch (error) { stage(`${name}-error`); throw error; }
    };
  }
  const link = fs.linkSync;
  fs.linkSync = function (from, to) {
    const lock = typeof to === 'string' && path.basename(to) === '.writer-lock';
    if (lock) stage('lock-attempt');
    const result = link.apply(this, arguments);
    if (lock) stage('lock-acquired');
    return result;
  };
  syncBuiltinESMExports();
  stage('preload-ready');
} else if (process.env.OBSERVATION_STACK_TRACE) {
  const trace = process.env.OBSERVATION_STACK_TRACE;
  // The shell bridge can omit an emitter entirely when state is absent/invalid.
  // Observe its input/output boundary without changing production source or bytes.
  if (/[\\/]observation[\\/]bridge\.mjs$/.test(process.argv[1] || '') && ['child', 'finish'].includes(process.argv[2])) {
    const target = path.join(path.dirname(trace), 'bridge-trace.jsonl'), mode = process.argv[2];
    const receipt = fields => {
      try {
        const line = JSON.stringify({ mode, ...fields }) + '\n';
        const size = fs.existsSync(target) ? fs.statSync(target).size : 0;
        if (Buffer.byteLength(line) > 512 || size >= 16384) return;
        if (size + Buffer.byteLength(line) > 15360) {
          if (!fs.readFileSync(target, 'utf8').includes('"phase":"limit"'))
            fs.appendFileSync(target, JSON.stringify({ mode, phase: 'limit' }) + '\n', { mode: 0o600 });
          return;
        }
        fs.appendFileSync(target, line, { mode: 0o600 });
      } catch { /* Test diagnostics never replace bridge output or exit. */ }
    };
    let input = '', inputBytes = 0, outputBytes = 0;
    const iterator = process.stdin[Symbol.asyncIterator], write = process.stdout.write;
    process.stdin[Symbol.asyncIterator] = function () {
      const actual = iterator.apply(this, arguments), next = actual.next;
      actual.next = function () {
        return next.apply(this, arguments).then(step => {
          try {
            if (!step.done) {
              inputBytes += Buffer.byteLength(step.value);
              if (inputBytes <= 8192) input += step.value.toString('utf8');
            } else {
              let state; try { if (inputBytes <= 8192) state = JSON.parse(input); } catch { /* No raw input in the receipt. */ }
              receipt({ phase: 'input', inputBytes, inputTruncated: inputBytes > 8192,
                jsonObject: inputBytes > 8192 ? null : !!state && typeof state === 'object' && !Array.isArray(state),
                source: ['codex-hook', 'claude-hook', 'guard', 'check-runner', 'pr-create', 'pr-merge', 'solo-merge', 'stack'].includes(state?.source) ? state.source : null,
                operationId: typeof state?.operationId === 'string' && /^[a-f0-9-]{36}$/.test(state.operationId) ? state.operationId : null });
              input = '';
            }
          } catch { /* Keep the real iterator result. */ }
          return step;
        });
      };
      return actual;
    };
    process.stdout.write = function (chunk) {
      try { outputBytes += Buffer.byteLength(chunk); } catch { /* Ignore unsupported diagnostic input. */ }
      return write.apply(this, arguments);
    };
    process.on('exit', code => receipt({ phase: 'exit', exitCode: code, outputBytes }));
  }
  const original = childProcess.spawnSync;
  childProcess.spawnSync = function (command, args, options) {
    if (Array.isArray(args) && /[\\/]observation[\\/]bridge\.mjs$/.test(args[0] || '') && args[1] === 'result-read') {
      const started = milliseconds(); let result;
      try { result = original.apply(this, arguments); return result; }
      finally {
        try {
          const row = { commandMode: 'result-read', durationMs: Math.round((milliseconds() - started) * 100) / 100,
            status: result?.status ?? null, signal: /^SIG[A-Z0-9]+$/.test(result?.signal || '') ? result.signal : null,
            errorCode: /^[A-Z][A-Z0-9_]{0,31}$/.test(result?.error?.code || '') ? result.error.code : null };
          if (!fs.existsSync(trace) || fs.statSync(trace).size < 120000)
            fs.appendFileSync(trace, JSON.stringify(row) + '\n', { mode: 0o600 });
        } catch { /* Original options, output limits and result are unchanged. */ }
      }
    }
    if (!Array.isArray(args) || !/[\\/]observation[\\/]emit\.mjs$/.test(args[0] || ''))
      return original.apply(this, arguments);
    let emitterKind = 'unknown';
    try {
      const source = fs.readFileSync(args[0], 'utf8');
      emitterKind = source.includes('for await (const chunk of process.stdin)') && source.includes('await appendEvent(process.argv[2], JSON.parse(input))')
        ? 'standard' : 'fixture-replacement';
    } catch { /* Missing source remains unknown. */ }
    const stdio = Array.isArray(options?.stdio) ? options.stdio.slice(0, 3) : ['pipe', 'pipe', 'pipe'];
    const childOptions = { ...options, stdio: [...stdio, 'pipe'],
      env: { ...(options?.env || process.env), OBSERVATION_EMITTER_CHILD: '1' } };
    const started = milliseconds();
    let result, failure;
    try { result = original.call(this, command, args, childOptions); return result; }
    catch (error) { failure = error; throw error; }
    finally {
      const finished = milliseconds();
      try {
        const event = JSON.parse(options.input);
        const safe = (value, pattern) => typeof value === 'string' && pattern.test(value) ? value : null;
        const stages = String(result?.output?.[3] || '').slice(0, MAX_STAGE_BYTES).trim().split('\n').filter(Boolean).flatMap(line => {
          try {
            const value = JSON.parse(line);
            const allowed = /^(?:stage-limit|preload-start|preload-ready|input-start|input-wait-eof|input-first-chunk|input-eof|input-sync-start|input-sync-end|before-exit|exit|(?:owner|write|fsync|rename)-(?:start|end|error)|lock-attempt|lock-acquired)$/;
            if (!allowed.test(value.stage) || !Number.isFinite(value.at)) return [];
            const row = { stage: value.stage, elapsedMs: Math.round((value.at - started) * 100) / 100 };
            for (const key of ['inputBytes', 'chunkCount', 'lastChunkBytes', 'exitCode'])
              if (Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 1048576) row[key] = value[key];
            return [row];
          } catch { return []; }
        }).slice(0, MAX_STAGES);
        const record = {
          durationMs: Math.round((finished - started) * 100) / 100,
          inputBytes: typeof options.input === 'string' || Buffer.isBuffer(options.input) ? Buffer.byteLength(options.input) : null,
          childPid: Number.isSafeInteger(result?.pid) && result.pid > 0 ? result.pid : null,
          status: Number.isInteger(result?.status) ? result.status : null,
          signal: safe(result?.signal, /^SIG[A-Z0-9]{1,16}$/),
          errorCode: safe((failure || result?.error)?.code, /^[A-Z][A-Z0-9_]{0,31}$/),
          operationId: safe(event.operationId, /^[a-f0-9-]{36}$/),
          eventId: safe(event.eventId, /^[a-f0-9-]{36}$/),
          sequence: Number.isSafeInteger(event.sequence) ? event.sequence : null,
          source: safe(event.source, /^(?:codex-hook|claude-hook|guard|check-runner|pr-create|pr-merge|solo-merge|stack)$/),
          phase: safe(event.phase, /^(?:started|finished)$/),
          reasonCode: safe(event.reasonCode, /^[A-Z][A-Z_]{0,63}$/),
          fixtureKind: safe(process.env.OBSERVATION_FIXTURE_KIND, /^(?:guard|structured-stack|intentional-timeout|emitter-error|emitter-timeout|other)$/),
          emitterKind, stagesTruncated: stages.some(row => row.stage === 'stage-limit'), stages,
        };
        if (record.eventId && typeof args[1] === 'string' && path.isAbsolute(args[1]))
          record.eventFilePresent = fs.existsSync(path.join(args[1], `evt-${record.eventId}.json`));
        const line = JSON.stringify(record) + '\n';
        if ((!fs.existsSync(trace) || fs.statSync(trace).size < 120000) && Buffer.byteLength(line) < MAX_STAGE_BYTES + 2048)
          fs.appendFileSync(trace, line, { mode: 0o600 });
      } catch { /* Diagnostics never replace the original result or error. */ }
    }
  };
  syncBuiltinESMExports();
}

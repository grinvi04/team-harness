import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { writeLease, validateEvent } from '../plugins/harness-guard/scripts/observation/event.mjs';

const runnerURL = new URL('../plugins/harness-guard/scripts/observation/run-check.mjs', import.meta.url).href;
const runnerPath = fileURLToPath(runnerURL);
const hash = value => createHash('sha256').update(value).digest('hex');
const isolatedEnv = { ...process.env, HARNESS_OBSERVE_DIR: '', PLUGIN_DATA: '',
  HARNESS_OBSERVE_PARENT: '', HARNESS_OBSERVE_SESSION: '' };
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-run-check-')));
  const repo = path.join(root, 'repo'), dir = path.join(root, 'data');
  fs.mkdirSync(repo, { mode: 0o700 }); fs.mkdirSync(dir, { mode: 0o700 });
  const git = args => {
    const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
  };
  git(['init', '-q']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'fixture']);
  const selection = { repoId: hash(fs.realpathSync(git(['rev-parse', '--path-format=absolute', '--git-common-dir']))), worktreeId: hash(repo) };
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, repo, dir, selection };
}
function activate({ dir, selection }) {
  writeLease(dir, { schemaVersion: 1, viewerId: randomUUID(), ...selection,
    expiresAt: new Date(Date.now() + 30_000).toISOString() });
}
function records(dir) {
  return fs.readdirSync(dir).filter(name => /^evt-.*\.json$/.test(name))
    .map(name => JSON.parse(fs.readFileSync(path.join(dir, name)))).sort((a, b) => a.sequence - b.sequence);
}
function invoke(f, argv, { context = {}, env = {} } = {}) {
  const code = `import {runCheck} from ${JSON.stringify(runnerURL)};
    process.exitCode=await runCheck(JSON.parse(process.argv[1]));`;
  return spawnSync(process.execPath, ['--input-type=module', '-e', code,
    JSON.stringify({ id: 'qa.runner', argv, cwd: f.repo, context: { dataDir: f.dir, ...context } })],
  { env: { ...isolatedEnv, ...env }, timeout: 10_000 });
}
const stdout = Buffer.from([0, 65, 10, 255, 195, 169]);
const stderr = Buffer.from([66, 0, 13, 10, 254]);
function command(f, rc = 0) {
  const counter = path.join(f.root, 'counter');
  const code = `require('node:fs').appendFileSync(${JSON.stringify(counter)},'1');
    process.stdout.write(Buffer.from(${JSON.stringify([...stdout])}));
    process.stderr.write(Buffer.from(${JSON.stringify([...stderr])}));process.exitCode=${rc};`;
  return [process.execPath, '-e', code, 'literal;$(touch should-not-exist)'];
}

test('OFF runs argv exactly once with unchanged output bytes and nonzero exit', t => {
  const f = fixture(t), result = invoke(f, command(f, 23));
  assert.equal(result.status, 23);
  assert.deepEqual(result.stdout, stdout); assert.deepEqual(result.stderr, stderr);
  assert.equal(fs.readFileSync(path.join(f.root, 'counter'), 'utf8'), '1');
  assert.deepEqual(records(f.dir), []);
  assert.equal(fs.existsSync(path.join(f.repo, 'should-not-exist')), false);
});

test('ON records only correlated check-runner start/finish and evidence identifier', t => {
  const f = fixture(t); activate(f);
  const result = invoke(f, command(f), { context: { sessionId: 'fixture-session' } });
  assert.equal(result.status, 0); assert.deepEqual(result.stdout, stdout); assert.deepEqual(result.stderr, stderr);
  assert.equal(fs.readFileSync(path.join(f.root, 'counter'), 'utf8'), '1');
  const events = records(f.dir); assert.equal(events.length, 2);
  assert.ok(events.every(validateEvent));
  assert.deepEqual(events.map(e => [e.source, e.phase, e.outcome]),
    [['check-runner', 'started', 'pending'], ['check-runner', 'finished', 'pass']]);
  assert.equal(events[0].operationId, events[1].operationId);
  assert.equal(events[0].hostSessionId, 'fixture-session');
  assert.equal(events[0].parentOperationId, null);
  assert.equal(events[0].evidenceId, 'qa.runner');
  assert.equal(events[1].evidenceId, 'qa.runner'); assert.equal(events[1].exitCode, 0);
  assert.equal(events[1].reasonCode, 'CHECK_PASSED'); assert.ok(events[1].durationMs >= 0);
  const encoded = JSON.stringify(events);
  assert.equal(encoded.includes('appendFileSync'), false); assert.equal(encoded.includes('literal;'), false);
  for (const e of events) for (const key of ['argv', 'command', 'stdout', 'stderr', 'output', 'env']) assert.equal(key in e, false);
});

test('signal termination returns conventional exit code and a failed check event', t => {
  const f = fixture(t); activate(f);
  const result = invoke(f, [process.execPath, '-e', "process.kill(process.pid,'SIGTERM')"]);
  assert.equal(result.status, 143); assert.equal(result.signal, null);
  const events = records(f.dir); assert.equal(events.length, 2);
  assert.ok(events.every(event => event.evidenceId === 'qa.runner'));
  assert.equal(events[1].outcome, 'fail'); assert.equal(events[1].exitCode, 143);
  assert.equal(events[1].reasonCode, 'CHECK_FAILED');
});

test('nonzero checks retain the same evidence name from started to finished', t => {
  const f = fixture(t); activate(f);
  assert.equal(invoke(f, command(f, 23)).status, 23);
  const events = records(f.dir); assert.equal(events.length, 2);
  assert.ok(events.every(event => event.evidenceId === 'qa.runner'));
  assert.equal(events[0].operationId, events[1].operationId);
  assert.equal(events[1].outcome, 'fail'); assert.equal(events[1].exitCode, 23);
});

test('storage failure preserves actual execution, bytes and failure result', t => {
  const f = fixture(t); activate(f); fs.chmodSync(f.dir, 0o755);
  const result = invoke(f, command(f, 17));
  assert.equal(result.status, 17); assert.deepEqual(result.stdout, stdout);
  assert.deepEqual(result.stderr, stderr);
  assert.equal(fs.readFileSync(path.join(f.root, 'counter'), 'utf8'), '1');
  assert.deepEqual(records(f.dir), []);
});

test('incoming parent is recorded and the child receives its own operation parent', t => {
  const f = fixture(t); activate(f); const parent = randomUUID();
  const result = invoke(f, [process.execPath, '-e', 'process.stdout.write(process.env.HARNESS_OBSERVE_PARENT)'],
    { env: { HARNESS_OBSERVE_PARENT: parent } });
  assert.equal(result.status, 0);
  const events = records(f.dir); assert.equal(events.length, 2);
  assert.equal(events[0].parentOperationId, parent); assert.equal(events[1].parentOperationId, parent);
  assert.equal(result.stdout.toString(), events[0].operationId);
  assert.equal(events[0].hostSessionId, null);
});

test('argv elements are literal and missing executable returns 127 without raw error output', t => {
  const f = fixture(t), literal = 'space ; $(private) * " quote';
  const result = invoke(f, [process.execPath, '-e', 'process.stdout.write(process.argv[1])', literal]);
  assert.equal(result.status, 0); assert.equal(result.stdout.toString(), literal);
  const missing = invoke(f, [path.join(f.root, 'private-command-that-does-not-exist')]);
  assert.equal(missing.status, 127); assert.equal(missing.stdout.length, 0); assert.equal(missing.stderr.length, 0);
});

test('CLI requires --id <safe identifier> -- <argv> and import has no execution', t => {
  const f = fixture(t);
  const options = { cwd: f.repo, env: isolatedEnv };
  const good = spawnSync(process.execPath, [runnerPath, '--id', 'qa.cli', '--', process.execPath, '-e', 'process.exitCode=19'], options);
  assert.equal(good.status, 19);
  for (const args of [[], ['--id', 'qa.cli'], ['--id', 'unsafe id', '--', process.execPath], ['--id', 'qa.cli', '--']]) {
    const bad = spawnSync(process.execPath, [runnerPath, ...args], options);
    assert.equal(bad.status, 2); assert.equal(bad.stdout.length, 0);
  }
  const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(runnerURL)})`], options);
  assert.equal(imported.status, 0); assert.equal(imported.stdout.length, 0); assert.equal(imported.stderr.length, 0);
});

test('OFF does not launch an emitter process', t => {
  const f = fixture(t), marker = path.join(f.root, 'emitter-launched');
  const code = `import cp from 'node:child_process';import fs from 'node:fs';
    import {syncBuiltinESMExports} from 'node:module';
    for(const method of ['spawn','spawnSync']){const original=cp[method];cp[method]=function(file,args,...rest){
      if(file===process.execPath&&args.some(arg=>typeof arg==='string'&&arg.endsWith('/emit.mjs')))
        fs.appendFileSync(${JSON.stringify(marker)},'1');
      return original.call(this,file,args,...rest);};}syncBuiltinESMExports();
    const {runCheck}=await import(${JSON.stringify(runnerURL)});
    process.exitCode=await runCheck({id:'qa.off',argv:[process.execPath,'-e','process.exitCode=11'],
      cwd:${JSON.stringify(f.repo)},context:{dataDir:${JSON.stringify(f.dir)}}});`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code],
    { env: isolatedEnv, timeout: 10_000 });
  assert.equal(result.status, 11); assert.equal(fs.existsSync(marker), false); assert.deepEqual(records(f.dir), []);
});

test('active emitter storage failure leaves command execution and its result unchanged', t => {
  const f = fixture(t); activate(f);
  const corrupt = `evt-${randomUUID()}.json`;
  fs.writeFileSync(path.join(f.dir, corrupt), '{broken', { mode: 0o600 });
  const result = invoke(f, command(f, 29));
  assert.equal(result.status, 29); assert.deepEqual(result.stdout, stdout); assert.deepEqual(result.stderr, stderr);
  assert.equal(fs.readFileSync(path.join(f.root, 'counter'), 'utf8'), '1');
  assert.equal(fs.readFileSync(path.join(f.dir, corrupt), 'utf8'), '{broken');
  assert.deepEqual(fs.readdirSync(f.dir).filter(name => name.startsWith('evt-')), [corrupt]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir, 'writer-loss-v1.json'))), { schemaVersion: 1, lost: true });
});

// Signal the runner PID (not the check PID), as CI cancellation does.
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) for (const capture of ['off', 'on', 'broken'])
  test(`runner cancellation ${signal}/${capture} forwards, waits for cleanup and records failure`, async t => {
    const f = fixture(t), marker = path.join(f.root, 'cleaned');
    if (capture !== 'off') activate(f);
    if (capture === 'broken') fs.writeFileSync(path.join(f.dir, `evt-${randomUUID()}.json`), '{broken', { mode: 0o600 });
    const code = `const fs=require('node:fs');
      process.on(${JSON.stringify(signal)},()=>setTimeout(()=>{
        fs.writeFileSync(${JSON.stringify(marker)},${JSON.stringify(signal)});
        process.stdout.write('cleaned\\n');process.exit(0);
      },75));
      process.stdout.write(JSON.stringify({pid:process.pid})+'\\n');
      process.stderr.write('fixture-stderr\\n');setInterval(()=>{},1000);`;
    const runner = spawn(process.execPath, [runnerPath, '--id', 'qa.cancel', '--', process.execPath, '-e', code],
      { cwd: f.repo, env: { ...isolatedEnv, HARNESS_OBSERVE_DIR: f.dir }, stdio: ['ignore', 'pipe', 'pipe'] });
    let childPid, out = '', err = '';
    runner.stdout.on('data', bytes => { out += bytes; }); runner.stderr.on('data', bytes => { err += bytes; });
    const exited = once(runner, 'exit'), closed = once(runner, 'close');
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('check did not become ready')), 3000);
        const ready = () => {
          const line = out.split('\n')[0]; if (!out.includes('\n')) return;
          try { childPid = JSON.parse(line).pid; clearTimeout(timer); runner.stdout.off('data', ready); resolve(); }
          catch (error) { clearTimeout(timer); reject(error); }
        };
        runner.stdout.on('data', ready); ready();
      });
      assert.equal(runner.kill(signal), true);
      const result = await Promise.race([exited, new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('runner did not terminate')), 4000); timer.unref();
      })]);
      assert.equal(fs.existsSync(marker), true, 'runner exited before the check received the signal and finished cleanup');
      assert.equal(fs.readFileSync(marker, 'utf8'), signal);
      assert.deepEqual(result, [128 + os.constants.signals[signal], null]);
      assert.throws(() => process.kill(childPid, 0), { code: 'ESRCH' }, 'check must already be reaped');
      await closed;
      assert.equal(out, JSON.stringify({ pid: childPid })+'\ncleaned\n');
      assert.equal(err, 'fixture-stderr\n');
      if (capture === 'on') {
        const events = records(f.dir); assert.equal(events.length, 2);
        assert.ok(events.every(validateEvent)); assert.equal(events[1].outcome, 'fail');
        assert.equal(events[1].exitCode, 128 + os.constants.signals[signal]);
        assert.equal(events[1].reasonCode, 'CHECK_FAILED');
        assert.equal(events[0].operationId, events[1].operationId);
      } else if (capture === 'off') assert.deepEqual(records(f.dir), []);
      else assert.ok(fs.existsSync(path.join(f.dir, 'writer-loss-v1.json')));
    } finally {
      if (childPid) try { process.kill(childPid, 'SIGKILL'); } catch { /* Already reaped. */ }
      if (runner.exitCode === null && runner.signalCode === null) runner.kill('SIGKILL');
      await closed;
    }
  });

test('runCheck removes only its own signal listeners after completion and spawn errors', t => {
  const f = fixture(t);
  const code = `import assert from 'node:assert/strict';import {runCheck} from ${JSON.stringify(runnerURL)};
    const signals=['SIGINT','SIGTERM','SIGHUP'];const existing=()=>{};
    for(const signal of signals)process.on(signal,existing);
    const baseline=signals.map(signal=>process.listenerCount(signal));
    for(const argv of [[process.execPath,'-e','process.exitCode=17'],[${JSON.stringify('/fixture-does-not-exist')}]]){
      await runCheck({id:'qa.listeners',argv,cwd:${JSON.stringify(f.repo)}});
      assert.deepEqual(signals.map(signal=>process.listenerCount(signal)),baseline);
      for(const signal of signals)assert.ok(process.listeners(signal).includes(existing));
    }`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { env: isolatedEnv, timeout: 10_000 });
  assert.equal(result.status, 0, result.stderr.toString());
});

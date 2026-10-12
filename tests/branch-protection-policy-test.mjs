import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const helper = path.join(root, 'plugins/harness-guard/scripts/branch-protection-policy.mjs');
const cli = path.join(root, 'plugins/harness-guard/scripts/set-branch-protection.sh');
// GET shape observed on GitHub, with synthetic contexts/app IDs and no credentials.
const original = () => ({
  required_status_checks: { strict: true, contexts: ['quality', 'security'],
    checks: [{ context: 'quality', app_id: 42 }, { context: 'security', app_id: 91 }] },
  required_pull_request_reviews: { required_approving_review_count: 2,
    dismiss_stale_reviews: true, require_code_owner_reviews: true, require_last_push_approval: true },
  restrictions: null, required_signatures: { enabled: true },
  enforce_admins: { enabled: true }, required_linear_history: { enabled: true },
  allow_force_pushes: { enabled: false }, allow_deletions: { enabled: false },
  block_creations: { enabled: false }, required_conversation_resolution: { enabled: true },
  lock_branch: { enabled: false }, allow_fork_syncing: { enabled: false },
});
function fixture(t, value = original()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-policy-api-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'original.json'), contexts = path.join(dir, 'contexts.json');
  const output = path.join(dir, 'plan.json');
  fs.writeFileSync(input, JSON.stringify(value));
  fs.writeFileSync(contexts, JSON.stringify(['quality']));
  return { dir, input, output, contexts,
    run: (mode, ...args) => spawnSync(process.execPath, [helper, mode, input, ...args], { encoding: 'utf8' }) };
}
function readback(plan) {
  const response = structuredClone(plan);
  for (const key of Object.keys(response)) {
    if (typeof response[key] === 'boolean') response[key] = { enabled: response[key] };
  }
  response.required_signatures = { enabled: true };
  return response;
}
for (const enabled of [true, false]) {
  test(`GET block_creations=${enabled} is read and preserved in plan`, t => {
    const value = original(); value.block_creations.enabled = enabled;
    const f = fixture(t, value);
    assert.equal(f.run('validate').status, 0);
    const result = f.run('plan', f.contexts, '', f.output);
    assert.equal(result.status, 0, result.stderr);
    const planned = JSON.parse(fs.readFileSync(f.output));
    assert.equal(planned.block_creations, enabled);
    assert.deepEqual(planned.required_status_checks, value.required_status_checks);
    assert.deepEqual(planned.required_pull_request_reviews, value.required_pull_request_reviews);
    assert.equal(planned.required_linear_history, true);
    assert.equal(planned.enforce_admins, true);
    assert.equal(planned.allow_force_pushes, false);
    assert.equal(planned.allow_deletions, false);
    const after = path.join(f.dir, 'after.json');
    fs.writeFileSync(after, JSON.stringify(readback(planned)));
    assert.equal(f.run('verify', after, f.output).status, 0);
    const drift = readback(planned); drift.block_creations.enabled = !enabled;
    fs.writeFileSync(after, JSON.stringify(drift));
    assert.match(f.run('verify', after, f.output).stderr, /postcondition policy mismatch/);
  });
}
test('missing review key reads as no reviews and preserves no-review plan', t => {
  const value = original(); delete value.required_pull_request_reviews;
  const f = fixture(t, value);
  assert.equal(f.run('validate').status, 0);
  const result = f.run('plan', f.contexts, '', f.output);
  assert.equal(result.status, 0, result.stderr);
  const planned = JSON.parse(fs.readFileSync(f.output));
  assert.equal(planned.required_pull_request_reviews, null);
  const after = path.join(f.dir, 'after.json'), response = readback(planned);
  delete response.required_pull_request_reviews;
  fs.writeFileSync(after, JSON.stringify(response));
  assert.equal(f.run('verify', after, f.output).status, 0);
});
test('null GET app binding reads but cannot produce a PUT plan', t => {
  const value = original(); value.required_status_checks.checks[1].app_id = null;
  const f = fixture(t, value);
  const read = f.run('validate'); assert.equal(read.status, 0, read.stderr);
  const planned = f.run('plan', f.contexts, '', f.output);
  assert.equal(planned.status, 1);
  assert.match(planned.stderr, /null check app binding.*write/);
  assert.equal(fs.existsSync(f.output), false);
});
for (const appId of [42, -1]) {
  test(`integer app binding ${appId} remains exact and drift is rejected`, t => {
    const value = original(); value.required_status_checks.checks[0].app_id = appId;
    const f = fixture(t, value);
    assert.equal(f.run('plan', f.contexts, '', f.output).status, 0);
    const planned = JSON.parse(fs.readFileSync(f.output));
    assert.equal(planned.required_status_checks.checks[0].app_id, appId);
    const response = readback(planned); response.required_status_checks.checks[0].app_id = null;
    const after = path.join(f.dir, 'after.json'); fs.writeFileSync(after, JSON.stringify(response));
    const result = f.run('verify', after, f.output);
    assert.equal(result.status, 1); assert.match(result.stderr, /postcondition policy mismatch/);
  });
}
test('legacy response without block field and with null reviews remains supported', t => {
  const value = original(); delete value.block_creations; value.required_pull_request_reviews = null;
  const f = fixture(t, value); assert.equal(f.run('plan', f.contexts, '', f.output).status, 0);
  const planned = JSON.parse(fs.readFileSync(f.output));
  assert.equal('block_creations' in planned, false);
  assert.equal(planned.required_pull_request_reviews, null);
});
const malformed = [
  ['unknown policy', d => { d.future_policy = { enabled: true }; }],
  ['unknown block setting', d => { d.block_creations.future = true; }],
  ['nonboolean block setting', d => { d.block_creations.enabled = 'false'; }],
  ['malformed block object', d => { d.block_creations = null; }],
  ['invalid string app binding', d => { d.required_status_checks.checks[0].app_id = '42'; }],
  ['invalid negative app binding', d => { d.required_status_checks.checks[0].app_id = -2; }],
  ['malformed review object', d => { d.required_pull_request_reviews = {}; }],
  ['unknown review setting', d => { d.required_pull_request_reviews.future = true; }],
];
for (const [label, mutate] of malformed) {
  test(`${label} is refused before plan output`, t => {
    const value = original(); mutate(value); const f = fixture(t, value);
    assert.equal(f.run('validate').status, 1);
    assert.equal(f.run('plan', f.contexts, '', f.output).status, 1);
    assert.equal(fs.existsSync(f.output), false);
  });
}
for (const flag of ['--check', '--preview', 'apply']) {
  test(`CLI ${flag} with null binding and missing reviews makes zero API writes`, t => {
    const value = original(); delete value.required_pull_request_reviews;
    value.required_status_checks.checks[1].app_id = null;
    const f = fixture(t, value), bin = path.join(f.dir, 'bin'), calls = path.join(f.dir, 'calls');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env python3
import json,os,sys
args=sys.argv[1:]; endpoint=args[1]
method=args[args.index('-X')+1] if '-X' in args else 'GET'
with open(os.environ['POLICY_CALLS'],'a') as out: out.write(method+' '+endpoint+'\\n')
if method!='GET': sys.exit(98)
if '/rulesets' in endpoint: print('[]')
elif endpoint.endswith('/protection'): print(open(os.environ['POLICY_INPUT']).read())
else: print('{}')
`, { mode: 0o755 });
    const result = spawnSync('bash', [cli, 'o/r', '--branches', 'main', '--contexts', 'quality,security',
      ...(flag === 'apply' ? [] : [flag])], { encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, POLICY_INPUT: f.input, POLICY_CALLS: calls } });
    assert.equal(result.status, flag === '--check' ? 0 : 1, result.stdout + result.stderr);
    if (flag === '--check') assert.match(result.stdout, /승인0/);
    else assert.match(result.stderr, /null check app binding.*write/);
    const methods = fs.readFileSync(calls, 'utf8').trim().split('\n').map(line => line.split(' ')[0]);
    assert.ok(methods.length > 0); assert.ok(methods.every(method => method === 'GET'));
  });
}

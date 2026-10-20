// Real wrapper/policy, fake Git/GitHub effects: no remote operations are performed.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { selectPrBase } from '../plugins/harness-guard/scripts/repo-policy.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wrapper = path.join(root, 'plugins/harness-guard/scripts/pr-create.sh')
const policyScript = path.join(root, 'plugins/harness-guard/scripts/repo-policy.mjs')
const policy = branchFlow => ({ schemaVersion: 1, mode: 'company', autoMergeTargets: [], branchFlow })
function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'pr-base-selection-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const repo = path.join(directory, 'repo'), bin = path.join(directory, 'bin'), stateFile = path.join(directory, 'state.json')
  fs.mkdirSync(repo); fs.mkdirSync(bin)
  const state = { branch: 'fix/selected', heads: ['main', 'develop'], calls: [], ...options }
  if (state.policy !== undefined) fs.writeFileSync(path.join(repo, '.harness-policy.json'), typeof state.policy === 'string' ? state.policy : JSON.stringify(state.policy))
  fs.writeFileSync(stateFile, JSON.stringify(state))
  const program = `#!${process.execPath}
const fs = require('node:fs');
const a = process.argv.slice(2), tool = require('node:path').basename(process.argv[1]);
const s = JSON.parse(fs.readFileSync(process.env.PR_BASE_STATE, 'utf8'));
s.calls.push({ tool, args: a }); fs.writeFileSync(process.env.PR_BASE_STATE, JSON.stringify(s));
if (tool === 'gh') { if (a[0] === 'pr' && a[1] === 'create') { console.log('fixture PR'); process.exit(0); } process.exit(99); }
if (a[0] === 'rev-parse' && a[1] === '--show-toplevel') console.log(process.cwd());
else if (a[0] === 'branch') console.log(s.branch);
else if (a[0] === 'status') { if (s.statusFail) process.exit(128); console.log(s.dirty || ''); }
else if (a[0] === 'check-ref-format') console.log(a[2]);
else if (a[0] === 'ls-remote') {
  if (s.queryFail) process.exit(128);
  const selected = a.find(x => x.startsWith('refs/heads/'));
  const heads = selected ? s.heads.filter(x => 'refs/heads/' + x === selected) : s.heads;
  if (!heads.length && a.includes('--exit-code')) process.exit(2);
  console.log(s.malformedRemote ? 'malformed remote ref' : heads.map(x => 'a'.repeat(40) + '\\trefs/heads/' + x).join('\\n'));
} else if (a[0] === 'show-ref') process.exit(0); // Simulate stale local develop.
else if (a[0] === 'symbolic-ref') console.log('origin/main');
else if (a[0] !== 'push') process.exit(99);
`
  for (const tool of ['git', 'gh']) fs.writeFileSync(path.join(bin, tool), program, { mode: 0o755 })
  const env = { ...process.env, PATH: bin + path.delimiter + process.env.PATH, PR_BASE_STATE: stateFile }
  return {
    repo, env,
    run: args => spawnSync('bash', [wrapper, '--title', 'fixture title', '--body', 'fixture body', ...args], { cwd: repo, env, encoding: 'utf8' }),
    calls: () => JSON.parse(fs.readFileSync(stateFile, 'utf8')).calls,
  }
}
function rejected(f, result) {
  assert.notEqual(result.status, 0, result.stdout + result.stderr)
  assert.equal(f.calls().some(call => call.tool === 'git' && call.args[0] === 'push'), false, 'no push on rejection')
  assert.equal(f.calls().some(call => call.tool === 'gh'), false, 'no GitHub mutation on rejection')
}
for (const scenario of [
  { name: 'explicit main without policy', args: ['--base', 'main'], base: 'main' },
  { name: 'declared GitFlow', policy: policy('git-flow'), args: [], base: 'develop' },
  { name: 'main flow ignores stale develop', policy: policy('main'), args: [], base: 'main' },
  { name: 'explicit same declared base', policy: policy('main'), args: ['--base', 'main'], base: 'main' },
  { name: 'explicit custom base without policy', args: ['--base', 'trunk'], heads: ['trunk', 'develop'], base: 'trunk' },
  { name: 'GitFlow release to main', policy: policy('git-flow'), branch: 'release/v1.2.3', args: ['--base', 'main'], base: 'main' },
  { name: 'GitFlow hotfix to main', policy: policy('git-flow'), branch: 'hotfix/urgent', args: ['--base', 'main'], base: 'main' },
]) test(`selected base: ${scenario.name}`, t => {
  const f = fixture(t, scenario), result = f.run(scenario.args)
  assert.equal(result.status, 0, result.stderr)
  const calls = f.calls(), creation = calls.find(call => call.tool === 'gh')
  assert.equal(creation.args[creation.args.indexOf('--base') + 1], scenario.base)
  const query = calls.findIndex(call => call.tool === 'git' && call.args[0] === 'ls-remote')
  const push = calls.findIndex(call => call.tool === 'git' && call.args[0] === 'push')
  assert.ok(query >= 0 && query < push, 'exact live base must be read before push')
  assert.deepEqual(calls[query].args, ['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${scenario.base}`])
})

for (const scenario of [
  { name: 'explicit conflict', policy: policy('git-flow'), args: ['--base', 'main'] },
  { name: 'main policy conflict', policy: policy('main'), args: ['--base', 'develop'] },
  { name: 'missing policy and base', args: [] },
  { name: 'policy without branch declaration', policy: { schemaVersion: 1, mode: 'company', autoMergeTargets: [] }, args: [] },
  { name: 'query failure with explicit base', queryFail: true, args: ['--base', 'main'] },
  { name: 'query failure with declared base', policy: policy('main'), queryFail: true, args: [] },
  { name: 'missing selected remote base', heads: ['develop'], args: ['--base', 'main'] },
  { name: 'malformed remote response', malformedRemote: true, args: ['--base', 'main'] },
  { name: 'same custom base and head', branch: 'trunk', heads: ['trunk'], args: ['--base', 'trunk'] },
  { name: 'unknown branch flow', policy: policy('unknown'), args: ['--base', 'main'] },
  { name: 'invalid policy JSON', policy: '{broken', args: ['--base', 'main'] },
  { name: 'unknown policy key', policy: { ...policy('main'), unexpected: true }, args: ['--base', 'main'] },
  { name: 'GitFlow release requires explicit main', policy: policy('git-flow'), branch: 'release/v1.2.3', args: [] },
  { name: 'GitFlow hotfix requires explicit main', policy: policy('git-flow'), branch: 'hotfix/urgent', args: [] },
  { name: 'GitFlow release refuses explicit develop', policy: policy('git-flow'), branch: 'release/v1.2.3', args: ['--base', 'develop'] },
  { name: 'GitFlow hotfix refuses explicit develop', policy: policy('git-flow'), branch: 'hotfix/urgent', args: ['--base', 'develop'] },
  { name: 'status query failure', statusFail: true, args: ['--base', 'main'] },
  { name: 'empty explicit base', policy: policy('main'), args: ['--base', ''] },
  { name: 'repeated explicit base', args: ['--base', 'main', '--base', 'develop'] },
]) test(`no mutation: ${scenario.name}`, t => {
  const f = fixture(t, scenario)
  rejected(f, f.run(scenario.args))
})

test('base validation rejects invalid or expanding branch syntax with real Git', () => {
  for (const explicitBase of ['--help', 'HEAD', '@{-1}', 'bad branch', 'bad..branch', 'bad//branch', 'bad\nbranch', 'refs/heads/']) {
    assert.throws(() => selectPrBase({ policy: {}, explicitBase, branch: 'fix/work' }), /invalid PR base/, explicitBase)
  }
  assert.equal(selectPrBase({ policy: {}, explicitBase: 'team/trunk', branch: 'fix/work' }), 'team/trunk')
})

test('optional branch flow preserves existing company, solo and auto policy meanings', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-base-policy-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const run = (action, base) => spawnSync(process.execPath, [policyScript, directory, action, ...(base ? [base] : [])], { encoding: 'utf8' })
  const set = value => fs.writeFileSync(path.join(directory, '.harness-policy.json'), JSON.stringify(value))
  assert.equal(run('solo').status, 1)
  set({ ...policy('git-flow'), mode: 'solo', autoMergeTargets: ['develop'] })
  assert.equal(run('solo').status, 0)
  assert.equal(run('auto', 'develop').status, 0)
  assert.equal(run('auto', 'main').status, 1)
  set({ ...policy('main'), mode: 'company' })
  assert.equal(run('solo').status, 1)
  assert.equal(run('auto', 'develop').status, 1)
  set({ ...policy('main'), mode: 'solo', autoMergeTargets: ['main'] })
  assert.equal(run('solo').status, 1)
})

// Opt-in must not silently change ordinary PR destinations or solo/auto eligibility.
test('stack opt-in preserves ordinary trunk selection and refuses raw parent base', t => {
  const p = { ...policy('git-flow'), stackedPRs: { enabled: true, provider: 'github-gh-stack' } }
  const f = fixture(t, { policy: p })
  const result = f.run([])
  assert.equal(result.status, 0, result.stderr)
  assert.equal(f.calls().find(x => x.tool === 'gh').args[3], 'develop')
  const raw = fixture(t, { policy: p, heads: ['develop', 'codex/parent'] })
  rejected(raw, raw.run(['--base', 'codex/parent']))
})
for (const stackedPRs of [null, false, [], {}, { enabled: false, provider: 'github-gh-stack' },
  { enabled: true, provider: 'other' }, { enabled: true, provider: 'github-gh-stack', trunk: 'main' }]) {
  test(`invalid stack declaration cannot permit a push: ${JSON.stringify(stackedPRs)}`, t => {
    const f = fixture(t, { policy: { ...policy('git-flow'), stackedPRs } })
    rejected(f, f.run([]))
  })
}
test('stack opt-in requires an explicit supported branch flow', t => {
  const f = fixture(t, { policy: { schemaVersion: 1, mode: 'company', autoMergeTargets: [],
    stackedPRs: { enabled: true, provider: 'github-gh-stack' } } })
  rejected(f, f.run(['--base', 'develop']))
})

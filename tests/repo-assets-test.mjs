import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../scripts/manage-repo-assets.mjs', import.meta.url))
const hash = value => createHash('sha256').update(value).digest('hex')
function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } }).trim()
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'repo-assets-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const source = path.join(root, 'source'), repo = path.join(root, 'app')
  for (const dir of [source, repo]) {
    fs.mkdirSync(dir)
    git(dir, 'init', '-q')
    git(dir, 'config', 'user.email', 'fixture@example.invalid')
    git(dir, 'config', 'user.name', 'Fixture')
  }
  fs.mkdirSync(path.join(source, 'assets'))
  fs.writeFileSync(path.join(source, 'assets/check.sh'), '#!/bin/sh\necho first\n', { mode: 0o755 })
  fs.writeFileSync(path.join(source, 'assets/rule.md'), 'first rule\n')
  git(source, 'add', '.')
  git(source, '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture first')
  git(source, 'tag', 'v1.0.0')
  const revision = git(source, 'rev-parse', 'HEAD')
  fs.mkdirSync(path.join(repo, '.githooks'))
  fs.writeFileSync(path.join(repo, '.githooks/pre-commit'), 'original product check\n')
  fs.writeFileSync(path.join(repo, 'package.json'), '{"scripts":{"test":"company test"}}\n')
  git(repo, 'config', 'core.hooksPath', '.githooks')
  const plan = path.join(root, 'plan.json')
  const assets = [{ source: 'assets/check.sh', destination: 'checks/harness.sh' }, { source: 'assets/rule.md', destination: 'docs/harness-rule.md' }]
  fs.writeFileSync(plan, JSON.stringify({ assets }))
  const args = action => [action, '--repo', repo, '--source', source, '--revision', revision, '--version', 'v1.0.0', '--plan', plan]
  const run = (action, extra = []) => spawnSync(process.execPath, [cli, ...args(action), ...extra], { encoding: 'utf8' })
  return { root, source, repo, revision, plan, assets, args, run }
}
function snapshot(root) {
  const result = {}
  function visit(dir, relative = '') {
    for (const entry of fs.readdirSync(dir).sort()) {
      const rel = path.join(relative, entry), file = path.join(dir, entry), stat = fs.lstatSync(file)
      if (stat.isDirectory()) { result[rel] = 'directory'; visit(file, rel) }
      else if (stat.isSymbolicLink()) result[rel] = `link:${fs.readlinkSync(file)}`
      else result[rel] = `${stat.mode & 0o777}:${hash(fs.readFileSync(file))}`
    }
  }
  visit(root)
  return result
}
function ok(result) { assert.equal(result.status, 0, result.stderr) }
function rejected(result, pattern) { assert.equal(result.status, 2, result.stderr); assert.match(result.stderr, pattern) }

test('preview leaves all repository bytes, modes, config and directories unchanged', t => {
  const f = fixture(t), before = snapshot(f.repo), sourceBefore = snapshot(f.source)
  ok(f.run('apply'))
  assert.deepEqual(snapshot(f.repo), before)
  assert.deepEqual(snapshot(f.source), sourceBefore)
})
test('pinned apply records SHA, tag, hashes and modes; repeat is byte-idempotent', t => {
  const f = fixture(t)
  ok(f.run('apply', ['--apply']))
  const state = JSON.parse(fs.readFileSync(path.join(f.repo, '.harness-assets.json')))
  assert.equal(state.source.sha, f.revision)
  assert.equal(state.source.version, 'v1.0.0')
  assert.equal(state.assets[0].hash, hash(fs.readFileSync(path.join(f.source, f.assets[0].source))))
  assert.equal(fs.statSync(path.join(f.repo, 'checks/harness.sh')).mode & 0o777, 0o755)
  const before = snapshot(f.repo)
  ok(f.run('apply', ['--apply']))
  assert.deepEqual(snapshot(f.repo), before)
})
test('update uses recorded baseline while source advances; remove preserves product flow', t => {
  const f = fixture(t)
  ok(f.run('apply', ['--apply']))
  fs.writeFileSync(path.join(f.source, 'assets/check.sh'), '#!/bin/sh\necho second\n')
  git(f.source, 'add', '.')
  git(f.source, '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture second')
  git(f.source, 'tag', 'v2.0.0')
  const next = git(f.source, 'rev-parse', 'HEAD')
  const args = f.args('update').map(arg => arg === f.revision ? next : arg === 'v1.0.0' ? 'v2.0.0' : arg)
  ok(spawnSync(process.execPath, [cli, ...args, '--apply'], { encoding: 'utf8' }))
  assert.match(fs.readFileSync(path.join(f.repo, 'checks/harness.sh'), 'utf8'), /second/)
  const foreignBefore = { config: fs.readFileSync(path.join(f.repo, '.git/config')), hook: fs.readFileSync(path.join(f.repo, '.githooks/pre-commit')), pkg: fs.readFileSync(path.join(f.repo, 'package.json')) }
  ok(spawnSync(process.execPath, [cli, ...args.map(arg => arg === 'update' ? 'remove' : arg), '--apply'], { encoding: 'utf8' }))
  assert.equal(fs.existsSync(path.join(f.repo, '.harness-assets.json')), false)
  assert.equal(fs.existsSync(path.join(f.repo, 'checks/harness.sh')), false)
  assert.deepEqual(fs.readFileSync(path.join(f.repo, '.git/config')), foreignBefore.config)
  assert.deepEqual(fs.readFileSync(path.join(f.repo, '.githooks/pre-commit')), foreignBefore.hook)
  assert.deepEqual(fs.readFileSync(path.join(f.repo, 'package.json')), foreignBefore.pkg)
})
for (const action of ['apply', 'update', 'remove']) test(`${action} refuses modified managed asset before any mutation`, t => {
  const f = fixture(t)
  ok(f.run('apply', ['--apply']))
  fs.writeFileSync(path.join(f.repo, 'docs/harness-rule.md'), 'user edit\n')
  const before = snapshot(f.repo)
  rejected(f.run(action, ['--apply']), /modified/)
  assert.deepEqual(snapshot(f.repo), before)
})
test('foreign destination is refused even with identical bytes', t => {
  const f = fixture(t)
  fs.mkdirSync(path.join(f.repo, 'docs'))
  fs.copyFileSync(path.join(f.source, 'assets/rule.md'), path.join(f.repo, 'docs/harness-rule.md'))
  const before = snapshot(f.repo)
  rejected(f.run('apply', ['--apply']), /unowned/)
  assert.deepEqual(snapshot(f.repo), before)
})
for (const destination of ['../escape', '/tmp/escape', '.git/config', '.harness-assets.json', 'checks/../escape', 'checks\\escape']) test(`rejects unsafe path ${destination}`, t => {
  const f = fixture(t)
  fs.writeFileSync(f.plan, JSON.stringify({ assets: [{ source: 'assets/rule.md', destination }] }))
  const before = snapshot(f.repo)
  rejected(f.run('apply', ['--apply']), /path/)
  assert.deepEqual(snapshot(f.repo), before)
})
test('rejects destination symlink and source symlink without following either', t => {
  const f = fixture(t)
  fs.symlinkSync(f.root, path.join(f.repo, 'checks'))
  rejected(f.run('apply', ['--apply']), /symlink/)
  fs.unlinkSync(path.join(f.repo, 'checks'))
  fs.symlinkSync('rule.md', path.join(f.source, 'assets/link.md'))
  git(f.source, 'add', '.')
  git(f.source, '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'symlink fixture')
  const next = git(f.source, 'rev-parse', 'HEAD')
  fs.writeFileSync(f.plan, JSON.stringify({ assets: [{ source: 'assets/link.md', destination: 'docs/link.md' }] }))
  const args = f.args('apply').filter((arg, i, all) => arg !== '--version' && all[i - 1] !== '--version').map(arg => arg === f.revision ? next : arg)
  rejected(spawnSync(process.execPath, [cli, ...args, '--apply'], { encoding: 'utf8' }), /symlink/)
})
test('rejects dirty source, wrong pin, moved tag and untracked asset', t => {
  const f = fixture(t)
  rejected(f.run('apply', ['--revision', 'a'.repeat(40)]), /argument|pin|revision/)
  fs.writeFileSync(path.join(f.source, 'assets/rule.md'), 'dirty\n')
  rejected(f.run('apply', ['--apply']), /clean/)
  git(f.source, 'restore', 'assets/rule.md')
  const args = f.args('apply').map(arg => arg === f.revision ? 'a'.repeat(40) : arg)
  rejected(spawnSync(process.execPath, [cli, ...args, '--apply'], { encoding: 'utf8' }), /pin|revision/)
  fs.writeFileSync(path.join(f.source, '.gitignore'), 'ignored.md\n')
  git(f.source, 'add', '.')
  git(f.source, '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'ignore fixture')
  const next = git(f.source, 'rev-parse', 'HEAD')
  const nextArgs = f.args('apply').map(arg => arg === f.revision ? next : arg)
  rejected(spawnSync(process.execPath, [cli, ...nextArgs], { encoding: 'utf8' }), /tag|version/)
  fs.writeFileSync(path.join(f.source, 'ignored.md'), 'ignored\n')
  fs.writeFileSync(f.plan, JSON.stringify({ assets: [{ source: 'ignored.md', destination: 'docs/ignored.md' }] }))
  rejected(spawnSync(process.execPath, [cli, ...nextArgs.filter((arg, i, all) => arg !== '--version' && all[i - 1] !== '--version')], { encoding: 'utf8' }), /tracked/)
})
test('write failure rolls back new files, directories and ownership manifest', async t => {
  const f = fixture(t), before = snapshot(f.repo)
  const { manageRepoAssets } = await import('../scripts/manage-repo-assets.mjs')
  let count = 0
  assert.throws(() => manageRepoAssets({ action: 'apply', repo: f.repo, source: f.source, revision: f.revision, version: 'v1.0.0', plan: f.plan, apply: true }, {
    writeFileSync(...args) { if (++count === 3) throw new Error('simulated disk write failure'); return fs.writeFileSync(...args) },
  }), /simulated disk write failure/)
  assert.deepEqual(snapshot(f.repo), before)
})
for (const action of ['update', 'remove']) test(`${action} preview preserves all bytes and modes`, t => {
  const f = fixture(t)
  ok(f.run('apply', ['--apply']))
  const before = snapshot(f.repo)
  ok(f.run(action))
  assert.deepEqual(snapshot(f.repo), before)
})
for (const action of ['update', 'remove']) test(`${action} commit failure restores replaced files and existing manifest`, async t => {
  const f = fixture(t)
  ok(f.run('apply', ['--apply']))
  fs.writeFileSync(path.join(f.source, 'assets/check.sh'), '#!/bin/sh\necho changed\n')
  git(f.source, 'add', '.')
  git(f.source, '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'changed fixture')
  const next = git(f.source, 'rev-parse', 'HEAD')
  const before = snapshot(f.repo)
  const { manageRepoAssets } = await import('../scripts/manage-repo-assets.mjs')
  let count = 0
  const io = action === 'update' ? {
    renameSync(...args) { if (++count === 2) throw new Error('simulated commit failure'); return fs.renameSync(...args) },
  } : {
    unlinkSync(...args) { if (++count === 2) throw new Error('simulated commit failure'); return fs.unlinkSync(...args) },
  }
  assert.throws(() => manageRepoAssets({ action, repo: f.repo, source: f.source, revision: next, plan: f.plan, apply: true }, io), /simulated commit failure/)
  assert.deepEqual(snapshot(f.repo), before)
})
test('preflights all source assets before creating any destination', t => {
  const f = fixture(t)
  f.assets[1].source = 'assets/missing.md'
  fs.writeFileSync(f.plan, JSON.stringify({ assets: f.assets }))
  const before = snapshot(f.repo)
  rejected(f.run('apply', ['--apply']), /missing/)
  assert.deepEqual(snapshot(f.repo), before)
})
test('managed mode change and missing file are conflicts', t => {
  const f = fixture(t)
  ok(f.run('apply', ['--apply']))
  fs.chmodSync(path.join(f.repo, 'checks/harness.sh'), 0o644)
  rejected(f.run('update', ['--apply']), /modified/)
  fs.chmodSync(path.join(f.repo, 'checks/harness.sh'), 0o755)
  fs.unlinkSync(path.join(f.repo, 'docs/harness-rule.md'))
  rejected(f.run('remove', ['--apply']), /modified/)
})
test('rejects ownership symlink, malformed state and changed selection', t => {
  const f = fixture(t)
  fs.symlinkSync(f.plan, path.join(f.repo, '.harness-assets.json'))
  rejected(f.run('apply', ['--apply']), /symlink/)
  fs.unlinkSync(path.join(f.repo, '.harness-assets.json'))
  fs.writeFileSync(path.join(f.repo, '.harness-assets.json'), '{"schemaVersion":1}')
  rejected(f.run('apply', ['--apply']), /ownership/)
  fs.unlinkSync(path.join(f.repo, '.harness-assets.json'))
  ok(f.run('apply', ['--apply']))
  fs.writeFileSync(f.plan, JSON.stringify({ assets: f.assets.slice(0, 1) }))
  const before = snapshot(f.repo)
  rejected(f.run('update', ['--apply']), /recorded destinations/)
  assert.deepEqual(snapshot(f.repo), before)
})
test('detects a destination edit during staging and preserves the concurrent edit', async t => {
  const f = fixture(t)
  ok(f.run('apply', ['--apply']))
  fs.writeFileSync(path.join(f.source, 'assets/check.sh'), '#!/bin/sh\necho changed\n')
  git(f.source, 'add', '.')
  git(f.source, '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'changed fixture')
  const next = git(f.source, 'rev-parse', 'HEAD')
  const manifest = fs.readFileSync(path.join(f.repo, '.harness-assets.json'))
  const { manageRepoAssets } = await import('../scripts/manage-repo-assets.mjs')
  let changed = false
  assert.throws(() => manageRepoAssets({ action: 'update', repo: f.repo, source: f.source, revision: next, plan: f.plan, apply: true }, {
    writeFileSync(...args) {
      const result = fs.writeFileSync(...args)
      if (!changed) { fs.writeFileSync(path.join(f.repo, 'checks/harness.sh'), 'concurrent edit\n'); changed = true }
      return result
    },
  }), /changed during/)
  assert.equal(fs.readFileSync(path.join(f.repo, 'checks/harness.sh'), 'utf8'), 'concurrent edit\n')
  assert.deepEqual(fs.readFileSync(path.join(f.repo, '.harness-assets.json')), manifest)
  assert.equal(fs.readdirSync(path.join(f.repo, 'checks')).length, 1)
})
test('refuses asset destinations inside a nested Git repository', t => {
  const f = fixture(t)
  fs.mkdirSync(path.join(f.repo, 'checks'))
  git(path.join(f.repo, 'checks'), 'init', '-q')
  const before = snapshot(f.repo)
  rejected(f.run('apply', ['--apply']), /nested/)
  assert.deepEqual(snapshot(f.repo), before)
})
for (const destinations of [
  ['checks/A.sh', 'checks/a.sh'],
  ['Checks', 'checks/child.sh'],
  ['checks/caf\u00e9.sh', 'checks/cafe\u0301.sh'],
]) test(`rejects normalized destination aliases ${destinations.join(',')}`, t => {
  const f = fixture(t)
  fs.writeFileSync(f.plan, JSON.stringify({ assets: f.assets.map((asset, index) => ({ ...asset, destination: destinations[index] })) }))
  const before = snapshot(f.repo)
  rejected(f.run('apply', ['--apply']), /duplicate|overlapping/)
  assert.deepEqual(snapshot(f.repo), before)
})
for (const destination of ['.HARNESS-ASSETS.JSON', '.HARNESS-ASSETS.JSON/child', '.GiT/config']) test(`rejects case-folded reserved destination ${destination}`, t => {
  const f = fixture(t)
  fs.writeFileSync(f.plan, JSON.stringify({ assets: [{ source: 'assets/rule.md', destination }] }))
  const before = snapshot(f.repo)
  rejected(f.run('apply', ['--apply']), /unsafe asset path/)
  assert.deepEqual(snapshot(f.repo), before)
})
for (const action of ['apply', 'update', 'remove']) test(`${action} rejects aliases in an existing ownership record`, t => {
  const f = fixture(t)
  ok(f.run('apply', ['--apply']))
  const stateFile = path.join(f.repo, '.harness-assets.json')
  const state = JSON.parse(fs.readFileSync(stateFile))
  state.assets.push({ ...state.assets[0], destination: state.assets[0].destination.toUpperCase() })
  fs.writeFileSync(stateFile, JSON.stringify(state))
  const before = snapshot(f.repo)
  rejected(f.run(action, ['--apply']), /duplicate|overlapping/)
  assert.deepEqual(snapshot(f.repo), before)
})

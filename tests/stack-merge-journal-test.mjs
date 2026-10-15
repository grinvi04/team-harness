import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setImmediate as yieldTurn } from 'node:timers/promises'
import { reserve, load, save, finish } from '../plugins/harness-guard/scripts/stack-merge-journal.mjs'

const moduleUrl = new URL('../plugins/harness-guard/scripts/stack-merge-journal.mjs', import.meta.url).href
function snapshot(extra = {}) {
  return { kind: 'stack', repo: 'org/repo', pr: 11, trunk: 'develop', trunkOid: 'a'.repeat(40),
    headOid: 'b'.repeat(40), headBranch: 'codex/a', stackNumber: 13,
    members: [{ number: 11, headOid: 'b'.repeat(40) }], fingerprint: 'reviewed-candidate', ...extra }
}
function sandbox(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-journal-test-'))
  fs.chmodSync(root, 0o700)
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return root
}
const actualPath = (dir, file) => path.resolve(dir, file)
function update(dir, journal, changes) {
  const data = { ...load(dir, journal.file), ...changes }
  save(dir, journal.file, data)
  return data
}
function assertActive(dir, journal) {
  assert.equal(fs.existsSync(actualPath(dir, journal.file)), true)
  assert.throws(() => reserve(dir, snapshot({ pr: 12, headBranch: 'codex/b', worktree: '/another-writer' })))
}
function assertArchived(dir, journal, result) {
  assert.equal(result.released, true)
  assert.equal(fs.existsSync(actualPath(dir, journal.file)), false)
  const files = fs.readdirSync(dir, { recursive: true }).map(name => path.join(dir, name))
    .filter(file => fs.lstatSync(file).isFile())
  const records = files.flatMap(file => { try { return [JSON.parse(fs.readFileSync(file, 'utf8'))] } catch { return [] } })
  assert.ok(records.some(data => data.snapshot?.fingerprint === journal.data.snapshot.fingerprint), 'release must retain an archived journal')
  const next = reserve(dir, snapshot({ pr: 12 }))
  assert.equal(next.data.state, 'reserved', 'release must permit the next same-trunk operation')
}

test('reserve persists versioned intent with owner-only file permissions', t => {
  const dir = sandbox(t), candidate = snapshot(), journal = reserve(dir, candidate)
  assert.deepEqual(journal.data.snapshot, candidate)
  assert.equal(journal.data.schemaVersion, 1); assert.equal(journal.data.state, 'reserved')
  assert.equal(journal.data.requestStarted, false); assert.equal(journal.data.solo, false)
  assert.equal(journal.data.protection, null); assert.equal(journal.data.restored, true)
  assert.deepEqual(load(dir, journal.file), journal.data)
  const stat = fs.lstatSync(actualPath(dir, journal.file))
  assert.equal(stat.isFile(), true); assert.equal(stat.mode & 0o777, 0o600)
  assert.equal(stat.uid, process.getuid())
})
test('solo reservation retains the exact protection snapshot and starts unrestored', t => {
  const dir = sandbox(t), protection = { required_pull_request_reviews: { required_approving_review_count: 1 }, enforce_admins: true }
  const journal = reserve(dir, snapshot(), { solo: true, protection })
  assert.equal(journal.data.solo, true); assert.equal(journal.data.restored, false)
  assert.deepEqual(load(dir, journal.file).protection, protection)
})
test('same repo and trunk exclude another PR and worktree while another trunk remains independent', t => {
  const dir = sandbox(t), journal = reserve(dir, snapshot())
  assertActive(dir, journal)
  const other = reserve(dir, snapshot({ trunk: 'main', pr: 99 }))
  assert.notEqual(other.file, journal.file)
  assert.equal(load(dir, other.file).snapshot.trunk, 'main')
})
test('save and load preserve unknown future fields through terminal archiving', t => {
  const dir = sandbox(t), journal = reserve(dir, snapshot())
  const future = { format: 7, nested: ['keep', { value: 'future-client' }] }
  const data = update(dir, journal, { state: 'failed', requestStarted: true, future })
  assert.deepEqual(load(dir, journal.file), data)
  const result = finish(dir, journal.file, { restored: true })
  assert.equal(result.released, true)
  const archived = fs.readdirSync(dir, { recursive: true }).map(name => path.join(dir, name))
    .filter(file => fs.lstatSync(file).isFile()).flatMap(file => {
      try { return [JSON.parse(fs.readFileSync(file, 'utf8'))] } catch { return [] }
    })
  assert.ok(archived.some(value => JSON.stringify(value.future) === JSON.stringify(future)))
})
for (const state of ['pending', 'enqueued', 'unverified']) test(`${state} with a started request keeps the shared trunk lock`, t => {
  const dir = sandbox(t), journal = reserve(dir, snapshot())
  update(dir, journal, { state, requestStarted: true, requestId: 'outstanding-request' })
  assert.equal(finish(dir, journal.file, { restored: true }).released, false)
  assertActive(dir, journal)
  assert.equal(load(dir, journal.file).requestId, 'outstanding-request')
})
for (const state of ['merged', 'failed']) test(`${state} solo outcome cannot release before protection readback matches`, t => {
  const dir = sandbox(t), journal = reserve(dir, snapshot(), { solo: true, protection: { original: true } })
  update(dir, journal, { state, requestStarted: true })
  assert.equal(finish(dir, journal.file, { restored: false }).released, false)
  assertActive(dir, journal)
})
for (const state of ['merged', 'failed']) test(`${state} with verified solo restoration archives and releases`, t => {
  const dir = sandbox(t), journal = reserve(dir, snapshot(), { solo: true, protection: { original: true } })
  update(dir, journal, { state, requestStarted: true })
  assertArchived(dir, journal, finish(dir, journal.file, { restored: true }))
})
test('an unused reservation can release while a solo unused reservation still needs restoration', t => {
  const dir = sandbox(t), journal = reserve(dir, snapshot())
  assertArchived(dir, journal, finish(dir, journal.file, { restored: true }))
  const solo = reserve(dir, snapshot({ trunk: 'main' }), { solo: true, protection: { original: true } })
  assert.equal(finish(dir, solo.file, { restored: false }).released, false)
  assert.equal(fs.existsSync(actualPath(dir, solo.file)), true)
})
test('external journal paths are refused without changing the outside file', t => {
  const dir = sandbox(t), outsideDir = sandbox(t), outside = path.join(outsideDir, 'outside.json')
  fs.writeFileSync(outside, '{"sentinel":"outside"}', { mode: 0o600 })
  const before = fs.readFileSync(outside, 'utf8')
  for (const file of [outside, path.relative(dir, outside)]) {
    assert.throws(() => load(dir, file))
    assert.throws(() => save(dir, file, { replaced: true }))
    assert.throws(() => finish(dir, file, { restored: true }))
  }
  assert.equal(fs.readFileSync(outside, 'utf8'), before)
})
test('a symlink in place of the active journal is refused without following its target', t => {
  const dir = sandbox(t), outsideDir = sandbox(t), journal = reserve(dir, snapshot())
  const active = actualPath(dir, journal.file), outside = path.join(outsideDir, 'victim.json')
  fs.writeFileSync(outside, JSON.stringify(journal.data), { mode: 0o600 })
  const before = fs.readFileSync(outside, 'utf8')
  fs.unlinkSync(active); fs.symlinkSync(outside, active)
  assert.throws(() => load(dir, journal.file))
  assert.throws(() => save(dir, journal.file, journal.data))
  assert.throws(() => finish(dir, journal.file, { restored: true }))
  assert.throws(() => reserve(dir, snapshot()))
  assert.equal(fs.readFileSync(outside, 'utf8'), before)
})
test('corrupt active JSON fails closed and cannot be silently replaced by another reserve', t => {
  const dir = sandbox(t), journal = reserve(dir, snapshot())
  fs.writeFileSync(actualPath(dir, journal.file), '{"partial":', { mode: 0o600 })
  assert.throws(() => load(dir, journal.file)); assert.throws(() => reserve(dir, snapshot()))
  assert.equal(fs.readFileSync(actualPath(dir, journal.file), 'utf8'), '{"partial":')
})

function child(t, source, args) {
  const processChild = spawn(process.execPath, ['--input-type=module', '-e', source, ...args], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  let stderr = ''; processChild.stderr.on('data', chunk => { stderr += chunk })
  t.after(() => { if (processChild.exitCode === null) processChild.kill() })
  const exited = once(processChild, 'exit')
  return { processChild, exited, stderr: () => stderr }
}
function message(processChild) {
  return new Promise((resolve, reject) => {
    const onMessage = value => { cleanup(); resolve(value) }
    const onExit = code => { cleanup(); reject(Error(`child exited before message (${code})`)) }
    const cleanup = () => { processChild.off('message', onMessage); processChild.off('exit', onExit) }
    processChild.once('message', onMessage); processChild.once('exit', onExit)
  })
}
test('two live processes racing for the same trunk reserve exactly one active operation', { timeout: 10000 }, async t => {
  const dir = sandbox(t)
  const source = `import { reserve } from ${JSON.stringify(moduleUrl)};
    process.send({ready:true}); process.once('message', () => {
      try { const r = reserve(process.argv[1], JSON.parse(process.argv[2])); process.send({ok:true,file:r.file}); }
      catch (e) { process.send({ok:false,error:e.message}); }
      process.disconnect();
    });`
  const children = [0, 1].map(i => child(t, source, [dir, JSON.stringify(snapshot({ pr: 11 + i }))]))
  await Promise.all(children.map(c => message(c.processChild)))
  const results = children.map(c => message(c.processChild))
  children.forEach(c => c.processChild.send('go'))
  const outcomes = await Promise.all(results)
  assert.equal(outcomes.filter(r => r.ok).length, 1)
  const winner = outcomes.find(r => r.ok)
  assert.ok([11, 12].includes(load(dir, winner.file).snapshot.pr))
  for (const c of children) { const [code] = await c.exited; assert.equal(code, 0, c.stderr()) }
})
test('concurrent raw readers see complete old or new JSON throughout atomic saves', { timeout: 10000 }, async t => {
  const dir = sandbox(t), journal = reserve(dir, snapshot())
  update(dir, journal, { sequence: 0, payload: 'x'.repeat(32768) })
  const source = `import fs from 'node:fs'; let count=0,max=0,error=null,stopped=false;
    function read(){try{const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));count++;max=Math.max(max,d.sequence);if(d.payload.length!==32768)throw Error('truncated payload')}catch(e){error=e.message}}
    read();process.send({ready:true});process.once('message',()=>{stopped=true;process.send({count,max,error});process.disconnect()});
    function loop(){if(stopped)return;read();setImmediate(loop)}loop();`
  const reader = child(t, source, [actualPath(dir, journal.file)])
  await message(reader.processChild)
  for (let sequence = 1; sequence <= 100; sequence++) {
    update(dir, journal, { sequence, payload: 'x'.repeat(32768) })
    await yieldTurn()
  }
  const statsPromise = message(reader.processChild); reader.processChild.send('stop')
  const stats = await statsPromise
  assert.equal(stats.error, null); assert.ok(stats.count > 1); assert.ok(stats.max > 0, 'reader must observe writes during the save sequence')
  assert.equal(load(dir, journal.file).sequence, 100)
  assert.equal(fs.statSync(actualPath(dir, journal.file)).mode & 0o777, 0o600)
  const [code] = await reader.exited; assert.equal(code, 0, reader.stderr())
})

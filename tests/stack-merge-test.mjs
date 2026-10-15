import assert from 'node:assert/strict'
import test from 'node:test'
import { observeMerge, executeMerge } from '../plugins/harness-guard/scripts/stack-merge.mjs'

// T2 contract tests: no network, real Git effects, protection changes, or wall-clock waits.
const repo = 'org/repo', prefix = `repos/${repo}`
const trunkOid = 'a'.repeat(40), headOid = 'b'.repeat(40), upperOid = 'c'.repeat(40)
const mergeSha = 'd'.repeat(40), laterTrunkOid = 'e'.repeat(40)
const uuid = '0520634a-aa51-44b8-b653-85c35538485a'
const policy = { branchFlow: 'git-flow', stackedPRs: { enabled: true, provider: 'github-gh-stack' } }
const clone = value => structuredClone(value)
function fixture() {
  const prs = [11, 12].map((number, i) => ({
    number, html_url: `https://github.com/${repo}/pull/${number}`, state: 'open', merged: false,
    merged_at: null, draft: false, merge_commit_sha: null,
    head: { ref: `codex/${i ? 'b' : 'a'}`, sha: i ? upperOid : headOid, repo: { full_name: repo } },
    base: { ref: i ? 'codex/a' : 'develop', sha: i ? headOid : trunkOid, repo: { full_name: repo } },
    stack: { id: 99, number: 13, size: 2, position: i + 1, base: { ref: 'develop', sha: trunkOid } },
  }))
  // The stack endpoint returns abbreviated repo identities, as observed in the G0 response.
  const members = prs.map(p => {
    const m = clone(p); delete m.stack; delete m.merged
    for (const side of ['head', 'base']) m[side].repo = { id: 1, name: 'repo', url: `https://api.github.com/${prefix}` }
    return m
  })
  const data = {
    [`${prefix}/pulls/11`]: prs[0], [`${prefix}/pulls/12`]: prs[1],
    [`${prefix}/stacks/13`]: { id: 99, number: 13, open: true, base: { ref: 'develop' }, pull_requests: members },
    [`${prefix}/git/ref/heads/develop`]: { object: { sha: trunkOid } },
  }
  const get = endpoint => {
    assert.ok(Object.hasOwn(data, endpoint), `unexpected observation GET ${endpoint}`)
    return clone(data[endpoint])
  }
  const observe = (pr = 11, p = policy) => observeMerge({ repo, pr, policy: p, get })
  return { data, get, observe }
}
const pending = () => ({ status: 'pending', details: {
  uuid, merge_method: 'merge', merge_action: 'default', expected_head_sha: headOid,
} })
const merged = () => ({ status: 'merged', details: { sha: mergeSha } })
function harness({ f = fixture(), put = { status: 202, body: pending() }, polls = [{ status: 200, body: merged() }],
  actualMerged = true, actualSha = mergeSha, compare = 'ahead', observe } = {}) {
  const snapshot = f.observe(), calls = [], saved = [], waits = []
  let time = 0, poll = 0
  const request = async (method, endpoint, body) => {
    calls.push({ method, endpoint, body: clone(body) })
    if (method === 'PUT') {
      // Persist intent before a transport can accept the request and lose its response.
      assert.ok(saved.length > 0, 'merge intent must be saved before PUT')
      if (put instanceof Error) throw put
      return clone(put)
    }
    assert.equal(method, 'GET', 'provider must not mutate anything except the initial PUT')
    if (endpoint === `${prefix}/pulls/11/merge-async/${uuid}`) {
      const response = polls[Math.min(poll++, polls.length - 1)]
      if (response instanceof Error) throw response
      return clone(response)
    }
    if (endpoint === `${prefix}/pulls/11`) return { status: 200, body: {
      ...f.data[endpoint], state: actualMerged ? 'closed' : 'open', merged: actualMerged,
      merged_at: actualMerged ? '2026-10-15T00:00:00Z' : null, merge_commit_sha: actualMerged ? actualSha : null,
    } }
    if (endpoint === `${prefix}/git/ref/heads/develop`) return { status: 200, body: { object: { sha: laterTrunkOid } } }
    if (endpoint === `${prefix}/compare/${mergeSha}...${laterTrunkOid}`) return { status: 200, body: { status: compare } }
    assert.fail(`unexpected provider GET ${endpoint}`)
  }
  const options = { snapshot, observe: observe ?? (() => f.observe()), request,
    save: async value => { saved.push(clone(value)) },
    now: () => time, sleep: async ms => { assert.ok(ms > 0); waits.push(ms); time += ms } }
  return { snapshot, calls, saved, waits, options, run: extra => executeMerge({ ...options, ...extra }) }
}
const puts = h => h.calls.filter(c => c.method === 'PUT')
const statusGets = h => h.calls.filter(c => c.endpoint.includes('/merge-async/') && c.method === 'GET')

test('lowest observation records current head, trunk and full membership', () => {
  const s = fixture().observe()
  assert.equal(s.kind, 'stack'); assert.equal(s.repo, repo); assert.equal(s.pr, 11)
  assert.equal(s.trunk, 'develop'); assert.equal(s.trunkOid, trunkOid)
  assert.equal(s.headOid, headOid); assert.equal(s.headBranch, 'codex/a'); assert.equal(s.stackNumber, 13)
  assert.equal(s.members.length, 2); assert.equal(typeof s.fingerprint, 'string'); assert.ok(s.fingerprint.length > 0)
})
test('ordinary PR keeps the single provider path without stack opt-in', () => {
  const f = fixture(); delete f.data[`${prefix}/pulls/11`].stack
  assert.equal(f.observe(11, { branchFlow: 'git-flow' }).kind, 'single')
})
for (const [name, alter, pr = 11, p = policy] of [
  ['notLowestRejected', () => {}, 12],
  ['wrongActualBaseRejected', f => { f.data[`${prefix}/pulls/11`].base.ref = 'main' }],
  ['stackOptInRequired', () => {}, 11, { branchFlow: 'git-flow' }],
  ['foreignHeadRejected', f => { f.data[`${prefix}/pulls/11`].head.repo.full_name = 'other/repo' }],
  ['stackTrunkMismatchRejected', f => { f.data[`${prefix}/stacks/13`].base.ref = 'main' }],
  ['stackOrderMismatchRejected', f => { f.data[`${prefix}/stacks/13`].pull_requests.reverse() }],
]) test(name, () => { const f = fixture(); alter(f); assert.throws(() => f.observe(pr, p)) })

test('fingerprint includes upper composition, not only selected head', () => {
  const f = fixture(), before = f.observe().fingerprint
  f.data[`${prefix}/pulls/12`].head.sha = laterTrunkOid
  f.data[`${prefix}/stacks/13`].pull_requests[1].head.sha = laterTrunkOid
  assert.notEqual(f.observe().fingerprint, before)
})
for (const [name, alter] of [
  ['staleHeadRejected', s => { s.headOid = upperOid }],
  ['changedCompositionRejected', s => { s.fingerprint = 'changed-membership'; s.members = [...s.members].reverse() }],
  ['changedTrunkRejected', s => { s.trunkOid = laterTrunkOid }],
]) test(name, async () => {
  let fresh
  const h = harness({ observe: () => fresh }); fresh = clone(h.snapshot); alter(fresh)
  const result = await h.run()
  assert.equal(result.state, 'unverified'); assert.equal(puts(h).length, 0)
})
test('observation refusal at request boundary submits nothing', async () => {
  const h = harness({ observe: () => { throw Error('actual base changed') } })
  const result = await h.run()
  assert.equal(result.state, 'unverified'); assert.equal(puts(h).length, 0)
})

test('pending request pins reviewed head and verifies actual PR and trunk before merged', async () => {
  const h = harness(), result = await h.run()
  assert.equal(result.state, 'merged'); assert.equal(result.requestId, uuid); assert.equal(result.mergeSha, mergeSha)
  assert.deepEqual(puts(h), [{ method: 'PUT', endpoint: `${prefix}/pulls/11/merge-async`,
    body: { sha: headOid, merge_method: 'merge', merge_action: 'default' } }])
  assert.ok(h.calls.some(c => c.endpoint === `${prefix}/pulls/11`))
  assert.ok(h.calls.some(c => c.endpoint === `${prefix}/git/ref/heads/develop`))
  assert.ok(h.calls.some(c => c.endpoint === `${prefix}/compare/${mergeSha}...${laterTrunkOid}`))
  assert.ok(h.saved.some(j => j.requestId === uuid), 'pending UUID must survive in journal')
})
test('trunk identical to reported merge is accepted by ancestry readback', async () => {
  const h = harness({ compare: 'identical' })
  assert.equal((await h.run()).state, 'merged')
})
test('timeoutRetainsRequest with bounded default polling', async () => {
  const h = harness({ polls: [{ status: 200, body: pending() }] }), result = await h.run()
  assert.equal(result.state, 'pending'); assert.equal(result.requestId, uuid)
  assert.equal(puts(h).length, 1); assert.ok(statusGets(h).length > 0)
  assert.ok(h.waits.every(ms => ms === 5000)); assert.equal(h.waits.reduce((a, b) => a + b, 0), 30000)
  assert.ok(statusGets(h).length <= 7, 'bounded polling must stop at the deadline')
  assert.equal(statusGets(h).length, 5, 'no fresh request may begin at or after the 30 second deadline')
  assert.equal(h.saved.at(-1).requestId, uuid)
})
test('queue without a request UUID can finish using actual PR and trunk readback only', async () => {
  const queued = harness({ put: { status: 200, body: { status: 'enqueued', details: {} } } })
  const initial = await queued.run()
  assert.equal(initial.state, 'enqueued'); assert.equal(initial.requestId, null)
  const completion = harness(), done = await completion.run({ resume: clone(queued.saved.at(-1)) })
  assert.equal(done.state, 'merged'); assert.equal(done.mergeSha, mergeSha)
  assert.equal(puts(completion).length, 0); assert.equal(statusGets(completion).length, 0)
  const waiting = harness({ actualMerged: false }), pending = await waiting.run({ resume: clone(queued.saved.at(-1)) })
  assert.equal(pending.state, 'enqueued'); assert.equal(puts(waiting).length, 0)
})
test('queuedIsNotMerged and never triggers another mutation', async () => {
  const h = harness({ polls: [{ status: 200, body: { status: 'enqueued', details: { uuid } } }] })
  const result = await h.run()
  assert.equal(result.state, 'enqueued'); assert.equal(result.requestId, uuid); assert.equal(puts(h).length, 1)
  assert.equal(h.calls.filter(c => c.method !== 'GET' && c.method !== 'PUT').length, 0)
})
test('matching409 resumes the existing UUID using only GET after the initial attempt', async () => {
  const h = harness({ put: { status: 409, body: pending() } }), result = await h.run()
  assert.equal(result.state, 'merged'); assert.equal(result.requestId, uuid)
  assert.equal(puts(h).length, 1); assert.equal(statusGets(h).length, 1)
})
for (const [field, value] of [['expected_head_sha', upperOid], ['merge_method', 'squash'], ['merge_action', 'queue']]) {
  test(`conflicting409Stops on ${field}`, async () => {
    const body = pending(); body.details[field] = value
    const h = harness({ put: { status: 409, body } }), result = await h.run()
    assert.equal(result.state, 'unverified'); assert.equal(puts(h).length, 1); assert.equal(statusGets(h).length, 0)
  })
}
for (const field of ['uuid', 'merge_method', 'merge_action', 'expected_head_sha']) {
  test(`pending without ${field} fails closed`, async () => {
    const body = pending(); delete body.details[field]
    const h = harness({ put: { status: 202, body } }), result = await h.run()
    assert.equal(result.state, 'unverified'); assert.equal(puts(h).length, 1); assert.equal(statusGets(h).length, 0)
  })
}
for (const [name, response] of [
  ['unknownStatus', { status: 200, body: { status: 'surprise', details: { uuid } } }],
  ['status404', { status: 404, body: { message: 'Not Found' } }],
  ['pollTransportLoss', Error('connection reset after accepted request')],
]) test(`${name} remains unverified without PUT retry`, async () => {
  const h = harness({ polls: [response] }), result = await h.run()
  assert.equal(result.state, 'unverified'); assert.equal(result.requestId, uuid); assert.equal(puts(h).length, 1)
})
test('provider failure is failed and retains the existing request', async () => {
  const h = harness({ polls: [{ status: 200, body: { status: 'failed', details: { message: 'required check failed' } } }] })
  const result = await h.run()
  assert.equal(result.state, 'failed'); assert.equal(result.requestId, uuid); assert.equal(puts(h).length, 1)
})
for (const [name, config] of [
  ['mergedBodyWithoutActualMerge', { actualMerged: false }],
  ['actualMergedShaMismatch', { actualSha: upperOid }],
  ['mergeNotContainedInTrunk', { compare: 'diverged' }],
]) test(`${name} is not completion`, async () => {
  const h = harness(config), result = await h.run()
  assert.equal(result.state, 'unverified'); assert.equal(puts(h).length, 1)
})
test('pending resume polls the saved request and never repeats PUT', async () => {
  const h = harness({ polls: [{ status: 200, body: pending() }] })
  assert.equal((await h.run({ timeoutMs: 5000 })).state, 'pending')
  const resume = clone(h.saved.at(-1)), start = h.calls.length
  // Use a separate transport for completion but the exact persisted journal from the first execution.
  const completion = harness()
  const result = await completion.run({ resume })
  assert.equal(result.state, 'merged'); assert.equal(result.requestId, uuid)
  assert.equal(puts(completion).length, 0); assert.ok(statusGets(completion).length > 0)
  assert.equal(h.calls.length, start)
})
test('lostReplyIntentPreservation prevents a blind PUT on resume', async () => {
  const h = harness({ put: Error('response lost after server accepted PUT') })
  const result = await h.run()
  assert.equal(result.state, 'unverified'); assert.equal(puts(h).length, 1)
  assert.ok(h.saved.length > 0)
  const serialized = JSON.stringify(h.saved)
  assert.ok(serialized.includes(headOid), 'intent must retain reviewed head')
  assert.ok(serialized.includes(repo), 'intent must retain repository identity')
  const resumed = harness({ actualMerged: false }), resumedResult = await resumed.run({ resume: clone(h.saved.at(-1)) })
  assert.equal(resumedResult.state, 'unverified'); assert.equal(puts(resumed).length, 0)
  const completed = harness(), completedResult = await completed.run({ resume: clone(h.saved.at(-1)) })
  assert.equal(completedResult.state, 'merged'); assert.equal(puts(completed).length, 0)
  assert.equal(completedResult.mergeSha, mergeSha)
  const wrong = harness({ actualSha: upperOid }), wrongResult = await wrong.run({ resume: clone(h.saved.at(-1)) })
  assert.equal(wrongResult.state, 'unverified'); assert.equal(puts(wrong).length, 0)
})

// Live GitHub stack35 kept merged PR32 at position1/3 and retargeted PR33 to develop.
function retainedPrefix() {
  const f = fixture(), lower = f.data[`${prefix}/pulls/11`], next = f.data[`${prefix}/pulls/12`]
  Object.assign(lower, { state: 'closed', merged: true, merged_at: '2026-10-15T11:55:55Z', merge_commit_sha: mergeSha })
  next.base = { ref: 'develop', sha: laterTrunkOid, repo: { full_name: repo } }
  f.data[`${prefix}/git/ref/heads/develop`].object.sha = laterTrunkOid
  const members = f.data[`${prefix}/stacks/13`].pull_requests
  Object.assign(members[0], { state: 'closed', merged_at: lower.merged_at }); members[1].base = clone(next.base)
  return f
}
test('next lowest keeps the verified merged prefix in its full fingerprint', () => {
  const f = retainedPrefix(), s = f.observe(12)
  assert.equal(s.pr, 12); assert.equal(s.headOid, upperOid); assert.equal(s.members.length, 2)
  assert.equal(s.members[0].merged, true); assert.equal(s.members[1].stack.position, 2)
  assert.throws(() => f.observe(11), /lowest|draft|candidate/)
})
for (const [name, alter] of [
  ['closed but not merged cannot be skipped', f => { f.data[`${prefix}/pulls/11`].merged = false; f.data[`${prefix}/pulls/11`].merged_at = null }],
  ['foreign merged prefix cannot be skipped', f => { f.data[`${prefix}/pulls/11`].head.repo.full_name = 'other/repo' }],
  ['merged prefix identity cannot change', f => { f.data[`${prefix}/pulls/11`].stack.position = 2 }],
  ['next lowest still requires ready', f => { f.data[`${prefix}/pulls/12`].draft = true }],
]) test(name, () => { const f = retainedPrefix(); alter(f); assert.throws(() => f.observe(12)) })
test('a merged member after an open member is never a removable prefix', () => {
  const f = fixture(); Object.assign(f.data[`${prefix}/pulls/12`], { state: 'closed', merged: true, merged_at: '2026-10-15T11:55:55Z' })
  assert.throws(() => f.observe())
})

test('two merged predecessors leave only the third PR eligible, without renumbering history', () => {
  const f = retainedPrefix(), second = f.data[`${prefix}/pulls/12`], third = clone(second)
  third.number = 14; third.html_url = `https://github.com/${repo}/pull/14`
  third.head = { ref: 'codex/c', sha: 'f'.repeat(40), repo: { full_name: repo } }
  Object.assign(second, { state: 'closed', merged: true, merged_at: '2026-10-15T12:00:00Z' })
  third.stack.position = 3
  const all = [f.data[`${prefix}/pulls/11`], second, third]
  all.forEach(p => { p.stack.size = 3 })
  f.data[`${prefix}/pulls/14`] = third
  f.data[`${prefix}/stacks/13`].pull_requests = clone(all)
  const s = f.observe(14)
  assert.equal(s.pr, 14); assert.equal(s.members.length, 3); assert.equal(s.members[2].stack.position, 3)
  assert.throws(() => f.observe(12), /lowest/)
})

#!/usr/bin/env node
// Internal asynchronous provider; the PR wrapper owns CI/review gates.
import { createHash } from 'node:crypto'
import { stackTrunk, prNumber } from './stack-policy.mjs'

const oid = x => typeof x === 'string' && /^[a-f0-9]{40}$/.test(x)
const identity = p => ({ number: p.number, url: p.html_url, state: p.state, draft: p.draft,
  merged: Boolean(p.merged || p.merged_at), head: { ref: p.head?.ref, sha: p.head?.sha, repo: p.head?.repo?.full_name },
  base: { ref: p.base?.ref, sha: p.base?.sha, repo: p.base?.repo?.full_name }, stack: p.stack || null })
const require = (ok, reason) => { if (!ok) throw Error(reason) }
export function observeMerge({ repo, pr, policy, get }) {
  require(/^[\w.-]+\/[\w.-]+$/.test(repo) && Number.isSafeInteger(pr) && pr > 0, 'invalid repository/PR')
  const prefix = `repos/${repo}`, selected = get(`${prefix}/pulls/${pr}`)
  require(selected?.number === pr && prNumber(selected.html_url, repo) === pr, 'PR identity mismatch')
  if (!selected.stack) return { kind: 'single', repo, pr, identity: identity(selected) }
  const trunk = stackTrunk(policy), stackNumber = selected.stack.number
  require(Number.isSafeInteger(stackNumber) && stackNumber > 0, 'invalid stack identity')
  const stack = get(`${prefix}/stacks/${stackNumber}`)
  require(stack.open === true && stack.number === stackNumber && stack.id === selected.stack.id
    && stack.base?.ref === trunk, 'remote stack/trunk mismatch')
  require(Array.isArray(stack.pull_requests) && stack.pull_requests.length > 0 && stack.pull_requests.length <= 100,
    'invalid stack membership')
  const trunkOid = get(`${prefix}/git/ref/heads/${trunk}`)?.object?.sha
  require(oid(trunkOid), 'invalid live trunk OID')
  const members = [], active = [], seen = new Set()
  let parent = trunk, parentOid = trunkOid
  for (const [i, item] of stack.pull_requests.entries()) {
    require(Number.isSafeInteger(item.number) && item.number > 0 && !seen.has(item.number), 'invalid duplicate member')
    seen.add(item.number)
    const p = get(`${prefix}/pulls/${item.number}`)
    require(p.number === item.number && prNumber(p.html_url, repo) === p.number, 'member identity mismatch')
    require(p.head?.repo?.full_name === repo && p.base?.repo?.full_name === repo, 'foreign stack member')
    require(/^(codex|feature|fix)\/.+/.test(p.head.ref) && oid(p.head.sha), 'invalid work branch/head')
    require(p.stack?.number === stackNumber && p.stack.id === stack.id && p.stack.position === i + 1
      && p.stack.size === stack.pull_requests.length && p.stack.base?.ref === trunk, 'member stack changed')
    require(item.head?.sha === p.head.sha && item.base?.ref === p.base.ref, 'membership observation changed')
    members.push(identity(p))
    if (p.state === 'closed' && p.merged === true && p.merged_at) {
      require(active.length === 0, 'merged members must form a verified prefix')
      continue
    }
    require(p.state === 'open' && !p.merged && !p.merged_at, 'stack member is not open')
    require(p.base.ref === parent && (active.length === 0 || p.base.sha === parentOid), 'wrong actual parent/order')
    active.push(identity(p)); parent = p.head.ref; parentOid = p.head.sha
  }
  require(active[0]?.number === pr && selected.base.ref === trunk, 'only lowest unmerged PR may be merged')
  require(selected.draft === false && JSON.stringify(identity(selected)) === JSON.stringify(active[0]), 'selected candidate changed/draft')
  const s = { kind: 'stack', repo, pr, trunk, trunkOid, headOid: selected.head.sha,
    headBranch: selected.head.ref, stackNumber, members, policy }
  return { ...s, fingerprint: createHash('sha256').update(JSON.stringify(s)).digest('hex') }
}

export async function executeMerge({ snapshot, observe, request, save, sleep = ms => new Promise(r => setTimeout(r, ms)),
  now = Date.now, pollMs = 5000, timeoutMs = 30000, resume }) {
  const journal = resume ? structuredClone(resume) : { schemaVersion: 1, snapshot, state: 'unverified',
    requestId: null, requestStarted: false, reason: 'merge has not been requested' }
  const keep = async () => { await save(structuredClone(journal)); return journal }
  const prefix = `repos/${snapshot.repo}`, endpoint = `${prefix}/pulls/${snapshot.pr}/merge-async`
  const read = async url => { const r = await request('GET', url); require(r.status === 200, 'merge readback HTTP failure'); return r.body }
  const confirm = async sha => {
    require(oid(sha), 'invalid merged SHA')
    const p = await read(`${prefix}/pulls/${snapshot.pr}`)
    require(p.number === snapshot.pr && p.merged === true && p.state === 'closed' && p.head?.sha === snapshot.headOid
      && p.base?.ref === snapshot.trunk && p.merge_commit_sha === sha, 'actual PR merge differs from request/result')
    require(p.head?.repo?.full_name === snapshot.repo && p.base?.repo?.full_name === snapshot.repo, 'actual PR repository changed')
    const trunk = (await read(`${prefix}/git/ref/heads/${snapshot.trunk}`))?.object?.sha
    require(oid(trunk), 'live trunk unavailable')
    const comparison = await read(`${prefix}/compare/${sha}...${trunk}`)
    require(['identical', 'ahead'].includes(comparison.status), 'merge not contained in live trunk')
    journal.mergeSha = sha; journal.state = 'merged'; journal.reason = 'actual PR and trunk confirmed'
  }
  try {
    require(snapshot?.kind === 'stack' && oid(snapshot.headOid) && oid(snapshot.trunkOid), 'stack candidate required')
    require(timeoutMs > 0 && timeoutMs <= 30000 && pollMs > 0 && pollMs <= 5000, 'invalid bounded polling')
    require(journal.schemaVersion === 1 && JSON.stringify(journal.snapshot) === JSON.stringify(snapshot), 'journal candidate mismatch')
    const deadline = now() + timeoutMs
    let response
    if (resume) {
      // A saved pending request is only read. Re-observation may no longer be a
      // lowest open PR after the server finishes; do not resubmit it.
      if (journal.state === 'merged') { await confirm(journal.mergeSha); return await keep() }
      if (journal.state === 'failed') return await keep()
      if (journal.requestStarted && (journal.state === 'enqueued' || !journal.requestId)) {
        // Queue acceptance or a lost PUT reply may provide no UUID. Never repeat
        // PUT: only an actual matching merge contained in trunk resolves intent.
        const actual = await read(`${prefix}/pulls/${snapshot.pr}`)
        if (actual.merged === true) await confirm(actual.merge_commit_sha)
        else journal.reason = 'actual merge not yet confirmed; no request resubmitted'
        return await keep()
      }
      require(journal.requestStarted && /^[a-f0-9-]{36}$/i.test(journal.requestId || ''), 'request UUID unknown; no automatic resubmission')
      response = await request('GET', `${endpoint}/${journal.requestId}`)
    } else {
      const fresh = await observe()
      require(JSON.stringify(fresh) === JSON.stringify(snapshot), 'candidate or stack composition changed')
      journal.requestStarted = true; journal.reason = 'request outcome unknown'; await keep()
      response = await request('PUT', endpoint, { sha: snapshot.headOid, merge_method: 'merge', merge_action: 'default' })
    }
    while (true) {
      const { status, body } = response
      require([200, 202, 400, 409].includes(status), `async HTTP ${status}`)
      require(body && ['pending', 'merged', 'enqueued', 'failed'].includes(body.status), 'unknown merge status')
      require(status !== 409 || body.status === 'pending', 'invalid conflicting request response')
      require(status !== 400 || body.status === 'failed', 'invalid rejected request response')
      journal.response = body
      if (body.status === 'merged') { await confirm(body.details?.sha); return await keep() }
      if (body.status !== 'pending') {
        journal.state = body.status; journal.reason = body.details?.message || body.status; return await keep()
      }
      const d = body.details
      require(d && /^[a-f0-9-]{36}$/i.test(d.uuid || '') && d.merge_method === 'merge' && d.merge_action === 'default'
        && d.expected_head_sha === snapshot.headOid && (!journal.requestId || journal.requestId === d.uuid),
      'pending request options/UUID differ from reviewed intent')
      journal.requestId = d.uuid; journal.state = 'pending'; journal.reason = 'request pending'; await keep()
      const remaining = deadline - now()
      if (remaining <= 0) return journal
      await sleep(Math.min(pollMs, remaining))
      if (now() >= deadline) return journal
      response = await request('GET', `${endpoint}/${journal.requestId}`)
    }
  } catch (e) {
    journal.state = 'unverified'; journal.reason = e.message
    return await keep()
  }
}

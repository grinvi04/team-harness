#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { realpathSync, lstatSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPolicy } from './repo-policy.mjs'
import { rebaseStack } from './stack-rebase.mjs'
import { prNumber, stackTrunk, validateStack, validateRemoteStack } from './stack-policy.mjs'

export function run(tool, args, { cwd = process.cwd(), env = process.env, input } = {}) {
  return execFileSync(tool, args, { cwd, env, input, encoding: 'utf8', timeout: 30000,
    maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}
export function assertAllowed(result) {
  if (!result.allowed) throw Error(result.violations.join('; '))
}
export function prIdentity(pr) {
  const ref = value => ({ ref: value?.ref, sha: value?.sha, repo: value?.repo?.full_name })
  return { number: pr.number, url: pr.html_url, state: pr.state, draft: pr.draft,
    merged: Boolean(pr.merged || pr.merged_at), head: ref(pr.head), base: ref(pr.base), stack: pr.stack || null }
}
function ancestor(root, old, head) {
  if (old === null) return true
  const r = spawnSync('git', ['merge-base', '--is-ancestor', old, head], { cwd: root, encoding: 'utf8', timeout: 10000 })
  if (![0, 1].includes(r.status)) throw Error('cannot verify ancestry; fetch missing objects before retrying')
  return r.status === 0
}
export function fingerprint(snapshot) {
  // Stable candidate identity excludes explanatory diagnostics and engine cache fields.
  const { repo, trunk, trunkOid, localTrunkOid, currentBranch, layers, worktrees } = snapshot
  return createHash('sha256').update(JSON.stringify({ repo, trunk, trunkOid, localTrunkOid, currentBranch, layers, worktrees })).digest('hex')
}
export function observeStack({ cwd = process.cwd(), operation = 'submit' } = {}) {
  const root = realpathSync(run('git', ['rev-parse', '--show-toplevel'], { cwd }))
  const git = args => run('git', args, { cwd: root })
  const policy = readPolicy(root), trunk = stackTrunk(policy)
  const origin = git(['remote', 'get-url', 'origin'])
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(origin)
  if (!match) throw Error('stack adapter requires an explicit github.com origin')
  const repo = match[1], env = { ...process.env, GH_REPO: repo, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' }
  const pushUrls = git(['remote', 'get-url', '--push', '--all', 'origin']).split('\n')
  const permitted = new Set([`https://github.com/${repo}`, `https://github.com/${repo}.git`, `git@github.com:${repo}`, `git@github.com:${repo}.git`])
  if (pushUrls.length !== 1 || !permitted.has(pushUrls[0])) throw Error('origin push destination differs from validated repository')
  const gh = args => run('gh', args, { cwd: root, env })
  const api = endpoint => JSON.parse(gh(['api', '--hostname', 'github.com', '--method', 'GET', endpoint]))
  if (!/^gh stack version 0\.2\.1(?:\s|$)/.test(gh(['stack', '--version']))) throw Error('verified gh-stack v0.2.1 required; no automatic installation/update')
  // Official view refreshes its PR metadata cache. It does not push or create a PR.
  const view = JSON.parse(gh(['stack', 'view', '--json']))
  const currentBranch = git(['branch', '--show-current'])
  if (view.trunk !== trunk || view.currentBranch !== currentBranch || !Array.isArray(view.branches)) throw Error('official stack context differs from current Git/policy')
  const refs = new Map()
  for (const line of git(['ls-remote', '--heads', 'origin']).split('\n').filter(Boolean)) {
    const m = /^([0-9a-f]{40})\trefs\/heads\/(.+)$/.exec(line)
    if (!m || refs.has(m[2])) throw Error('invalid remote ref inventory')
    refs.set(m[2], m[1])
  }
  if (!refs.has(trunk)) throw Error('declared remote trunk missing')
  const worktrees = []
  let w
  for (const field of git(['worktree', 'list', '--porcelain', '-z']).split('\0')) {
    if (field.startsWith('worktree ')) {
      w = { path: realpathSync(field.slice(9)), branch: null, dirty: false, locked: false }; worktrees.push(w)
    } else if (field.startsWith('branch ') && w) w.branch = field.slice(7).replace(/^refs\/heads\//, '')
    else if ((field === 'locked' || field.startsWith('locked ')) && w) w.locked = true
  }
  const names = new Set(view.branches.map(b => b.name))
  for (const w of worktrees) {
    if (names.has(w.branch) || w.path === root || (operation !== 'submit' && w.branch === trunk))
      w.dirty = run('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: w.path }) !== ''
  }
  let parent = trunk, parentOid = refs.get(trunk)
  const layers = [], prs = []
  for (const item of view.branches) {
    // Validate before interpolating a ref or invoking Git; metadata itself is not authority.
    if (typeof item.name !== 'string' || !/^(codex|feature|fix)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(item.name)
      || git(['check-ref-format', '--branch', item.name]) !== item.name) throw Error('invalid/protected stack layer')
    const headOid = git(['rev-parse', '--verify', `refs/heads/${item.name}^{commit}`])
    const remoteOid = refs.get(item.name) || null
    // view.head is the engine's saved checkpoint, not the current Git HEAD.
    // Ordinary commits need not update that cache; validate actual refs below.
    const found = api(`repos/${repo}/pulls?state=open&head=${encodeURIComponent(repo.split('/')[0] + ':' + item.name)}&per_page=100`)
    if (!Array.isArray(found) || found.length > 1) throw Error('ambiguous current PR inventory')
    const pr = found[0] || (item.pr?.url ? api(`repos/${repo}/pulls/${prNumber(item.pr.url, repo)}`) : null)
    if (item.pr?.url && pr?.html_url !== item.pr.url) throw Error('official PR reference differs from live PR')
    const merged = Boolean(pr?.merged || pr?.merged_at)
    if (Boolean(item.isMerged) !== merged) throw Error('native merged cache differs from current PR')
    const l = { branch: item.name, parent, headOid, remoteOid,
      remoteIsAncestor: ancestor(root, remoteOid, headOid), localIsAncestor: remoteOid !== null && ancestor(root, headOid, remoteOid), parentIsAncestor: ancestor(root, parentOid, headOid),
      uniqueCommits: Number(git(['rev-list', '--count', `${parentOid}..${headOid}`])),
      prUrl: pr?.html_url || null, draft: pr?.draft ?? true, merged,
      queued: item.isQueued === true, needsRebase: item.needsRebase === true }
    layers.push(l); prs.push(pr); if (!merged) { parent = item.name; parentOid = headOid }
  }
  const localTrunkOid = git(['rev-parse', '--verify', `refs/heads/${trunk}^{commit}`])
  const snapshot = { repo, root, trunk, trunkOid: refs.get(trunk), localTrunkOid,
    localTrunkIsAncestor: ancestor(root, localTrunkOid, refs.get(trunk)), currentBranch, layers, worktrees, operation }
  const stackNumbers = [...new Set(prs.filter(p => p?.stack && !p.merged && !p.merged_at).map(p => p.stack.number))]
  if (stackNumbers.length > 1) throw Error('layers belong to different remote stacks')
  const remote = stackNumbers.length ? api(`repos/${repo}/stacks/${stackNumbers[0]}`) : null
  const localCheck = validateStack(snapshot, policy), remoteCheck = validateRemoteStack(snapshot, prs, remote)
  return { snapshot, policy, prs, remote, fingerprint: fingerprint(snapshot), localCheck, remoteCheck, gh, api }
}
export function checkCreate({ base, draft, cwd }) {
  const observed = observeStack({ cwd, operation: 'submit' })
  assertAllowed(observed.localCheck); assertAllowed(observed.remoteCheck)
  const { snapshot } = observed, i = snapshot.layers.findIndex(l => l.branch === snapshot.currentBranch), layer = snapshot.layers[i]
  if (base !== layer.parent) throw Error('explicit base is not the registered current parent')
  if (layer.prUrl) throw Error('current layer already has an open PR; do not recreate it')
  if (i > 0) {
    const parent = snapshot.layers[i - 1]
    if (!draft) throw Error('upper stack PR must be created as draft')
    if (!parent.prUrl || parent.remoteOid !== parent.headOid) throw Error('parent PR must exist at its current pushed head')
    // A second GET catches changes since the initial inventory, without claiming atomicity.
    const fresh = observed.api(`repos/${snapshot.repo}/pulls/${prNumber(parent.prUrl, snapshot.repo)}`)
    if (JSON.stringify(prIdentity(fresh)) !== JSON.stringify(prIdentity(observed.prs[i - 1]))) throw Error('parent PR changed during preflight')
  }
  return { base, repo: snapshot.repo, headOid: layer.headOid, remoteOid: layer.remoteOid }
}
function submissionPlan(file, snapshot) {
  if (!file || !lstatSync(file).isFile()) throw Error('regular submission plan file required')
  const plan = JSON.parse(readFileSync(file, 'utf8'))
  if (plan.schemaVersion !== 1 || Object.keys(plan).some(k => !['schemaVersion', 'layers'].includes(k))
    || !Array.isArray(plan.layers) || plan.layers.length !== snapshot.layers.length) throw Error('plan must cover exactly the observed stack')
  const bodies = []
  const layers = plan.layers.map((entry, i) => {
    if (!entry || Object.keys(entry).some(k => !['branch', 'title', 'bodyFile'].includes(k))
      || entry.branch !== snapshot.layers[i].branch || typeof entry.title !== 'string' || !entry.title.trim()
      || typeof entry.bodyFile !== 'string' || !lstatSync(entry.bodyFile).isFile()) throw Error('invalid layer title/body/branch plan')
    const body = readFileSync(entry.bodyFile, 'utf8')
    if (!body.trim()) throw Error('empty layer body')
    bodies.push(body)
    return { ...entry, bodyFile: path.resolve(entry.bodyFile), bodyHash: createHash('sha256').update(body).digest('hex') }
  })
  return { plan: layers, bodies }
}
export function journalFor(snapshot, action, expected) {
  const common = path.resolve(snapshot.root, run('git', ['rev-parse', '--git-common-dir'], { cwd: snapshot.root }))
  const directory = path.join(common, 'harness-stack')
  try { mkdirSync(directory, { mode: 0o700 }) } catch (e) { if (e.code !== 'EEXIST') throw e }
  if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) throw Error('unsafe stack journal directory')
  const file = path.join(directory, `${Date.now()}-${randomUUID()}.json`)
  const data = { schemaVersion: 1, action, expected, repo: snapshot.repo, trunk: snapshot.trunk,
    state: 'started', before: snapshot, effects: [] }
  const save = () => writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'w' })
  writeFileSync(file, '', { mode: 0o600, flag: 'wx' }); save()
  return { file, data, save, effect(kind, call) {
    const entry = { kind, state: 'unknown' }; data.effects.push(entry); save()
    const result = call(); entry.state = 'returned'; save(); return result
  } }
}
function sameLocalCandidate(before, after) {
  if (before.repo !== after.repo || before.trunk !== after.trunk || before.trunkOid !== after.trunkOid
    || before.layers.length !== after.layers.length || before.layers.some((l, i) =>
      l.branch !== after.layers[i].branch || l.parent !== after.layers[i].parent || l.headOid !== after.layers[i].headOid))
    throw Error('candidate changed during submission')
}
export function pushObserved(git, snapshot) {
  // Never let an engine fetch replace our expected OIDs. Sources are immutable
  // commits, and an absent destination must still be absent at the server.
  const leases = snapshot.layers.map(l => `--force-with-lease=refs/heads/${l.branch}:${l.remoteOid || ''}`)
  const refs = snapshot.layers.map(l => `${l.headOid}:refs/heads/${l.branch}`)
  return git(['push', '--atomic', '--no-follow-tags', 'origin', ...leases, ...refs])
}
export function submit({ planFile, apply = false, expected, cwd }) {
  let observed = observeStack({ cwd }), snapshot = observed.snapshot
  assertAllowed(observed.localCheck); assertAllowed(observed.remoteCheck)
  const { plan, bodies } = submissionPlan(planFile, snapshot)
  const expectedNow = createHash('sha256').update(JSON.stringify({ candidate: observed.fingerprint, plan })).digest('hex')
  if (!apply) return { state: 'preview', fingerprint: expectedNow, snapshot, plan }
  if (expectedNow !== expected) throw Error('preview is stale; inspect current plan and candidate')
  const journal = journalFor(snapshot, 'submit', expected), scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const git = args => run('git', args, { cwd: snapshot.root })
  try {
    // Check every declared body at its layer before the first remote mutation.
    try {
      for (const [i, entry] of plan.entries()) {
        git(['switch', entry.branch])
        const body = bodies[i]
        if (body.includes('```harness-doc-sync')) run(process.execPath,
          [path.join(scriptDir, 'check-document-sync.mjs'), '--repo', snapshot.root, '--record', '/dev/stdin', '--committed'],
          { cwd: snapshot.root, input: body })
      }
    } finally { git(['switch', snapshot.currentBranch]) }
    observed = observeStack({ cwd: snapshot.root })
    assertAllowed(observed.localCheck); assertAllowed(observed.remoteCheck)
    if (fingerprint(observed.snapshot) !== fingerprint(snapshot)) throw Error('candidate changed during body validation')
    journal.effect('push-observed-refs', () => pushObserved(git, snapshot))
    observed = observeStack({ cwd: snapshot.root }); sameLocalCandidate(snapshot, observed.snapshot)
    assertAllowed(observed.localCheck); assertAllowed(observed.remoteCheck)
    if (observed.snapshot.layers.some(l => l.remoteOid !== l.headOid)) throw Error('push did not update every expected ref')
    for (const [i, entry] of plan.entries()) {
      git(['switch', entry.branch])
      observed = observeStack({ cwd: snapshot.root }); sameLocalCandidate(snapshot, observed.snapshot)
      assertAllowed(observed.localCheck); assertAllowed(observed.remoteCheck)
      if (observed.snapshot.layers[i].prUrl) continue
      const args = [path.join(scriptDir, 'pr-create.sh'), '--stack', '--base', snapshot.layers[i].parent,
        '--title', entry.title, '--body-file', '/dev/stdin']
      if (i > 0) args.push('--draft')
      journal.effect(`create:${entry.branch}`, () => run('bash', args, { cwd: snapshot.root, input: bodies[i] }))
    }
    git(['switch', snapshot.currentBranch])
    observed = observeStack({ cwd: snapshot.root }); sameLocalCandidate(snapshot, observed.snapshot)
    assertAllowed(observed.localCheck); assertAllowed(observed.remoteCheck)
    const urls = observed.snapshot.layers.map(l => l.prUrl)
    if (urls.some(u => !u)) throw Error('PR creation not confirmed')
    urls.forEach(url => prNumber(url, snapshot.repo))
    if (urls.length > 1) journal.effect('official-link', () => observed.gh(['stack', 'link', '--base', snapshot.trunk, '--remote', 'origin', ...urls]))
    observed = observeStack({ cwd: snapshot.root }); sameLocalCandidate(snapshot, observed.snapshot)
    assertAllowed(observed.localCheck)
    assertAllowed(validateRemoteStack(observed.snapshot, observed.prs, observed.remote, { requireLinked: true }))
    journal.data.state = 'confirmed'; journal.data.after = observed.snapshot; journal.save()
    return { state: 'confirmed', journal: journal.file, prs: urls }
  } catch (e) {
    journal.data.state = 'unverified'; journal.data.reason = e.message
    try { journal.data.after = observeStack({ cwd: snapshot.root }).snapshot } catch { journal.data.readback = 'unverified' }
    journal.save()
    // Do not retry, delete successful PRs/refs, or force a checkout over a dirty worktree.
    return { state: 'unverified', reason: e.message, journal: journal.file }
  }
}
export function main(args) {
  const action = args.shift()
  if (action === 'check-create') {
    let base, draft = false
    while (args.length) {
      const a = args.shift()
      if (a === '--base' && !base) base = args.shift()
      else if (a === '--draft' && !draft) draft = true
      else throw Error('invalid stack create arguments')
    }
    console.log(JSON.stringify(checkCreate({ base, draft }))); return
  }
  if (action === 'inspect' && args.length === 0) {
    const { snapshot, fingerprint, localCheck, remoteCheck } = observeStack({ operation: 'submit' })
    console.log(JSON.stringify({ snapshot, fingerprint, localCheck, remoteCheck }, null, 2))
    if (!localCheck.allowed || !remoteCheck.allowed) process.exitCode = 1
    return
  }
  if (['submit', 'restack', 'sync'].includes(action)) {
    const options = {}
    while (args.length) {
      const key = args.shift()
      if (key === '--apply' && !options.apply) options.apply = true
      else if (key === '--resume' && action !== 'submit' && !options.resume && args.length) options.resume = args.shift()
      else if (key === '--plan' && action === 'submit' && !options.planFile && args.length) options.planFile = args.shift()
      else if (key === '--expected' && !options.expected && args.length) options.expected = args.shift()
      else throw Error('invalid submit options')
    }
    const result = action === 'submit' ? submit(options) : rebaseStack({ ...options, action }); console.log(JSON.stringify(result, null, 2))
    if (result.state === 'unverified') process.exitCode = 1
    return
  }
  throw Error('usage: stack.mjs inspect | check-create --base <parent> [--draft] | submit --plan <file> [--apply --expected <fingerprint>] | restack|sync [--resume <journal>] [--apply --expected <fingerprint>]')
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)) } catch (e) { console.error(`stack: ${e.message}`); process.exitCode = 1 }
}

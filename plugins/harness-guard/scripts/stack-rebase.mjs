// Native local rebase owns conflicts/abort. Harness owns the observed publication boundary.
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { assertAllowed, fingerprint, journalFor, observeStack, prIdentity, pushObserved, run } from './stack.mjs'
import { validateStack } from './stack-policy.mjs'

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
function commonDir(root) {
  return realpathSync(path.resolve(root, run('git', ['rev-parse', '--git-common-dir'], { cwd: root })))
}
function recoveryPending(root) {
  const gitDir = path.resolve(root, run('git', ['rev-parse', '--git-dir'], { cwd: root }))
  return [path.join(commonDir(root), 'gh-stack-rebase-state'), path.join(gitDir, 'gh-stack-rebase-state'),
    path.join(gitDir, 'rebase-merge'), path.join(gitDir, 'rebase-apply')].some(p => existsSync(p))
}
function metadata(prs) {
  return prs.map(p => {
    if (!p) return null
    const result = prIdentity(p)
    delete result.head.sha; delete result.base.sha
    if (result.stack) result.stack = { id: result.stack.id, number: result.stack.number,
      size: result.stack.size, position: result.stack.position, base: result.stack.base?.ref }
    return result
  })
}
function sameContext(data, observed) {
  const b = data.before, a = observed.snapshot
  if (b.repo !== a.repo || b.root !== a.root || b.trunk !== a.trunk || b.trunkOid !== a.trunkOid
    || b.currentBranch !== a.currentBranch || !equal(data.policy, observed.policy)
    || !equal(metadata(data.prs), metadata(observed.prs))
    || !equal(b.layers.map(l => [l.branch, l.parent, l.merged]), a.layers.map(l => [l.branch, l.parent, l.merged])))
    throw Error('stack context, policy, PR relationship, or trunk changed during rebase; inspect before continuing')
  if (a.localTrunkOid !== (data.action === 'sync' ? b.trunkOid : b.localTrunkOid))
    throw Error('local trunk changed outside the observed synchronization target')
  assertAllowed(validateStack(a, observed.policy, { allowRewritten: true }))
  assertAllowed(observed.remoteCheck)
}
function ready(snapshot) {
  for (const layer of snapshot.layers.filter(l => !l.merged)) {
    if (!layer.parentIsAncestor || layer.uniqueCommits < 1) throw Error(`rebase not complete for ${layer.branch}; no refs published`)
  }
}
function loadJournal(file, root, action) {
  const directory = path.join(commonDir(root), 'harness-stack')
  const stat = lstatSync(file)
  if (!stat.isFile() || stat.isSymbolicLink() || realpathSync(path.dirname(file)) !== realpathSync(directory)
    || (stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid())) throw Error('unsafe recovery journal')
  const data = JSON.parse(readFileSync(file, 'utf8'))
  if (data.schemaVersion !== 1 || data.action !== action || data.before?.root !== root
    || !Array.isArray(data.effects) || !data.policy || !Array.isArray(data.prs)) throw Error('journal does not match this operation/worktree')
  const save = () => writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 })
  return { file, data, save, effect(kind, call) {
    const entry = { kind, state: 'unknown' }; data.effects.push(entry); save()
    const result = call(); entry.state = 'returned'; save(); return result
  } }
}
function remoteState(data, snapshot) {
  const active = snapshot.layers.filter(l => !l.merged)
  const original = new Map(data.before.layers.map(l => [l.branch, l.remoteOid]))
  if (active.every(l => l.remoteOid === l.headOid)) return 'published'
  if (active.every(l => l.remoteOid === original.get(l.branch))) return 'original'
  throw Error('remote refs changed after preflight; preserve the other writer and inspect the journal')
}
export function rebaseStack({ action, apply = false, expected, resume, cwd = process.cwd() }) {
  if (!['restack', 'sync'].includes(action)) throw Error('unknown local rebase operation')
  const root = realpathSync(run('git', ['rev-parse', '--show-toplevel'], { cwd }))
  if (recoveryPending(root)) throw Error('native rebase recovery is pending; resolve then gh stack rebase --continue, or explicitly --abort, before resuming this journal')
  let observed = observeStack({ cwd: root, operation: action }), journal
  if (resume) {
    journal = loadJournal(resume, root, action)
    sameContext(journal.data, observed)
    if (journal.data.local && !equal(journal.data.local.layers.map(l => l.headOid), observed.snapshot.layers.map(l => l.headOid)))
      throw Error('local refs changed after recorded rebase; do not silently resume another candidate')
    remoteState(journal.data, observed.snapshot)
  } else {
    assertAllowed(observed.localCheck); assertAllowed(observed.remoteCheck)
  }
  const now = digest({ action, candidate: fingerprint(observed.snapshot), prs: observed.prs.map(p => p && prIdentity(p)),
    policy: observed.policy, recovery: journal?.data || null })
  if (!apply) return { state: 'preview', action, fingerprint: now, snapshot: observed.snapshot,
    resume: resume || null, engine: action === 'restack' ? 'gh stack rebase --no-trunk' : 'gh stack rebase --remote origin' }
  if (expected !== now) throw Error('preview is stale; inspect current rebase candidate')
  if (!journal) {
    journal = journalFor(observed.snapshot, action, expected)
    journal.data.policy = observed.policy; journal.data.prs = observed.prs; journal.save()
  }
  const git = args => run('git', args, { cwd: root })
  try {
    if (!resume) journal.effect('native-rebase', () => observed.gh(['stack', 'rebase', ...(action === 'restack' ? ['--no-trunk'] : ['--remote', 'origin'])]))
    if (recoveryPending(root)) throw Error('native rebase is incomplete; use its continue/abort recovery before publication')
    observed = observeStack({ cwd: root, operation: action }); sameContext(journal.data, observed)
    // An explicit native abort restores the original local candidate. Never re-run it on resume.
    if (resume && !journal.data.local && equal(journal.data.before.layers.map(l => l.headOid), observed.snapshot.layers.map(l => l.headOid))) {
      journal.data.state = 'aborted'; journal.data.after = observed.snapshot; journal.save()
      return { state: 'aborted', journal: journal.file }
    }
    ready(observed.snapshot)
    let state = remoteState(journal.data, observed.snapshot)
    journal.data.local = observed.snapshot; journal.save() // Persist immutable intended sources before any push.
    if (state === 'original') {
      const expectedRefs = new Map(journal.data.before.layers.map(l => [l.branch, l.remoteOid]))
      const publication = { ...observed.snapshot, layers: observed.snapshot.layers.filter(l => !l.merged)
        .map(l => ({ ...l, remoteOid: expectedRefs.get(l.branch) })) }
      journal.effect('push-observed-refs', () => pushObserved(git, publication))
    }
    observed = observeStack({ cwd: root, operation: action }); sameContext(journal.data, observed)
    if (!equal(journal.data.local.layers.map(l => l.headOid), observed.snapshot.layers.map(l => l.headOid))
      || remoteState(journal.data, observed.snapshot) !== 'published') throw Error('publication readback does not match rebased candidate')
    journal.data.state = 'confirmed'; journal.data.after = observed.snapshot; journal.save()
    return { state: 'confirmed', journal: journal.file, snapshot: observed.snapshot }
  } catch (e) {
    journal.data.state = 'unverified'; journal.data.reason = e.message
    try { journal.data.after = observeStack({ cwd: root, operation: action }).snapshot } catch { journal.data.readback = 'unverified' }
    journal.save()
    return { state: 'unverified', reason: e.message, journal: journal.file,
      next: 'Inspect native recovery and current refs; resume this journal without refreshing its original leases.' }
  }
}

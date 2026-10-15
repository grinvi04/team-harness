import assert from 'node:assert/strict'
import test from 'node:test'
import { validateStack, validateRemoteStack } from '../plugins/harness-guard/scripts/stack-policy.mjs'

const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40)
const policy = { schemaVersion: 1, mode: 'company', autoMergeTargets: [], branchFlow: 'git-flow',
  stackedPRs: { enabled: true, provider: 'github-gh-stack' } }
function candidate() {
  return { repo: 'org/repo', root: '/repo', trunk: 'develop', trunkOid: a, currentBranch: 'codex/b',
    layers: [
      { branch: 'codex/a', parent: 'develop', headOid: b, remoteOid: b, remoteIsAncestor: true, parentIsAncestor: true, uniqueCommits: 1, prUrl: 'https://github.com/org/repo/pull/11', draft: false, merged: false, queued: false },
      { branch: 'codex/b', parent: 'codex/a', headOid: c, remoteOid: null, remoteIsAncestor: true, parentIsAncestor: true, uniqueCommits: 1, prUrl: null, draft: true, merged: false, queued: false },
    ], worktrees: [{ path: '/repo', branch: 'codex/b', dirty: false, locked: false }], operation: 'submit' }
}
const allowed = s => validateStack(s, policy).allowed
// Removing any refusal below permits a wrong or unreviewed ref to reach an engine mutation.
test('registered same-repo linear bootstrap is allowed without remote membership', () => assert.equal(allowed(candidate()), true))
for (const [name, change] of [
  ['unregisteredParentRejected', s => { s.layers[1].parent = 'codex/stranger' }],
  ['protectedRefRejected', s => { s.layers[0].branch = 'main'; s.layers[1].parent = 'main' }],
  ['staleRemoteRejected', s => { s.layers[0].remoteIsAncestor = false }],
  ['dirtyOwnerPreserved', s => { s.worktrees[0].dirty = true }],
  ['otherWorktreePreserved', s => { s.worktrees.push({ path: '/another-writer', branch: 'codex/a', dirty: false, locked: false }) }],
  ['numericBranchNotPushed', s => { s.layers[0].branch = '11'; s.layers[1].parent = '11' }],
  ['foreignPrUrlRejected', s => { s.layers[0].prUrl = 'https://github.com/other/repo/pull/11' }],
  ['nonlinearHistoryRejected', s => { s.layers[1].parentIsAncestor = false }],
  ['parentOnlyChildNotCompleted', s => { s.layers[1].uniqueCommits = 0 }],
  ['wrongTrunkRejected', s => { s.trunk = 'main'; s.layers[0].parent = 'main' }],
  ['duplicateBranchRejected', s => { s.layers[1].branch = 'codex/a' }],
  ['unknownCurrentBranchRejected', s => { s.currentBranch = 'codex/not-in-stack' }],
  ['queuedCandidateRejected', s => { s.layers[0].queued = true }],
  ['closedLayerRequiresSync', s => { s.layers[0].merged = true }],
]) test(name, () => { const s = candidate(); change(s); assert.equal(allowed(s), false) })
test('opt-in absence never enables a parent base exception', () => {
  const p = { ...policy }; delete p.stackedPRs
  assert.equal(validateStack(candidate(), p).allowed, false)
})
test('restack may repair outdated parent history but still rejects another writer', () => {
  const s = candidate(); s.operation = 'restack'; s.layers[1].parentIsAncestor = false
  assert.equal(allowed(s), true)
  s.worktrees.push({ path: '/writer', branch: 'codex/a', dirty: false, locked: false })
  assert.equal(allowed(s), false)
})
function linked() {
  const s = candidate(); s.layers[1].prUrl = 'https://github.com/org/repo/pull/12'; s.layers[1].remoteOid = c
  const prs = s.layers.map((l, i) => ({ number: 11 + i, html_url: l.prUrl, state: 'open', merged: false, draft: i > 0,
    base: { ref: l.parent, sha: i ? b : a, repo: { full_name: 'org/repo' } },
    head: { ref: l.branch, sha: l.headOid, repo: { full_name: 'org/repo' } },
    stack: { id: 99, number: 13, size: 2, position: i + 1, base: { ref: 'develop', sha: a } } }))
  return { s, prs, remote: { id: 99, number: 13, open: true, base: { ref: 'develop' }, pull_requests: prs } }
}
test('actual linked readback confirms the exact ordered same-repo candidate', () => {
  const { s, prs, remote } = linked()
  assert.equal(validateRemoteStack(s, prs, remote, { requireLinked: true }).allowed, true)
})
for (const [name, change] of [
  ['linkWarningIsNotSuccess', x => { x.remote = null; x.prs.forEach(p => { p.stack = null }) }],
  ['readbackBaseChanged', x => { x.prs[1].base.ref = 'develop' }],
  ['readbackHeadChanged', x => { x.prs[1].head.sha = a }],
  ['differentMembershipRejected', x => { x.prs[1].stack.id = 100 }],
  ['wrongOrderRejected', x => { x.remote.pull_requests = [...x.prs].reverse() }],
  ['unplannedLayerRejected', x => { x.remote.pull_requests = [...x.prs, { number: 20 }] }],
  ['existingUpperNotDraftRejected', x => { x.prs[1].draft = false }],
]) test(name, () => {
  const x = linked(); change(x)
  assert.equal(validateRemoteStack(x.s, x.prs, x.remote, { requireLinked: true }).allowed, false)
})

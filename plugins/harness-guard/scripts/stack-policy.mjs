// Pure policy checks over fresh Git/GitHub observations, never an authorization token.
const oid = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
const branch = value => typeof value === 'string' && /^(codex|feature|fix)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)
  && !value.includes('..') && !value.includes('//') && !value.endsWith('/') && !value.endsWith('.lock')
export function stackTrunk(policy) {
  if (policy?.stackedPRs?.enabled !== true || policy.stackedPRs.provider !== 'github-gh-stack') throw Error('stack opt-in required')
  if (!['git-flow', 'main'].includes(policy.branchFlow)) throw Error('stack requires declared branch flow')
  return policy.branchFlow === 'git-flow' ? 'develop' : 'main'
}
export function prNumber(url, repo) {
  const prefix = `https://github.com/${repo}/pull/`
  if (typeof url !== 'string' || !url.startsWith(prefix) || !/^[1-9][0-9]*$/.test(url.slice(prefix.length))) throw Error('same-repo full PR URL required')
  const number = Number(url.slice(prefix.length))
  if (!Number.isSafeInteger(number)) throw Error('invalid PR number')
  return number
}
export function validateStack(snapshot, policy, { allowRewritten = false } = {}) {
  const violations = []
  const require = (condition, message) => { if (!condition) violations.push(message) }
  try {
    const s = snapshot, trunk = stackTrunk(policy)
    require(s.trunk === trunk && oid(s.trunkOid), 'trunk must match declared flow and live OID')
    if (s.operation === 'sync') require(oid(s.localTrunkOid) && s.localTrunkIsAncestor === true, 'local trunk has unpublished/divergent commits')
    require(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s.repo), 'invalid repository identity')
    require(Array.isArray(s.layers) && s.layers.length > 0 && s.layers.length <= 100, 'stack must have 1..100 layers')
    require(['submit', 'restack', 'sync', 'inspect'].includes(s.operation), 'unknown stack operation')
    const names = new Set(), numbers = new Set()
    let parent = trunk, activeSeen = false
    for (const l of s.layers) {
      require(branch(l.branch) && !names.has(l.branch), `invalid/duplicate/protected layer: ${l.branch}`)
      names.add(l.branch)
      require(l.parent === parent && l.parent !== l.branch, `unregistered parent: ${l.branch}`)
      require(oid(l.headOid) && (l.remoteOid === null || oid(l.remoteOid)), `invalid layer OID: ${l.branch}`)
      if (!allowRewritten && !l.merged) require(l.remoteIsAncestor === true
        || (s.operation === 'sync' && l.localIsAncestor === true), `remote changed outside this candidate: ${l.branch}`)
      require(!l.merged || (s.operation === 'sync' && !activeSeen), `merged layers must be a verified prefix: ${l.branch}`)
      if (!l.merged) activeSeen = true
      if (s.operation === 'submit') {
        require(l.parentIsAncestor === true && !l.needsRebase, `restack required: ${l.branch}`)
        require(Number.isSafeInteger(l.uniqueCommits) && l.uniqueCommits > 0, `no unique layer commits: ${l.branch}`)
      }
      require(l.queued === false, `queued layer needs reconciliation: ${l.branch}`)
      if (l.prUrl !== null) {
        const n = prNumber(l.prUrl, s.repo)
        require(!numbers.has(n), 'duplicate PR'); numbers.add(n)
        require(l.merged || l.remoteOid !== null, `existing PR has no remote ref: ${l.branch}`)
      }
      if (!l.merged) parent = l.branch
    }
    require(activeSeen, 'stack has no active layers')
    require(names.has(s.currentBranch), 'current branch is not registered in this stack')
    require(Array.isArray(s.worktrees), 'worktree inventory required')
    require(s.worktrees.some(w => w.path === s.root && w.branch === s.currentBranch), 'caller worktree not found')
    for (const w of s.worktrees) {
      if (names.has(w.branch) || w.path === s.root || (s.operation !== 'submit' && w.branch === trunk)) {
        require(w.path === s.root && w.dirty === false && w.locked === false, `worktree is dirty/locked/owned elsewhere: ${w.path}`)
      }
    }
  } catch (e) { violations.push(e.message) }
  return { allowed: violations.length === 0, violations }
}
export function validateRemoteStack(snapshot, prs, remote, { requireLinked = false, requirePushed = false } = {}) {
  const violations = []
  const require = (condition, message) => { if (!condition) violations.push(message) }
  try {
    require(prs.length === snapshot.layers.length, 'PR inventory length changed')
    const allPrs = prs, allLayers = snapshot.layers
    let activeSeen = false
    for (const [i, l] of allLayers.entries()) {
      if (!l.merged) { activeSeen = true; continue }
      require(!activeSeen, 'merged layers must be a verified prefix')
      const p = allPrs[i]
      require(p?.state === 'closed' && p.merged === true && Boolean(p.merged_at), 'merged prefix not confirmed')
      require(p?.head?.repo?.full_name === snapshot.repo && p?.base?.repo?.full_name === snapshot.repo, 'foreign merged PR')
      require(p?.head?.ref === l.branch && p?.head?.sha === l.headOid, 'merged branch has unreviewed local changes')
      require(p?.html_url === l.prUrl && p?.number === prNumber(l.prUrl, snapshot.repo), 'merged PR identity mismatch')
      require(p?.stack?.position === i + 1 && p.stack.id === remote?.id && p.stack.number === remote?.number
        && p.stack.base?.ref === snapshot.trunk, 'merged stack identity/order changed')
    }
    const mergedCount = allLayers.filter(l => l.merged).length
    prs = allPrs.filter((_, i) => !allLayers[i].merged)
    snapshot = { ...snapshot, layers: allLayers.filter(l => !l.merged) }
    const members = allPrs.slice(0, mergedCount).map(p => p.number)
    for (const [i, l] of snapshot.layers.entries()) {
      const p = prs[i]
      if (!p) { require(l.prUrl === null && !requireLinked, `missing PR: ${l.branch}`); continue }
      require(p.number === prNumber(l.prUrl, snapshot.repo) && p.html_url === l.prUrl, 'PR identity mismatch')
      require(p.state === 'open' && !p.merged && !p.merged_at, 'PR is not open')
      require(p.head?.repo?.full_name === snapshot.repo && p.base?.repo?.full_name === snapshot.repo, 'fork/foreign PR refused')
      require(p.head.ref === l.branch && p.base.ref === l.parent, 'PR head/base relationship changed')
      require(p.head.sha === (requireLinked || requirePushed ? l.headOid : l.remoteOid), 'PR head changed')
      const parentOid = i ? snapshot.layers[i - 1].remoteOid : snapshot.trunkOid
      require(p.base.sha === parentOid, 'PR parent OID changed')
      require(i === 0 || p.draft === true, 'upper PR must remain draft during submission')
      if (p.stack) {
        require(p.stack.base?.ref === snapshot.trunk && p.stack.base.sha === snapshot.trunkOid, 'stack trunk changed')
        require(p.stack.position === mergedCount + i + 1, 'stack order changed')
        require(p.stack.id === remote?.id && p.stack.number === remote?.number, 'stack identity changed')
        members.push(p.number)
      } else require(!requireLinked || snapshot.layers.length === 1, 'PR link not confirmed')
    }
    if (remote) {
      require(remote.open === true && remote.base?.ref === snapshot.trunk, 'remote stack is closed or has wrong trunk')
      const actual = remote.pull_requests.map(p => p.number)
      require(actual.length === members.length && actual.every((n, i) => n === members[i]), 'remote membership/order changed')
      require(members.every((n, i) => allPrs[i]?.number === n), 'existing stack must be a prefix')
      for (const p of allPrs.filter(p => p?.stack)) require(p.stack.size === actual.length, 'stack size changed')
      if (requireLinked) require(actual.length === allLayers.length, 'not all layers linked')
    } else require(members.length === 0 && (!requireLinked || snapshot.layers.length === 1), 'remote link not confirmed')
  } catch (e) { violations.push(e.message) }
  return { allowed: violations.length === 0, violations }
}

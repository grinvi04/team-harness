#!/usr/bin/env node
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
export function readPolicy(root) {
  const file = path.join(root, '.harness-policy.json')
  let stat
  try { stat = lstatSync(file) } catch (e) { if (e.code === 'ENOENT') return { mode: 'company', autoMergeTargets: [] }; throw e }
  if (!stat.isFile()) throw Error('policy must be a regular file')
  const d = JSON.parse(readFileSync(file, 'utf8'))
  if (!d || d.schemaVersion !== 1 || !['company', 'solo'].includes(d.mode) || !Array.isArray(d.autoMergeTargets)
    || d.autoMergeTargets.some(x => x !== 'develop') || new Set(d.autoMergeTargets).size !== d.autoMergeTargets.length
    || (d.branchFlow !== undefined && !['git-flow', 'main'].includes(d.branchFlow))
    || Object.keys(d).some(x => !['schemaVersion', 'mode', 'autoMergeTargets', 'branchFlow'].includes(x))) throw Error('unsupported repo policy')
  return d
}
export function selectPrBase({ policy, explicitBase = '', branch }) {
  const flow = policy.branchFlow
  if (flow !== undefined && !['git-flow', 'main'].includes(flow)) throw Error('unsupported branch flow')
  const release = /^(release|hotfix)\/.+/.test(branch)
  if (flow === 'git-flow' && release && explicitBase !== 'main') throw Error('release/hotfix requires explicit --base main')
  const declared = flow === 'git-flow' ? 'develop' : flow === 'main' ? 'main' : ''
  const base = explicitBase || declared
  if (!base) throw Error('declare branchFlow in repo policy or provide --base')
  if (explicitBase && declared && base !== declared && !(flow === 'git-flow' && release && base === 'main')) throw Error('explicit base conflicts with repo branch flow')
  try {
    if (execFileSync('git', ['check-ref-format', '--branch', base], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() !== base) throw Error('expanded branch name')
  } catch { throw Error('invalid PR base branch') }
  if (branch === base) throw Error('PR base must differ from current branch')
  return base
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [root, action, base, explicitBase] = process.argv.slice(2)
    const d = readPolicy(root)
    if (action === 'base') console.log(selectPrBase({ policy: d, branch: base, explicitBase }))
    else if (action === 'solo' ? d.mode !== 'solo' : action === 'auto' ? !d.autoMergeTargets.includes(base) : true) throw Error('repo policy does not allow this path')
  } catch (e) { console.error(e.message); process.exitCode = 1 }
}

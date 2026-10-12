#!/usr/bin/env node
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
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
    || Object.keys(d).some(x => !['schemaVersion', 'mode', 'autoMergeTargets'].includes(x))) throw Error('unsupported repo policy')
  return d
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [root, action, base] = process.argv.slice(2)
    const d = readPolicy(root)
    if (action === 'solo' ? d.mode !== 'solo' : action === 'auto' ? !d.autoMergeTargets.includes(base) : true) throw Error('repo policy does not allow this path')
  } catch (e) { console.error(e.message); process.exitCode = 1 }
}

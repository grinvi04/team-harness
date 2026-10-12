#!/usr/bin/env node
// GitHub policy, PR required rollup and exact head REST evidence must agree.
const [head, ...raw] = process.argv.slice(2)
try {
  if (!/^[a-f0-9]{40}$/i.test(head)) throw Error('invalid head')
  const [policy, checks, runPages, statusPages] = raw.map(JSON.parse)
  if (policy.strict !== true || !Array.isArray(policy.contexts) || !Array.isArray(policy.checks)) throw Error('strict required policy unavailable')
  const required = new Map()
  for (const name of policy.contexts) {
    if (typeof name !== 'string' || !name.trim()) throw Error('invalid context')
    required.set(name, null)
  }
  for (const check of policy.checks) {
    if (!check || typeof check.context !== 'string' || !check.context.trim() || !(check.app_id === null || Number.isInteger(check.app_id) && check.app_id >= -1)) throw Error('invalid app check')
    const old = required.get(check.context)
    if (old != null && old !== check.app_id) throw Error('ambiguous app binding')
    required.set(check.context, check.app_id)
  }
  if (!required.size || !Array.isArray(checks) || !checks.length) throw Error('required checks absent')
  if (!Array.isArray(runPages) || !runPages.length || runPages.some(p => !p || !Array.isArray(p.check_runs))) throw Error('invalid check-runs')
  if (!Array.isArray(statusPages) || !statusPages.length || statusPages.some(p => !Array.isArray(p))) throw Error('invalid statuses')
  const runs = runPages.flatMap(p => p.check_runs), statuses = statusPages.flat()
  if (runs.some(r => !Number.isSafeInteger(r.id) || r.id <= 0) || statuses.some(s => !Number.isSafeInteger(s.id) || s.id <= 0)) throw Error('evidence identity unavailable')
  const rollup = new Map()
  for (const c of checks) {
    if (!c || typeof c.name !== 'string' || c.bucket !== 'pass' || rollup.has(c.name)) throw Error('required not passed or ambiguous')
    rollup.set(c.name, c.bucket)
  }
  for (const [name, app] of required) {
    if (!rollup.has(name)) throw Error(`missing required: ${name}`)
    const bound = app !== null && app !== -1
    const namedRuns = runs.filter(r => r.name === name).sort((a, b) => b.id - a.id)
    const namedStatuses = statuses.filter(s => s.context === name).sort((a, b) => b.id - a.id)
    const latestRun = namedRuns[0], latestStatus = namedStatuses[0]
    const success = namedRuns.length
      ? latestRun.head_sha === head && latestRun.status === 'completed' && latestRun.conclusion === 'success' && (!bound || latestRun.app?.id === app) && (!latestStatus || latestStatus.state === 'success')
      : !bound && latestStatus?.state === 'success'
    if (!success) throw Error(`head/app evidence unavailable: ${name}`)
  }
} catch (error) {
  console.error(`required CI UNVERIFIED: ${error.message}`)
  process.exitCode = 1
}

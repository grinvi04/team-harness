#!/usr/bin/env node
// Internal IO for pr-merge/solo-merge. This is not a gate-skipping user entrypoint.
import { execFileSync, execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPolicy } from './repo-policy.mjs'
import { observeMerge, executeMerge } from './stack-merge.mjs'
import { reserve, load, save, finish } from './stack-merge-journal.mjs'
const { startOperation, finishOperation } = await import('./observation/client.mjs').catch(() => ({ startOperation: () => null, finishOperation: () => {} }))

const here = path.dirname(fileURLToPath(import.meta.url))
let child, interrupted = false, signalCode = 0
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) process.on(signal, () => {
  interrupted = true; signalCode = code; child?.kill('SIGTERM')
})
const sync = (tool, args, options = {}) => execFileSync(tool, args, { encoding: 'utf8', timeout: 10000,
  maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options }).trim()
const git = args => sync('git', args)
const environment = repo => ({ ...process.env, GH_REPO: repo, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' })
const get = (repo, endpoint) => JSON.parse(sync('gh', ['api', '--hostname', 'github.com', '--method', 'GET', endpoint], { env: environment(repo) }))
function probe(repo, pr) {
  const first = get(repo, `repos/${repo}/pulls/${pr}`)
  let policy = null, consumed = false
  if (first.stack) {
    const root = git(['rev-parse', '--show-toplevel'])
    const origin = git(['remote', 'get-url', 'origin'])
    if (![`https://github.com/${repo}`, `https://github.com/${repo}.git`, `git@github.com:${repo}`, `git@github.com:${repo}.git`].includes(origin))
      throw Error('stack merge repository differs from origin')
    policy = readPolicy(root)
  }
  return observeMerge({ repo, pr, policy, get: endpoint => {
    if (!consumed && endpoint === `repos/${repo}/pulls/${pr}`) { consumed = true; return first }
    return get(repo, endpoint)
  } })
}
function directory() {
  const common = fs.realpathSync(git(['rev-parse', '--git-common-dir']))
  const dir = path.join(common, 'harness-stack-merges')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { mode: 0o700 })
  return dir
}
function noQueue(repo, trunk) {
  for (let page = 1; page <= 100; page++) {
    const rules = get(repo, `repos/${repo}/rules/branches/${encodeURIComponent(trunk)}?per_page=100&page=${page}`)
    if (!Array.isArray(rules) || rules.some(rule => typeof rule?.type !== 'string')) throw Error('effective branch rules unavailable')
    if (rules.some(rule => rule.type === 'merge_queue')) throw Error('solo exception is not supported with a merge queue')
    if (rules.length < 100) return
  }
  throw Error('effective rule pagination incomplete')
}
function normalizedProtection(raw) {
  return sync('bash', ['-c', 'SOLO_MERGE_SOURCE_ONLY=1 source "$1"; canonical_branch_policy', 'policy-readback', path.join(here, 'solo-merge.sh')], { input: JSON.stringify(raw) })
}
function restored(data) {
  return !data.solo || normalizedProtection(get(data.snapshot.repo,
    `repos/${data.snapshot.repo}/branches/${encodeURIComponent(data.snapshot.trunk)}/protection`)) === normalizedProtection(data.protection)
}
async function runProvider(dir, file, snapshot, resume) {
  const saved = load(dir, file), lock = `${file}.runner`
  fs.mkdirSync(lock, { mode: 0o700 })
  try {
    const timeoutMs = Number(process.env.HARNESS_STACK_WAIT_MS || 30000)
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw Error('invalid bounded wait')
    // Metadata observation precedes the bounded remote request window.
    if (!resume && JSON.stringify(probe(snapshot.repo, snapshot.pr)) !== JSON.stringify(snapshot)) throw Error('candidate changed before merge')
    let deadline
    const request = async (method, endpoint, body) => {
      if (interrupted) throw Error('interrupted; remote outcome must be read before another request')
      deadline ??= Date.now() + timeoutMs
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw Error('bounded request deadline reached')
      const args = ['api', '--hostname', 'github.com', '--include', '--method', method, endpoint]
      if (body) args.push('--input', '-')
      return await new Promise((resolve, reject) => {
        child = execFile('gh', args, { env: environment(snapshot.repo), encoding: 'utf8', timeout: Math.min(10000, remaining),
          killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
          child = null
          if (interrupted) { reject(Error('interrupted; request outcome unverified')); return }
          const match = /^HTTP\/[^\s]+\s+(\d+)[^\r\n]*\r?\n[\s\S]*?\r?\n\r?\n([\s\S]*)$/.exec(stdout)
          if (!match) { reject(Error(error ? 'request response unavailable' : 'HTTP response malformed')); return }
          try { resolve({ status: Number(match[1]), body: JSON.parse(match[2]) }) } catch { reject(Error('response JSON malformed')) }
        })
        child.stdin.on('error', () => {})
        child.stdin.end(body ? JSON.stringify(body) : '')
      })
    }
    const outcome = await executeMerge({ snapshot, observe: () => snapshot, request, timeoutMs,
      save: data => save(dir, file, { ...load(dir, file), ...data }), ...(resume ? { resume: saved } : {}) })
    // The solo owner restores protection after its provider child has stopped.
    if (!saved.solo) finish(dir, file, { restored: true })
    return outcome
  } finally { fs.rmdirSync(lock) }
}
async function observedProvider(dir, file, snapshot, resume) {
  const observation = startOperation('stack', { candidate: { headSha: snapshot.headOid, baseSha: snapshot.trunkOid } })
  let outcome
  try { outcome = await runProvider(dir, file, snapshot, resume); return outcome }
  finally {
    const fields = { merged: ['pass', 'MERGED'], failed: ['fail', 'MERGE_FAILED'],
      pending: ['pending', 'MERGE_PENDING'], enqueued: ['enqueued', 'MERGE_PENDING'] }[outcome?.state] || ['unverified', 'RESULT_UNVERIFIED']
    finishOperation(observation, { outcome: fields[0], reasonCode: fields[1] })
  }
}
try {
  const [action, first, second, third, fourth] = process.argv.slice(2)
  if (action === 'probe') console.log(JSON.stringify(probe(first, Number(second))))
  else if (action === 'prepare-solo') {
    const snapshot = JSON.parse(first), protection = JSON.parse(second)
    if (JSON.stringify(probe(snapshot.repo, snapshot.pr)) !== JSON.stringify(snapshot)) throw Error('solo candidate changed')
    const trunk = snapshot.kind === 'stack' ? snapshot.trunk : snapshot.identity.base.ref
    noQueue(snapshot.repo, trunk)
    console.log(reserve(directory(), { ...snapshot, trunk }, { solo: true, protection }).file)
  } else if (action === 'finish') {
    const dir = directory(), data = load(dir, first)
    const verified = restored(data)
    const result = finish(dir, first, { restored: verified })
    console.log(JSON.stringify(result))
    if (!verified) throw Error('protection restoration unverified; reservation retained')
  } else if (action === 'merge') {
    const snapshot = JSON.parse(third), dir = directory()
    if (snapshot.repo !== first || snapshot.pr !== Number(second) || snapshot.kind !== 'stack') throw Error('candidate identity mismatch')
    const file = fourth || reserve(dir, snapshot).file
    const data = load(dir, file)
    if (JSON.stringify(data.snapshot) !== JSON.stringify(snapshot) || data.requestStarted || data.state !== 'reserved')
      throw Error(`existing merge is not a fresh reservation: ${file}`)
    const outcome = await observedProvider(dir, file, snapshot, false)
    console.log(JSON.stringify({ ...outcome, journal: file }))
    if (outcome.state !== 'merged') process.exitCode = 1
  } else if (action === 'resume') {
    const dir = directory(), data = load(dir, first)
    if (data.snapshot.kind !== 'stack') throw Error('ordinary solo record requires protection readback via finish')
    const outcome = await observedProvider(dir, first, data.snapshot, true)
    if (data.solo) finish(dir, first, { restored: restored(load(dir, first)) })
    console.log(JSON.stringify({ ...outcome, journal: first }))
    if (outcome.state !== 'merged') process.exitCode = 1
  } else throw Error('internal actions: probe, prepare-solo, merge, resume, finish')
} catch (e) { console.error(`stack merge: ${e.message}`); process.exitCode = 1 }
if (signalCode) process.exitCode = signalCode

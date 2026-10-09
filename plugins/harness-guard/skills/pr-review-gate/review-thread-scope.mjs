#!/usr/bin/env node
// Explicit reviewed snapshot boundary; gh remains the native API client.
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const fail = message => { throw new Error(message) }
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string' && value.trim().length > 0
const repoValid = value => typeof value === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)
const idValid = value => typeof value === 'string' && /^[A-Za-z0-9_+=/-]+$/.test(value)
const positive = value => Number.isSafeInteger(value) && value > 0
const fields = ['baseRefName', 'baseRefOid', 'headRefName', 'headRefOid']

function candidate(value) {
  if (!object(value)) fail('Malformed PR candidate')
  const result = {}
  for (const key of fields) {
    const pattern = key.endsWith('Oid') ? /^[0-9a-fA-F]{40}$/ : /^[^\s|\x00-\x1f\x7f]+$/
    if (typeof value[key] !== 'string' || !pattern.test(value[key])) fail('Malformed PR candidate field: ' + key)
    result[key] = value[key]
  }
  return result
}
function sameCandidate(left, right) {
  return fields.every(key => left[key] === right[key])
}
function gh(args) {
  let raw
  try { raw = execFileSync('gh', args, { encoding: 'utf8', stdio: 'pipe', maxBuffer: 4 * 1024 * 1024 }) }
  catch { fail('GitHub request failed: ' + args[0]) }
  let value
  try { value = JSON.parse(raw) } catch { fail('Malformed GitHub JSON') }
  if (value?.errors?.length) fail('GitHub GraphQL errors')
  return value
}
function readCandidate(repo, pr) {
  return candidate(gh(['pr', 'view', String(pr), '--repo', repo, '--json', fields.join(',')]))
}
function assertCandidate(snapshot) {
  if (!sameCandidate(snapshot.candidate, readCandidate(snapshot.repo, snapshot.pr))) fail('PR head/base changed; review current candidate again')
}
function threads(repo, pr) {
  const [owner, name] = repo.split('/')
  const result = [], ids = new Set(), cursors = new Set()
  let cursor = null
  do {
    const query = 'query($owner:String!,$name:String!,$pr:Int!,$after:String){repository(owner:$owner,name:$name){pullRequest(number:$pr){reviewThreads(first:100,after:$after){nodes{id isResolved comments(first:1){nodes{databaseId}}} pageInfo{hasNextPage endCursor}}}}}'
    const args = ['api', 'graphql', '-f', 'query=' + query, '-F', 'owner=' + owner, '-F', 'name=' + name, '-F', 'pr=' + pr]
    if (cursor !== null) args.push('-f', 'after=' + cursor)
    const page = gh(args)?.data?.repository?.pullRequest?.reviewThreads
    if (!object(page) || !Array.isArray(page.nodes) || !object(page.pageInfo) || typeof page.pageInfo.hasNextPage !== 'boolean') fail('Malformed review thread page')
    for (const thread of page.nodes) {
      const commentId = thread?.comments?.nodes?.[0]?.databaseId
      if (!idValid(thread?.id) || typeof thread.isResolved !== 'boolean' || !positive(commentId) || ids.has(thread.id)) fail('Malformed/duplicate review thread or root comment')
      ids.add(thread.id)
      result.push({ id: thread.id, commentId, isResolved: thread.isResolved })
    }
    if (!page.pageInfo.hasNextPage) break
    cursor = page.pageInfo.endCursor
    if (!text(cursor) || cursors.has(cursor)) fail('Missing/repeated review thread cursor')
    cursors.add(cursor)
  } while (true)
  return result
}
function snapshotValid(value) {
  if (!object(value) || !repoValid(value.repo) || !positive(value.pr) || !Array.isArray(value.threads)) fail('Malformed review snapshot')
  value.candidate = candidate(value.candidate)
  const ids = new Set(), comments = new Set()
  for (const thread of value.threads) {
    if (!object(thread) || !idValid(thread.id) || !positive(thread.commentId) || ids.has(thread.id) || comments.has(thread.commentId)) fail('Malformed/duplicate snapshot thread')
    ids.add(thread.id); comments.add(thread.commentId)
  }
  return value
}
function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { fail('Cannot read valid JSON input') }
}
function resolve(snapshotPath, processedPath) {
  const snapshot = snapshotValid(readJson(snapshotPath))
  const processed = readJson(processedPath)
  if (!object(processed) || processed.repo !== snapshot.repo || processed.pr !== snapshot.pr ||
    !sameCandidate(snapshot.candidate, candidate(processed.candidate)) || !Array.isArray(processed.threads)) fail('Processed review does not match snapshot')
  const saved = new Map(snapshot.threads.map(thread => [thread.id, thread])), seen = new Set()
  // Validate the entire selection before making any mutation; no freshly queried ID expands it.
  for (const entry of processed.threads) {
    if (!object(entry) || !idValid(entry.threadId) || seen.has(entry.threadId) || !saved.has(entry.threadId) || !text(entry.reply) || !text(entry.evidence)) fail('Malformed/duplicate/out-of-snapshot processed thread or missing reply/evidence')
    seen.add(entry.threadId)
  }
  assertCandidate(snapshot)
  const live = new Map(threads(snapshot.repo, snapshot.pr).map(thread => [thread.id, thread]))
  for (const entry of processed.threads) {
    if (live.get(entry.threadId)?.commentId !== saved.get(entry.threadId).commentId) fail('Reviewed thread root comment changed/missing')
  }
  assertCandidate(snapshot)
  const resolvedIds = []
  for (const entry of processed.threads) {
    if (live.get(entry.threadId).isResolved) continue
    assertCandidate(snapshot)
    const commentId = saved.get(entry.threadId).commentId
    const reply = gh(['api', `repos/${snapshot.repo}/pulls/${snapshot.pr}/comments/${commentId}/replies`, '-f', 'body=' + entry.reply])
    if (!positive(reply?.id) || reply.in_reply_to_id !== commentId) fail('Reply did not attach to reviewed root comment')
    assertCandidate(snapshot)
    const result = gh(['api', 'graphql', '-f', 'query=mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{id isResolved}}}', '-F', 'id=' + entry.threadId])
    const thread = result?.data?.resolveReviewThread?.thread
    if (thread?.id !== entry.threadId || thread.isResolved !== true) fail('Thread resolution not confirmed')
    resolvedIds.push(entry.threadId)
  }
  // New/unprocessed threads remain unresolved and block readiness. Requery failures never become zero.
  const unresolvedIds = threads(snapshot.repo, snapshot.pr).filter(thread => !thread.isResolved).map(thread => thread.id)
  assertCandidate(snapshot)
  console.log(JSON.stringify({ resolvedIds, unresolvedIds, ready: unresolvedIds.length === 0 }))
  if (unresolvedIds.length) process.exitCode = 1
}

try {
  const [command, ...args] = process.argv.slice(2), options = {}
  for (let i = 0; i < args.length; i += 2) {
    if (!/^--(?:repo|pr|output|snapshot|processed)$/.test(args[i]) || !text(args[i + 1]) || options[args[i]]) fail('Unknown/missing/duplicate option')
    options[args[i]] = args[i + 1]
  }
  if (command === 'snapshot') {
    if (!repoValid(options['--repo']) || !/^[1-9]\d*$/.test(options['--pr'] ?? '') || !positive(Number(options['--pr'])) || !text(options['--output']) || Object.keys(options).length !== 3) fail('Usage: snapshot --repo owner/repo --pr number --output new.json')
    const snapshot = { repo: options['--repo'], pr: Number(options['--pr']), candidate: readCandidate(options['--repo'], options['--pr']) }
    snapshot.threads = threads(snapshot.repo, snapshot.pr).filter(thread => !thread.isResolved).map(({ id, commentId }) => ({ id, commentId }))
    snapshotValid(snapshot)
    assertCandidate(snapshot)
    writeFileSync(options['--output'], JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' })
    console.log('Review snapshot created; review contents before authoring processed entries.')
  } else if (command === 'resolve') {
    if (!text(options['--snapshot']) || !text(options['--processed']) || Object.keys(options).length !== 2) fail('Usage: resolve --snapshot review.json --processed processed.json')
    resolve(options['--snapshot'], options['--processed'])
  } else fail('Expected snapshot or resolve command')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}

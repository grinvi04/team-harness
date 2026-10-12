#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const stateName = '.harness-assets.json'
// Compare portable path identities without rewriting the caller's Git paths.
const pathKey = value => value.normalize('NFC').toLowerCase()
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
function git(root, ...args) {
  return execFileSync('git', ['--no-optional-locks', '--no-replace-objects', '--literal-pathspecs', '-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function stat(file) {
  try { return fs.lstatSync(file) } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}
function relativePath(value) {
  if (typeof value !== 'string' || !value || /[\\\x00-\x1f\x7f]/.test(value) || path.posix.isAbsolute(value) || value.split('/').some(part => !part || part === '.' || part === '..' || pathKey(part) === '.git' || pathKey(part) === stateName) || value === stateName) {
    throw new Error(`unsafe asset path: ${value}`)
  }
  return value
}
function checkedPath(root, relative) {
  const pieces = relative.split('/')
  let current = root
  for (let index = 0; index < pieces.length; index++) {
    current = path.join(current, pieces[index])
    const info = stat(current)
    if (!info) continue
    if (info.isSymbolicLink()) throw new Error(`symlink path refused: ${relative}`)
    if (info.isDirectory() && stat(path.join(current, '.git'))) throw new Error(`nested Git repository path refused: ${relative}`)
    if (index < pieces.length - 1 && !info.isDirectory()) throw new Error(`non-directory asset path: ${relative}`)
    if (index === pieces.length - 1 && (!info.isFile() || info.nlink > 1)) throw new Error(`asset path must be a regular unshared file: ${relative}`)
  }
  return current
}
function gitRoot(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(`${label} requires an absolute directory`)
  const root = path.resolve(value), info = stat(root)
  if (!info?.isDirectory() || info.isSymbolicLink() || fs.realpathSync(root) !== root) throw new Error(`${label} must be a real directory without symlink path`)
  if (fs.realpathSync(git(root, 'rev-parse', '--show-toplevel')) !== root) throw new Error(`${label} must be the Git repository root`)
  return root
}
function mappings(assets) {
  if (!Array.isArray(assets) || !assets.length) throw new Error('plan requires a nonempty assets array')
  const result = assets.map(asset => {
    if (!asset || typeof asset !== 'object') throw new Error('invalid asset mapping')
    return { source: relativePath(asset.source), destination: relativePath(asset.destination) }
  })
  const destinations = result.map(asset => pathKey(asset.destination))
  if (new Set(destinations).size !== destinations.length || destinations.some(a => destinations.some(b => a !== b && b.startsWith(`${a}/`)))) throw new Error('duplicate or overlapping destination path')
  return result
}
function readState(repo) {
  const file = checkedPath(repo, stateName)
  if (!stat(file)) return null
  const bytes = fs.readFileSync(file)
  const state = JSON.parse(bytes)
  if (state.schemaVersion !== 1 || !state.source || !/^[0-9a-f]{40}$/.test(state.source.sha) || typeof state.source.version !== 'string') throw new Error('invalid ownership manifest')
  mappings(state.assets)
  for (const asset of state.assets) {
    if (!/^[0-9a-f]{64}$/.test(asset.hash) || ![0o644, 0o755].includes(asset.mode)) throw new Error('invalid ownership baseline')
  }
  return { record: state, bytes, mode: fs.statSync(file).mode & 0o777 }
}
function baseline(repo, state) {
  for (const asset of state?.assets || []) {
    const file = checkedPath(repo, asset.destination), info = stat(file)
    if (!info || digest(fs.readFileSync(file)) !== asset.hash || (info.mode & 0o777) !== asset.mode) throw new Error(`modified managed asset: ${asset.destination}`)
  }
}
function provenance(options) {
  if (!/^[0-9a-f]{40}$/.test(options.revision || '')) throw new Error('revision must be a full lowercase 40-character commit SHA')
  const source = gitRoot(options.source, 'source')
  if (git(source, 'status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none')) throw new Error('source Git checkout must be clean')
  if (git(source, 'rev-parse', '--verify', 'HEAD^{commit}') !== options.revision) throw new Error('source revision pin does not match HEAD')
  if (options.version) {
    if (!/^v\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(options.version)) throw new Error('version must be an explicit release tag (vX.Y.Z)')
    if (git(source, 'rev-parse', '--verify', `refs/tags/${options.version}^{commit}`) !== options.revision) throw new Error('release tag version does not match revision pin')
  }
  return { root: source, sha: options.revision, version: options.version || `unreleased:${options.revision}` }
}
// Each rename is atomic. A caught error restores the whole transaction; this is not crash recovery.
function transact(repo, changes, io) {
  const createdDirectories = [], staged = [], originals = [], committed = []
  const write = io.writeFileSync || fs.writeFileSync
  const rename = io.renameSync || fs.renameSync
  const unlink = io.unlinkSync || fs.unlinkSync
  try {
    for (const change of changes) {
      const file = checkedPath(repo, change.destination), info = stat(file)
      const bytes = info ? fs.readFileSync(file) : null
      if (change.expected === null ? info : !info || digest(bytes) !== change.expected.hash || (info.mode & 0o777) !== change.expected.mode) throw new Error(`destination changed during preflight: ${change.destination}`)
      originals.push({ file, bytes, mode: info?.mode & 0o777, relative: change.destination })
      const missing = []
      let dir = path.dirname(file)
      while (!stat(dir)) { missing.push(dir); dir = path.dirname(dir) }
      for (const directory of missing.reverse()) { fs.mkdirSync(directory); createdDirectories.push(directory) }
      if (change.bytes !== null) {
        const temporary = path.join(path.dirname(file), `.harness-asset-${randomUUID()}`)
        staged.push({ file, temporary, change })
        write(temporary, change.bytes, { flag: 'wx', mode: change.mode })
        fs.chmodSync(temporary, change.mode)
      } else staged.push({ file, temporary: null, change })
    }
    for (const original of originals) {
      const file = checkedPath(repo, original.relative), info = stat(file)
      if (original.bytes === null ? info : !info || !fs.readFileSync(file).equals(original.bytes) || (info.mode & 0o777) !== original.mode) throw new Error(`destination changed during staging: ${original.relative}`)
    }
    for (const item of staged) {
      if (item.temporary) rename(item.temporary, item.file)
      else unlink(item.file)
      committed.push(item.file)
    }
  } catch (error) {
    const failures = []
    for (const original of originals.reverse()) {
      if (!committed.includes(original.file)) continue
      try {
        if (original.bytes === null) { if (stat(original.file)) fs.unlinkSync(original.file) }
        else {
          fs.writeFileSync(original.file, original.bytes, { mode: original.mode })
          fs.chmodSync(original.file, original.mode)
        }
      } catch (restoreError) { failures.push(`${original.file}: ${restoreError.message}`) }
    }
    for (const item of staged) { if (item.temporary && stat(item.temporary)) fs.unlinkSync(item.temporary) }
    for (const directory of createdDirectories.reverse()) {
      try { fs.rmdirSync(directory) } catch (restoreError) { failures.push(`${directory}: ${restoreError.message}`) }
    }
    if (failures.length) throw new Error(`${error.message}; rollback incomplete: ${failures.join('; ')}`)
    throw error
  }
}
export function manageRepoAssets(options, io = {}) {
  if (!['apply', 'update', 'remove'].includes(options.action)) throw new Error('action must be apply, update or remove')
  const repo = gitRoot(options.repo, 'repo'), source = provenance(options)
  if (repo === source.root || repo.startsWith(`${source.root}/`) || source.root.startsWith(`${repo}/`)) throw new Error('source and destination repositories must be separate')
  const plan = mappings(JSON.parse(fs.readFileSync(options.plan, 'utf8')).assets)
  const ownership = readState(repo), state = ownership?.record
  if (options.action !== 'apply' && !state) throw new Error('action requires an ownership manifest')
  baseline(repo, state)
  if (state) {
    const existing = state.assets.map(asset => asset.destination).sort()
    if (JSON.stringify(existing) !== JSON.stringify(plan.map(asset => asset.destination).sort())) throw new Error('plan must select exactly the recorded destinations; remove before changing selection')
    if (options.action === 'apply' && (state.source.sha !== source.sha || state.source.version !== source.version || plan.some(asset => !state.assets.some(old => old.source === asset.source && old.destination === asset.destination)))) throw new Error('apply source differs from ownership record; use update')
  }
  const assets = [], changes = []
  for (const asset of plan) {
    const destination = checkedPath(repo, asset.destination)
    if (!state && stat(destination)) throw new Error(`unowned destination already exists: ${asset.destination}`)
    if (options.action === 'remove') { changes.push({ destination: asset.destination, bytes: null }); continue }
    const file = checkedPath(source.root, asset.source)
    if (!stat(file)) throw new Error(`source asset missing: ${asset.source}`)
    const entry = git(source.root, 'ls-tree', source.sha, '--', asset.source)
    const match = /^(100644|100755) blob ([0-9a-f]{40})\t/.exec(entry)
    if (!match) throw new Error(`source asset must be a tracked regular file: ${asset.source}`)
    const bytes = fs.readFileSync(file)
    const committed = execFileSync('git', ['--no-replace-objects', '-C', source.root, 'cat-file', 'blob', match[2]], { stdio: ['ignore', 'pipe', 'pipe'] })
    if (!bytes.equals(committed)) throw new Error(`source asset does not match pinned Git blob: ${asset.source}`)
    const mode = match[1] === '100755' ? 0o755 : 0o644
    const record = { ...asset, hash: digest(bytes), mode }
    assets.push(record)
    const old = state?.assets.find(item => item.destination === asset.destination)
    if (!old || old.hash !== record.hash || old.mode !== mode) changes.push({ destination: asset.destination, bytes, mode })
  }
  const originalState = ownership?.bytes || null
  const nextState = options.action === 'remove' ? null : Buffer.from(`${JSON.stringify({ schemaVersion: 1, source: { sha: source.sha, version: source.version }, assets }, null, 2)}\n`)
  if (nextState === null || !originalState?.equals(nextState)) changes.push({ destination: stateName, bytes: nextState, mode: 0o644 })
  const result = { action: options.action, mode: options.apply ? 'apply' : 'preview', source: { sha: source.sha, version: source.version }, changes: changes.map(change => ({ destination: change.destination, operation: change.bytes === null ? 'remove' : stat(path.join(repo, change.destination)) ? 'update' : 'create' })) }
  if (options.apply && changes.length) {
    for (const change of changes) {
      if (change.destination === stateName) change.expected = originalState ? { hash: digest(originalState), mode: ownership.mode } : null
      else {
        const old = state?.assets.find(asset => asset.destination === change.destination)
        change.expected = old ? { hash: old.hash, mode: old.mode } : null
      }
    }
    transact(repo, changes, io)
  }
  return result
}
function parse(argv) {
  const options = { action: argv.shift(), apply: false }
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index]
    if (key === '--apply' && !options.apply) options.apply = true
    else if (['--repo', '--source', '--revision', '--version', '--plan'].includes(key) && argv[index + 1] && !argv[index + 1].startsWith('--') && !Object.hasOwn(options, key.slice(2))) options[key.slice(2)] = argv[++index]
    else throw new Error(`unknown, duplicate or incomplete argument: ${key}`)
  }
  if (!options.repo || !options.source || !options.revision || !options.plan) throw new Error('required arguments: --repo --source --revision --plan')
  return options
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(manageRepoAssets(parse(process.argv.slice(2))), null, 2)) }
  catch (error) { console.error(`manage-repo-assets: ${error.message}`); process.exitCode = 2 }
}

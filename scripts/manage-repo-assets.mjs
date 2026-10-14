#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const stateName = '.harness-assets.json'
const transactionName = '.harness-assets-transaction'
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
  if (typeof value !== 'string' || !value || /[\\\x00-\x1f\x7f]/.test(value) || path.posix.isAbsolute(value) || value.split('/').some(part => !part || part === '.' || part === '..' || pathKey(part) === '.git' || [stateName, transactionName].includes(pathKey(part)) || /^\.env(?:\.|$)/i.test(part)) || value === stateName) {
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
// The lock serializes Harness instances only. Other writers must be excluded by the caller.
function transactionDirectory(repo) {
  const directory = path.join(repo, transactionName), info = stat(directory)
  if (info && (!info.isDirectory() || info.isSymbolicLink())) throw new Error('unsafe transaction lock directory')
  return directory
}
function fingerprint(repo, destination) {
  const file = checkedPath(repo, destination), info = stat(file)
  return info ? { hash: digest(fs.readFileSync(file)), mode: info.mode & 0o777 } : null
}
const same = (a, b) => a === null || b === null ? a === b : a.hash === b.hash && a.mode === b.mode
function controlFile(directory, name) {
  const file = path.join(directory, name), info = stat(file)
  if (info && (!info.isFile() || info.isSymbolicLink() || info.nlink > 1)) throw new Error(`unsafe recovery journal file: ${name}`)
  return file
}
function durableWrite(file, bytes, options) {
  const fd = fs.openSync(file, options.flag, options.mode)
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}
function saveJournal(directory, journal) {
  const temporary = controlFile(directory, 'journal.next')
  durableWrite(temporary, JSON.stringify(journal), { flag: 'w', mode: 0o600 })
  fs.renameSync(temporary, controlFile(directory, 'journal.json'))
  const fd = fs.openSync(directory, 'r')
  try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}
function loadJournal(repo, directory) {
  let journal
  try { journal = JSON.parse(fs.readFileSync(controlFile(directory, 'journal.json'), 'utf8')) }
  catch (error) { throw new Error(`cannot read recovery journal: ${error.message}`) }
  const validPrint = value => value === null || (value && /^[0-9a-f]{64}$/.test(value.hash) && Number.isInteger(value.mode) && value.mode >= 0 && value.mode <= 0o777)
  if (journal.schemaVersion !== 1 || journal.repo !== repo || !Number.isInteger(journal.pid) || journal.pid < 1 || !['active', 'abandoned'].includes(journal.status) || !Array.isArray(journal.entries) || !journal.entries.length || !Array.isArray(journal.directories)) throw new Error('invalid recovery journal schema')
  const destinations = new Set()
  for (const entry of journal.entries) {
    if (entry.destination !== stateName) relativePath(entry.destination)
    checkedPath(repo, entry.destination)
    const key = pathKey(entry.destination)
    if (destinations.has(key) || !['pending', 'mutating', 'committed', 'restored'].includes(entry.phase) || !validPrint(entry.original) || !validPrint(entry.written)) throw new Error('invalid recovery journal entry')
    destinations.add(key)
    if (entry.original !== null && (typeof entry.original.bytes !== 'string' || Buffer.from(entry.original.bytes, 'base64').toString('base64') !== entry.original.bytes || digest(Buffer.from(entry.original.bytes, 'base64')) !== entry.original.hash)) throw new Error('invalid recovery original evidence')
    if (entry.temporary !== null) {
      relativePath(entry.temporary)
      if (path.dirname(entry.temporary) !== path.dirname(entry.destination) || !/^\.harness-asset-[0-9a-f-]{36}$/.test(path.basename(entry.temporary))) throw new Error('invalid recovery staging path')
      if (!validPrint(entry.temporaryExpected) || entry.temporaryExpected === null || (!same(entry.temporaryExpected, entry.original) && !same(entry.temporaryExpected, entry.written))) throw new Error('invalid recovery staging fingerprint')
      checkedPath(repo, entry.temporary)
    } else if (entry.temporaryExpected !== null) throw new Error('invalid recovery staging fingerprint')
  }
  const keys = [...destinations]
  if (keys.some(a => keys.some(b => a !== b && b.startsWith(`${a}/`)))) throw new Error('overlapping recovery destinations')
  for (const dir of journal.directories) {
    relativePath(dir)
    if (!journal.entries.some(entry => entry.destination.startsWith(`${dir}/`))) throw new Error('invalid recovery directory evidence')
    let current = repo
    for (const part of dir.split('/')) {
      current = path.join(current, part)
      const info = stat(current)
      if (info && (!info.isDirectory() || info.isSymbolicLink() || stat(path.join(current, '.git')))) throw new Error('unsafe recovery directory')
    }
  }
  return journal
}
function cleanTransaction(directory) {
  // Never recursively delete a foreign directory or unexpected entries.
  if (fs.readdirSync(directory).some(name => !['journal.next', 'journal.json'].includes(name))) throw new Error('transaction directory contains unexpected files; manual inspection required')
  for (const name of ['journal.next', 'journal.json']) {
    const file = controlFile(directory, name)
    if (stat(file)) fs.unlinkSync(file)
  }
  fs.rmdirSync(directory)
}
function rollback(repo, directory, journal) {
  const conflicts = []
  for (const entry of [...journal.entries].reverse()) {
    if (entry.phase === 'pending' || entry.phase === 'restored') continue
    try {
      const current = fingerprint(repo, entry.destination)
      if (!same(current, entry.original)) {
        if (!same(current, entry.written)) throw new Error('current content or mode conflicts with recorded Harness write')
        const file = checkedPath(repo, entry.destination)
        if (entry.original === null) fs.unlinkSync(file)
        else {
          const temporary = path.join(path.dirname(file), `.harness-asset-${randomUUID()}`)
          // Record this temporary before writing it, including interrupted recovery.
          entry.temporary = path.relative(repo, temporary)
          entry.temporaryExpected = { hash: entry.original.hash, mode: entry.original.mode }
          saveJournal(directory, journal)
          durableWrite(temporary, Buffer.from(entry.original.bytes, 'base64'), { flag: 'wx', mode: entry.original.mode })
          fs.chmodSync(temporary, entry.original.mode)
          if (!same(fingerprint(repo, entry.destination), entry.written)) throw new Error('destination changed during recovery')
          fs.renameSync(temporary, file)
        }
      }
      entry.phase = 'restored'
      saveJournal(directory, journal)
    } catch (error) { conflicts.push(`${entry.destination}: ${error.message}`) }
  }
  for (const entry of journal.entries) {
    if (entry.temporary) {
      try {
        const file = checkedPath(repo, entry.temporary)
        if (stat(file)) {
          if (!same(fingerprint(repo, entry.temporary), entry.temporaryExpected)) throw new Error('staging content or mode conflicts with recorded Harness write')
          fs.unlinkSync(file)
        }
      } catch (error) { conflicts.push(`${entry.temporary}: ${error.message}`) }
    }
  }
  for (const relative of [...journal.directories].reverse()) {
    try { if (stat(path.join(repo, relative))) fs.rmdirSync(path.join(repo, relative)) }
    catch (error) { if (error.code !== 'ENOTEMPTY') conflicts.push(`${relative}: ${error.message}`) }
  }
  return conflicts
}
function recoverTransaction(repo, apply, io) {
  const directory = transactionDirectory(repo)
  let journal = loadJournal(repo, directory) // Validate every original before any restore.
  if (journal.status === 'active') {
    try { process.kill(journal.pid, 0); throw new Error('recovery refused: transaction owner may still be active') }
    catch (error) { if (error.code !== 'ESRCH') throw error }
  }
  const result = { action: 'recover', mode: apply ? 'apply' : 'preview', changes: journal.entries.map(entry => ({ destination: entry.destination, phase: entry.phase })) }
  if (!apply) return result
  const lock = controlFile(directory, 'recovery.lock')
  const fd = (io.openSync || fs.openSync)(lock, 'wx', 0o600)
  try {
    const lockedJournal = loadJournal(repo, directory)
    if (JSON.stringify(lockedJournal) !== JSON.stringify(journal)) throw new Error('recovery journal changed while acquiring lock; inspect current evidence')
    journal = lockedJournal
    journal.status = 'abandoned'
    saveJournal(directory, journal)
    const conflicts = rollback(repo, directory, journal)
    if (conflicts.length) throw new Error(`recovery incomplete: ${conflicts.join('; ')}`)
  } finally { fs.closeSync(fd); fs.unlinkSync(lock) }
  cleanTransaction(directory)
  return result
}
// Each individual rename is atomic; a multi-file operation is not.
function transact(repo, changes, io) {
  const directory = transactionDirectory(repo)
  try { fs.mkdirSync(directory, { mode: 0o700 }) }
  catch (error) { if (error.code === 'EEXIST') throw new Error('transaction lock exists; inspect and recover incomplete transaction'); throw error }
  const journal = { schemaVersion: 1, repo, pid: process.pid, status: 'active', entries: [], directories: [] }
  const write = io.writeFileSync || fs.writeFileSync, rename = io.renameSync || fs.renameSync, unlink = io.unlinkSync || fs.unlinkSync
  try {
    for (const change of changes) {
      const file = checkedPath(repo, change.destination), info = stat(file)
      if (!same(fingerprint(repo, change.destination), change.expected)) throw new Error(`destination changed during preflight: ${change.destination}`)
      const bytes = info ? fs.readFileSync(file) : null
      const original = info ? { bytes: bytes.toString('base64'), hash: digest(bytes), mode: info.mode & 0o777 } : null
      const temporary = change.bytes === null ? null : path.join(path.dirname(change.destination), `.harness-asset-${randomUUID()}`)
      const written = change.bytes === null ? null : { hash: digest(change.bytes), mode: change.mode }
      journal.entries.push({ destination: change.destination, original, written, temporary, temporaryExpected: written, phase: 'pending' })
      const missing = []
      let dir = path.dirname(file)
      while (!stat(dir)) { missing.push(path.relative(repo, dir)); dir = path.dirname(dir) }
      for (const relative of missing.reverse()) if (!journal.directories.includes(relative)) journal.directories.push(relative)
    }
    saveJournal(directory, journal)
    for (const relative of journal.directories) fs.mkdirSync(path.join(repo, relative))
    for (let index = 0; index < changes.length; index++) {
      const entry = journal.entries[index], change = changes[index]
      if (entry.temporary) {
        const temporary = checkedPath(repo, entry.temporary)
        write(temporary, change.bytes, { flag: 'wx', mode: change.mode })
        fs.chmodSync(temporary, change.mode)
      }
    }
    for (const entry of journal.entries) if (!same(fingerprint(repo, entry.destination), entry.original)) throw new Error(`destination changed during staging: ${entry.destination}`)
    for (const entry of journal.entries) {
      // Recheck after all earlier writes, immediately before this write.
      if (!same(fingerprint(repo, entry.destination), entry.original)) throw new Error(`destination changed during commit: ${entry.destination}`)
      entry.phase = 'mutating'
      saveJournal(directory, journal)
      const file = checkedPath(repo, entry.destination)
      if (!same(fingerprint(repo, entry.destination), entry.original)) throw new Error(`destination changed during commit: ${entry.destination}`)
      if (entry.temporary) rename(checkedPath(repo, entry.temporary), file)
      else unlink(file)
      entry.phase = 'committed'
      saveJournal(directory, journal)
    }
  } catch (error) {
    journal.status = 'abandoned'
    if (!journal.entries.length) { fs.rmdirSync(directory); throw error }
    saveJournal(directory, journal)
    const conflicts = rollback(repo, directory, journal)
    if (conflicts.length) throw new Error(`${error.message}; rollback incomplete: ${conflicts.join('; ')}`)
    cleanTransaction(directory)
    throw error
  }
  cleanTransaction(directory)
}
export function manageRepoAssets(options, io = {}) {
  if (options.action === 'recover') return recoverTransaction(gitRoot(options.repo, 'repo'), options.apply, io)
  if (!['apply', 'update', 'remove'].includes(options.action)) throw new Error('action must be apply, update or remove')
  const repo = gitRoot(options.repo, 'repo')
  if (options.apply && stat(transactionDirectory(repo))) throw new Error('transaction lock exists; inspect and recover incomplete transaction')
  const source = provenance(options)
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
  if (options.action === 'recover') {
    if (!options.repo || options.source || options.revision || options.version || options.plan) throw new Error('recover requires only --repo and optional --apply')
    return options
  }
  if (!options.repo || !options.source || !options.revision || !options.plan) throw new Error('required arguments: --repo --source --revision --plan')
  return options
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(manageRepoAssets(parse(process.argv.slice(2))), null, 2)) }
  catch (error) { console.error(`manage-repo-assets: ${error.message}`); process.exitCode = 2 }
}

// Local acceptance controller only. No fixture trust bypass or semantic verdict.
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  readlinkSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { establishCodexTrust } from '../../scripts/codex-binary-trust.mjs'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const trustRunner = path.join(repo, 'scripts/codex-binary-trust.mjs')
const allowlist = ['PATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'COLORTERM', 'NO_COLOR', 'TZ', 'USER', 'LOGNAME', 'SHELL']
const xdg = { XDG_CONFIG_HOME: '.config', XDG_DATA_HOME: '.local/share', XDG_STATE_HOME: '.local/state', XDG_CACHE_HOME: '.cache', XDG_RUNTIME_DIR: '.runtime' }
const hash = value => `sha256:${createHash('sha256').update(value).digest('hex')}`
const inside = (root, file) => file === root || (!path.relative(root, file).startsWith('..' + path.sep) && path.relative(root, file) !== '..' && !path.isAbsolute(path.relative(root, file)))

export function validateRevision(revision) {
  if (typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision)) throw new Error('revision must be an exact lowercase 40 character commit SHA')
  return revision
}

export function isolatedEnvironment(home, inherited = process.env) {
  const env = Object.fromEntries(allowlist.filter(key => typeof inherited[key] === 'string').map(key => [key, inherited[key]]))
  Object.assign(env, { HOME: home, CODEX_HOME: home, TMPDIR: path.join(home, 'tmp') })
  for (const [key, relative] of Object.entries(xdg)) env[key] = path.join(home, relative)
  return env
}

export function sessionAuth(value) {
  const tokens = value?.tokens
  if (!['access_token', 'id_token', 'account_id'].every(key => typeof tokens?.[key] === 'string' && tokens[key].length)) return null
  const clean = { tokens: { access_token: tokens.access_token, id_token: tokens.id_token, account_id: tokens.account_id, refresh_token: '' } }
  for (const key of ['auth_mode', 'last_refresh']) if (typeof value[key] === 'string') clean[key] = value[key]
  return clean
}

export function writeSessionAuth(home, value) {
  const clean = sessionAuth(value)
  if (!clean) return false
  writeFileSync(path.join(home, 'auth.json'), JSON.stringify(clean) + '\n', { flag: 'wx', mode: 0o600 })
  return true
}

export function createEvidenceDirectory(destination, protectedRoots) {
  const target = path.join(realpathSync(path.dirname(path.resolve(destination))), path.basename(destination))
  if (protectedRoots.some(root => inside(realpathSync(root), target))) throw new Error('evidence must be outside source and user configuration')
  mkdirSync(target, { mode: 0o700 }) // Exclusive: existing directories/files/symlinks fail.
  return target
}

export function snapshotUserConfiguration(home) {
  const records = []
  const visit = relative => {
    const file = path.join(home, relative)
    let stat
    try { stat = lstatSync(file) } catch (error) { if (error.code === 'ENOENT') { records.push([relative, 'absent']); return }; throw error }
    if (stat.isSymbolicLink()) records.push([relative, 'link', readlinkSync(file)])
    else if (stat.isDirectory()) {
      records.push([relative, 'directory', stat.mode])
      for (const name of readdirSync(file).sort()) visit(path.join(relative, name))
    } else if (stat.isFile()) records.push([relative, 'file', stat.mode, hash(readFileSync(file))])
    else throw new Error('unsupported user configuration entry')
  }
  for (const relative of ['config.toml', 'plugins']) visit(relative)
  return hash(JSON.stringify(records))
}

function rolloutFiles(home) {
  const files = []
  const visit = directory => {
    if (!existsSync(directory)) return
    for (const name of readdirSync(directory)) {
      const file = path.join(directory, name), stat = lstatSync(file)
      if (stat.isSymbolicLink()) throw new Error('session rollout must not contain symlinks')
      if (stat.isDirectory()) visit(file)
      else if (stat.isFile() && file.endsWith('.jsonl')) files.push(file)
    }
  }
  visit(path.join(home, 'sessions'))
  return files.sort()
}

export function extractSessionMetadata(home, previous = []) {
  return rolloutFiles(home).filter(file => !previous.includes(file)).map(file => {
    const bytes = readFileSync(file)
    const records = bytes.toString('utf8').split(/\r?\n/).filter(Boolean).flatMap(line => {
      let event
      try { event = JSON.parse(line) } catch { return [] }
      const payload = event.payload || {}
      if (event.type === 'session_meta') return [{ type: event.type, id: payload.id, cli_version: payload.cli_version, originator: payload.originator, model_provider: payload.model_provider }]
      if (event.type === 'turn_context') return [{ type: event.type, model: payload.model, effort: payload.effort ?? payload.reasoning_effort, approval_policy: payload.approval_policy, sandbox_policy: payload.sandbox_policy, cwd: payload.cwd }]
      return []
    })
    return { file, digest: hash(bytes), records }
  })
}

export function assessAppliedSettings(observedRollouts, { sandbox, cwd }) {
  if (!['read-only', 'workspace-write'].includes(sandbox) || typeof cwd !== 'string' || !cwd) {
    throw new Error('expected settings require a supported sandbox and exact cwd')
  }
  const expected = { model: 'gpt-6.1-sol', effort: 'medium', approval_policy: 'never', sandbox_policy: sandbox, cwd }
  const turns = observedRollouts.flatMap(rollout => rollout.records
    .filter(record => record.type === 'turn_context').map((record, turnIndex) => {
      const fields = Object.fromEntries(Object.entries(expected).map(([key, value]) => {
        const actual = key === 'sandbox_policy' && typeof record[key] === 'object'
          ? record[key]?.type : record[key]
        const missing = actual === undefined || actual === null || actual === ''
        return [key, { expected: value, actual: actual ?? null, status: missing ? 'UNVERIFIED' : actual === value ? 'PASS' : 'FAIL' }]
      }))
      return { file: rollout.file, turnIndex, fields }
    }))
  const statuses = turns.flatMap(turn => Object.values(turn.fields).map(field => field.status))
  const status = statuses.includes('FAIL') ? 'FAIL'
    : !turns.length || statuses.includes('UNVERIFIED') ? 'UNVERIFIED' : 'PASS'
  return { status, expected, turns, reason: turns.length ? null : 'no-observed-turn-context' }
}

function git(source, args) {
  const env = { PATH: '/usr/bin:/bin', HOME: os.homedir(), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
  return execFileSync('/usr/bin/git', ['--no-replace-objects', '-C', source, ...args], { env, encoding: 'utf8', timeout: 30_000 })
}

function candidateState(source, revision) {
  const head = git(source, ['rev-parse', '--verify', 'HEAD^{commit}']).trim()
  if (head !== revision || git(source, ['status', '--porcelain=v1', '--untracked-files=all']) !== '') throw new Error('source must be clean at the exact supplied revision')
  return { revision: head, tree: git(source, ['rev-parse', 'HEAD^{tree}']).trim() }
}

// The parent kills the entire detached group, including the synchronous trust
// wrapper and its Codex descendants. A timeout returns facts and is never retried.
function boundedProcess(program, args, { env, cwd, timeoutMs = 180_000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { env, cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      try { process.kill(-child.pid, 'SIGKILL') } catch (error) { if (error.code !== 'ESRCH') reject(error) }
    }, timeoutMs)
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')
    child.stdout.on('data', data => { stdout += data })
    child.stderr.on('data', data => { stderr += data })
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('close', (exitCode, signal) => { clearTimeout(timer); resolve({ stdout, stderr, exitCode, signal, timedOut }) })
  })
}

export async function withInstalledCandidate({ source, revision, evidenceDir }, callback) {
  validateRevision(revision)
  source = realpathSync(source)
  const userHome = realpathSync(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'))
  const candidate = candidateState(source, revision)
  const evidence = createEvidenceDirectory(evidenceDir, [source, userHome])
  const before = snapshotUserConfiguration(userHome)
  const temporary = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'team-harness-local-session.')))
  const home = path.join(temporary, 'home'), materialized = path.join(temporary, 'source'), workspaceRoot = path.join(temporary, 'workspaces')
  let originalFailure = null, returnValue
  const summary = { candidate, userState: { before, after: null, unchanged: null, paths: ['config.toml', 'plugins'] }, cleanup: { removed: false }, runs: [] }
  const publish = (name, value) => writeFileSync(path.join(evidence, name), value, { flag: 'wx', mode: 0o600 })
  try {
    mkdirSync(home, { mode: 0o700 }); mkdirSync(materialized); mkdirSync(workspaceRoot, { mode: 0o700 })
    const archive = execFileSync('/usr/bin/git', ['--no-replace-objects', '-C', source, 'archive', '--format=tar', revision], { env: { PATH: '/usr/bin:/bin', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }, timeout: 30_000, maxBuffer: 64 * 1024 * 1024 })
    execFileSync('/usr/bin/tar', ['-xf', '-', '-C', materialized], { input: archive, timeout: 30_000 })
    candidateState(source, revision)
    const env = isolatedEnvironment(home)
    for (const directory of [env.TMPDIR, ...Object.keys(xdg).map(key => env[key])]) mkdirSync(directory, { recursive: true, mode: 0o700 })
    const config = 'model = "gpt-6.1-sol"\nmodel_reasoning_effort = "medium"\n'
    writeFileSync(path.join(home, 'config.toml'), config, { flag: 'wx', mode: 0o600 })
    summary.config = { requestedModel: 'gpt-6.1-sol', requestedReasoningEffort: 'medium', requestedApprovalPolicy: 'never', digest: hash(config) }
    const authPath = path.join(userHome, 'auth.json')
    let auth = null
    if (existsSync(authPath)) {
      try { auth = JSON.parse(readFileSync(authPath, 'utf8')) } catch { throw new Error('user session auth is not valid JSON') }
    }
    summary.sessionCredentialProvided = writeSessionAuth(home, auth)
    auth = null
    const trustedBinariesPath = path.join(materialized, 'docs/pilots/codex-native-loader-trusted-binaries.json')
    const trust = establishCodexTrust({ command: 'codex', env, trustedBinariesPath })
    summary.binary = { path: trust.path, digest: trust.digest, version: trust.version, signature: trust.signature }
    let stopped = false, index = 0
    const invoke = async (args, { cwd = materialized, label, timeoutMs = 30_000, expectedSettings = null } = {}) => {
      if (stopped) throw new Error('session stopped after failed or timed-out execution')
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(label || '')) throw new Error('evidence label must be a simple lowercase identifier')
      const stem = `${String(++index).padStart(2, '0')}-${label}`
      const startedAt = new Date().toISOString()
      const previousRollouts = expectedSettings !== null ? rolloutFiles(home) : []
      const result = await boundedProcess(process.execPath, [trustRunner, '--candidate', trust.path, '--trusted-binaries', trustedBinariesPath, '--expected-identity', JSON.stringify(trust.identity), '--execute', '--', ...args], { env, cwd, timeoutMs })
      publish(stem + '.stdout.txt', result.stdout); publish(stem + '.stderr.txt', result.stderr)
      if (expectedSettings !== null) publish(stem + '.raw.jsonl', result.stdout)
      const observedRollouts = expectedSettings !== null ? extractSessionMetadata(home, previousRollouts) : []
      if (expectedSettings !== null) publish(stem + '.context.json', JSON.stringify(observedRollouts, null, 2) + '\n')
      const appliedSettings = expectedSettings ? assessAppliedSettings(observedRollouts, expectedSettings) : null
      const metadata = { appliedSettings, appliedSettingsStatus: appliedSettings?.status ?? null, observedRollouts, label, argv: args, cwd, startedAt, finishedAt: new Date().toISOString(), exitCode: result.exitCode, signal: result.signal, timedOut: result.timedOut, stdoutDigest: hash(result.stdout), stderrDigest: hash(result.stderr), configDigest: hash(readFileSync(path.join(home, 'config.toml'))), actualModelHeader: result.stderr.match(/^model:\s*(.+)$/m)?.[1] || null }
      publish(stem + '.json', JSON.stringify(metadata, null, 2) + '\n')
      summary.runs.push(metadata)
      if (result.timedOut || result.exitCode !== 0 || (appliedSettings && appliedSettings.status !== 'PASS')) stopped = true
      return { ...result, metadata, appliedSettings }
    }
    const requireSuccess = async (args, label) => {
      const result = await invoke(args, { label })
      if (result.exitCode !== 0 || result.timedOut) throw new Error(`${label} failed; see raw evidence`)
      return result
    }
    await requireSuccess(['plugin', 'marketplace', 'add', materialized, '--json'], 'marketplace-add')
    await requireSuccess(['plugin', 'add', 'harness-guard@team-harness', '--json'], 'plugin-add')
    const listing = await requireSuccess(['plugin', 'list', '--json'], 'plugin-list')
    const plugin = JSON.parse(listing.stdout).installed?.find(entry => entry.pluginId === 'harness-guard@team-harness')
    if (!plugin?.enabled || typeof plugin.source?.path !== 'string') throw new Error('installed candidate plugin was not found')
    const pluginRoot = realpathSync(plugin.source.path)
    if (!inside(temporary, pluginRoot)) throw new Error('installed plugin escaped isolated candidate')
    const manifest = JSON.parse(readFileSync(path.join(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'))
    const expected = JSON.parse(readFileSync(path.join(materialized, 'plugins/harness-guard/.codex-plugin/plugin.json'), 'utf8'))
    if (manifest.name !== expected.name || manifest.version !== expected.version) throw new Error('installed plugin identity mismatch')
    execFileSync(process.execPath, [path.join(repo, 'scripts/check-codex-native-plugin.mjs'), '--root', pluginRoot, '--trusted-root', path.join(materialized, 'plugins/harness-guard')], { env, encoding: 'utf8', timeout: 30_000 })
    summary.plugin = { root: pluginRoot, version: manifest.version }
    returnValue = await callback({ env, source: materialized, pluginRoot, workspaceRoot, candidate, run: async ({ cwd, prompt, sandbox = 'read-only', label }) => {
      if (!['read-only', 'workspace-write'].includes(sandbox) || typeof prompt !== 'string') throw new Error('invalid run sandbox or prompt')
      const directory = realpathSync(cwd)
      if (!inside(workspaceRoot, directory)) throw new Error('model cwd must be within the isolated workspaceRoot')
      const result = await invoke(['--ask-for-approval', 'never', 'exec', '--skip-git-repo-check', '--dangerously-bypass-hook-trust', '-m', 'gpt-6.1-sol', '-c', 'model_reasoning_effort="medium"', '-s', sandbox, '-C', directory, '--json', prompt], { cwd: directory, label, timeoutMs: 180_000, expectedSettings: { sandbox, cwd: directory } })
      const events = result.stdout.split(/\r?\n/).filter(Boolean).flatMap(line => { try { return [JSON.parse(line)] } catch { return [] } })
      const toolCommands = events.filter(event => event.type === 'item.completed' && event.item?.type === 'command_execution').map(event => ({ command: event.item.command, exitCode: event.item.exit_code, outputDigest: hash(event.item.aggregated_output || '') }))
      return { ...result, events, toolCommands }
    } })
  } catch (error) { originalFailure = error }
  finally {
    try { rmSync(temporary, { recursive: true, force: true }); summary.cleanup.removed = !existsSync(temporary) } catch { summary.cleanup.removed = false }
    try { summary.userState.after = snapshotUserConfiguration(userHome); summary.userState.unchanged = summary.userState.after === before } catch { summary.userState.unchanged = false }
    try { candidateState(source, revision); summary.sourceUnchanged = true } catch { summary.sourceUnchanged = false }
    publish('session.json', JSON.stringify(summary, null, 2) + '\n')
  }
  if (!summary.cleanup.removed || !summary.userState.unchanged || !summary.sourceUnchanged) throw new Error('candidate preservation or isolated home cleanup failed; see session.json')
  if (originalFailure) throw originalFailure
  return returnValue
}

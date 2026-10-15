import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  isolatedEnvironment, sessionAuth, createEvidenceDirectory, snapshotUserConfiguration,
  writeSessionAuth, validateRevision, extractSessionMetadata, assessAppliedSettings,
} from './codex-session.mjs'

test('environment forwards only approved noncredential keys and isolates all roots', () => {
  const env = isolatedEnvironment('/tmp/isolated', {
    PATH: '/usr/bin', LANG: 'en_US.UTF-8', HOME: '/real/home', CODEX_HOME: '/real/codex',
    OPENAI_API_KEY: 'secret', GITHUB_TOKEN: 'secret', CUSTOM_AUTH_ROOT: '/real/auth',
    NODE_OPTIONS: '--import=untrusted.mjs', FAKE_MODE: 'unsafe',
  })
  assert.equal(env.PATH, '/usr/bin')
  assert.equal(env.HOME, '/tmp/isolated')
  assert.equal(env.CODEX_HOME, '/tmp/isolated')
  for (const key of ['OPENAI_API_KEY', 'GITHUB_TOKEN', 'CUSTOM_AUTH_ROOT', 'NODE_OPTIONS', 'FAKE_MODE']) assert.equal(env[key], undefined)
  for (const key of Object.keys(env).filter(key => key.startsWith('XDG_'))) assert.ok(env[key].startsWith('/tmp/isolated/'))
})

test('session credential sanitizer drops long lived and unexpected fields', () => {
  const clean = sessionAuth({ tokens: { access_token: 'short', id_token: 'id', account_id: 'account', refresh_token: 'long' }, OPENAI_API_KEY: 'long', unexpected: true })
  assert.deepEqual(clean, { tokens: { access_token: 'short', id_token: 'id', account_id: 'account', refresh_token: '' } })
  assert.equal(sessionAuth({ tokens: { access_token: 'partial' } }), null)
  assert.equal(sessionAuth(null), null)
})

test('revision is an exact lowercase 40 character commit SHA', () => {
  assert.equal(validateRevision('a'.repeat(40)), 'a'.repeat(40))
  for (const value of ['HEAD', 'a'.repeat(39), 'A'.repeat(40), '--help', null]) assert.throws(() => validateRevision(value))
})

test('evidence cannot overwrite existing files or enter protected trees; snapshots notice drift', () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'codex-session-test.'))
  try {
    const source = path.join(temp, 'source'), home = path.join(temp, 'home')
    mkdirSync(source); mkdirSync(home)
    assert.throws(() => createEvidenceDirectory(path.join(source, 'evidence'), [source, home]))
    const evidence = createEvidenceDirectory(path.join(temp, 'evidence'), [source, home])
    assert.equal(statSync(evidence).mode & 0o777, 0o700)
    assert.throws(() => createEvidenceDirectory(evidence, [source, home]))
    const before = snapshotUserConfiguration(home)
    writeFileSync(path.join(home, 'config.toml'), 'model = "example"\n')
    assert.notEqual(snapshotUserConfiguration(home), before)
    writeSessionAuth(home, { tokens: { access_token: 'short', id_token: 'id', account_id: 'account', refresh_token: 'discard' } })
    const auth = path.join(home, 'auth.json')
    assert.equal(statSync(auth).mode & 0o777, 0o600)
    assert.equal(JSON.parse(readFileSync(auth)).tokens.refresh_token, '')
    assert.throws(() => writeSessionAuth(home, { tokens: { access_token: 'short', id_token: 'id', account_id: 'account' } }))
  } finally { rmSync(temp, { recursive: true, force: true }) }
})


test('rollout metadata projection excludes raw instructions, identifiers and credentials', () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'codex-session-rollout.'))
  try {
    const directory = path.join(temp, 'sessions'); mkdirSync(directory)
    const file = path.join(directory, 'fixture.jsonl')
    const lines = [
      { type: 'session_meta', payload: { id: 'session', cli_version: 'test', user: 'private-user', auth: 'private-token' } },
      { type: 'turn_context', payload: { model: 'gpt-6.1-sol', effort: 'medium', approval_policy: 'never', sandbox_policy: { type: 'read-only' }, cwd: '/fixture', instructions: 'private-instructions' } },
      { type: 'response_item', payload: { content: 'private-response' } },
    ]
    writeFileSync(file, lines.map(line => JSON.stringify(line)).join('\n'))
    const result = extractSessionMetadata(temp)
    assert.equal(result.length, 1)
    assert.equal(result[0].records.length, 2)
    assert.equal(result[0].records[1].model, 'gpt-6.1-sol')
    assert.match(result[0].digest, /^sha256:[a-f0-9]{64}$/)
    assert.ok(!JSON.stringify(result).includes('private-'))
    assert.deepEqual(extractSessionMetadata(temp, [file]), [])
  } finally { rmSync(temp, { recursive: true, force: true }) }
})

const expectedSettings = { sandbox: 'read-only', cwd: '/fixture' }
const context = changes => ({
  type: 'turn_context', model: 'gpt-6.1-sol', effort: 'medium',
  approval_policy: 'never', sandbox_policy: { type: 'read-only' }, cwd: '/fixture', ...changes,
})
const rollouts = (...records) => [{ file: '/isolated/session.jsonl', digest: 'sha256:fixture', records }]

test('applied settings require all five exact values in every observed turn', () => {
  const result = assessAppliedSettings(rollouts(context({})), expectedSettings)
  assert.equal(result.status, 'PASS')
  assert.equal(result.turns.length, 1)
  assert.ok(Object.values(result.turns[0].fields).every(field => field.status === 'PASS'))
  assert.equal(assessAppliedSettings(rollouts(context({ sandbox_policy: { type: 'workspace-write' } })), { ...expectedSettings, sandbox: 'workspace-write' }).status, 'PASS')
  for (const [field, wrong] of [['model', 'other'], ['effort', 'high'], ['approval_policy', 'on-request'], ['sandbox_policy', { type: 'danger-full-access' }], ['cwd', '/different']]) {
    const result = assessAppliedSettings(rollouts(context({ [field]: wrong })), expectedSettings)
    assert.equal(result.status, 'FAIL', field)
    assert.equal(result.turns[0].fields[field].status, 'FAIL', field)
  }
  assert.equal(assessAppliedSettings(rollouts(context({}), context({ effort: 'high' })), expectedSettings).status, 'FAIL')
})

test('missing metadata cannot pass, and mismatch outranks incomplete evidence', () => {
  assert.equal(assessAppliedSettings([], expectedSettings).status, 'UNVERIFIED')
  for (const field of ['model', 'effort', 'approval_policy', 'sandbox_policy', 'cwd']) {
    const result = assessAppliedSettings(rollouts(context({ [field]: undefined })), expectedSettings)
    assert.equal(result.status, 'UNVERIFIED', field)
    assert.equal(result.turns[0].fields[field].status, 'UNVERIFIED', field)
  }
  assert.equal(assessAppliedSettings(rollouts(context({ model: undefined, effort: 'high' })), expectedSettings).status, 'FAIL')
  assert.equal(assessAppliedSettings(rollouts(context({ sandbox_policy: {} })), expectedSettings).status, 'UNVERIFIED')
  assert.equal(assessAppliedSettings(rollouts(context({}), context({ effort: undefined })), expectedSettings).status, 'UNVERIFIED')
  assert.equal(assessAppliedSettings(rollouts(context({ cwd: '/fixture/' })), expectedSettings).status, 'FAIL')
  assert.throws(() => assessAppliedSettings([], { sandbox: 'danger-full-access', cwd: '/fixture' }))
})

#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  accessSync,
  constants as fsConstants,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OPENAI_REQUIREMENT =
  '=anchor apple generic and certificate leaf[subject.OU] = "2DC432GLL2" and identifier "codex"'
const scriptRoot = path.dirname(fileURLToPath(import.meta.url))

export function digestFile(file) {
  return `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`
}

export function resolveExecutable(command, env = process.env) {
  const candidates = command.includes(path.sep)
    ? [path.resolve(command)]
    : (env.PATH || '').split(path.delimiter).filter(Boolean).map((directory) => path.join(directory, command))
  for (const candidate of candidates) {
    try {
      accessSync(candidate, fsConstants.X_OK)
      const resolved = realpathSync(candidate)
      if (lstatSync(resolved).isFile()) return resolved
    } catch {
      // Try the next PATH entry.
    }
  }
  throw new Error(`Codex binary is not an executable regular file: ${command}`)
}

export function captureExecutableIdentity(executable, expectedDigest, expectedCdHash = null) {
  const stat = statSync(executable)
  const identity = {
    path: executable,
    device: stat.dev,
    inode: stat.ino,
    size: stat.size,
    digest: digestFile(executable),
    cdHash: expectedCdHash,
  }
  if (identity.digest !== expectedDigest) {
    throw new Error('Codex executable changed after trust verification')
  }
  return identity
}

export function assertExecutableIdentity(identity) {
  try {
    const canonical = realpathSync(identity.path)
    const stat = statSync(identity.path)
    if (
      canonical !== identity.path ||
      stat.dev !== identity.device ||
      stat.ino !== identity.inode ||
      stat.size !== identity.size ||
      digestFile(identity.path) !== identity.digest
    ) {
      throw new Error('changed')
    }
  } catch {
    throw new Error('Codex executable changed after trust verification')
  }
}

export function runVerifiedExecutable(identity, args, options = {}) {
  if (options.beforeSpawn) options.beforeSpawn()
  assertExecutableIdentity(identity)
  let result
  try {
    const spawnOptions = {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: options.stdio,
    }
    if (!options.stdio) spawnOptions.encoding = 'utf8'
    if (identity.cdHash) {
      if (process.platform !== 'darwin') {
        throw new Error('atomic Codex execution requires macOS dynamic code verification')
      }
      result = spawnSync(
        '/usr/bin/python3',
        [
          path.join(scriptRoot, 'spawn-verified-executable.py'),
          '--path',
          identity.path,
          '--cdhash',
          identity.cdHash,
          '--requirement',
          OPENAI_REQUIREMENT,
          '--',
          ...args,
        ],
        spawnOptions,
      )
    } else {
      result = spawnSync(identity.path, args, spawnOptions)
    }
  } finally {
    assertExecutableIdentity(identity)
  }
  return result
}

export function verifyOpenAICodeSignature(executable) {
  if (process.platform !== 'darwin') {
    throw new Error(`live Codex binary lacks verified OpenAI code signature on ${process.platform}`)
  }
  const verification = spawnSync(
    'codesign',
    ['--verify', '--deep', '--strict', '--requirement', OPENAI_REQUIREMENT, executable],
    { encoding: 'utf8' },
  )
  if (verification.error || verification.status !== 0) {
    throw new Error('live Codex binary lacks verified OpenAI code signature')
  }
  const details = spawnSync('codesign', ['-dv', '--verbose=4', executable], { encoding: 'utf8' })
  const output = `${details.stdout || ''}\n${details.stderr || ''}`
  const teamIdentifier = output.match(/^TeamIdentifier=(.+)$/m)?.[1]
  const authority = output.match(/^Authority=(Developer ID Application: .+)$/m)?.[1]
  const cdHash = output.match(/^CDHash=([a-f0-9]+)$/m)?.[1]
  if (
    details.error ||
    details.status !== 0 ||
    teamIdentifier !== '2DC432GLL2' ||
    authority !== 'Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)' ||
    !cdHash
  ) {
    throw new Error('live Codex binary lacks verified OpenAI code signature')
  }
  return { verified: true, platform: 'darwin', teamIdentifier, authority, cdHash }
}

export function establishCodexTrust({
  command = 'codex',
  env = process.env,
  expectedDigest = null,
  fixtureMode = false,
  trustedBinariesPath,
}) {
  const executable = resolveExecutable(command, env)
  const binaryDigest = digestFile(executable)
  if (expectedDigest && binaryDigest !== expectedDigest) {
    throw new Error('Codex executable changed after trust verification')
  }
  let signature = {
    verified: false,
    platform: process.platform,
    teamIdentifier: null,
    authority: null,
  }
  let trustedBinaries = null

  if (!fixtureMode) {
    trustedBinaries = JSON.parse(readFileSync(trustedBinariesPath, 'utf8'))
    const trustedDigests = new Set(Object.values(trustedBinaries).flat())
    if (!trustedDigests.has(binaryDigest)) {
      throw new Error(`Codex binary digest is not trusted: ${binaryDigest}`)
    }
    signature = verifyOpenAICodeSignature(executable)
  }

  const identity = captureExecutableIdentity(executable, binaryDigest, signature.cdHash || null)
  let version = null
  if (!fixtureMode) {
    const result = runVerifiedExecutable(identity, ['--version'], { env })
    if (result.error || result.status !== 0) {
      throw new Error('trusted Codex version command failed')
    }
    version = result.stdout.trim()
    if (!trustedBinaries[version]?.includes(binaryDigest)) {
      throw new Error(`Codex binary digest is not trusted: ${version} ${binaryDigest}`)
    }
  }
  return { digest: binaryDigest, identity, path: executable, signature, version }
}

function parseCli(argv) {
  let command = 'codex'
  let expectedDigest = null
  let trustedBinariesPath = null
  let fixtureMode = false
  let executeArgs = null
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--candidate' && argv[index + 1]) command = argv[++index]
    else if (argv[index] === '--expected-digest' && argv[index + 1]) {
      expectedDigest = argv[++index]
    }
    else if (argv[index] === '--trusted-binaries' && argv[index + 1]) {
      trustedBinariesPath = path.resolve(argv[++index])
    } else if (argv[index] === '--fixture') fixtureMode = true
    else if (argv[index] === '--execute' && argv[index + 1] === '--') {
      executeArgs = argv.slice(index + 2)
      break
    } else throw new Error(`unknown or incomplete argument: ${argv[index]}`)
  }
  if (!fixtureMode && !trustedBinariesPath) throw new Error('--trusted-binaries is required')
  return { command, executeArgs, expectedDigest, fixtureMode, trustedBinariesPath }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseCli(process.argv.slice(2))
    const trust = establishCodexTrust(args)
    if (args.executeArgs) {
      const result = runVerifiedExecutable(trust.identity, args.executeArgs, {
        env: process.env,
        stdio: 'inherit',
      })
      if (result.error) throw result.error
      if (result.signal) process.kill(process.pid, result.signal)
      process.exit(result.status ?? 1)
    } else {
      process.stdout.write(`${JSON.stringify({
        path: trust.path,
        digest: trust.digest,
        version: trust.version,
        cdHash: trust.identity.cdHash,
        fixture: args.fixtureMode,
      })}\n`)
    }
  } catch (error) {
    console.error(`codex-binary-trust: ${error.message}`)
    process.exit(1)
  }
}

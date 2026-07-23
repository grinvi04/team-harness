#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  captureExecutableIdentity,
  resolveExecutable,
  runVerifiedExecutable,
} from './codex-binary-trust.mjs'

const PLUGIN_ID = 'harness-guard@team-harness'
const MARKETPLACE = 'team-harness'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(root, 'plugins', 'harness-guard', '.codex-plugin', 'plugin.json')
const codexBin = process.env.CODEX_BIN || 'codex'
const expectedCodexDigest = process.env.HARNESS_CODEX_EXPECTED_DIGEST
const expectedCodexCdHash = process.env.HARNESS_CODEX_EXPECTED_CDHASH || null
const codexIdentity = expectedCodexDigest
  ? captureExecutableIdentity(resolveExecutable(codexBin), expectedCodexDigest, expectedCodexCdHash)
  : null

function versionParts(version) {
  if (!/^\d+(?:\.\d+)*$/.test(version)) throw new Error(`invalid numeric version: ${version}`)
  return version.split('.').map(Number)
}

function compareVersions(left, right) {
  const a = versionParts(left)
  const b = versionParts(right)
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0)
    if (delta !== 0) return delta
  }
  return 0
}

function runJson(args) {
  const result = codexIdentity
    ? runVerifiedExecutable(codexIdentity, args, { env: process.env })
    : spawnSync(codexBin, args, { encoding: 'utf8', env: process.env })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`
    throw new Error(`${codexBin} ${args.join(' ')} failed: ${detail}`)
  }
  try {
    return JSON.parse(result.stdout)
  } catch {
    throw new Error(`${codexBin} ${args.join(' ')} returned invalid JSON`)
  }
}

try {
  const sourceVersion = JSON.parse(readFileSync(manifestPath, 'utf8')).version
  versionParts(sourceVersion)

  const list = runJson(['plugin', 'list', '--json'])
  const installed = list.installed?.find((plugin) => plugin.pluginId === PLUGIN_ID)
  const previousVersion = installed?.version || '0.0.0'

  const comparison = compareVersions(previousVersion, sourceVersion)
  if (comparison === 0) {
    console.log(JSON.stringify({ changed: false, sourceVersion, installedVersion: previousVersion }))
    process.exit(0)
  }
  if (comparison > 0) {
    throw new Error(
      `installed plugin ${previousVersion} is newer than trusted source ${sourceVersion}; update the checkout first`,
    )
  }

  const upgrade = runJson(['plugin', 'marketplace', 'upgrade', MARKETPLACE, '--json'])
  if (Array.isArray(upgrade.errors) && upgrade.errors.length > 0) {
    throw new Error(`marketplace upgrade reported errors: ${JSON.stringify(upgrade.errors)}`)
  }

  const added = runJson(['plugin', 'add', PLUGIN_ID, '--json'])
  if (added.pluginId !== PLUGIN_ID || added.version !== sourceVersion) {
    throw new Error(`plugin install returned stale or unexpected version: ${added.pluginId}@${added.version}`)
  }

  console.log(JSON.stringify({
    changed: true,
    sourceVersion,
    previousVersion,
    installedVersion: added.version,
  }))
} catch (error) {
  console.error(`sync-codex-plugin-cache: ${error.message}`)
  process.exit(1)
}

#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, lstatSync, realpathSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginNames = new Map([
  ['governance-core', 'harness-governance-core'],
  ['claude-adapter', 'harness-claude-adapter'],
  ['codex-adapter', 'harness-codex-adapter'],
  ['workflow-pack', 'harness-workflows'],
])
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function expectedUnits(state) {
  if (state.profile === 'repository-only' && state.runtime === null) return ['governance-core']
  if (!['claude', 'codex'].includes(state.runtime)) throw new Error('invalid profile runtime')
  const adapter = `${state.runtime}-adapter`
  if (state.profile === 'agent-governed') return ['governance-core', adapter]
  if (state.profile === 'workflow-assisted') return ['governance-core', adapter, 'workflow-pack']
  throw new Error(`invalid profile: ${state.profile}`)
}

function treeDigest(root) {
  const hash = createHash('sha256')
  function visit(directory, prefix = '') {
    for (const name of readdirSync(directory).sort()) {
      const absolute = path.join(directory, name)
      const relative = path.posix.join(prefix, name)
      const stat = lstatSync(absolute)
      if (stat.isSymbolicLink()) throw new Error(`symlink is not allowed: ${relative}`)
      if (stat.isDirectory()) visit(absolute, relative)
      else if (stat.isFile()) hash.update(relative).update('\0').update(readFileSync(absolute)).update('\0')
      else throw new Error(`unsupported file type: ${relative}`)
    }
  }
  visit(root)
  return `sha256:${hash.digest('hex')}`
}

export function inspectProfileOwnership(target, expectedTarget = target) {
  const stateFile = path.join(target, 'profile-state.json')
  const marker = path.join(target, '.team-harness-profile')
  if (!existsSync(marker) || !existsSync(stateFile)) throw new Error('managed profile marker/state missing')
  if (lstatSync(marker).isSymbolicLink() || lstatSync(stateFile).isSymbolicLink()) {
    throw new Error('managed marker/state must not be symlinked')
  }
  const state = readJson(stateFile)
  if (state.schemaVersion !== 1 || !Array.isArray(state.packages)) throw new Error('invalid profile state')
  if (state.installRoot !== path.resolve(expectedTarget)) throw new Error('profile install root mismatch')
  return state
}

export function inspectProfile(target, { quiet = false, expectedTarget = target } = {}) {
  const state = inspectProfileOwnership(target, expectedTarget)
  const catalog = readJson(path.join(projectRoot, 'packaging', 'packages.json'))
  if (state.version !== catalog.version) throw new Error(`catalog version mismatch: installed=${state.version} current=${catalog.version}`)
  const actualUnits = state.packages.map((entry) => entry.unit).sort()
  const requiredUnits = expectedUnits(state).sort()
  if (JSON.stringify(actualUnits) !== JSON.stringify(requiredUnits)) throw new Error('profile package composition mismatch')
  const installed = new Set(actualUnits)
  const packageDirectory = path.join(target, 'packages')
  if (!existsSync(packageDirectory) || lstatSync(packageDirectory).isSymbolicLink()) throw new Error('active package directory invalid')
  const expectedActive = state.packages.filter((entry) => entry.enabled).map((entry) => entry.pluginName).sort()
  const actualActive = readdirSync(packageDirectory).sort()
  if (JSON.stringify(actualActive) !== JSON.stringify(expectedActive)) throw new Error('active package directory mismatch')
  const disabledDirectory = path.join(target, 'disabled-packages')
  const expectedDisabled = state.packages.filter((entry) => !entry.enabled).map((entry) => entry.pluginName).sort()
  const actualDisabled = existsSync(disabledDirectory) ? readdirSync(disabledDirectory).sort() : []
  if (existsSync(disabledDirectory) && lstatSync(disabledDirectory).isSymbolicLink()) throw new Error('disabled package directory invalid')
  if (JSON.stringify(actualDisabled) !== JSON.stringify(expectedDisabled)) throw new Error('disabled package directory mismatch')

  for (const entry of state.packages) {
    if (pluginNames.get(entry.unit) !== entry.pluginName) throw new Error(`package identity mismatch: ${entry.unit}`)
    if (typeof entry.enabled !== 'boolean') throw new Error(`package enabled state invalid: ${entry.unit}`)
    const packageArea = entry.enabled ? 'packages' : 'disabled-packages'
    const packageRoot = path.join(target, packageArea, entry.pluginName)
    if (!existsSync(packageRoot)) throw new Error(`package missing: ${entry.unit}`)
    if (lstatSync(packageRoot).isSymbolicLink()) throw new Error(`package root is symlinked: ${entry.unit}`)
    const metadata = readJson(path.join(packageRoot, 'harness-package.json'))
    const catalogUnit = catalog.packages.find((unit) => unit.id === entry.unit)
    if (
      !catalogUnit ||
      metadata.unit !== entry.unit ||
      metadata.version !== state.version ||
      JSON.stringify(metadata.dependencies) !== JSON.stringify(catalogUnit.dependencies)
    ) {
      throw new Error(`package metadata mismatch: ${entry.unit}`)
    }
    const expectedBindings = (catalogUnit.runtimeBindings || []).map((binding) => ({
      ...binding,
      resolvedTarget: path.join('packages', 'harness-governance-core', binding.target),
    }))
    if (JSON.stringify(entry.bindings || []) !== JSON.stringify(expectedBindings)) {
      throw new Error(`runtime binding contract mismatch: ${entry.unit}`)
    }
    for (const dependency of metadata.dependencies || []) {
      if (!installed.has(dependency.id)) throw new Error(`dependency missing: ${entry.unit} -> ${dependency.id}`)
    }
    if (treeDigest(packageRoot) !== entry.digest) throw new Error(`package drift: ${entry.unit}`)
    for (const binding of entry.bindings || []) {
      const resolvedTarget = path.resolve(target, binding.resolvedTarget)
      if (!resolvedTarget.startsWith(`${path.resolve(target)}${path.sep}`)) {
        throw new Error(`runtime binding escapes profile: ${entry.unit}`)
      }
      if (!existsSync(resolvedTarget)) throw new Error(`runtime binding target missing: ${entry.unit}`)
      const consumer = readFileSync(path.join(packageRoot, binding.consumer), 'utf8')
      const effectiveCoreRoot = path.join(state.installRoot, 'packages', 'harness-governance-core')
      if (!consumer.includes(effectiveCoreRoot) || consumer.includes(`\${${binding.environment}}`)) {
        throw new Error(`runtime binding is not effective: ${entry.unit}`)
      }
    }
  }
  if (!quiet) console.log(`RESULT healthy profile=${state.profile} packages=${state.packages.length}`)
  return state
}

function canonicalPath(file) {
  try {
    return realpathSync(file)
  } catch {
    return null
  }
}

const isMain = process.argv[1] && canonicalPath(process.argv[1]) === canonicalPath(fileURLToPath(import.meta.url))
if (isMain) {
  const index = process.argv.indexOf('--target')
  if (index < 0 || !process.argv[index + 1] || process.argv.length !== 4) {
    console.error('usage: profile-doctor.mjs --target <managed-directory>')
    process.exit(2)
  }
  try {
    inspectProfile(path.resolve(process.argv[index + 1]))
  } catch (error) {
    console.error(`RESULT unhealthy: ${error.message}`)
    process.exit(1)
  }
}

export { treeDigest }

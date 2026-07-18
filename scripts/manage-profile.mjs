#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  lstatSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectProfile, inspectProfileOwnership, treeDigest } from './profile-doctor.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogFile = path.join(root, 'packaging', 'packages.json')
const profiles = new Set(['repository-only', 'agent-governed', 'workflow-assisted'])
const runtimes = new Set(['claude', 'codex'])

function usage() {
  console.error('usage: manage-profile.mjs <install|update|disable|remove> --target <dir> [--profile <name>] [--runtime <claude|codex>] [--unit <id>] [--all]')
}

function parseArgs(argv) {
  const operation = argv.shift()
  const options = { operation, target: null, profile: null, runtime: null, unit: null, all: false }
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    if (key === '--all') options.all = true
    else if (['--target', '--profile', '--runtime', '--unit'].includes(key) && argv[index + 1]) {
      options[key.slice(2)] = argv[++index]
    } else throw new Error(`unknown or incomplete argument: ${key}`)
  }
  if (!['install', 'update', 'disable', 'remove'].includes(operation) || !options.target) throw new Error('invalid operation or missing target')
  options.target = path.resolve(options.target)
  const home = path.resolve(os.homedir())
  if (options.target === path.parse(options.target).root || options.target === home || options.target === root) {
    throw new Error('unsafe target path')
  }
  return options
}

function selectedUnits(profile, runtime) {
  if (!profiles.has(profile)) throw new Error(`unsupported profile: ${profile}`)
  if (profile !== 'repository-only' && !runtimes.has(runtime)) throw new Error('agent profile requires --runtime claude|codex')
  const units = ['governance-core']
  if (profile !== 'repository-only') units.push(`${runtime}-adapter`)
  if (profile === 'workflow-assisted') units.push('workflow-pack')
  return units
}

function managed(target) {
  return existsSync(path.join(target, '.team-harness-profile')) && existsSync(path.join(target, 'profile-state.json'))
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function resolveRuntimeBindings(packageRoot, unit, target) {
  const coreRoot = path.join(target, 'packages', 'harness-governance-core')
  for (const binding of unit.runtimeBindings || []) {
    const consumer = path.join(packageRoot, binding.consumer)
    const original = readFileSync(consumer, 'utf8')
    const placeholder = `\${${binding.environment}}`
    if (!original.includes(placeholder) && !original.includes(coreRoot)) {
      throw new Error(`runtime binding placeholder missing: ${unit.id}:${binding.consumer}`)
    }
    writeFileSync(consumer, original.replaceAll(placeholder, coreRoot))
  }
}

function managedGeneration(target) {
  if (!lstatSync(target).isSymbolicLink()) throw new Error('managed target must be a profile symlink')
  const generation = realpathSync(target)
  const expectedPrefix = `.${path.basename(target)}.`
  if (path.dirname(generation) !== realpathSync(path.dirname(target)) || !path.basename(generation).startsWith(expectedPrefix)) {
    throw new Error('managed generation path mismatch')
  }
  return generation
}

function generationSnapshot(target) {
  const generation = managedGeneration(target)
  const identity = lstatSync(generation)
  return { generation, dev: identity.dev, ino: identity.ino }
}

function sameGeneration(snapshot, location = snapshot.generation) {
  if (!existsSync(location)) return false
  const identity = lstatSync(location)
  return identity.dev === snapshot.dev && identity.ino === snapshot.ino
}

function cleanupGeneration(snapshot) {
  if (!sameGeneration(snapshot)) {
    console.warn(`WARN old generation identity changed; cleanup skipped: ${snapshot.generation}`)
    return
  }
  const quarantine = `${snapshot.generation}.cleanup-${process.pid}-${Date.now()}`
  renameSync(snapshot.generation, quarantine)
  if (!sameGeneration(snapshot, quarantine)) {
    if (!existsSync(snapshot.generation)) renameSync(quarantine, snapshot.generation)
    console.warn(`WARN old generation identity changed; cleanup skipped: ${snapshot.generation}`)
    return
  }
  rmSync(quarantine, { recursive: true, force: true })
}

function buildStaging(options) {
  const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'))
  const units = selectedUnits(options.profile, options.runtime)
  const parent = path.dirname(options.target)
  mkdirSync(parent, { recursive: true })
  const stage = mkdtempSync(path.join(parent, `.${path.basename(options.target)}.stage-`))
  const artifacts = path.join(stage, '.artifacts')
  mkdirSync(artifacts)
  try {
    execFileSync(process.execPath, [path.join(root, 'scripts', 'build-packages.mjs'), '--output', artifacts], { cwd: root, stdio: 'pipe' })
    const packageRoot = path.join(stage, 'packages')
    mkdirSync(packageRoot)
    const entries = []
    for (const unitId of units) {
      const unit = catalog.packages.find((candidate) => candidate.id === unitId)
      if (!unit) throw new Error(`catalog unit missing: ${unitId}`)
      const source = path.join(artifacts, unit.pluginName)
      const destination = path.join(packageRoot, unit.pluginName)
      cpSync(source, destination, { recursive: true, errorOnExist: true })
      resolveRuntimeBindings(destination, unit, options.target)
      const bindings = (unit.runtimeBindings || []).map((binding) => ({
        ...binding,
        resolvedTarget: path.join('packages', 'harness-governance-core', binding.target),
      }))
      entries.push({ unit: unit.id, pluginName: unit.pluginName, enabled: true, digest: treeDigest(destination), bindings })
    }
    rmSync(artifacts, { recursive: true })
    writeFileSync(path.join(stage, '.team-harness-profile'), 'managed-by=team-harness\n')
    writeJson(path.join(stage, 'profile-state.json'), {
      schemaVersion: 1,
      profile: options.profile,
      runtime: options.runtime || null,
      version: catalog.version,
      sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      installRoot: options.target,
      packages: entries,
    })
    inspectProfile(stage, { quiet: true, expectedTarget: options.target })
    return stage
  } catch (error) {
    rmSync(stage, { recursive: true, force: true })
    throw error
  }
}

function replaceTarget(target, stage, expectedGeneration = null) {
  const link = `${target}.link-${process.pid}-${Date.now()}`
  let oldGeneration = null
  try {
    if (expectedGeneration && !existsSync(target)) throw new Error('managed target changed during operation')
    if (existsSync(target)) {
      if (!lstatSync(target).isSymbolicLink()) {
        if (expectedGeneration) throw new Error('managed target changed during operation')
        if (readdirSync(target).length > 0) throw new Error('managed target must be a profile symlink')
        rmSync(target, { recursive: true })
      } else {
        oldGeneration = generationSnapshot(target)
        if (
          expectedGeneration &&
          (oldGeneration.generation !== expectedGeneration.generation ||
            oldGeneration.dev !== expectedGeneration.dev ||
            oldGeneration.ino !== expectedGeneration.ino)
        ) {
          throw new Error('managed generation changed during operation')
        }
      }
    }
    symlinkSync(path.basename(stage), link, 'dir')
    renameSync(link, target)
  } catch (error) {
    if (existsSync(link)) unlinkSync(link)
    if (!existsSync(target) || realpathSync(target) !== stage) rmSync(stage, { recursive: true, force: true })
    throw error
  }
  if (oldGeneration) {
    try {
      cleanupGeneration(oldGeneration)
    } catch (error) {
      console.warn(`WARN committed profile; old generation cleanup pending: ${oldGeneration.generation}: ${error.message}`)
    }
  }
}

function installOrUpdate(options) {
  const exists = existsSync(options.target)
  if (options.operation === 'install' && exists && (readdirSync(options.target).length > 0 || managed(options.target))) {
    throw new Error('install target must be absent or empty')
  }
  if (options.operation === 'update' && !managed(options.target)) throw new Error('update requires managed target')
  let generation = null
  if (options.operation === 'update') {
    generation = generationSnapshot(options.target)
    inspectProfileOwnership(generation.generation, options.target)
  }
  const stage = buildStaging(options)
  replaceTarget(options.target, stage, generation)
}

function mutateUnit(options) {
  if (!managed(options.target)) throw new Error('operation requires managed target')
  if (options.operation === 'remove' && options.all) {
    const generation = generationSnapshot(options.target)
    inspectProfileOwnership(generation.generation, options.target)
    if (!sameGeneration(generation) || managedGeneration(options.target) !== generation.generation) {
      throw new Error('managed generation changed during operation')
    }
    unlinkSync(options.target)
    try {
      cleanupGeneration(generation)
    } catch (error) {
      console.warn(`WARN profile removed; generation cleanup pending: ${generation.generation}: ${error.message}`)
    }
    return
  }
  if (!options.unit) throw new Error('operation requires --unit')
  const generation = generationSnapshot(options.target)
  const parent = path.dirname(options.target)
  const stage = mkdtempSync(path.join(parent, `.${path.basename(options.target)}.mutation-`))
  try {
    cpSync(generation.generation, stage, { recursive: true })
    inspectProfile(stage, { quiet: true, expectedTarget: options.target })
    const stateFile = path.join(stage, 'profile-state.json')
    const state = JSON.parse(readFileSync(stateFile, 'utf8'))
    const entry = state.packages.find((candidate) => candidate.unit === options.unit)
    if (!entry) throw new Error(`unit not installed: ${options.unit}`)
    const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'))
    const unit = catalog.packages.find((candidate) => candidate.id === options.unit)
    if (!unit || entry.pluginName !== unit.pluginName) throw new Error(`unit package mismatch: ${options.unit}`)
    const pluginName = unit.pluginName
    if (options.operation === 'disable') {
      if (entry.unit === 'governance-core') throw new Error('governance core cannot be disabled')
      if (entry.enabled === false) throw new Error(`unit already disabled: ${entry.unit}`)
      const disabledRoot = path.join(stage, 'disabled-packages')
      mkdirSync(disabledRoot, { recursive: true })
      renameSync(
        path.join(stage, 'packages', pluginName),
        path.join(disabledRoot, pluginName),
      )
      entry.enabled = false
    } else {
      if (entry.unit === 'governance-core') throw new Error('core removal requires --all')
      if (entry.unit.endsWith('-adapter') && state.profile === 'workflow-assisted') {
        throw new Error('remove workflow-pack before adapter')
      }
      const packageArea = entry.enabled === false ? 'disabled-packages' : 'packages'
      rmSync(path.join(stage, packageArea, pluginName), { recursive: true })
      state.packages = state.packages.filter((candidate) => candidate.unit !== entry.unit)
      if (entry.unit === 'workflow-pack') state.profile = 'agent-governed'
      if (entry.unit.endsWith('-adapter')) {
        state.profile = 'repository-only'
        state.runtime = null
      }
    }
    writeJson(stateFile, state)
    inspectProfile(stage, { quiet: true, expectedTarget: options.target })
    replaceTarget(options.target, stage, generation)
  } catch (error) {
    rmSync(stage, { recursive: true, force: true })
    throw error
  }
}

try {
  const options = parseArgs(process.argv.slice(2))
  if (['install', 'update'].includes(options.operation)) installOrUpdate(options)
  else mutateUnit(options)
  console.log(`OK operation=${options.operation} target=${options.target}`)
} catch (error) {
  usage()
  console.error(`manage-profile: ${error.message}`)
  process.exit(2)
}

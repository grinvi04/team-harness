#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
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

export function inspectProfile(target, { quiet = false } = {}) {
  const stateFile = path.join(target, 'profile-state.json')
  const marker = path.join(target, '.team-harness-profile')
  if (!existsSync(marker) || !existsSync(stateFile)) throw new Error('managed profile marker/state missing')
  const state = readJson(stateFile)
  if (state.schemaVersion !== 1 || !Array.isArray(state.packages)) throw new Error('invalid profile state')
  const installed = new Set(state.packages.map((entry) => entry.unit))
  if (!installed.has('governance-core')) throw new Error('governance core missing from state')

  for (const entry of state.packages) {
    const packageRoot = path.join(target, 'packages', entry.pluginName)
    if (!existsSync(packageRoot)) throw new Error(`package missing: ${entry.unit}`)
    const metadata = readJson(path.join(packageRoot, 'harness-package.json'))
    if (metadata.unit !== entry.unit || metadata.version !== state.version) {
      throw new Error(`package metadata mismatch: ${entry.unit}`)
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
    }
  }
  if (!quiet) console.log(`RESULT healthy profile=${state.profile} packages=${state.packages.length}`)
  return state
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
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

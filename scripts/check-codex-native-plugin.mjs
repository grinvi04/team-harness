#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const pluginId = 'harness-guard@team-harness'
const expectedSkills = [
  'feature-add',
  'feature-merge',
  'feature-modify',
  'hotfix',
  'loop',
  'milestone',
  'plan',
  'pr-create',
  'pr-review-gate',
  'qa',
  'release',
  'release-check',
  'repo-sync',
  'solo-merge',
  'systematic-debugging',
  'verification-before-completion',
]

function fail(message) {
  throw new Error(message)
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    fail(`invalid JSON ${file}: ${error.message}`)
  }
}

function parseArgs(argv) {
  let root = null
  let expectedVersion = null
  let trustedRoot = null
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root' && argv[index + 1]) root = path.resolve(argv[++index])
    else if (argv[index] === '--expected-version' && argv[index + 1]) expectedVersion = argv[++index]
    else if (argv[index] === '--trusted-root' && argv[index + 1]) trustedRoot = path.resolve(argv[++index])
    else fail(`unknown or incomplete argument: ${argv[index]}`)
  }
  return { root, expectedVersion, trustedRoot }
}

function installedPluginRoot() {
  const codex = process.env.CODEX_BIN || 'codex'
  const result = spawnSync(codex, ['plugin', 'list', '--json'], { encoding: 'utf8', env: process.env })
  if (result.error) fail(result.error.message)
  if (result.status !== 0) fail(result.stderr.trim() || `codex plugin list failed: exit ${result.status}`)
  let data
  try {
    data = JSON.parse(result.stdout)
  } catch {
    fail('codex plugin list returned invalid JSON')
  }
  const plugin = data.installed?.find((entry) => entry.pluginId === pluginId)
  if (!plugin) fail(`${pluginId} is not installed`)
  if (plugin.enabled !== true) fail(`${pluginId} is disabled`)
  const root = plugin.source?.path
  if (typeof root !== 'string' || !path.isAbsolute(root)) fail(`${pluginId} source.path is unavailable`)
  return { root, installedVersion: plugin.version }
}

function validate(root, expectedVersion, installedVersion) {
  const manifestPath = path.join(root, '.codex-plugin', 'plugin.json')
  const manifest = readJson(manifestPath)
  if (manifest.name !== 'harness-guard') fail('native manifest name mismatch')
  if (manifest.skills !== './codex/skills/' || manifest.hooks !== './codex/hooks/hooks.json') {
    fail('native manifest skill/hook paths mismatch')
  }
  if (expectedVersion && manifest.version !== expectedVersion) {
    fail(`native manifest version mismatch: ${manifest.version} != ${expectedVersion}`)
  }
  if (installedVersion && manifest.version !== installedVersion) {
    fail(`installed source version mismatch: ${manifest.version} != ${installedVersion}`)
  }

  const hooks = readJson(path.join(root, 'codex', 'hooks', 'hooks.json')).hooks
  const hookEvents = Object.keys(hooks || {}).sort()
  if (JSON.stringify(hookEvents) !== JSON.stringify(['PreToolUse', 'UserPromptSubmit'])) {
    fail('native hook event inventory mismatch')
  }
  const preTool = hooks?.PreToolUse
  const prompt = hooks?.UserPromptSubmit
  if (!Array.isArray(preTool) || preTool.length !== 1 || preTool[0].matcher !== 'Bash') {
    fail('native PreToolUse Bash matcher mismatch')
  }
  if (!Array.isArray(prompt) || prompt.length !== 1 || 'matcher' in prompt[0]) {
    fail('native UserPromptSubmit matcher mismatch')
  }
  const handlers = [...(preTool[0].hooks || []), ...(prompt[0].hooks || [])]
  if (handlers.length !== 2 || handlers.some((handler) => handler.type !== 'command')) {
    fail('native hooks must contain exactly two command handlers')
  }
  if (preTool[0].hooks[0].command !== 'node "${PLUGIN_ROOT}/scripts/codex-pretool-guard.mjs"') {
    fail('native PreToolUse command mismatch')
  }
  if (prompt[0].hooks[0].command !== 'node "${PLUGIN_ROOT}/scripts/route-intent.mjs"') {
    fail('native UserPromptSubmit command mismatch')
  }

  const skillsRoot = path.join(root, 'codex', 'skills')
  const skills = existsSync(skillsRoot)
    ? readdirSync(skillsRoot).filter((name) => existsSync(path.join(skillsRoot, name, 'SKILL.md'))).sort()
    : []
  if (JSON.stringify(skills) !== JSON.stringify(expectedSkills)) fail('native skill inventory mismatch')
  for (const skill of skills) {
    const wrapper = readFileSync(path.join(skillsRoot, skill, 'SKILL.md'), 'utf8')
    if (!wrapper.includes(`../../../skills/${skill}/SKILL.md`) || !wrapper.includes('## Codex 실행')) {
      fail(`${skill}: native wrapper contract mismatch`)
    }
  }
  return { version: manifest.version }
}

function fileInventory(root, relative = '') {
  const directory = path.join(root, relative)
  let entries
  try {
    entries = readdirSync(directory).sort()
  } catch {
    fail(`plugin directory is unreadable: ${relative || '.'}`)
  }
  const files = []
  for (const name of entries) {
    const child = path.join(relative, name)
    const stat = lstatSync(path.join(root, child))
    if (stat.isSymbolicLink()) fail(`plugin tree contains a symbolic link: ${child}`)
    if (stat.isDirectory()) files.push(...fileInventory(root, child))
    else if (stat.isFile()) files.push(child)
    else fail(`plugin tree contains a non-regular entry: ${child}`)
  }
  return files
}

function fileDigest(root, relative) {
  const file = path.join(root, relative)
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function compareTrusted(installedRoot, trustedRoot) {
  const installedFiles = fileInventory(installedRoot)
  const trustedFiles = fileInventory(trustedRoot)
  if (JSON.stringify(installedFiles) !== JSON.stringify(trustedFiles)) {
    fail('trusted source inventory mismatch')
  }
  for (const relative of trustedFiles) {
    if (fileDigest(installedRoot, relative) !== fileDigest(trustedRoot, relative)) {
      fail(`trusted source mismatch: ${relative}`)
    }
  }
}

try {
  const args = parseArgs(process.argv.slice(2))
  const installed = args.root ? { root: args.root, installedVersion: null } : installedPluginRoot()
  const result = validate(installed.root, args.expectedVersion, installed.installedVersion)
  if (args.trustedRoot) {
    validate(args.trustedRoot, args.expectedVersion, null)
    compareTrusted(installed.root, args.trustedRoot)
  }
  console.log(`native harness-guard ${result.version}: manifest, hooks, ${expectedSkills.length} skills`)
} catch (error) {
  console.error(`check-codex-native-plugin: ${error.message}`)
  process.exit(1)
}

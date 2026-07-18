#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { inspectProfile } from './profile-doctor.mjs'

function usage() {
  console.error('usage: check-plugin-coexistence.mjs --profile <managed-profile> --plugins <external-plugin-directory> --json')
}

function parseArgs(argv) {
  const options = { profile: null, plugins: null, json: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--json') options.json = true
    else if (['--profile', '--plugins'].includes(argument) && argv[index + 1]) {
      options[argument.slice(2)] = path.resolve(argv[++index])
    } else throw new Error(`unknown or incomplete argument: ${argument}`)
  }
  if (!options.profile || !options.plugins || !options.json) throw new Error('profile, plugins, and --json are required')
  return options
}

function assertPlainTree(root, label) {
  if (!existsSync(root)) throw new Error(`${label} missing: ${root}`)
  const rootStat = lstatSync(root)
  if (rootStat.isSymbolicLink()) throw new Error(`${label} symlink is not allowed: ${root}`)
  if (!rootStat.isDirectory()) throw new Error(`${label} must be a directory: ${root}`)
  function visit(directory, relative = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      const child = path.posix.join(relative, entry.name)
      const stat = lstatSync(absolute)
      if (stat.isSymbolicLink()) throw new Error(`symlink is not allowed: ${label}:${child}`)
      if (stat.isDirectory()) visit(absolute, child)
      else if (!stat.isFile()) throw new Error(`unsupported file type: ${label}:${child}`)
    }
  }
  visit(root)
}

function readJson(file, label) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`invalid JSON ${label}: ${error.message}`)
  }
}

function manifestName(pluginRoot, runtime) {
  const file = path.join(pluginRoot, `.${runtime}-plugin`, 'plugin.json')
  if (!existsSync(file) || lstatSync(file).isSymbolicLink()) throw new Error(`${runtime} manifest missing or symlinked: ${pluginRoot}`)
  const manifest = readJson(file, `${runtime} manifest`)
  if (typeof manifest.name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(manifest.name)) {
    throw new Error(`invalid ${runtime} plugin identity: ${pluginRoot}`)
  }
  return manifest.name
}

function skillName(skillFile, fallback) {
  const content = readFileSync(skillFile, 'utf8')
  const frontmatter = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(content)
  if (!frontmatter) throw new Error(`skill frontmatter missing: ${skillFile}`)
  const match = /^name:\s*([a-z0-9][a-z0-9-]*)\s*$/m.exec(frontmatter[1])
  if (!match) throw new Error(`skill name missing: ${skillFile}`)
  if (match[1] !== fallback) throw new Error(`skill directory/name mismatch: ${skillFile}`)
  return match[1]
}

function inspectPlugin(pluginRoot, source) {
  assertPlainTree(pluginRoot, `plugin root (${source})`)
  const claudeName = manifestName(pluginRoot, 'claude')
  const codexName = manifestName(pluginRoot, 'codex')
  if (claudeName !== codexName) throw new Error(`manifest identity mismatch: claude=${claudeName} codex=${codexName}`)

  const skills = []
  const skillsRoot = path.join(pluginRoot, 'skills')
  if (existsSync(skillsRoot)) {
    for (const entry of readdirSync(skillsRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) throw new Error(`unsupported skill entry: ${claudeName}:${entry.name}`)
      const file = path.join(skillsRoot, entry.name, 'SKILL.md')
      if (!existsSync(file)) throw new Error(`skill manifest missing: ${claudeName}:${entry.name}`)
      const name = skillName(file, entry.name)
      skills.push({ plugin: claudeName, name, identity: `${claudeName}:${name}` })
    }
  }

  const hooks = []
  const hooksFile = path.join(pluginRoot, 'hooks', 'hooks.json')
  if (existsSync(hooksFile)) {
    const document = readJson(hooksFile, `${claudeName} hooks`)
    if (!document.hooks || typeof document.hooks !== 'object' || Array.isArray(document.hooks)) {
      throw new Error(`invalid hooks document: ${claudeName}`)
    }
    for (const [event, groups] of Object.entries(document.hooks)) {
      if (!Array.isArray(groups)) throw new Error(`invalid hook groups: ${claudeName}:${event}`)
      for (const group of groups) {
        if (!group || typeof group !== 'object' || !Array.isArray(group.hooks)) {
          throw new Error(`invalid hook group: ${claudeName}:${event}`)
        }
        hooks.push({ plugin: claudeName, event, matcher: group.matcher || '*' })
      }
    }
  }
  return { name: claudeName, source, skills, hooks }
}

function externalPluginRoots(directory) {
  assertPlainTree(directory, 'external plugins directory')
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const root = path.join(directory, entry.name)
      if (lstatSync(root).isSymbolicLink()) throw new Error(`plugin root symlink is not allowed: ${entry.name}`)
      if (!entry.isDirectory()) throw new Error(`external plugin entry must be a directory: ${entry.name}`)
      return root
    })
}

try {
  const options = parseArgs(process.argv.slice(2))
  const state = inspectProfile(options.profile, { quiet: true })
  const profileRoots = state.packages
    .filter((entry) => entry.enabled)
    .map((entry) => path.join(options.profile, 'packages', entry.pluginName))
  const plugins = [
    ...profileRoots.map((root) => inspectPlugin(root, 'team-harness-profile')),
    ...externalPluginRoots(options.plugins).map((root) => inspectPlugin(root, 'external')),
  ]

  const identities = new Set()
  for (const plugin of plugins) {
    if (identities.has(plugin.name)) throw new Error(`duplicate plugin identity: ${plugin.name}`)
    identities.add(plugin.name)
  }

  const skills = plugins.flatMap((plugin) => plugin.skills)
  const effectiveSkills = new Set()
  for (const skill of skills) {
    if (effectiveSkills.has(skill.identity)) throw new Error(`duplicate effective skill identity: ${skill.identity}`)
    effectiveSkills.add(skill.identity)
  }

  const hookGroups = new Map()
  for (const hook of plugins.flatMap((plugin) => plugin.hooks)) {
    const key = `${hook.event}\0${hook.matcher}`
    if (!hookGroups.has(key)) hookGroups.set(key, [])
    hookGroups.get(key).push(hook.plugin)
  }
  const hookOverlaps = []
  for (const [key, names] of hookGroups) {
    const pluginNames = [...new Set(names)].sort()
    if (pluginNames.length < 2) continue
    const [event, matcher] = key.split('\0')
    hookOverlaps.push({ event, matcher, plugins: pluginNames, resolution: 'delegated' })
  }

  const report = {
    compatible: true,
    profile: { name: state.profile, runtime: state.runtime, packages: state.packages.length },
    plugins: plugins.map(({ name, source }) => ({ name, source })),
    skills,
    hookOverlaps,
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
} catch (error) {
  console.error(`plugin-coexistence: ${error.message}`)
  process.exit(1)
}

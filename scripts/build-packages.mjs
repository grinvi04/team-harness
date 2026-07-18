#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const expectedUnits = new Map([
  ['governance-core', { kind: 'core', pluginName: 'harness-governance-core' }],
  ['claude-adapter', { kind: 'adapter', pluginName: 'harness-claude-adapter' }],
  ['codex-adapter', { kind: 'adapter', pluginName: 'harness-codex-adapter' }],
  ['workflow-pack', { kind: 'workflow', pluginName: 'harness-workflows' }],
])
const legacyManifest = '.claude-plugin/plugin.json'
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const relativePathPattern = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[^\0]+$/

function usage() {
  console.error('usage: build-packages.mjs [--catalog <path>] (--check | --output <empty-dir>)')
}

function parseArgs(argv) {
  let catalog = path.join(root, 'packaging', 'packages.json')
  let output = null
  let check = false
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--catalog' && argv[index + 1]) {
      catalog = path.resolve(argv[++index])
    } else if (argument === '--output' && argv[index + 1]) {
      output = path.resolve(argv[++index])
    } else if (argument === '--check') {
      check = true
    } else if (argument === '--help' || argument === '-h') {
      usage()
      process.exit(0)
    } else {
      throw new Error(`unknown or incomplete argument: ${argument}`)
    }
  }
  if (check === Boolean(output)) throw new Error('choose exactly one of --check or --output')
  return { catalog, output, check }
}

function readJson(file) {
  try {
    const content = readFileSync(file)
    return {
      value: JSON.parse(content.toString('utf8')),
      digest: `sha256:${createHash('sha256').update(content).digest('hex')}`,
    }
  } catch (error) {
    throw new Error(`invalid JSON ${file}: ${error.message}`)
  }
}

function recordedSourceFiles() {
  const output = execFileSync(
    'git',
    ['ls-tree', '-rz', 'HEAD', '--', 'plugins/harness-guard'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
  const prefix = 'plugins/harness-guard/'
  const files = new Map()
  for (const record of output.split('\0').filter(Boolean)) {
    const match = record.match(/^(\d+)\s+blob\s+[0-9a-f]+\t(.+)$/)
    if (!match || !match[2].startsWith(prefix)) continue
    const file = match[2].slice(prefix.length)
    if (file !== legacyManifest) files.set(file, match[1])
  }
  return files
}

function recordedContent(file) {
  return execFileSync('git', ['show', `HEAD:plugins/harness-guard/${file}`], {
    cwd: root,
    encoding: null,
  })
}

function expectedCompatibility(version) {
  const [major, minor] = version.split('.').map(Number)
  return `>=${version} <${major}.${minor + 1}.0`
}

function validateCatalog(catalog) {
  if (catalog.schemaVersion !== 1) throw new Error('schemaVersion must be 1')
  if (!semverPattern.test(catalog.version || '')) throw new Error('version must be strict semver')
  if (catalog.sourcePlugin !== 'harness-guard') throw new Error('sourcePlugin must be harness-guard')
  if (!Array.isArray(catalog.packages) || catalog.packages.length !== expectedUnits.size) {
    throw new Error(`packages must contain exactly ${expectedUnits.size} units`)
  }

  const packages = new Map()
  for (const unit of catalog.packages) {
    const expected = expectedUnits.get(unit.id)
    if (!expected) throw new Error(`unknown unit: ${unit.id}`)
    if (packages.has(unit.id)) throw new Error(`duplicate unit: ${unit.id}`)
    if (unit.kind !== expected.kind || unit.pluginName !== expected.pluginName) {
      throw new Error(`unit identity mismatch: ${unit.id}`)
    }
    if (typeof unit.description !== 'string' || unit.description.trim() === '') {
      throw new Error(`description missing: ${unit.id}`)
    }
    if (!Array.isArray(unit.dependencies) || !Array.isArray(unit.sources) || unit.sources.length === 0) {
      throw new Error(`dependencies and non-empty sources required: ${unit.id}`)
    }
    packages.set(unit.id, unit)
  }

  const compatibility = expectedCompatibility(catalog.version)
  for (const unit of packages.values()) {
    const expectedDependencies = unit.id === 'governance-core' ? [] : ['governance-core']
    const dependencyIds = unit.dependencies.map((dependency) => dependency.id)
    if (JSON.stringify(dependencyIds) !== JSON.stringify(expectedDependencies)) {
      throw new Error(`invalid dependency direction: ${unit.id} -> ${dependencyIds.join(',')}`)
    }
    for (const dependency of unit.dependencies) {
      if (!packages.has(dependency.id)) throw new Error(`unknown dependency: ${dependency.id}`)
      if (dependency.version !== compatibility) {
        throw new Error(`incompatible dependency range: ${unit.id} -> ${dependency.version}`)
      }
    }
  }

  const recordedFiles = recordedSourceFiles()
  const allFiles = [...recordedFiles.keys()].sort()
  const owners = new Map()
  for (const unit of packages.values()) {
    const seenSources = new Set()
    for (const source of unit.sources) {
      if (typeof source !== 'string' || !relativePathPattern.test(source) || path.posix.normalize(source) !== source) {
        throw new Error(`unsafe source path: ${source}`)
      }
      if (seenSources.has(source)) throw new Error(`duplicate source entry: ${unit.id}:${source}`)
      seenSources.add(source)
      const matches = allFiles.filter((file) => file === source || file.startsWith(`${source}/`))
      if (matches.length === 0) throw new Error(`source is not a tracked file or directory: ${source}`)
      for (const file of matches) {
        if (recordedFiles.get(file) === '120000') throw new Error(`source is symlinked: ${file}`)
        if (owners.has(file)) throw new Error(`source assigned more than once: ${file}`)
        owners.set(file, unit.id)
      }
    }
  }

  const missing = allFiles.filter((file) => !owners.has(file))
  if (missing.length > 0) throw new Error(`unassigned source files: ${missing.join(', ')}`)

  for (const unit of packages.values()) {
    const bindings = unit.runtimeBindings || []
    if (!Array.isArray(bindings)) throw new Error(`runtimeBindings must be an array: ${unit.id}`)
    const seenBindings = new Set()
    for (const binding of bindings) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(binding.environment || '')) {
        throw new Error(`invalid runtime binding environment: ${unit.id}`)
      }
      if (
        typeof binding.consumer !== 'string' ||
        typeof binding.target !== 'string' ||
        !relativePathPattern.test(binding.consumer) ||
        !relativePathPattern.test(binding.target)
      ) {
        throw new Error(`invalid runtime binding path: ${unit.id}`)
      }
      if (!unit.dependencies.some((dependency) => dependency.id === binding.unit)) {
        throw new Error(`runtime binding must target a dependency: ${unit.id} -> ${binding.unit}`)
      }
      if (owners.get(binding.consumer) !== unit.id) {
        throw new Error(`runtime binding consumer is not owned by unit: ${binding.consumer}`)
      }
      if (owners.get(binding.target) !== binding.unit) {
        throw new Error(`runtime binding target is not owned by dependency: ${binding.target}`)
      }
      const key = `${binding.consumer}\0${binding.environment}\0${binding.unit}\0${binding.target}`
      if (seenBindings.has(key)) throw new Error(`duplicate runtime binding: ${unit.id}`)
      seenBindings.add(key)
    }
  }
  return { packages, files: allFiles, owners, modes: recordedFiles, compatibility }
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function codexManifest(unit, version, hasSkills) {
  const manifest = {
    name: unit.pluginName,
    version,
    description: unit.description,
    author: { name: 'grinvi04' },
    license: 'MIT',
    keywords: ['team-harness', 'governance', unit.kind],
    interface: {
      displayName: unit.pluginName,
      shortDescription: unit.description,
      longDescription: `${unit.description}. Team Harness staged package artifact.`,
      developerName: 'grinvi04',
      category: 'Developer Tools',
      capabilities: ['Governance'],
      defaultPrompt: ['Inspect this staged Team Harness package artifact.'],
    },
  }
  if (hasSkills) manifest.skills = './skills/'
  return manifest
}

function applyRuntimeBindings(packageRoot, unit) {
  const bindings = unit.runtimeBindings || []
  const groups = new Map()
  for (const binding of bindings) {
    const key = `${binding.consumer}\0${binding.environment}\0${binding.unit}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(binding)
  }

  for (const group of groups.values()) {
    const [{ consumer: consumerPath, environment }] = group
    const consumer = path.join(packageRoot, consumerPath)
    const original = readFileSync(consumer, 'utf8')
    const dependencyRoot = `\${${environment}}`
    let rewritten = original

    for (const binding of group) {
      if (!original.includes(binding.target)) {
        throw new Error(`runtime binding reference missing: ${binding.consumer}:${binding.target}`)
      }
      rewritten = rewritten.replaceAll(
        `\${CLAUDE_PLUGIN_ROOT}/${binding.target}`,
        `${dependencyRoot}/${binding.target}`,
      )
    }

    rewritten = rewritten.replaceAll(
      '${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}',
      dependencyRoot,
    )
    if (rewritten === original || !rewritten.includes(dependencyRoot)) {
      throw new Error(`runtime binding root missing: ${consumerPath}:${environment}`)
    }
    writeFileSync(consumer, rewritten)
  }
}

function build(catalog, validation, output, catalogDigest) {
  if (existsSync(output) && readdirSync(output).length > 0) {
    throw new Error(`output directory is not empty: ${output}`)
  }
  const parent = path.dirname(output)
  mkdirSync(parent, { recursive: true })
  const temporary = mkdtempSync(path.join(parent, `.${path.basename(output)}.tmp-`))
  try {
    const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim()
    for (const unit of catalog.packages) {
      const packageRoot = path.join(temporary, unit.pluginName)
      const files = validation.files.filter((file) => validation.owners.get(file) === unit.id)
      for (const file of files) {
        const destination = path.join(packageRoot, file)
        mkdirSync(path.dirname(destination), { recursive: true })
        writeFileSync(destination, recordedContent(file))
        chmodSync(destination, validation.modes.get(file) === '100755' ? 0o755 : 0o644)
      }
      applyRuntimeBindings(packageRoot, unit)
      const hasSkills = files.some((file) => file.startsWith('skills/'))
      mkdirSync(path.join(packageRoot, '.claude-plugin'), { recursive: true })
      mkdirSync(path.join(packageRoot, '.codex-plugin'), { recursive: true })
      writeFileSync(
        path.join(packageRoot, '.claude-plugin', 'plugin.json'),
        json({
          name: unit.pluginName,
          description: unit.description,
          version: catalog.version,
          author: { name: 'grinvi04' },
        }),
      )
      writeFileSync(
        path.join(packageRoot, '.codex-plugin', 'plugin.json'),
        json(codexManifest(unit, catalog.version, hasSkills)),
      )
      writeFileSync(
        path.join(packageRoot, 'harness-package.json'),
        json({
          schemaVersion: 1,
          unit: unit.id,
          kind: unit.kind,
          version: catalog.version,
          coreCompatibility: unit.id === 'governance-core' ? catalog.version : validation.compatibility,
          dependencies: unit.dependencies,
          sourcePlugin: catalog.sourcePlugin,
          sourcePluginCommit: sourceCommit,
          catalogDigest,
          runtimeBindings: unit.runtimeBindings || [],
          installable: false,
        }),
      )
    }
    if (existsSync(output)) rmdirSync(output)
    renameSync(temporary, output)
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true })
    throw error
  }
}

try {
  const options = parseArgs(process.argv.slice(2))
  const parsed = readJson(options.catalog)
  const catalog = parsed.value
  const validation = validateCatalog(catalog)
  if (options.check) {
    console.log(`OK packages=${validation.packages.size} files=${validation.files.length}`)
  } else {
    build(catalog, validation, options.output, parsed.digest)
    console.log(`OK output=${options.output} packages=${validation.packages.size}`)
  }
} catch (error) {
  console.error(`build-packages: ${error.message}`)
  process.exit(1)
}

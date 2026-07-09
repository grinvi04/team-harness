#!/usr/bin/env node
/*
 * Patch the local Codex cache of claude-plugins-official/security-guidance so
 * Codex keeps the plugin enabled but runs its hook commands through the Codex
 * output adapter. This modifies ~/.codex only; Claude Code config is untouched.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SECURITY_PLUGIN = 'security-guidance@claude-plugins-official'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const adapterPath = path.join(scriptDir, 'codex-security-guidance-adapter.mjs')
const dryRun = process.argv.includes('--dry-run')

function shellQuote(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

function timestamp() {
  return new Date().toISOString().replaceAll(/[-:TZ.]/g, '').slice(0, 14)
}

function versionParts(value) {
  return String(value).split('.').map((part) => Number.parseInt(part, 10) || 0)
}

function compareVersions(a, b) {
  const aParts = versionParts(a)
  const bParts = versionParts(b)
  const length = Math.max(aParts.length, bParts.length)
  for (let i = 0; i < length; i += 1) {
    const delta = (aParts[i] || 0) - (bParts[i] || 0)
    if (delta !== 0) return delta
  }
  return a.localeCompare(b)
}

function findSecurityGuidanceHooks() {
  const root = path.join(
    homedir(),
    '.codex',
    'plugins',
    'cache',
    'claude-plugins-official',
    'security-guidance',
  )
  if (!existsSync(root)) {
    throw new Error(`security-guidance cache root not found: ${root}`)
  }
  const candidates = readdirSync(root)
    .map((version) => ({ version, hooksPath: path.join(root, version, 'hooks', 'hooks.json') }))
    .filter((candidate) => existsSync(candidate.hooksPath))
    .sort((a, b) => compareVersions(a.version, b.version))
  if (candidates.length === 0) {
    throw new Error(`security-guidance hooks.json not found under ${root}`)
  }
  return candidates.at(-1).hooksPath
}

function patchHookCommands(hooksPath) {
  const before = readFileSync(hooksPath, 'utf8')
  const data = JSON.parse(before)
  let changed = 0

  for (const groups of Object.values(data.hooks || {})) {
    if (!Array.isArray(groups)) continue
    for (const group of groups) {
      for (const handler of group.hooks || []) {
        if (!handler || typeof handler.command !== 'string') continue
        if (!handler.command.includes('sg-python.sh')) continue

        delete handler.asyncRewake
        delete handler.rewakeMessage
        delete handler.rewakeSummary

        if (!handler.command.includes('codex-security-guidance-adapter.mjs')) {
          handler.command = `node ${shellQuote(adapterPath)} -- ${handler.command}`
          changed += 1
        }
      }
    }
  }

  const after = `${JSON.stringify(data, null, 2)}\n`
  const changedFile = after !== before
  if (after !== before && !dryRun) {
    copyFileSync(hooksPath, `${hooksPath}.backup.${timestamp()}`)
    writeFileSync(hooksPath, after)
  }
  return { changed, changedFile, hooksPath }
}

function enablePlugin() {
  const configPath = path.join(homedir(), '.codex', 'config.toml')
  const before = readFileSync(configPath, 'utf8')
  const sectionRe = /\[plugins\."security-guidance@claude-plugins-official"\]\n(?:[^\[]*\n)?/m
  let after = before

  if (sectionRe.test(before)) {
    after = before.replace(sectionRe, (section) => {
      if (/^enabled\s*=/m.test(section)) {
        return section.replace(/^enabled\s*=.*$/m, 'enabled = true')
      }
      return `${section}enabled = true\n`
    })
  } else {
    after = `${before.trimEnd()}\n\n[plugins."${SECURITY_PLUGIN}"]\nenabled = true\n`
  }

  const changed = after !== before
  if (changed && !dryRun) {
    const backupPath = path.join(tmpdir(), `codex-config.backup.${timestamp()}.toml`)
    copyFileSync(configPath, backupPath)
    writeFileSync(configPath, after)
    return { changed: true, configPath, backupPath }
  }
  return { changed, configPath, backupPath: null }
}

if (!existsSync(adapterPath)) {
  throw new Error(`adapter not found: ${adapterPath}`)
}

const hookResult = patchHookCommands(findSecurityGuidanceHooks())
const configResult = enablePlugin()

console.log(JSON.stringify({
  dryRun,
  hooks: hookResult,
  config: configResult,
}, null, 2))

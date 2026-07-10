#!/usr/bin/env node
/*
 * Replace unsupported Claude prompt hooks in the local Codex cache only.
 * Command hooks remain intact, and the Claude plugin source is never changed.
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const dryRun = process.argv.includes('--dry-run')

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

function timestamp() {
  return new Date().toISOString().replaceAll(/[-:TZ.]/g, '').slice(0, 14)
}

function findHarnessGuardCache() {
  const root = path.join(homedir(), '.codex', 'plugins', 'cache', 'team-harness', 'harness-guard')
  if (!existsSync(root)) {
    throw new Error(`harness-guard cache root not found: ${root}`)
  }
  const candidates = readdirSync(root)
    .map((version) => ({
      version,
      root: path.join(root, version),
      hooksPath: path.join(root, version, 'hooks', 'hooks.json'),
    }))
    .filter((candidate) => existsSync(candidate.hooksPath))
    .sort((a, b) => compareVersions(a.version, b.version))
  if (candidates.length === 0) {
    throw new Error(`harness-guard hooks.json not found under ${root}`)
  }
  return candidates.at(-1)
}

function replacePromptHandlers(hooksPath, egressGuardPath) {
  const before = readFileSync(hooksPath, 'utf8')
  const data = JSON.parse(before)
  let removed = 0

  for (const groups of Object.values(data.hooks || {})) {
    if (!Array.isArray(groups)) continue
    for (const group of groups) {
      if (!Array.isArray(group.hooks)) continue
      group.hooks = group.hooks.map((handler) => {
        if (handler?.type !== 'prompt') return handler
        removed += 1
        return {
          type: 'command',
          command: `node ${egressGuardPath}`,
          timeout: handler.timeout,
          statusMessage: '시크릿 외부 전송 검사 중...',
        }
      })
    }
  }

  const after = `${JSON.stringify(data, null, 2)}\n`
  const changedFile = after !== before
  if (changedFile && !dryRun) {
    copyFileSync(hooksPath, `${hooksPath}.backup.${timestamp()}`)
    writeFileSync(hooksPath, after)
  }
  return { changedFile, hooksPath, removed }
}

function quoteArgumentHints(cacheRoot) {
  const skillsRoot = path.join(cacheRoot, 'skills')
  if (!existsSync(skillsRoot)) return { changedFiles: 0, fixed: 0 }

  let changedFiles = 0
  let fixed = 0
  for (const skill of readdirSync(skillsRoot)) {
    const skillPath = path.join(skillsRoot, skill, 'SKILL.md')
    if (!existsSync(skillPath)) continue
    const before = readFileSync(skillPath, 'utf8')
    const after = before.replace(/^(argument-hint:\s*)(.+)$/m, (_, prefix, value) => {
      const trimmed = value.trim()
      if (!/^["']/.test(trimmed)) return `${prefix}${trimmed}`
      if (/^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.test(trimmed)) return `${prefix}${trimmed}`
      fixed += 1
      return `${prefix}${JSON.stringify(trimmed)}`
    })
    if (after === before) continue
    changedFiles += 1
    if (!dryRun) {
      copyFileSync(skillPath, `${skillPath}.backup.${timestamp()}`)
      writeFileSync(skillPath, after)
    }
  }
  return { changedFiles, fixed }
}

const cache = findHarnessGuardCache()
const egressGuardPath = path.join(cache.root, 'scripts', 'codex-secret-egress-guard.mjs')
if (!existsSync(egressGuardPath)) {
  throw new Error(`Codex cache is missing ${egressGuardPath}; reinstall harness-guard v0.38.0 or newer before patching`)
}
console.log(JSON.stringify({
  dryRun,
  hooks: replacePromptHandlers(cache.hooksPath, egressGuardPath),
  skills: quoteArgumentHints(cache.root),
}, null, 2))

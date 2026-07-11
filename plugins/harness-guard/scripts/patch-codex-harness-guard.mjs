#!/usr/bin/env node
/*
 * Replace unsupported Claude prompt hooks in the local Codex cache only.
 * Command hooks remain intact, and the Claude plugin source is never changed.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const dryRun = process.argv.includes('--dry-run')
const GUARD_REPLACEMENTS = [
  ['GUARD_LOG="${HOME}/.claude/hooks/guard-block.log"', 'GUARD_LOG="${HOME}/.codex/hooks/guard-block.log"\nmkdir -p "$(dirname "$GUARD_LOG")"'],
  ['Claude가 대신 실행하지 않음', 'Codex가 대신 실행하지 않음'],
  ['Claude가 대신 삭제하지 않음', 'Codex가 대신 삭제하지 않음'],
]

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

function replacePromptHandlers(hooksPath, pretoolGuardPath) {
  const before = readFileSync(hooksPath, 'utf8')
  const data = JSON.parse(before)
  let removed = 0

  for (const groups of Object.values(data.hooks || {})) {
    if (!Array.isArray(groups)) continue
    for (const group of groups) {
      if (!Array.isArray(group.hooks)) continue
      if (group.matcher !== 'Bash') continue
      group.hooks = group.hooks.flatMap((handler) => {
        if (handler?.type === 'prompt') { removed += 1; return [] }
        if (handler?.type === 'command' && handler.command?.includes('guard.sh')) {
          return [{
            type: 'command',
            command: `node ${pretoolGuardPath}`,
            timeout: handler.timeout,
            statusMessage: '명령·시크릿 전송 검사 중...',
          }]
        }
        return [handler]
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

function normalizeCodexSkills(cacheRoot) {
  const skillsRoot = path.join(cacheRoot, 'skills')
  const overlaysRoot = path.join(cacheRoot, 'codex', 'skill-overlays')
  if (!existsSync(overlaysRoot)) {
    throw new Error(`Codex skill overlays not found: ${overlaysRoot}; reinstall harness-guard before patching`)
  }
  if (!existsSync(skillsRoot)) return { changedFiles: 0, fixed: 0, normalized: 0, attributions: 0 }

  let changedFiles = 0
  let fixed = 0
  let normalized = 0
  let attributions = 0
  let overlays = 0
  for (const skill of readdirSync(skillsRoot)) {
    const skillPath = path.join(skillsRoot, skill, 'SKILL.md')
    if (!existsSync(skillPath)) continue
    const before = readFileSync(skillPath, 'utf8')
    let after = before.replace(/^(argument-hint:\s*)(.+)$/m, (_, prefix, value) => {
      const trimmed = value.trim()
      if (!/^["']/.test(trimmed)) return `${prefix}${trimmed}`
      if (/^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.test(trimmed)) return `${prefix}${trimmed}`
      fixed += 1
      return `${prefix}${JSON.stringify(trimmed)}`
    })
    after = after.replace(/[ \t]*\((?=[^\n)]*`subagent_type:)[^\n)]*\)/g, () => {
      normalized += 1
      return ''
    })
    after = after.replace(/^Co-Authored-By:\s+Claude\b[^"\n]*(")?(?:\n|$)/gm, (_, closingQuote) => {
      attributions += 1
      return closingQuote ? `${closingQuote}\n` : ''
    })
    after = after.replaceAll(
      '${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}',
      '${CODEX_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}}',
    )
    const overlayPath = path.join(overlaysRoot, `${skill}.md`)
    if (!existsSync(overlayPath)) throw new Error(`Codex skill overlay missing: ${overlayPath}`)
    if (!after.includes('## Codex 실행')) {
      const overlay = readFileSync(overlayPath, 'utf8').trim()
      const injected = after.replace(/^(# [^\n]+\n)/m, `$1\n${overlay}\n`)
      if (injected === after) throw new Error(`Codex skill H1 not found: ${skillPath}`)
      after = injected
      overlays += 1
    }
    if (after === before) continue
    changedFiles += 1
    if (!dryRun) {
      copyFileSync(skillPath, `${skillPath}.backup.${timestamp()}`)
      writeFileSync(skillPath, after)
    }
  }
  return { changedFiles, fixed, normalized, attributions, overlays }
}

function generateCodexGuard(cacheRoot) {
  const sourcePath = path.join(cacheRoot, 'scripts', 'guard.sh')
  const destinationPath = path.join(cacheRoot, 'scripts', 'codex-guard.sh')
  let output = readFileSync(sourcePath, 'utf8')
  for (const [before, after] of GUARD_REPLACEMENTS) {
    if (output.split(before).length !== 2) throw new Error(`Codex guard source contract changed: ${before}`)
    output = output.replace(before, after)
  }
  const current = existsSync(destinationPath) ? readFileSync(destinationPath, 'utf8') : null
  const changedFile = current !== output
  if (changedFile && !dryRun) writeFileSync(destinationPath, output, { mode: 0o755 })
  return { changedFile, guardPath: destinationPath }
}

function validateCodexCache(cacheRoot, pretoolGuardPath) {
  if (!existsSync(pretoolGuardPath)) {
    throw new Error(`Codex cache is missing ${pretoolGuardPath}; reinstall harness-guard v0.54.0 or newer before patching`)
  }
  const skillsRoot = path.join(cacheRoot, 'skills')
  const overlaysRoot = path.join(cacheRoot, 'codex', 'skill-overlays')
  if (!existsSync(skillsRoot) || !existsSync(overlaysRoot)) {
    throw new Error(`Codex skill bundle is incomplete under ${cacheRoot}; reinstall harness-guard v0.54.0 or newer before patching`)
  }
  for (const skill of readdirSync(skillsRoot)) {
    if (!existsSync(path.join(skillsRoot, skill, 'SKILL.md'))) continue
    const overlayPath = path.join(overlaysRoot, `${skill}.md`)
    if (!existsSync(overlayPath)) throw new Error(`Codex skill overlay missing: ${overlayPath}`)
  }
  const guard = readFileSync(path.join(cacheRoot, 'scripts', 'guard.sh'), 'utf8')
  for (const [before] of GUARD_REPLACEMENTS) {
    if (guard.split(before).length !== 2) throw new Error(`Codex guard source contract changed: ${before}`)
  }
}

function installCodexAgents(cacheRoot) {
  const sourceDir = path.join(cacheRoot, 'codex', 'agents')
  if (!existsSync(sourceDir)) {
    throw new Error(`Codex agent bundle not found: ${sourceDir}; reinstall harness-guard v0.42.0 or newer before patching`)
  }

  const agentFiles = readdirSync(sourceDir)
    .filter((file) => /^harness-[a-z0-9-]+\.toml$/.test(file))
    .sort()
  if (agentFiles.length === 0) {
    throw new Error(`Codex agent bundle is empty: ${sourceDir}`)
  }

  const destinationDir = path.join(homedir(), '.codex', 'agents')
  let changedFiles = 0
  for (const file of agentFiles) {
    const sourcePath = path.join(sourceDir, file)
    const destinationPath = path.join(destinationDir, file)
    const source = readFileSync(sourcePath, 'utf8')
    const destination = existsSync(destinationPath) ? readFileSync(destinationPath, 'utf8') : null
    if (source === destination) continue
    changedFiles += 1
    if (!dryRun) {
      mkdirSync(destinationDir, { recursive: true })
      if (destination !== null) copyFileSync(destinationPath, `${destinationPath}.backup.${timestamp()}`)
      writeFileSync(destinationPath, source)
    }
  }
  return { changedFiles, agentDir: destinationDir, files: agentFiles }
}

const cache = findHarnessGuardCache()
const pretoolGuardPath = path.join(cache.root, 'scripts', 'codex-pretool-guard.mjs')
validateCodexCache(cache.root, pretoolGuardPath)
console.log(JSON.stringify({
  dryRun,
  hooks: replacePromptHandlers(cache.hooksPath, pretoolGuardPath),
  skills: normalizeCodexSkills(cache.root),
  guard: generateCodexGuard(cache.root),
  agents: installCodexAgents(cache.root),
}, null, 2))

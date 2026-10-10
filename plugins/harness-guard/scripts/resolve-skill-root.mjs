#!/usr/bin/env node
import { realpathSync, readFileSync } from 'node:fs'
import path from 'node:path'

try {
  const skillFile = process.argv[2]
  if (!skillFile || !path.isAbsolute(skillFile)) throw new Error('loaded SKILL.md absolute path is required')
  const skill = realpathSync(skillFile)
  const match = skill.match(/^(.*?)\/(?:codex\/)?skills\/[^/]+\/SKILL\.md$/)
  if (!match) throw new Error('unsupported loaded skill path')
  const root = match[1]
  const manifest = JSON.parse(readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'))
  if (manifest.name !== 'harness-guard') throw new Error('loaded skill is not from harness-guard')
  for (const key of ['CLAUDE_PLUGIN_ROOT', 'HARNESS_PLUGIN_ROOT']) {
    if (process.env[key] && !path.isAbsolute(process.env[key])) throw new Error(`${key} absolute path is required`)
    if (process.env[key] && realpathSync(process.env[key]) !== root) throw new Error(`${key} differs from loaded skill root`)
  }
  process.stdout.write(`${root}\n`)
} catch (error) {
  console.error(`resolve-skill-root: ${error.message}`)
  process.exitCode = 1
}

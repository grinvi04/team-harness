#!/usr/bin/env node
/* Normalize Codex exec payloads, then run the two Claude-shaped policy guards. */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

let raw = ''
for await (const chunk of process.stdin) raw += chunk

let hook
try {
  hook = JSON.parse(raw)
} catch {
  process.exit(0)
}

const command = hook?.tool_input?.command ?? hook?.tool_input?.cmd
if (typeof command !== 'string') process.exit(0)

const normalized = JSON.stringify({
  ...hook,
  tool_name: 'Bash',
  tool_input: { ...(hook.tool_input || {}), command },
})
const scripts = path.dirname(fileURLToPath(import.meta.url))

for (const [program, args] of [
  ['bash', [path.join(scripts, 'guard.sh')]],
  ['node', [path.join(scripts, 'codex-secret-egress-guard.mjs')]],
]) {
  const result = spawnSync(program, args, { input: normalized, encoding: 'utf8' })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) {
    process.stderr.write(`Codex pretool guard failed: ${result.error.message}\n`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}

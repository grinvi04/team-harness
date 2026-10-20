#!/usr/bin/env node
/* Normalize Codex exec payloads, then run the shared policy guards. */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const { observeHook } = await import('./codex-observation.mjs').catch(() => ({ observeHook: async () => null }))

let raw = ''
for await (const chunk of process.stdin) raw += chunk

let hook
let observationInput
try { observationInput = JSON.parse(raw) } catch { /* Existing invalid-input gate below owns the result. */ }
const observation = await observeHook(observationInput)
const finish = (outcome, reason, rc) => observation?.finish(outcome, reason, rc)
try {
  hook = JSON.parse(raw)
} catch {
  process.stderr.write('Codex pretool guard failed: invalid hook JSON\n')
  finish('deny', 'INPUT_INVALID', 2)
  process.exit(2)
}

const command = hook?.tool_input?.command ?? hook?.tool_input?.cmd
if (typeof command !== 'string') {
  process.stderr.write('Codex pretool guard failed: command is required\n')
  finish('deny', 'INPUT_INVALID', 2)
  process.exit(2)
}

const normalized = JSON.stringify({
  ...hook,
  tool_name: 'Bash',
  tool_input: { ...(hook.tool_input || {}), command },
})
const scripts = path.dirname(fileURLToPath(import.meta.url))
const pluginData = process.env.PLUGIN_DATA
if (!pluginData) {
  process.stderr.write('Codex pretool guard failed: PLUGIN_DATA is required\n')
  finish('unverified', 'CONTEXT_MISSING', 1)
  process.exit(1)
}
const guardEnvironment = {
  ...process.env,
  HARNESS_AGENT_NAME: 'Codex',
  HARNESS_GUARD_LOG: path.join(pluginData, 'guard-block.log'),
  HARNESS_OBSERVE_DIR: path.join(pluginData, 'observability'),
  ...(observation ? { HARNESS_OBSERVE_PARENT: observation.state.operationId,
    HARNESS_OBSERVE_SESSION: observation.state.hostSessionId ?? '' } : {}),
}
for (const [program, args, env] of [
  ['bash', [path.join(scripts, 'guard.sh')], guardEnvironment],
  ['node', [path.join(scripts, 'codex-secret-egress-guard.mjs')], guardEnvironment],
]) {
  const result = spawnSync(program, args, { input: normalized, encoding: 'utf8', env })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) {
    process.stderr.write(`Codex pretool guard failed: ${result.error.message}\n`)
    finish('unverified', 'EXECUTION_ERROR', 1)
    process.exit(1)
  }
  if (result.status !== 0) {
    const reason = result.status === 2 && program === 'bash' ? observation?.denialReason?.() || 'GUARD_DENIED' : 'GUARD_DENIED'
    finish(result.status === 2 ? 'deny' : 'unverified', result.status === 2 ? reason : 'EXECUTION_ERROR', result.status ?? 1)
    process.exit(result.status ?? 1)
  }
}
finish('allow', 'GUARD_ALLOWED', 0)

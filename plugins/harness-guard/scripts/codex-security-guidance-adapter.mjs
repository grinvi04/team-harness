#!/usr/bin/env node
/*
 * Codex adapter for claude-plugins-official/security-guidance hooks.
 *
 * The upstream plugin is intentionally Claude Code-shaped. It emits telemetry
 * fields such as metrics/rewakeSummary and relies on asyncRewake. Codex knows
 * hookSpecificOutput.additionalContext, decision, and reason, but rejects the
 * Claude-only fields when they appear in PostToolUse JSON. This wrapper keeps
 * the security guidance payload while stripping unsupported fields.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function usage() {
  console.error('usage: codex-security-guidance-adapter.mjs -- <hook-command> [args...]')
}

function parseHookEventName(stdinText) {
  try {
    const input = JSON.parse(stdinText)
    return typeof input.hook_event_name === 'string' ? input.hook_event_name : ''
  } catch {
    return ''
  }
}

function firstJsonObject(stdout) {
  for (const line of stdout.split(/\r?\n/)) {
    const text = line.trim()
    if (!text.startsWith('{')) continue
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }
  return null
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value : ''
}

function sanitizeHookSpecificOutput(value, fallbackEventName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const hookEventName = nonEmptyString(value.hookEventName) || fallbackEventName
  const additionalContext = nonEmptyString(value.additionalContext)
  if (!hookEventName || !additionalContext) return null

  return {
    hookEventName,
    additionalContext,
  }
}

function sanitizeOutput(raw, fallbackEventName) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const out = {}
  const hookSpecificOutput = sanitizeHookSpecificOutput(
    raw.hookSpecificOutput,
    fallbackEventName,
  )
  if (hookSpecificOutput) out.hookSpecificOutput = hookSpecificOutput

  const decision = nonEmptyString(raw.decision)
  const reason = nonEmptyString(raw.reason)
  if (decision === 'block' && reason) {
    out.decision = 'block'
    out.reason = reason
  }

  const systemMessage = nonEmptyString(raw.systemMessage)
  if (systemMessage) out.systemMessage = systemMessage

  return Object.keys(out).length ? out : null
}

function feedbackText(sanitized, raw) {
  const fromSpecific = sanitized?.hookSpecificOutput?.additionalContext
  if (fromSpecific) return fromSpecific
  const fromReason = sanitized?.reason
  if (fromReason) return fromReason
  const rawSpecific = raw?.hookSpecificOutput?.additionalContext
  return nonEmptyString(rawSpecific)
}

const separator = process.argv.indexOf('--')
if (separator < 0 || separator === process.argv.length - 1) {
  usage()
  process.exit(2)
}

const command = process.argv[separator + 1]
const args = process.argv.slice(separator + 2)
const stdin = readFileSync(0)
const stdinText = stdin.toString('utf8')
const fallbackEventName = parseHookEventName(stdinText)

const child = spawnSync(command, args, {
  input: stdin,
  encoding: 'utf8',
  env: process.env,
})

if (child.error) {
  console.error(`security-guidance adapter failed to run child hook: ${child.error.message}`)
  process.exit(1)
}

const rawOutput = firstJsonObject(child.stdout || '')
const sanitized = sanitizeOutput(rawOutput, fallbackEventName)
let stderr = child.stderr || ''

if (sanitized) {
  process.stdout.write(`${JSON.stringify(sanitized)}\n`)
}

const status = child.status ?? 1
if (status === 2 && !stderr.trim()) {
  const feedback = feedbackText(sanitized, rawOutput) || (child.stdout || '').trim()
  if (feedback) stderr = `${feedback}\n`
}

if (stderr) process.stderr.write(stderr)
process.exit(status)

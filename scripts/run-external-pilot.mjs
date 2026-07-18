#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function usage() {
  console.error('usage: run-external-pilot.mjs --repo <clean-git-repo> --output <new-json-file>')
}

function parseArgs(argv) {
  const options = { repo: null, output: null }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (['--repo', '--output'].includes(argument) && argv[index + 1]) {
      options[argument.slice(2)] = path.resolve(argv[++index])
    } else throw new Error(`unknown or incomplete argument: ${argument}`)
  }
  if (!options.repo || !options.output) throw new Error('--repo and --output are required')
  if (existsSync(options.output)) throw new Error(`output already exists: ${options.output}`)
  return options
}

function safeEnvironment(environment = process.env) {
  return Object.fromEntries(Object.entries(environment).filter(([name]) => !name.startsWith('GIT_')))
}

function canonicalDestination(destination) {
  const missing = []
  let ancestor = path.dirname(destination)
  while (!existsSync(ancestor)) {
    missing.unshift(path.basename(ancestor))
    ancestor = path.dirname(ancestor)
  }
  return path.join(realpathSync(ancestor), ...missing, path.basename(destination))
}

function run(command, args, { cwd = root, input = null, env = process.env } = {}) {
  return spawnSync(command, args, {
    cwd,
    input,
    env,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
}

function git(repo, args, allowFailure = false) {
  const result = run('git', ['-c', 'core.fsmonitor=false', ...args], {
    cwd: repo,
    env: { ...safeEnvironment(), GIT_OPTIONAL_LOCKS: '0' },
  })
  if (!allowFailure && result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr.trim()}`)
  return result
}

function sanitizeRemote(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    return `${url.hostname}${url.pathname}`.replace(/\/$/, '')
  } catch {
    const scp = /^(?:[^@]+@)?([^:]+):(.+)$/.exec(value)
    if (scp) return `${scp[1]}/${scp[2].replace(/[?#].*$/, '')}`.replace(/\/$/, '')
    return null
  }
}

function elapsedMs(start) {
  return Number((Number(process.hrtime.bigint() - start) / 1_000_000).toFixed(3))
}

function parseDrift(output, status) {
  const stacksMatch = /감지된 스택:\s*([^\n]+)/.exec(output)
  const summary = /요약:\s*대상\s*(\d+)개\s*·\s*OK\s*(\d+)\s*·\s*WEAK\s*(\d+)\s*·\s*WARN\s*(\d+)\s*·\s*MISSING\s*(\d+)/.exec(output)
  if (!stacksMatch || !summary) throw new Error('repo-sync output contract changed')
  return {
    exitCode: status,
    stacks: stacksMatch[1].split(',').map((value) => value.trim()).filter(Boolean),
    total: Number(summary[1]),
    ok: Number(summary[2]),
    weak: Number(summary[3]),
    warn: Number(summary[4]),
    missing: Number(summary[5]),
  }
}

const benignProbes = [
  { name: 'git-status', command: 'git status --short' },
  { name: 'node-check', command: 'node --check app.mjs' },
  { name: 'test-runner', command: 'bash tests/unit-test.sh' },
  { name: 'project-build', command: 'npm run build' },
]
const blockedProbes = [
  { name: 'protected-commit', command: 'git commit -m x' },
  { name: 'hard-reset', command: 'git reset --hard HEAD~1' },
  { name: 'force-push', command: 'git push --force origin main' },
  { name: 'global-install', command: 'npm install -g unsafe-package' },
  { name: 'test-deletion', command: 'rm src/example.test.ts' },
]

function probeGuard(repo, isolatedHome) {
  const guard = path.join(root, 'plugins', 'harness-guard', 'scripts', 'guard.sh')
  const env = { ...process.env, HOME: isolatedHome }
  const evaluate = ({ name, command }, expectedExit) => {
    const payload = JSON.stringify({
      session_id: 'external-pilot',
      cwd: '<pilot-repo>',
      tool_name: 'Bash',
      tool_input: { command },
    })
    const result = run('bash', [guard], { cwd: repo, input: payload, env })
    return { name, expectedExit, actualExit: result.status, matched: result.status === expectedExit }
  }
  const benign = benignProbes.map((probe) => evaluate(probe, 0))
  const blocked = blockedProbes.map((probe) => evaluate(probe, 2))
  return {
    benign: { total: benign.length, matched: benign.filter((probe) => probe.matched).length, probes: benign },
    blocked: { total: blocked.length, matched: blocked.filter((probe) => probe.matched).length, probes: blocked },
    sampleFalsePositives: benign.filter((probe) => !probe.matched).length,
    sampleFalseNegatives: blocked.filter((probe) => !probe.matched).length,
  }
}

let temporary = null
let createdOutput = null
try {
  const options = parseArgs(process.argv.slice(2))
  const inside = git(options.repo, ['rev-parse', '--is-inside-work-tree'], true)
  if (inside.status !== 0 || inside.stdout.trim() !== 'true') throw new Error('Git repository required')
  options.repo = realpathSync(git(options.repo, ['rev-parse', '--show-toplevel']).stdout.trim())
  const canonicalOutput = canonicalDestination(options.output)
  if (canonicalOutput === options.repo || canonicalOutput.startsWith(`${options.repo}${path.sep}`)) {
    throw new Error('output must be outside the pilot repository')
  }
  mkdirSync(path.dirname(canonicalOutput), { recursive: true })
  options.output = path.join(realpathSync(path.dirname(canonicalOutput)), path.basename(canonicalOutput))
  if (options.output === options.repo || options.output.startsWith(`${options.repo}${path.sep}`)) {
    throw new Error('output must be outside the pilot repository')
  }
  const branch = git(options.repo, ['branch', '--show-current']).stdout.trim()
  if (!branch) throw new Error('attached branch required')
  const beforeHead = git(options.repo, ['rev-parse', 'HEAD']).stdout.trim()
  const beforeStatus = git(options.repo, ['status', '--porcelain=v1', '--untracked-files=all']).stdout
  if (beforeStatus !== '') throw new Error('clean repository required')
  const remoteResult = git(options.repo, ['remote', 'get-url', 'origin'], true)
  const remote = remoteResult.status === 0 ? sanitizeRemote(remoteResult.stdout.trim()) : null

  temporary = mkdtempSync(path.join(os.tmpdir(), 'team-harness-pilot-'))
  const isolatedHome = path.join(temporary, 'home')
  mkdirSync(isolatedHome)
  const profileTarget = path.join(temporary, 'profile')

  let start = process.hrtime.bigint()
  const install = run(process.execPath, [
    path.join(root, 'scripts', 'manage-profile.mjs'),
    'install', '--profile', 'agent-governed', '--runtime', 'codex', '--target', profileTarget,
  ], { env: { ...process.env, HOME: isolatedHome } })
  const installMs = elapsedMs(start)
  if (install.status !== 0) throw new Error(`profile install failed: ${install.stderr.trim()}`)

  start = process.hrtime.bigint()
  const doctor = run(process.execPath, [path.join(root, 'scripts', 'profile-doctor.mjs'), '--target', profileTarget], {
    env: { ...process.env, HOME: isolatedHome },
  })
  const doctorMs = elapsedMs(start)
  if (doctor.status !== 0) throw new Error(`profile doctor failed: ${doctor.stderr.trim()}`)

  start = process.hrtime.bigint()
  const sync = run(process.execPath, [
    path.join(root, 'plugins', 'harness-guard', 'scripts', 'check-repo-sync.mjs'), '--repo', options.repo,
  ])
  const repoSyncMs = elapsedMs(start)
  if (![0, 1].includes(sync.status)) throw new Error(`repo-sync execution failed: ${sync.stderr.trim()}`)
  const drift = { ...parseDrift(`${sync.stdout}\n${sync.stderr}`, sync.status), durationMs: repoSyncMs }
  const guard = probeGuard(options.repo, isolatedHome)

  const afterHead = git(options.repo, ['rev-parse', 'HEAD']).stdout.trim()
  const afterStatus = git(options.repo, ['status', '--porcelain=v1', '--untracked-files=all']).stdout
  if (afterHead !== beforeHead || afterStatus !== beforeStatus) throw new Error('pilot repository changed during measurement')

  const report = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    harnessCommit: git(root, ['rev-parse', 'HEAD']).stdout.trim(),
    repo: { name: path.basename(options.repo), remote, branch, commit: beforeHead },
    profile: { name: 'agent-governed', runtime: 'codex', installMs, doctorMs, healthy: true },
    drift,
    guard,
    repositoryUnchanged: true,
    limitations: [
      'Guard rates describe only the listed command-string probes; they are not full false-positive or false-negative rates.',
      'The pilot does not execute application tests, deployments, LLM sessions, or marketplace installation.',
    ],
  }
  const stagedOutput = `${options.output}.tmp-${process.pid}`
  writeFileSync(stagedOutput, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  renameSync(stagedOutput, options.output)
  createdOutput = options.output
  const finalHead = git(options.repo, ['rev-parse', 'HEAD']).stdout.trim()
  const finalStatus = git(options.repo, ['status', '--porcelain=v1', '--untracked-files=all']).stdout
  if (finalHead !== beforeHead || finalStatus !== beforeStatus) {
    rmSync(createdOutput, { force: true })
    createdOutput = null
    throw new Error('pilot repository changed while writing report')
  }
  console.log(`OK repo=${report.repo.name} installMs=${installMs} missing=${drift.missing} fp=${guard.sampleFalsePositives} fn=${guard.sampleFalseNegatives}`)
} catch (error) {
  usage()
  console.error(`external-pilot: ${error.message}`)
  process.exitCode = 1
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true })
}

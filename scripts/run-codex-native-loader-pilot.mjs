#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const codexBin = process.env.CODEX_BIN || 'codex'

function parseArgs(argv) {
  let source = scriptRoot
  let jsonReport = null
  let markdownReport = null
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index + 1]
    if (argv[index] === '--source' && value) source = path.resolve(argv[++index])
    else if (argv[index] === '--json-report' && value) jsonReport = path.resolve(argv[++index])
    else if (argv[index] === '--markdown-report' && value) markdownReport = path.resolve(argv[++index])
    else throw new Error(`unknown or incomplete argument: ${argv[index]}`)
  }
  if (!jsonReport || !markdownReport) throw new Error('--json-report and --markdown-report are required')
  return { source, jsonReport, markdownReport }
}

function digest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function run(program, args, options = {}) {
  const result = spawnSync(program, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: 'utf8',
  })
  if (result.error) throw new Error(`${options.label || program} failed to start`)
  if (result.status !== 0) throw new Error(`${options.label || program} failed (exit ${result.status})`)
  return result.stdout
}

function codex(args, env, label) {
  return run(codexBin, args, { env, label })
}

function snapshotUserState(env) {
  return {
    marketplaces: codex(['plugin', 'marketplace', 'list', '--json'], env, 'marketplace snapshot'),
    plugins: codex(['plugin', 'list', '--json'], env, 'plugin snapshot'),
  }
}

function snapshotSource(source) {
  return {
    head: run('git', ['rev-parse', 'HEAD'], { cwd: source, label: 'source HEAD snapshot' }).trim(),
    status: run('git', ['status', '--porcelain=v1', '-uall'], { cwd: source, label: 'source status snapshot' }),
  }
}

function markdown(report) {
  const mark = (value) => (value ? 'PASS' : 'FAIL')
  return `# Codex native loader pilot

- 판정: **${report.status.toUpperCase()}**
- 시각: ${report.observedAt}
- Codex: ${report.codex.version || '확인 실패'}
- Team Harness: ${report.harness.version || '확인 실패'} @ ${report.harness.revision || '확인 실패'}

## 검증됨

- 공식 local marketplace 설치: ${mark(report.loader.installed)}
- source-native skill ${report.loader.nativeSkills || 0}개 발견: ${mark(report.loader.nativeSkills === 16)}
- 파괴 명령 차단·sentinel 보존: ${mark(report.session.destructiveGuard)}
- 시크릿 외부 전송 차단: ${mark(report.session.secretEgressGuard)}
- UserPromptSubmit 라우팅: ${report.session.routing || 'FAIL'}
- 사용자 marketplace/plugin 상태 byte-equivalent: ${mark(report.userState.unchanged)}
- 격리 CODEX_HOME 삭제: ${mark(report.cleanup.isolatedHomeRemoved)}

## 판정·한계

- split package 승격: **아니오** — 이번 파일럿은 monolith native loader만 검증했다.
- 추론: loader·hook lifecycle은 Codex 공식 plugin surface가 소유하고 Team Harness는 결과 계약만 연결한다.
- 한계: 단일 Codex 버전·현재 계정의 로컬 표본이며, 외부 security-guidance cache patch 제거는 범위 밖이다.
${report.error ? `- 실패: ${report.error}\n` : ''}`
}

function writeReports(args, report) {
  mkdirSync(path.dirname(args.jsonReport), { recursive: true })
  mkdirSync(path.dirname(args.markdownReport), { recursive: true })
  writeFileSync(args.jsonReport, `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(args.markdownReport, markdown(report))
}

let args
try {
  args = parseArgs(process.argv.slice(2))
} catch (error) {
  console.error(`run-codex-native-loader-pilot: ${error.message}`)
  process.exit(2)
}

const sourceManifest = path.join(args.source, 'plugins', 'harness-guard', '.codex-plugin', 'plugin.json')
const userCodexHome = path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'))
const userEnvironment = { ...process.env, CODEX_HOME: userCodexHome }
let pilotHome = null
let beforeUser = null
let beforeSource = null
let failure = null
const report = {
  schemaVersion: 1,
  status: 'fail',
  observedAt: new Date().toISOString(),
  codex: { version: null },
  harness: { version: null, revision: null },
  loader: { installed: false, nativeSkills: 0 },
  session: { destructiveGuard: false, secretEgressGuard: false, routing: null },
  userState: {
    before: { marketplaces: null, plugins: null },
    after: { marketplaces: null, plugins: null },
    unchanged: null,
  },
  sourceState: { unchanged: null },
  auth: { copied: false },
  cleanup: { isolatedHomeRemoved: false },
  splitPackages: { promoted: false, reason: 'monolith native loader pilot only' },
}

try {
  const source = JSON.parse(readFileSync(sourceManifest, 'utf8'))
  report.harness.version = source.version
  report.codex.version = codex(['--version'], userEnvironment, 'Codex version').trim()
  beforeUser = snapshotUserState(userEnvironment)
  report.userState.before.marketplaces = digest(beforeUser.marketplaces)
  report.userState.before.plugins = digest(beforeUser.plugins)
  beforeSource = snapshotSource(args.source)
  report.harness.revision = beforeSource.head

  pilotHome = mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'team-harness-codex-native-pilot.'))
  const authSource = path.join(userCodexHome, 'auth.json')
  if (process.env.HARNESS_PILOT_SKIP_AUTH !== '1' && existsSync(authSource)) {
    const authTarget = path.join(pilotHome, 'auth.json')
    copyFileSync(authSource, authTarget)
    chmodSync(authTarget, 0o600)
    report.auth.copied = true
  }
  const pilotEnvironment = { ...process.env, CODEX_HOME: pilotHome }

  codex(['plugin', 'marketplace', 'add', args.source, '--json'], pilotEnvironment, 'local marketplace install')
  const installed = JSON.parse(
    codex(['plugin', 'add', 'harness-guard@team-harness', '--json'], pilotEnvironment, 'native plugin install'),
  )
  if (installed.pluginId !== 'harness-guard@team-harness' || installed.version !== source.version) {
    throw new Error('native plugin install identity/version mismatch')
  }
  run(process.execPath, [path.join(args.source, 'scripts', 'check-codex-native-plugin.mjs')], {
    env: pilotEnvironment,
    label: 'native plugin contract',
  })
  report.loader.installed = true
  report.loader.nativeSkills = 16

  const smokeResult = spawnSync('bash', [path.join(args.source, 'scripts', 'codex-fresh-session-smoke.sh')], {
    env: { ...pilotEnvironment, TMPDIR: pilotHome },
    encoding: 'utf8',
  })
  if (smokeResult.error) throw new Error('fresh-session guard smoke failed to start')
  const smoke = `${smokeResult.stdout || ''}\n${smokeResult.stderr || ''}`
  if (smokeResult.status !== 0) {
    if (/failed to lookup address|dns error|error sending request for url|stream disconnected before completion/.test(smoke)) {
      const error = new Error('Codex model network unavailable before hook outcome could be observed')
      error.code = 'session-network-unavailable'
      throw error
    }
    throw new Error(`fresh-session guard smoke failed (exit ${smokeResult.status})`)
  }
  report.session.destructiveGuard = smoke.includes('PASS: destructive guard fresh-session block')
  report.session.secretEgressGuard = smoke.includes('PASS: secret-egress guard fresh-session block')
  if (!report.session.destructiveGuard || !report.session.secretEgressGuard) {
    throw new Error('fresh-session guard evidence missing')
  }

  const routeRepo = path.join(pilotHome, 'route-repo')
  mkdirSync(path.join(routeRepo, 'docs', 'specs'), { recursive: true })
  run('git', ['init', '-q', '-b', 'develop', routeRepo], { label: 'route fixture init' })
  run('git', ['config', 'user.name', 'pilot'], { cwd: routeRepo, label: 'route fixture config' })
  run('git', ['config', 'user.email', 'pilot@example.invalid'], { cwd: routeRepo, label: 'route fixture config' })
  writeFileSync(path.join(routeRepo, 'docs', 'specs', 'pilot.md'), '# approved pilot spec\n')
  run('git', ['add', '.'], { cwd: routeRepo, label: 'route fixture add' })
  run('git', ['commit', '-qm', 'docs: add pilot spec'], { cwd: routeRepo, label: 'route fixture commit' })
  const routeOutput = codex(
    [
      'exec',
      '--ephemeral',
      '--dangerously-bypass-hook-trust',
      '-s',
      'read-only',
      '-C',
      routeRepo,
      '--json',
      '진행해. Do not use tools. Reply only with the exact current Team Harness skill supplied by hook context.',
    ],
    pilotEnvironment,
    'fresh-session routing probe',
  )
  if (!routeOutput.includes('feature-add')) throw new Error('feature-add routing context was not model-visible')
  report.session.routing = 'feature-add'
} catch (error) {
  failure = error
  report.error = error.message
  if (error.code) report.errorCode = error.code
} finally {
  if (pilotHome) {
    try {
      rmSync(pilotHome, { recursive: true, force: true })
      report.cleanup.isolatedHomeRemoved = !existsSync(pilotHome)
    } catch {
      report.cleanup.isolatedHomeRemoved = false
    }
  }
  try {
    const afterUser = snapshotUserState(userEnvironment)
    report.userState.after.marketplaces = digest(afterUser.marketplaces)
    report.userState.after.plugins = digest(afterUser.plugins)
    report.userState.unchanged = Boolean(
      beforeUser &&
        afterUser.marketplaces === beforeUser.marketplaces &&
        afterUser.plugins === beforeUser.plugins,
    )
    if (!report.userState.unchanged && !failure) failure = new Error('user Codex plugin/marketplace state drifted')
  } catch {
    report.userState.unchanged = false
    if (!failure) failure = new Error('user Codex state restoration could not be verified')
  }
  try {
    const afterSource = snapshotSource(args.source)
    report.sourceState.unchanged = Boolean(
      beforeSource && afterSource.head === beforeSource.head && afterSource.status === beforeSource.status,
    )
    if (!report.sourceState.unchanged && !failure) failure = new Error('source repository changed during pilot')
  } catch {
    report.sourceState.unchanged = false
    if (!failure) failure = new Error('source repository restoration could not be verified')
  }
  if (!report.cleanup.isolatedHomeRemoved && !failure) failure = new Error('isolated Codex home cleanup failed')
  report.status = failure ? 'fail' : 'pass'
  if (failure && !report.error) report.error = failure.message
  writeReports(args, report)
}

if (failure) {
  console.error(`run-codex-native-loader-pilot: ${failure.message}`)
  process.exit(1)
}
console.log(`PASS: Codex native loader pilot (${args.markdownReport})`)

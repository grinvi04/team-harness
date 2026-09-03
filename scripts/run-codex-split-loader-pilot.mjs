#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  establishCodexTrust,
  runVerifiedExecutable,
} from './codex-binary-trust.mjs'
import { treeDigest } from './profile-doctor.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const marketplaceName = 'team-harness-split-pilot'
const fixtureMode = process.env.HARNESS_SPLIT_PILOT_FIXTURE === '1'
const codexOverride = process.env.CODEX_BIN
const gitBin = existsSync('/usr/bin/git') ? '/usr/bin/git' : 'git'
const unitDefinitions = new Map([
  ['harness-governance-core', 'governance-core'],
  ['harness-codex-adapter', 'codex-adapter'],
  ['harness-workflows', 'workflow-pack'],
  ['harness-claude-adapter', 'claude-adapter'],
])
const profiles = [
  { name: 'repository-only', units: ['harness-governance-core'] },
  {
    name: 'agent-governed',
    units: ['harness-governance-core', 'harness-codex-adapter'],
  },
  {
    name: 'workflow-assisted',
    units: ['harness-governance-core', 'harness-codex-adapter', 'harness-workflows'],
  },
]
let verifiedCodexIdentity = null

if (codexOverride && !fixtureMode) {
  console.error(
    'run-codex-split-loader-pilot: CODEX_BIN requires HARNESS_SPLIT_PILOT_FIXTURE=1',
  )
  process.exit(2)
}

function parseArgs(argv) {
  let source = projectRoot
  let revision = null
  let jsonReport = null
  let markdownReport = null
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index + 1]
    if (argv[index] === '--source' && value) source = path.resolve(argv[++index])
    else if (argv[index] === '--revision' && value) revision = argv[++index]
    else if (argv[index] === '--json-report' && value) jsonReport = path.resolve(argv[++index])
    else if (argv[index] === '--markdown-report' && value) {
      markdownReport = path.resolve(argv[++index])
    } else {
      throw new Error('unknown or incomplete argument: ' + argv[index])
    }
  }
  if (!revision || !jsonReport || !markdownReport) {
    throw new Error('--revision, --json-report, and --markdown-report are required')
  }
  if (!/^[0-9a-f]{40}$/.test(revision)) {
    throw new Error('--revision must be an immutable 40-character commit SHA')
  }
  return { source, revision, jsonReport, markdownReport }
}

function sha256(value) {
  return 'sha256:' + createHash('sha256').update(value).digest('hex')
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
    )
  }
  return value
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value))
}

function parseJson(value, label) {
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(label + ' returned invalid JSON')
  }
}

function run(program, args, options = {}) {
  const result = spawnSync(program, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: 'utf8',
  })
  const label = options.label || path.basename(program)
  if (result.error) throw new Error(label + ' failed to start')
  if (result.status !== 0) throw new Error(label + ' failed')
  return result.stdout
}

function gitEnvironment() {
  const environment = { ...process.env }
  for (const key of Object.keys(environment)) {
    if (key.startsWith('GIT_')) delete environment[key]
  }
  if (path.isAbsolute(gitBin)) {
    environment.PATH = [...new Set([path.dirname(gitBin), '/usr/bin', '/bin'])].join(':')
  }
  return environment
}

function runGit(source, args, label) {
  return run(gitBin, args, { cwd: source, env: gitEnvironment(), label })
}

function runCodex(args, env, label) {
  if (!verifiedCodexIdentity) {
    throw new Error('Codex executable was used before trust verification')
  }
  const result = runVerifiedExecutable(verifiedCodexIdentity, args, { env })
  if (result.error) throw new Error(label + ' failed to start')
  if (result.status !== 0) throw new Error(label + ' failed')
  return result.stdout
}

function runCodexJson(args, env, label) {
  return parseJson(runCodex(args, env, label), label)
}

function snapshotSource(source) {
  return {
    head: runGit(source, ['rev-parse', 'HEAD'], 'source HEAD snapshot').trim(),
    status: runGit(
      source,
      ['status', '--porcelain=v1', '-uall'],
      'source status snapshot',
    ),
  }
}

function snapshotUserState(env) {
  const marketplaces = runCodexJson(
    ['plugin', 'marketplace', 'list', '--json'],
    env,
    'user marketplace snapshot',
  )
  const plugins = runCodexJson(
    ['plugin', 'list', '--json'],
    env,
    'user plugin snapshot',
  )
  const canonical = canonicalJson({ marketplaces, plugins })
  return { digest: sha256(canonical), canonical }
}

function resolveRevision(source, requested) {
  const revision = runGit(
    source,
    ['--no-replace-objects', 'rev-parse', '--verify', requested + '^{commit}'],
    'revision resolution',
  ).trim()
  if (revision !== requested) throw new Error('revision did not resolve to the exact requested commit')
  const tree = runGit(
    source,
    ['--no-replace-objects', 'rev-parse', '--verify', revision + '^{tree}'],
    'revision tree resolution',
  ).trim()
  return { revision, tree }
}

function materializeRevision(source, revision, tempRoot) {
  const exactSource = path.join(tempRoot, 'exact-source')
  runGit(
    source,
    ['clone', '--quiet', '--no-checkout', '--no-hardlinks', source, exactSource],
    'exact revision clone',
  )
  runGit(
    exactSource,
    ['--no-replace-objects', 'checkout', '--detach', '--quiet', revision],
    'exact revision checkout',
  )
  const exact = snapshotSource(exactSource)
  if (exact.head !== revision || exact.status !== '') {
    throw new Error('exact revision checkout identity mismatch')
  }
  return exactSource
}

function captureDirectory(directory, label) {
  if (!existsSync(directory) || !lstatSync(directory).isDirectory()) {
    throw new Error(label + ' is unavailable')
  }
  if (lstatSync(directory).isSymbolicLink()) throw new Error(label + ' is symlinked')
  const canonical = realpathSync(directory)
  const stat = statSync(directory)
  return {
    path: canonical,
    device: stat.dev,
    inode: stat.ino,
    digest: treeDigest(canonical),
  }
}

function assertDirectoryIdentity(identity, label) {
  let current
  try {
    current = captureDirectory(identity.path, label)
  } catch {
    throw new Error(label + ' changed during verification')
  }
  if (
    current.path !== identity.path ||
    current.device !== identity.device ||
    current.inode !== identity.inode ||
    current.digest !== identity.digest
  ) {
    throw new Error(label + ' changed during verification')
  }
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative !== '' &&
    relative !== '..' &&
    !relative.startsWith('..' + path.sep) &&
    !path.isAbsolute(relative)
}

function evidencePath(file) {
  const resolved = path.resolve(file)
  const home = realpathSync(os.homedir())
  const temporary = realpathSync(process.env.TMPDIR || os.tmpdir())
  if (resolved === home) return '$HOME'
  if (resolved.startsWith(home + path.sep)) return '$HOME' + resolved.slice(home.length)
  if (resolved === temporary) return '$TMP'
  if (resolved.startsWith(temporary + path.sep)) return '$TMP' + resolved.slice(temporary.length)
  return path.basename(resolved)
}

function prepareReportTargets(args, source, userCodexHome) {
  const protectedRoots = [source, userCodexHome].map((root) => (
    existsSync(root) ? realpathSync(root) : path.resolve(root)
  ))
  const resolveTarget = (file) => {
    const parent = path.dirname(file)
    if (!existsSync(parent) || !lstatSync(parent).isDirectory()) {
      throw new Error('report destination parent must be an existing directory')
    }
    const canonicalParent = realpathSync(parent)
    const parentStat = statSync(canonicalParent)
    const target = path.join(canonicalParent, path.basename(file))
    if (protectedRoots.some((root) => target === root || isWithin(root, target))) {
      throw new Error(
        'report destinations must be outside source repository and user CODEX_HOME',
      )
    }
    let targetStat = null
    try {
      targetStat = lstatSync(target)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (targetStat) {
      if (targetStat.isSymbolicLink()) {
        throw new Error('report destination must not be a symbolic link')
      }
      throw new Error('report destination must not already exist')
    }
    return {
      path: target,
      parent: {
        path: canonicalParent,
        device: parentStat.dev,
        inode: parentStat.ino,
      },
    }
  }
  const jsonReport = resolveTarget(args.jsonReport)
  const markdownReport = resolveTarget(args.markdownReport)
  if (jsonReport.path === markdownReport.path) {
    throw new Error('JSON and Markdown report destinations must be distinct')
  }
  return { jsonReport, markdownReport, protectedRoots }
}

function assertReportParent(target, protectedRoots) {
  let current
  try {
    if (!lstatSync(target.parent.path).isDirectory()) throw new Error('not a directory')
    const canonical = realpathSync(target.parent.path)
    const stat = statSync(canonical)
    current = { path: canonical, device: stat.dev, inode: stat.ino }
  } catch {
    throw new Error('report destination parent changed during verification')
  }
  if (
    current.path !== target.parent.path ||
    current.device !== target.parent.device ||
    current.inode !== target.parent.inode ||
    protectedRoots.some((root) => target.path === root || isWithin(root, target.path))
  ) {
    throw new Error('report destination parent changed during verification')
  }
}

const environmentAllowlist = new Set([
  'COLORTERM',
  'FORCE_COLOR',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'LOGNAME',
  'NO_COLOR',
  'PATH',
  'SHELL',
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
  'TEMP',
  'TERM',
  'TMPDIR',
  'TZ',
  'USER',
])
const fixtureEnvironment = new Set([
  'CODEX_BIN',
  'FAKE_CALLS',
  'FAKE_MODE',
  'HARNESS_SPLIT_PILOT_FIXTURE',
  'TMP',
  'USER_CODEX_HOME',
  'USER_SNAPSHOT_CALLS',
])

function isolatedEnvironment(pilotHome) {
  const environment = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (environmentAllowlist.has(key) || (fixtureMode && fixtureEnvironment.has(key))) {
      environment[key] = value
    }
  }
  environment.HOME = pilotHome
  environment.CODEX_HOME = pilotHome
  environment.XDG_CONFIG_HOME = path.join(pilotHome, '.config')
  environment.XDG_DATA_HOME = path.join(pilotHome, '.local', 'share')
  environment.XDG_STATE_HOME = path.join(pilotHome, '.local', 'state')
  environment.XDG_CACHE_HOME = path.join(pilotHome, '.cache')
  environment.XDG_RUNTIME_DIR = path.join(pilotHome, '.runtime')
  for (const key of [
    'XDG_CONFIG_HOME',
    'XDG_DATA_HOME',
    'XDG_STATE_HOME',
    'XDG_CACHE_HOME',
    'XDG_RUNTIME_DIR',
  ]) {
    mkdirSync(environment[key], { recursive: true, mode: 0o700 })
  }
  return environment
}

function buildMarketplace(exactSource, tempRoot, exact) {
  const catalogRaw = readFileSync(
    path.join(exactSource, 'packaging', 'packages.json'),
    'utf8',
  )
  const catalog = parseJson(catalogRaw, 'package catalog')
  const catalogDigest = sha256(catalogRaw)
  const catalogFile = path.join(tempRoot, 'packages.json')
  const marketplaceRoot = path.join(tempRoot, 'marketplace')
  writeFileSync(catalogFile, catalogRaw)
  run(
    process.execPath,
    [
      path.join(exactSource, 'scripts', 'build-packages.mjs'),
      '--catalog',
      catalogFile,
      '--revision',
      exact.revision,
      '--output',
      marketplaceRoot,
    ],
    {
      cwd: exactSource,
      env: gitEnvironment(),
      label: 'split package build',
    },
  )

  const artifacts = new Map()
  for (const unit of catalog.packages) {
    const packageRoot = path.join(marketplaceRoot, unit.pluginName)
    const identity = captureDirectory(packageRoot, 'generated artifact')
    const metadata = parseJson(
      readFileSync(path.join(packageRoot, 'harness-package.json'), 'utf8'),
      'generated package metadata',
    )
    const codexManifest = parseJson(
      readFileSync(path.join(packageRoot, '.codex-plugin', 'plugin.json'), 'utf8'),
      'generated Codex manifest',
    )
    if (
      unitDefinitions.get(unit.pluginName) !== unit.id ||
      metadata.unit !== unit.id ||
      metadata.version !== catalog.version ||
      metadata.sourcePluginCommit !== exact.revision ||
      metadata.catalogDigest !== catalogDigest ||
      metadata.installable !== false ||
      codexManifest.name !== unit.pluginName ||
      codexManifest.version !== catalog.version
    ) {
      throw new Error('generated artifact identity mismatch')
    }
    artifacts.set(unit.pluginName, {
      unit: unit.id,
      name: unit.pluginName,
      version: catalog.version,
      root: packageRoot,
      digest: identity.digest,
      identity,
    })
  }
  if (artifacts.size !== unitDefinitions.size) {
    throw new Error('generated artifact count mismatch')
  }

  const manifestDirectory = path.join(marketplaceRoot, '.claude-plugin')
  mkdirSync(manifestDirectory, { recursive: true })
  writeFileSync(
    path.join(manifestDirectory, 'marketplace.json'),
    JSON.stringify(
      {
        name: marketplaceName,
        owner: { name: 'grinvi04' },
        plugins: [...artifacts.values()].map((artifact) => ({
          name: artifact.name,
          source: './' + artifact.name,
          description: 'Team Harness staged split package loader pilot artifact',
        })),
      },
      null,
      2,
    ) + '\n',
  )
  return {
    root: marketplaceRoot,
    version: catalog.version,
    catalogDigest,
    artifacts,
  }
}

function installedEntries(inventory) {
  if (!inventory || !Array.isArray(inventory.installed)) {
    throw new Error('plugin inventory returned invalid JSON shape')
  }
  return inventory.installed.filter((entry) => entry.installed !== false && entry.enabled !== false)
}

function marketplaceEntries(inventory) {
  if (!inventory || !Array.isArray(inventory.marketplaces)) {
    throw new Error('marketplace inventory returned invalid JSON shape')
  }
  return inventory.marketplaces
}

function verifyProfileInventory(inventory, expectedUnits) {
  const actual = installedEntries(inventory).map((entry) => {
    if (typeof entry.pluginId !== 'string') {
      throw new Error('plugin inventory identity mismatch')
    }
    return entry.pluginId
  }).sort()
  const expected = expectedUnits.map((name) => name + '@' + marketplaceName).sort()
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error('profile plugin inventory mismatch')
  }
}

function verifyInstalledArtifact(addResult, artifact, pilotHome) {
  if (
    !addResult ||
    addResult.pluginId !== artifact.name + '@' + marketplaceName ||
    addResult.name !== artifact.name ||
    addResult.marketplaceName !== marketplaceName ||
    addResult.version !== artifact.version ||
    typeof addResult.installedPath !== 'string' ||
    !path.isAbsolute(addResult.installedPath)
  ) {
    throw new Error('installed plugin identity/version mismatch')
  }

  const resolvedHome = path.resolve(pilotHome)
  const canonicalHome = realpathSync(pilotHome)
  const reportedPath = path.resolve(addResult.installedPath)
  if (!isWithin(resolvedHome, reportedPath) && !isWithin(canonicalHome, reportedPath)) {
    throw new Error('installed cache escapes isolated CODEX_HOME')
  }
  const expectedReportedPath = path.join(
    resolvedHome,
    'plugins',
    'cache',
    marketplaceName,
    artifact.name,
    artifact.version,
  )
  const expectedCanonicalPath = path.join(
    canonicalHome,
    'plugins',
    'cache',
    marketplaceName,
    artifact.name,
    artifact.version,
  )
  if (reportedPath !== expectedReportedPath && reportedPath !== expectedCanonicalPath) {
    throw new Error('installed cache path mismatch')
  }

  const installed = captureDirectory(reportedPath, 'installed cache')
  if (!isWithin(canonicalHome, installed.path)) {
    throw new Error('installed cache escapes isolated CODEX_HOME')
  }
  if (installed.path !== expectedCanonicalPath) throw new Error('installed cache path mismatch')
  const manifest = parseJson(
    readFileSync(path.join(installed.path, '.codex-plugin', 'plugin.json'), 'utf8'),
    'installed Codex manifest',
  )
  if (manifest.name !== artifact.name || manifest.version !== artifact.version) {
    throw new Error('installed plugin identity/version mismatch')
  }
  if (installed.digest !== artifact.digest) {
    throw new Error('installed cache digest mismatch')
  }
  assertDirectoryIdentity(artifact.identity, 'generated artifact')
  assertDirectoryIdentity(installed, 'installed cache')
  return installed.digest
}

function runProfile(profile, marketplace, tempRoot) {
  const pilotHome = path.join(tempRoot, 'home-' + profile.name)
  mkdirSync(pilotHome, { recursive: true, mode: 0o700 })
  const environment = isolatedEnvironment(pilotHome)
  const installed = []
  const artifactEvidence = []
  const rollbackErrors = []
  let marketplaceAdded = false
  let primaryFailure = null
  let verified = false

  try {
    const addedMarketplace = runCodexJson(
      ['plugin', 'marketplace', 'add', marketplace.root, '--json'],
      environment,
      'marketplace add',
    )
    if (addedMarketplace.marketplaceName !== marketplaceName) {
      throw new Error('marketplace identity mismatch')
    }
    marketplaceAdded = true
    for (const name of profile.units) {
      const artifact = marketplace.artifacts.get(name)
      if (!artifact) throw new Error('profile references missing artifact')
      const selector = name + '@' + marketplaceName
      const result = runCodexJson(
        ['plugin', 'add', selector, '--json'],
        environment,
        'plugin install',
      )
      installed.push(name)
      const digest = verifyInstalledArtifact(result, artifact, pilotHome)
      artifactEvidence.push({
        unit: artifact.unit,
        name,
        version: artifact.version,
        digest,
      })
    }
    verifyProfileInventory(
      runCodexJson(['plugin', 'list', '--json'], environment, 'plugin inventory'),
      profile.units,
    )
    verified = true
  } catch (error) {
    primaryFailure = error
  } finally {
    for (const name of [...installed].reverse()) {
      try {
        runCodexJson(
          ['plugin', 'remove', name + '@' + marketplaceName, '--json'],
          environment,
          'plugin rollback',
        )
      } catch {
        rollbackErrors.push('plugin:' + name)
      }
    }
    if (marketplaceAdded) {
      try {
        runCodexJson(
          ['plugin', 'marketplace', 'remove', marketplaceName, '--json'],
          environment,
          'marketplace rollback',
        )
      } catch {
        rollbackErrors.push('marketplace')
      }
    }
    try {
      const remainingPlugins = runCodexJson(
        ['plugin', 'list', '--json'],
        environment,
        'rollback plugin inventory',
      )
      if (installedEntries(remainingPlugins).length !== 0) {
        rollbackErrors.push('plugin-inventory')
      }
    } catch {
      rollbackErrors.push('plugin-inventory')
    }
    try {
      const remainingMarketplaces = runCodexJson(
        ['plugin', 'marketplace', 'list', '--json'],
        environment,
        'rollback marketplace inventory',
      )
      if (marketplaceEntries(remainingMarketplaces).length !== 0) {
        rollbackErrors.push('marketplace-inventory')
      }
    } catch {
      rollbackErrors.push('marketplace-inventory')
    }
  }

  if (primaryFailure) throw primaryFailure
  if (rollbackErrors.length > 0) throw new Error('plugin rollback failed')
  if (!verified) throw new Error('profile verification did not complete')
  return {
    name: profile.name,
    units: [...profile.units],
    installed: true,
    cacheExact: true,
    artifacts: artifactEvidence,
    rollback: {
      order: [...installed].reverse(),
      complete: true,
    },
  }
}

function markdown(report) {
  const mark = (value) => value ? 'PASS' : 'FAIL'
  const profileLines = report.profiles.map((profile) =>
    '- ' + profile.name + ': 설치 ' + mark(profile.installed) +
      ', cache exact ' + mark(profile.cacheExact) +
      ', rollback ' + mark(profile.rollback.complete) +
      ' (' + profile.units.join(' → ') + ')',
  )
  return [
    '# Codex split package loader·rollback pilot',
    '',
    '- 판정: **' + report.status.toUpperCase() + '**',
    '- 시각: ' + report.observedAt,
    '- 증거: ' + report.evidence.mode,
    '- Codex: ' + (report.codex.version || '확인 실패'),
    '- Codex binary digest: ' + (report.codex.binary.digest || '확인 실패'),
    '- Team Harness revision: ' + (report.harness.revision || '확인 실패'),
    '- Git tree: ' + (report.harness.tree || '확인 실패'),
    '- split package version: ' + (report.packages.version || '확인 실패'),
    '',
    '## profile 검증',
    '',
    ...(profileLines.length > 0 ? profileLines : ['- 완료된 profile 없음']),
    '',
    '## 상태 보존',
    '',
    '- 사용자 Codex 상태 불변: ' + mark(report.userState.unchanged),
    '- source 상태 불변: ' + mark(report.sourceState.unchanged),
    '- 격리 HOME 삭제: ' + mark(report.cleanup.isolatedHomesRemoved),
    '',
    '## 판정·한계',
    '',
    '- split package 승격: **아니오**',
    '- 검증됨: Codex 공식 local marketplace loader의 독립 설치·역순 제거와 exact cache digest.',
    '- 추론: loader lifecycle은 Codex가 소유하고 Team Harness는 결과 계약을 연결한다.',
    '- 한계: Codex plugin dependency/runtime binding 선언 surface와 실제 model·hook session은 검증하지 않았다.',
    '- installable: **false** 유지. 공개 marketplace와 monolith 제거는 범위 밖이다.',
    ...(report.error ? ['- 실패: ' + report.error] : []),
    '',
  ].join('\n')
}

function writeReports(targets, report) {
  const contents = [
    [targets.jsonReport, JSON.stringify(report, null, 2) + '\n'],
    [targets.markdownReport, markdown(report)],
  ]
  const staged = []
  const published = []
  let publicationFailed = false
  let cleanupFailed = false
  try {
    for (const [target, content] of contents) {
      assertReportParent(target, targets.protectedRoots)
      const file = path.join(
        target.parent.path,
        '.team-harness-report.' + randomBytes(16).toString('hex'),
      )
      writeFileSync(file, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      const stat = lstatSync(file)
      staged.push({ file, target, device: stat.dev, inode: stat.ino })
    }
    for (const item of staged) {
      assertReportParent(item.target, targets.protectedRoots)
      const stagedStat = lstatSync(item.file)
      if (stagedStat.dev !== item.device || stagedStat.ino !== item.inode) {
        throw new Error('staged report identity changed')
      }
      linkSync(item.file, item.target.path)
      const targetStat = lstatSync(item.target.path)
      if (targetStat.dev !== item.device || targetStat.ino !== item.inode) {
        throw new Error('published report identity mismatch')
      }
      published.push({ ...item.target, device: item.device, inode: item.inode })
      assertReportParent(item.target, targets.protectedRoots)
    }
  } catch {
    publicationFailed = true
  } finally {
    for (const item of staged) {
      try {
        assertReportParent(item.target, targets.protectedRoots)
        const stat = lstatSync(item.file)
        if (stat.dev !== item.device || stat.ino !== item.inode) {
          throw new Error('staged report identity changed')
        }
        unlinkSync(item.file)
      } catch {
        cleanupFailed = true
      }
    }
  }
  if (publicationFailed || cleanupFailed) {
    try {
      removePublishedReports(targets, published)
    } catch {
      throw new Error('report publication rollback failed')
    }
    throw new Error(cleanupFailed ? 'report staging cleanup failed' : 'report publication failed')
  }
  return published
}

function removePublishedReports(targets, published) {
  let failed = false
  for (const target of [...published].reverse()) {
    try {
      assertReportParent(target, targets.protectedRoots)
      const stat = lstatSync(target.path)
      if (stat.dev !== target.device || stat.ino !== target.inode) {
        throw new Error('published report identity changed')
      }
      unlinkSync(target.path)
    } catch {
      failed = true
    }
  }
  if (failed) throw new Error('published report rollback failed')
}

let args
try {
  args = parseArgs(process.argv.slice(2))
} catch (error) {
  console.error('run-codex-split-loader-pilot: ' + error.message)
  process.exit(2)
}

const codexBin = codexOverride || 'codex'
const userCodexHome = path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'))
const userEnvironment = { ...process.env, CODEX_HOME: userCodexHome }
const report = {
  schemaVersion: 1,
  status: 'fail',
  observedAt: new Date().toISOString(),
  evidence: { mode: fixtureMode ? 'fixture' : 'live' },
  codex: {
    version: null,
    binary: { path: null, digest: null },
  },
  harness: { revision: null, tree: null },
  packages: {
    version: null,
    catalogDigest: null,
    installable: false,
    artifacts: [],
  },
  profiles: [],
  userState: { before: null, after: null, unchanged: null },
  sourceState: { unchanged: null },
  cleanup: { isolatedHomesRemoved: false },
  splitPackages: {
    promoted: false,
    reason: 'dependency/runtime binding declaration and model hook session remain unverified',
  },
}
let beforeSource = null
let beforeUser = null
let tempRoot = null
let failure = null
let reportTargets = null

try {
  if (!existsSync(args.source) || !lstatSync(args.source).isDirectory()) {
    throw new Error('source repository is unavailable')
  }
  reportTargets = prepareReportTargets(args, realpathSync(args.source), userCodexHome)
  beforeSource = snapshotSource(args.source)
  const exact = resolveRevision(args.source, args.revision)
  if (beforeSource.head !== exact.revision) {
    throw new Error('source HEAD does not match requested revision')
  }
  if (beforeSource.status !== '') {
    throw new Error('source repository must be clean before pilot execution')
  }
  report.harness.revision = exact.revision
  report.harness.tree = exact.tree

  tempRoot = mkdtempSync(
    path.join(process.env.TMPDIR || os.tmpdir(), 'team-harness-codex-split-pilot.'),
  )
  const exactSource = materializeRevision(args.source, exact.revision, tempRoot)

  const trustedBinariesPath = path.join(
    exactSource,
    'docs',
    'pilots',
    'codex-native-loader-trusted-binaries.json',
  )
  const trust = establishCodexTrust({
    command: codexBin,
    env: userEnvironment,
    fixtureMode,
    trustedBinariesPath,
  })
  verifiedCodexIdentity = trust.identity
  report.codex.binary.path = evidencePath(trust.path)
  report.codex.binary.digest = trust.digest
  report.codex.version = trust.version ||
    runCodex(['--version'], userEnvironment, 'Codex version').trim()

  beforeUser = snapshotUserState(userEnvironment)
  report.userState.before = beforeUser.digest

  const marketplace = buildMarketplace(exactSource, tempRoot, exact)
  report.packages.version = marketplace.version
  report.packages.catalogDigest = marketplace.catalogDigest
  report.packages.artifacts = [...marketplace.artifacts.values()].map((artifact) => ({
    unit: artifact.unit,
    name: artifact.name,
    version: artifact.version,
    digest: artifact.digest,
  }))

  for (const profile of profiles) {
    report.profiles.push(runProfile(profile, marketplace, tempRoot))
  }
  for (const artifact of marketplace.artifacts.values()) {
    assertDirectoryIdentity(artifact.identity, 'generated artifact')
  }
} catch (error) {
  failure = error
  report.error = error.message
} finally {
  if (tempRoot) {
    try {
      rmSync(tempRoot, { recursive: true, force: true })
      report.cleanup.isolatedHomesRemoved = !existsSync(tempRoot)
    } catch {
      report.cleanup.isolatedHomesRemoved = false
    }
  }
  try {
    if (beforeUser) {
      const afterUser = snapshotUserState(userEnvironment)
      report.userState.after = afterUser.digest
      report.userState.unchanged = beforeUser.canonical === afterUser.canonical
      if (!report.userState.unchanged && !failure) {
        failure = new Error('user Codex state changed')
      }
    }
  } catch {
    report.userState.unchanged = false
    if (!failure) failure = new Error('user Codex state could not be verified')
  }
  try {
    const afterSource = snapshotSource(args.source)
    report.sourceState.unchanged = Boolean(
      beforeSource &&
      beforeSource.head === afterSource.head &&
      beforeSource.status === afterSource.status,
    )
    if (!report.sourceState.unchanged && !failure) {
      failure = new Error('source repository changed')
    }
  } catch {
    report.sourceState.unchanged = false
    if (!failure) failure = new Error('source repository state could not be verified')
  }
  if (!report.cleanup.isolatedHomesRemoved && !failure) {
    failure = new Error('isolated Codex home cleanup failed')
  }
  report.status = failure ? 'fail' : 'pass'
  if (failure && !report.error) report.error = failure.message
  if (reportTargets) {
    let published = null
    try {
      published = writeReports(reportTargets, report)
      if (!failure) {
        const publishedUser = snapshotUserState(userEnvironment)
        const publishedSource = snapshotSource(args.source)
        if (
          !beforeUser ||
          publishedUser.canonical !== beforeUser.canonical ||
          !beforeSource ||
          publishedSource.head !== beforeSource.head ||
          publishedSource.status !== beforeSource.status
        ) {
          removePublishedReports(reportTargets, published)
          published = null
          throw new Error('protected state changed during report publication')
        }
      }
    } catch (error) {
      let reportError = error
      if (published) {
        try {
          removePublishedReports(reportTargets, published)
          published = null
        } catch {
          reportError = new Error('published report rollback failed')
        }
      }
      if (!failure) failure = reportError
      report.status = 'fail'
      if (!report.error) report.error = reportError.message
    }
  }
}

if (failure) {
  console.error('run-codex-split-loader-pilot: ' + failure.message)
  process.exit(1)
}
console.log('PASS: Codex split package loader rollback pilot (' + args.markdownReport + ')')

#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function usage() {
  console.error('usage: build-release-bundle.mjs --output <new-directory>')
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--output') {
    usage()
    process.exit(2)
  }
  return path.resolve(argv[1])
}

function digest(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function filesBelow(directory, prefix = '') {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.posix.join(prefix, entry.name)
    if (entry.isDirectory()) files.push(...filesBelow(path.join(directory, entry.name), relative))
    else if (entry.isFile()) files.push(relative)
    else throw new Error(`unsupported bundle entry: ${relative}`)
  }
  return files
}

const output = parseArgs(process.argv.slice(2))
if (existsSync(output)) throw new Error(`output already exists: ${output}`)
const parent = path.dirname(output)
mkdirSync(parent, { recursive: true })
const temporary = mkdtempSync(path.join(parent, '.team-harness-release-'))

try {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const version = JSON.parse(
    execFileSync('git', ['show', 'HEAD:plugins/harness-guard/.claude-plugin/plugin.json'], {
      cwd: root,
      encoding: 'utf8',
    }),
  ).version
  const archive = `team-harness-v${version}-source.tar`
  execFileSync('git', ['archive', '--format=tar', `--prefix=team-harness-v${version}/`, '-o', path.join(temporary, archive), 'HEAD'], { cwd: root })
  execFileSync(process.execPath, [path.join(root, 'scripts/build-packages.mjs'), '--output', path.join(temporary, 'packages')], { cwd: root, stdio: 'pipe' })

  const packageFiles = filesBelow(path.join(temporary, 'packages')).map((file) => ({
    path: `packages/${file}`,
    sha256: digest(path.join(temporary, 'packages', file)),
  }))
  const manifest = {
    schemaVersion: 1,
    version,
    sourceCommit: commit,
    sourceArchive: { path: archive, sha256: digest(path.join(temporary, archive)) },
    installable: false,
    packages: packageFiles,
  }
  writeFileSync(path.join(temporary, 'RELEASE-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  const checksumFiles = filesBelow(temporary).filter((file) => file !== 'SHA256SUMS')
  writeFileSync(
    path.join(temporary, 'SHA256SUMS'),
    `${checksumFiles.map((file) => `${digest(path.join(temporary, file))}  ${file}`).join('\n')}\n`,
  )
  renameSync(temporary, output)
  console.log(`OK output=${output} version=${version} commit=${commit}`)
} catch (error) {
  rmSync(temporary, { recursive: true, force: true })
  console.error(`build-release-bundle: ${error.message}`)
  process.exit(1)
}

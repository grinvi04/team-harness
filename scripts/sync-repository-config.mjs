#!/usr/bin/env node
// Repository deployment copies. Edit the consumer template, then --write.
import { chmodSync, lstatSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const deploymentCopies = [
  ['templates/githooks/commit-msg', '.githooks/commit-msg'],
  ['templates/ci/commitlint.yml', '.github/workflows/commitlint-trusted.yml'],
  ['templates/ci/test-guard.yml', '.github/workflows/test-guard.yml'],
]

export function syncRepositoryConfig(root, write = false) {
  const drift = []
  // Validate all sources/destinations before any write.
  const copies = deploymentCopies.map(([source, target]) => {
    const sourcePath = path.join(root, source)
    const targetPath = path.join(root, target)
    if (!lstatSync(sourcePath).isFile() || !lstatSync(targetPath).isFile()) {
      throw new Error(`expected regular source and deployment file: ${source} -> ${target}`)
    }
    return { source, target, targetPath, bytes: readFileSync(sourcePath), mode: lstatSync(sourcePath).mode & 0o777 }
  })
  for (const copy of copies) {
    if (!copy.bytes.equals(readFileSync(copy.targetPath)) || (lstatSync(copy.targetPath).mode & 0o777) !== copy.mode) {
      drift.push(copy.target)
      if (write) {
        writeFileSync(copy.targetPath, copy.bytes)
        chmodSync(copy.targetPath, copy.mode)
      }
    }
  }
  return drift
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    if (args.length !== 1 || !['--check', '--write'].includes(args[0])) {
      throw new Error('usage: sync-repository-config.mjs --check|--write')
    }
    const drift = syncRepositoryConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args[0] === '--write')
    if (drift.length && args[0] === '--check') throw new Error(`deployment copy drift: ${drift.join(', ')}`)
    console.log(args[0] === '--write' ? `repository config synchronized (${drift.length} changed)` : 'repository config copies match templates')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

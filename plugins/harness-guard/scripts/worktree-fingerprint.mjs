#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const repoIndex = args.indexOf('--repo')
const repo = resolve(repoIndex >= 0 ? args[repoIndex + 1] : '.')
const hash = createHash('sha256')

function git(gitArgs) {
  return execFileSync('git', ['-C', repo, ...gitArgs], { encoding: null, stdio: ['ignore', 'pipe', 'pipe'] })
}

try {
  hash.update(git(['status', '--porcelain=v1', '-z']))
  hash.update(git(['diff', '--binary', '--no-ext-diff']))
  hash.update(git(['diff', '--cached', '--binary', '--no-ext-diff']))

  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort()

  for (const relativePath of untracked) {
    hash.update(relativePath)
    hash.update('\0')
    hash.update(readFileSync(resolve(repo, relativePath)))
    hash.update('\0')
  }

  console.log(hash.digest('hex'))
} catch (error) {
  const detail = error.stderr?.toString().trim() || error.message
  console.error(`worktree fingerprint 생성 실패: ${detail}`)
  process.exitCode = 2
}

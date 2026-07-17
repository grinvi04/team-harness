#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readlinkSync,
} from 'node:fs'
import { resolve, sep } from 'node:path'

const args = process.argv.slice(2)
const repoIndex = args.indexOf('--repo')
const repo = resolve(repoIndex >= 0 ? args[repoIndex + 1] : '.')
const hash = createHash('sha256')

function git(gitArgs) {
  return execFileSync('git', ['-C', repo, ...gitArgs], { encoding: null, stdio: ['ignore', 'pipe', 'pipe'] })
}

function hashUntracked(relativePath) {
  const absolutePath = resolve(repo, relativePath)
  if (absolutePath !== repo && !absolutePath.startsWith(`${repo}${sep}`)) {
    throw new Error(`repo 밖 untracked 경로 거부: ${relativePath}`)
  }

  const entry = lstatSync(absolutePath)
  if (entry.isSymbolicLink()) {
    hash.update('symlink\0')
    hash.update(readlinkSync(absolutePath))
    return
  }
  if (!entry.isFile()) {
    hash.update(`special\0${entry.mode.toString(8)}\0${entry.size}`)
    return
  }

  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)
  const fd = openSync(absolutePath, flags)
  try {
    const opened = fstatSync(fd)
    if (!opened.isFile() || opened.dev !== entry.dev || opened.ino !== entry.ino) {
      throw new Error(`untracked 파일 유형이 검사 중 변경됨: ${relativePath}`)
    }
    hash.update('file\0')
    hash.update(readFileSync(fd))
  } finally {
    closeSync(fd)
  }
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
    hashUntracked(relativePath)
    hash.update('\0')
  }

  console.log(hash.digest('hex'))
} catch (error) {
  const detail = error.stderr?.toString().trim() || error.message
  console.error(`worktree fingerprint 생성 실패: ${detail}`)
  process.exitCode = 2
}

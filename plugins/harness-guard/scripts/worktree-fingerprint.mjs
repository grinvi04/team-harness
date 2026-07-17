#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readlinkSync,
  realpathSync,
  statSync,
} from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'

const args = process.argv.slice(2)
const repoIndex = args.indexOf('--repo')
const repo = realpathSync(resolve(repoIndex >= 0 ? args[repoIndex + 1] : '.'))
const hash = createHash('sha256')
const FILE_READ_CHUNK_SIZE = 64 * 1024
const fileReadBuffer = Buffer.allocUnsafe(FILE_READ_CHUNK_SIZE)

function git(gitArgs) {
  return execFileSync('git', ['-C', repo, ...gitArgs], { encoding: null, stdio: ['ignore', 'pipe', 'pipe'] })
}

function captureParentDirectories(absolutePath) {
  const parentRelative = relative(repo, dirname(absolutePath))
  if (parentRelative === '..' || parentRelative.startsWith(`..${sep}`)) {
    throw new Error(`repo 밖 parent 경로 거부: ${absolutePath}`)
  }

  const paths = [repo]
  let current = repo
  for (const segment of parentRelative.split(sep).filter(Boolean)) {
    current = resolve(current, segment)
    paths.push(current)
  }
  return paths.map((path) => {
    const entry = lstatSync(path)
    if (!entry.isDirectory()) throw new Error(`symlink·비-directory parent 거부: ${path}`)
    return { path, dev: entry.dev, ino: entry.ino }
  })
}

function assertParentDirectories(snapshot) {
  for (const expected of snapshot) {
    const current = lstatSync(expected.path)
    if (!current.isDirectory() || current.dev !== expected.dev || current.ino !== expected.ino) {
      throw new Error(`untracked parent가 검사 중 변경됨: ${expected.path}`)
    }
  }
}

function assertRegularPath(absolutePath, expected, fd, parents) {
  assertParentDirectories(parents)
  if (realpathSync(absolutePath) !== absolutePath) {
    throw new Error(`repo 밖으로 해석되는 untracked 경로 거부: ${absolutePath}`)
  }
  const pathEntry = statSync(absolutePath)
  const opened = fstatSync(fd)
  if (
    !opened.isFile()
    || opened.dev !== expected.dev
    || opened.ino !== expected.ino
    || pathEntry.dev !== opened.dev
    || pathEntry.ino !== opened.ino
  ) {
    throw new Error(`untracked 파일 유형·경로가 검사 중 변경됨: ${absolutePath}`)
  }
}

function hashUntracked(relativePath) {
  const absolutePath = resolve(repo, relativePath)
  if (absolutePath !== repo && !absolutePath.startsWith(`${repo}${sep}`)) {
    throw new Error(`repo 밖 untracked 경로 거부: ${relativePath}`)
  }

  const parents = captureParentDirectories(absolutePath)
  const entry = lstatSync(absolutePath)
  if (entry.isSymbolicLink()) {
    const link = readlinkSync(absolutePath)
    assertParentDirectories(parents)
    const current = lstatSync(absolutePath)
    if (!current.isSymbolicLink() || current.dev !== entry.dev || current.ino !== entry.ino) {
      throw new Error(`untracked symlink가 검사 중 변경됨: ${relativePath}`)
    }
    hash.update('symlink\0')
    hash.update(link)
    return
  }
  if (!entry.isFile()) {
    assertParentDirectories(parents)
    hash.update(`special\0${entry.mode.toString(8)}\0${entry.size}`)
    return
  }

  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)
  const fd = openSync(absolutePath, flags)
  try {
    assertRegularPath(absolutePath, entry, fd, parents)
    hash.update('file\0')
    while (true) {
      const bytesRead = readSync(fd, fileReadBuffer, 0, fileReadBuffer.length, null)
      if (bytesRead === 0) break
      hash.update(fileReadBuffer.subarray(0, bytesRead))
    }
    assertRegularPath(absolutePath, entry, fd, parents)
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

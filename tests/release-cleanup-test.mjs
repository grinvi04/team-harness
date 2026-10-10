import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const helper = path.join(root, 'plugins/harness-guard/scripts/release-cleanup.sh')
const run = (bin, args, options = {}) => spawnSync(bin, args, { encoding: 'utf8', ...options })
function fixture(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-cleanup-'))
  const repo = path.join(dir, 'repo'), remote = path.join(dir, 'remote.git')
  mkdirSync(repo)
  const git = (...args) => {
    const result = run('git', args, { cwd: repo })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout
  }
  try {
    assert.equal(run('git', ['init', '--bare', '-q', remote]).status, 0)
    git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid')
    writeFileSync(path.join(repo, 'keep'), 'original')
    git('add', 'keep'); git('commit', '-qm', 'fixture'); git('branch', '-M', 'develop')
    git('branch', 'release/v1.2.3'); git('branch', 'sync/backmerge-v1.2.3')
    git('remote', 'add', 'origin', remote); git('push', '-q', 'origin', 'release/v1.2.3')
    const invoke = (env = process.env) => run('bash', [helper, '1.2.3'], { cwd: repo, env })
    fn({ dir, repo, remote, git, invoke })
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('release skill calls the verified plugin helper instead of hiding deletions', () => {
  const skill = readFileSync(path.join(root, 'plugins/harness-guard/skills/release/SKILL.md'), 'utf8')
  assert.ok(skill.includes('/scripts/release-cleanup.sh'))
  assert.ok(!skill.includes('2>/dev/null || true'))
})
test('actual local and remote deletion, then idempotent confirmed absence', () => fixture(({ git, invoke }) => {
  const first = invoke()
  assert.equal(first.status, 0, first.stderr)
  assert.match(first.stdout, /로컬 브랜치 삭제 확인: release\/v1.2.3/)
  assert.match(first.stdout, /원격 브랜치 없음 확인: release\/v1.2.3/)
  assert.equal(git('ls-remote', '--heads', 'origin', 'refs/heads/release/v1.2.3'), '')
  const second = invoke()
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /로컬 브랜치 없음 확인/)
}))
test('other worktree and unmerged commit are preserved with nonzero cleanup', () => fixture(({ dir, repo, git, invoke }) => {
  git('worktree', 'add', '-q', path.join(dir, 'other'), 'release/v1.2.3')
  git('checkout', '-q', 'sync/backmerge-v1.2.3')
  writeFileSync(path.join(repo, 'keep'), 'unmerged')
  git('commit', '-qam', 'unmerged'); git('checkout', '-q', 'develop')
  const result = invoke()
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /로컬 브랜치 보존/)
  git('show-ref', '--verify', 'refs/heads/release/v1.2.3')
  git('show-ref', '--verify', 'refs/heads/sync/backmerge-v1.2.3')
  assert.equal(readFileSync(path.join(dir, 'other/keep'), 'utf8'), 'original')
}))
test('remote lookup failure is unverified rather than confirmed deletion', () => fixture(({ dir, git, invoke }) => {
  git('remote', 'set-url', 'origin', path.join(dir, 'missing.git'))
  const result = invoke()
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /원격 브랜치 정리 미확인/)
  assert.doesNotMatch(result.stdout, /원격 브랜치 없음 확인/)
}))
test('remote deletion rejection preserves remote ref', () => fixture(({ remote, git, invoke }) => {
  writeFileSync(path.join(remote, 'hooks/pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })
  const result = invoke()
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /원격 브랜치 삭제 실패/)
  assert.match(git('ls-remote', '--heads', 'origin', 'refs/heads/release/v1.2.3'), /refs\/heads\/release/)
}))
test('post-delete lookup failure cannot claim confirmed absence', () => fixture(({ dir, invoke }) => {
  const bin = path.join(dir, 'bin'); mkdirSync(bin)
  const gitBin = run('bash', ['-c', 'command -v git']).stdout.trim()
  const marker = path.join(dir, 'deleted')
  writeFileSync(path.join(bin, 'git'), `#!/bin/sh\nif [ "$1" = ls-remote ] && [ -f '${marker}' ]; then exit 128; fi\nif [ "$1" = push ]; then '${gitBin}' "$@" || exit $?; touch '${marker}'; exit 0; fi\nexec '${gitBin}' "$@"\n`, { mode: 0o755 })
  const result = invoke({ ...process.env, PATH: bin + ':' + process.env.PATH })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /원격 브랜치 정리 미확인/)
  assert.doesNotMatch(result.stdout, /원격 브랜치 없음 확인/)
}))
test('invalid version cannot select unrelated refs', () => fixture(({ repo, git }) => {
  const result = run('bash', [helper, '1.2.3;bad'], { cwd: repo })
  assert.equal(result.status, 2)
  git('show-ref', '--verify', 'refs/heads/release/v1.2.3')
}))
test('pushed tracking branches absent from develop preserve both local and remote commits', () => fixture(({ repo, git, invoke }) => {
  for (const branch of ['release/v1.2.3', 'sync/backmerge-v1.2.3']) {
    git('checkout', '-q', branch)
    writeFileSync(path.join(repo, 'keep'), branch)
    git('commit', '-qam', 'pushed but unmerged')
    git('push', '-qu', 'origin', branch)
  }
  git('checkout', '-q', 'develop')
  const before = git('ls-remote', '--heads', 'origin', 'refs/heads/release/v1.2.3')
  const result = invoke()
  assert.notEqual(result.status, 0)
  for (const branch of ['release/v1.2.3', 'sync/backmerge-v1.2.3']) {
    git('show-ref', '--verify', `refs/heads/${branch}`)
  }
  assert.equal(git('ls-remote', '--heads', 'origin', 'refs/heads/release/v1.2.3'), before)
}))
test('remote-only unmerged commit preserves remote ref when local release is merged', () => fixture(({ repo, git, invoke }) => {
  git('checkout', '-q', 'release/v1.2.3')
  writeFileSync(path.join(repo, 'keep'), 'remote-only unmerged')
  git('commit', '-qam', 'remote unmerged'); git('push', '-q', 'origin', 'release/v1.2.3')
  git('reset', '--hard', 'develop'); git('checkout', '-q', 'develop')
  const before = git('ls-remote', '--heads', 'origin', 'refs/heads/release/v1.2.3')
  const result = invoke()
  assert.notEqual(result.status, 0)
  assert.equal(git('ls-remote', '--heads', 'origin', 'refs/heads/release/v1.2.3'), before)
}))
test('ancestry query failure preserves refs instead of reporting merged', () => fixture(({ dir, git, invoke }) => {
  const bin = path.join(dir, 'bin'); mkdirSync(bin)
  const gitBin = run('bash', ['-c', 'command -v git']).stdout.trim()
  writeFileSync(path.join(bin, 'git'), `#!/bin/sh\nif [ "$1" = merge-base ]; then exit 128; fi\nexec '${gitBin}' "$@"\n`, { mode: 0o755 })
  const result = invoke({ ...process.env, PATH: bin + ':' + process.env.PATH })
  assert.notEqual(result.status, 0)
  git('show-ref', '--verify', 'refs/heads/release/v1.2.3')
  assert.match(git('ls-remote', '--heads', 'origin', 'refs/heads/release/v1.2.3'), /refs\/heads\/release/)
}))
test('changed remote tip after inspection rejects deletion and preserves the newer commit', () => fixture(({ dir, repo, remote, git, invoke }) => {
  git('checkout', '-qb', 'other')
  writeFileSync(path.join(repo, 'keep'), 'new remote tip'); git('commit', '-qam', 'concurrent push')
  const oid = git('rev-parse', 'HEAD').trim()
  git('push', '-q', 'origin', 'other'); git('checkout', '-q', 'develop')
  const bin = path.join(dir, 'bin'); mkdirSync(bin)
  const gitBin = run('bash', ['-c', 'command -v git']).stdout.trim()
  writeFileSync(path.join(bin, 'git'), `#!/bin/sh\nif [ "$1" = push ]; then '${gitBin}' --git-dir='${remote}' update-ref refs/heads/release/v1.2.3 ${oid} || exit $?; fi\nexec '${gitBin}' "$@"\n`, { mode: 0o755 })
  const result = invoke({ ...process.env, PATH: bin + ':' + process.env.PATH })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /원격 브랜치 삭제 실패/)
  assert.ok(git('ls-remote', '--heads', 'origin', 'refs/heads/release/v1.2.3').startsWith(oid))
}))
test('local tip and tracking upstream changing after ancestry inspection cannot delete unmerged commits', () => fixture(({ dir, repo, git, invoke }) => {
  git('push', '-qu', 'origin', 'release/v1.2.3')
  git('checkout', '-qb', 'other')
  writeFileSync(path.join(repo, 'keep'), 'new local tip'); git('commit', '-qam', 'concurrent local move')
  const oid = git('rev-parse', 'HEAD').trim(); git('checkout', '-q', 'develop')
  const bin = path.join(dir, 'bin'); mkdirSync(bin)
  const gitBin = run('bash', ['-c', 'command -v git']).stdout.trim()
  writeFileSync(path.join(bin, 'git'), `#!/bin/sh\nif [ "$1" = merge-base ] && [ "$3" = refs/heads/release/v1.2.3 ]; then\n '${gitBin}' "$@" || exit $?\n '${gitBin}' update-ref refs/heads/release/v1.2.3 ${oid} || exit $?\n '${gitBin}' update-ref refs/remotes/origin/release/v1.2.3 ${oid} || exit $?\n exit 0\nfi\nexec '${gitBin}' "$@"\n`, { mode: 0o755 })
  const result = invoke({ ...process.env, PATH: bin + ':' + process.env.PATH })
  assert.notEqual(result.status, 0)
  assert.equal(git('rev-parse', 'release/v1.2.3').trim(), oid)
  assert.equal(git('config', '--get', 'branch.release/v1.2.3.remote').trim(), 'origin')
  assert.equal(git('config', '--get', 'branch.release/v1.2.3.merge').trim(), 'refs/heads/release/v1.2.3')
}))
test('wrong checkout rejects cleanup before any branch deletion', () => fixture(({ git, invoke }) => {
  git('checkout', '-qb', 'unrelated')
  const result = invoke()
  assert.notEqual(result.status, 0)
  git('show-ref', '--verify', 'refs/heads/release/v1.2.3')
  git('show-ref', '--verify', 'refs/heads/sync/backmerge-v1.2.3')
  assert.match(git('ls-remote', '--heads', 'origin', 'refs/heads/release/v1.2.3'), /refs\/heads\/release/)
}))

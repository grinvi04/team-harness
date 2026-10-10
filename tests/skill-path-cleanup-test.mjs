import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const plugin = path.join(root, 'plugins/harness-guard')
const resolver = path.join(plugin, 'scripts/resolve-skill-root.mjs')
const env = { ...process.env }
delete env.CLAUDE_PLUGIN_ROOT
delete env.HARNESS_PLUGIN_ROOT
const run = (bin, args, options = {}) => spawnSync(bin, args, { encoding: 'utf8', env, ...options })

test('loaded common and Codex skills resolve without platform root env or HOME fallback', () => {
  for (const rel of ['skills/pr-create/SKILL.md', 'codex/skills/pr-create/SKILL.md']) {
    const result = run(process.execPath, [resolver, path.join(plugin, rel)])
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), plugin)
  }
})

test('missing, relative, unrelated skill and conflicting Claude/root paths fail before execution', () => {
  for (const arg of [undefined, 'skills/pr-create/SKILL.md', path.join(root, 'AGENTS.md')]) {
    const result = run(process.execPath, [resolver, ...(arg ? [arg] : [])])
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, '')
  }
  for (const key of ['CLAUDE_PLUGIN_ROOT', 'HARNESS_PLUGIN_ROOT']) {
    const result = run(process.execPath, [resolver, path.join(plugin, 'skills/pr-create/SKILL.md')], { env: { ...env, [key]: root } })
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, '')
  }
  const valid = run(process.execPath, [resolver, path.join(plugin, 'skills/pr-create/SKILL.md')], { env: { ...env, CLAUDE_PLUGIN_ROOT: plugin } })
  assert.equal(valid.status, 0, valid.stderr)
})

test('each documented tool-call initialization rejects a stale root before the target script', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'harness-path-'))
  try {
    const old = path.join(dir, 'old plugin/scripts')
    mkdirSync(old, { recursive: true })
    copyFileSync(resolver, path.join(old, 'resolve-skill-root.mjs'))
    const block = readFileSync(path.join(plugin, 'skills/runtime-path.md'), 'utf8').split('```bash\n')[1].split('```')[0]
    const marker = path.join(dir, 'target-ran')
    const invoke = (candidate) => run('bash', ['-c', block.replace("'<현재 읽은 SKILL.md의 절대 경로>'", JSON.stringify(path.join(plugin, 'codex/skills/pr-create/SKILL.md'))).replace("'<그 SKILL.md가 속한 플러그인의 절대 경로>'", JSON.stringify(candidate)) + '\nprintf reached > "$MARKER"'], { env: { ...env, HOME: dir, MARKER: marker } })
    const rejected = invoke(path.dirname(old))
    assert.notEqual(rejected.status, 0)
    assert.throws(() => readFileSync(marker))
    const accepted = invoke(plugin)
    assert.equal(accepted.status, 0, accepted.stderr)
    assert.equal(readFileSync(marker, 'utf8'), 'reached')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('skill readers remove checkout fallbacks and fixed deletion success claims', () => {
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) scan(file)
      else if (entry.name.endsWith('.md')) assert.ok(!readFileSync(file, 'utf8').includes('CLAUDE_PLUGIN_ROOT:-$HOME/team-harness'))
    }
  }
  scan(path.join(plugin, 'skills'))
  const merge = readFileSync(path.join(plugin, 'skills/feature-merge/SKILL.md'), 'utf8')
  assert.ok(!merge.includes('2>/dev/null || true'))
  assert.ok(!merge.includes('로컬·원격 삭제 완료'))
})

test('cleanup reports actual Git refusal, successful deletion and remote lookup failure in isolated repos', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'harness-cleanup-'))
  try {
    const remote = path.join(dir, 'remote.git'), repo = path.join(dir, 'repo')
    const git = (...args) => {
      const result = run('git', args, { cwd: repo })
      assert.equal(result.status, 0, result.stderr)
      return result.stdout
    }
    assert.equal(run('git', ['init', '--bare', '-q', remote]).status, 0)
    mkdirSync(repo)
    git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid')
    writeFileSync(path.join(repo, 'keep'), 'keep')
    git('add', 'keep'); git('commit', '-qm', 'fixture'); git('branch', '-M', 'develop')
    git('remote', 'add', 'origin', remote); git('push', '-qu', 'origin', 'develop')
    git('branch', 'fix/fixture'); git('worktree', 'add', '-q', path.join(dir, 'other'), 'fix/fixture')
    const source = readFileSync(path.join(plugin, 'scripts/pr-merge.sh'), 'utf8')
    const cleanup = source.slice(source.indexOf('# PR 병합과 정리 결과는 별도다.'))
    const invoke = () => run('bash', ['-c', 'set -euo pipefail\nmerge_cleanup_checkout() { [ "$3" = "$1" ] && printf "%s" "$2"; return 0; }\n' + cleanup], { cwd: repo, env: { ...env, HBRANCH: 'fix/fixture', PR_BASE: 'develop' } })
    let result = invoke()
    assert.match(result.stderr, /로컬 브랜치 정리 실패/)
    assert.doesNotMatch(result.stdout, /로컬 브랜치 삭제 확인/)
    git('show-ref', '--verify', 'refs/heads/fix/fixture')
    assert.match(result.stdout, /원격 브랜치 삭제 확인/)
    git('worktree', 'remove', path.join(dir, 'other'))
    result = invoke()
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /로컬 브랜치 삭제 확인/)
    assert.notEqual(run('git', ['show-ref', '--verify', 'refs/heads/fix/fixture'], { cwd: repo }).status, 0)
    git('remote', 'set-url', 'origin', path.join(dir, 'missing.git'))
    result = invoke()
    assert.match(result.stderr, /원격 브랜치 정리 미확인/)
    assert.doesNotMatch(result.stdout, /원격 브랜치 삭제 확인/)
    result = run('bash', ['-c', 'set -euo pipefail\n' + cleanup], { cwd: dir, env: { ...env, HBRANCH: 'fix/fixture', PR_BASE: 'develop' } })
    assert.match(result.stderr, /로컬 브랜치 정리 미확인/)
    assert.doesNotMatch(result.stdout, /로컬 브랜치 없음 확인/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

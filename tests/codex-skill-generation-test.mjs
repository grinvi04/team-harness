// Deterministic source/reader integrity only; real runtime behavior is a separate gate.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const script = path.join(root, 'scripts/generate-codex-skills.mjs')
const plugin = 'plugins/harness-guard'
const shared = `${plugin}/skills`
const wrappers = `${plugin}/codex/skills`
const runtime = `${plugin}/codex/native-runtime.md`
const run = (directory, mode = '--check') => spawnSync(process.execPath, [script, mode, '--root', directory], { encoding: 'utf8' })
function put(directory, relative, content) {
  const file = path.join(directory, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}
function tree(directory, relative = '') {
  const result = {}
  for (const name of fs.readdirSync(path.join(directory, relative)).sort()) {
    const file = path.join(directory, relative, name), entry = path.join(relative, name), info = fs.lstatSync(file)
    if (info.isSymbolicLink()) result[entry] = `link:${fs.readlinkSync(file)}`
    else if (info.isDirectory()) { result[entry] = 'directory'; Object.assign(result, tree(directory, entry)) }
    else result[entry] = fs.readFileSync(file, 'utf8')
  }
  return result
}
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'codex-generation-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  put(directory, `${shared}/alpha/SKILL.md`, '---\nname: alpha\ndescription: Alpha fixture description\nargument-hint: <value>\n---\n\n# Shared alpha\n')
  put(directory, `${shared}/beta/SKILL.md`, '---\nname: beta\ndescription: Beta fixture description\n---\n\n# Shared beta\n')
  put(directory, runtime, '# Native runtime\n\n## 공통 실행\n\nCommon fixture authority.\n\n## alpha\n\nAlpha fixture authority.\n\n## beta\n\nBeta fixture authority.\n')
  return directory
}
function ok(result) { assert.equal(result.status, 0, result.stderr) }
function reject(result) { assert.equal(result.status, 1, result.stderr) }

test('all published wrappers select common and only their own native task section', () => {
  const names = fs.readdirSync(path.join(root, shared)).filter(name => fs.existsSync(path.join(root, shared, name, 'SKILL.md'))).sort()
  assert.equal(names.length, 17)
  for (const name of names) {
    const text = fs.readFileSync(path.join(root, wrappers, name, 'SKILL.md'), 'utf8')
    assert.ok(text.includes(`../../../skills/${name}/SKILL.md`), name)
    const sections = [...text.matchAll(/native-runtime\.md#([^)]*)/g)].map(match => match[1])
    assert.deepEqual(sections, ['공통-실행', name], name)
    assert.doesNotMatch(text, /native-runtime\.md.*끝까지/)
    assert.match(text, /## Codex 실행/)
  }
})

test('repository wrappers are current generated output with preserved shared metadata', () => {
  ok(run(root))
  for (const name of fs.readdirSync(path.join(root, wrappers))) {
    const original = fs.readFileSync(path.join(root, shared, name, 'SKILL.md'), 'utf8')
    const wrapper = fs.readFileSync(path.join(root, wrappers, name, 'SKILL.md'), 'utf8')
    for (const key of ['name', 'description']) assert.equal(wrapper.match(new RegExp(`^${key}: (.+)$`, 'm'))?.[1], original.match(new RegExp(`^${key}: (.+)$`, 'm'))?.[1])
    assert.ok(wrapper.split('\n').length <= 199)
  }
})

test('--check never creates outputs or repairs drift; --write is byte and mtime idempotent', t => {
  const directory = fixture(t), before = tree(directory)
  reject(run(directory))
  assert.deepEqual(tree(directory), before)
  ok(run(directory, '--write'))
  const generated = tree(directory)
  const file = path.join(directory, wrappers, 'alpha/SKILL.md')
  const modified = fs.statSync(file).mtimeMs
  ok(run(directory, '--write'))
  assert.deepEqual(tree(directory), generated)
  assert.equal(fs.statSync(file).mtimeMs, modified)
  fs.appendFileSync(file, '\nmanual drift\n')
  const drift = tree(directory)
  reject(run(directory))
  assert.deepEqual(tree(directory), drift)
  ok(run(directory, '--write'))
  assert.deepEqual(tree(directory), generated)
})

test('shared description drift is detected and regenerated from source', t => {
  const directory = fixture(t)
  ok(run(directory, '--write'))
  const file = path.join(directory, shared, 'alpha/SKILL.md')
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Alpha fixture description', 'Changed source description'))
  const before = tree(directory)
  reject(run(directory))
  assert.deepEqual(tree(directory), before)
  ok(run(directory, '--write'))
  assert.match(fs.readFileSync(path.join(directory, wrappers, 'alpha/SKILL.md'), 'utf8'), /description: Changed source description/)
})

for (const damage of ['mismatched name', 'path name', 'duplicate name', 'missing description', 'missing task section', 'missing common section', 'duplicate task section', 'source symlink', 'output symlink', 'output hardlink']) {
  test(`invalid source refuses all writes: ${damage}`, t => {
    const directory = fixture(t)
    ok(run(directory, '--write'))
    const file = path.join(directory, shared, 'alpha/SKILL.md')
    const text = fs.readFileSync(file, 'utf8')
    if (damage === 'mismatched name') fs.writeFileSync(file, text.replace('name: alpha', 'name: other'))
    else if (damage === 'path name') fs.writeFileSync(file, text.replace('name: alpha', 'name: ../escape'))
    else if (damage === 'duplicate name') fs.writeFileSync(file, text.replace('name: alpha', 'name: alpha\nname: alpha'))
    else if (damage === 'missing description') fs.writeFileSync(file, text.replace('description: Alpha fixture description\n', ''))
    else if (damage.endsWith('section')) {
      const native = path.join(directory, runtime), body = fs.readFileSync(native, 'utf8')
      fs.writeFileSync(native, damage === 'missing task section' ? body.replace('## alpha\n', '## absent\n')
        : damage === 'missing common section' ? body.replace('## 공통 실행\n', '## absent\n') : body + '\n## alpha\n\nDuplicate.\n')
    } else {
      const target = damage === 'source symlink' ? file : path.join(directory, wrappers, 'alpha/SKILL.md')
      fs.unlinkSync(target)
      if (damage === 'output hardlink') fs.linkSync(path.join(directory, runtime), target)
      else fs.symlinkSync(path.join(directory, runtime), target)
    }
    const before = tree(directory)
    reject(run(directory, '--write'))
    assert.deepEqual(tree(directory), before)
  })
}

test('orphan generated wrappers are rejected rather than silently left active', t => {
  const directory = fixture(t)
  ok(run(directory, '--write'))
  put(directory, `${wrappers}/orphan/SKILL.md`, 'orphan skill\n')
  const before = tree(directory)
  reject(run(directory, '--write'))
  assert.deepEqual(tree(directory), before)
})

test('dangling output symlink refuses all writes and does not create its external target', t => {
  const directory = fixture(t)
  ok(run(directory, '--write'))
  const outside = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'codex-generation-outside-'))
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }))
  const target = path.join(outside, 'missing.md')
  const output = path.join(directory, wrappers, 'beta/SKILL.md')
  fs.unlinkSync(output)
  fs.symlinkSync(target, output)
  fs.appendFileSync(path.join(directory, wrappers, 'alpha/SKILL.md'), '\nstale\n')
  const before = tree(directory)
  const result = run(directory, '--write')
  assert.equal(fs.existsSync(target), false, 'generator created the external symlink target')
  reject(result)
  assert.match(result.stderr, /symlink path refused/)
  assert.deepEqual(tree(directory), before)
})

test('non-directory output parent is rejected before an earlier stale wrapper is rewritten', t => {
  const directory = fixture(t)
  ok(run(directory, '--write'))
  const source = path.join(directory, shared, 'alpha/SKILL.md')
  fs.writeFileSync(source, fs.readFileSync(source, 'utf8').replace('Alpha fixture description', 'Stale alpha'))
  const blocked = path.join(directory, wrappers, 'beta')
  fs.rmSync(blocked, { recursive: true })
  fs.writeFileSync(blocked, 'foreign parent file\n')
  const before = tree(directory)
  reject(run(directory, '--write'))
  assert.deepEqual(tree(directory), before)
})

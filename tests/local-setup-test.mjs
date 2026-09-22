import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, lstatSync, readlinkSync, symlinkSync, rmSync, copyFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const setup = path.join(repo, 'scripts/setup-local.mjs')
const template = path.join(repo, 'templates/local/spring-vue/check-harness.sh')
const sequence = ['backend check bootJar', 'npm ci', 'npm run type-check', 'npm run lint', 'npm run test:unit', 'npm run build', 'playwright install chromium', 'npm run test:e2e']
const commands = ['type-check', 'lint', 'test:unit', 'build', 'test:e2e']
function put(root, file, content, executable = false) {
  const target = path.join(root, file)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, content, { mode: executable ? 0o755 : 0o644 })
}
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'harness local '))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const project = path.join(root, 'project with spaces')
  put(project, 'backend/build.gradle', "plugins { id 'org.springframework.boot' version '4.1.1' }\n")
  put(project, 'backend/gradlew', '#!/bin/sh\nprintf "backend %s\\n" "$*" >> "$TRACE"\n[ "${FAIL_STEP:-}" != backend ]\n', true)
  put(project, 'frontend/package.json', JSON.stringify({ dependencies: { vue: '3.5.43' }, devDependencies: { '@playwright/test': '1.63.0' }, scripts: Object.fromEntries(commands.map(s => [s, 'project-owned-command'])) }))
  put(project, 'frontend/package-lock.json', '{}')
  put(project, 'AGENTS.md', 'Product-owned instructions\n')
  put(project, 'scripts/check-local.sh', 'Existing product-specific checks\n')
  put(project, 'backend/data/keep.db', 'user data')
  return { root, project }
}
function snapshot(root) {
  const result = {}
  function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const file = path.join(dir, name), stat = lstatSync(file), key = path.relative(root, file)
      if (stat.isSymbolicLink()) result[key] = `link:${readlinkSync(file)}`
      else if (stat.isDirectory()) { result[key] = 'directory'; walk(file) }
      else result[key] = readFileSync(file).toString('base64')
    }
  }
  walk(root)
  return result
}
function invoke(project, extra = [], cwd = tmpdir()) {
  return spawnSync(process.execPath, [setup, '--project', project, ...extra], { cwd, encoding: 'utf8' })
}
test('AC-1: preview lists exact destination and checks without writes', t => {
  const { project } = fixture(t), before = snapshot(project), r = invoke(project)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /scripts\/check-harness\.sh/)
  for (const command of ['check bootJar', 'type-check', 'test:unit', 'test:e2e']) assert.ok(r.stdout.includes(command), command)
  assert.deepEqual(snapshot(project), before)
})
test('AC-2: apply from unrelated cwd creates only the portable checker', t => {
  const { project } = fixture(t), before = snapshot(project), r = invoke(project, ['--apply'])
  assert.equal(r.status, 0, r.stderr)
  const after = snapshot(project)
  assert.ok(after['scripts/check-harness.sh'])
  delete after['scripts/check-harness.sh']
  assert.deepEqual(after, before)
  assert.equal(readFileSync(path.join(project, 'scripts/check-harness.sh'), 'utf8'), readFileSync(template, 'utf8'))
})
test('AC-3: invalid options and missing project are explicit errors', t => {
  const { project } = fixture(t), before = snapshot(project)
  for (const args of [['--unknown'], ['--apply', '--apply'], ['--project'], ['--project', project]]) {
    const r = invoke(project, args)
    assert.notEqual(r.status, 0, JSON.stringify(args)); assert.ok(r.stderr.trim())
  }
  const missing = invoke(path.join(project, 'missing'), ['--apply'])
  assert.notEqual(missing.status, 0); assert.ok(missing.stderr.trim())
  assert.deepEqual(snapshot(project), before)
})
test('AC-3: absent stack files or required scripts leave no changes', t => {
  for (const file of ['backend/gradlew', 'backend/build.gradle', 'frontend/package-lock.json']) {
    const { project } = fixture(t)
    rmSync(path.join(project, file)); const before = snapshot(project)
    const r = invoke(project, ['--apply'])
    assert.notEqual(r.status, 0, file); assert.ok(r.stderr.trim()); assert.deepEqual(snapshot(project), before)
  }
  for (const field of [...commands, 'vue', '@playwright/test', 'invalid-json']) {
    const { project } = fixture(t), file = path.join(project, 'frontend/package.json')
    const pkg = JSON.parse(readFileSync(file, 'utf8'))
    if (commands.includes(field)) delete pkg.scripts[field]
    else if (field === 'vue') delete pkg.dependencies.vue
    else delete pkg.devDependencies['@playwright/test']
    writeFileSync(file, field === 'invalid-json' ? '{' : JSON.stringify(pkg))
    const before = snapshot(project), r = invoke(project, ['--apply'])
    assert.notEqual(r.status, 0, field); assert.ok(r.stderr.trim()); assert.deepEqual(snapshot(project), before)
  }
})
test('AC-3: existing destinations and linked scripts directories are preserved', t => {
  for (const kind of ['file', 'directory', 'broken-link', 'linked-parent']) {
    const { root, project } = fixture(t), target = path.join(project, 'scripts/check-harness.sh')
    if (kind === 'file') writeFileSync(target, 'existing')
    if (kind === 'directory') mkdirSync(target)
    if (kind === 'broken-link') symlinkSync(path.join(root, 'absent'), target)
    if (kind === 'linked-parent') {
      rmSync(path.join(project, 'scripts'), { recursive: true })
      mkdirSync(path.join(root, 'outside')); symlinkSync(path.join(root, 'outside'), path.join(project, 'scripts'))
    }
    const before = snapshot(root), r = invoke(project, ['--apply'])
    assert.notEqual(r.status, 0, kind); assert.ok(r.stderr.trim()); assert.deepEqual(snapshot(root), before)
  }
})
test('AC-2/3: absent scripts directory is created and repeat apply preserves it', t => {
  const { project } = fixture(t)
  rmSync(path.join(project, 'scripts'), { recursive: true })
  assert.equal(invoke(project, ['--apply']).status, 0)
  assert.ok(existsSync(path.join(project, 'scripts/check-harness.sh')))
  const before = snapshot(project), r = invoke(project, ['--apply'])
  assert.notEqual(r.status, 0); assert.deepEqual(snapshot(project), before)
})
function runChecker(t, fail = '') {
  const { root, project } = fixture(t), trace = path.join(root, 'trace')
  copyFileSync(template, path.join(project, 'scripts/check-harness.sh'))
  put(root, 'bin/npm', '#!/bin/sh\nprintf "npm %s\\n" "$*" >> "$TRACE"\n[ "${FAIL_STEP:-}" != "$*" ]\n', true)
  put(root, 'bin/java', '#!/bin/sh\nexit 0\n', true)
  put(project, 'frontend/node_modules/.bin/playwright', '#!/bin/sh\nprintf "playwright %s\\n" "$*" >> "$TRACE"\n[ "${FAIL_STEP:-}" != playwright ]\n', true)
  writeFileSync(trace, '')
  const r = spawnSync('bash', [path.join(project, 'scripts/check-harness.sh')], { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${path.join(root, 'bin')}:${process.env.PATH}`, TRACE: trace, FAIL_STEP: fail } })
  return { r, trace: readFileSync(trace, 'utf8').trim().split('\n').filter(Boolean) }
}
test('AC-4: checker runs every declared stage in order from unrelated cwd', t => {
  const { r, trace } = runChecker(t)
  assert.equal(r.status, 0, r.stderr); assert.deepEqual(trace, sequence); assert.match(r.stdout, /PASS/)
})
test('AC-4: failures stop immediately without a success claim', t => {
  for (const [stage, count] of [['backend', 1], ['run build', 6], ['playwright', 7], ['run test:e2e', 8]]) {
    const { r, trace } = runChecker(t, stage)
    assert.notEqual(r.status, 0, stage); assert.deepEqual(trace, sequence.slice(0, count)); assert.doesNotMatch(r.stdout, /PASS/)
  }
})

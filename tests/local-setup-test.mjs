import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, lstatSync, readlinkSync, symlinkSync, rmSync, copyFileSync, existsSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const setup = path.join(repo, 'scripts/setup-local.mjs')
const originalResult = spawnSync('git', ['--no-replace-objects', 'show', '54657b3ef79ab36c3e0877664964356badd3510b:templates/local/spring-vue/check-harness.sh'], { cwd: repo, encoding: 'utf8' })
assert.equal(originalResult.status, 0, originalResult.stderr)
const originalChecker = originalResult.stdout
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
// These cases catch wrong stack branches, path routing, command omission and fail-open execution.
function selectedFixture(t, stack, custom = false) {
  const f = fixture(t)
  if (stack === 'spring' || stack === 'vue') {
    const selected = stack === 'spring' ? 'backend' : 'frontend'
    for (const name of readdirSync(path.join(f.project, selected))) {
      renameSync(path.join(f.project, selected, name), path.join(f.project, name))
    }
    rmSync(path.join(f.project, 'backend'), { recursive: true })
    rmSync(path.join(f.project, 'frontend'), { recursive: true })
  } else if (custom) {
    mkdirSync(path.join(f.project, 'apps'))
    renameSync(path.join(f.project, 'backend'), path.join(f.project, 'apps/api'))
    renameSync(path.join(f.project, 'frontend'), path.join(f.project, 'apps/web'))
  }
  return f
}
for (const stack of ['spring', 'vue']) {
  test(`cleanup: ${stack} preview and portable checker preserve selected command order and fail-fast`, t => {
    const { root, project } = selectedFixture(t, stack)
    const before = snapshot(project), preview = invoke(project, ['--stack', stack])
    assert.equal(preview.status, 0, preview.stderr)
    assert.deepEqual(snapshot(project), before)
    assert.equal(invoke(project, ['--stack', stack, '--apply']).status, 0)
    const after = snapshot(project); delete after['scripts/check-harness.sh']
    assert.deepEqual(after, before)
    const frontend = stack === 'vue' ? project : path.join(project, 'frontend')
    put(root, 'bin/npm', '#!/bin/sh\nprintf "npm %s\\n" "$*" >> "$TRACE"\n[ "${FAIL_STEP:-}" != "$*" ]\n', true)
    if (stack !== 'spring') put(frontend, 'node_modules/.bin/playwright', '#!/bin/sh\nprintf "playwright %s\\n" "$*" >> "$TRACE"\n[ "${FAIL_STEP:-}" != playwright ]\n', true)
    const expected = stack === 'spring' ? ['backend check bootJar'] : stack === 'vue' ? sequence.slice(1) : sequence
    const failures = stack === 'spring' ? ['backend'] : stack === 'vue' ? ['ci', 'run type-check', 'run lint', 'run test:unit', 'run build', 'playwright', 'run test:e2e'] : ['backend', 'ci', 'run build', 'playwright', 'run test:e2e']
    for (const failure of ['', ...failures]) {
      const trace = path.join(root, 'trace'); writeFileSync(trace, '')
      const result = spawnSync('bash', [path.join(project, 'scripts/check-harness.sh')], { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${path.join(root, 'bin')}:${process.env.PATH}`, TRACE: trace, FAIL_STEP: failure } })
      const index = expected.findIndex(command => command === (failure === 'backend' ? 'backend check bootJar' : failure === 'playwright' ? 'playwright install chromium' : `npm ${failure}`))
      assert.deepEqual(readFileSync(trace, 'utf8').trim().split('\n'), failure ? expected.slice(0, index + 1) : expected)
      if (failure) { assert.notEqual(result.status, 0, failure); assert.doesNotMatch(result.stdout, /PASS/) }
      else { assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /PASS/) }
    }
  })
}
test('cleanup: unsupported stacks, unsafe paths and linked source directories refuse without writes', t => {
  const { root, project } = fixture(t)
  const before = snapshot(root)
  for (const args of [
    ['--stack', 'python'], ['--stack', 'rails'], [], ['--stack', 'spring-boot+vue'], ['--stack', 'spring', '--backend-dir', 'backend'],
    ['--stack', 'vue', '--frontend-dir', 'frontend'], ['--stack', 'spring+vue', '--backend-dir', '../outside'],
    ['--stack', 'spring+vue', '--frontend-dir', '/tmp'], ['--stack', 'spring+vue', '--backend-dir', 'same', '--frontend-dir', 'same'],
  ]) {
    assert.notEqual(invoke(project, [...args, '--apply']).status, 0, JSON.stringify(args))
    assert.deepEqual(snapshot(root), before)
  }
  renameSync(path.join(project, 'backend'), path.join(root, 'outside'))
  symlinkSync(path.join(root, 'outside'), path.join(project, 'backend'))
  const linked = snapshot(root)
  assert.notEqual(invoke(project, ['--stack', 'spring+vue', '--apply']).status, 0)
  assert.deepEqual(snapshot(root), linked)
})

test('Spring Boot canonical choices and legacy aliases produce the same portable checks', t => {
  for (const [canonical, old] of [['spring-boot','spring']]) {
    const { project } = selectedFixture(t, old)
    const before = snapshot(project)
    const a = invoke(project, ['--stack',canonical]), b = invoke(project,['--stack',old])
    assert.equal(a.status,0,a.stderr); assert.equal(b.status,0,b.stderr)
    assert.equal(a.stdout,b.stdout); assert.deepEqual(snapshot(project),before)
  }
})

for (const stack of ['spring', 'vue']) {
  test(`single: ${stack} rejects invalid options, missing inputs and linked destination without writes`, t => {
    for (const extra of [['--unknown'], ['--apply', '--apply'], ['--project'], ['--project', 'duplicate']]) {
      const { project } = selectedFixture(t, stack), before = snapshot(project)
      assert.notEqual(invoke(project, ['--stack', stack, ...extra]).status, 0)
      assert.deepEqual(snapshot(project), before)
    }
    for (const file of stack === 'spring' ? ['gradlew', 'build.gradle'] : ['package.json', 'package-lock.json']) {
      const { project } = selectedFixture(t, stack)
      rmSync(path.join(project, file)); const before = snapshot(project)
      assert.notEqual(invoke(project, ['--stack', stack, '--apply']).status, 0)
      assert.deepEqual(snapshot(project), before)
    }
    for (const kind of ['file', 'directory', 'broken-link', 'linked-parent', 'linked-project', 'linked-source']) {
      const { root, project } = selectedFixture(t, stack), target = path.join(project, 'scripts/check-harness.sh')
      let input = project
      if (kind === 'file') writeFileSync(target, 'existing')
      if (kind === 'directory') mkdirSync(target)
      if (kind === 'broken-link') symlinkSync(path.join(root, 'absent'), target)
      if (kind === 'linked-parent') {
        rmSync(path.join(project, 'scripts'), { recursive: true }); mkdirSync(path.join(root, 'outside'))
        symlinkSync(path.join(root, 'outside'), path.join(project, 'scripts'))
      }
      if (kind === 'linked-project') { input = path.join(root, 'link'); symlinkSync(project, input) }
      if (kind === 'linked-source') {
        const name = stack === 'spring' ? 'gradlew' : 'package.json'
        renameSync(path.join(project, name), path.join(root, name)); symlinkSync(path.join(root, name), path.join(project, name))
      }
      const before = snapshot(root)
      assert.notEqual(invoke(input, ['--stack', stack, '--apply']).status, 0, kind)
      assert.deepEqual(snapshot(root), before)
    }
  })
}
test('single checker source bytes are preserved and repeat apply is rejected', t => {
  for (const stack of ['spring', 'vue']) {
    const { project } = selectedFixture(t, stack)
    rmSync(path.join(project, 'scripts'), { recursive: true })
    const key = stack === 'spring' ? 'spring-boot' : stack, role = stack === 'spring' ? 'backend' : 'frontend'
    const checks = readFileSync(path.join(repo, `templates/stacks/${key}/local-check.sh`), 'utf8').replace(`$PROJECT_ROOT/${role}`, '$PROJECT_ROOT') + '\n'
    const expected = readFileSync(path.join(repo, 'templates/local/check-harness.sh'), 'utf8').replace('{{CHECKS}}', checks)
    assert.equal(invoke(project, ['--stack', stack, '--apply']).status, 0)
    assert.equal(readFileSync(path.join(project, 'scripts/check-harness.sh'), 'utf8'), expected)
    const before = snapshot(project)
    assert.notEqual(invoke(project, ['--stack', stack, '--apply']).status, 0)
    assert.deepEqual(snapshot(project), before)
  }
})
test('Vue mandatory scripts and dependencies are never made optional', t => {
  for (const field of [...commands, 'vue', '@playwright/test', 'invalid-json']) {
    const { project } = selectedFixture(t, 'vue'), file = path.join(project, 'package.json')
    const pkg = JSON.parse(readFileSync(file, 'utf8'))
    if (commands.includes(field)) delete pkg.scripts[field]
    else if (field === 'vue') delete pkg.dependencies.vue
    else delete pkg.devDependencies['@playwright/test']
    writeFileSync(file, field === 'invalid-json' ? '{' : JSON.stringify(pkg))
    const before = snapshot(project)
    assert.notEqual(invoke(project, ['--stack', 'vue', '--apply']).status, 0, field)
    assert.deepEqual(snapshot(project), before)
  }
})
test('removed composition refuses a fully prepared old combined project without writes', t => {
  const { project } = fixture(t), before = snapshot(project)
  const result = invoke(project, ['--stack', 'spring-boot+vue', '--apply'])
  assert.notEqual(result.status, 0)
  assert.deepEqual(snapshot(project), before)
})

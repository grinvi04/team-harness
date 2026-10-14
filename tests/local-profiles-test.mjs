import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, lstatSync, readlinkSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const setup = path.join(repo, 'scripts/setup-local.mjs')
const contracts = {
  node: { required: ['lint', 'test', 'build'], optional: ['type-check', 'lint:design'], order: ['lint', 'type-check', 'lint:design', 'test', 'build'], dependencies: [] },
  nextjs: { required: ['lint', 'build'], optional: ['type-check', 'lint:design', 'test'], order: ['lint', 'type-check', 'lint:design', 'test', 'build'], dependencies: ['next', 'react'] },
  react: { required: ['lint', 'type-check', 'test:unit', 'build'], optional: [], order: ['lint', 'type-check', 'test:unit', 'build'], dependencies: ['react', 'vite'] },
  nuxt: { required: ['lint', 'type-check', 'test:unit', 'build'], optional: [], order: ['lint', 'type-check', 'test:unit', 'build'], dependencies: ['nuxt'] },
}
function put(root, name, data, executable = false) {
  const file = path.join(root, name); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, data, { mode: executable ? 0o755 : 0o644 })
}
function fixture(t, key, optional = true, e2e = false) {
  const root = mkdtempSync(path.join(tmpdir(), 'harness profiles ')); t.after(() => rmSync(root, { recursive: true, force: true }))
  const project = path.join(root, 'app'), contract = contracts[key]
  const names = [...contract.required, ...(optional ? contract.optional : []), ...(e2e ? ['test:e2e'] : [])]
  const pkg = { packageManager: 'npm@10.9.0', scripts: Object.fromEntries(names.map(name => [name, 'product-owned-command'])), dependencies: Object.fromEntries([...contract.dependencies, ...(e2e ? ['@playwright/test'] : [])].map(name => [name, '1.0.0'])) }
  put(project, 'package.json', JSON.stringify(pkg)); put(project, 'package-lock.json', '{}')
  put(project, 'AGENTS.md', 'product instructions'); put(project, '.env', 'fixture-only'); put(project, '.github/workflows/ci.yml', 'product CI')
  put(project, 'scripts/check-local.sh', 'product checks')
  return { root, project, pkg }
}
function snapshot(root) {
  const result = {}; function walk(dir) { for (const name of readdirSync(dir).sort()) {
    const file = path.join(dir, name), stat = lstatSync(file), key = path.relative(root, file)
    if (stat.isSymbolicLink()) result[key] = `link:${readlinkSync(file)}`
    else if (stat.isDirectory()) { result[key] = 'directory'; walk(file) }
    else result[key] = readFileSync(file).toString('base64')
  } }; walk(root); return result
}
function invoke(project, args) { return spawnSync(process.execPath, [setup, '--project', project, ...args], { cwd: tmpdir(), encoding: 'utf8' }) }
test('local selection is explicit and combinations never write', t => {
  const { project } = fixture(t, 'node'), before = snapshot(project)
  for (const args of [[], ['--stack', 'spring-boot+vue'], ['--stack', 'spring+vue'], ['--stack', 'node+react'], ['--stack', '1+7']]) {
    const result = invoke(project, [...args, '--apply']); assert.notEqual(result.status, 0, JSON.stringify(args)); assert.deepEqual(snapshot(project), before)
  }
})
test('list reports all supported and unsupported runners without a project', () => {
  const result = spawnSync(process.execPath, [setup, '--list'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  for (const key of [...Object.keys(contracts), 'spring-boot', 'vue', 'python', 'rails']) assert.ok(result.stdout.includes(key), key)
  assert.match(result.stdout, /unsupported/i); assert.match(result.stdout, /npm/); assert.match(result.stdout, /Gradle/)
})
for (const [key, contract] of Object.entries(contracts)) {
  test(`${key}: preview/apply share order, preserve product files, and every stage fails closed`, t => {
    for (const optional of [false, true]) for (const e2e of [false, true]) {
      const { root, project } = fixture(t, key, optional, e2e), before = snapshot(project), args = ['--stack', key, ...(e2e ? ['--e2e'] : [])]
      const preview = invoke(project, args); assert.equal(preview.status, 0, preview.stderr); assert.deepEqual(snapshot(project), before)
      const names = contract.order.filter(name => contract.required.includes(name) || optional)
      const expected = ['npm ci', ...names.map(name => name === 'test' && key === 'node' ? 'npm test' : `npm run ${name}`), ...(e2e ? ['playwright install chromium', 'npm run test:e2e'] : [])]
      for (const command of expected) assert.ok(preview.stdout.includes(command), command)
      if (!optional) for (const name of contract.optional) assert.ok(preview.stdout.includes(`NOT SELECTED: ${name}`), name)
      if (!e2e) assert.match(preview.stdout, /NOT SELECTED: E2E/)
      assert.equal(invoke(project, [...args, '--apply']).status, 0)
      const after = snapshot(project); delete after['scripts/check-harness.sh']; assert.deepEqual(after, before)
      put(root, 'bin/npm', '#!/bin/sh\nprintf "npm %s\\n" "$*" >> "$TRACE"\n[ "${FAIL_STEP:-}" != "npm $*" ]\n', true)
      put(project, 'node_modules/.bin/playwright', '#!/bin/sh\nprintf "playwright %s\\n" "$*" >> "$TRACE"\n[ "${FAIL_STEP:-}" != "playwright $*" ]\n', true)
      for (const failure of ['', ...expected]) {
        const trace = path.join(root, 'trace'); writeFileSync(trace, '')
        const result = spawnSync('bash', [path.join(project, 'scripts/check-harness.sh')], { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${path.join(root, 'bin')}:${process.env.PATH}`, TRACE: trace, FAIL_STEP: failure } })
        assert.deepEqual(readFileSync(trace, 'utf8').trim().split('\n'), failure ? expected.slice(0, expected.indexOf(failure) + 1) : expected)
        if (failure) { assert.notEqual(result.status, 0); assert.doesNotMatch(result.stdout, /PASS/) }
        else { assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /PASS/) }
      }
    }
  })
  test(`${key}: missing scripts/dependencies, unsupported runner, lock ambiguity and links refuse before writes`, t => {
    for (const mutation of [...contract.required.map(name => `script:${name}`), ...contract.dependencies.map(name => `dependency:${name}`), 'optional-empty', 'pnpm', 'yarn-lock', 'pnpm-lock', 'bun-lock', 'linked-lock', 'linked-ancestor', 'e2e-script', 'e2e-dependency']) {
      const { root, project, pkg } = fixture(t, key, true, true); let input = project
      if (mutation.startsWith('script:')) delete pkg.scripts[mutation.slice(7)]
      if (mutation.startsWith('dependency:')) delete pkg.dependencies[mutation.slice(11)]
      if (mutation === 'optional-empty') pkg.scripts[contract.optional[0] ?? contract.required[0]] = ' '
      if (mutation === 'pnpm') pkg.packageManager = 'pnpm@10.0.0'
      if (mutation === 'e2e-script') delete pkg.scripts['test:e2e']
      if (mutation === 'e2e-dependency') delete pkg.dependencies['@playwright/test']
      put(project, 'package.json', JSON.stringify(pkg))
      if (mutation === 'yarn-lock') put(project, 'yarn.lock', '')
      if (mutation === 'pnpm-lock') put(project, 'pnpm-lock.yaml', '')
      if (mutation === 'bun-lock') put(project, 'bun.lockb', '')
      if (mutation === 'linked-lock') { rmSync(path.join(project, 'package-lock.json')); put(root, 'outside-lock', '{}'); symlinkSync(path.join(root, 'outside-lock'), path.join(project, 'package-lock.json')) }
      if (mutation === 'linked-ancestor') { symlinkSync(root, path.join(root, 'link')); input = path.join(root, 'link', 'app') }
      const before = snapshot(root), result = invoke(input, ['--stack', key, '--e2e', '--apply'])
      assert.notEqual(result.status, 0, mutation); assert.deepEqual(snapshot(root), before)
    }
  })
}
test('Spring Boot refuses npm E2E selection before writes', t => {
  const { project } = fixture(t, 'node'), before = snapshot(project)
  assert.notEqual(invoke(project, ['--stack', 'spring', '--e2e', '--apply']).status, 0)
  assert.deepEqual(snapshot(project), before)
})

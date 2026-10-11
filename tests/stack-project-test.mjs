import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { selectStack } from '../scripts/stack-catalog.mjs';
import { inspectStackProjects } from '../plugins/harness-guard/scripts/stack-project.mjs';
const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/stack-profiles');
function snapshot(root, prefix = '') {
  return readdirSync(root).sort().flatMap(name => {
    const file = join(root, name), key = join(prefix, name), stat = lstatSync(file);
    if (stat.isSymbolicLink()) return [[key, 'symlink']];
    if (stat.isDirectory()) return snapshot(file, key);
    return [[key, createHash('sha256').update(readFileSync(file)).digest('hex')]];
  });
}
function fixture(t, name) {
  const root = mkdtempSync(join(tmpdir(), 'stack-project-'));
  cpSync(join(fixtures, name), root, { recursive: true });
  const before = snapshot(root);
  t.after(() => { assert.deepEqual(snapshot(root), before, 'inspection changed application files'); rmSync(root, { recursive: true, force: true }); });
  return root;
}
function codes(result) { return result.issues.map(i => i.code); }
test('multiple Python frameworks require explicit selection', t => {
  const root = fixture(t, 'python-multiple');
  assert.ok(codes(inspectStackProjects(root, selectStack('3'))).includes('AMBIGUOUS_FRAMEWORK'));
  const result = inspectStackProjects(root, selectStack('3', { framework: 'django', ui: 'templates' }));
  assert.equal(result.observed['project.django'].version, '5.2.7');
  assert.ok(!Object.hasOwn(result.observed, 'project.fastapi'));
  assert.deepEqual(result.issues, []);
});
test('unresolved is distinct from absent and never filled with a latest version', t => {
  const result = inspectStackProjects(fixture(t, 'python-unpinned'), selectStack('3', { framework: 'django', ui: 'templates' }));
  assert.equal(result.observed['project.django'].state, 'unresolved');
  assert.equal(result.observed['project.django'].version, null);
  assert.ok(codes(result).includes('UNRESOLVED_VERSION'));
});
test('PEP621 is parsed with tomllib, static dependencies only', t => {
  const result = inspectStackProjects(fixture(t, 'python-pep621'), selectStack('3', { framework: 'flask', ui: 'templates' }));
  assert.equal(result.observed['project.flask'].version, '3.1.2');
  assert.equal(result.observed['project.python'].version, '3.13.7');
  assert.deepEqual(result.issues, []);
});
test('missing TOML interpreter is unverified, never a pass', t => {
  const before = process.env.STACK_VERSION_PYTHON;
  process.env.STACK_VERSION_PYTHON = '/missing-stack-python';
  try {
    assert.ok(codes(inspectStackProjects(fixture(t, 'python-pep621'), selectStack('3', { framework: 'flask', ui: 'templates' }))).includes('PYPROJECT_PARSER_UNAVAILABLE'));
  } finally { if (before === undefined) delete process.env.STACK_VERSION_PYTHON; else process.env.STACK_VERSION_PYTHON = before; }
});
test('Hotwire importmap backed by gems does not need Node', t => {
  const result = inspectStackProjects(fixture(t, 'rails-hotwire'), selectStack('4', { ui: 'hotwire' }));
  assert.equal(result.observed['project.node'].state, 'absent');
  assert.equal(result.observed['project.turbo-rails'].version, '2.0.17');
  assert.equal(result.observed['project.stimulus-rails'].version, '1.3.4');
  assert.deepEqual(result.issues, []);
});
test('multiple Rails UI evidence requires explicit choice; selected scope only', t => {
  const root = fixture(t, 'rails-multiple');
  assert.ok(codes(inspectStackProjects(root, selectStack('4'))).includes('AMBIGUOUS_UI'));
  const selected = inspectStackProjects(root, selectStack('4', { ui: 'hotwire' }));
  assert.ok(!Object.hasOwn(selected.observed, 'project.inertia-rails'));
  assert.deepEqual(selected.issues, []);
});
test('Inertia requires Ruby and matching JavaScript adapters', t => {
  const result = inspectStackProjects(fixture(t, 'rails-inertia-missing'), selectStack('4', { ui: 'inertia-react' }));
  assert.ok(codes(result).includes('MISSING_COMPONENT'));
  assert.equal(result.observed['project.inertia-react'].state, 'absent');
});
test('external Hotwire importmap dependency without exact pin is unresolved', t => {
  const result = inspectStackProjects(fixture(t, 'rails-hotwire-external'), selectStack('4', { ui: 'hotwire' }));
  assert.equal(result.observed['project.turbo'].state, 'unresolved');
  assert.ok(codes(result).includes('UNRESOLVED_IMPORTMAP'));
});
test('npm lock v2/v3 supplies exact selected versions; root lock declaration mismatch refuses', t => {
  const root = fixture(t, 'react');
  const result = inspectStackProjects(root, selectStack('7'));
  assert.equal(result.observed['project.react'].version, '19.2.0');
  assert.equal(result.observed['project.vite'].version, '7.1.9');
  assert.equal(result.observed['project.node'].version, '22.22.3');
  assert.deepEqual(result.issues, []);
  const mismatch = inspectStackProjects(fixture(t, 'react-stale-lock'), selectStack('7'));
  assert.ok(codes(mismatch).includes('MANIFEST_LOCK_MISMATCH'));
});
test('unsupported lock or malformed JSON produces issues', t => {
  assert.ok(codes(inspectStackProjects(fixture(t, 'react-pnpm'), selectStack('7'))).includes('UNSUPPORTED_LOCK'));
  assert.ok(codes(inspectStackProjects(fixture(t, 'react-malformed'), selectStack('7'))).includes('INVALID_JSON'));
});
test('Spring Boot reads literal Gradle/plugin/toolchain/wrapper without running build scripts', t => {
  const root = fixture(t, 'spring-boot');
  const result = inspectStackProjects(root, selectStack('2'));
  assert.equal(result.observed['project.spring-boot'].version, '3.5.6');
  assert.equal(result.observed['project.java'].version, '21');
  assert.equal(result.observed['project.gradle'].version, '8.14.3');
  assert.deepEqual(result.issues, []);
  assert.ok(!existsSync(join(root, 'APP_EXECUTED')));
});
test('dynamic Gradle version stays unresolved', t => {
  const result = inspectStackProjects(fixture(t, 'spring-boot-dynamic'), selectStack('2'));
  assert.equal(result.observed['project.spring-boot'].state, 'unresolved');
  assert.ok(codes(result).includes('DYNAMIC_DECLARATION'));
});
test('symlink escape, symlink manifests and missing project are refused', t => {
  const root = mkdtempSync(join(tmpdir(), 'stack-escape-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'frontend')); symlinkSync(resolve(fixtures, 'react'), join(root, 'backend'));
  assert.ok(codes(inspectStackProjects(root, selectStack('1+7'))).includes('UNSAFE_PATH'));
  symlinkSync(join(fixtures, 'react/package.json'), join(root, 'frontend/package.json'));
  assert.ok(codes(inspectStackProjects(join(root, 'frontend'), selectStack('7'))).includes('UNSAFE_PATH'));
  assert.ok(codes(inspectStackProjects(join(root, 'missing'), selectStack('7'))).includes('MISSING_PROJECT'));
});
test('absent allowed inputs have explicit fingerprints for subsequent appearance checks', t => {
  const result = inspectStackProjects(fixture(t, 'react'), selectStack('7'));
  assert.ok(result.inputs.some(i => i.path === '.node-version' && i.sha256 === null));
  assert.ok(result.inputs.every(i => !i.path.endsWith('.env')));
});

test('runtime major aliases are unresolved rather than exact pins', t => {
  const root = mkdtempSync(join(tmpdir(), 'stack-major-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(fixtures, 'react'), root, { recursive: true }); writeFileSync(join(root, '.nvmrc'), '22\n');
  assert.equal(inspectStackProjects(root, selectStack('7')).observed['project.node'].state, 'unresolved');
});
test('Ruby runtime conflicts with lock runtime; absent Gemfile lock cannot be declared compatible', t => {
  const root = mkdtempSync(join(tmpdir(), 'stack-ruby-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(fixtures, 'rails-hotwire'), root, { recursive: true });
  writeFileSync(join(root, 'Gemfile.lock'), readFileSync(join(root, 'Gemfile.lock'), 'utf8') + '\nRUBY VERSION\n   ruby 3.3.9p0\n');
  assert.equal(inspectStackProjects(root, selectStack('4', { ui: 'hotwire' })).observed['project.ruby'].state, 'unresolved');
  rmSync(join(root, 'Gemfile.lock')); assert.ok(codes(inspectStackProjects(root, selectStack('4', { ui: 'hotwire' }))).includes('MISSING_LOCK'));
});
test('npm-backed Hotwire is supported without imposing importmap', t => {
  const root = mkdtempSync(join(tmpdir(), 'stack-hotwire-npm-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(fixtures, 'rails-hotwire'), root, { recursive: true }); rmSync(join(root, 'config/importmap.rb'));
  const deps = { '@hotwired/turbo-rails': '8.0.19', '@hotwired/stimulus': '3.2.2' };
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: deps }));
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': { dependencies: deps }, ...Object.fromEntries(Object.entries(deps).map(([k,v]) => ['node_modules/'+k, { version:v }])) } }));
  writeFileSync(join(root, '.nvmrc'), '22.22.3\n');
  const result = inspectStackProjects(root, selectStack('4', { ui:'hotwire' }));
  assert.equal(result.observed['project.turbo'].version, '8.0.19'); assert.deepEqual(result.issues, []);
});
test('Django HTMX reads a pinned npm browser package without requiring django-htmx', t => {
  const root = mkdtempSync(join(tmpdir(), 'stack-htmx-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(fixtures, 'python-multiple'), root, { recursive: true });
  const deps = { 'htmx.org':'2.0.7' };
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies:deps }));
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion:3, packages: { '':{ dependencies:deps }, 'node_modules/htmx.org':{ version:'2.0.7' } } }));
  const result = inspectStackProjects(root, selectStack('3', { framework:'django', ui:'htmx' }));
  assert.equal(result.observed['project.htmx'].version, '2.0.7'); assert.deepEqual(result.issues, []);
});

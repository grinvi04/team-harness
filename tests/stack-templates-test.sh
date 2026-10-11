#!/bin/bash
# Catalog and generated workflow regression checks; no network or YAML dependencies.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node --input-type=module - "$ROOT" <<'JS'
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = process.argv[2];
const fixture = mkdtempSync(join(tmpdir(), 'harness-stack-templates-'));
const { generatedBanner } = await import(pathToFileURL(join(root, 'scripts/generate-stack-templates.mjs')));
const sha256 = text => createHash('sha256').update(text).digest('hex');
// Fixed originals from 85338bdcb691727ebd098f4ee0ce5167faf36e24; independent of current HEAD.
const originalHashes = {
  "ci-gate-node.yml": "b210a18bad95b8a70c17e8ea973c84f48d1eed43158599cc978f08476f8786bb",
  "ci-gate-spring.yml": "28a131e8212fe05019acbdb2c4db338642fe10caa82bbab552ab336e20584338",
  "ci-gate-python.yml": "1034ca5ca162c4b7882caa8f6672b300501dc19180163af8481b78c0fdb7e373",
  "ci-gate-rails.yml": "8354e99eb5eea464d9e53132b311c24639f4164660cd47fab9aa7471f9db1309",
  "ci-gate-nextjs.yml": "b9931d6af0eb3931eba8335499d89f1bc9c210ab4c891d034f4b5ba5c5beecd1",
  "ci-gate-vue.yml": "3082096b3872f9fb47ec1d123d683725e3a3c86e0bacecc9ed8f337585628a8b"
};
const defaults = [
  ['node', ['typescript'], null],
  ['spring', ['java', 'flyway'], 'flyway'],
  ['python', ['python', 'alembic'], 'alembic'],
  ['rails', ['ruby'], null],
  ['nextjs', ['typescript', 'nextjs'], null],
  ['vue', ['typescript', 'vue'], null],
];
let passed = 0;
function pass(label) { console.log(`PASS: ${label}`); passed += 1; }
function cli(script, args, expected = 0) {
  const result = spawnSync(process.execPath, [join(fixture, 'scripts', script), ...args], { encoding: 'utf8' });
  assert.equal(result.status, expected, `${script} ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}
function readTemplate(name) { return readFileSync(join(fixture, 'templates/ci/stacks', name), 'utf8'); }
function snapshot() { return Object.fromEntries(Object.keys(originalHashes).map(name => [name, readTemplate(name)])); }
function protectedJobs(text) { return text.split('jobs:\n')[1].split('  secret-scan:\n')[0]; }
try {
  cpSync(join(root, 'templates/ci/stacks'), join(fixture, 'templates/ci/stacks'), { recursive: true });
  cpSync(join(root, 'templates/stacks.json'), join(fixture, 'templates/stacks.json'));
  cpSync(join(root, 'scripts/stack-catalog.mjs'), join(fixture, 'scripts/stack-catalog.mjs'));
  cpSync(join(root, 'scripts/generate-stack-templates.mjs'), join(fixture, 'scripts/generate-stack-templates.mjs'));
  cli('generate-stack-templates.mjs', ['--check']);
  assert.deepEqual(readdirSync(join(fixture, 'templates/ci/stacks')).filter(name => name.endsWith('.yml')).sort(), Object.keys(originalHashes).sort());
  const original = snapshot();
  for (const [name, hash] of Object.entries(originalHashes)) {
    assert.ok(original[name].startsWith(generatedBanner));
    assert.equal(sha256(original[name].slice(generatedBanner.length)), hash, `${name}: original bytes changed`);
  }
  pass('6 generated workflows preserve fixed original bytes except banner');
  cli('generate-stack-templates.mjs', ['--write']);
  assert.deepEqual(snapshot(), original);
  cli('generate-stack-templates.mjs', ['--write']);
  assert.deepEqual(snapshot(), original);
  pass('repeated generation is deterministic');
  const damaged = join(fixture, 'templates/ci/stacks/ci-gate-node.yml');
  writeFileSync(damaged, readFileSync(damaged, 'utf8').replace('npm test', 'npm test --if-present'));
  cli('generate-stack-templates.mjs', ['--check'], 1);
  assert.match(readFileSync(damaged, 'utf8'), /npm test --if-present/);
  cli('generate-stack-templates.mjs', ['--write']);
  cli('generate-stack-templates.mjs', ['--check']);
  assert.deepEqual(snapshot(), original);
  pass('generated job tamper is rejected without mutation and regeneration restores it');
  rmSync(damaged);
  cli('generate-stack-templates.mjs', ['--check'], 1);
  cli('generate-stack-templates.mjs', ['--write']);
  assert.deepEqual(snapshot(), original);
  pass('missing generated workflow is rejected and restored');
  const menu = cli('stack-catalog.mjs', ['--menu']);
  assert.equal(menu.split('\n').filter(line => /^  \d+\)/.test(line)).length, 6);
  for (let i = 0; i < defaults.length; i += 1) {
    const [key, rules, database] = defaults[i];
    const selected = JSON.parse(cli('stack-catalog.mjs', ['--select', String(i + 1)]));
    assert.equal(selected.template, `ci-gate-${key}.yml`);
    assert.equal(selected.mode, 'single');
    assert.deepEqual(selected.rules, rules);
    const checks = ['quality', 'secret-scan', 'test-guard', 'commitlint-trusted', 'integration-e2e', 'destructive-ddl'];
    if (database === 'flyway') checks.push('migration-safety');
    if (database === 'alembic') checks.push('alembic-heads');
    assert.deepEqual(selected.checks, checks);
    assert.equal(selected.database.tool, database);
  }
  pass('6 standalone selections retain rules/checks/DB without stored fullstack templates');
  for (const backend of [1, 2, 3, 4]) {
    for (const frontend of [1, 5, 6]) {
      const selection = `${backend}+${frontend}`;
      const selected = JSON.parse(cli('stack-catalog.mjs', ['--select', selection]));
      assert.equal(selected.mode, 'composed');
      assert.equal(selected.template, null);
      assert.deepEqual(selected.rules, [...new Set([...defaults[backend - 1][1], ...defaults[frontend - 1][1]])]);
      assert.deepEqual(selected.checks, ['backend', 'frontend', 'secret-scan', 'test-guard', 'commitlint-trusted', 'integration-e2e', 'destructive-ddl',
        ...(backend === 2 ? ['migration-safety'] : backend === 3 ? ['alembic-heads'] : [])]);
      const args = ['--compose', selection, '--backend-dir', 'apps/api', '--frontend-dir', 'apps/web'];
      const workflow = cli('generate-stack-templates.mjs', args);
      assert.equal(workflow, cli('generate-stack-templates.mjs', args));
      assert.equal((workflow.match(/^  backend:/gm) ?? []).length, 1);
      assert.equal((workflow.match(/^  frontend:/gm) ?? []).length, 1);
      assert.equal((workflow.match(/^  secret-scan:/gm) ?? []).length, 1);
      assert.doesNotMatch(workflow, /^  quality:/m);
      assert.match(workflow, /working-directory: apps\/api/);
      assert.match(workflow, /working-directory: apps\/web/);
      assert.match(workflow, /cache-dependency-path: apps\/web\/package-lock.json/);
      if (backend === 1) assert.match(workflow, /cache-dependency-path: apps\/api\/package-lock.json/);
      if (backend === 4) {
        assert.match(workflow, /uses: ruby\/setup-ruby@[\s\S]*?with:[\s\S]*?working-directory: apps\/api/);
      }
      for (const action of original[`ci-gate-${defaults[backend - 1][0]}.yml`].matchAll(/uses: ([^\n]+)/g)) {
        assert.ok(workflow.includes(`uses: ${action[1]}`), 'backend action SHA changed');
      }
    }
  }
  pass('12 backend/frontend compositions union rules and checks; separate paths, job names, caches and one secret scan');
  for (const selection of ['5+6', '2+3', '7', '1+5+6', '01+6', '2+', '../2+6']) {
    cli('stack-catalog.mjs', ['--select', selection], 1);
    cli('generate-stack-templates.mjs', ['--compose', selection], 1);
  }
  for (const directory of ['../outside', '/absolute', 'apps/../api', 'api\nrun: curl bad', '${{ secrets.TOKEN }}', 'api;id']) {
    cli('stack-catalog.mjs', ['--select', '2+6', '--backend-dir', directory], 1);
    cli('generate-stack-templates.mjs', ['--compose', '2+6', '--backend-dir', directory], 1);
  }
  cli('stack-catalog.mjs', ['--select', '2+6', '--backend-dir', 'same', '--frontend-dir', 'same'], 1);
  cli('stack-catalog.mjs', ['--select', '1', '--backend-dir', 'api'], 1);
  pass('invalid roles, duplicate or unsafe directories fail closed before output');
  for (const args of [[], ['--menu', 'extra'], ['--select'], ['--select', '0'], ['--select', '9'],
    ['--select', '01'], ['--select', '1x'], ['--select', '../1'], ['--select', '2', '--frontend', 'svelte'],
    ['--select', '2', '--frontend', ''], ['--select', '2', '--database', 'prisma'],
    ['--select', '2', '--frontend', 'vue', 'extra']]) cli('stack-catalog.mjs', args, 1);
  for (const args of [[], ['--bogus'], ['--write', 'extra']]) cli('generate-stack-templates.mjs', args, 1);
  pass('unknown, unsupported, malformed and extra CLI selections fail closed');
  const workflowPath = join(fixture, 'templates/ci/stacks/sources/common/workflow.yml');
  writeFileSync(workflowPath, readFileSync(workflowPath, 'utf8').replace('name: ci-gate', 'name: fixture-ci-gate'));
  cli('generate-stack-templates.mjs', ['--check'], 1);
  cli('generate-stack-templates.mjs', ['--write']);
  cli('generate-stack-templates.mjs', ['--check']);
  const workflowChanged = snapshot();
  for (const name of Object.keys(originalHashes)) {
    assert.equal(workflowChanged[name], original[name].replace('name: ci-gate', 'name: fixture-ci-gate'));
    assert.equal(protectedJobs(workflowChanged[name]), protectedJobs(original[name]));
  }
  pass('common workflow change reaches all 6 outputs and preserves every job byte');
  const secretPath = join(fixture, 'templates/ci/stacks/sources/common/secret-scan.yml');
  writeFileSync(secretPath, readFileSync(secretPath, 'utf8') + '          # common fixture marker\n');
  cli('generate-stack-templates.mjs', ['--check'], 1);
  cli('generate-stack-templates.mjs', ['--write']);
  cli('generate-stack-templates.mjs', ['--check']);
  const secretChanged = snapshot();
  for (const name of Object.keys(originalHashes)) {
    assert.equal(secretChanged[name], workflowChanged[name] + '          # common fixture marker\n');
    assert.equal(protectedJobs(secretChanged[name]), protectedJobs(original[name]));
  }
  pass('common secret-scan change reaches all 6 outputs without changing protected jobs');
  // A catalog source path cannot request an unrelated file during generation.
  const catalogPath = join(fixture, 'templates/stacks.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  catalog.stacks[0].sources.header = '../../../../AGENTS.md';
  writeFileSync(catalogPath, JSON.stringify(catalog));
  cli('generate-stack-templates.mjs', ['--write'], 1);
  assert.deepEqual(snapshot(), secretChanged);
  pass('invalid source paths are rejected before any generated file is written');
  console.log(`stack-templates: ${passed} passed`);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
JS

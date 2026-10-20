import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const parse = file => JSON.parse(execFileSync('ruby', ['-ryaml', '-rjson', '-e',
  'puts JSON.generate(YAML.safe_load(File.read(ARGV[0])))', file], { encoding: 'utf8' }));
const workflow = parse('.github/workflows/ci-gate.yml');
const steps = workflow.jobs.quality.steps;
test('dashboard authoring uses pinned actual tools before candidate dependency execution', () => {
  const pkg = JSON.parse(fs.readFileSync('dashboard/package.json', 'utf8'));
  const setup = steps.findIndex(step => step.uses?.startsWith('actions/setup-node@'));
  assert.ok(setup >= 0, 'setup-node is required');
  assert.match(steps[setup].uses, /^actions\/setup-node@[a-f0-9]{40}$/);
  assert.equal(steps[setup].with['node-version'], pkg.engines.node);
  assert.equal(fs.readFileSync('dashboard/.node-version', 'utf8').trim(), pkg.engines.node);
  const npm = steps.findIndex(step => step.run?.includes(`npm install --global npm@${pkg.engines.npm}`));
  const firstInstall = steps.findIndex(step => /npm ci/.test(step.run ?? ''));
  assert.ok(setup < npm && npm < firstInstall, 'pin tools before all npm ci');
  assert.ok(steps[npm].run.includes(`test "$(node --version)" = "v${pkg.engines.node}"`));
  assert.ok(steps[npm].run.includes(`test "$(npm --version)" = "${pkg.engines.npm}"`));
});
test('dashboard build verifies committed assets and keeps candidate and trusted execution separate', () => {
  const triggers = workflow.on ?? workflow.true;
  assert.ok(triggers.pull_request);
  assert.equal(triggers.pull_request_target, undefined);
  assert.deepEqual(workflow.permissions, { contents: 'read', 'pull-requests': 'read' });
  assert.equal(steps[0].with['persist-credentials'], false);
  const all = steps.map(step => step.run ?? '').join('\n');
  const required = ['npm ci --prefix dashboard', 'npm run lint --prefix dashboard',
    'npm run typecheck --prefix dashboard', 'npm run test:unit --prefix dashboard',
    'node --test tests/dashboard-test.mjs tests/dashboard-build-test.mjs tests/dashboard-workflow-test.mjs',
    'node scripts/build-dashboard.mjs --check'];
  let previous = -1;
  for (const command of required) { const index = all.indexOf(command); assert.ok(index > previous, command); previous = index; }
  assert.doesNotMatch(all, /build-dashboard\.mjs --write/);
  for (const step of steps.filter(step => /dashboard/.test(step.run ?? ''))) {
    assert.doesNotMatch(JSON.stringify(step), /secrets\.|github\.token|GH_TOKEN|GITHUB_TOKEN/);
  }
  const trusted = parse('.github/workflows/commitlint-trusted.yml');
  assert.doesNotMatch(JSON.stringify(trusted), /npm ci|build-dashboard|dashboard\/node_modules/);
});

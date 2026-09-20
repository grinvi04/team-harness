import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateEnvelope } from '../scripts/validate-envelope.mjs';

const task = JSON.parse(readFileSync(new URL('../examples/task.json', import.meta.url)));
const artifact = JSON.parse(readFileSync(new URL('../examples/artifact.json', import.meta.url)));

test('accepts documented examples without promoting schema validity to acceptance', () => {
  for (const value of [task, artifact]) {
    const before = structuredClone(value);
    assert.deepEqual(validateEnvelope(value), { valid: true, scope: 'schema-only', errors: [] });
    assert.deepEqual(value, before);
  }
});

for (const [kind, example] of [['task', task], ['artifact', artifact]]) {
  for (const field of Object.keys(example)) {
    test(`rejects ${kind} missing required ${field}`, () => {
      const value = structuredClone(example);
      delete value[field];
      const result = validateEnvelope(value);
      assert.equal(result.valid, false);
      assert.ok(result.errors.length > 0);
    });
  }
}

const invalidTasks = [
  ['unknown kind', value => { value.kind = 'acceptance'; }],
  ['unsupported schema', value => { value.schema_version = '99.0.0'; }],
  ['empty goal', value => { value.goal = ' \n\t'; }],
  ['unknown root field', value => { value.unexpected = true; }],
  ['unknown nested authority field', value => { value.authority.bypass = true; }],
  ['no acceptance', value => { value.acceptance = []; }],
  ['missing judgment method', value => { delete value.acceptance[0].method; }],
  ['negative cost', value => { value.budgets.max_cost_usd = -1; }],
  ['zero deadline', value => { value.budgets.wall_clock_seconds = 0; }],
  ['fractional retry count', value => { value.budgets.transient_retries = 0.5; }],
  ['negative ownership epoch', value => { value.ownership[0].epoch = -1; }],
  ['type coercion', value => { value.budgets.repair_loops = '2'; }],
  ['invalid calendar date', value => { value.source.observed_at = '2026-02-30T00:00:00Z'; }],
  ['missing timezone', value => { value.source.observed_at = '2026-09-05T00:00:00'; }],
  ['independent verifier unspecified', value => { value.verification.mode = 'independent'; }],
];
for (const [name, mutate] of invalidTasks) {
  test(`rejects task with ${name}`, () => {
    const value = structuredClone(task);
    mutate(value);
    const before = structuredClone(value);
    assert.equal(validateEnvelope(value).valid, false);
    assert.deepEqual(value, before);
  });
}

const invalidArtifacts = [
  ['incomplete PASS', value => { value.complete = false; }],
  ['execution state used as verdict', value => { value.verdict = 'BLOCKED'; }],
  ['PASS without evidence', value => { value.evidence = []; }],
  ['PASS without claims', value => { value.claims = []; }],
  ['PASS with failed evidence', value => { value.evidence[0].verdict = 'FAIL'; value.evidence[0].exit_code = 1; }],
  ['INCONCLUSIVE hiding failed evidence', value => { value.verdict = 'INCONCLUSIVE'; value.evidence[0].verdict = 'FAIL'; value.evidence[0].exit_code = 1; }],
  ['PASS with unchecked evidence', value => { value.evidence[0].verdict = 'INCONCLUSIVE'; }],
  ['PASS with failed claim', value => { value.claims[0].verdict = 'FAIL'; }],
  ['PASS evidence with nonzero command exit', value => { value.evidence[0].exit_code = 1; }],
  ['command evidence without exit result', value => { value.evidence[0].exit_code = null; }],
  ['negative consumed time', value => { value.budget_used.wall_clock_seconds = -1; }],
];
for (const [name, mutate] of invalidArtifacts) {
  test(`rejects artifact with ${name}`, () => {
    const value = structuredClone(artifact);
    mutate(value);
    assert.equal(validateEnvelope(value).valid, false);
  });
}

test('preserves a confirmed FAIL even when the artifact is incomplete', () => {
  const value = structuredClone(artifact);
  value.complete = false;
  value.verdict = value.claims[0].verdict = value.evidence[0].verdict = 'FAIL';
  value.evidence[0].exit_code = 1;
  assert.equal(validateEnvelope(value).valid, true);
});

test('accepts an incomplete unknown result without fabricated evidence', () => {
  const value = structuredClone(artifact);
  value.complete = false;
  value.verdict = 'INCONCLUSIVE';
  value.claims = [];
  value.evidence = [];
  assert.equal(validateEnvelope(value).valid, true);
});

test('accepts independently attributed observation evidence', () => {
  const value = structuredClone(artifact);
  value.evidence[0].method = { kind: 'observation', value: 'Inspect the declared output.' };
  value.evidence[0].exit_code = null;
  assert.equal(validateEnvelope(value).valid, true);
});

for (const value of [null, [], 'PASS', 1, true]) {
  test(`rejects non-envelope ${JSON.stringify(value)}`, () => {
    assert.equal(validateEnvelope(value).valid, false);
  });
}

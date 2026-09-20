import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateContract } from '../scripts/validate-contract.mjs';
import { validateEnvelope } from '../scripts/validate-envelope.mjs';

const taskExample = JSON.parse(readFileSync(new URL('../examples/task.json', import.meta.url)));
const artifactExample = JSON.parse(readFileSync(new URL('../examples/artifact.json', import.meta.url)));
const pair = () => [structuredClone(taskExample), structuredClone(artifactExample)];
const valid = { valid: true, scope: 'contract-only', errors: [] };

function independent(task, mode = 'independent') {
  task.roles.push({ role: 'verifier', instance_id: 'verifier-1' });
  task.verification.mode = mode;
  task.verification.verifier_instance_id = 'verifier-1';
}

function anotherCriterion(task, required = true) {
  task.acceptance.push({ ...structuredClone(task.acceptance[0]), id: 'AC-2', required, critical: false });
}

test('documented pair is consistent, stays unchanged, and is not an acceptance decision', () => {
  const [task, artifact] = pair();
  const before = structuredClone([task, artifact]);
  assert.deepEqual(validateContract(task, artifact), valid);
  assert.deepEqual([task, artifact], before);
});

const validPairs = [
  ['multiple functions on one instance', task => { task.roles.push({ role: 'architecture', instance_id: 'writer-1' }); }],
  ['explicit low-risk self verifier', task => { task.verification.verifier_instance_id = 'writer-1'; }],
  ['writer submission awaiting an independent verifier', task => { independent(task); }],
  ['writer submission with a separate external verifier', task => { independent(task, 'external'); }],
  ['high-risk work with a separate verifier', task => { task.risk.level = 'high'; independent(task); }],
  ['read-only verifier analyzing candidate paths', (task, artifact) => {
    independent(task);
    artifact.producer = { role: 'verifier', instance_id: 'verifier-1' };
    artifact.owned_scope = [];
  }],
  ['omitted optional criterion', task => { anotherCriterion(task, false); }],
  ['multiple supporting evidence records', (task, artifact) => {
    artifact.evidence.push({ ...structuredClone(artifact.evidence[0]), location: 'urn:fixture:second-observation' });
  }],
  ['partial confirmed failure', (task, artifact) => {
    artifact.complete = false;
    artifact.verdict = artifact.claims[0].verdict = artifact.evidence[0].verdict = 'FAIL';
    artifact.evidence[0].exit_code = 1;
    anotherCriterion(task);
  }],
  ['partial unknown result without fabricated evidence', (task, artifact) => {
    artifact.complete = false;
    artifact.verdict = 'INCONCLUSIVE';
    artifact.claims = [];
    artifact.evidence = [];
  }],
  ['unknown claim without evidence', (task, artifact) => {
    artifact.verdict = artifact.claims[0].verdict = 'INCONCLUSIVE';
    artifact.evidence = [];
  }],
  ['failure dominates passing evidence for the same criterion', (task, artifact) => {
    artifact.evidence.push({ ...structuredClone(artifact.evidence[0]), verdict: 'FAIL', exit_code: 1 });
    artifact.verdict = artifact.claims[0].verdict = 'FAIL';
  }],
  ['inconclusive evidence prevents a passing claim', (task, artifact) => {
    artifact.evidence.push({ ...structuredClone(artifact.evidence[0]), verdict: 'INCONCLUSIVE' });
    artifact.verdict = artifact.claims[0].verdict = 'INCONCLUSIVE';
  }],
  ['a later slice base distinct from the run start', (task, artifact) => { artifact.base_ref = 'snapshot:later-slice'; }],
  ['input re-observed at another time', (task, artifact) => { artifact.input_refs[0].observed_at = '2026-09-05T00:02:00Z'; }],
  ['source and oracle included as additional declared inputs', (task, artifact) => {
    artifact.input_refs.push(structuredClone(task.source), ...structuredClone(task.verification.oracle_refs));
  }],
  ['reordered input and ownership sets', (task, artifact) => {
    const ref = { ...task.input_refs[0], uri: 'urn:fixture:second-source' };
    task.input_refs.push(ref);
    artifact.input_refs.unshift(structuredClone(ref));
    task.ownership.push({ ...task.ownership[0], target: 'src/other.mjs' });
    artifact.owned_scope.unshift('src/other.mjs');
  }],
  ['ordinary IDs that match Object prototype names', (task, artifact) => {
    task.acceptance[0].id = artifact.claims[0].acceptance_id = artifact.evidence[0].acceptance_id = '__proto__';
    task.roles[0].instance_id = task.ownership[0].owner = artifact.producer.instance_id = 'constructor';
  }],
];

for (const [name, mutate] of validPairs) {
  test(`accepts ${name}`, () => {
    const [task, artifact] = pair();
    mutate(task, artifact);
    assert.deepEqual(validateContract(task, artifact), valid);
  });
}

const invalidPairs = [
  ['another task', (t, a) => { a.task_id = 'other-task'; }, '/artifact/task_id', 'task-mismatch'],
  ['another task revision', (t, a) => { a.task_revision = 'revision-2'; }, '/artifact/task_revision', 'task-mismatch'],
  ['another run', (t, a) => { a.run_id = 'old-run'; }, '/artifact/run_id', 'task-mismatch'],
  ['unknown producer instance', (t, a) => { a.producer.instance_id = 'unassigned'; }, '/artifact/producer', 'undeclared-producer'],
  ['unassigned producer function', (t, a) => { a.producer.role = 'verifier'; }, '/artifact/producer', 'undeclared-producer'],
  ['duplicate role assignment', t => { t.roles.push({ ...t.roles[0] }); }, '/task/roles/1', 'duplicate-role'],
  ['unknown owner', t => { t.ownership[0].owner = 'unassigned'; }, '/task/ownership/0/owner', 'undeclared-owner'],
  ['duplicate target with another owner', t => {
    t.roles.push({ role: 'implementation-worker', instance_id: 'writer-2' });
    t.ownership.push({ ...t.ownership[0], owner: 'writer-2' });
  }, '/task/ownership/1/target', 'ambiguous-target'],
  ['same target text under another kind', t => { t.ownership.push({ ...t.ownership[0], kind: 'resource' }); }, '/task/ownership/1/target', 'ambiguous-target'],
  ['omitted owned target', (t, a) => { a.owned_scope = []; }, '/artifact/owned_scope', 'owned-scope-mismatch'],
  ['undeclared owned target', (t, a) => { a.owned_scope = ['src/other.mjs']; }, '/artifact/owned_scope', 'owned-scope-mismatch'],
  ['another owner target', (t, a) => {
    t.roles.push({ role: 'implementation-worker', instance_id: 'writer-2' });
    t.ownership.push({ ...t.ownership[0], owner: 'writer-2', target: 'src/other.mjs' });
    a.owned_scope.push('src/other.mjs');
  }, '/artifact/owned_scope', 'owned-scope-mismatch'],
  ['old ownership epoch', (t, a) => { a.ownership_epoch = 0; }, '/artifact/ownership_epoch', 'ownership-epoch-mismatch'],
  ['mixed epochs cannot be hidden behind one artifact epoch', (t, a) => {
    t.ownership.push({ ...t.ownership[0], target: 'src/other.mjs', epoch: 2 });
    a.owned_scope.push('src/other.mjs');
  }, '/artifact/ownership_epoch', 'ownership-epoch-mismatch'],
  ['unknown independent verifier', t => { t.verification.mode = 'independent'; t.verification.verifier_instance_id = 'unassigned'; }, '/task/verification/verifier_instance_id', 'undeclared-verifier'],
  ['unknown explicit self verifier', t => { t.verification.verifier_instance_id = 'unassigned'; }, '/task/verification/verifier_instance_id', 'undeclared-verifier'],
  ['writer declaring itself independent', t => { t.verification.mode = 'independent'; t.verification.verifier_instance_id = 'writer-1'; }, '/task/verification/verifier_instance_id', 'verifier-is-owner'],
  ['writer declaring itself external', t => { t.verification.mode = 'external'; t.verification.verifier_instance_id = 'writer-1'; }, '/task/verification/verifier_instance_id', 'verifier-is-owner'],
  ['another candidate owner as verifier', t => {
    independent(t);
    t.ownership.push({ ...t.ownership[0], owner: 'verifier-1', target: 'test/oracle.mjs' });
  }, '/task/verification/verifier_instance_id', 'verifier-is-owner'],
  ['high risk with self verification', t => { t.risk.level = 'high'; }, '/task/verification/mode', 'independent-verification-required'],
  ['risk trigger with self verification', t => { t.risk.triggers = ['authorization']; }, '/task/verification/mode', 'independent-verification-required'],
  ['duplicate criterion ID', t => { t.acceptance.push({ ...structuredClone(t.acceptance[0]), description: 'Another meaning.' }); }, '/task/acceptance/1/id', 'duplicate-acceptance'],
  ['optional critical criterion', t => { t.acceptance[0].required = false; }, '/task/acceptance/0/required', 'critical-must-be-required'],
  ['unknown claim criterion', (t, a) => { a.claims[0].acceptance_id = 'AC-unknown'; }, '/artifact/claims/0/acceptance_id', 'undeclared-acceptance'],
  ['unknown evidence criterion', (t, a) => { a.evidence[0].acceptance_id = 'AC-unknown'; }, '/artifact/evidence/0/acceptance_id', 'undeclared-acceptance'],
  ['duplicate claim', (t, a) => { a.claims.push({ ...a.claims[0] }); }, '/artifact/claims/1/acceptance_id', 'duplicate-claim'],
  ['missing required PASS claim', t => { anotherCriterion(t); }, '/artifact/claims', 'missing-required-claim'],
  ['one claim borrowing another criterion evidence', (t, a) => {
    anotherCriterion(t);
    a.claims.push({ acceptance_id: 'AC-2', verdict: 'PASS' });
  }, '/artifact/claims/1/verdict', 'claim-evidence-mismatch'],
  ['evidence without a corresponding claim', (t, a) => {
    anotherCriterion(t, false);
    a.evidence.push({ ...structuredClone(a.evidence[0]), acceptance_id: 'AC-2' });
  }, '/artifact/evidence/1/acceptance_id', 'missing-claim'],
  ['evidence for another candidate', (t, a) => { a.evidence[0].candidate_ref = a.base_ref; }, '/artifact/evidence/0/candidate_ref', 'evidence-candidate-mismatch'],
  ['changed evidence command', (t, a) => { a.evidence[0].method.value = 'true'; }, '/artifact/evidence/0/method', 'evidence-method-mismatch'],
  ['changed evidence method kind', (t, a) => { a.evidence[0].method.kind = 'observation'; a.evidence[0].exit_code = null; }, '/artifact/evidence/0/method', 'evidence-method-mismatch'],
  ['passing claim hiding failed evidence inside a FAIL artifact', (t, a) => {
    a.verdict = a.evidence[0].verdict = 'FAIL'; a.evidence[0].exit_code = 1;
  }, '/artifact/claims/0/verdict', 'claim-evidence-mismatch'],
  ['inconclusive claim hiding failed evidence', (t, a) => {
    a.verdict = a.evidence[0].verdict = 'FAIL'; a.evidence[0].exit_code = 1; a.claims[0].verdict = 'INCONCLUSIVE';
  }, '/artifact/claims/0/verdict', 'claim-evidence-mismatch'],
  ['passing claim with inconclusive evidence', (t, a) => {
    a.verdict = a.evidence[0].verdict = 'INCONCLUSIVE';
  }, '/artifact/claims/0/verdict', 'claim-evidence-mismatch'],
  ['failed claim without evidence', (t, a) => { a.verdict = a.claims[0].verdict = 'FAIL'; a.evidence = []; }, '/artifact/claims/0/verdict', 'claim-evidence-mismatch'],
  ['stale declared input revision', (t, a) => { a.input_refs[0].revision = 'old'; }, '/artifact/input_refs/0', 'input-ref-mismatch'],
  ['missing required input', (t, a) => { a.input_refs = [structuredClone(t.source)]; }, '/artifact/input_refs', 'missing-input-ref'],
  ['undeclared extra input', (t, a) => { a.input_refs.push({ ...a.input_refs[0], uri: 'urn:undeclared' }); }, '/artifact/input_refs/1', 'input-ref-mismatch'],
  ['duplicate task input URI', t => { t.input_refs.push({ ...t.input_refs[0] }); }, '/task/input_refs/1', 'duplicate-input-ref'],
  ['duplicate artifact input URI', (t, a) => { a.input_refs.push({ ...a.input_refs[0], revision: 'other' }); }, '/artifact/input_refs/1', 'duplicate-input-ref'],
  ['duplicate oracle URI', t => { t.verification.oracle_refs.push({ ...t.verification.oracle_refs[0] }); }, '/task/verification/oracle_refs/1', 'duplicate-input-ref'],
  ['conflicting revisions across task manifests', t => { t.verification.oracle_refs.push({ ...t.input_refs[0], revision: 'other' }); }, '/task/verification/oracle_refs/1', 'input-ref-mismatch'],
];

for (const [name, mutate, path, rule] of invalidPairs) {
  test(`rejects ${name} even though both envelopes are structurally valid`, () => {
    const [task, artifact] = pair();
    mutate(task, artifact);
    assert.equal(validateEnvelope(task).valid, true, 'fixture must reach contract checks');
    assert.equal(validateEnvelope(artifact).valid, true, 'fixture must reach contract checks');
    const before = structuredClone([task, artifact]);
    const result = validateContract(task, artifact);
    assert.equal(result.valid, false);
    assert.equal(result.scope, 'contract-only');
    assert.ok(result.errors.some(error => error.path === path && error.rule === rule), JSON.stringify(result));
    assert.deepEqual([task, artifact], before);
  });
}

for (const [name, mutate] of [
  ['null task', values => { values[0] = null; }],
  ['null artifact', values => { values[1] = null; }],
  ['malformed nested input', values => { values[0].roles = [null]; }],
  ['missing field', values => { delete values[1].input_refs; }],
  ['unsupported version', values => { values[1].schema_version = '99.0.0'; }],
  ['swapped kinds', values => { values.reverse(); }],
]) {
  test(`rejects ${name} before dereferencing semantic fields`, () => {
    const values = pair();
    mutate(values);
    const result = validateContract(...values);
    assert.equal(result.valid, false);
    assert.equal(result.scope, 'contract-only');
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.every(error => /^\/(task|artifact)(\/|$)/.test(error.path)));
  });
}

test('semantic errors expose locations and rules but never submitted identifiers or commands', () => {
  const [task, artifact] = pair();
  artifact.task_id = 'private-marker-task';
  artifact.evidence[0].method.value = 'private-marker-command';
  const result = validateContract(task, artifact);
  assert.equal(result.valid, false);
  assert.ok(!JSON.stringify(result).includes('private-marker'));
  assert.ok(result.errors.every(error => Object.keys(error).sort().join(',') === 'path,rule'));
});

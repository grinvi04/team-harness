import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateAssignment } from '../scripts/validate-assignment.mjs';
import { validateContract } from '../scripts/validate-contract.mjs';

const taskExample = JSON.parse(readFileSync(new URL('../examples/task.json', import.meta.url)));
const artifactExample = JSON.parse(readFileSync(new URL('../examples/artifact.json', import.meta.url)));
const ref = (uri, revision = 'v1') => ({ uri, revision, observed_at: '2026-09-05T00:00:00Z' });
const success = { valid: true, scope: 'assignment-only', errors: [] };

function triple() {
  return [structuredClone(taskExample), {
    kind: 'assignment', schema_version: '0.1.0',
    source: ref('urn:fixture:assignment'), task_ref: ref('urn:fixture:task', 'revision-1'),
    task_id: 'fixture-label', task_revision: 'revision-1', run_id: 'example-run-1',
    producer: { role: 'implementation-worker', instance_id: 'writer-1' },
    attempt_id: 'example-attempt-1', ownership_epoch: 1, base_ref: 'snapshot:example-base-1',
    mode: 'write', candidate_ref: null, state: 'RUNNING',
    bindings: [{ instance_id: 'writer-1', agent_id: 'native-writer' }, { instance_id: 'integration-owner', agent_id: 'native-main' }],
    candidate_writers: ['writer-1'], writer_history_ref: ref('urn:fixture:writer-history'),
    integration_owner: 'integration-owner', consumers: ['integration-owner'],
    analysis_scope: [], scratch_paths: [],
    runtime_refs: { ownership: ref('urn:fixture:ownership'), permissions: ref('urn:fixture:permissions') },
    previous_attempt: null,
  }, structuredClone(artifactExample)];
}

function readOnly(t, s, a) {
  t.roles.push({ role: 'verifier', instance_id: 'verifier-1' });
  t.verification.mode = 'independent';
  t.verification.verifier_instance_id = 'verifier-1';
  a.producer = { role: 'verifier', instance_id: 'verifier-1' };
  a.owned_scope = [];
  s.producer = { ...a.producer };
  s.mode = 'read-only';
  s.candidate_ref = a.candidate_ref;
  s.analysis_scope = ['src/label.mjs'];
  s.bindings.push({ instance_id: 'verifier-1', agent_id: 'native-verifier' });
}

const good = [
  ['a writer result without calling it accepted', () => {}],
  ['read-only verification with no candidate ownership', readOnly],
  ['read-only epoch independent of another writer epoch', (t, s, a) => { readOnly(t, s, a); s.ownership_epoch = a.ownership_epoch = 8; }],
  ['a later base rather than the fixed run start', (t, s, a) => { s.base_ref = a.base_ref = 'snapshot:later-base'; }],
  ['multiple functions using the same instance binding', t => { t.roles.push({ role: 'architecture', instance_id: 'writer-1' }); }],
  ['additional analysis without treating it as a write', (t, s, a) => { s.analysis_scope = ['src/consumer.mjs']; a.actual_scope.push('src/consumer.mjs'); }],
  ['separate disposable scratch', (t, s) => { s.scratch_paths = ['/disposable/cache']; }],
  ['another registered next consumer', (t, s, a) => {
    s.consumers.push('human-1'); s.bindings.push({ instance_id: 'human-1', agent_id: 'human:fixture' });
    a.consumers.unshift({ instance_id: 'human-1', required_action: 'Review evidence.' });
  }],
  ['a historical writer no longer in Task roles', (t, s) => {
    s.candidate_writers.push('earlier-writer'); s.bindings.push({ instance_id: 'earlier-writer', agent_id: 'native-earlier' });
  }],
  ['an active verification-stage report', (t, s) => { s.state = 'VERIFYING'; }],
  ['a retry with a new attempt, increased epoch and stop reference', (t, s, a) => {
    s.previous_attempt = { attempt_id: 'earlier-attempt', ownership_epoch: 0, stop_ref: ref('urn:fixture:stop') };
  }],
  ['a partial failure whose evidence stays a failure', (t, s, a) => {
    a.complete = false; a.verdict = a.claims[0].verdict = a.evidence[0].verdict = 'FAIL'; a.evidence[0].exit_code = 1;
  }],
  ['an inconclusive partial without fabricated evidence', (t, s, a) => {
    a.complete = false; a.verdict = 'INCONCLUSIVE'; a.claims = []; a.evidence = [];
  }],
  ['zero epoch', (t, s, a) => { t.ownership[0].epoch = s.ownership_epoch = a.ownership_epoch = 0; }],
  ['the maximum safe epoch', (t, s, a) => { t.ownership[0].epoch = s.ownership_epoch = a.ownership_epoch = 9007199254740991; }],
  ['set reordering', (t, s) => { s.bindings.reverse(); }],
  ['source observation times without claiming actual freshness', (t, s) => { s.task_ref.observed_at = '2026-09-06T00:00:00Z'; }],
];
for (const [name, mutate] of good) {
  test(`accepts ${name}`, () => {
    const values = triple(); mutate(...values);
    assert.equal(validateContract(values[0], values[2]).valid, true);
    const before = structuredClone(values);
    assert.deepEqual(validateAssignment(...values), success);
    assert.deepEqual(values, before);
  });
}

const bad = [
  ['another assigned task', (t, s) => { s.task_id = 'other'; }, '/assignment/task_id', 'task-mismatch'],
  ['another assigned revision', (t, s) => { s.task_revision = 'old'; }, '/assignment/task_revision', 'task-mismatch'],
  ['another assigned run', (t, s) => { s.run_id = 'old'; }, '/assignment/run_id', 'task-mismatch'],
  ['Task ref pointing at another revision', (t, s) => { s.task_ref.revision = 'old'; }, '/assignment/task_ref/revision', 'task-mismatch'],
  ['producer role substitution', (t, s) => { s.producer.role = 'verifier'; }, '/artifact/producer', 'assignment-mismatch'],
  ['producer instance substitution', (t, s) => { s.producer.instance_id = 'integration-owner'; }, '/artifact/producer', 'assignment-mismatch'],
  ['a late previous attempt', (t, s) => { s.attempt_id = 'new-attempt'; }, '/artifact/attempt_id', 'assignment-mismatch'],
  ['a stale read-only epoch with no owned targets', (t, s, a) => { readOnly(t, s, a); s.ownership_epoch = 2; }, '/artifact/ownership_epoch', 'assignment-mismatch'],
  ['a stale base', (t, s) => { s.base_ref = 'snapshot:new-base'; }, '/artifact/base_ref', 'assignment-mismatch'],
  ['a different fixed read-only candidate', (t, s, a) => { readOnly(t, s, a); s.candidate_ref = 'snapshot:new-candidate'; }, '/artifact/candidate_ref', 'assignment-mismatch'],
  ['read-only assigned candidate ownership', (t, s, a) => { s.mode = 'read-only'; s.candidate_ref = a.candidate_ref; }, '/assignment/mode', 'read-only-owner'],
  ['a write assignment without a candidate target', (t, s, a) => { t.ownership = []; a.owned_scope = []; s.candidate_writers = []; }, '/assignment/mode', 'missing-write-owner'],
  ['duplicate instance bindings with distinct actual agents', (t, s) => { s.bindings.push({ instance_id: 'writer-1', agent_id: 'another' }); }, '/assignment/bindings/2', 'duplicate-instance'],
  ['one actual agent disguised as two instances', (t, s, a) => { readOnly(t, s, a); s.bindings[2].agent_id = 'native-writer'; }, '/assignment/bindings/2', 'duplicate-agent'],
  ['missing Task role binding', (t, s) => { s.bindings.shift(); }, '/assignment/bindings', 'missing-binding'],
  ['an unneeded binding', (t, s) => { s.bindings.push({ instance_id: 'unused', agent_id: 'native-unused' }); }, '/assignment/bindings/2', 'unused-binding'],
  ['an unbound historical writer', (t, s) => { s.candidate_writers.push('past-writer'); }, '/assignment/bindings', 'missing-binding'],
  ['an unbound integration owner', (t, s) => { s.integration_owner = 'missing'; }, '/assignment/bindings', 'missing-binding'],
  ['an unbound consumer', (t, s) => { s.consumers.push('missing'); }, '/assignment/bindings', 'missing-binding'],
  ['omitted current candidate writer', (t, s) => { s.candidate_writers = []; }, '/assignment/candidate_writers', 'missing-owner-history'],
  ['historical writer acting as independent verifier after ownership is removed', (t, s, a) => { readOnly(t, s, a); s.candidate_writers.push('verifier-1'); }, '/task/verification/verifier_instance_id', 'verifier-was-writer'],
  ['historical writer acting as external verifier', (t, s, a) => { readOnly(t, s, a); t.verification.mode = 'external'; s.candidate_writers.push('verifier-1'); }, '/task/verification/verifier_instance_id', 'verifier-was-writer'],
  ['reusing a previous attempt ID', (t, s) => { s.previous_attempt = { attempt_id: s.attempt_id, ownership_epoch: 0, stop_ref: ref('urn:fixture:stop') }; }, '/assignment/previous_attempt/attempt_id', 'attempt-not-advanced'],
  ['same epoch on retry', (t, s) => { s.previous_attempt = { attempt_id: 'old', ownership_epoch: 1, stop_ref: ref('urn:fixture:stop') }; }, '/assignment/previous_attempt/ownership_epoch', 'epoch-not-advanced'],
  ['decreased epoch on retry', (t, s) => { s.previous_attempt = { attempt_id: 'old', ownership_epoch: 2, stop_ref: ref('urn:fixture:stop') }; }, '/assignment/previous_attempt/ownership_epoch', 'epoch-not-advanced'],
  ['different declared consumers', (t, s, a) => { a.consumers[0].instance_id = 'writer-1'; }, '/artifact/consumers', 'consumer-mismatch'],
  ['duplicate artifact consumer ID despite distinct actions', (t, s, a) => { a.consumers.push({ instance_id: 'integration-owner', required_action: 'Another action.' }); }, '/artifact/consumers/1', 'duplicate-consumer'],
  ['scope outside both owned and declared analysis targets', (t, s, a) => { a.actual_scope.push('src/undeclared.mjs'); }, '/artifact/actual_scope', 'undeclared-scope'],
  ['scratch equal to a candidate path', (t, s) => { s.scratch_paths = ['src/label.mjs']; }, '/assignment/scratch_paths/0', 'scratch-overlap'],
  ['scratch equal to an analysis target', (t, s) => { s.analysis_scope = ['src/other.mjs']; s.scratch_paths = ['src/other.mjs']; }, '/assignment/scratch_paths/0', 'scratch-overlap'],
];
for (const [name, mutate, path, rule] of bad) {
  test(`rejects ${name}`, () => {
    const values = triple(); mutate(...values);
    assert.equal(validateContract(values[0], values[2]).valid, true, 'isolate new assignment checks');
    const before = structuredClone(values);
    const result = validateAssignment(...values);
    assert.equal(result?.valid, false);
    assert.equal(result.scope, 'assignment-only');
    assert(result.errors.some(e => e.path === path && e.rule === rule), JSON.stringify(result));
    assert.deepEqual(values, before);
  });
}

for (const state of ['DRAFT', 'READY', 'BLOCKED', 'ACCEPTED', 'FAILED', 'CANCELLED', 'SUPERSEDED']) {
  test(`rejects reuse in ${state} state without rewriting the artifact`, () => {
    const [t, s, a] = triple(); s.state = state;
    const before = structuredClone(a);
    const result = validateAssignment(t, s, a);
    assert.equal(result?.valid, false);
    assert(result.errors.some(e => e.path === '/assignment/state' && e.rule === 'inactive-assignment'));
    assert.deepEqual(a, before);
  });
}

for (const field of Object.keys(triple()[1])) {
  test(`rejects missing required assignment field ${field}`, () => {
    const [t, s, a] = triple(); delete s[field];
    const result = validateAssignment(t, s, a);
    assert.equal(result?.valid, false);
    assert(result.errors.some(e => e.path.startsWith('/assignment') && e.rule === 'required'));
  });
}

for (const [name, mutate] of [
  ['wrong kind', s => { s.kind = 'task'; }],
  ['unknown version', s => { s.schema_version = '0.2.0'; }],
  ['extra property', s => { s.unapproved = true; }],
  ['negative epoch', s => { s.ownership_epoch = -1; }],
  ['fractional epoch', s => { s.ownership_epoch = 0.5; }],
  ['unsafe epoch', s => { s.ownership_epoch = 9007199254740992; }],
  ['blank actual agent ID', s => { s.bindings[0].agent_id = ' '; }],
  ['empty bindings', s => { s.bindings = []; }],
  ['empty consumers', s => { s.consumers = []; }],
  ['duplicate candidate writers', s => { s.candidate_writers.push('writer-1'); }],
  ['duplicate consumers', s => { s.consumers.push('integration-owner'); }],
  ['duplicate analysis scopes', s => { s.analysis_scope = ['src/x', 'src/x']; }],
  ['missing permissions reference', s => { delete s.runtime_refs.permissions; }],
  ['malformed source URI', s => { s.source.uri = 'not a URI'; }],
  ['malformed observation time', s => { s.task_ref.observed_at = 'yesterday'; }],
  ['write mode with preinvented candidate', s => { s.candidate_ref = 'snapshot:pretend'; }],
  ['read-only mode without fixed candidate', s => { s.mode = 'read-only'; }],
  ['retry without stop evidence reference', s => { s.previous_attempt = { attempt_id: 'old', ownership_epoch: 0 }; }],
  ['unsafe previous epoch', s => { s.previous_attempt = { attempt_id: 'old', ownership_epoch: 9007199254740992, stop_ref: ref('urn:fixture:stop') }; }],
]) {
  test(`rejects assignment schema error: ${name}`, () => {
    const [t, s, a] = triple(); mutate(s);
    const result = validateAssignment(t, s, a);
    assert.equal(result?.valid, false);
    assert(result.errors.every(e => e.path.startsWith('/assignment')));
  });
}

for (const [index, value] of [[0, null], [1, null], [2, null], [1, []]]) {
  test(`rejects invalid input ${index}: ${JSON.stringify(value)} without throwing`, () => {
    const values = triple(); values[index] = value;
    const result = validateAssignment(...values);
    assert.equal(result?.valid, false);
    assert(result.errors.length > 0);
  });
}

test('preserves existing evidence consistency rejection', () => {
  const [t, s, a] = triple(); a.evidence[0].candidate_ref = 'snapshot:wrong';
  const result = validateAssignment(t, s, a);
  assert.equal(result?.valid, false);
  assert(result.errors.some(e => e.rule === 'evidence-candidate-mismatch'));
});

test('does not fetch claimed origins or execute evidence commands', () => {
  const [t, s, a] = triple();
  s.source.uri = 'https://example.invalid/do-not-fetch';
  t.acceptance[0].method.value = a.evidence[0].method.value = 'throw new Error("must not execute")';
  assert.deepEqual(validateAssignment(t, s, a), success);
});


test('preserves assignment error ordering after shared dispatch checks', () => {
  const [task, assignment, artifact] = triple();
  readOnly(task, assignment, artifact);
  assignment.candidate_ref = 'snapshot:other';
  assignment.state = 'READY';
  assignment.consumers = ['verifier-1'];
  assignment.analysis_scope = [];
  assignment.scratch_paths = ['src/label.mjs'];
  assert.deepEqual(validateAssignment(task, assignment, artifact).errors, [
    { path: '/artifact/candidate_ref', rule: 'assignment-mismatch' },
    { path: '/assignment/state', rule: 'inactive-assignment' },
    { path: '/artifact/consumers', rule: 'consumer-mismatch' },
    { path: '/artifact/actual_scope', rule: 'undeclared-scope' },
    { path: '/assignment/scratch_paths/0', rule: 'scratch-overlap' },
  ]);
});

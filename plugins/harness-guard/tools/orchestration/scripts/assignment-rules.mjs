import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv, ['uri', 'date-time']);
ajv.addSchema(JSON.parse(readFileSync(new URL('../schemas/envelopes.schema.json', import.meta.url))));
export const validateAssignmentSchema = ajv.compile(JSON.parse(readFileSync(new URL('../schemas/assignment.schema.json', import.meta.url))));

// Inputs must already pass the Task and Assignment schemas. This compares declarations only.
export function allocationErrors(task, assignment) {
  const errors = [];
  const add = (path, rule) => errors.push({ path, rule });
  const requiredInstances = new Set([
    ...task.roles.map(role => role.instance_id), ...assignment.candidate_writers,
    assignment.integration_owner, ...assignment.consumers,
  ]);
  const instances = new Set();
  const agents = new Set();
  assignment.bindings.forEach(({ instance_id, agent_id }, i) => {
    const path = `/assignment/bindings/${i}`;
    if (instances.has(instance_id)) add(path, 'duplicate-instance');
    if (agents.has(agent_id)) add(path, 'duplicate-agent');
    if (!requiredInstances.has(instance_id)) add(path, 'unused-binding');
    instances.add(instance_id);
    agents.add(agent_id);
  });
  if ([...requiredInstances].some(id => !instances.has(id))) add('/assignment/bindings', 'missing-binding');

  const writers = new Set(assignment.candidate_writers);
  if (task.ownership.some(entry => !writers.has(entry.owner))) add('/assignment/candidate_writers', 'missing-owner-history');
  if (task.verification.mode !== 'self' && writers.has(task.verification.verifier_instance_id)) {
    add('/task/verification/verifier_instance_id', 'verifier-was-writer');
  }
  const owned = task.ownership.filter(entry => entry.owner === assignment.producer.instance_id);
  if (assignment.mode === 'read-only') {
    if (owned.length > 0) add('/assignment/mode', 'read-only-owner');
  } else if (owned.length === 0) {
    add('/assignment/mode', 'missing-write-owner');
  }
  return errors;
}

export function lifecycleErrors(assignment, states = ['RUNNING', 'VERIFYING']) {
  const errors = [];
  const add = (path, rule) => errors.push({ path, rule });
  if (!states.includes(assignment.state)) add('/assignment/state', 'inactive-assignment');
  if (assignment.previous_attempt) {
    if (assignment.previous_attempt.attempt_id === assignment.attempt_id) add('/assignment/previous_attempt/attempt_id', 'attempt-not-advanced');
    if (assignment.previous_attempt.ownership_epoch >= assignment.ownership_epoch) add('/assignment/previous_attempt/ownership_epoch', 'epoch-not-advanced');
  }
  return errors;
}

export function scratchErrors(task, assignment) {
  const errors = [];
  const add = (path, rule) => errors.push({ path, rule });
  const candidatePaths = new Set([...task.ownership.filter(entry => entry.kind === 'path').map(entry => entry.target), ...assignment.analysis_scope]);
  assignment.scratch_paths.forEach((target, i) => {
    if (candidatePaths.has(target)) add(`/assignment/scratch_paths/${i}`, 'scratch-overlap');
  });
  return errors;
}

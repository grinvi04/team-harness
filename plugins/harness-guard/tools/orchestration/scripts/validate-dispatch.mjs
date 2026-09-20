#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateEnvelope } from './validate-envelope.mjs';
import { validateAssignmentSchema, allocationErrors, lifecycleErrors, scratchErrors } from './assignment-rules.mjs';
import { collectTaskRefs } from './task-refs.mjs';
import { parseContractJson } from './contract-json.mjs';

export function validateDispatch(task, assignment) {
  const errors = [];
  const add = (path, rule) => errors.push({ path, rule });
  const report = () => ({ valid: errors.length === 0, scope: 'dispatch-only', errors });
  const envelope = validateEnvelope(task);
  for (const error of envelope.errors) add(`/task${error.path}`, error.rule);
  if (envelope.valid && task.kind !== 'task') add('/task/kind', 'kind');
  if (!validateAssignmentSchema(assignment)) {
    for (const { instancePath, keyword } of validateAssignmentSchema.errors) add(`/assignment${instancePath}`, keyword);
  }
  if (errors.length) return report();

  for (const field of ['schema_version', 'task_id', 'task_revision', 'run_id']) {
    if (task[field] !== assignment[field]) add(`/assignment/${field}`, 'task-mismatch');
  }
  if (assignment.task_ref.revision !== task.task_revision) add('/assignment/task_ref/revision', 'task-mismatch');
  const key = ({ role, instance_id }) => JSON.stringify([role, instance_id]);
  const roles = new Set();
  const instances = new Set();
  task.roles.forEach((role, i) => {
    if (roles.has(key(role))) add(`/task/roles/${i}`, 'duplicate-role');
    roles.add(key(role)); instances.add(role.instance_id);
  });
  if (!roles.has(key(assignment.producer))) add('/assignment/producer', 'undeclared-producer');
  const targets = new Set();
  task.ownership.forEach((entry, i) => {
    if (!Number.isSafeInteger(entry.epoch)) add(`/task/ownership/${i}/epoch`, 'unsafe-epoch');
    if (!instances.has(entry.owner)) add(`/task/ownership/${i}/owner`, 'undeclared-owner');
    if (targets.has(entry.target)) add(`/task/ownership/${i}/target`, 'ambiguous-target');
    targets.add(entry.target);
    if (entry.owner === assignment.producer.instance_id && entry.epoch !== assignment.ownership_epoch) add(`/task/ownership/${i}/epoch`, 'ownership-epoch-mismatch');
  });
  const verifier = task.verification.verifier_instance_id;
  if (verifier !== null && !instances.has(verifier)) add('/task/verification/verifier_instance_id', 'undeclared-verifier');
  if (task.verification.mode === 'self' && (task.risk.level === 'high' || task.risk.triggers.length > 0)) add('/task/verification/mode', 'independent-verification-required');
  const acceptance = new Set();
  task.acceptance.forEach((criterion, i) => {
    if (acceptance.has(criterion.id)) add(`/task/acceptance/${i}/id`, 'duplicate-acceptance');
    if (criterion.critical && !criterion.required) add(`/task/acceptance/${i}/required`, 'critical-must-be-required');
    acceptance.add(criterion.id);
  });
  task.dependencies.forEach((dependency, i) => {
    if (dependency.state !== 'ACCEPTED') add(`/task/dependencies/${i}/state`, 'dependency-not-accepted');
  });
  collectTaskRefs(task, add);
  errors.push(...allocationErrors(task, assignment), ...lifecycleErrors(assignment, ['READY']), ...scratchErrors(task, assignment));
  return report();
}

function main(files) {
  if (files.length !== 2) {
    console.error('Usage: ao-dispatch-check TASK.json ASSIGNMENT.json');
    return 2;
  }
  const errors = [];
  const paths = ['/task', '/assignment'];
  const report = () => ({ valid: false, scope: 'dispatch-only', errors });
  const texts = files.map((file, i) => {
    try { return readFileSync(file, 'utf8'); }
    catch { errors.push({ path: paths[i], rule: 'read-error' }); }
  });
  if (errors.length) { console.log(JSON.stringify(report())); return 2; }
  const values = texts.map((text, i) => {
    try { return parseContractJson(text); }
    catch (error) {
      const rule = error.code === 'DUPLICATE_KEY' ? 'duplicate-key'
        : error.code === 'INVALID_EPOCH_LITERAL' ? 'invalid-epoch-literal' : 'invalid-json';
      errors.push({ path: paths[i], rule });
    }
  });
  const result = errors.length ? report() : validateDispatch(...values);
  console.log(JSON.stringify(result));
  return result.valid ? 0 : 1;
}
function isMain() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; }
}
if (isMain()) process.exitCode = main(process.argv.slice(2));

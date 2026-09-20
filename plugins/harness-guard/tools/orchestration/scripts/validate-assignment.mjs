#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateContract } from './validate-contract.mjs';
import { parseContractJson } from './contract-json.mjs';

import { validateAssignmentSchema, allocationErrors, lifecycleErrors, scratchErrors } from './assignment-rules.mjs';

export function validateAssignment(task, assignment, artifact) {
  const errors = validateContract(task, artifact).errors;
  const add = (path, rule) => errors.push({ path, rule });
  const report = () => ({ valid: errors.length === 0, scope: 'assignment-only', errors });
  if (!validateAssignmentSchema(assignment)) {
    for (const { instancePath, keyword } of validateAssignmentSchema.errors) add(`/assignment${instancePath}`, keyword);
  }
  if (errors.length) return report();

  for (const field of ['task_id', 'task_revision', 'run_id', 'schema_version']) {
    if (assignment[field] !== task[field]) add(`/assignment/${field}`, 'task-mismatch');
  }
  if (assignment.task_ref.revision !== task.task_revision) add('/assignment/task_ref/revision', 'task-mismatch');
  for (const field of ['attempt_id', 'ownership_epoch', 'base_ref']) {
    if (artifact[field] !== assignment[field]) add(`/artifact/${field}`, 'assignment-mismatch');
  }
  if (artifact.producer.role !== assignment.producer.role || artifact.producer.instance_id !== assignment.producer.instance_id) {
    add('/artifact/producer', 'assignment-mismatch');
  }

  errors.push(...allocationErrors(task, assignment));
  const owned = task.ownership.filter(entry => entry.owner === assignment.producer.instance_id);
  if (assignment.mode === 'read-only' && artifact.candidate_ref !== assignment.candidate_ref) add('/artifact/candidate_ref', 'assignment-mismatch');
  errors.push(...lifecycleErrors(assignment));

  const consumers = new Set();
  artifact.consumers.forEach(({ instance_id }, i) => {
    if (consumers.has(instance_id)) add(`/artifact/consumers/${i}`, 'duplicate-consumer');
    consumers.add(instance_id);
  });
  if (consumers.size !== assignment.consumers.length || assignment.consumers.some(id => !consumers.has(id))) {
    add('/artifact/consumers', 'consumer-mismatch');
  }
  const scope = new Set([...owned.map(entry => entry.target), ...assignment.analysis_scope]);
  if (artifact.actual_scope.some(target => !scope.has(target))) add('/artifact/actual_scope', 'undeclared-scope');
  errors.push(...scratchErrors(task, assignment));
  return report();
}

function main(files) {
  if (files.length !== 3) {
    console.error('Usage: node scripts/validate-assignment.mjs TASK.json ASSIGNMENT.json ARTIFACT.json');
    return 2;
  }
  const errors = [];
  const paths = ['/task', '/assignment', '/artifact'];
  const report = () => ({ valid: false, scope: 'assignment-only', errors });
  const texts = files.map((file, i) => {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      errors.push({ path: paths[i], rule: 'read-error' });
    }
  });
  if (errors.length) {
    console.log(JSON.stringify(report()));
    return 2;
  }
  const values = texts.map((text, i) => {
    try {
      return parseContractJson(text);
    } catch (error) {
      const rule = error.code === 'DUPLICATE_KEY' ? 'duplicate-key'
        : error.code === 'INVALID_EPOCH_LITERAL' ? 'invalid-epoch-literal' : 'invalid-json';
      errors.push({ path: paths[i], rule });
    }
  });
  const result = errors.length ? report() : validateAssignment(...values);
  console.log(JSON.stringify(result));
  return result.valid ? 0 : 1;
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMain()) process.exitCode = main(process.argv.slice(2));

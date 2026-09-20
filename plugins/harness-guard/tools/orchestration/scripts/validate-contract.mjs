#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateEnvelope } from './validate-envelope.mjs';
import { collectTaskRefs } from './task-refs.mjs';
import { parseContractJson } from './contract-json.mjs';

export function validateContract(task, artifact) {
  const errors = [];
  const add = (path, rule) => errors.push({ path, rule });
  const report = () => ({ valid: errors.length === 0, scope: 'contract-only', errors });

  for (const [kind, value] of [['task', task], ['artifact', artifact]]) {
    const result = validateEnvelope(value);
    for (const error of result.errors) add(`/${kind}${error.path}`, error.rule);
    if (result.valid && value.kind !== kind) add(`/${kind}/kind`, 'kind');
  }
  if (errors.length) return report();

  for (const field of ['schema_version', 'task_id', 'task_revision', 'run_id']) {
    if (task[field] !== artifact[field]) add(`/artifact/${field}`, 'task-mismatch');
  }

  const roleKey = ({ role, instance_id }) => JSON.stringify([role, instance_id]);
  const roles = new Set();
  const instances = new Set();
  task.roles.forEach((role, i) => {
    if (roles.has(roleKey(role))) add(`/task/roles/${i}`, 'duplicate-role');
    roles.add(roleKey(role));
    instances.add(role.instance_id);
  });
  if (!roles.has(roleKey(artifact.producer))) add('/artifact/producer', 'undeclared-producer');

  const targets = new Set();
  task.ownership.forEach((entry, i) => {
    if (!Number.isSafeInteger(entry.epoch)) add(`/task/ownership/${i}/epoch`, 'unsafe-epoch');
    if (!instances.has(entry.owner)) add(`/task/ownership/${i}/owner`, 'undeclared-owner');
    if (targets.has(entry.target)) add(`/task/ownership/${i}/target`, 'ambiguous-target');
    targets.add(entry.target);
  });
  if (!Number.isSafeInteger(artifact.ownership_epoch)) add('/artifact/ownership_epoch', 'unsafe-epoch');
  const assigned = task.ownership.filter(entry => entry.owner === artifact.producer.instance_id);
  const owned = new Set(artifact.owned_scope);
  if (assigned.length !== owned.size || assigned.some(entry => !owned.has(entry.target))) {
    add('/artifact/owned_scope', 'owned-scope-mismatch');
  }
  if (assigned.some(entry => entry.epoch !== artifact.ownership_epoch)) {
    add('/artifact/ownership_epoch', 'ownership-epoch-mismatch');
  }

  const { mode, verifier_instance_id: verifier } = task.verification;
  if (verifier !== null && !instances.has(verifier)) {
    add('/task/verification/verifier_instance_id', 'undeclared-verifier');
  }
  if (mode !== 'self' && task.ownership.some(entry => entry.owner === verifier)) {
    add('/task/verification/verifier_instance_id', 'verifier-is-owner');
  }
  if (mode === 'self' && (task.risk.level === 'high' || task.risk.triggers.length > 0)) {
    add('/task/verification/mode', 'independent-verification-required');
  }

  const acceptance = new Map();
  task.acceptance.forEach((criterion, i) => {
    if (acceptance.has(criterion.id)) add(`/task/acceptance/${i}/id`, 'duplicate-acceptance');
    if (criterion.critical && !criterion.required) add(`/task/acceptance/${i}/required`, 'critical-must-be-required');
    acceptance.set(criterion.id, criterion);
  });
  const claims = new Map();
  artifact.claims.forEach((claim, i) => {
    if (claims.has(claim.acceptance_id)) add(`/artifact/claims/${i}/acceptance_id`, 'duplicate-claim');
    if (!acceptance.has(claim.acceptance_id)) add(`/artifact/claims/${i}/acceptance_id`, 'undeclared-acceptance');
    claims.set(claim.acceptance_id, claim);
  });
  const evidenceByClaim = new Map();
  artifact.evidence.forEach((evidence, i) => {
    const path = `/artifact/evidence/${i}`;
    const criterion = acceptance.get(evidence.acceptance_id);
    if (!criterion) add(`${path}/acceptance_id`, 'undeclared-acceptance');
    if (!claims.has(evidence.acceptance_id)) add(`${path}/acceptance_id`, 'missing-claim');
    if (evidence.candidate_ref !== artifact.candidate_ref) add(`${path}/candidate_ref`, 'evidence-candidate-mismatch');
    if (criterion && (evidence.method.kind !== criterion.method.kind || evidence.method.value !== criterion.method.value)) {
      add(`${path}/method`, 'evidence-method-mismatch');
    }
    if (!evidenceByClaim.has(evidence.acceptance_id)) evidenceByClaim.set(evidence.acceptance_id, []);
    evidenceByClaim.get(evidence.acceptance_id).push(evidence.verdict);
  });
  artifact.claims.forEach((claim, i) => {
    const verdicts = evidenceByClaim.get(claim.acceptance_id) ?? [];
    const verdict = verdicts.includes('FAIL') ? 'FAIL'
      : verdicts.length === 0 || verdicts.includes('INCONCLUSIVE') ? 'INCONCLUSIVE' : 'PASS';
    if (claim.verdict !== verdict) add(`/artifact/claims/${i}/verdict`, 'claim-evidence-mismatch');
  });
  if (artifact.verdict === 'PASS' && task.acceptance.some(criterion => criterion.required && claims.get(criterion.id)?.verdict !== 'PASS')) {
    add('/artifact/claims', 'missing-required-claim');
  }
  if (artifact.verdict === 'FAIL' && !artifact.evidence.some(evidence => evidence.verdict === 'FAIL')) {
    add('/artifact/verdict', 'unsupported-fail');
  }

  const declaredRefs = collectTaskRefs(task, add);
  const suppliedRefs = new Map();
  artifact.input_refs.forEach((ref, i) => {
    if (suppliedRefs.has(ref.uri)) add(`/artifact/input_refs/${i}`, 'duplicate-input-ref');
    if (declaredRefs.get(ref.uri) !== ref.revision) add(`/artifact/input_refs/${i}`, 'input-ref-mismatch');
    suppliedRefs.set(ref.uri, ref.revision);
  });
  if (task.input_refs.some(ref => suppliedRefs.get(ref.uri) !== ref.revision)) {
    add('/artifact/input_refs', 'missing-input-ref');
  }
  return report();
}

function main(files) {
  if (files.length !== 2) {
    console.error('Usage: node scripts/validate-contract.mjs TASK.json ARTIFACT.json');
    return 2;
  }
  const errors = [];
  const paths = ['/task', '/artifact'];
  const texts = files.map((file, i) => {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      errors.push({ path: paths[i], rule: 'read-error' });
    }
  });
  if (errors.length) {
    console.log(JSON.stringify({ valid: false, scope: 'contract-only', errors }));
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
  const result = errors.length ? { valid: false, scope: 'contract-only', errors } : validateContract(...values);
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

#!/usr/bin/env node
// Bounded REST protection adapter. Unknown policy is a NO-GO, never a default.
import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
const fail = message => { throw new Error(message); };
const object = (v, label) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${label}: expected object`);
  return v;
};
const known = (v, keys, label) => {
  object(v, label);
  for (const k of Object.keys(v)) if (!keys.includes(k)) fail(`${label}: unsupported field ${k}`);
};
const bool = (v, label) => { if (typeof v !== 'boolean') fail(`${label}: expected boolean`); return v; };
const names = v => {
  if (!Array.isArray(v) || v.some(x => typeof x !== 'string' || !x.trim())) fail('invalid context list');
  return [...new Set(v)].sort();
};
const actors = (v, label) => {
  known(v, ['url','users_url','teams_url','apps_url','users','teams','apps'], label);
  const out = {};
  for (const [key, field] of [['users','login'],['teams','slug'],['apps','slug']]) {
    if (!Array.isArray(v[key])) fail(`${label}.${key}: expected list`);
    out[key] = names(v[key].map(x => typeof x === 'string' ? x : object(x, label)[field]));
  }
  if (Object.values(out).flat().length > 100) fail(`${label}: actor limit exceeded`);
  return out;
};
const flags = ['enforce_admins','required_linear_history','allow_force_pushes','allow_deletions','block_creations','required_conversation_resolution','lock_branch','allow_fork_syncing'];
function policy(d) {
  known(d, ['url','required_status_checks','required_pull_request_reviews','restrictions','required_signatures',...flags], 'protection');
  const p = {};
  for (const key of flags) if (key in d) {
    known(d[key], ['url','enabled'], key); p[key] = bool(d[key].enabled, key);
  }
  // Signatures use a separate endpoint and must never be sent in the PUT body.
  let signatures;
  if ('required_signatures' in d) {
    known(d.required_signatures, ['url','enabled'], 'required_signatures');
    signatures = bool(d.required_signatures.enabled, 'required_signatures');
  }
  const r = d.required_pull_request_reviews;
  if (r === null || !('required_pull_request_reviews' in d)) p.required_pull_request_reviews = null;
  else {
    known(r, ['url','dismiss_stale_reviews','require_code_owner_reviews','required_approving_review_count','require_last_push_approval','dismissal_restrictions','bypass_pull_request_allowances'], 'reviews');
    const count = r.required_approving_review_count;
    if (!Number.isInteger(count) || count < 0 || count > 6) fail('invalid approval count');
    const out = {required_approving_review_count:count};
    for (const k of ['dismiss_stale_reviews','require_code_owner_reviews','require_last_push_approval']) if (k in r) out[k] = bool(r[k], k);
    for (const k of ['dismissal_restrictions','bypass_pull_request_allowances']) if (k in r) out[k] = actors(r[k], k);
    p.required_pull_request_reviews = out;
  }
  p.restrictions = d.restrictions === null || d.restrictions === undefined ? null : actors(d.restrictions, 'restrictions');
  const c = d.required_status_checks;
  if (c === null) p.required_status_checks = null;
  else {
    known(c, ['url','contexts_url','checks_url','enforcement_level','strict','contexts','checks'], 'checks');
    const contexts = names(c.contexts);
    const out = {strict:bool(c.strict,'strict'), contexts};
    if ('checks' in c) {
      if (!Array.isArray(c.checks)) fail('checks: expected list');
      out.checks = c.checks.map(x => {
        known(x,['context','app_id'],'check'); names([x.context]);
        // GET permits null; it does not establish a safe integer/omitted PUT binding.
        if ('app_id' in x && x.app_id !== null && (!Number.isInteger(x.app_id) || x.app_id < -1)) fail('unsupported check app binding');
        return {...x};
      }).sort((a,b) => a.context.localeCompare(b.context) || (a.app_id ?? 0)-(b.app_id ?? 0));
      // A context without a matching check could make an app binding ambiguous.
      if (out.checks.length && contexts.some(x => !out.checks.some(y => y.context === x))) fail('inconsistent contexts/checks');
    }
    p.required_status_checks = out;
  }
  return {payload:p, signatures};
}
const read = path => JSON.parse(fs.readFileSync(path,'utf8'));
// GET exposes both projections; PUT accepts one representation. Keep app bindings.
function writePolicy(payload) {
  const p = structuredClone(payload), c = p.required_status_checks;
  if (c?.checks?.length) delete c.contexts;
  else if (c) delete c.checks;
  return p;
}
try {
  const [mode, original, arg, approval, destination] = process.argv.slice(2);
  if (mode === 'rules') {
    const d = read(original);
    if (!Array.isArray(d) || d.length) fail('rulesets unsupported or response malformed; GitHub policy owner must handle');
  } else if (mode === 'validate') {
    policy(read(original));
  } else if (mode === 'plan') {
    const before = policy(read(original));
    if (before.payload.required_status_checks?.checks?.some(x => x.app_id === null)) {
      fail('null check app binding: read supported, write plan refused; GitHub policy owner must handle');
    }
    const p = structuredClone(before.payload);
    const add = names(read(arg)); if (!add.length) fail('no required checks');
    const checks = p.required_status_checks ?? {strict:true,contexts:[]};
    const existing = new Set([...checks.contexts,...(checks.checks ?? []).map(x => x.context)]);
    if (checks.checks?.length) for (const context of add) if (!existing.has(context)) checks.checks.push({context});
    checks.contexts = names([...existing,...add]); checks.strict = true;
    if (checks.checks) checks.checks.sort((a,b) => a.context.localeCompare(b.context) || (a.app_id ?? 0)-(b.app_id ?? 0));
    p.required_status_checks = checks;
    p.enforce_admins = true; p.required_conversation_resolution = true;
    p.allow_force_pushes = false; p.allow_deletions = false;
    if (approval !== '') {
      const n = Number(approval), old = p.required_pull_request_reviews?.required_approving_review_count ?? 0;
      if (!Number.isInteger(n) || n < old || n > 6) fail('approval reduction or invalid count refused');
      p.required_pull_request_reviews ??= {required_approving_review_count:0};
      p.required_pull_request_reviews.required_approving_review_count = n;
      if (n > 0) p.required_pull_request_reviews.dismiss_stale_reviews = true;
    }
    fs.writeFileSync(destination, JSON.stringify(writePolicy(p)));
  } else if (mode === 'verify') {
    const before = policy(read(original)), after = policy(read(arg));
    if (!isDeepStrictEqual(writePolicy(after.payload), read(approval)) || before.signatures !== after.signatures) fail('postcondition policy mismatch');
  } else fail('unknown adapter mode');
} catch (error) { console.error(`branch-protection-policy: ${error.message}`); process.exitCode = 1; }

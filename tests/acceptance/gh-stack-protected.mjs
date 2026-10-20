#!/usr/bin/env node
// Explicit disposable-lab test. Never targets an existing branch or its protection.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [mode, out, prefix] = process.argv.slice(2);
assert.equal(mode, '--live');
assert.equal(process.argv.length, 5);
assert.ok(path.isAbsolute(out || '') && !existsSync(out));
assert.match(prefix || '', /^codex\/g0-protected-\d{8}-[a-z0-9]+$/);
const repo = 'grinvi04/team-harness-acceptance-lab', trunk = `${prefix}/trunk`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
mkdirSync(out, { recursive: true });
const cwd = path.join(out, 'fixture'); mkdirSync(cwd);
const env = Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL','SSH_AUTH_SOCK','GH_CONFIG_DIR','GH_TOKEN','GITHUB_TOKEN'].filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
Object.assign(env, { GH_HOST: 'github.com', GH_REPO: repo, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'Harness G0 Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Harness G0 Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' });
const commands = [], refs = new Map(), prs = [], stacks = [], requests = [], mutations = [], observations = {};
let uncertainCreate = false, protectedTrunk = false, before, failure;
const save = (name, data) => writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + '\n');
function run(argv, { input, expected = 0 } = {}) {
  const r = spawnSync(argv[0], argv.slice(1), { cwd, env, input, encoding: 'utf8', timeout: 45_000 });
  commands.push({ argv, cwd, input: input ?? null, exitCode: r.status, stdout: r.stdout || '', stderr: r.stderr || '' });
  save('commands.json', commands);
  if (expected !== null) assert.equal(r.status, expected, JSON.stringify(commands.at(-1)));
  return r;
}
const git = (...args) => run(['git', ...args]).stdout.trim();
function api(endpoint, body, method = body ? 'POST' : 'GET', expected = 0) {
  const args = ['gh', 'api', `repos/${repo}/${endpoint}`, '--method', method];
  if (body) args.push('--input', '-');
  const mutation = method !== 'GET' && !endpoint.includes('/merge-async') ? { endpoint, method } : null;
  if (mutation) { mutations.push(mutation); checkpoint(); }
  const r = run(args, { input: body ? JSON.stringify(body) : undefined, expected });
  if (mutation && r.status === 0) { mutations.splice(mutations.indexOf(mutation), 1); checkpoint(); }
  return { exitCode: r.status, data: r.stdout ? JSON.parse(r.stdout) : null };
}
function inventory() {
  const branches = api('branches?per_page=100').data;
  assert.ok(branches.length < 100);
  return { branches, protections: Object.fromEntries(branches.filter(b => b.protected).map(b => [b.name, api(`branches/${encodeURIComponent(b.name)}/protection`).data])),
    rulesets: api('rulesets?includes_parents=true').data };
}
function checkpoint() { save('owned.json', { refs: Object.fromEntries(refs), prs, stacks, requests, mutations, protectedTrunk, uncertainCreate }); }
function commit(file, content) {
  if (existsSync(path.join(cwd, file)) && readFileSync(path.join(cwd, file), 'utf8') === content) return git('rev-parse', 'HEAD');
  writeFileSync(path.join(cwd, file), content); git('add', file); git('commit', '-qm', `test(lab): ${path.basename(file)} 격리 관찰`);
  return git('rev-parse', 'HEAD');
}
function push(name) {
  assert.ok(name.startsWith(prefix + '/')); refs.set(name, git('rev-parse', 'HEAD')); checkpoint();
  const mutation = { push: name }; mutations.push(mutation); checkpoint();
  git('push', '-u', 'origin', `HEAD:refs/heads/${name}`);
  mutations.splice(mutations.indexOf(mutation), 1); checkpoint();
}
function createPr(name, base, label) {
  const body = path.join(out, `${label}.md`);
  writeFileSync(body, `Disposable protected stack observation. Only ${prefix} refs and new trunk protection.\nSynthetic code and CI only. No existing branches, policies, deployment or customer data.\n`);
  refs.set(name, git('rev-parse', 'HEAD')); uncertainCreate = true; checkpoint();
  const r = run(['bash', path.join(root, 'plugins/harness-guard/scripts/pr-create.sh'), '--base', base,
    '--title', `test(lab): protected stack ${label}`, '--body-file', body], { expected: null });
  const found = api(`pulls?head=grinvi04:${encodeURIComponent(name)}&state=all`).data;
  assert.equal(found.length, 1); const p = found[0];
  assert.equal(p.head.repo.full_name, repo); assert.equal(p.base.ref, base); assert.equal(p.head.sha, refs.get(name));
  prs.push({ number: p.number, branch: name, head: p.head.sha, url: p.html_url }); uncertainCreate = false; checkpoint();
  console.log(`CREATED_PR ${p.html_url}`); assert.equal(r.status, 0); return p.number;
}
function pair(label, failingLower) {
  const lower = `${prefix}/${label}-a`, upper = `${prefix}/${label}-b`;
  git('switch', '-c', lower, trunk);
  commit('result.txt', failingLower ? 'fail\n' : 'pass\n');
  commit(`${label}-a.txt`, 'synthetic lower\n');
  const a = createPr(lower, trunk, `${label}-a`);
  git('switch', '-c', upper, lower); commit('result.txt', 'pass\n');
  commit(`${label}-b.txt`, 'synthetic upper\n');
  const b = createPr(upper, lower, `${label}-b`);
  const stack = api('stacks', { pull_requests: [a, b] }).data; stacks.push(stack.number); checkpoint();
  const readback = api(`stacks/${stack.number}`).data;
  assert.deepEqual(readback.pull_requests.map(p => p.number), [a, b]);
  return [a, b];
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function checks(number, expected) {
  const p = prs.find(p => p.number === number);
  for (let n = 0; n < 60; n++) {
    const rows = api(`commits/${p.head}/check-runs?per_page=100`).data.check_runs.filter(r => r.name === 'g0-stack-contract').sort((a,b) => b.id-a.id);
    const r = rows[0];
    if (r?.status === 'completed') {
      assert.equal(r.head_sha, p.head); assert.equal(r.app.id, 15368); assert.equal(r.conclusion, expected);
      save(`checks-${number}.json`, rows); return r;
    }
    // Joining a stack may not retrigger an explicitly enumerated activity list; observe both cases.
    if (n === 6) api(`pulls/${number}`, { title: `test(lab): protected stack observation ${number}` }, 'PATCH');
    await pause(5_000);
  }
  throw Error(`CI did not complete for PR${number}`);
}
function protect(reviewCount) {
  assert.ok(refs.has(trunk) && !before.branches.some(b => b.name === trunk));
  protectedTrunk = true; checkpoint(); // journal before a possibly lost response
  api(`branches/${encodeURIComponent(trunk)}/protection`, {
    required_status_checks: { strict: true, checks: [{ context: 'g0-stack-contract', app_id: 15368 }] },
    enforce_admins: true, required_pull_request_reviews: { required_approving_review_count: reviewCount,
      dismiss_stale_reviews: true, require_code_owner_reviews: false, require_last_push_approval: false },
    restrictions: null, required_conversation_resolution: true, allow_force_pushes: false, allow_deletions: false
  }, 'PUT');
  const p = api(`branches/${encodeURIComponent(trunk)}/protection`).data;
  assert.equal(p.required_status_checks.strict, true); assert.equal(p.enforce_admins.enabled, true);
  assert.deepEqual(p.required_status_checks.checks, [{ context: 'g0-stack-contract', app_id: 15368 }]);
  assert.deepEqual(p.required_status_checks.contexts, ['g0-stack-contract']);
  assert.equal(p.required_conversation_resolution.enabled, true);
  assert.equal(p.allow_force_pushes.enabled, false); assert.equal(p.allow_deletions.enabled, false);
  assert.equal(p.required_pull_request_reviews.required_approving_review_count, reviewCount);
  save(`policy-reviews-${reviewCount}.json`, p);
}
async function merge(number, expected, reason) {
  const head = prs.find(p => p.number === number).head;
  const beforePr = api(`pulls/${number}`).data;
  assert.equal(beforePr.head.sha, head); assert.equal(beforePr.state, 'open'); assert.equal(beforePr.draft, false);
  assert.equal(beforePr.stack.base.ref, trunk);
  const beforeGroup = api(`stacks/${beforePr.stack.number}`).data;
  for (const p of beforeGroup.pull_requests) assert.equal(p.head.sha, prs.find(owned => owned.number === p.number)?.head);
  const beforeTrunk = api(`git/ref/heads/${trunk}`).data.object.sha;
  save(`candidate-${number}-${requests.length + 1}.json`, { pr: beforePr, group: beforeGroup, trunk: beforeTrunk });
  const request = { number, head, status: 'unverified' }; requests.push(request); checkpoint();
  let r = api(`pulls/${number}/merge-async`, { sha: head, merge_action: 'default', merge_method: 'merge' }, 'PUT', null).data;
  request.response = r; request.uuid = r?.details?.uuid; checkpoint();
  for (let i = 0; i < 30 && r?.status === 'pending'; i++) {
    await pause(2_000); r = api(`pulls/${number}/merge-async/${request.uuid}`).data;
  }
  request.status = r?.status || 'unverified'; request.result = r; checkpoint();
  assert.equal(request.status, expected, JSON.stringify(request));
  const p = api(`pulls/${number}`).data; assert.equal(p.merged, expected === 'merged');
  save(`merge-${number}-${requests.length}.json`, { request, pr: p });
  if (expected === 'failed') {
    assert.equal(p.head.sha, head); assert.equal(p.base.ref, beforePr.base.ref); assert.equal(p.stack.number, beforePr.stack.number);
    assert.deepEqual(api(`stacks/${p.stack.number}`).data.pull_requests.map(p => [p.number, p.head.sha]), beforeGroup.pull_requests.map(p => [p.number, p.head.sha]));
    assert.equal(api(`git/ref/heads/${trunk}`).data.object.sha, beforeTrunk);
    assert.match(r?.details?.message || '', reason, 'rejection cause unverified; not evidence of the intended gate');
  }
  return p;
}

try {
  before = inventory(); save('before.json', before);
  assert.ok(!before.branches.some(b => b.name.startsWith(prefix + '/')));
  git('init', '-b', trunk); git('remote', 'add', 'origin', `https://github.com/${repo}.git`);
  git('config', '--local', 'credential.https://github.com.helper', '!gh auth git-credential');
  mkdirSync(path.join(cwd, '.github/workflows'), { recursive: true });
  const workflow = `name: G0 protected stack observation
on:
  pull_request:
    branches: [${trunk}]
    types: [opened, synchronize, reopened, edited, stacked]
permissions:
  contents: read
jobs:
  g0-stack-contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd
        with:
          ref: \${{ github.event.pull_request.head.sha }}
          persist-credentials: false
      - name: Observe allowlisted event fields
        env:
          WORKFLOW_SHA: \${{ github.workflow_sha }}
        run: |
          node -e 'const fs=require("fs"),e=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH)),p=e.pull_request; console.log(JSON.stringify({action:e.action,event:process.env.GITHUB_EVENT_NAME,baseRef:process.env.GITHUB_BASE_REF,githubSha:process.env.GITHUB_SHA,githubRef:process.env.GITHUB_REF,workflowSha:process.env.WORKFLOW_SHA,pr:p.number,base:{ref:p.base.ref,sha:p.base.sha},head:p.head.sha,stack:p.stack||null})); if(fs.readFileSync("result.txt","utf8").trim()!=="pass")process.exit(1)'
`;
  commit('.github/workflows/g0-stack.yml', workflow); commit('result.txt', 'seed\n'); push(trunk);
  const failing = pair('failing', true), passing = pair('passing', false);
  observations.failing = failing; observations.passing = passing; save('observations.json', observations);
  await checks(failing[0], 'failure'); await checks(failing[1], 'success');
  await checks(passing[0], 'success'); await checks(passing[1], 'success');
  observations.ci = 'PASS'; save('observations.json', observations);
  protect(0);
  await merge(failing[1], 'failed', /(?:check|status).*(?:fail|pass|requir|satisf|success)|(?:fail|requir|pending).*(?:check|status)/i);
  assert.equal(api(`pulls/${failing[0]}`).data.merged, false);
  observations.failedLowerRejected = true; save('observations.json', observations);
  protect(1);
  await merge(passing[1], 'failed', /approv|review/i); assert.equal(api(`pulls/${passing[0]}`).data.merged, false);
  observations.missingApprovalRejected = true; save('observations.json', observations);
  // Only the new disposable trunk's review count changes; required CI and strict enforcement remain.
  protect(0);
  const merged = await merge(passing[1], 'merged');
  assert.equal(api(`pulls/${passing[0]}`).data.merged, true);
  assert.equal(api(`git/ref/heads/${trunk}`).data.object.sha, merged.merge_commit_sha);
  refs.set(trunk, merged.merge_commit_sha); checkpoint();
  observations.protectedGroupMerged = true; observations.mergeSha = merged.merge_commit_sha;
  save('observations.json', observations);
} catch (e) { failure = e.message; console.error(failure); }
finally {
  let cleanupFailure;
  try {
    assert.ok(before, 'before inventory unavailable');
    assert.ok(!uncertainCreate && !mutations.length && requests.every(r => ['failed','merged'].includes(r.status)), 'unresolved remote effect; preserve refs');
    for (const p of prs) {
      const current = api(`pulls/${p.number}`).data;
      if (current.state === 'open') api(`pulls/${p.number}`, { state: 'closed' }, 'PATCH');
      assert.equal(api(`pulls/${p.number}`).data.state, 'closed');
    }
    if (protectedTrunk) api(`branches/${encodeURIComponent(trunk)}/protection`, undefined, 'DELETE');
    for (const [name, original] of [...refs].reverse()) {
      const remote = run(['git', 'ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${name}`], { expected: null });
      if (remote.status === 2) continue;
      assert.equal(remote.status, 0);
      const [sha, ref] = remote.stdout.trim().split(/\s+/); assert.equal(ref, `refs/heads/${name}`);
      // A whole-group merge doesn't rebase its own heads; unknown changes must remain for inspection.
      assert.equal(sha, original, `changed ref ${name}; preserve it`);
      git('push', `--force-with-lease=refs/heads/${name}:${sha}`, 'origin', `:refs/heads/${name}`);
    }
    const after = inventory(); save('after.json', after); assert.deepEqual(after, before);
    rmSync(cwd, { recursive: true });
  } catch (e) { cleanupFailure = e.message; }
  save('result.json', { verdict: failure ? 'FAIL' : 'PASS', failure: failure || null,
    observations, cleanup: cleanupFailure ? 'UNVERIFIED' : 'PASS', cleanupFailure: cleanupFailure || null });
  console.log(JSON.stringify({ verdict: failure ? 'FAIL' : 'PASS', cleanup: cleanupFailure ? 'UNVERIFIED' : 'PASS', out }));
  if (failure || cleanupFailure) process.exitCode = 1;
}

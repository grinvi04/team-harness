#!/usr/bin/env node
// Explicit remote G0 counterexample probe, restricted to the approved synthetic lab.
// Does not touch existing refs, protection, workflows, tags or releases.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from './evidence.mjs';

const [mode, dataHome, out, prefix] = process.argv.slice(2);
if (process.argv.length !== 6 || mode !== '--live' || !path.isAbsolute(dataHome || '') || !path.isAbsolute(out || '')
  || !/^codex\/g0-stack-\d{8}-[a-z0-9]+$/.test(prefix || '')) {
  console.error('Usage: gh-stack-remote.mjs --live ABS_XDG_DATA_HOME NEW_ABS_EVIDENCE_DIR codex/g0-stack-YYYYMMDD-ID');
  process.exit(2);
}
const repo = 'grinvi04/team-harness-acceptance-lab';
assert.ok(!existsSync(out), 'never overwrite an earlier attempt');
assert.match(readFileSync(path.join(dataHome, 'gh/extensions/gh-stack/manifest.yml'), 'utf8'), /^tag: v0\.2\.1$/m);
mkdirSync(out, { recursive: true });
const cwd = path.join(out, 'fixture'); mkdirSync(cwd);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const inherited = Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL','SSH_AUTH_SOCK','GH_CONFIG_DIR','GH_TOKEN','GITHUB_TOKEN'].filter(k=>process.env[k] !== undefined).map(k=>[k,process.env[k]]));
const env = { ...inherited, GH_HOST: 'github.com', GH_REPO: repo, XDG_DATA_HOME: dataHome, GH_PROMPT_DISABLED: '1', GH_NO_EXTENSION_UPDATE_NOTIFIER: '1',
  GH_NO_UPDATE_NOTIFIER: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'Harness G0 Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Harness G0 Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
const commands = [], createdRefs = [], prs = [], stacks = [], outcomes = [];
const expectedRefs = new Map(); let unresolvedMerge = false, unresolvedCreate = false;
const save = (name, data) => writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + '\n');
function run(argv, { input, expected = 0 } = {}) {
  const r = spawnSync(argv[0], argv.slice(1), { cwd, env, input, encoding: 'utf8', timeout: 45_000 });
  commands.push({ argv, cwd, input: input || null, exitCode: r.status, stdout: r.stdout || '', stderr: r.stderr || '' });
  save('commands.json', commands);
  if (expected !== null) assert.equal(r.status, expected, JSON.stringify(commands.at(-1)));
  return r;
}
const git = (...args) => run(['git', ...args]).stdout.trim();
function api(endpoint, body, method = body ? 'POST' : 'GET', expected = 0) {
  const argv = ['gh', 'api', `repos/${repo}/${endpoint}`, '--method', method];
  if (body) argv.push('--input', '-');
  const r = run(argv, { input: body ? JSON.stringify(body) : undefined, expected });
  return { exitCode: r.status, data: r.stdout ? JSON.parse(r.stdout) : null };
}
function inventory() {
  return { branches: api('branches?per_page=100').data, rulesets: api('rulesets?includes_parents=true').data,
    main: api('branches/main/protection').data, develop: api('branches/develop/protection').data };
}
const before = inventory(); save('before.json', before);
assert.ok(before.branches.length < 100, 'inventory pagination required');
assert.ok(!before.branches.some(b => b.name.startsWith(prefix)), 'prefix already in use');
function commit(file, content) {
  writeFileSync(path.join(cwd, file), content); git('add', file); git('commit', '-qm', `test: ${file} 합성 시험`);
  return git('rev-parse', 'HEAD');
}
function branch(suffix, ref) { const name = `${prefix}/${suffix}`; git('switch', '-c', name, ref); return name; }
function push(name) {
  assert.ok(name.startsWith(prefix + '/'));
  expectedRefs.set(name, git('rev-parse', 'HEAD'));
  createdRefs.push(name); save('created-refs.json', createdRefs); save('expected-refs.json', Object.fromEntries(expectedRefs));
  git('push', '-u', 'origin', `HEAD:refs/heads/${name}`);
}
function pr(name, base, label) {
  const body = path.join(out, `body-${label}.md`);
  writeFileSync(body, `Synthetic G0 compatibility probe. Scope: ${prefix} branches only.\nNo changes to existing branches, protection, deployment or customer data.\nThis PR is a disposable API test, not a product delivery or an approval record.\n`);
  expectedRefs.set(name, git('rev-parse', 'HEAD'));
  if (!createdRefs.includes(name)) createdRefs.push(name); save('created-refs.json', createdRefs); save('expected-refs.json', Object.fromEntries(expectedRefs));
  unresolvedCreate = true;
  const r = run(['bash', path.join(root, 'plugins/harness-guard/scripts/pr-create.sh'), '--base', base,
    '--title', `test: G0 ${label} 합성 시험`, '--body-file', body], {expected:null});
  const found = api(`pulls?head=grinvi04:${encodeURIComponent(name)}&state=all`).data;
  assert.equal(found.length, 1, 'create outcome unknown; preserve refs and do not retry');
  assert.equal(found[0].head.repo.full_name, repo); assert.equal(found[0].base.ref, base);
  assert.equal(found[0].head.sha, expectedRefs.get(name));
  const url = found[0].html_url;
  assert.ok(url?.startsWith(`https://github.com/${repo}/pull/`));
  const number = Number(url.split('/').at(-1)); prs.push({ number, url, branch: name });
  if (!createdRefs.includes(name)) createdRefs.push(name);
  save('created-prs.json', prs); save('created-refs.json', createdRefs);
  console.log(`CREATED_PR ${url}`); unresolvedCreate = false;
  assert.equal(r.status, 0, 'create command failed; original response retained'); return number;
}
function link(numbers) {
  const declaredBase = api(`pulls/${numbers[0]}`).data.base.ref;
  assert.ok(declaredBase.startsWith(prefix+'/'));
  run(['gh', 'stack', 'link', '--base', declaredBase, ...numbers.map(n => `https://github.com/${repo}/pull/${n}`)]);
  const p = api(`pulls/${numbers[0]}`).data;
  assert.ok(p.stack?.number); stacks.push(p.stack.number); save('created-stacks.json', stacks);
  const s = api(`stacks/${p.stack.number}`).data;
  assert.deepEqual(s.pull_requests.map(p => p.number), numbers); return p.stack.number;
}
async function merge(number, sha) {
  unresolvedMerge = true;
  const request = api(`pulls/${number}/merge-async`, { sha, merge_method: 'merge', merge_action: 'default' }, 'PUT', null);
  let state = request.data;
  const uuid = state?.details?.uuid;
  for (let i = 0; state?.status === 'pending' && i < 30; i++) {
    assert.ok(uuid, 'pending request requires UUID');
    await new Promise(resolve => setTimeout(resolve, 1000));
    state = api(`pulls/${number}/merge-async/${uuid}`).data;
  }
  unresolvedMerge = !['merged','failed'].includes(state?.status);
  const result = { number, expectedHead: sha, request, uuid, final: state, pr: api(`pulls/${number}`).data };
  save(`merge-${number}-${outcomes.length}.json`, result); return result;
}
let failure, counterexample;
try {
  git('init', '-q', '-b', 'fixture'); git('remote', 'add', 'origin', `https://github.com/${repo}.git`);
  git('config', '--local', 'credential.https://github.com.helper', '!gh auth git-credential');
  const baseline = commit('README.md', '# Disposable G0 probe\n');
  const trunk = branch('normal-trunk', baseline); push(trunk);
  const a = branch('normal-a', trunk), aSha = commit('a.txt', 'a\n'), aPr = pr(a, trunk, 'normal-a');
  const b = branch('normal-b', a); commit('b.txt', 'b\n'); const bPr = pr(b, a, 'normal-b');
  const c = branch('normal-c', b); commit('c.txt', 'c\n'); const cPr = pr(c, b, 'normal-c');
  link([aPr,bPr,cPr]);
  const wrong = await merge(aPr, baseline); outcomes.push({ id: 'wrong-sha', result: wrong }); save('outcomes.json', outcomes);
  assert.equal(wrong.pr.merged, false, 'wrong SHA must never merge');
  assert.equal(wrong.final?.status, 'failed', 'generic HTTP/transport failure is not a SHA rejection');
  assert.match(wrong.final.details?.message || '', /sha|head|match/i, 'SHA-specific rejection required');
  for (const n of [bPr,cPr]) assert.equal(api(`pulls/${n}`).data.merged, false);
  assert.equal(api(`git/ref/heads/${trunk}`).data.object.sha, baseline);
  const normal = await merge(aPr, aSha); outcomes.push({ id: 'lowest-only', result: normal }); save('outcomes.json', outcomes);
  assert.equal(normal.final?.status, 'merged'); assert.equal(normal.pr.merged, true);
  expectedRefs.set(trunk, normal.pr.merge_commit_sha);
  assert.ok(['ahead','identical'].includes(api(`compare/${aSha}...${normal.pr.merge_commit_sha}`).data.status));
  const bAfter = api(`pulls/${bPr}`).data, cAfter = api(`pulls/${cPr}`).data;
  assert.equal(bAfter.merged, false); assert.equal(cAfter.merged, false); assert.equal(bAfter.base.ref, trunk);
  // Independent actor changes membership after A was checked as the lowest layer.
  const raceTrunk = branch('race-trunk', baseline); push(raceTrunk);
  const x = branch('race-x', raceTrunk); const xSha = commit('x.txt', 'already an ancestor of A\n'); push(x);
  const ra = branch('race-a', x); const raSha = commit('ra.txt', 'A selected for review\n'); const raPr = pr(ra, raceTrunk, 'race-a');
  const rb = branch('race-b', ra); commit('rb.txt', 'upper\n'); const rbPr = pr(rb, ra, 'race-b');
  const oldStack = link([raPr,rbPr]);
  const checked = api(`pulls/${raPr}`).data; save('checked-race-candidate.json', checked);
  assert.equal(checked.stack.position, 1); assert.equal(checked.head.sha, raSha); assert.equal(checked.base.ref, raceTrunk);
  api(`stacks/${oldStack}/unstack`, null, 'POST');
  git('switch', x); const xPr = pr(x, raceTrunk, 'unchecked-lower-x');
  api(`pulls/${raPr}`, { base: x }, 'PATCH'); link([xPr,raPr,rbPr]);
  const changed = api(`pulls/${raPr}`).data; save('changed-race-candidate.json', changed);
  assert.equal(changed.head.sha, checked.head.sha); assert.equal(changed.stack.position, 2);
  const raced = await merge(raPr, raSha); outcomes.push({ id: 'composition-race', result: raced });
  if (raced.pr.merged) expectedRefs.set(raceTrunk, raced.pr.merge_commit_sha);
  const xAfter = api(`pulls/${xPr}`).data; save('unchecked-lower-after.json', xAfter);
  counterexample = xAfter.merged === true;
  if (!counterexample) {
    assert.equal(raced.final?.status, 'failed', 'unresolved or generic response is not a race rejection');
    assert.equal(raced.pr.merged, false);
    assert.equal(api(`git/ref/heads/${raceTrunk}`).data.object.sha, baseline);
    assert.match(raced.final.details?.message || '', /base|stack|membership|position/i, 'composition-specific rejection required');
  }
  save('outcomes.json', outcomes);
  assert.equal(counterexample, false, 'G0 NO-GO: unchanged selected head merged a lower PR absent from checked membership');
} catch (e) { failure = e.message; console.error(failure); }
finally {
  // Close only this run's open PRs. Ref deletion requires exact expected remote SHA.
  const cleanup = [];
  if (unresolvedMerge || unresolvedCreate) cleanup.push({state:'PENDING_PRESERVED', reason:'unresolved async result; do not cancel/delete implicitly'});
  for (const {number} of (unresolvedMerge || unresolvedCreate) ? [] : prs) {
    try {
    const p = api(`pulls/${number}`).data;
    if (p.state === 'open') api(`pulls/${number}`, { state: 'closed' }, 'PATCH');
    cleanup.push({number, state: api(`pulls/${number}`).data.state});
    } catch(e) { cleanup.push({number,state:'UNVERIFIED',error:e.message}); unresolvedCreate=true; }
  }
  for (const name of (unresolvedMerge || unresolvedCreate) ? [] : [...createdRefs].reverse()) {
    try {
    const refResponse = api(`git/ref/heads/${name}`, null, 'GET', null);
    if (refResponse.exitCode !== 0) { cleanup.push({ref:name,state:'UNVERIFIED',reason:'ref read failed; retained'}); continue; }
    const ref = refResponse.data;
    if (expectedRefs.get(name) !== ref.object.sha) { cleanup.push({ref:name,state:'PRESERVED_CHANGED',expected:expectedRefs.get(name),actual:ref.object.sha}); continue; }
    // Unique disposable refs; compare immediately before ordinary Git deletion.
    run(['git', 'push', `--force-with-lease=refs/heads/${name}:${ref.object.sha}`, 'origin', `:refs/heads/${name}`]);
    cleanup.push({ ref: name, deletedOid: ref.object.sha });
    } catch(e) { cleanup.push({ref:name,state:'UNVERIFIED',error:e.message}); }
  }
  save('cleanup.json', cleanup);
  let after; try { after=inventory(); save('after.json', after); } catch(e) { save('result.json',{verdict:'UNVERIFIED',failure,error:e.message,cleanup,prs,unresolvedMerge,unresolvedCreate}); throw e; }
  const nonOwnedAfter = {...after, branches:after.branches.filter(b=>!createdRefs.includes(b.name))};
  const preserved = digest(JSON.stringify(before)) === digest(JSON.stringify(nonOwnedAfter));
  const remainingOwnedRefs = after.branches.filter(b=>createdRefs.includes(b.name));
  const cleanupPassed = preserved && !remainingOwnedRefs.length && !unresolvedMerge && !unresolvedCreate
    && !cleanup.some(x=>['UNVERIFIED','PRESERVED_CHANGED','PENDING_PRESERVED'].includes(x.state));
  save('result.json', { verdict: counterexample ? 'NO_GO' : failure || !cleanupPassed ? 'UNVERIFIED' : 'PASS_SCOPED', cleanupPassed,
    failure, counterexample, existingInventoryPreserved: preserved, remainingOwnedRefs, unresolvedMerge, unresolvedCreate, prs, outcomes: outcomes.map(o=>o.id),
    notRun: ['pending composition mutation', 'base race', '409 differing options', 'response loss', 'solo delayed restore'] });
  assert.equal(preserved, true, 'existing branches/protection/rulesets changed');
  if (remainingOwnedRefs.length || cleanup.some(x=>x.state==='UNVERIFIED')) process.exitCode=1;
}
if (failure) process.exitCode = 1;

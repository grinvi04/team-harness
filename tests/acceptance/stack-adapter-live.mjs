#!/usr/bin/env node
// Staged, explicitly invoked disposable-lab acceptance. This file performs no work on import.
// Example: node tests/acceptance/stack-adapter-live.mjs --mode prepare --evidence ABS_NEW_DIR --binary ABS_GH_STACK --gh ABS_GH
// Later modes use the same arguments. merge additionally requires --pr N --head OID --base OID;
// --lose-response discards ONE real merge-async reply after saving it, without substituting JSON.
// resume requires --journal ABS_ACTIVE_JOURNAL. Root owns review/CI approval before merge.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO = 'grinvi04/team-harness-acceptance-lab';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPTS = path.join(ROOT, 'plugins/harness-guard/scripts');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function commandOutcome(result) {
  return result.error || result.signal || !Number.isInteger(result.status) ? 'unknown' : 'returned';
}
export function assertCleanupSafe(state, active) {
  assert.ok(!state.commands.some(c => c.state === 'intent' || c.state === 'unknown'), 'unknown command or child termination; manual reconciliation required');
  assert.ok(active.every(j => !j.data.requestStarted || ['merged','failed'].includes(j.data.state)), 'unresolved remote merge; preserve refs/PRs');
}
export function inspectStackEffects(directory, { repo, root, trunk, prefix }) {
  let stat;
  try { stat = fs.lstatSync(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid()
    && (stat.mode & 0o777) === 0o700, 'unsafe stack effect journal directory');
  const records = fs.readdirSync(directory).sort().map(name => {
    assert.match(name,/^[0-9]+-[0-9a-f-]{36}\.json$/, 'unexpected stack effect journal entry');
    const file = path.join(directory,name), entry = fs.lstatSync(file);
    assert.ok(entry.isFile() && !entry.isSymbolicLink() && entry.uid === process.getuid()
      && (entry.mode & 0o777) === 0o600, 'unsafe stack effect journal');
    const data = json(file);
    assert.equal(data.schemaVersion,1); assert.ok(['submit','restack','sync'].includes(data.action));
    assert.match(data.expected,/^[a-f0-9]{64}$/); assert.equal(data.repo,repo); assert.equal(data.trunk,trunk);
    assert.equal(data.before?.root,root); assert.equal(data.before?.repo,repo); assert.equal(data.before?.trunk,trunk);
    assert.ok(Array.isArray(data.before.layers) && data.before.layers.length > 0
      && data.before.layers.every(layer => typeof layer.branch === 'string' && layer.branch.startsWith(prefix+'/')),
    'stack journal has an unowned layer');
    assert.ok(['started','unverified','confirmed','aborted'].includes(data.state) && Array.isArray(data.effects), 'malformed stack effect journal');
    for (const effect of data.effects) assert.ok(typeof effect.kind === 'string' && effect.kind.length > 0
      && ['unknown','returned'].includes(effect.state), 'malformed stack effect');
    return { file,data };
  });
  assert.ok(records.every(({data}) => ['confirmed','aborted'].includes(data.state)
    && data.effects.every(effect => effect.state === 'returned')),
  'unconfirmed submit/restack/sync effect; manually reconcile before cleanup');
  return records;
}
export function recordRefObservation(state, branch, localOid) {
  state.refReadbacks ??= [];
  state.refReadbacks.push({ branch, localOid, at: new Date().toISOString() });
}
export function assertOwnedRefs(expected, observed) {
  for (const [branch,oid] of Object.entries(expected)) {
    assert.ok(observed[branch] === null || observed[branch] === oid, `ref moved; preserve other writer: ${branch}`);
  }
}
export function assertBranchPreservation(before, current, developProof) {
  const live = new Map(current.map(b => [b.name,b.commit.sha]));
  for (const branch of before) {
    assert.ok(live.has(branch.name), `pre-existing branch disappeared: ${branch.name}`);
    if (live.get(branch.name) === branch.commit.sha) continue;
    assert.equal(branch.name,'develop',`pre-existing branch moved: ${branch.name}`);
    assert.ok(developProof?.merged === true && developProof.mergeSha === live.get('develop')
      && developProof.baseline === branch.commit.sha && developProof.ancestor === true,
    'develop moved without approved MERGED/ancestor evidence');
  }
}
export function stackPolicy(existing) {
  assert.ok(existing && typeof existing === 'object' && !Array.isArray(existing), 'policy must be an object');
  assert.equal(existing.schemaVersion, 1); assert.equal(existing.mode, 'company');
  assert.deepEqual(existing.autoMergeTargets, ['develop'], 'preserve the approved lab auto-merge targets');
  assert.ok(existing.branchFlow === undefined || existing.branchFlow === 'git-flow', 'conflicting branchFlow');
  const stackedPRs = { enabled: true, provider: 'github-gh-stack' };
  if (existing.stackedPRs !== undefined) assert.deepEqual(existing.stackedPRs, stackedPRs, 'conflicting stackedPRs');
  return { ...existing, branchFlow: 'git-flow', stackedPRs: existing.stackedPRs ?? stackedPRs };
}
function options(args) {
  const out = {};
  while (args.length) {
    const key = args.shift();
    assert.ok(['--mode','--evidence','--binary','--gh','--pr','--head','--base','--journal','--lose-response'].includes(key), `unknown option ${key}`);
    assert.ok(!(key in out), `duplicate ${key}`);
    out[key] = key === '--lose-response' ? true : args.shift();
    assert.ok(out[key], `missing ${key}`);
  }
  assert.ok(['prepare','submit','restack','merge','resume','cleanup'].includes(out['--mode']), 'explicit --mode required');
  for (const key of ['--evidence','--binary','--gh']) assert.ok(path.isAbsolute(out[key] || ''), `${key} must be absolute`);
  if (out['--mode'] === 'merge') {
    assert.match(out['--pr'] || '', /^[1-9][0-9]*$/);
    for (const key of ['--head','--base']) assert.match(out[key] || '', /^[a-f0-9]{40}$/);
  } else assert.ok(!out['--lose-response'] && !out['--pr'] && !out['--head'] && !out['--base'], 'merge-only options');
  if (out['--mode'] === 'resume') assert.ok(path.isAbsolute(out['--journal'] || ''), '--journal required');
  else assert.ok(!out['--journal'], 'resume-only --journal');
  return out;
}
export function main(args) {
  const o = options([...args]), mode = o['--mode'], out = path.resolve(o['--evidence']);
  const binary = fs.realpathSync(o['--binary']), gh = fs.realpathSync(o['--gh']);
  for (const file of [binary, gh]) { assert.ok(fs.statSync(file).isFile()); fs.accessSync(file, fs.constants.X_OK); }
  assert.notEqual(binary, gh);
  if (mode === 'prepare') { assert.ok(!fs.existsSync(out), 'never overwrite an attempt'); fs.mkdirSync(out, { recursive: true, mode: 0o700 }); }
  assert.ok(fs.lstatSync(out).isDirectory() && !fs.lstatSync(out).isSymbolicLink());
  const stateFile = path.join(out, 'state.json'), cwd = path.join(out, 'clone'), bin = path.join(out, 'bin');
  const write = (file, data) => {
    const tmp = `${file}.${randomUUID()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); fs.renameSync(tmp, file);
  };
  let state = mode === 'prepare' ? { schemaVersion: 1, repo: REPO, out, cwd, binary, gh,
    binaryDigest: hash(binary), sourceRoot: ROOT, sourceHashes: {}, id: `${Date.now()}-${randomUUID().slice(0,8)}`,
    commands: [], phases: [], prs: [], refs: {}, mergeAttempts: [], active: null } : json(stateFile);
  const persist = () => write(stateFile, state);
  const lock = path.join(out, 'runner.lock'); fs.writeFileSync(lock, `${process.pid}\n`, { flag: 'wx', mode: 0o600 });
  try {
    assert.equal(state.repo, REPO); assert.equal(state.out, out); assert.equal(state.cwd, cwd);
    assert.equal(state.binary, binary); assert.equal(state.gh, gh); assert.equal(state.binaryDigest, hash(binary));
    const runnerDigest = hash(fileURLToPath(import.meta.url));
    if (mode === 'prepare') state.runnerDigest = runnerDigest;
    else assert.equal(state.runnerDigest,runnerDigest,'runner drift; inspect before further effects');
    for (const name of ['stack.sh','stack.mjs','stack-rebase.mjs','stack-policy.mjs','repo-policy.mjs','pr-create.sh','pr-merge.sh','verify-required-checks.mjs','check-document-sync.mjs','solo-merge.sh','stack-merge.mjs','stack-merge-cli.mjs','stack-merge-journal.mjs']) {
      const digest = hash(path.join(SCRIPTS, name));
      if (mode === 'prepare') state.sourceHashes[name] = digest;
      else assert.equal(state.sourceHashes[name], digest, `source drift: ${name}; inspect before further effects`);
    }
    assert.ok(!state.active || ['resume','cleanup'].includes(mode), 'previous interrupted phase requires inspection');
    if (['prepare','submit','restack'].includes(mode)) assert.ok(!state.phases.some(p => p.mode === mode), 'no implicit phase retry');
    state.prefix ??= `codex/g1-${state.id}`;
    const inherited = Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL','SSH_AUTH_SOCK','GH_CONFIG_DIR','GH_TOKEN','GITHUB_TOKEN'].filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
    const env = { ...inherited, PATH: `${bin}:${process.env.PATH}`, GH_HOST: 'github.com', GH_REPO: REPO,
      GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', GH_NO_EXTENSION_UPDATE_NOTIFIER: '1',
      GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0',
      GIT_AUTHOR_NAME: 'Harness adapter acceptance', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Harness adapter acceptance', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      GIT_EDITOR: 'true', GH_ADAPTER_LOSS: mode === 'merge' && o['--lose-response'] ? o['--pr'] : '' };
    const phase = { mode, startedAt: new Date().toISOString(), state: 'started' };
    state.phases.push(phase); state.active = phase; persist();
    function run(tool, argv, { input, expected = 0, directory = cwd, timeout = 120000 } = {}) {
      const row = { tool, argv, cwd: directory, input: input ?? null, startedAt: new Date().toISOString(), state: 'intent' };
      state.commands.push(row); persist();
      const r = spawnSync(tool, argv, { cwd: directory, env, input, encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024 });
      Object.assign(row, { state: commandOutcome(r), status: r.status, signal: r.signal, error: r.error?.message, stdout: r.stdout || '', stderr: r.stderr || '' });
      if (fs.existsSync(path.join(out,'unknown-child.json'))) { row.state='unknown'; row.childTermination='unverified'; }
      persist();
      assert.notEqual(row.state,'unknown','command/descendant termination unverified; preserve all resources');
      if (expected !== null) assert.equal(r.status, expected, `command failed; see state.json command ${state.commands.length - 1}`);
      return row;
    }
    const git = (...argv) => run('git', argv).stdout.trim();
    const api = (endpoint, { method = 'GET', body } = {}) => {
      assert.ok(method === 'GET' || (mode === 'cleanup' && method === 'PATCH' && /^pulls\/[1-9][0-9]*$/.test(endpoint)), 'API write outside cleanup denied');
      const argv = ['api','--hostname','github.com','--method',method,`repos/${REPO}/${endpoint}`];
      if (body) argv.push('--input','-');
      return JSON.parse(run(gh, argv, { input: body && JSON.stringify(body), directory: fs.existsSync(cwd) ? cwd : out }).stdout);
    };
    function pages(endpoint) {
      const result = run(gh, ['api','--hostname','github.com','--method','GET','--paginate','--slurp',`repos/${REPO}/${endpoint}`], { directory: fs.existsSync(cwd) ? cwd : out });
      const data = JSON.parse(result.stdout); assert.ok(data.every(Array.isArray)); return data.flat();
    }
    function inventory() {
      const branches = pages('branches?per_page=100'), rulesets = pages('rulesets?includes_parents=true&per_page=100');
      return { branches, protections: Object.fromEntries(branches.filter(b => b.protected).map(b => [b.name, api(`branches/${encodeURIComponent(b.name)}/protection`)])),
        rulesets: rulesets.map(r => ({ listing: r, definition: api(`rulesets/${r.id}`) })),
        effectiveDevelop: pages('rules/branches/develop?per_page=100') };
    }
    function policyCheck(label) {
      const current = inventory(); write(path.join(out, `${label}-${state.phases.length}.json`), current);
      assert.deepEqual(current.protections, state.before.protections, 'existing protection changed');
      assert.deepEqual(current.rulesets, state.before.rulesets, 'rulesets changed');
      assert.deepEqual(current.effectiveDevelop, state.before.effectiveDevelop, 'effective develop rules changed');
      const baseline = state.before.branches.find(b => b.name === 'develop').commit.sha;
      const live = current.branches.find(b => b.name === 'develop')?.commit.sha;
      let proof;
      if (live && live !== baseline) {
        for (const attempt of state.mergeAttempts) {
          const p = api(`pulls/${attempt.number}`);
          if (p.merged !== true || p.merge_commit_sha !== live || p.head.sha !== attempt.head) continue;
          assert.equal(p.base.ref,'develop'); assert.equal(p.base.repo.full_name,REPO); assert.equal(p.head.repo.full_name,REPO);
          assert.ok(state.prs.some(owned => owned.number === p.number && owned.branch === p.head.ref));
          const ancestry = api(`compare/${baseline}...${live}`);
          const reviewedBase = api(`compare/${attempt.base}...${live}`);
          assert.equal(ancestry.status,'ahead'); assert.equal(reviewedBase.status,'ahead');
          proof = { pr: p.number, merged: true, mergeSha: live, baseline, ancestor: true,
            reviewedBase: attempt.base, head: attempt.head, ancestry, reviewedBaseAncestry: reviewedBase };
          state.developProofs ??= []; state.developProofs.push(proof); persist(); break;
        }
      }
      assertBranchPreservation(state.before.branches,current.branches,proof);
      return current;
    }
    function ownedInventory() {
      for (const branch of ['a','b','c'].map(x => `${state.prefix}/${x}`)) {
        recordRefObservation(state,branch,git('rev-parse', `refs/heads/${branch}`)); persist();
        const prs = api(`pulls?state=all&head=${encodeURIComponent('grinvi04:' + branch)}&per_page=100`);
        assert.ok(prs.length <= 1, 'ambiguous owned PR');
        if (prs.length) {
          const p = prs[0]; assert.equal(p.head.repo.full_name, REPO); assert.equal(p.head.ref, branch);
          const entry = { number: p.number, branch, head: p.head.sha, url: p.html_url, base: p.base.ref, merged: p.merged_at !== null, state: p.state };
          const index = state.prs.findIndex(old => old.number === p.number);
          if (index < 0) { state.prs.push(entry); console.log(`CREATED_PR ${p.html_url}`); } else state.prs[index] = entry;
          persist();
        }
      }
    }
    const journalDir = path.join(cwd, '.git/harness-stack-merges');
    function journals() {
      if (!fs.existsSync(journalDir)) return [];
      return fs.readdirSync(journalDir).filter(n => n.endsWith('.json')).map(n => ({ file: path.join(journalDir,n), data: json(path.join(journalDir,n)) }));
    }
    function adapter(action, extra = []) {
      const preview = JSON.parse(run('bash', [path.join(SCRIPTS,'stack.sh'), action, ...extra]).stdout);
      assert.equal(preview.state,'preview'); write(path.join(out, `${action}-preview.json`), preview);
      const result = run('bash', [path.join(SCRIPTS,'stack.sh'), action, ...extra, '--apply','--expected',preview.fingerprint], { expected: null });
      // Preserve partially created real PRs even when the adapter did not return success.
      ownedInventory(); const data = JSON.parse(result.stdout); write(path.join(out, `${action}-result.json`), data);
      // Only a confirmed adapter effect can advance deletion authority. A readback alone
      // never turns an externally moved ref into an owned effect, including partial failure.
      if (result.status === 0 && data.state === 'confirmed' && action === 'restack') {
        const confirmed = data.snapshot.layers;
        assert.deepEqual(confirmed.map(l => l.branch),state.layers.map(l => l.branch));
        for (const layer of confirmed) {
          assert.equal(layer.headOid,layer.remoteOid);
          state.refs[layer.branch] = layer.headOid;
        }
        state.confirmedEffects ??= []; state.confirmedEffects.push({action,journal:data.journal,refs:{...state.refs}}); persist();
      }
      assert.equal(result.status, 0); assert.equal(data.state, 'confirmed'); return data;
    }
    if (mode === 'prepare') {
      state.sourceHead = run('git',['rev-parse','HEAD'],{directory:ROOT}).stdout.trim(); persist();
      fs.mkdirSync(bin, { mode: 0o700 });
      const launcher = `#!${process.execPath}\nconst fs=require('node:fs'),cp=require('node:child_process'),a=process.argv.slice(2);\nconst log=${JSON.stringify(path.join(out,'gh-commands.jsonl'))};\nconst unknown=${JSON.stringify(path.join(out,'unknown-child.json'))};\nfunction finish(r){if(r.error||r.signal||!Number.isInteger(r.status))fs.writeFileSync(unknown,JSON.stringify({status:r.status,signal:r.signal,error:r.error?.message}),{mode:384});process.exit(r.status??1)}\nfs.appendFileSync(log,JSON.stringify({at:new Date().toISOString(),args:a})+'\\n');\nif(a[0]==='stack'){const r=cp.spawnSync(${JSON.stringify(binary)},a.slice(1),{stdio:'inherit'});finish(r)}\nconst loss=process.env.GH_ADAPTER_LOSS,endpoint='repos/${REPO}/pulls/'+loss+'/merge-async';\nif(loss&&a[0]==='api'&&a.includes(endpoint)&&a[a.indexOf('--method')+1]==='PUT'){\n const marker=${JSON.stringify(path.join(out,'lost-reply-'))}+loss+'.json';\n if(fs.existsSync(marker)){console.error('refusing another response-loss PUT');process.exit(76)}\n fs.writeFileSync(marker,JSON.stringify({state:'intent',args:a}),{flag:'wx',mode:384});\n const input=a.includes('--input')?fs.readFileSync(0):undefined;\n const r=cp.spawnSync(${JSON.stringify(gh)},a,{input,encoding:'utf8',timeout:9000,maxBuffer:4194304});\n fs.writeFileSync(marker,JSON.stringify({state:'reply-withheld',args:a,status:r.status,signal:r.signal,error:r.error?.message,stdout:r.stdout,stderr:r.stderr}));if(r.error||r.signal||!Number.isInteger(r.status))finish(r);process.exit(75)\n}\nconst r=cp.spawnSync(${JSON.stringify(gh)},a,{stdio:'inherit'});finish(r);\n`;
      fs.writeFileSync(path.join(bin,'gh'), launcher, { mode: 0o700, flag:'wx' });
      assert.match(run(binary,['--version'],{ directory: out }).stdout, /^gh stack version 0\.2\.1(?:\s|$)/);
      state.before = inventory(); persist(); write(path.join(out,'before.json'), state.before);
      assert.ok(!state.before.branches.some(b => b.name.startsWith(state.prefix + '/')));
      run('git',['clone','--origin','origin','--branch','develop',`https://github.com/${REPO}.git`,cwd],{directory:out});
      assert.equal(git('remote','get-url','origin'), `https://github.com/${REPO}.git`);
      const policyFile = path.join(cwd,'.harness-policy.json');
      const trackedPolicy = git('ls-files','.harness-policy.json') === '.harness-policy.json';
      let selectedPolicy;
      if (trackedPolicy) {
        assert.ok(fs.lstatSync(policyFile).isFile() && !fs.lstatSync(policyFile).isSymbolicLink());
        const original = fs.readFileSync(policyFile,'utf8');
        fs.writeFileSync(path.join(out,'policy-original.json'),original,{mode:0o600,flag:'wx'});
        selectedPolicy = stackPolicy(JSON.parse(original));
        state.policy = { tracked: true, original, selected: selectedPolicy }; persist();
      } else {
        assert.ok(!fs.existsSync(policyFile), 'preserve an unexpected untracked policy');
        fs.appendFileSync(path.join(cwd,'.git/info/exclude'),'\n/.harness-policy.json\n');
        selectedPolicy = {schemaVersion:1,mode:'company',autoMergeTargets:[],branchFlow:'git-flow',stackedPRs:{enabled:true,provider:'github-gh-stack'}};
        fs.writeFileSync(policyFile,JSON.stringify(selectedPolicy,null,2)+'\n');
        state.policy = { tracked: false, selected: selectedPolicy }; persist();
      }
      const quotedGh = "'" + gh.replaceAll("'", "'\\''") + "'";
      git('config','--local','credential.https://github.com.helper',`!${quotedGh} auth git-credential`);
      state.layers = [];
      for (const [i, name] of ['a','b','c'].entries()) {
        run('gh', i === 0 ? ['stack','init','--base','develop',`${state.prefix}/${name}`] : ['stack','add',`${state.prefix}/${name}`]);
        if (i === 0 && trackedPolicy) {
          fs.writeFileSync(policyFile,JSON.stringify(selectedPolicy,null,2)+'\n');
          const diff = git('diff','--','.harness-policy.json');
          fs.writeFileSync(path.join(out,'policy-opt-in.diff'),diff+'\n',{mode:0o600,flag:'wx'});
          git('add','--','.harness-policy.json');
        }
        const file = `adapter-${state.id}-${name}.txt`; fs.writeFileSync(path.join(cwd,file),`Synthetic adapter acceptance ${name}\n`);
        git('add','--',file); git('commit','-m',`test(lab): adapter ${name} 합성 변경`);
        const bodyFile = path.join(out,`body-${name}.md`);
        fs.writeFileSync(bodyFile,`Synthetic disposable acceptance layer ${name}.\nUnique file: ${file}.\nScope: adapter/GitHub workflow only; no deployment or production data.\n`);
        state.layers.push({branch:`${state.prefix}/${name}`,title:`test(lab): adapter ${state.id} ${name}`,bodyFile});
        state.refs[`${state.prefix}/${name}`] = git('rev-parse','HEAD'); persist();
      }
      write(path.join(out,'submit-plan.json'),{schemaVersion:1,layers:state.layers});
      policyCheck('prepared-policy');
    } else {
      assert.equal(git('remote','get-url','origin'),`https://github.com/${REPO}.git`);
      policyCheck('before-policy');
      if (mode === 'submit') {
        assert.ok(state.phases.some(p => p.mode === 'prepare' && p.state === 'confirmed'));
        adapter('submit',['--plan',path.join(out,'submit-plan.json')]);
      } else if (mode === 'restack') {
        assert.equal(state.prs.length,3); assert.equal(state.mergeAttempts.length,0);
        git('switch',`${state.prefix}/a`);
        const file=`adapter-${state.id}-lower-update.txt`; fs.writeFileSync(path.join(cwd,file),'Synthetic lower-layer amendment\n');
        git('add','--',file); git('commit','-m','test(lab): 하단 변경 재기반 관찰'); git('switch',`${state.prefix}/c`);
        adapter('restack');
      } else if (mode === 'merge') {
        const number = Number(o['--pr']); assert.ok(state.prs.some(p => p.number === number));
        assert.ok(!state.mergeAttempts.some(p => p.number === number), 'never resubmit an attempted PR; inspect/resume journal');
        assert.ok(!journals().some(j => !path.basename(j.file).startsWith('archive-')), 'active merge reservation');
        const p = api(`pulls/${number}`); assert.equal(p.head.sha,o['--head']); assert.equal(p.base.ref,'develop');
        assert.equal(p.head.repo.full_name,REPO); assert.ok(p.head.ref.startsWith(state.prefix+'/'));
        assert.equal(api('git/ref/heads/develop').object.sha,o['--base']); assert.equal(p.draft,false);
        state.mergeAttempts.push({number,head:o['--head'],base:o['--base'],loss:!!o['--lose-response'],state:'intent'}); persist();
        const result = run('bash',[path.join(SCRIPTS,'pr-merge.sh'),String(number),'--base','develop','--expected-head',o['--head'],'--expected-base-oid',o['--base']],{expected:null});
        state.mergeAttempts.at(-1).status=result.status; state.mergeAttempts.at(-1).journals=journals(); persist();
        if (o['--lose-response']) assert.ok(fs.existsSync(path.join(out,`lost-reply-${number}.json`)), 'gate did not reach controlled loss');
        ownedInventory(); if (result.status !== 0) phase.state='unverified';
      } else if (mode === 'resume') {
        const file=fs.realpathSync(o['--journal']); assert.equal(path.dirname(file),fs.realpathSync(journalDir));
        const record=json(file); assert.equal(record.snapshot.repo,REPO); assert.ok(state.prs.some(p => p.number===record.snapshot.pr));
        const result=run(process.execPath,[path.join(SCRIPTS,'stack-merge-cli.mjs'),'resume',file],{expected:null});
        state.lastResume={file,status:result.status,journals:journals()}; persist(); ownedInventory();
        if(result.status!==0) phase.state='unverified';
      } else if (mode === 'cleanup') {
        const active=journals().filter(j => !path.basename(j.file).startsWith('archive-'));
        assertCleanupSafe(state,active);
        // Internal adapter timeouts can return an ordinary exit 1 to this runner.
        // The adapter's own effect journal remains authoritative for uncertainty.
        state.cleanupStackEffects = inspectStackEffects(path.join(cwd,'.git/harness-stack'),
          { repo: REPO, root: cwd, trunk: 'develop', prefix: state.prefix }); persist();
        ownedInventory();
        const observedRefs = Object.fromEntries(Object.keys(state.refs).map(branch => {
          const remote = git('ls-remote','--heads','origin',`refs/heads/${branch}`);
          return [branch,remote ? remote.split('\t')[0] : null];
        }));
        assertOwnedRefs(state.refs,observedRefs);
        for(const owned of [...state.prs].reverse()) {
          const p=api(`pulls/${owned.number}`); assert.equal(p.head.ref,owned.branch); assert.equal(p.head.repo.full_name,REPO);
          assert.equal(p.head.sha,state.refs[owned.branch]);
          if(p.state==='open') api(`pulls/${owned.number}`,{method:'PATCH',body:{state:'closed'}});
          assert.equal(api(`pulls/${owned.number}`).state,'closed');
        }
        for(const [branch,oid] of Object.entries(state.refs).reverse()) {
          assert.ok(branch.startsWith(state.prefix+'/')); assert.ok(!state.before.branches.some(b => b.name===branch));
          const remote=git('ls-remote','--heads','origin',`refs/heads/${branch}`);
          if(!remote) continue;
          assert.equal(remote.split('\t')[0],oid,'ref moved; preserve other writer');
          git('push',`--force-with-lease=refs/heads/${branch}:${oid}`,'origin',`:refs/heads/${branch}`);
          assert.equal(git('ls-remote','--heads','origin',`refs/heads/${branch}`),'');
        }
      }
      policyCheck('after-policy');
    }
    phase.state = phase.state === 'unverified' ? 'unverified' : 'confirmed'; phase.finishedAt=new Date().toISOString(); state.active=null; persist();
    console.log(JSON.stringify({mode,state:phase.state,evidence:out,prs:state.prs.map(p=>p.url),journals:mode==='prepare'?[]:journals()},null,2));
    if(phase.state!=='confirmed') process.exitCode=1;
  } catch(error) {
    if(state.active) { state.active.state='unverified'; state.active.reason=error.message; }
    persist(); throw error;
  } finally { fs.unlinkSync(lock); }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch(error) { console.error(`stack adapter acceptance: ${error.message}`); process.exitCode=1; }
}

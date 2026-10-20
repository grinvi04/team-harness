import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { spawnSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const script = path.join(root, 'plugins/harness-guard/scripts/pr-merge.sh')
const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40), d = 'd'.repeat(40)
function fixture(t, scenario, solo = false, flow = 'git-flow') {
  const trunk = flow === 'main' ? 'main' : 'develop'
  const dir = mkdtempSync(path.join(tmpdir(), 'stack-merge-wrapper-')), bin = path.join(dir, 'bin')
  t.after(() => rmSync(dir, { recursive: true, force: true })); mkdirSync(bin)
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FIXTURE_DIR: dir, SCENARIO: scenario,
    HARNESS_STACK_WAIT_MS: '1000', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
  for (const args of [['init', '-q'], ['remote', 'add', 'origin', 'https://github.com/test/repo.git']])
    assert.equal(spawnSync('git', args, { cwd: dir, env }).status, 0)
  writeFileSync(path.join(dir, '.harness-policy.json'), JSON.stringify({ schemaVersion: 1, mode: solo ? 'solo' : 'company',
    autoMergeTargets: ['develop'], branchFlow: flow, stackedPRs: { enabled: true, provider: 'github-gh-stack' } }))
  writeFileSync(path.join(bin, 'gh'), `#!${process.execPath}
const fs=require('fs'),path=require('path');const dir=process.env.FIXTURE_DIR,s=process.env.SCENARIO,args=process.argv.slice(2);
fs.appendFileSync(path.join(dir,'calls'),JSON.stringify(args)+'\\n');
const trunk=${JSON.stringify(trunk)};const a='a'.repeat(40),b='b'.repeat(40),c='c'.repeat(40),d='d'.repeat(40),ref={full_name:'test/repo'};
const promoted=s==='promoted-missing-required-ci',missing=s==='missing-required-ci'||promoted,fresh='e'.repeat(40);
const mutated=fs.existsSync(path.join(dir,'gate'))&&s==='head-drift';
const pr=n=>({number:n,html_url:'https://github.com/test/repo/pull/'+n,state:promoted&&n===42?'closed':'open',draft:false,merged:promoted&&n===42,
...(promoted&&n===42?{merged_at:'2026-10-16T00:00:00Z',merge_commit_sha:b}:{}),
head:{ref:n===42?'codex/a':'codex/b',sha:promoted&&n===43?fresh:mutated?c:n===42?a:c,repo:s.startsWith('single-fork')?{full_name:'contributor/fork'}:ref},
base:{ref:n===42||promoted?trunk:'codex/a',sha:n===42||promoted?b:a,repo:ref},
stack:{id:1,number:44,position:n===42?1:2,size:2,base:{ref:trunk,sha:b}}});
function emit(value,status=200){if(args.includes('--include'))console.log('HTTP/2 '+status+' X\\ncontent-type: application/json\\n');console.log(JSON.stringify(value))}
if(args[0]==='repo'){console.log('test/repo');process.exit(0)}
if(args[0]==='pr'){
if(args[1]==='merge'){
 const jd=path.join(dir,'.git/harness-stack-merges');
 const journals=fs.existsSync(jd)?fs.readdirSync(jd).filter(n=>/^[a-f0-9]{64}\\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(jd,n)))):[];
 fs.writeFileSync(path.join(dir,'intent-before-request'),JSON.stringify(journals.some(j=>j.requestStarted===true)));
 fs.writeFileSync(path.join(dir,'legacy-merge'),'yes');
 if(s.startsWith('single-lost')){process.stderr.write('lost response');process.exit(1)}process.exit(0)}
if(args[1]==='checks'){emit([{name:missing?'unrelated':'quality',bucket:'pass'}]);process.exit(0)}
const n=Number(args[2]),p=pr(n),f=args[args.indexOf('--json')+1];
if(f==='mergeable'){fs.writeFileSync(path.join(dir,'gate'),'yes');console.log('MERGEABLE')}
else if(f==='number'){
 if(args[2]!=='codex/a'||args[args.indexOf('--repo')+1]!=='test/repo'){process.stderr.write('argument required when using the --repo flag');process.exit(1)}
 if(s==='single-selection-query-fail'){process.stderr.write('PR lookup failed');process.exit(1)}console.log(42);
}
else if(f==='baseRefName')console.log(p.base.ref);
else if(f==='state')console.log('MERGED');
else if(f.includes(','))emit({baseRefName:p.base.ref,baseRefOid:p.base.sha,headRefName:p.head.ref,headRefOid:p.head.sha});
else console.log(p[f]||'');process.exit(0)}
const ep=args.find(x=>x.startsWith('repos/'));const method=args.includes('--method')?args[args.indexOf('--method')+1]:args.includes('-X')?args[args.indexOf('-X')+1]:'GET';
if(args.includes('graphql')){emit({data:{repository:{pullRequest:{reviewThreads:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}}}}});process.exit(0)}
if(!ep)throw Error('no endpoint '+args);
if(ep==='repos/test/repo')emit({owner:{type:'User',login:'test'}});
else if(ep.endsWith('/collaborators'))emit([[{login:'test'}]]);
else if(ep.includes('/rules/branches/'))emit(s==='policy-queue'?[{type:'merge_queue'}]:[]);
else if(ep.endsWith('/protection/required_pull_request_reviews')){
  if(method==='DELETE')fs.writeFileSync(path.join(dir,'unprotected'),'yes');
  else if(method==='PATCH'){fs.readFileSync(0,'utf8');if(s==='signal'&&!fs.existsSync(path.join(dir,'provider-stopped')))throw Error('restoration started before provider stopped');if(s!=='restore-fail')fs.rmSync(path.join(dir,'unprotected'),{force:true})}
  else throw Error('unexpected protection write');emit({});
}else if(ep.endsWith('/protection'))emit({required_pull_request_reviews:fs.existsSync(path.join(dir,'unprotected'))?null:{required_approving_review_count:1,dismiss_stale_reviews:true},enforce_admins:{enabled:true},allow_force_pushes:{enabled:false}});
else if(ep.endsWith('/required_status_checks'))emit({strict:true,contexts:['quality'],checks:[{context:'quality',app_id:1}]});
else if(ep.endsWith('/check-runs'))emit([{check_runs:[{id:1,name:missing?'unrelated':'quality',head_sha:promoted?fresh:a,status:'completed',conclusion:'success',app:{id:1}}]}]);
else if(ep.endsWith('/statuses'))emit([[]]);
else if(ep.includes('/git/ref/heads/')){if(args.includes('--jq'))console.log(b);else emit({object:{sha:fs.existsSync(path.join(dir,'put'))?d:b}})}
else if(ep.includes('/compare/'))emit({status:s==='single-not-contained'?'diverged':'identical'});
else if(ep.endsWith('/stacks/44'))emit({id:1,number:44,open:true,base:{ref:trunk},pull_requests:[pr(42),pr(43)]});
else if(ep.includes('/merge-async')){
if(method==='PUT'){fs.writeFileSync(path.join(dir,'put'),fs.readFileSync(0,'utf8'));if(s==='lost'){process.stderr.write('lost response');process.exit(1)}}
if(s==='signal'&&method==='PUT'){
  fs.writeFileSync(path.join(dir,'provider-pid'),String(process.pid));
  process.on('SIGTERM',()=>{fs.writeFileSync(path.join(dir,'provider-stopped'),'yes');process.exit(143)});
  setInterval(()=>{},1000);return;
}
if(s==='queue')emit({status:'enqueued',details:{message:'queued'}});
else if(s==='pending')emit({status:'pending',details:{uuid:'0520634a-aa51-44b8-b653-85c35538485a',expected_head_sha:a,merge_method:'merge',merge_action:'default'}});
else emit({status:'merged',details:{sha:d}});
}else if(/\\/pulls\\/\\d+$/.test(ep)){
const p=pr(Number(ep.split('/').at(-1)));if(s.startsWith('single')){delete p.stack;if(fs.existsSync(path.join(dir,'legacy-merge'))&&s!=='single-lost-open'){p.state='closed';p.merged=true;p.merge_commit_sha=d;if(s==='single-wrong-head')p.head.sha=c;if(s==='single-fork-wrong-repo')p.head.repo={full_name:'other/fork'}}}
if(fs.existsSync(path.join(dir,'put'))&&!['lost','queue'].includes(s)){p.state='closed';p.merged=true;p.merge_commit_sha=d}
emit(p);
}else throw Error('unexpected '+args);
`); spawnSync('chmod', ['+x', path.join(bin, 'gh')])
  const target = solo ? path.join(root, 'plugins/harness-guard/scripts/solo-merge.sh') : script
  const run = (...args) => spawnSync('bash', [target, ...args], { cwd: dir, env, encoding: 'utf8', timeout: 12000 })
  const calls = () => readFileSync(path.join(dir, 'calls'), 'utf8').trim().split('\n').map(JSON.parse)
  const journals = () => { const d = path.join(dir, '.git/harness-stack-merges'); return existsSync(d) ? readdirSync(d)
    .filter(file => file.endsWith('.json') && !file.startsWith('archive-')).map(file => JSON.parse(readFileSync(path.join(d, file)))) : [] }
  return { dir, run, calls, journals, target, env }
}
for (const [scenario, args] of [['upper', ['43']], ['auto', ['42', '--auto']], ['head-drift', ['42']]]) {
  test(`${scenario} refuses before either merge provider`, t => {
    const f = fixture(t, scenario), r = f.run(...args)
    assert.notEqual(r.status, 0, r.stdout + r.stderr)
    assert.equal(f.calls().filter(c => c[0] === 'pr' && c[1] === 'merge' || c.includes('PUT')).length, 0)
  })
}
test('lowest linked PR uses existing gates then SHA-bound async provider and preserves dependent branches', t => {
  const f = fixture(t, 'normal'), r = f.run('42')
  assert.equal(r.status, 0, r.stdout + r.stderr)
  const calls = f.calls(), put = calls.findIndex(c => c.includes('PUT'))
  assert.ok(put > calls.findIndex(c => c[0] === 'pr' && c[1] === 'checks'))
  assert.ok(put > calls.findIndex(c => c.includes('graphql')))
  assert.equal(calls.filter(c => c[0] === 'pr' && c[1] === 'merge').length, 0)
  assert.deepEqual(JSON.parse(readFileSync(path.join(f.dir, 'put'))), { sha: a, merge_method: 'merge', merge_action: 'default' })
  assert.doesNotMatch(r.stdout, /원격 브랜치 삭제 확인|로컬 브랜치 삭제 확인/)
})
for (const scenario of ['queue', 'lost']) test(`${scenario} is incomplete and a second merge cannot submit again`, t => {
  const f = fixture(t, scenario), first = f.run('42'), second = f.run('42')
  assert.notEqual(first.status, 0, first.stdout + first.stderr); assert.notEqual(second.status, 0)
  assert.equal(f.calls().filter(c => c.includes('PUT')).length, 1)
  assert.doesNotMatch(first.stdout, /✅ PR #42 머지 완료/)
})
test('unlinked PR preserves existing synchronous provider', t => {
  const f = fixture(t, 'single'), r = f.run('42')
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.equal(f.calls().filter(c => c[0] === 'pr' && c[1] === 'merge').length, 1)
  assert.equal(f.calls().filter(c => c.includes('PUT')).length, 0)
})
test('solo linked merge restores the exact protection and archives the completed request', t => {
  const f = fixture(t, 'normal', true), r = f.run('42')
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.equal(existsSync(path.join(f.dir, 'unprotected')), false); assert.deepEqual(f.journals(), [])
  assert.equal(f.calls().filter(c => c.includes('DELETE')).length, 1)
  assert.equal(f.calls().filter(c => c.includes('PATCH')).length, 1)
})
for (const scenario of ['policy-queue', 'upper']) test(`solo ${scenario} is refused without opening a protection exception`, t => {
  const f = fixture(t, scenario, true), r = f.run(scenario === 'upper' ? '43' : '42')
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.equal(f.calls().filter(c => c.includes('DELETE') || c.includes('PUT')).length, 0)
})
for (const scenario of ['pending', 'lost', 'restore-fail']) test(`solo ${scenario} retains the same-base reservation and refuses another exception`, t => {
  const f = fixture(t, scenario, true), first = f.run('42'), second = f.run('42')
  assert.notEqual(first.status, 0, first.stdout + first.stderr); assert.notEqual(second.status, 0)
  assert.equal(f.calls().filter(c => c.includes('DELETE')).length, 1)
  assert.equal(f.calls().filter(c => c.includes('PUT')).length, 1)
  const journals = f.journals(); assert.equal(journals.length, 1)
  assert.equal(journals[0].protection.required_pull_request_reviews.required_approving_review_count, 1)
  assert.equal(journals[0].restored, scenario !== 'restore-fail')
  assert.equal(existsSync(path.join(f.dir, 'unprotected')), scenario === 'restore-fail')
})
test('TERM during a live provider stops the owned child before restoring solo protection', { timeout: 15000 }, async t => {
  const f = fixture(t, 'signal', true), child = spawn('bash', [f.target, '42'], { cwd: f.dir,
    env: { ...f.env, HARNESS_STACK_WAIT_MS: '10000' }, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''; child.stdout.on('data', d => { output += d }); child.stderr.on('data', d => { output += d })
  t.after(() => { if (child.exitCode === null) child.kill('SIGTERM') })
  const exit = once(child, 'exit'), deadline = Date.now() + 8000
  while (!existsSync(path.join(f.dir, 'provider-pid')) && Date.now() < deadline) await delay(20)
  assert.ok(existsSync(path.join(f.dir, 'provider-pid')), output)
  child.kill('SIGTERM'); const [code] = await exit
  assert.equal(code, 143, output); assert.ok(existsSync(path.join(f.dir, 'provider-stopped')), output)
  assert.equal(existsSync(path.join(f.dir, 'unprotected')), false, output)
  assert.equal(f.journals()[0].requestStarted, true); assert.equal(f.journals()[0].restored, true)
  const pid = Number(readFileSync(path.join(f.dir, 'provider-pid'), 'utf8'))
  assert.throws(() => process.kill(pid, 0), 'the child must no longer be alive after restoration')
})
for (const solo of [false, true]) test(`host override cannot lend its successful gates to a github.com ${solo ? 'solo exception' : 'merge'}`, t => {
  const f = fixture(t, 'normal', solo)
  // The fake has the same identity/OIDs and successful gates on both hosts.
  // A wrapper must refuse the unsupported host before either side is mutated.
  const r = spawnSync('bash', [f.target, '42'], { cwd: f.dir, env: { ...f.env, GH_HOST: 'git.example.test' }, encoding: 'utf8' })
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  const calls = existsSync(path.join(f.dir, 'calls')) ? f.calls() : []
  assert.equal(calls.filter(c => c.includes('DELETE') || c.includes('PUT') || c[0] === 'pr' && c[1] === 'merge').length, 0)
})

for (const solo of [false, true]) test(`linked missing required CI blocks ${solo ? 'solo' : 'company'} merge before provider`, t => {
  const f = fixture(t, 'missing-required-ci', solo), r = f.run('42')
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout + r.stderr, /required CI UNVERIFIED: missing required: quality/)
  assert.ok(f.calls().some(c => c.some(a => a.endsWith('/required_status_checks'))), 'live required-set endpoint was observed')
  assert.equal(f.calls().filter(c => c.includes('PUT') || c[0] === 'pr' && c[1] === 'merge').length, 0)
  assert.equal(f.calls().filter(c => c.includes('DELETE')).length, 0, 'missing CI must not open a solo protection exception')
  assert.equal(existsSync(path.join(f.dir, 'unprotected')), false)
})
for (const solo of [false, true]) test(`promoted upper fresh-head CI is required before ${solo ? 'solo' : 'company'} merge`, t => {
  const f = fixture(t, 'promoted-missing-required-ci', solo), r = f.run('43')
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout + r.stderr, /required CI UNVERIFIED: missing required: quality/)
  const calls = f.calls(), fresh = 'e'.repeat(40), previousHead = 'c'.repeat(40)
  assert.ok(calls.some(c => c.some(a => a.endsWith('/required_status_checks'))))
  assert.ok(calls.some(c => c.some(a => a.includes(`/commits/${fresh}/check-runs`))), 'required CI must inspect the retargeted upper candidate head')
  assert.equal(calls.some(call => call.some(arg => arg.includes(`/commits/${previousHead}/check-runs`))), false, 'previous upper CI cannot authorize the rewritten candidate')
  assert.equal(calls.filter(c => c.includes('DELETE') || c.includes('PUT') || c[0] === 'pr' && c[1] === 'merge').length, 0)
  assert.equal(existsSync(path.join(f.dir, 'unprotected')), false)
})
for (const solo of [false, true]) test(`main-flow linked ${solo ? 'solo' : 'company'} merge gates main and preserves dependent refs`, t => {
  const f = fixture(t, 'normal', solo, 'main')
  const gitEnv = { ...f.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' }
  const tree = spawnSync('git', ['mktree'], { cwd: f.dir, env: gitEnv, input: '', encoding: 'utf8' })
  assert.equal(tree.status, 0)
  const commit = spawnSync('git', ['commit-tree', tree.stdout.trim(), '-m', 'fixture'], { cwd: f.dir, env: gitEnv, encoding: 'utf8' })
  assert.equal(commit.status, 0)
  for (const branch of ['main', 'codex/a', 'codex/b']) assert.equal(spawnSync('git', ['update-ref', `refs/heads/${branch}`, commit.stdout.trim()], { cwd: f.dir, env: gitEnv }).status, 0)
  const refs = () => spawnSync('git', ['show-ref'], { cwd: f.dir, env: gitEnv, encoding: 'utf8' }).stdout
  const before = refs()
  const r = f.run('42')
  assert.equal(r.status, 0, r.stdout + r.stderr)
  const calls = f.calls(), protection = calls.filter(c => c.some(a => a.includes('/branches/') || a.includes('/rules/branches/')))
  assert.ok(protection.some(c => c.some(a => a.includes('/branches/main/'))))
  assert.equal(protection.some(c => c.some(a => a.includes('/branches/develop/'))), false)
  assert.equal(refs(), before, 'all local stack refs survive linked merge cleanup')
  assert.equal(calls.filter(c => c.includes('PUT')).length, 1)
  assert.equal(calls.filter(c => c[0] === 'pr' && c[1] === 'merge').length, 0)
  assert.doesNotMatch(r.stdout, /원격 브랜치 삭제 확인|로컬 브랜치 삭제 확인/)
  assert.equal(existsSync(path.join(f.dir, 'unprotected')), false)
  if (solo) {
    assert.equal(calls.filter(c => c.includes('DELETE')).length, 1)
    assert.equal(calls.filter(c => c.includes('PATCH')).length, 1)
    assert.deepEqual(f.journals(), [], 'confirmed main-flow solo request releases its reservation')
  }
})

for (const scenario of ['single-lost-open', 'single-wrong-head', 'single-not-contained']) test(`ordinary solo ${scenario} retains reservation and refuses another exception`, t => {
  const f = fixture(t, scenario, true), first = f.run('42');
  assert.notEqual(first.status, 0, first.stdout + first.stderr);
  assert.equal(existsSync(path.join(f.dir, 'unprotected')), false, 'entire protection readback was restored');
  const journals = f.journals(); assert.equal(journals.length, 1, 'unknown or mismatched actual result retains the base reservation');
  assert.equal(journals[0].requestStarted, true); assert.equal(journals[0].restored, true);
  const second = f.run('42'); assert.notEqual(second.status, 0);
  const calls = f.calls();
  assert.equal(calls.filter(c => c.includes('DELETE')).length, 1, 'no second protection exception');
  assert.equal(calls.filter(c => c[0] === 'pr' && c[1] === 'merge').length, 1, 'no resubmission');
});
for (const scenario of ['single', 'single-lost-merged']) test(`ordinary solo ${scenario} releases only after matching actual merge and trunk containment`, t => {
  const f = fixture(t, scenario, true), r = f.run('42');
  assert.equal(r.status, scenario === 'single' ? 0 : 1, r.stdout + r.stderr);
  assert.equal(readFileSync(path.join(f.dir, 'intent-before-request'), 'utf8'), 'true', 'intent must be durable before sending a merge request');
  assert.equal(existsSync(path.join(f.dir, 'unprotected')), false);
  assert.deepEqual(f.journals(), []);
  const dir = path.join(f.dir, '.git/harness-stack-merges');
  const receipts = readdirSync(dir).filter(n => n.startsWith('archive-')).map(n => JSON.parse(readFileSync(path.join(dir,n))));
  assert.equal(receipts.length, 1); assert.equal(receipts[0].state, 'merged');
  assert.equal(receipts[0].mergeSha, d); assert.equal(receipts[0].restored, true);
});

for (const scenario of ['single-fork', 'single-fork-wrong-repo']) test(`ordinary solo ${scenario} compares the reserved head repository`, t => {
  const f = fixture(t, scenario, true), r = f.run('42');
  assert.equal(existsSync(path.join(f.dir, 'unprotected')), false);
  if (scenario === 'single-fork') {
    assert.equal(r.status, 0, r.stdout + r.stderr); assert.deepEqual(f.journals(), []);
  } else {
    assert.notEqual(r.status, 0); assert.equal(f.journals().length, 1);
    assert.equal(f.journals()[0].requestStarted, true); assert.equal(f.journals()[0].restored, true);
    assert.notEqual(f.run('42').status, 0);
    assert.equal(f.calls().filter(c => c.includes('DELETE')).length, 1);
    assert.equal(f.calls().filter(c => c[0] === 'pr' && c[1] === 'merge').length, 1);
  }
});

for (const solo of [false, true]) {
  test(`omitted PR resolves current branch with repository binding before ${solo ? 'solo' : 'ordinary'} merge`, t => {
    const f = fixture(t, 'single', solo);
    assert.equal(spawnSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/codex/a'], { cwd: f.dir, env: f.env }).status, 0);
    const r = f.run(); assert.equal(r.status, 0, r.stdout + r.stderr);
    const calls = f.calls(), lookup = calls.findIndex(c => c[0] === 'pr' && c.includes('number'));
    assert.deepEqual(calls[lookup], ['pr', 'view', 'codex/a', '--repo', 'test/repo', '--json', 'number', '--jq', '.number']);
    assert.ok(calls.findIndex(c => c[0] === 'pr' && c[1] === 'merge') > lookup);
    assert.equal(existsSync(path.join(f.dir, 'unprotected')), false); assert.deepEqual(f.journals(), []);
  });
  test(`failed PR lookup refuses ${solo ? 'solo' : 'ordinary'} merge without protection writes`, t => {
    const f = fixture(t, 'single-selection-query-fail', solo);
    assert.equal(spawnSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/codex/a'], { cwd: f.dir, env: f.env }).status, 0);
    const r = f.run(); assert.notEqual(r.status, 0); assert.match(r.stderr, /PR lookup failed/);
    assert.equal(f.calls().filter(c => c.includes('DELETE') || c.includes('PATCH') || c[0] === 'pr' && c[1] === 'merge').length, 0);
    assert.deepEqual(f.journals(), []);
  });
  test(`detached HEAD requires explicit PR for ${solo ? 'solo' : 'ordinary'} merge`, t => {
    const f = fixture(t, 'single', solo);
    const env = { ...f.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
    const commit = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '--allow-empty', '-qm', 'fixture'], { cwd: f.dir, env });
    assert.equal(commit.status, 0, String(commit.stderr));
    assert.equal(spawnSync('git', ['checkout', '--detach', '-q'], { cwd: f.dir, env }).status, 0);
    const r = f.run(); assert.notEqual(r.status, 0); assert.match(r.stderr, /PR 번호.*명시/);
    assert.equal(f.calls().filter(c => c.includes('DELETE') || c.includes('PATCH') || c[0] === 'pr' && c[1] === 'merge').length, 0);
    assert.deepEqual(f.journals(), []);
    const explicit = f.run('42'); assert.equal(explicit.status, 0, explicit.stdout + explicit.stderr);
    assert.equal(existsSync(path.join(f.dir, 'unprotected')), false);
  });
}

// Real Git commits/worktrees and real Harness wrapper; only GitHub/extension IO is doubled.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
const scripts = fileURLToPath(new URL('../plugins/harness-guard/scripts/', import.meta.url))
const git = execFileSync('which', ['git'], { encoding: 'utf8' }).trim()
function fixture(t, change = () => {}, trackedBodies = false) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'stack-cli-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const repo = path.join(dir, 'repo'), origin = path.join(dir, 'origin'), bin = path.join(dir, 'bin')
  fs.mkdirSync(repo); fs.mkdirSync(bin)
  const runGit = (...args) => execFileSync(git, args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  runGit('init', '-b', 'develop'); runGit('config', 'user.email', 'fixture@example.invalid'); runGit('config', 'user.name', 'Fixture')
  fs.writeFileSync(path.join(repo, '.harness-policy.json'), JSON.stringify({ schemaVersion: 1, mode: 'company', autoMergeTargets: [], branchFlow: 'git-flow', stackedPRs: { enabled: true, provider: 'github-gh-stack' } }))
  runGit('add', '.'); runGit('commit', '-m', 'fixture base'); const trunk = runGit('rev-parse', 'HEAD')
  runGit('checkout', '-b', 'codex/a'); fs.writeFileSync(path.join(repo, 'a.txt'), 'a')
  if (trackedBodies) fs.writeFileSync(path.join(repo, 'body.md'), 'body on a')
  runGit('add', '.'); runGit('commit', '-m', 'fixture a'); const a = runGit('rev-parse', 'HEAD')
  runGit('checkout', '-b', 'codex/b'); fs.writeFileSync(path.join(repo, 'b.txt'), 'b')
  if (trackedBodies) fs.writeFileSync(path.join(repo, 'body.md'), 'reviewed body on b')
  runGit('add', '.'); runGit('commit', '-m', 'fixture b'); const b = runGit('rev-parse', 'HEAD')
  runGit('init', '--bare', origin); runGit('remote', 'add', 'origin', origin); runGit('push', 'origin', 'develop', 'codex/a')
  const pr = { number: 11, html_url: 'https://github.com/org/repo/pull/11', state: 'open', draft: false, merged: false,
    head: { ref: 'codex/a', sha: a, repo: { full_name: 'org/repo' } }, base: { ref: 'develop', sha: trunk, repo: { full_name: 'org/repo' } }, stack: null }
  const state = { calls: [], view: { trunk: 'develop', currentBranch: 'codex/b', branches: [
    { name: 'codex/a', head: a, base: trunk, isMerged: false, isQueued: false, needsRebase: false },
    { name: 'codex/b', head: b, base: a, isMerged: false, isQueued: false, needsRebase: false } ] }, pr }
  change(state)
  const stateFile = path.join(dir, 'state.json'); fs.writeFileSync(stateFile, JSON.stringify(state))
  const injectWriter = `const fs=require('node:fs'),p=process.env.STACK_TEST_STATE,s=JSON.parse(fs.readFileSync(p));if(s.concurrentPush&&!s.writerRan){cp.execFileSync(${JSON.stringify(git)},['--git-dir',${JSON.stringify(origin)},'update-ref','refs/heads/codex/b',s.concurrentPush]);s.writerRan=true;fs.writeFileSync(p,JSON.stringify(s))}`
  fs.writeFileSync(path.join(bin, 'git'), `#!${process.execPath}\nconst cp=require('node:child_process');const a=process.argv.slice(2);if(a.join(' ')==='remote get-url origin'){console.log('https://github.com/org/repo.git')}else if(a.join(' ')==='remote get-url --push --all origin'){const r=cp.spawnSync(${JSON.stringify(git)},['config','--get-all','remote.origin.pushurl'],{encoding:'utf8'});if(r.status===1)console.log('https://github.com/org/repo.git');else process.stdout.write(r.stdout)}else{const r=cp.spawnSync(${JSON.stringify(git)},a,{stdio:'inherit'});if(a[0]==='push'&&r.status===0){const fs=require('node:fs'),p=process.env.STACK_TEST_STATE,s=JSON.parse(fs.readFileSync(p));if(s.losePushResponse){s.losePushResponse=false;s.responseLost=true;fs.writeFileSync(p,JSON.stringify(s));process.exit(42)}}process.exit(r.status??1)}\n`, { mode: 0o755 })
  const shim = path.join(bin, 'git')
  fs.writeFileSync(shim, fs.readFileSync(shim, 'utf8').replace("else{const r=cp.spawnSync", `else{if(a[0]==='push'){${injectWriter}}const r=cp.spawnSync`))
  fs.writeFileSync(path.join(bin, 'gh'), `#!${process.execPath}
const fs=require('node:fs');const a=process.argv.slice(2),p=process.env.STACK_TEST_STATE,s=JSON.parse(fs.readFileSync(p));
s.calls.push(a);fs.writeFileSync(p,JSON.stringify(s));const out=x=>console.log(JSON.stringify(x));
const cp=require('node:child_process'); const git=(...a)=>cp.execFileSync(${JSON.stringify(git)},a,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
s.prs=s.prs||[s.pr];
if(a.join(' ')==='stack --version') console.log('gh stack version 0.2.1');
else if(a.join(' ')==='stack view --json') out({...s.view,currentBranch:git('branch','--show-current')});
else if(a[0]==='api' && a.includes('GET')) {
 if(s.refreshPRs){for(const pr of s.prs.filter(p=>p.state==='open')){pr.head.sha=git('ls-remote','--heads','origin','refs/heads/'+pr.head.ref).split('\\t')[0];pr.base.sha=git('ls-remote','--heads','origin','refs/heads/'+pr.base.ref).split('\\t')[0];if(pr.stack)pr.stack.base.sha=git('ls-remote','--heads','origin','refs/heads/develop').split('\\t')[0]}fs.writeFileSync(p,JSON.stringify(s))}
 const e=a.at(-1);
 if(e.startsWith('repos/org/repo/pulls?')) out(s.prs.filter(p=>p.state==='open'&&e.includes(encodeURIComponent('org:'+p.head.ref))));
 else if(e.startsWith('repos/org/repo/pulls/')) out({...s.prs.find(p=>p.number===Number(e.split('/').at(-1))), additions:1, deletions:0, mergeable:true});
 else if(e==='repos/org/repo/stacks/13') out(s.remote);
 else {console.error('unexpected GET '+e);process.exit(99)}
} else if(a[0]==='stack'&&a[1]==='rebase') {
 s.refreshPRs=true;s.rebaseCalled=true;fs.writeFileSync(p,JSON.stringify(s));
 const original=git('branch','--show-current');let parent='develop';
 if(!a.includes('--no-trunk')){git('fetch','origin');if(cp.spawnSync(${JSON.stringify(git)},['merge-base','--is-ancestor','develop','origin/develop']).status===0)git('branch','-f','develop','origin/develop')}
 for(const [i,b]of s.view.branches.entries()){
  if(b.isMerged)continue;
  if(i||!a.includes('--no-trunk')){
   const r=cp.spawnSync(${JSON.stringify(git)},['rebase','--onto',parent,b.base,b.name],{encoding:'utf8'});
   if(r.status!==0){fs.writeFileSync(git('rev-parse','--git-common-dir')+'/gh-stack-rebase-state','fixture conflict');process.exit(1)}
  }
  b.head=git('rev-parse',b.name);b.base=git('rev-parse',parent);b.needsRebase=false;parent=b.name;
 }
 git('switch',original);fs.writeFileSync(p,JSON.stringify(s));
} else if(a[0]==='stack'&&a[1]==='push') {
 // Reproduce the pinned upstream fetch-before-lease behavior using real Git.
 {${injectWriter}}
 git('fetch','origin');
 const leases=['codex/a','codex/b'].map(b=>{try{return '--force-with-lease=refs/heads/'+b+':'+git('rev-parse','refs/remotes/origin/'+b)}catch{return '--force-with-lease=refs/heads/'+b+':'}});
 git('push','origin',...leases,'codex/a','codex/b');
}
else if(a[0]==='stack'&&a[1]==='link') {
 if(!s.linkNoop){s.prs.forEach((p,i)=>p.stack={id:99,number:13,size:s.prs.length,position:i+1,base:{ref:'develop',sha:git('rev-parse','develop')}});s.remote={id:99,number:13,open:true,base:{ref:'develop'},pull_requests:s.prs};fs.writeFileSync(p,JSON.stringify(s));}
}
else if(a[0]==='pr'&&a[1]==='create') {
 const head=a[a.indexOf('--head')+1],base=a[a.indexOf('--base')+1];
 if(s.failCreate){process.exit(1)}
 const number=head==='codex/a'?11:12;
 s.prs.push({number,html_url:'https://github.com/org/repo/pull/'+number,state:'open',merged:false,draft:a.includes('--draft'),head:{ref:head,sha:git('rev-parse',head),repo:{full_name:'org/repo'}},base:{ref:base,sha:git('rev-parse',base),repo:{full_name:'org/repo'}},stack:null});
 s.submittedBodies={...s.submittedBodies,[head]:a[a.indexOf('--body')+1]};
 s.creationRepo=process.env.GH_REPO;s.creationHost=process.env.GH_HOST;fs.writeFileSync(p,JSON.stringify(s));console.log('https://github.com/org/repo/pull/'+number); }
else {console.error('unexpected gh '+a.join(' '));process.exit(99)}
`, { mode: 0o755 })
  const env = { ...process.env, PATH: bin + path.delimiter + process.env.PATH, STACK_TEST_STATE: stateFile }
  return { repo, runGit, run: (args, extraEnv = {}) => spawnSync('bash', [path.join(scripts, 'pr-create.sh'), '--title', 'layer b', '--body', 'fixture body', ...args], { cwd: repo, env: { ...env, ...extraEnv }, encoding: 'utf8' }),
    runStack: args => spawnSync(process.execPath, [path.join(scripts, 'stack.mjs'), ...args], { cwd: repo, env, encoding: 'utf8' }),
    calls: () => JSON.parse(fs.readFileSync(stateFile)).calls, state: () => JSON.parse(fs.readFileSync(stateFile)),
    change: callback => { const s = JSON.parse(fs.readFileSync(stateFile)); callback(s); fs.writeFileSync(stateFile, JSON.stringify(s)) }, dir, env }
}
test('stack bootstrap creates draft upper only after verifying current registered parent', t => {
  const f = fixture(t), r = f.run(['--stack', '--base', 'codex/a', '--draft'])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  const created = f.calls().find(a => a[0] === 'pr' && a[1] === 'create')
  assert.ok(created.includes('--draft')); assert.equal(created[created.indexOf('--base') + 1], 'codex/a')
  assert.match(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b'), /^[0-9a-f]{40}\s+refs\/heads\/codex\/b$/)
})
for (const [name, change, args] of [
  ['unregistered base', () => {}, ['--stack', '--base', 'codex/not-parent', '--draft']],
  ['parent head changed', s => { s.pr.head.sha = 'f'.repeat(40) }, ['--stack', '--base', 'codex/a', '--draft']],
  ['parent base changed', s => { s.pr.base.ref = 'main' }, ['--stack', '--base', 'codex/a', '--draft']],
  ['parent closed', s => { s.pr.state = 'closed' }, ['--stack', '--base', 'codex/a', '--draft']],
  ['foreign parent repository', s => { s.pr.head.repo.full_name = 'other/repo' }, ['--stack', '--base', 'codex/a', '--draft']],
  ['upper ready request', () => {}, ['--stack', '--base', 'codex/a']],
]) test(`${name} cannot push or create`, t => {
  const f = fixture(t, change), r = f.run(args)
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b'), '')
  assert.equal(f.calls().some(a => a[0] === 'pr' && a[1] === 'create'), false)
})

test('actual PR creation uses the validated origin despite ambient GitHub target overrides', t => {
  const f = fixture(t), r = f.run(['--stack', '--base', 'codex/a', '--draft'], { GH_REPO: 'other/repo', GH_HOST: 'other.invalid' })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.equal(f.state().creationRepo, 'org/repo')
  assert.equal(f.state().creationHost, 'github.com')
})
test('a separate push destination receives no ref on stack rejection', t => {
  const f = fixture(t), other = path.join(f.dir, 'other.git')
  f.runGit('init', '--bare', other)
  f.runGit('config', '--add', 'remote.origin.pushurl', other)
  const r = f.run(['--stack', '--base', 'codex/a', '--draft'])
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.equal(f.runGit('ls-remote', '--heads', other, 'refs/heads/codex/b'), '')
  assert.equal(f.calls().some(a => a[0] === 'pr' && a[1] === 'create'), false)
})

function plan(f) {
  const body = path.join(f.dir, 'body.md'), file = path.join(f.dir, 'plan.json')
  fs.writeFileSync(body, 'fixture body')
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, layers: [
    { branch: 'codex/a', title: 'layer a', bodyFile: body }, { branch: 'codex/b', title: 'layer b', bodyFile: body },
  ] }))
  return file
}
function submit(f, file) {
  const preview = f.runStack(['submit', '--plan', file])
  assert.equal(preview.status, 0, preview.stdout + preview.stderr)
  return f.runStack(['submit', '--plan', file, '--apply', '--expected', JSON.parse(preview.stdout).fingerprint])
}
test('submit previews, reuses existing parent, creates upper draft and links full URLs', t => {
  const f = fixture(t), r = submit(f, plan(f))
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.equal(JSON.parse(r.stdout).state, 'confirmed')
  assert.equal(f.calls().filter(a => a[0] === 'pr' && a[1] === 'create').length, 1)
  assert.deepEqual(f.calls().find(a => a[0] === 'stack' && a[1] === 'link'), ['stack', 'link', '--base', 'develop', '--remote', 'origin', 'https://github.com/org/repo/pull/11', 'https://github.com/org/repo/pull/12'])
  assert.equal(f.runGit('branch', '--show-current'), 'codex/b')
})
test('link exit zero with unchanged membership remains unverified and keeps effects journal', t => {
  const f = fixture(t, s => { s.linkNoop = true }), r = submit(f, plan(f))
  assert.notEqual(r.status, 0)
  const result = JSON.parse(r.stdout)
  assert.equal(result.state, 'unverified')
  assert.ok(fs.existsSync(result.journal))
  assert.equal(f.state().prs.length, 2, 'partial successful PR creation is preserved')
})
test('invalid final layer body blocks the first remote mutation', t => {
  const f = fixture(t), file = plan(f), data = JSON.parse(fs.readFileSync(file))
  data.layers[1].bodyFile = path.join(f.dir, 'missing.md');fs.writeFileSync(file, JSON.stringify(data))
  const r = f.runStack(['submit', '--plan', file, '--apply', '--expected', '0'.repeat(64)])
  assert.notEqual(r.status, 0)
  assert.equal(f.calls().some(a => (a[0] === 'pr' && a[1] === 'create') || (a[0] === 'stack' && ['push','link'].includes(a[1]))), false)
})

test('writer push after preflight is preserved even if the engine would refetch its lease', t => {
  const f = fixture(t), file = plan(f)
  const writer = f.runGit('commit-tree', 'codex/b^{tree}', '-p', 'codex/b', '-m', 'independent writer')
  // Transfer the object only; no branch exists at the snapshot/preview boundary.
  f.runGit('push', 'origin', `${writer}:refs/fixture/writer`)
  f.change(s => { s.concurrentPush = writer })
  const r = submit(f, file)
  assert.equal(f.state().writerRan, true)
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b').split('\t')[0], writer)
  assert.equal(f.calls().some(a => a[0] === 'pr' && a[1] === 'create'), false)
  assert.equal(JSON.parse(r.stdout).state, 'unverified')
})
test('branch checkout cannot replace the previewed PR body content', t => {
  const f = fixture(t, s => { s.prs = [] }, true), file = plan(f)
  const data = JSON.parse(fs.readFileSync(file))
  data.layers.forEach(l => { l.bodyFile = path.join(f.repo, 'body.md') }); fs.writeFileSync(file, JSON.stringify(data))
  const r = submit(f, file)
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.deepEqual(f.state().submittedBodies, { 'codex/a': 'reviewed body on b', 'codex/b': 'reviewed body on b' })
})
test('normal new commits use actual Git HEAD rather than the official view head cache', t => {
  const f = fixture(t)
  fs.writeFileSync(path.join(f.repo, 'b2.txt'), 'new committed change')
  f.runGit('add', 'b2.txt'); f.runGit('commit', '-m', 'fixture b update')
  const r = submit(f, plan(f))
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.equal(f.state().prs.at(-1).head.sha, f.runGit('rev-parse', 'codex/b'))
})
test('a changed existing remote ref rejects the entire stack push without updating another layer', t => {
  const f = fixture(t), oldA = f.runGit('rev-parse', 'codex/a'), oldB = f.runGit('rev-parse', 'codex/b')
  f.runGit('push', 'origin', 'codex/b')
  const writer = f.runGit('commit-tree', `${oldB}^{tree}`, '-p', oldB, '-m', 'independent writer')
  f.runGit('push', 'origin', `${writer}:refs/fixture/writer`)
  f.runGit('switch', 'codex/a'); fs.writeFileSync(path.join(f.repo, 'a2.txt'), 'local update')
  f.runGit('add', 'a2.txt'); f.runGit('commit', '-m', 'fixture a update')
  f.runGit('switch', 'codex/b'); f.runGit('merge', '--no-ff', 'codex/a', '-m', 'fixture parent update')
  f.change(s => { s.concurrentPush = writer })
  const r = submit(f, plan(f))
  assert.equal(f.state().writerRan, true)
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b').split('\t')[0], writer)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/a').split('\t')[0], oldA)
  assert.equal(f.calls().some(a => a[0] === 'pr' && a[1] === 'create'), false)
})

function updateLower(f) {
  f.runGit('switch', 'codex/a'); fs.writeFileSync(path.join(f.repo, 'a2.txt'), 'lower update')
  f.runGit('add', 'a2.txt'); f.runGit('commit', '-m', 'lower update'); f.runGit('switch', 'codex/b')
  f.change(s => { s.view.branches[1].needsRebase = true })
}
function rebase(f, action = 'restack', extra = []) {
  const p = f.runStack([action, ...extra]); assert.equal(p.status, 0, p.stdout + p.stderr)
  return f.runStack([action, ...extra, '--apply', '--expected', JSON.parse(p.stdout).fingerprint])
}
test('restack rebases locally then publishes rewritten descendants with original leases', t => {
  const f = fixture(t); assert.equal(submit(f, plan(f)).status, 0)
  const oldB = f.runGit('rev-parse', 'codex/b'); updateLower(f)
  const r = rebase(f); assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.equal(JSON.parse(r.stdout).state, 'confirmed')
  assert.notEqual(f.runGit('rev-parse', 'codex/b'), oldB)
  assert.equal(f.runGit('show', 'codex/b:a2.txt'), 'lower update')
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b').split('\t')[0], f.runGit('rev-parse', 'codex/b'))
  assert.equal(f.runGit('branch', '--show-current'), 'codex/b')
  assert.equal(f.calls().some(a => a[0] === 'stack' && ['push','sync'].includes(a[1])), false)
})
test('restack cannot adopt a concurrent writer as a new lease and recovery cannot overwrite it', t => {
  const f = fixture(t); assert.equal(submit(f, plan(f)).status, 0)
  const oldA = f.runGit('rev-parse', 'codex/a'), oldB = f.runGit('rev-parse', 'codex/b')
  const writer = f.runGit('commit-tree', `${oldB}^{tree}`, '-p', oldB, '-m', 'writer')
  f.runGit('push', 'origin', `${writer}:refs/fixture/writer`); updateLower(f)
  f.change(s => { s.concurrentPush = writer })
  const r = rebase(f); assert.notEqual(r.status, 0); assert.equal(f.state().writerRan, true)
  const result = JSON.parse(r.stdout); assert.equal(result.state, 'unverified')
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/a').split('\t')[0], oldA)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b').split('\t')[0], writer)
  const resume = f.runStack(['restack', '--resume', result.journal])
  assert.notEqual(resume.status, 0); assert.match(resume.stderr + resume.stdout, /remote.*changed|writer/)
})
test('restack conflict preserves remote refs and native recovery instead of publishing', t => {
  const f = fixture(t); assert.equal(submit(f, plan(f)).status, 0)
  const before = f.runGit('ls-remote', '--heads', 'origin')
  f.runGit('switch', 'codex/a');fs.writeFileSync(path.join(f.repo, 'b.txt'), 'conflicting lower')
  f.runGit('add', 'b.txt');f.runGit('commit', '-m', 'conflict lower');f.runGit('switch', 'codex/b')
  const r = rebase(f);assert.notEqual(r.status, 0)
  const result = JSON.parse(r.stdout);assert.equal(result.state, 'unverified')
  assert.equal(f.state().rebaseCalled, true)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin'), before)
  assert.ok(fs.existsSync(path.join(f.repo, '.git', 'rebase-merge')))
  assert.match(fs.readFileSync(result.journal, 'utf8'), /native-rebase/)
})
test('sync reconciles a live merged prefix without recreating or pushing its branch', t => {
  const f = fixture(t);assert.equal(submit(f, plan(f)).status, 0)
  const oldA = f.runGit('rev-parse', 'codex/a')
  f.runGit('switch','develop');f.runGit('merge','--ff-only','codex/a')
  fs.writeFileSync(path.join(f.repo,'trunk.txt'),'trunk update');f.runGit('add','trunk.txt');f.runGit('commit','-m','trunk update')
  f.runGit('push','origin','develop');f.runGit('switch','codex/b')
  f.change(s=>{
    s.view.branches[0].isMerged=true;s.view.branches[0].pr={url:s.prs[0].html_url}
    s.prs[0].state='closed';s.prs[0].merged=true;s.prs[0].merged_at='2026-10-15T00:00:00Z'
    s.prs[1].base={ref:'develop',sha:f.runGit('rev-parse','develop'),repo:{full_name:'org/repo'}}
    s.prs[1].stack={id:99,number:13,size:1,position:1,base:{ref:'develop',sha:f.runGit('rev-parse','develop')}}
    s.remote.pull_requests=[s.prs[1]];s.refreshPRs=true
  })
  const r=rebase(f,'sync');assert.equal(r.status,0,r.stdout+r.stderr)
  assert.equal(f.runGit('show','codex/b:trunk.txt'),'trunk update')
  assert.equal(f.runGit('ls-remote','--heads','origin','refs/heads/codex/a').split('\t')[0],oldA)
  assert.equal(f.calls().filter(a=>a[0]==='pr'&&a[1]==='create').length,1)
})

test('restack recovery confirms a lost push response without repeating native rebase', t => {
  const f=fixture(t);assert.equal(submit(f,plan(f)).status,0);updateLower(f)
  f.change(s=>{s.losePushResponse=true})
  const r=rebase(f);assert.notEqual(r.status,0);assert.equal(f.state().responseLost,true)
  const result=JSON.parse(r.stdout),beforeCalls=f.calls().filter(a=>a[0]==='stack'&&a[1]==='rebase').length
  const resumed=rebase(f,'restack',['--resume',result.journal]);assert.equal(resumed.status,0,resumed.stdout+resumed.stderr)
  assert.equal(JSON.parse(resumed.stdout).state,'confirmed')
  assert.equal(f.calls().filter(a=>a[0]==='stack'&&a[1]==='rebase').length,beforeCalls)
  assert.equal(f.runGit('ls-remote','--heads','origin','refs/heads/codex/b').split('\t')[0],f.runGit('rev-parse','codex/b'))
})
test('restack preview becomes stale before the engine can rewrite any branch', t => {
  const f=fixture(t);const p=f.runStack(['restack']);assert.equal(p.status,0,p.stdout+p.stderr)
  updateLower(f);const r=f.runStack(['restack','--apply','--expected',JSON.parse(p.stdout).fingerprint])
  assert.notEqual(r.status,0);assert.match(r.stderr,/preview is stale/)
  assert.equal(f.calls().some(a=>a[0]==='stack'&&a[1]==='rebase'),false)
})
test('restack stops for another worktree owner before native mutation', t => {
  const f=fixture(t);const other=path.join(f.dir,'writer');f.runGit('worktree','add',other,'codex/a')
  fs.writeFileSync(path.join(other,'user.txt'),'user work')
  const r=f.runStack(['restack']);assert.notEqual(r.status,0);assert.match(r.stderr,/owned elsewhere/)
  assert.equal(fs.readFileSync(path.join(other,'user.txt'),'utf8'),'user work')
  assert.equal(f.calls().some(a=>a[0]==='stack'&&a[1]==='rebase'),false)
})

test('sync refuses an unpushed local trunk commit before native rebase', t => {
  const f=fixture(t)
  f.runGit('switch','develop');fs.writeFileSync(path.join(f.repo,'unpublished.txt'),'not reviewed')
  f.runGit('add','unpublished.txt');f.runGit('commit','-m','local trunk');f.runGit('switch','codex/b')
  const r=f.runStack(['sync']);assert.notEqual(r.status,0,r.stdout+r.stderr)
  assert.match(r.stderr,/local trunk/)
  assert.equal(f.calls().some(a=>a[0]==='stack'&&a[1]==='rebase'),false)
})
test('sync preview binds local trunk even when its remote has not changed', t => {
  const f=fixture(t),p=f.runStack(['sync']);assert.equal(p.status,0,p.stdout+p.stderr)
  const old=f.runGit('rev-parse','develop')
  const changed=f.runGit('commit-tree','develop^{tree}','-p',old,'-m','new local trunk')
  f.runGit('update-ref','refs/heads/develop',changed,old)
  const r=f.runStack(['sync','--apply','--expected',JSON.parse(p.stdout).fingerprint])
  assert.notEqual(r.status,0,r.stdout+r.stderr);assert.match(r.stderr,/local trunk|preview is stale/)
  assert.equal(f.calls().some(a=>a[0]==='stack'&&a[1]==='rebase'),false)
})

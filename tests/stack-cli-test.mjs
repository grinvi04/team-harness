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
function fixture(t, change = () => {}, trackedBodies = false, flow = 'git-flow') {
  const trunkName = flow === 'main' ? 'main' : 'develop'
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'stack-cli-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const repo = path.join(dir, 'repo'), origin = path.join(dir, 'origin'), bin = path.join(dir, 'bin')
  fs.mkdirSync(repo); fs.mkdirSync(bin)
  const runGit = (...args) => execFileSync(git, args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  runGit('init', '-b', trunkName); runGit('config', 'user.email', 'fixture@example.invalid'); runGit('config', 'user.name', 'Fixture')
  fs.writeFileSync(path.join(repo, '.harness-policy.json'), JSON.stringify({ schemaVersion: 1, mode: 'company', autoMergeTargets: [], branchFlow: flow, stackedPRs: { enabled: true, provider: 'github-gh-stack' } }))
  runGit('add', '.'); runGit('commit', '-m', 'fixture base'); const trunk = runGit('rev-parse', 'HEAD')
  runGit('checkout', '-b', 'codex/a'); fs.writeFileSync(path.join(repo, 'a.txt'), 'a')
  if (trackedBodies) fs.writeFileSync(path.join(repo, 'body.md'), 'body on a')
  runGit('add', '.'); runGit('commit', '-m', 'fixture a'); const a = runGit('rev-parse', 'HEAD')
  runGit('checkout', '-b', 'codex/b'); fs.writeFileSync(path.join(repo, 'b.txt'), 'b')
  if (trackedBodies) fs.writeFileSync(path.join(repo, 'body.md'), 'reviewed body on b')
  runGit('add', '.'); runGit('commit', '-m', 'fixture b'); const b = runGit('rev-parse', 'HEAD')
  runGit('init', '--bare', origin); runGit('remote', 'add', 'origin', origin); runGit('push', 'origin', trunkName, 'codex/a')
  const pr = { number: 11, html_url: 'https://github.com/org/repo/pull/11', state: 'open', draft: false, merged: false,
    head: { ref: 'codex/a', sha: a, repo: { full_name: 'org/repo' } }, base: { ref: trunkName, sha: trunk, repo: { full_name: 'org/repo' } }, stack: null }
  const state = { calls: [], view: { trunk: trunkName, currentBranch: 'codex/b', branches: [
    { name: 'codex/a', head: a, base: trunk, isMerged: false, isQueued: false, needsRebase: false },
    { name: 'codex/b', head: b, base: a, isMerged: false, isQueued: false, needsRebase: false } ] }, pr }
  change(state)
  const stateFile = path.join(dir, 'state.json'); fs.writeFileSync(stateFile, JSON.stringify(state))
  const injectWriter = `const fs=require('node:fs'),p=process.env.STACK_TEST_STATE,s=JSON.parse(fs.readFileSync(p));if(s.concurrentPush&&!s.writerRan){cp.execFileSync(${JSON.stringify(git)},['--git-dir',${JSON.stringify(origin)},'update-ref','refs/heads/codex/b',s.concurrentPush]);s.writerRan=true;fs.writeFileSync(p,JSON.stringify(s))}`
  fs.writeFileSync(path.join(bin, 'git'), `#!${process.execPath}\nconst cp=require('node:child_process');const a=process.argv.slice(2);if(a.join(' ')==='remote get-url origin'){console.log('https://github.com/org/repo.git')}else if(a.join(' ')==='remote get-url --push --all origin'){const r=cp.spawnSync(${JSON.stringify(git)},['config','--get-all','remote.origin.pushurl'],{encoding:'utf8'});if(r.status===1)console.log('https://github.com/org/repo.git');else process.stdout.write(r.stdout)}else{const r=cp.spawnSync(${JSON.stringify(git)},a,{stdio:'inherit'});if(a[0]==='push'&&r.status===0){const fs=require('node:fs'),p=process.env.STACK_TEST_STATE,s=JSON.parse(fs.readFileSync(p));if(s.losePushResponse){s.losePushResponse=false;s.responseLost=true;fs.writeFileSync(p,JSON.stringify(s));process.exit(42)}}process.exit(r.status??1)}\n`, { mode: 0o755 })
  const shim = path.join(bin, 'git')
  fs.writeFileSync(shim, fs.readFileSync(shim, 'utf8').replace("else{const r=cp.spawnSync", `else{if(a[0]==='push'){${injectWriter}}const r=cp.spawnSync`))
  fs.writeFileSync(path.join(bin, 'gh'), `#!${process.execPath}
const trunk=${JSON.stringify(trunkName)};const fs=require('node:fs');const a=process.argv.slice(2),p=process.env.STACK_TEST_STATE,s=JSON.parse(fs.readFileSync(p));
s.calls.push(a);fs.writeFileSync(p,JSON.stringify(s));const out=x=>console.log(JSON.stringify(x));
const cp=require('node:child_process'); const git=(...a)=>cp.execFileSync(${JSON.stringify(git)},a,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
s.prs=s.prs||[s.pr];
if(a.join(' ')==='stack --version') console.log('gh stack version 0.2.1');
else if(a.join(' ')==='stack view --json') out({...s.view,currentBranch:git('branch','--show-current')});
else if(a[0]==='api' && a.includes('GET')) {
 if(s.refreshPRs){for(const pr of s.prs.filter(p=>p.state==='open')){pr.head.sha=git('ls-remote','--heads','origin','refs/heads/'+pr.head.ref).split('\\t')[0];pr.base.sha=git('ls-remote','--heads','origin','refs/heads/'+pr.base.ref).split('\\t')[0];if(pr.stack)pr.stack.base.sha=git('ls-remote','--heads','origin','refs/heads/'+trunk).split('\\t')[0]}fs.writeFileSync(p,JSON.stringify(s))}
 const e=a.at(-1);
 if(e.startsWith('repos/org/repo/pulls?')) out(s.prs.filter(p=>p.state==='open'&&e.includes(encodeURIComponent('org:'+p.head.ref))));
 else if(e.startsWith('repos/org/repo/pulls/')) out({...s.prs.find(p=>p.number===Number(e.split('/').at(-1))), additions:1, deletions:0, mergeable:true});
 else if(e==='repos/org/repo/stacks/13') out(s.remote);
 else {console.error('unexpected GET '+e);process.exit(99)}
} else if(a[0]==='stack'&&a[1]==='rebase') {
 s.refreshPRs=true;s.rebaseCalled=true;fs.writeFileSync(p,JSON.stringify(s));
 const original=git('branch','--show-current');let parent=trunk;
 if(!a.includes('--no-trunk')){git('fetch','origin');if(cp.spawnSync(${JSON.stringify(git)},['merge-base','--is-ancestor',trunk,'origin/'+trunk]).status===0)git('branch','-f',trunk,'origin/'+trunk)}
 // Pinned cmd/rebase.go fetches and fast-forwards active stack branches before rebasing.
 if(!a.includes('--no-trunk'))for(const b of s.view.branches.filter(b=>!b.isMerged)){
  const remote='origin/'+b.name;
  if(cp.spawnSync(${JSON.stringify(git)},['merge-base','--is-ancestor',b.name,remote]).status===0&&git('rev-parse',b.name)!==git('rev-parse',remote)){
   if(b.name===original)git('merge','--ff-only',remote);else git('branch','-f',b.name,remote);
  }
 }
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
 if(!s.linkNoop){s.prs.forEach((p,i)=>p.stack={id:99,number:13,size:s.prs.length,position:i+1,base:{ref:trunk,sha:git('rev-parse',trunk)}});s.remote={id:99,number:13,open:true,base:{ref:trunk},pull_requests:s.prs};fs.writeFileSync(p,JSON.stringify(s));}
}
else if(a[0]==='pr'&&a[1]==='create') {
 const head=a[a.indexOf('--head')+1],base=a[a.indexOf('--base')+1];
 if(s.failCreate){process.exit(1)}
 const number=({'codex/a':11,'codex/b':12,'codex/c':13,'codex/d':14})[head];
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
for (const mode of ['submit', 'direct wrapper']) {
  test(`${mode} publishes only the intended layer when push.followTags is enabled`, t => {
    const f = fixture(t)
    f.runGit('tag', '-a', 'v9.9.9-unpublished', '-m', 'local release candidate')
    f.runGit('config', 'push.followTags', 'true')
    const tag = f.runGit('rev-parse', 'refs/tags/v9.9.9-unpublished')
    const head = f.runGit('rev-parse', 'codex/b')
    const r = mode === 'submit' ? submit(f, plan(f)) : f.run(['--stack', '--base', 'codex/a', '--draft'])
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b').split('\t')[0], head)
    assert.equal(f.runGit('ls-remote', '--tags', 'origin'), '', 'PR creation must not publish a release tag outside its preview')
    assert.equal(f.runGit('rev-parse', 'refs/tags/v9.9.9-unpublished'), tag, 'local tag is preserved')
    assert.equal(f.runGit('config', '--get', 'push.followTags'), 'true', 'user configuration is preserved')
  })
}
test('direct stack PR creation preserves a writer ref that appears after preflight', t => {
  const f = fixture(t)
  const writer = f.runGit('commit-tree', 'codex/b^{tree}', '-p', 'codex/b', '-m', 'independent writer')
  f.runGit('push', 'origin', `${writer}:refs/fixture/writer`)
  f.change(s => { s.concurrentPush = writer })
  const r = f.run(['--stack', '--base', 'codex/a', '--draft'])
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.equal(f.state().writerRan, true)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b').split('\t')[0], writer)
  assert.equal(f.calls().some(a => a[0] === 'pr' && a[1] === 'create'), false)
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
    // GitHub retains the merged prefix and original member positions/size.
    s.remote.pull_requests=s.prs;s.refreshPRs=true
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

// GitHub REST/native metadata is doubled; every rewritten commit/tree/ref is real Git.
function serverRewrittenPublishedLayer(t) {
  const f = fixture(t), submitted = submit(f, plan(f))
  assert.equal(submitted.status, 0, submitted.stdout + submitted.stderr)
  const publication = JSON.parse(submitted.stdout)
  assert.equal(publication.state, 'confirmed')
  const oldA = f.runGit('rev-parse', 'codex/a'), oldB = f.runGit('rev-parse', 'codex/b')
  const trunk = f.runGit('rev-parse', 'develop')
  const merged = f.runGit('commit-tree', `${oldA}^{tree}`, '-p', trunk, '-p', oldA, '-m', 'server merged a')
  const extra = path.join(f.dir, 'server-only.txt')
  fs.writeFileSync(extra, 'unique content added to rewritten remote b\n')
  const blob = f.runGit('hash-object', '-w', extra), index = path.join(f.dir, 'server-index')
  const indexed = (...args) => execFileSync(git, args, { cwd: f.repo, env: { ...process.env, GIT_INDEX_FILE: index }, encoding: 'utf8' }).trim()
  indexed('read-tree', `${oldB}^{tree}`)
  indexed('update-index', '--add', '--cacheinfo', `100644,${blob},server-only.txt`)
  const rewritten = f.runGit('commit-tree', indexed('write-tree'), '-p', merged, '-m', 'server rewrote b with unique content')
  // Transfer objects, then emulate server updates in the isolated bare remote.
  f.runGit('push', 'origin', `${rewritten}:refs/fixture/server-rewrite`)
  f.runGit('--git-dir', path.join(f.dir, 'origin'), 'update-ref', 'refs/heads/develop', merged, trunk)
  f.runGit('--git-dir', path.join(f.dir, 'origin'), 'update-ref', 'refs/heads/codex/b', rewritten, oldB)
  f.change(s => {
    s.view.branches[0].isMerged = true
    s.view.branches[0].pr = { url: s.prs[0].html_url }
    s.prs[0].state = 'closed'; s.prs[0].merged = true; s.prs[0].merged_at = '2026-10-15T00:00:00Z'
    s.prs[1].base = { ref: 'develop', sha: merged, repo: { full_name: 'org/repo' } }
    s.prs[1].head.sha = rewritten
    for (const p of s.prs) p.stack.base.sha = merged
    s.remote.pull_requests = s.prs; s.refreshPRs = true
  })
  assert.equal(f.runGit('rev-parse', 'codex/b'), oldB, 'local remains the confirmed published candidate')
  assert.equal(f.runGit('status', '--porcelain'), '')
  return { f, oldB, rewritten, publication }
}
function adoptionRefs(f) {
  return { local: f.runGit('show-ref'), remote: f.runGit('ls-remote', '--heads', 'origin') }
}
test('sync adoption preserves server-only content and a recovery ref for the confirmed published local', t => {
  const { f, oldB, rewritten } = serverRewrittenPublishedLayer(t)
  const preview = f.runStack(['sync'])
  assert.equal(preview.status, 0, preview.stdout + preview.stderr)
  const r = f.runStack(['sync', '--apply', '--expected', JSON.parse(preview.stdout).fingerprint])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  const result = JSON.parse(r.stdout)
  assert.equal(result.state, 'confirmed')
  assert.equal(f.runGit('show', 'codex/b:server-only.txt'), 'unique content added to rewritten remote b')
  assert.equal(f.runGit('merge-base', '--is-ancestor', rewritten, 'codex/b'), '')
  const recovery = `refs/harness-stack-recovery/${path.basename(result.journal, '.json')}/codex/b`
  assert.equal(f.runGit('rev-parse', recovery), oldB)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b').split('\t')[0], f.runGit('rev-parse', 'codex/b'))
})
test('sync adoption rejects an extra local commit instead of replacing unpublished work', t => {
  const { f } = serverRewrittenPublishedLayer(t)
  fs.writeFileSync(path.join(f.repo, 'local-only.txt'), 'unpublished local work')
  f.runGit('add', 'local-only.txt'); f.runGit('commit', '-m', 'unpublished local b update')
  const before = adoptionRefs(f), r = f.runStack(['sync'])
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.deepEqual(adoptionRefs(f), before)
  assert.equal(f.runGit('show', 'codex/b:local-only.txt'), 'unpublished local work')
  assert.equal(f.calls().some(a => a[0] === 'stack' && a[1] === 'rebase'), false)
})
test('sync adoption rejects an unresolved journal despite an older confirmed publication', t => {
  const { f, publication } = serverRewrittenPublishedLayer(t)
  const pending = JSON.parse(fs.readFileSync(publication.journal, 'utf8'))
  pending.action = 'sync'; pending.state = 'unverified'
  pending.effects = [{ kind: 'push-observed-refs', state: 'unknown' }]
  const file = path.join(path.dirname(publication.journal), '9999999999999-11111111-1111-4111-8111-111111111111.json')
  fs.writeFileSync(file, JSON.stringify(pending), { mode: 0o600 })
  const before = adoptionRefs(f), r = f.runStack(['sync'])
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.deepEqual(adoptionRefs(f), before)
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).effects[0].state, 'unknown')
  assert.equal(f.calls().some(a => a[0] === 'stack' && a[1] === 'rebase'), false)
})
test('sync adoption preview rejects a later remote move before changing local branches', t => {
  const { f, rewritten } = serverRewrittenPublishedLayer(t)
  const preview = f.runStack(['sync'])
  assert.equal(preview.status, 0, preview.stdout + preview.stderr)
  const moved = f.runGit('commit-tree', `${rewritten}^{tree}`, '-p', rewritten, '-m', 'later server writer')
  f.runGit('push', 'origin', `${moved}:refs/fixture/later-server-writer`)
  f.runGit('--git-dir', path.join(f.dir, 'origin'), 'update-ref', 'refs/heads/codex/b', moved, rewritten)
  const before = adoptionRefs(f)
  const r = f.runStack(['sync', '--apply', '--expected', JSON.parse(preview.stdout).fingerprint])
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.deepEqual(adoptionRefs(f), before)
  assert.equal(f.calls().some(a => a[0] === 'stack' && a[1] === 'rebase'), false)
})

function adoptionFault(f, kind, writer = null) {
  const file = path.join(f.dir, 'bin', 'git'), source = fs.readFileSync(file, 'utf8')
  const marker = "if(a.join(' ')==='remote get-url origin')"
  assert.ok(source.includes(marker))
  const inject = `{
    const fs=require('node:fs'),p=process.env.STACK_TEST_STATE,s=JSON.parse(fs.readFileSync(p));
    if(${JSON.stringify(kind)}==='cas'&&a[0]==='update-ref'&&a[1]==='--stdin'&&!s.adoptionCASWriterRan){
      cp.execFileSync(${JSON.stringify(git)},['update-ref','refs/heads/codex/b',${JSON.stringify(writer)}]);
      s.adoptionCASWriterRan=true;fs.writeFileSync(p,JSON.stringify(s));
    }
    if(${JSON.stringify(kind)}==='checkout'&&a.length===2&&a[0]==='switch'&&a[1]==='codex/b'){
      s.adoptionCheckoutFailed=true;fs.writeFileSync(p,JSON.stringify(s));process.exit(41);
    }
  }`
  fs.writeFileSync(file, source.replace(marker, inject + marker))
}
function applyAdoption(f) {
  const preview = f.runStack(['sync'])
  assert.equal(preview.status, 0, preview.stdout + preview.stderr)
  return f.runStack(['sync', '--apply', '--expected', JSON.parse(preview.stdout).fingerprint])
}
test('sync adoption boundary refuses a dirty owner without changing refs or native state', t => {
  const { f } = serverRewrittenPublishedLayer(t)
  fs.writeFileSync(path.join(f.repo, 'b.txt'), 'uncommitted owner change')
  const before = adoptionRefs(f), r = f.runStack(['sync'])
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.deepEqual(adoptionRefs(f), before)
  assert.equal(fs.readFileSync(path.join(f.repo, 'b.txt'), 'utf8'), 'uncommitted owner change')
  assert.equal(f.calls().some(a => a[0] === 'stack' && a[1] === 'rebase'), false)
})
test('sync adoption boundary CAS collision preserves writer and creates no partial recovery refs', t => {
  const { f, oldB } = serverRewrittenPublishedLayer(t)
  const writer = f.runGit('commit-tree', `${oldB}^{tree}`, '-p', oldB, '-m', 'concurrent local writer')
  const remote = f.runGit('ls-remote', '--heads', 'origin')
  adoptionFault(f, 'cas', writer)
  const r = applyAdoption(f)
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.equal(f.state().adoptionCASWriterRan, true, 'fault occurred at update-ref transaction boundary')
  assert.equal(f.runGit('rev-parse', 'codex/b'), writer)
  assert.equal(f.runGit('for-each-ref', '--format=%(refname)', 'refs/harness-stack-recovery'), '')
  assert.equal(f.runGit('ls-remote', '--heads', 'origin'), remote)
  assert.equal(f.calls().some(a => a[0] === 'stack' && a[1] === 'rebase'), false)
  const journal = JSON.parse(fs.readFileSync(JSON.parse(r.stdout).journal, 'utf8'))
  assert.equal(journal.state, 'unverified')
  assert.notEqual(journal.remoteAdoption.stage, 'complete')
})
test('sync adoption boundary checkout failure keeps adopted refs and rejects ordinary resume', t => {
  const { f, oldB, rewritten } = serverRewrittenPublishedLayer(t)
  const remote = f.runGit('ls-remote', '--heads', 'origin')
  adoptionFault(f, 'checkout')
  const r = applyAdoption(f)
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.equal(f.state().adoptionCheckoutFailed, true)
  const result = JSON.parse(r.stdout), journal = JSON.parse(fs.readFileSync(result.journal, 'utf8'))
  assert.equal(f.runGit('rev-parse', 'codex/b'), rewritten)
  assert.equal(f.runGit('rev-parse', journal.remoteAdoption.entries[0].backupRef), oldB)
  assert.notEqual(journal.remoteAdoption.stage, 'complete')
  assert.equal(journal.state, 'unverified')
  assert.equal(f.runGit('branch', '--show-current'), '', 'checkout failure remains detached')
  const before = adoptionRefs(f), resumed = f.runStack(['sync', '--resume', result.journal])
  assert.notEqual(resumed.status, 0, resumed.stdout + resumed.stderr)
  assert.match(resumed.stderr, /adoption.*incomplete|incomplete.*adoption/)
  assert.deepEqual(adoptionRefs(f), before)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin'), remote)
  assert.equal(f.calls().some(a => a[0] === 'stack' && a[1] === 'rebase'), false)
})
test('sync adoption boundary retains the original remote lease after native rebase', t => {
  const { f, oldB, rewritten } = serverRewrittenPublishedLayer(t)
  // A later protected-trunk commit requires an actual rebase, hence publication.
  const oldTrunk = f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/develop').split('\t')[0]
  const newTrunk = f.runGit('commit-tree', `${oldTrunk}^{tree}`, '-p', oldTrunk, '-m', 'later protected trunk')
  f.runGit('push', 'origin', `${newTrunk}:refs/fixture/trunk-advance`)
  f.runGit('--git-dir', path.join(f.dir, 'origin'), 'update-ref', 'refs/heads/develop', newTrunk, oldTrunk)
  const writer = f.runGit('commit-tree', `${rewritten}^{tree}`, '-p', rewritten, '-m', 'remote writer before publication')
  f.runGit('push', 'origin', `${writer}:refs/fixture/concurrent-writer`)
  f.change(s => { for (const p of s.prs) p.stack.base.sha = newTrunk; s.concurrentPush = writer })
  const r = applyAdoption(f)
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.equal(f.state().rebaseCalled, true)
  assert.equal(f.state().writerRan, true, 'remote writer ran immediately before actual push')
  const result = JSON.parse(r.stdout), journal = JSON.parse(fs.readFileSync(result.journal, 'utf8'))
  assert.equal(journal.state, 'unverified')
  assert.equal(journal.remoteAdoption.stage, 'complete')
  assert.equal(f.runGit('rev-parse', journal.remoteAdoption.entries[0].backupRef), oldB)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b').split('\t')[0], writer)
  assert.equal(journal.before.layers.find(l => l.branch === 'codex/b').remoteOid, rewritten)
  const resumed = f.runStack(['sync', '--resume', result.journal])
  assert.notEqual(resumed.status, 0, resumed.stdout + resumed.stderr)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b').split('\t')[0], writer)
})
test('sync adoption proof journal bytes are bound to the preview', t => {
  const { f, publication } = serverRewrittenPublishedLayer(t)
  const preview = f.runStack(['sync'])
  assert.equal(preview.status, 0, preview.stdout + preview.stderr)
  // Even a semantic no-op must change the proof hash used by this preview.
  fs.appendFileSync(publication.journal, '\n')
  const before = adoptionRefs(f)
  const r = f.runStack(['sync', '--apply', '--expected', JSON.parse(preview.stdout).fingerprint])
  assert.notEqual(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stderr, /preview is stale/)
  assert.deepEqual(adoptionRefs(f), before)
  assert.equal(f.calls().some(a => a[0] === 'stack' && a[1] === 'rebase'), false)
})
test('sync successive adoption accepts the latest confirmed no-push publication proof', t => {
  const { f, oldB, rewritten } = serverRewrittenPublishedLayer(t)
  const first = applyAdoption(f)
  assert.equal(first.status, 0, first.stdout + first.stderr)
  const firstResult = JSON.parse(first.stdout)
  assert.equal(firstResult.state, 'confirmed')
  const firstJournal = JSON.parse(fs.readFileSync(firstResult.journal, 'utf8'))
  assert.equal(f.runGit('rev-parse', 'codex/b'), rewritten, 'first native rebase is genuinely a no-op')
  assert.ok(firstJournal.effects.some(e => e.kind === 'native-rebase' && e.state === 'returned'))
  assert.equal(firstJournal.effects.some(e => e.kind === 'push-observed-refs'), false, 'no push produced the first confirmed sync')
  assert.equal(f.runGit('rev-parse', firstJournal.remoteAdoption.entries[0].backupRef), oldB)
  const extra = path.join(f.dir, 'second-server-only.txt')
  fs.writeFileSync(extra, 'second distinct server rewrite content\n')
  const blob = f.runGit('hash-object', '-w', extra), index = path.join(f.dir, 'second-server-index')
  const indexed = (...args) => execFileSync(git, args, { cwd: f.repo, env: { ...process.env, GIT_INDEX_FILE: index }, encoding: 'utf8' }).trim()
  indexed('read-tree', `${rewritten}^{tree}`)
  indexed('update-index', '--add', '--cacheinfo', `100644,${blob},second-server-only.txt`)
  const parent = f.runGit('rev-parse', `${rewritten}^`)
  const secondRemote = f.runGit('commit-tree', indexed('write-tree'), '-p', parent, '-m', 'second independent server rewrite')
  f.runGit('push', 'origin', `${secondRemote}:refs/fixture/second-server-rewrite`)
  f.runGit('--git-dir', path.join(f.dir, 'origin'), 'update-ref', 'refs/heads/codex/b', secondRemote, rewritten)
  assert.equal(f.runGit('rev-parse', 'codex/b'), rewritten, 'local retains the immediately preceding confirmed OID')
  const second = applyAdoption(f)
  assert.equal(second.status, 0, second.stdout + second.stderr)
  const secondResult = JSON.parse(second.stdout)
  assert.equal(secondResult.state, 'confirmed')
  const secondJournal = JSON.parse(fs.readFileSync(secondResult.journal, 'utf8'))
  assert.equal(f.runGit('rev-parse', secondJournal.remoteAdoption.entries[0].backupRef), rewritten)
  assert.equal(f.runGit('rev-parse', firstJournal.remoteAdoption.entries[0].backupRef), oldB)
  assert.equal(f.runGit('show', 'codex/b:server-only.txt'), 'unique content added to rewritten remote b')
  assert.equal(f.runGit('show', 'codex/b:second-server-only.txt'), 'second distinct server rewrite content')
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b').split('\t')[0], f.runGit('rev-parse', 'codex/b'))
})

function publishServerB(f, name, fastForward = false) {
  const old = f.runGit('rev-parse', 'codex/b'), extra = path.join(f.dir, name)
  fs.writeFileSync(extra, `${name} server content\n`)
  const blob = f.runGit('hash-object', '-w', extra), index = path.join(f.dir, `${name}.index`)
  const indexed = (...args) => execFileSync(git, args, { cwd: f.repo, env: { ...process.env, GIT_INDEX_FILE: index }, encoding: 'utf8' }).trim()
  indexed('read-tree', `${old}^{tree}`)
  indexed('update-index', '--add', '--cacheinfo', `100644,${blob},${name}`)
  const parent = fastForward ? old : f.runGit('rev-parse', `${old}^`)
  const remote = f.runGit('commit-tree', indexed('write-tree'), '-p', parent, '-m', `server ${name}`)
  f.runGit('push', 'origin', `${remote}:refs/fixture/${name}`)
  f.runGit('--git-dir', path.join(f.dir, 'origin'), 'update-ref', 'refs/heads/codex/b', remote, old)
  f.change(s => { s.refreshPRs = true })
  return { old, remote }
}
function assertReceivedServerB(f, before, filename) {
  const r = applyAdoption(f)
  assert.equal(r.status, 0, r.stdout + r.stderr)
  const result = JSON.parse(r.stdout), journal = JSON.parse(fs.readFileSync(result.journal, 'utf8'))
  assert.equal(result.state, 'confirmed')
  assert.equal(f.runGit('rev-parse', journal.remoteAdoption.entries[0].backupRef), before.old)
  assert.equal(f.runGit('rev-parse', 'codex/b'), before.remote)
  assert.equal(f.runGit('show', `codex/b:${filename}`), `${filename} server content`)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b').split('\t')[0], before.remote)
}
test('sync confirmed readback proof survives a recovered unknown push effect', t => {
  const f = fixture(t); assert.equal(submit(f, plan(f)).status, 0)
  updateLower(f); f.change(s => { s.losePushResponse = true })
  const lost = rebase(f)
  assert.notEqual(lost.status, 0); assert.equal(f.state().responseLost, true)
  const lostResult = JSON.parse(lost.stdout), nativeCalls = f.calls().filter(a => a[0] === 'stack' && a[1] === 'rebase').length
  const resumed = rebase(f, 'restack', ['--resume', lostResult.journal])
  assert.equal(resumed.status, 0, resumed.stdout + resumed.stderr)
  const recovered = JSON.parse(fs.readFileSync(lostResult.journal, 'utf8'))
  assert.equal(recovered.state, 'confirmed')
  assert.ok(recovered.effects.some(e => e.kind === 'push-observed-refs' && e.state === 'unknown'))
  assert.equal(f.calls().filter(a => a[0] === 'stack' && a[1] === 'rebase').length, nativeCalls)
  assert.equal(f.runGit('rev-parse', 'codex/b'), f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/b').split('\t')[0])
  assertReceivedServerB(f, publishServerB(f, 'after-lost-push.txt'), 'after-lost-push.txt')
})
test('sync confirmed readback proof survives ordinary native fast-forward reception', t => {
  const f = fixture(t); assert.equal(submit(f, plan(f)).status, 0)
  const received = publishServerB(f, 'ordinary-ff.txt', true)
  assert.equal(f.runGit('merge-base', received.old, received.remote), received.old)
  const first = rebase(f, 'sync')
  assert.equal(first.status, 0, first.stdout + first.stderr)
  const firstResult = JSON.parse(first.stdout), journal = JSON.parse(fs.readFileSync(firstResult.journal, 'utf8'))
  assert.equal(firstResult.state, 'confirmed')
  assert.equal(f.runGit('rev-parse', 'codex/b'), received.remote, 'native rebase really received the remote fast-forward')
  assert.equal(journal.remoteAdoption, undefined)
  assert.equal(journal.effects.some(e => e.kind === 'push-observed-refs'), false)
  const next = publishServerB(f, 'after-ordinary-ff.txt')
  assertReceivedServerB(f, next, 'after-ordinary-ff.txt')
  assert.equal(f.runGit('show', 'codex/b:ordinary-ff.txt'), 'ordinary-ff.txt server content')
})

for (const flow of ['git-flow', 'main']) test(`${flow} independent stacks require separate previews and preserve unrelated refs`, t => {
  const f = fixture(t, () => {}, false, flow), trunk = flow === 'main' ? 'main' : 'develop'
  const existingA = f.runGit('rev-parse', 'codex/a'), existingB = f.runGit('rev-parse', 'codex/b')
  const body = path.join(f.dir, 'independent-body.md'); fs.writeFileSync(body, 'independent AC')
  const beforeRemote = f.runGit('ls-remote', '--heads', 'origin')
  const plans = []
  for (const branch of ['codex/c', 'codex/d']) {
    f.runGit('switch', '-c', branch, trunk)
    fs.writeFileSync(path.join(f.repo, branch.split('/')[1] + '.txt'), branch)
    f.runGit('add', '.'); f.runGit('commit', '-m', `independent ${branch}`)
    plans.push({ branch, oid: f.runGit('rev-parse', branch), file: path.join(f.dir, branch.split('/')[1] + '-plan.json') })
  }
  f.change(s => { s.prs = [] })
  const select = layer => {
    f.runGit('switch', layer.branch)
    f.change(s => { s.view.branches = [{ name: layer.branch, head: layer.oid, base: f.runGit('rev-parse', trunk), isMerged: false, isQueued: false, needsRebase: false }]; delete s.remote })
    fs.writeFileSync(layer.file, JSON.stringify({ schemaVersion: 1, layers: [{ branch: layer.branch, title: layer.branch, bodyFile: body }] }))
  }
  select(plans[0])
  const firstPreview = f.runStack(['submit', '--plan', plans[0].file])
  assert.equal(firstPreview.status, 0, firstPreview.stdout + firstPreview.stderr)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin'), beforeRemote, 'preview does not publish either independent stack')
  const firstFingerprint = JSON.parse(firstPreview.stdout).fingerprint
  select(plans[1])
  const beforeWrongApproval = f.runGit('ls-remote', '--heads', 'origin')
  const wrongApproval = f.runStack(['submit', '--plan', plans[1].file, '--apply', '--expected', firstFingerprint])
  assert.notEqual(wrongApproval.status, 0, wrongApproval.stdout + wrongApproval.stderr)
  assert.equal(f.runGit('ls-remote', '--heads', 'origin'), beforeWrongApproval)
  assert.equal(f.calls().some(a => a[0] === 'pr' && a[1] === 'create'), false)
  for (const layer of plans) {
    select(layer)
    const wrongParent = f.run(['--stack', '--base', 'codex/a', '--draft'])
    assert.notEqual(wrongParent.status, 0, wrongParent.stdout + wrongParent.stderr)
    const result = submit(f, layer.file)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.equal(JSON.parse(result.stdout).state, 'confirmed')
    const create = f.calls().filter(a => a[0] === 'pr' && a[1] === 'create').at(-1)
    assert.equal(create[create.indexOf('--head') + 1], layer.branch)
    assert.equal(create[create.indexOf('--base') + 1], trunk)
    assert.equal(create.includes('--draft'), false, 'each independent lowest layer may be ready')
    assert.equal(f.runGit('branch', '--show-current'), layer.branch, 'submit restores the owning branch')
    assert.equal(f.runGit('ls-remote', '--heads', 'origin', `refs/heads/${layer.branch}`).split('\t')[0], layer.oid)
  }
  assert.deepEqual(f.state().prs.map(p => [p.number, p.head.ref, p.base.ref]), [[13, 'codex/c', trunk], [14, 'codex/d', trunk]], 'both independent PRs coexist without a parent relationship')
  assert.equal(f.calls().some(a => a[0] === 'stack' && a[1] === 'link'), false, 'independent stacks must never be linked')
  assert.equal(f.runGit('rev-parse', 'codex/a'), existingA)
  assert.equal(f.runGit('rev-parse', 'codex/b'), existingB)
  for (const layer of plans) assert.equal(f.runGit('rev-parse', layer.branch), layer.oid, 'cleanup preserves both independent local branches')
  assert.equal(f.runGit('ls-remote', '--heads', 'origin', 'refs/heads/codex/a').split('\t')[0], existingA)
})

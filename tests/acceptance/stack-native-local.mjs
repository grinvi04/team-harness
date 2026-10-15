#!/usr/bin/env node
// Native rebase + real adapter + local bare Git; only GitHub REST inventory is doubled.
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const [source, output] = process.argv.slice(2)
assert.ok(source && output && path.isAbsolute(source) && path.isAbsolute(output), 'absolute binary and new evidence directory required')
assert.ok(!fs.existsSync(output), 'preserve prior attempts')
fs.mkdirSync(output, { recursive: true })
const workspace = fs.mkdtempSync(path.join(output, 'workspace-')), repo = path.join(workspace, 'repo'), origin = path.join(workspace, 'origin'), bin = path.join(workspace, 'bin')
for (const p of [repo, bin]) fs.mkdirSync(p)
const binary = path.join(bin, 'gh-stack'), adapter = path.resolve('plugins/harness-guard/scripts/stack.mjs')
fs.copyFileSync(source, binary);fs.chmodSync(binary, 0o700)
const env = { PATH: bin + path.delimiter + process.env.PATH, HOME: workspace, GH_CONFIG_DIR: path.join(workspace, 'empty-auth'),
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1',
  GIT_EDITOR: 'true', GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' }
const commands = [], cases = []
const save = () => fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(commands, null, 2) + '\n')
function run(argv, expected = 0) {
  const r = spawnSync(argv[0], argv.slice(1), { cwd: repo, env, encoding: 'utf8', timeout: 30000 })
  const record = { argv: argv.map(x => x === binary ? 'pinned-native-binary' : x), status: r.status, stdout: r.stdout, stderr: r.stderr }
  commands.push(record);save()
  if (expected !== null) assert.equal(r.status, expected, JSON.stringify(record))
  return r
}
const git = (...a) => run(['git', ...a]).stdout.trim()
const native = (...a) => run([binary, ...a])
function commit(file, value) { fs.writeFileSync(path.join(repo, file), value);git('add', file);git('commit','-m','fixture update') }
function apply(extra = [], expected = 0) {
  const preview = run([process.execPath, adapter, 'restack', ...extra])
  const result = run([process.execPath, adapter, 'restack', ...extra, '--apply', '--expected', JSON.parse(preview.stdout).fingerprint], expected)
  return JSON.parse(result.stdout)
}
let verdict = 'FAIL', reason
try {
  if (process.platform === 'darwin') run(['codesign', '--sign', '-', '--force', binary])
  assert.match(native('--version').stdout, /^gh stack version 0\.2\.1/)
  const actualGit = run(['which','git']).stdout.trim()
  fs.writeFileSync(path.join(bin, 'git'), `#!${process.execPath}\nconst cp=require('node:child_process'),a=process.argv.slice(2);if(a.join(' ')==='remote get-url origin'||a.join(' ')==='remote get-url --push --all origin')console.log('https://github.com/org/repo.git');else{const r=cp.spawnSync(${JSON.stringify(actualGit)},a,{stdio:'inherit'});process.exit(r.status??1)}\n`, { mode: 0o700 })
  fs.writeFileSync(path.join(bin, 'gh'), `#!${process.execPath}\nconst cp=require('node:child_process'),a=process.argv.slice(2);if(a[0]==='stack'){const r=cp.spawnSync(${JSON.stringify(binary)},a.slice(1),{stdio:'inherit'});process.exit(r.status??1)}else if(a[0]==='api'&&a.includes('GET')&&a.at(-1).startsWith('repos/org/repo/pulls?'))console.log('[]');else process.exit(99);\n`, { mode: 0o700 })
  git('init','-b','develop');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid')
  fs.writeFileSync(path.join(repo,'.harness-policy.json'),JSON.stringify({schemaVersion:1,mode:'company',autoMergeTargets:[],branchFlow:'git-flow',stackedPRs:{enabled:true,provider:'github-gh-stack'}}))
  commit('shared.txt','original\n');git('add','.harness-policy.json');git('commit','-m','fixture policy')
  native('init','--base','develop','codex/a');commit('a.txt','a\n')
  native('add','codex/b');commit('shared.txt','child\n')
  native('add','codex/c');commit('c.txt','c\n')
  git('init','--bare',origin);git('remote','add','origin',origin);git('push','origin','develop','codex/a','codex/b','codex/c')
  git('switch','codex/a');commit('a2.txt','lower update\n');git('switch','codex/c')
  const normal=apply();assert.equal(normal.state,'confirmed')
  for(const b of ['codex/a','codex/b','codex/c'])assert.equal(git('ls-remote','--heads','origin','refs/heads/'+b).split('\t')[0],git('rev-parse',b))
  assert.equal(git('show','codex/c:a2.txt'),'lower update');cases.push({id:'native-three-layer-restack',state:'PASS'})
  git('switch','codex/a');commit('shared.txt','parent\n');git('switch','codex/c')
  const before=git('ls-remote','--heads','origin'), local=git('for-each-ref','--format=%(refname) %(objectname)','refs/heads')
  const conflict=apply([],1);assert.equal(conflict.state,'unverified');assert.equal(git('ls-remote','--heads','origin'),before)
  native('rebase','--abort')
  assert.equal(git('for-each-ref','--format=%(refname) %(objectname)','refs/heads'),local)
  const aborted=apply(['--resume',conflict.journal]);assert.equal(aborted.state,'aborted');assert.equal(git('ls-remote','--heads','origin'),before)
  cases.push({id:'native-conflict-abort-journal',state:'PASS'})
  const again=apply([],1);assert.equal(again.state,'unverified')
  fs.writeFileSync(path.join(repo,'shared.txt'),'resolved parent and child\n');git('add','shared.txt');native('rebase','--continue')
  const resumed=apply(['--resume',again.journal]);assert.equal(resumed.state,'confirmed')
  assert.equal(git('show','codex/c:shared.txt'),'resolved parent and child')
  assert.equal(git('ls-remote','--heads','origin','refs/heads/codex/c').split('\t')[0],git('rev-parse','codex/c'))
  assert.equal(git('branch','--show-current'),'codex/c');cases.push({id:'native-conflict-continue-journal',state:'PASS'})
  verdict='PASS'
} catch(e) { reason=e.message;process.exitCode=1 }
finally {
  fs.rmSync(workspace,{recursive:true,force:true})
  const result={verdict,reason,cases,binaryDigest:createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
    scope:'native v0.2.1 + actual Harness adapter + bare Git; GitHub inventory doubled; no global installation or remote service changes',cleanup:!fs.existsSync(workspace)}
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}

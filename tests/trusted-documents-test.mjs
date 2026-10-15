import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import test from 'node:test'
const root = process.cwd()
const yaml = file => JSON.parse(execFileSync('ruby', ['-ryaml', '-rjson', '-e', 'puts JSON.generate(YAML.safe_load(File.read(ARGV[0])))', file], { encoding: 'utf8' }))
test('required trusted commitlint includes repository-only document validation from protected source', () => {
  const template = yaml('templates/ci/commitlint.yml'), deployed = yaml('.github/workflows/commitlint-trusted.yml')
  const steps = deployed.jobs['commitlint-trusted'].steps
  assert.deepEqual(steps.slice(0, 2), template.jobs['commitlint-trusted'].steps)
  assert.equal(steps.length, 4)
  assert.equal(steps[2].with.ref, '${{ github.event.pull_request.head.sha }}')
  assert.equal(steps[2].with['persist-credentials'], false)
  assert.equal(steps[2].with.path, '.runtime/doc-sync-candidate')
  assert.match(steps[3].run, /node "\$GITHUB_WORKSPACE\/plugins\/harness-guard\/scripts\/check-document-sync.mjs"/)
  assert.match(steps[3].run, /--committed/)
  assert.doesNotMatch(steps[3].run, /cd |npm |source /)
  assert.equal((deployed.on || deployed.true).pull_request_target.types.includes('stacked'), true)
})
test('candidate checker replacement or workflow deletion cannot replace trusted document gate', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trusted-docs-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const candidate = path.join(dir, '.runtime/doc-sync-candidate'), trusted = path.join(dir, 'plugins/harness-guard/scripts')
  fs.mkdirSync(candidate, { recursive: true });fs.mkdirSync(trusted, { recursive: true })
  fs.copyFileSync(path.join(root, 'plugins/harness-guard/scripts/check-document-sync.mjs'), path.join(trusted, 'check-document-sync.mjs'))
  const git = args => execFileSync('git', args, { cwd: candidate, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim()
  git(['init']);git(['config','user.name','fixture']);git(['config','user.email','fixture@example.invalid'])
  fs.mkdirSync(path.join(candidate,'plugins/harness-guard/scripts'),{recursive:true})
  fs.writeFileSync(path.join(candidate,'plugins/harness-guard/scripts/check-document-sync.mjs'),'process.exit(0)\n')
  git(['add','.']);git(['-c','core.hooksPath=/dev/null','commit','-m','candidate removes policy workflow'])
  const sha = git(['rev-parse','HEAD']), event = path.join(dir,'event.json')
  fs.writeFileSync(event, JSON.stringify({ pull_request: { body: 'missing declaration' } }))
  const script = yaml('.github/workflows/commitlint-trusted.yml').jobs['commitlint-trusted'].steps[3].run
  const run = head => spawnSync('bash',['-euo','pipefail','-c',script], { cwd: dir, encoding:'utf8',
    env:{...process.env,GITHUB_WORKSPACE:dir,GITHUB_EVENT_PATH:event,HEAD_SHA:head} })
  const bad=run(sha);assert.notEqual(bad.status,0);assert.match(bad.stderr,/DECLARATION/)
  fs.writeFileSync(event,JSON.stringify({pull_request:{body:'```harness-doc-sync\n{"version":1,"noImpact":"fixture"}\n```'}}))
  assert.equal(run(sha).status,0)
  assert.notEqual(run('f'.repeat(40)).status,0)
  assert.equal(fs.readFileSync(path.join(trusted,'check-document-sync.mjs'),'utf8'),fs.readFileSync(path.join(root,'plugins/harness-guard/scripts/check-document-sync.mjs'),'utf8'))
})

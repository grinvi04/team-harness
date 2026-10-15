#!/usr/bin/env node
// Opt-in upstream compatibility probes. Never installs or mutates remote state.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { digest } from './evidence.mjs';

const args = process.argv.slice(2);
const mode = args.shift();
if (!['--local', '--live-readonly'].includes(mode) || args.length !== 2 || !args.every(path.isAbsolute)) {
  console.error('Usage: gh-stack-compatibility.mjs --local|--live-readonly ABS_XDG_DATA_HOME NEW_ABS_EVIDENCE_DIR');
  process.exit(2);
}
const [dataHome, out] = args;
assert.ok(!existsSync(out), 'preserve earlier attempts; use a new evidence directory');
mkdirSync(out, { recursive: true });
const extension = path.join(dataHome, 'gh/extensions/gh-stack');
const manifest = readFileSync(path.join(extension, 'manifest.yml'), 'utf8');
assert.match(manifest, /^tag: v0\.2\.1$/m);
assert.match(manifest, /^ispinned: true$/m);
const inherited = Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL','GH_CONFIG_DIR','GH_TOKEN','GITHUB_TOKEN'].filter(k=>process.env[k] !== undefined).map(k=>[k,process.env[k]]));
const env = { ...inherited, GH_HOST: 'github.com', XDG_DATA_HOME: dataHome, GH_NO_EXTENSION_UPDATE_NOTIFIER: '1',
  GH_NO_UPDATE_NOTIFIER: '1', GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_EDITOR: 'true',
  GIT_AUTHOR_NAME: 'G0 Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'G0 Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
const commands = [], cases = [], workspaces = [];
const write = (name, value) => writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
function run(cwd, argv, expected = 0) {
  const r = spawnSync(argv[0], argv.slice(1), { cwd, env, encoding: 'utf8', timeout: 30_000 });
  const record = { cwd, argv, exitCode: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || '' };
  commands.push(record); write('commands.json', commands);
  if (expected !== null) assert.equal(r.status, expected, JSON.stringify(record));
  return record;
}
const git = (cwd, ...argv) => run(cwd, ['git', ...argv]).stdout.trim();
const stack = (cwd, ...argv) => run(cwd, ['gh', 'stack', ...argv]);
function commit(cwd, name, content) {
  writeFileSync(path.join(cwd, name), content);
  git(cwd, 'add', name); git(cwd, 'commit', '-qm', `fixture: ${name}`);
}
function fixture(name) {
  const cwd = mkdtempSync(path.join(out, name + '-')); workspaces.push(cwd);
  git(cwd, 'init', '-q', '-b', 'develop'); commit(cwd, 'shared.txt', 'original\n');
  return cwd;
}
function refs(cwd) { return git(cwd, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'); }
function check(id, fn) {
  const firstCommand = commands.length;
  try { fn(); cases.push({ id, verdict: 'PASS', firstCommand, lastCommand: commands.length - 1 }); }
  catch (error) { cases.push({ id, verdict: 'FAIL', firstCommand, lastCommand: commands.length - 1, error: error.message }); throw error; }
  finally { write('cases.json', cases); }
}
let error;
try {
  write('environment.json', { checkedAt: new Date().toISOString(), node: process.version, platform: process.platform,
    arch: process.arch, manifest, binaryDigest: digest(readFileSync(path.join(extension, 'gh-stack'))),
    gh: run(out, ['gh', '--version']).stdout, git: run(out, ['git', '--version']).stdout,
    extension: run(out, ['gh', 'stack', '--version']).stdout });
  if (mode === '--live-readonly') {
    const repo = 'grinvi04/team-harness-acceptance-lab';
    check('target-api-readable', () => {
      const response = run(out, ['gh', 'api', `repos/${repo}/stacks`]);
      assert.ok(Array.isArray(JSON.parse(response.stdout)));
    });
    for (const branch of ['main', 'develop']) {
      check(`${branch}-protection-readable`, () => {
        const r = run(out, ['gh', 'api', `repos/${repo}/branches/${branch}/protection`]);
        write(`${branch}-protection.json`, JSON.parse(r.stdout));
      });
    }
  } else {
    const cwd = fixture('three-layer');
    check('explicit-develop-three-layer', () => {
      stack(cwd, 'init', '--base', 'develop', 'codex/a'); commit(cwd, 'a.txt', 'a\n');
      stack(cwd, 'add', 'codex/b'); commit(cwd, 'b.txt', 'b\n');
      stack(cwd, 'add', 'codex/c'); commit(cwd, 'c.txt', 'c\n');
      assert.equal(git(cwd, 'branch', '--show-current'), 'codex/c');
      for (const [a,b] of [['develop','codex/a'],['codex/a','codex/b'],['codex/b','codex/c']]) git(cwd, 'merge-base', '--is-ancestor', a, b);
      const view = stack(cwd, 'view', '--json'); write('three-layer-view.json', JSON.parse(view.stdout));
      assert.equal(run(cwd, ['git', 'config', '--local', '--get', 'rerere.enabled'], 1).stdout, '');
    });
    check('cascading-rebase', () => {
      git(cwd, 'switch', 'codex/a'); commit(cwd, 'a2.txt', 'a2\n');
      git(cwd, 'switch', 'codex/c'); stack(cwd, 'rebase', '--no-trunk');
      git(cwd, 'merge-base', '--is-ancestor', 'codex/a', 'codex/b');
      git(cwd, 'merge-base', '--is-ancestor', 'codex/b', 'codex/c');
      assert.equal(git(cwd, 'show', 'codex/c:a2.txt'), 'a2');
    });
    check('dirty-other-worktree-preserved', () => {
      const other = path.join(out, 'owned-worktree'); workspaces.push(other);
      git(cwd, 'worktree', 'add', other, 'codex/b');
      writeFileSync(path.join(other, 'b.txt'), 'OWNER DIRTY\n');
      git(cwd, 'switch', 'codex/a'); commit(cwd, 'a3.txt', 'a3\n'); git(cwd, 'switch', 'codex/c');
      const before = refs(cwd), status = git(other, 'status', '--porcelain');
      const r = run(cwd, ['gh', 'stack', 'rebase', '--no-trunk'], null);
      assert.notEqual(r.exitCode, 0, 'must not silently overwrite a dirty owner');
      assert.equal(readFileSync(path.join(other, 'b.txt'), 'utf8'), 'OWNER DIRTY\n');
      assert.equal(git(other, 'status', '--porcelain'), status);
      assert.equal(refs(cwd), before, 'failed preflight must preserve refs');
      // Discard only the synthetic edit created by this probe, then remove its worktree.
      git(other, 'restore', 'b.txt'); git(cwd, 'worktree', 'remove', other);
    });
    check('conflict-abort-restores-all-layer-refs', () => {
      const conflict = fixture('conflict');
      stack(conflict, 'init', '--base', 'develop', 'codex/x'); commit(conflict, 'x.txt', 'x\n');
      stack(conflict, 'add', 'codex/y'); commit(conflict, 'shared.txt', 'child\n');
      stack(conflict, 'add', 'codex/z'); commit(conflict, 'z.txt', 'z\n');
      git(conflict, 'switch', 'codex/x'); commit(conflict, 'shared.txt', 'parent\n'); git(conflict, 'switch', 'codex/z');
      const before = refs(conflict);
      const r = run(conflict, ['gh', 'stack', 'rebase', '--no-trunk'], null);
      assert.notEqual(r.exitCode, 0); assert.ok(git(conflict, 'diff', '--name-only', '--diff-filter=U').includes('shared.txt'));
      stack(conflict, 'rebase', '--abort');
      assert.equal(refs(conflict), before);
      assert.equal(git(conflict, 'status', '--porcelain'), '');
      assert.equal(git(conflict, 'branch', '--show-current'), 'codex/z');
    });
    check('existing-rerere-setting-preserved', () => {
      git(cwd, 'config', '--local', 'rerere.enabled', 'true');
      stack(cwd, 'view', '--json');
      assert.equal(git(cwd, 'config', '--local', '--get', 'rerere.enabled'), 'true');
      git(cwd, 'config', '--local', '--unset', 'rerere.enabled');
      const r = run(cwd, ['git', 'config', '--local', '--get', 'rerere.enabled'], 1);
      assert.equal(r.stdout, '');
    });
  }
} catch (e) { error = e; }
finally {
  // Only controller-created local directories; retain raw commands and failure evidence.
  for (const cwd of workspaces.reverse()) rmSync(cwd, { recursive: true, force: true });
  write('result.json', { mode, verdict: error ? 'FAIL' : 'PASS_SCOPED', cases,
    g0: 'UNVERIFIED', missing: ['remote URL link', 'wrong SHA rejection', 'lowest merge and retarget',
      'composition/base race', '409 options', 'response loss', 'delayed merge and solo protection restore'],
    cleanup: 'controller-created local fixtures removed; extension retained in isolated data directory' });
}
if (error) { console.error(error.message); process.exitCode = 1; }
else console.log(`${mode}: ${cases.length} checks passed; G0 remains UNVERIFIED (live mutations not run)`);

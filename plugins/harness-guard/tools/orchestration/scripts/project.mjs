#!/usr/bin/env node
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
function fail(message) { throw new Error(message); }
function directory(path) { try { return lstatSync(path).isDirectory(); } catch { return false; } }
function assertRoot(value) {
  const root = resolve(value);
  if (!directory(root)) fail('ROOT must be an existing directory');
  const git = spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (git.status !== 0 || realpathSync(git.stdout.trim()) !== realpathSync(root)) fail('ROOT must be the exact Git working-tree root');
  return root;
}
function ensureDirectory(path) {
  try { mkdirSync(path); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  if (!directory(path)) fail('unsafe work record parent');
}

function gitHead(root) {
  const result = spawnSync('git', ['-C', root, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'UNCOMMITTED (HEAD is unborn)';
}

function requestBlock(request) {
  const runs = request.match(/`+/g) ?? [];
  const delimiter = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
  return `${delimiter}text\n${request}\n${delimiter}`;
}

function start(root, slug, request) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) fail('SLUG must use lowercase letters, digits, and single hyphens (max 64)');
  const template = readFileSync(join(packageRoot, 'docs/templates/work-item.md'), 'utf8');
  const replacements = { REQUEST: requestBlock(request), BASE_REF: gitHead(root), TASK_ID: slug };
  const document = template.replace(/{{(REQUEST|BASE_REF|TASK_ID)}}/g, (_, token) => replacements[token]);
  ensureDirectory(join(root, 'docs'));
  ensureDirectory(join(root, 'docs/orchestration'));
  const relative = `docs/orchestration/${slug}.md`;
  writeFileSync(join(root, relative), document, { flag: 'wx', mode: 0o600 });
  return `created ${relative}`;
}

function main(argv) {
  const [command, rootArg, slug, request] = argv;
  if (command !== 'start' || !rootArg || argv.length !== 4) {
    process.stderr.write('Usage: ao-project start ROOT SLUG REQUEST\n'); return 2;
  }
  try {
    process.stdout.write(`${start(assertRoot(rootArg), slug, request)}\n`); return 0;
  } catch (error) { process.stderr.write(`ao-project: ${error.message}\n`); return 1; }
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));

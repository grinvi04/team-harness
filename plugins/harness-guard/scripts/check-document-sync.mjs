#!/usr/bin/env node
// Explicit declarations only. This checks links/state, never Markdown meaning.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const fail = (code, message) => { throw new Error(`${code}: ${message}`); };
const text = value => typeof value === 'string' && value.trim().length > 0;
function shape(value, allowed, required = []) {
  if (!value || Array.isArray(value) || typeof value !== 'object' ||
      Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !(key in value))) {
    fail('SCHEMA', `expected fields: ${allowed.join(', ')}`);
  }
}
function declaration(markdown) {
  const starts = markdown.match(/^```harness-doc-sync\s*$/gm) || [];
  const matches = [...markdown.matchAll(/^```harness-doc-sync\s*\n([\s\S]*?)^```\s*$/gm)];
  if (starts.length !== 1 || matches.length !== 1) fail('DECLARATION', 'exactly one closed harness-doc-sync block required');
  try { return JSON.parse(matches[0][1]); } catch { fail('SCHEMA', 'invalid JSON'); }
}
function check(repo, input, committed) {
  const root = fs.realpathSync(repo);
  const loaded = new Map();
  function checkCommitted() {
    if (!committed) return;
    for (const [relative, bytes] of loaded) {
      const result = spawnSync('git', ['-C', root, 'show', `HEAD:${relative}`]);
      if (result.status !== 0 || !bytes.equals(result.stdout)) {
        fail('COMMITTED', `file is missing from HEAD or differs: ${relative}`);
      }
    }
  }
  function file(relative) {
    if (!text(relative) || path.isAbsolute(relative) || relative.includes('\\') ||
        relative.split('/').some(part => ['', '.', '..'].includes(part))) fail('PATH', 'repository-relative file required');
    let current = root;
    for (const part of relative.split('/')) {
      current = path.join(current, part);
      if (!fs.existsSync(current) || fs.lstatSync(current).isSymbolicLink()) fail('PATH', `missing or symlink: ${relative}`);
    }
    if (!fs.statSync(current).isFile()) fail('PATH', `not a file: ${relative}`);
    const bytes = fs.readFileSync(current);
    loaded.set(relative, bytes);
    return bytes;
  }
  function git(args, allowed = [0]) {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    if (result.error || !allowed.includes(result.status)) fail('GIT', `cannot inspect ${args[0]}`);
    return result;
  }
  let data = declaration(input);
  if (data?.record !== undefined) {
    shape(data, ['version', 'record'], ['version', 'record']);
    if (data.version !== 1) fail('SCHEMA', 'version must be 1');
    data = declaration(file(data.record).toString('utf8'));
  }
  shape(data, ['version', 'noImpact', 'documents', 'items'], ['version']);
  if (data.version !== 1) fail('SCHEMA', 'version must be 1');
  if ('noImpact' in data) {
    if (!text(data.noImpact) || 'documents' in data || 'items' in data) fail('SCHEMA', 'noImpact requires a reason and no targets');
    checkCommitted();
    return;
  }
  if (!Array.isArray(data.documents) || !data.documents.length) fail('DOCUMENTS', 'declare related documents');
  if (!Array.isArray(data.items)) fail('SCHEMA', 'items must be an array (empty for documents without task checkboxes)');
  const documents = new Map();
  for (const doc of data.documents) {
    shape(doc, ['path', 'reason'], ['path', 'reason']);
    if (!text(doc.reason) || documents.has(doc.path)) fail('SCHEMA', 'unique document and reason required');
    documents.set(doc.path, file(doc.path).toString('utf8'));
  }
  const seen = new Set();
  for (const item of data.items) {
    shape(item, ['document', 'item', 'state', 'evidence', 'resume'], ['document', 'item', 'state']);
    if (!documents.has(item.document) || !text(item.item) || !['done', 'pending', 'deferred'].includes(item.state)) {
      fail('SCHEMA', 'item requires declared document, checkbox text and done/pending/deferred state');
    }
    const key = JSON.stringify([item.document, item.item]);
    if (seen.has(key)) fail('ITEM', 'duplicate declaration');
    seen.add(key);
    // Ignore code examples. Match exactly one task label, never all unchecked boxes.
    let fence = null;
    const boxes = [];
    for (const line of documents.get(item.document).split(/\r?\n/)) {
      const marker = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
        continue;
      }
      if (fence) continue;
      const box = line.match(/^ {0,3}[-*+] \[([ xX])\] (.+?)\s*$/);
      if (box && box[2] === item.item) boxes.push(box[1].toLowerCase() === 'x');
    }
    if (boxes.length !== 1) fail('ITEM', `${item.document}: checkbox label must match once: ${item.item}`);
    if (boxes[0] !== (item.state === 'done')) fail('STATE', `${item.document}: checkbox contradicts ${item.state}: ${item.item}`);
    if (item.state !== 'done' && !text(item.resume)) fail('RESUME', 'pending/deferred requires next action or resume condition');
    if (item.state === 'done' && 'resume' in item) fail('SCHEMA', 'done must not retain a resume condition');
    if (!item.evidence) {
      if (item.state === 'done') fail('EVIDENCE', 'done requires evidence');
      continue;
    }
    const evidence = item.evidence;
    if ('path' in evidence) {
      shape(evidence, ['path', 'sha256'], ['path', 'sha256']);
      if (!/^[a-f0-9]{64}$/.test(evidence.sha256)) fail('SCHEMA', 'full lowercase sha256 required');
      const actual = createHash('sha256').update(file(evidence.path)).digest('hex');
      if (actual !== evidence.sha256) fail('STALE', `evidence changed: ${evidence.path}`);
    } else {
      shape(evidence, ['tag', 'commit'], ['tag', 'commit']);
      if (!text(evidence.tag) || !/^[a-f0-9]{40}$/.test(evidence.commit)) fail('SCHEMA', 'tag and full commit SHA required');
      git(['rev-parse', '--git-dir']);
      git(['check-ref-format', `refs/tags/${evidence.tag}`]);
      git(['cat-file', '-e', `${evidence.commit}^{commit}`]);
      const exists = git(['show-ref', '--verify', '--quiet', `refs/tags/${evidence.tag}`], [0, 1]).status === 0;
      if (item.state !== 'done' && exists) fail('RELEASED', `tag already exists; update waiting item: ${evidence.tag}`);
      if (item.state === 'done') {
        if (!exists) fail('TAG', `missing release tag: ${evidence.tag}`);
        const result = git(['merge-base', '--is-ancestor', evidence.commit, `refs/tags/${evidence.tag}^{commit}`], [0, 1]);
        if (result.status !== 0) fail('ANCESTRY', 'release tag does not contain the declared commit');
      }
    }
  }
  checkCommitted();
}
try {
  const args = process.argv.slice(2), options = {};
  while (args.length) {
    const flag = args.shift();
    if (flag === '--committed' && !options[flag]) { options[flag] = true; continue; }
    if (!['--repo', '--record', '--event'].includes(flag) || options[flag] || !args.length) fail('USAGE', '--repo DIR and exactly one of --record FILE / --event FILE');
    options[flag] = args.shift();
  }
  if (Boolean(options['--record']) === Boolean(options['--event'])) fail('USAGE', 'exactly one record or event required');
  const input = options['--record'] ? fs.readFileSync(options['--record'], 'utf8') :
    JSON.parse(fs.readFileSync(options['--event'], 'utf8')).pull_request?.body;
  if (typeof input !== 'string') fail('DECLARATION', 'PR body is missing');
  check(options['--repo'] || '.', input, options['--committed']);
  console.log('document-sync: PASS (declared scope only; meaning and omitted targets require review)');
} catch (error) {
  console.error(`document-sync: ${error.message}`);
  process.exitCode = 1;
}

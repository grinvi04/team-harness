#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
node --input-type=module - "$ROOT" <<'NODE'
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
const root = process.argv[2];
const { readHistoryBlob } = await import(pathToFileURL(`${root}/tests/lib/read-history-blob.mjs`));
const commit = '54657b3ef79ab36c3e0877664964356badd3510b';
const path = 'docs/decisions-native-and-delivery.md';
const digest = '46e60e1c5f507e5b1d89c85c8906f840f81dd28c919a34f39b2542e50b654d5f';
const original = execFileSync('git', ['--no-replace-objects', '-C', root, 'show', `${commit}:${path}`]);
assert.deepEqual(readHistoryBlob(root, commit, path, digest), original);
assert.equal(createHash('sha256').update(original).digest('hex'), digest);
const cli = (...args) => spawnSync(process.execPath, [`${root}/tests/lib/read-history-blob.mjs`, root, ...args]);
assert.deepEqual(cli(commit, path, digest).stdout, original);
for (const args of [[commit, path, '0'.repeat(64)], [commit, path], [commit, 'docs/missing-history.md', digest]]) {
  const result = cli(...args);
  assert.equal(result.status, 1);
  assert.equal(result.stdout.length, 0);
}
for (const [ref, target, hash] of [
  [commit, 'docs/missing-history.md', digest],
  ['0'.repeat(40), path, digest],
  [commit, path, '0'.repeat(64)],
  [commit.slice(0, 7), path, digest],
  [commit, path, ''],
  ...['../docs/x', '/docs/x', 'docs/../x', 'docs//x', 'docs/./x', 'docs/x\n', 'docs/x\u0085', 'docs/x:bad', 'docs\\x'].map(p => [commit, p, digest]),
]) assert.throws(() => readHistoryBlob(root, ref, target, hash));
const fixture = mkdtempSync(`${tmpdir()}/harness-history-`);
const git = (...args) => execFileSync('git', ['-C', fixture, ...args], { env: { ...process.env,
  GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' } });
try {
  git('init', '-q');
  writeFileSync(`${fixture}/evidence.txt`, 'original bytes\n');
  git('add', 'evidence.txt'); git('commit', '-qm', 'original');
  const first = git('rev-parse', 'HEAD').toString().trim();
  writeFileSync(`${fixture}/evidence.txt`, 'replacement bytes\n');
  git('add', 'evidence.txt'); git('commit', '-qm', 'replacement');
  const replacement = git('rev-parse', 'HEAD').toString().trim();
  git('replace', first, replacement);
  const expected = Buffer.from('original bytes\n');
  assert.deepEqual(readHistoryBlob(fixture, first, 'evidence.txt',
    createHash('sha256').update(expected).digest('hex')), expected);
} finally { rmSync(fixture, { recursive: true, force: true }); }
console.log('PASS: fixed Git bytes, missing blob/commit/digest, mismatch and unsafe paths fail closed');
NODE

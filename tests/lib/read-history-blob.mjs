#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Historical evidence has no working-tree fallback: every caller pins both origin and bytes.
export function readHistoryBlob(root, commit, repoPath, digest) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('history commit must be a full lowercase SHA');
  if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error('history digest must be a lowercase SHA-256');
  if (typeof repoPath !== 'string' || !repoPath || /[\p{Cc}\s\\:]/u.test(repoPath)
      || repoPath.startsWith('/') || repoPath.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('history path must be a normalized repository-relative path');
  }
  const bytes = execFileSync('git', ['--no-replace-objects', '-C', root, 'show', `${commit}:${repoPath}`],
    { maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error(`history digest mismatch: ${repoPath}`);
  return bytes;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 6) throw new Error('usage: read-history-blob.mjs <repo> <full-commit> <path> <sha256>');
    process.stdout.write(readHistoryBlob(...process.argv.slice(2)));
  } catch (error) {
    console.error(`FAIL: historical evidence unavailable: ${error.message}`);
    process.exitCode = 1;
  }
}

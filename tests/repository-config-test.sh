#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/sync-repository-config.mjs" --check
ROOT="$ROOT" node --input-type=module <<'NODE'
import assert from 'node:assert/strict'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const { deploymentCopies, syncRepositoryConfig } = await import(pathToFileURL(path.join(process.env.ROOT, 'scripts/sync-repository-config.mjs')))
const fixture = mkdtempSync(path.join(os.tmpdir(), 'harness-config-'))
try {
  for (const [source, target] of deploymentCopies) {
    for (const file of [source, target]) {
      mkdirSync(path.dirname(path.join(fixture, file)), { recursive: true })
      copyFileSync(path.join(process.env.ROOT, file), path.join(fixture, file))
    }
  }
  const [source, target] = deploymentCopies[0]
  writeFileSync(path.join(fixture, target), '# drift\n')
  assert.deepEqual(syncRepositoryConfig(fixture), [target])
  assert.equal(readFileSync(path.join(fixture, target), 'utf8'), '# drift\n', 'check must not write')
  syncRepositoryConfig(fixture, true)
  assert.deepEqual(syncRepositoryConfig(fixture), [])
  assert.ok(readFileSync(path.join(fixture, source)).equals(readFileSync(path.join(fixture, target))))
  chmodSync(path.join(fixture, target), 0o644)
  assert.deepEqual(syncRepositoryConfig(fixture), [target], 'executable hook mode is part of deployment')
  syncRepositoryConfig(fixture, true)
  assert.deepEqual(syncRepositoryConfig(fixture, true), [], 'generation must be idempotent')
  console.log('PASS: deployment bytes, executable mode, read-only check and deterministic recovery')
} finally { rmSync(fixture, { recursive: true, force: true }) }
NODE

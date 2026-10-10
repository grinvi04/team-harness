import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const scripts = [
  'codex-secret-egress-guard-test.sh',
  'codex-skill-mapping-test.sh',
  'claude-surface-isolation-test.sh',
  'codex-native-loader-report-test.sh',
];

function runWithSearchFailure(script, status, authStage = null) {
  const directory = mkdtempSync(join(tmpdir(), 'harness-search-failure-'));
  try {
    const body = authStage
      ? `case "$*" in
  *github_pat_*) exit 1 ;;
  *' -v '*|-v*) exit ${authStage === 'filter' ? status : 1} ;;
  *) ${authStage === 'producer' ? `exit ${status}` : "printf '%s\\n' 'synthetic auth.json fixture'; exit 0"} ;;
esac`
      : `exit ${status}`;
    writeFileSync(join(directory, 'rg'), `#!/bin/bash\n${body}\n`, { mode: 0o755 });
    return spawnSync('bash', [join(root, 'tests', script)], {
      cwd: root,
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

for (const script of scripts) {
  for (const status of [2, 127]) {
    test(`${script} rejects search execution failure ${status}`, () => {
      const result = runWithSearchFailure(script, status);
      assert.ifError(result.error);
      assert.notEqual(result.status, 0, `search failed, but test passed:\n${result.stdout}`);
    });
  }
}

for (const status of [2, 127]) {
  test(`report rejects auth-path filter execution failure ${status}`, () => {
    const result = runWithSearchFailure('codex-native-loader-report-test.sh', status, 'filter');
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, `auth filter failed, but test passed:\n${result.stdout}`);
  });
}

for (const status of [2, 127]) {
  test(`report rejects auth-path producer execution failure ${status}`, () => {
    const result = runWithSearchFailure('codex-native-loader-report-test.sh', status, 'producer');
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, `auth producer failed, but test passed:\n${result.stdout}`);
  });
}

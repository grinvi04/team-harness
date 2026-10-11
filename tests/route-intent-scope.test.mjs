import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decide, isActionable } from '../plugins/harness-guard/scripts/route-intent.mjs'

const states = [
  { branch: '', hasSpec: true },
  { branch: 'develop', hasSpec: true },
  { branch: 'feature/x', committed: true },
  { branch: 'codex/x', committed: true, hasSpec: true },
  { branch: 'feature/x', openPR: 5, isSolo: false },
  { branch: 'feature/x', openPR: 5, isSolo: true },
]

for (const prompt of [
  '진행해', '계속해', '해줘', 'go ahead', 'proceed', '정리해줘',
  '이 문장을 복사해줘: 머지해', '머지하지 말고 구현해줘', '머지해도 될까?',
  '배포해줘', '커밋해줘', '구현해줘 그리고 머지해줘', 'please merge it later',
]) {
  test(`unrelated or ambiguous request does not select a phase: ${prompt}`, () => {
    assert.equal(isActionable(prompt), false)
    for (const state of states) assert.deepEqual(decide({ ...state, prompt }), { inject: false })
  })
}

test('implementation request never becomes integration merely because a PR exists', () => {
  for (const branch of ['main', 'develop', 'feature/x', 'codex/x']) {
    assert.deepEqual(decide({ prompt: '구현해줘', branch, hasSpec: true, openPR: 5 }), { inject: false })
  }
})

test('spec files on detached or work branches cannot select feature-add', () => {
  for (const branch of ['', 'codex/x', 'fix/x', 'feature/x', 'release/v1', 'other']) {
    assert.deepEqual(decide({ prompt: '구현해줘', branch, hasSpec: true }), { inject: false })
  }
})

test('explicit implementation selects a candidate only on supported base branches with spec', () => {
  for (const prompt of ['구현해', '구현해줘', '구현해 주세요.', ' IMPLEMENT IT! ']) {
    for (const branch of ['main', 'develop']) {
      assert.equal(decide({ prompt, branch, hasSpec: true }).skill, 'feature-add')
      assert.deepEqual(decide({ prompt, branch }), { inject: false })
    }
  }
})

test('explicit integration preserves PR gates and supports committed codex branches', () => {
  for (const prompt of ['머지해', '머지해줘', '머지해 주세요.', ' MERGE IT! ']) {
    assert.equal(decide({ prompt, openPR: 5 }).skill, 'pr-review-gate')
    assert.equal(decide({ prompt, openPR: 5, isSolo: true }).skill, 'solo-merge')
    for (const branch of ['feature/x', 'fix/x', 'codex/x']) {
      assert.equal(decide({ prompt, branch, committed: true }).skill, 'feature-merge')
      assert.deepEqual(decide({ prompt, branch, hasSpec: true }), { inject: false })
    }
    assert.deepEqual(decide({ prompt, branch: 'develop', hasSpec: true, committed: true }), { inject: false })
  }
})

test('invalid prompt types are ignored instead of throwing', () => {
  for (const prompt of [null, undefined, 1, {}, []]) {
    assert.equal(isActionable(prompt), false)
    assert.deepEqual(decide({ prompt, openPR: 5 }), { inject: false })
  }
})

test('live prompts skip ambiguous probes and fail open after explicit request lookup failures', () => {
  const script = fileURLToPath(new URL('../plugins/harness-guard/scripts/route-intent.mjs', import.meta.url))
  const scratch = mkdtempSync(join(tmpdir(), 'routing-probe-'))
  const probe = join(scratch, 'unexpected-probe')
  try {
    // Observe the subprocess boundary; empty stdout alone could hide failed probes.
    for (const executable of ['git', 'gh']) {
      writeFileSync(join(scratch, executable), '#!/bin/sh\nprintf attempted >> "$ROUTING_PROBE"\nexit 1\n', { mode: 0o755 })
    }
    for (const prompt of ['진행해', '정리해줘', 1]) {
      const result = spawnSync(process.execPath, [script], {
        input: JSON.stringify({ prompt, cwd: scratch }),
        encoding: 'utf8', env: { ...process.env, PATH: scratch, ROUTING_PROBE: probe },
      })
      assert.equal(result.status, 0)
      assert.equal(result.stdout, '')
      assert.equal(result.stderr, '')
      assert.equal(existsSync(probe), false)
    }
    const failedLookup = spawnSync(process.execPath, [script], {
      input: JSON.stringify({ prompt: '머지해', cwd: scratch }),
      encoding: 'utf8', env: { ...process.env, PATH: scratch, ROUTING_PROBE: probe },
    })
    assert.equal(existsSync(probe), true)
    assert.equal(failedLookup.status, 0)
    assert.equal(failedLookup.stdout, '')
    assert.equal(failedLookup.stderr, '')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

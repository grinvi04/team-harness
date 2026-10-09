#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(path.join(root, '.claude/workflows/harness-review.js'), 'utf8')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
// This executes the real DSL source, adapting only its export syntax. The controlled
// DSL functions do not demonstrate registration or availability in the Claude app.
assert.equal((source.match(/export const meta =/g) || []).length, 1)
const workflow = new AsyncFunction('phase', 'pipeline', 'agent', 'parallel', 'log', source.replace('export const meta =', 'const meta ='))
const keys = ['guard-docs', 'commands-gate', 'templates-onboarding', 'docs-cross', 'standards-impl', 'agents-source', 'readme']
const finding = { title: 'Fixture contradiction', file: 'docs/example.md:1', detail: 'The two referenced fixtures disagree.', severity: 'medium' }
let passed = 0
let failed = 0

async function run({ review = { status: 'reviewed', findings: [finding] }, verdict = { isReal: true, reason: 'docs/example.md:1 contradicts implementation:2' }, reviews = {}, skipDimension, throwReview, throwVerify } = {}) {
  const logs = []
  const phases = []
  const calls = []
  const result = await workflow(
    (phase) => phases.push(phase),
    async (dimensions, inspect, verify) => Promise.all(dimensions.map(async (dimension) => {
      if (dimension.key === skipDimension) return null
      return verify(await inspect(dimension), dimension)
    })),
    async (prompt, options) => {
      calls.push({ prompt, options })
      const [step, dimension] = options.label.split(':')
      if (step === 'review') {
        if (throwReview && dimension === keys[0]) throw new Error('fixture review unavailable')
        return Object.hasOwn(reviews, dimension) ? reviews[dimension] : dimension === keys[0] ? review : { status: 'reviewed', findings: [] }
      }
      assert.equal(step, 'verify')
      if (throwVerify) throw new Error('fixture verifier unavailable')
      return verdict
    },
    async (tasks) => Promise.all(tasks.map((task) => task())),
    (message) => logs.push(message),
  )
  return { result, logs, phases, calls }
}

async function test(name, fn) {
  try { await fn(); passed++; console.log(`PASS: ${name}`) }
  catch (error) { failed++; console.error(`FAIL: ${name}\n${error.stack}`) }
}

function classified(result, confirmed, rejected, unverified) {
  assert.equal(result.confirmed.length, confirmed)
  assert.equal(result.rejected.length, rejected)
  assert.equal(result.unverified.length, unverified)
  assert.equal(result.status, unverified ? 'unverified' : 'complete')
  assert.equal(result.coverage.complete, unverified === 0)
  assert.equal(result.coverage.dimensions.length, 7)
}

await test('genuine no-findings completes all seven dimensions without inventing findings', async () => {
  const { result, calls } = await run({ review: { status: 'reviewed', findings: [] } })
  classified(result, 0, 0, 0)
  assert.equal(calls.length, 7)
  assert.deepEqual(result.coverage.dimensions.map((item) => item.dim), keys)
})

await test('legacy evidence-backed true and false verdicts retain confirmed/rejected', async () => {
  const yes = (await run()).result
  classified(yes, 1, 0, 0)
  assert.equal(yes.confirmed[0].title, finding.title)
  const no = (await run({ verdict: { isReal: false, reason: 'docs/example.md:1 intentionally summarizes implementation:2' } })).result
  classified(no, 0, 1, 0)
  assert.equal(no.rejected[0].reason, 'docs/example.md:1 intentionally summarizes implementation:2')
})

await test('explicit confirmed/rejected/unverified verdicts use distinct result buckets', async () => {
  for (const [status, counts] of [['confirmed', [1, 0, 0]], ['rejected', [0, 1, 0]], ['unverified', [0, 0, 1]]]) {
    const { result } = await run({ verdict: { status, reason: 'docs/example.md:1: fixture evidence' } })
    classified(result, ...counts)
  }
})

await test('uncertain false verdict cannot become a verified rejection', async () => {
  for (const verdict of [
    { isReal: false, reason: 'uncertain' },
    { isReal: false, reason: '불확실하여 근거를 확인하지 못함' },
    { isReal: false, uncertain: true, reason: 'docs/example.md:1 unavailable' },
    { status: 'rejected', uncertain: true, reason: 'docs/example.md:1 unavailable' },
  ]) classified((await run({ verdict })).result, 0, 0, 1)
})

await test('null/malformed/missing reason and contradictory verdicts are retained as unverified', async () => {
  for (const verdict of [null, false, 'rejected', {}, { isReal: null, reason: 'not known' }, { isReal: 'false', reason: 'text' }, { isReal: true }, { isReal: false, reason: '' }, { status: 'typo', reason: 'text' }, { status: 'confirmed', isReal: false, reason: 'text' }]) {
    const { result } = await run({ verdict })
    classified(result, 0, 0, 1)
    assert.equal(result.unverified[0].title, finding.title)
    assert.equal(result.unverified[0].dim, 'guard-docs')
    assert.ok(result.unverified[0].reason.length > 0)
  }
})

await test('null/missing/malformed findings response cannot masquerade as no-findings', async () => {
  for (const review of [null, false, 'empty', {}, { findings: null }, { findings: {} }]) {
    const { result, calls } = await run({ review })
    classified(result, 0, 0, 1)
    assert.equal(result.unverified[0].dim, 'guard-docs')
    assert.equal(calls.filter((call) => call.options.label.startsWith('verify:')).length, 0)
  }
})

await test('partial or uncertain review coverage remains unverified even with an empty findings list', async () => {
  for (const review of [
    { findings: [], status: 'unverified', reason: 'fixture source inaccessible' },
    { findings: [], uncertain: true },
    { findings: [], status: 'invalid' },
  ]) classified((await run({ review })).result, 0, 0, 1)
  const { result } = await run({ review: { findings: [finding], status: 'unverified', reason: 'another source not checked' } })
  classified(result, 1, 0, 1)
})

await test('missing or null review status cannot complete coverage even with well-shaped findings', async () => {
  for (const review of [
    { findings: [], reason: 'source inaccessible' },
    { findings: [], status: null },
    { findings: [], status: undefined },
    { findings: [], status: false },
    { findings: [], status: '' },
  ]) classified((await run({ review })).result, 0, 0, 1)
  const { result } = await run({ review: { findings: [finding], reason: 'another source inaccessible' } })
  classified(result, 1, 0, 1)
})

await test('malformed finding does not disappear or reach verifier; valid siblings still verify', async () => {
  const invalid = [null, {}, { ...finding, severity: 'urgent' }, { ...finding, file: '' }]
  const { result, calls } = await run({ review: { status: 'reviewed', findings: [...invalid, finding] } })
  classified(result, 1, 0, 4)
  assert.equal(calls.filter((call) => call.options.label.startsWith('verify:')).length, 1)
  assert.equal(result.confirmed[0].title, finding.title)
})

await test('missing dimension output is explicitly uncovered and prevents complete status', async () => {
  const { result } = await run({ review: { status: 'reviewed', findings: [] }, skipDimension: 'docs-cross' })
  classified(result, 0, 0, 1)
  assert.equal(result.unverified[0].dim, 'docs-cross')
  assert.equal(result.coverage.dimensions.find((item) => item.dim === 'docs-cross').status, 'unverified')
})

await test('review and verifier failures remain visible rather than aborting or reporting clean', async () => {
  for (const options of [{ throwReview: true }, { throwVerify: true }]) {
    const { result } = await run(options)
    classified(result, 0, 0, 1)
    assert.match(result.unverified[0].reason, /fixture .* unavailable/)
  }
})

await test('mixed dimension results preserve each finding and unverified summary count', async () => {
  const { result, logs } = await run({ verdict: null, reviews: { 'readme': { status: 'reviewed', findings: [finding] } } })
  classified(result, 0, 0, 2)
  assert.deepEqual(result.unverified.map((item) => item.dim), ['guard-docs', 'readme'])
  assert.match(logs.at(-1), /미확인 2건/)
  assert.doesNotMatch(logs.at(-1), /검증 완료/)
})

console.log(`RESULT: ${passed} PASS, ${failed} FAIL`)
process.exitCode = failed ? 1 : 0

// Structural regression only: reader integrity and known unsafe release instructions.
// Real agent behavior and semantic completeness need independent scenario review.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
function check(label, run) {
  try { run(); console.log(`PASS: ${label}`) }
  catch (error) { failures++; console.error(`FAIL: ${label}: ${error.message.split("\n")[0]}`) }
}
const read = (file) => readFileSync(path.join(root, file), 'utf8')
for (const name of ['plan', 'feature-add', 'feature-modify', 'systematic-debugging']) {
  check(`${name} loads the shared project contract`, () => {
    const file = `plugins/harness-guard/skills/${name}/SKILL.md`
    const text = read(file)
    const references = [...text.matchAll(/\]\(([^)]+project-contract\.md)(?:#[^)]*)?\)/g)]
    assert.equal(references.length, 1)
    assert.ok(existsSync(path.resolve(root, path.dirname(file), references[0][1])))
  })
}
const release = read('plugins/harness-guard/skills/release/SKILL.md')
const prerelease = read('plugins/harness-guard/skills/release-check/SKILL.md')
check('shared release has no blanket staging or fabricated production success', () => {
  assert.doesNotMatch(release, /^git add \.[ \t]*$/m)
  assert.doesNotMatch(release, /프로덕션: 정상 ✅/)
  assert.doesNotMatch(release, /node scripts\/generate-changelog\.mjs/)
})
check('shared prerelease does not force one repository layout', () => {
  assert.doesNotMatch(prerelease, /docs\/gen_arch_svg\.py|docs\/architecture\.svg|st_mtime/)
  assert.doesNotMatch(prerelease, /docs\/pilots\/external-pilot-provenance\.json|scripts\/check-external-pilot-provenance\.mjs/)
})
check('prerelease keeps mandatory independent security review', () => {
  assert.match(prerelease, /보안 검토는.*반드시.*독립 검증자/)
  assert.match(prerelease, /독립 검토.*수행할 수 없으면 UNVERIFIED/)
})
check('repository retains its required live provenance and changelog commands', () => {
  const instructions = read('AGENTS.md')
  assert.match(instructions, /node scripts\/generate-changelog\.mjs --release/)
  assert.match(instructions, /node scripts\/check-external-pilot-provenance\.mjs --manifest docs\/pilots\/external-pilot-provenance\.json/)
  assert.match(instructions, /--offline.*금지/)
})
assert.equal(failures, 0, `${failures} structural contract regressions`)

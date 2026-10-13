// Reader integrity, known unsafe instructions and the published shell preflight example.
// Real agent behavior and semantic completeness need independent scenario review.
import assert from 'node:assert/strict'
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
function check(label, run) {
  try { run(); console.log(`PASS: ${label}`) }
  catch (error) { failures++; console.error(`FAIL: ${label}: ${error.message.split("\n")[0]}`) }
}
const read = (file) => readFileSync(path.join(root, file), 'utf8')
check('installed project contract carries frontend criteria without repository docs', () => {
  const text = read('plugins/harness-guard/skills/ao-coordinate/project-contract.md')
  const section = text.split('## 프론트엔드 설계 연결\n')[1]?.split('\n## ')[0]
  assert.ok(section, 'frontend contract must be reachable from existing shared readers')
  assert.equal((section.match(/^\d\. /gm) || []).length, 6)
  for (const term of ['업무', '기존', '상태', '경계', '재사용', '검증']) assert.ok(section.includes(term), term)
  const prose = section.replace(/\s+/g, ' ')
  assert.match(prose, /작은.*영향/)
  assert.match(prose, /기존 (?:계획·스펙·이슈|기록)/)
  assert.doesNotMatch(section, /\]\([^)]*\.\.\/\.\.\/\.\.\/docs\//)
})
check('consumer can find frontend detail and existing visual standards without a new workflow', () => {
  const guide = read('docs/frontend-engineering.md')
  assert.ok(read('templates/AGENTS.md').includes('frontend-engineering.md'))
  assert.ok(read('docs/frontend-design-standards.md').includes('frontend-engineering.md'))
  assert.match(guide, /기존.*검증/)
  assert.ok(guide.includes('frontend-design-standards.md'))
  assert.ok(guide.includes('standards-scope.md'))
})
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
check('Codex review example refuses failed candidate reads before invoking review', () => {
  const example = read('plugins/harness-guard/skills/pr-review-gate/SKILL.md')
    .split('Codex 예시')[1]?.match(/```bash\n([\s\S]*?)\n```/)?.[1]
  assert.ok(example, 'published review preflight must remain executable')
  const dir = mkdtempSync(path.join(tmpdir(), 'harness-review-preflight-'))
  const snapshot = path.join(dir, 'review.json')
  writeFileSync(snapshot, JSON.stringify({ candidate: { headRefOid: 'expected-head', baseRefOid: 'expected-base' } }))
  const stubs = `git() {
    if [ "$1" = rev-parse ]; then
      [ "$CASE" = head-error ] && return 128
      if [ "$CASE" = stale-head ]; then printf '%s\\n' stale-head; else printf '%s\\n' expected-head; fi
    elif [ "$1" = status ]; then
      [ "$CASE" = status-error ] && return 128
      case "$CASE" in dirty) printf '%s\\n' ' M tracked';; untracked) printf '%s\\n' '?? scratch';; esac
      return 0
    else return 99; fi
  }
  codex() { printf '%s\\n' REVIEW_INVOKED; [ "$CASE" != review-error ] || return 17; }`
  try {
    for (const [scenario, status, called] of [
      ['clean', 0, true], ['dirty', 1, false], ['untracked', 1, false],
      ['stale-head', 1, false], ['head-error', 1, false], ['status-error', 1, false],
      ['review-error', 17, true],
    ]) {
      const result = spawnSync('bash', ['-c', `${stubs}\n${example}`], {
        cwd: root, env: { ...process.env, CASE: scenario, REVIEW_SNAPSHOT: snapshot }, encoding: 'utf8',
      })
      assert.equal(result.status, status, `${scenario}: ${result.stderr}`)
      assert.equal(result.stdout.includes('REVIEW_INVOKED'), called, scenario)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
assert.equal(failures, 0, `${failures} structural contract regressions`)

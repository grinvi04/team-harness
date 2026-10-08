import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const checker = fileURLToPath(new URL('../scripts/check-markdown-structure.mjs', import.meta.url))
function fixture(fn) {
  const root = mkdtempSync(path.join(tmpdir(), 'harness-md-'))
  const put = (name, contents) => {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), contents)
  }
  const check = (...args) => spawnSync(process.execPath, [checker, '--root', root, ...args], { encoding: 'utf8' })
  try { fn({ root, put, check }) } finally { rmSync(root, { recursive: true, force: true }) }
}

test('199 physical lines pass; 200 fail including blank lines and frontmatter', () => fixture(({ put, check }) => {
  put('a.md', '---\nname: doc\n---\n' + '\n'.repeat(195) + 'last\n')
  assert.equal(check().status, 0)
  put('a.md', '---\nname: doc\n---\n' + '\n'.repeat(196) + 'last\n')
  const result = check()
  assert.equal(result.status, 1)
  assert.match(result.stdout, /a\.md.*200.*199/)
}))

test('CRLF and missing final newline have the same physical-line count', () => fixture(({ put, check }) => {
  put('a.md', Array(199).fill('line').join('\r\n'))
  assert.equal(check().status, 0)
  put('a.md', Array(200).fill('line').join('\r\n'))
  assert.equal(check().status, 1)
}))

test('generated chunks, hidden owned instructions and ignored docs are included', () => fixture(({ put, check }) => {
  put('.gitignore', 'docs/\n.claude/\n.project-map/\n')
  for (const file of ['docs/changelog/2026/v1.md', '.claude/CLAUDE.local.md', '.project-map/milestones.md']) {
    put(file, 'x\n'.repeat(200))
  }
  const result = check()
  assert.equal(result.status, 1)
  for (const name of ['v1.md', 'CLAUDE.local.md', 'milestones.md']) assert.ok(result.stdout.includes(name))
}))

test('dependencies and task scratch are excluded; an explicitly owned scratch file is checked', () => fixture(({ root, put, check }) => {
  put('node_modules/pkg/README.md', 'x\n'.repeat(200))
  put('.superpowers/scratch/old.md', 'x\n'.repeat(200))
  put('.superpowers/sdd/task/progress.md', 'x\n'.repeat(200))
  assert.equal(check().status, 0)
  assert.equal(check('--file', path.join(root, '.superpowers/sdd/task/progress.md')).status, 1)
}))

test('real local links, encoded spaces, images, headings and duplicate anchors resolve', () => fixture(({ put, check }) => {
  put('README.md', '# Start\n[guide](<docs/a b.md#한글-heading>)\n![pic](pic.svg)\n[repeat](docs/a%20b.md#repeat-1)\n')
  put('docs/a b.md', '# 한글 Heading\n## Repeat\n## Repeat\n')
  put('pic.svg', '<svg/>')
  assert.equal(check().status, 0)
  put('README.md', '[missing](gone.md)\n[bad anchor](docs/a%20b.md#gone)\n')
  const result = check()
  assert.equal(result.status, 1)
  assert.match(result.stdout, /gone\.md/)
  assert.match(result.stdout, /#gone/)
}))

test('code examples and external URLs are not treated as local paths', () => fixture(({ put, check }) => {
  put('README.md', '```md\n[future](missing.md)\n```\n`[inline](missing.md)`\n[web](https://example.test/a)\n[mail](mailto:a@example.test)\n')
  assert.equal(check().status, 0)
}))

test('future template paths need an explicit virtual root; unrelated missing paths still fail', () => fixture(({ root, put, check }) => {
  put('templates/AGENTS.md', '[standard](docs/api.md)\n')
  put('docs/api.md', '# API\n')
  assert.equal(check().status, 1)
  assert.equal(check('--virtual-root', `templates/AGENTS.md=${root}`).status, 0)
  put('templates/AGENTS.md', '[missing](docs/gone.md)\n')
  assert.equal(check('--virtual-root', `templates/AGENTS.md=${root}`).status, 1)
}))

test('reference links and HTML anchors are checked', () => fixture(({ put, check }) => {
  put('README.md', '[Guide][g]\n[g]: docs/guide.md#custom\n')
  put('docs/guide.md', '<a id="custom"></a>\n')
  assert.equal(check().status, 0)
  put('docs/guide.md', '<a id="other"></a>\n')
  assert.equal(check().status, 1)
}))

test('inline code inside a heading remains part of its anchor', () => fixture(({ put, check }) => {
  put('README.md', '[budget](#docs-budget)\n## `docs` budget\n')
  assert.equal(check().status, 0)
}))

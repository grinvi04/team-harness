#!/usr/bin/env node

import { execFileSync } from 'node:child_process'

const root = new URL('..', import.meta.url).pathname

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

const tags = git(['tag', '--list', 'v*', '--sort=-version:refname'])
  .split('\n')
  .filter(Boolean)
const lines = [
  '# Changelog',
  '',
  '<!-- Generated file. Do not edit release entries manually. -->',
  '',
  'Generated from version tags and Conventional Commits (`feat` and `fix` only).',
  'Regenerate with `node scripts/generate-changelog.mjs` and replace this file with its output.',
  '',
]

for (let index = 0; index < tags.length; index += 1) {
  const tag = tags[index]
  const older = tags[index + 1]
  const range = older ? `${older}..${tag}` : tag
  const date = git(['log', '-1', '--format=%cs', tag])
  const entries = git(['log', '--format=%s', range])
    .split('\n')
    .filter((subject) => /^(feat|fix)(\([^)]+\))?!?: /.test(subject))
  if (entries.length === 0) continue
  lines.push(`## ${tag} - ${date}`, '', ...entries.map((entry) => `- ${entry}`), '')
}

process.stdout.write(`${lines.join('\n').trimEnd()}\n`)

#!/usr/bin/env node

import { execFileSync } from 'node:child_process'

const root = new URL('..', import.meta.url).pathname

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function releaseCandidate(argv) {
  if (argv.length === 0) return ''
  if (argv.length !== 2 || argv[0] !== '--release' || !/^v\d+\.\d+\.\d+$/.test(argv[1])) {
    process.stderr.write('사용: node scripts/generate-changelog.mjs [--release vMAJOR.MINOR.PATCH]\n')
    process.exit(2)
  }
  return argv[1]
}

const candidate = releaseCandidate(process.argv.slice(2))
const tags = git(['tag', '--list', 'v*', '--sort=-version:refname'])
  .split('\n')
  .filter(Boolean)
const candidateIndex = candidate ? tags.indexOf(candidate) : -1
const candidateExists = candidateIndex >= 0
const releaseTags = candidateExists ? tags.filter((tag) => tag !== candidate) : tags
const lines = [
  '# Changelog',
  '',
  '<!-- Generated file. Do not edit release entries manually. -->',
  '',
  candidate
    ? 'Generated from version tags, a pre-tag release candidate, and Conventional Commits (`feat` and `fix` only).'
    : 'Generated from version tags and Conventional Commits (`feat` and `fix` only).',
  candidate
    ? `Regenerate with \`node scripts/generate-changelog.mjs --release ${candidate}\` and replace this file with its output.`
    : 'Regenerate with `node scripts/generate-changelog.mjs` and replace this file with its output.',
  '',
]

const releases = [
  ...(candidate
    ? [{
        tag: candidate,
        ref: candidateExists ? candidate : 'HEAD',
        older: candidateExists ? tags[candidateIndex + 1] : tags[0],
        isCandidate: true,
      }]
    : []),
  ...releaseTags.map((tag) => ({
    tag,
    ref: tag,
    older: tags[tags.indexOf(tag) + 1],
    isCandidate: false,
  })),
]

for (const { tag, ref, older, isCandidate } of releases) {
  const range = older ? `${older}..${ref}` : ref
  const entries = git(['log', '--format=%cs%x1f%s', range])
    .split('\n')
    .map((record) => {
      const separator = record.indexOf('\x1f')
      return separator < 0
        ? { date: '', subject: record }
        : { date: record.slice(0, separator), subject: record.slice(separator + 1) }
    })
    .filter(({ subject }) => /^(feat|fix)(\([^)]+\))?!?: /.test(subject))
  if (entries.length === 0) continue
  const date = isCandidate ? entries[0].date : git(['log', '-1', '--format=%cs', ref])
  lines.push(`## ${tag} - ${date}`, '', ...entries.map(({ subject }) => `- ${subject}`), '')
}

process.stdout.write(`${lines.join('\n').trimEnd()}\n`)

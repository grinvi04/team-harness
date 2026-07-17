#!/usr/bin/env node
'use strict'

const { readFileSync } = require('node:fs')

const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'ci', 'build', 'revert']
const SCOPE_REQUIRED = new Set(['feat', 'fix', 'refactor', 'perf', 'test'])
const REASON_REQUIRED = new Set(['feat', 'fix', 'refactor', 'perf'])
const HEADER_RE = new RegExp(
  `^(${TYPES.join('|')})(?:\\(([a-z0-9][a-z0-9._/-]*)\\))?(!)?: (.+)$`,
)
const BODY_LABEL_RE = /^(이유|영향|검증):\s*(.*)$/
const FOOTER_RE = /^(?:BREAKING CHANGE|[A-Za-z][A-Za-z0-9-]*)(?:: | #)\S/
const MERGE_MESSAGE_RE = /^(?:Merge branch '[^'\n]+'(?: into [A-Za-z0-9._/-]+)?|Merge branch '[^'\n]+' of [^\s\n]+(?: into [A-Za-z0-9._/-]+)?|Merge branches '[^'\n]+'(?:, '[^'\n]+')* and '[^'\n]+'(?: into [A-Za-z0-9._/-]+)?|Merge remote-tracking branch '[^'\n]+'(?: into [A-Za-z0-9._/-]+)?|Merge pull request #[1-9]\d* from [A-Za-z0-9_.-]+\/[A-Za-z0-9._/-]+)$/
const GIT_HASH_RE = '(?:[0-9a-f]{40}|[0-9a-f]{64})'
const REVERT_MESSAGE_RE = new RegExp(
  `^Revert "[^\\n]+"\\n\\nThis reverts commit ${GIT_HASH_RE}(?:, reversing\\nchanges made to ${GIT_HASH_RE})?\\.$`,
)

function isGitGenerated(message) {
  return MERGE_MESSAGE_RE.test(message) || REVERT_MESSAGE_RE.test(message)
}

function validateCommitMessage(input) {
  const message = String(input ?? '').replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  const errors = []

  if (!message.trim()) return { valid: false, errors: ['커밋 메시지가 비어 있습니다.'] }
  if (isGitGenerated(message)) return { valid: true, errors: [] }

  const lines = message.split('\n')
  const header = lines[0]
  const match = HEADER_RE.exec(header)

  if (!match) {
    return {
      valid: false,
      errors: [
        `헤더는 <type>(<scope>): <한국어 요약> 형식이어야 합니다. 허용 type: ${TYPES.join(', ')}`,
      ],
    }
  }

  const [, type, scope, , subject] = match
  if (SCOPE_REQUIRED.has(type) && !scope) {
    errors.push(`${type} 타입은 변경 영역을 나타내는 scope가 필요합니다.`)
  }
  if (!/[가-힣]/u.test(subject)) errors.push('요약에는 한글이 포함되어야 합니다.')
  if ([...subject].length > 50) errors.push('요약은 50자 이하여야 합니다.')
  if (/[.。]$/.test(subject)) errors.push('요약은 마침표로 끝내지 않습니다.')

  if (lines.length > 1 && lines[1] !== '') {
    errors.push('본문은 헤더 다음 빈 줄 뒤에 작성해야 합니다.')
  }

  const content = lines.slice(2).filter((line) => line !== '')
  const labels = []
  let inFooters = false
  for (const line of content) {
    const label = BODY_LABEL_RE.exec(line)
    if (label && !inFooters) {
      if (!label[2].trim()) errors.push(`${label[1]}: 뒤에 내용을 작성해야 합니다.`)
      labels.push(label[1])
      continue
    }
    if (FOOTER_RE.test(line)) {
      inFooters = true
      continue
    }
    errors.push(`본문 항목은 이유:·영향:·검증: 또는 Git footer 형식을 사용해야 합니다: ${line}`)
  }

  const expectedOrder = ['이유', '영향', '검증']
  const uniqueLabels = new Set(labels)
  if (uniqueLabels.size !== labels.length) errors.push('이유:·영향:·검증: 항목은 한 번씩만 작성합니다.')
  const ordered = [...labels].sort((a, b) => expectedOrder.indexOf(a) - expectedOrder.indexOf(b))
  if (labels.some((label, index) => label !== ordered[index])) {
    errors.push('본문 항목 순서는 이유: → 영향: → 검증: 입니다.')
  }
  if (labels.length > 0 && labels[0] !== '이유') errors.push('본문을 작성하면 첫 항목은 이유:여야 합니다.')
  if (REASON_REQUIRED.has(type) && !uniqueLabels.has('이유')) {
    errors.push(`${type} 타입은 빈 줄 뒤에 이유: 항목이 필요합니다.`)
  }

  return { valid: errors.length === 0, errors }
}

function messageFromParsed(parsed) {
  if (typeof parsed?.raw === 'string' && parsed.raw) return parsed.raw
  return [parsed?.header, parsed?.body, parsed?.footer].filter(Boolean).join('\n\n')
}

function commitlintRule(parsed) {
  const result = validateCommitMessage(messageFromParsed(parsed))
  return [result.valid, result.errors.join(' ')]
}

function main(argv) {
  const fileIndex = argv.indexOf('--file')
  const file = fileIndex >= 0 ? argv[fileIndex + 1] : argv[0]
  if (!file) {
    console.error('사용법: node scripts/check-commit-message.cjs --file <commit-message-file>')
    return 2
  }

  let message
  try {
    message = readFileSync(file, 'utf8')
  } catch (error) {
    console.error(`커밋 메시지 파일을 읽을 수 없습니다: ${error.message}`)
    return 2
  }

  const result = validateCommitMessage(message)
  if (result.valid) return 0
  console.error('✖ 커밋 메시지 규칙 위반')
  for (const error of result.errors) console.error(`  - ${error}`)
  console.error('예: feat(order): 주문 한도 검증 추가\n\n이유: 잘못된 주문의 결제를 방지')
  return 1
}

module.exports = { TYPES, validateCommitMessage, commitlintRule }

if (require.main === module) process.exitCode = main(process.argv.slice(2))

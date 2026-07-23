#!/usr/bin/env node
/*
 * Codex replacement for the Claude-only PreToolUse prompt hook.
 * It blocks only explicit secret-egress shapes; ambiguous commands remain for
 * Codex sandbox/approval, matching the intentionally narrow Claude prompt policy.
 */
let input = ''
for await (const chunk of process.stdin) input += chunk

let hook
try {
  hook = JSON.parse(input)
} catch {
  // Do not turn a malformed foreign hook payload into a broad command block.
  process.exit(0)
}

// The hook matcher chooses Bash executions. Codex uses `tool_input.cmd` for
// exec while Claude uses `tool_input.command`, so do not gate on tool_name.
const command = hook?.tool_input?.command ?? hook?.tool_input?.cmd
if (typeof command !== 'string') process.exit(0)

function collapseLineContinuations(value) {
  let output = ''
  let quote = ''
  let index = 0

  while (index < value.length) {
    const char = value[index]
    if (quote === "'") {
      output += char
      if (char === "'") quote = ''
      index += 1
      continue
    }

    if (char === '\\') {
      let run = 0
      while (value[index] === '\\') {
        run += 1
        index += 1
      }
      const next = value[index]
      const isLf = next === '\n'
      if (run % 2 === 1 && isLf) {
        output += '\\'.repeat(run - 1)
        index += 1
        continue
      }
      output += '\\'.repeat(run)
      if (run % 2 === 1 && index < value.length) {
        output += next
        index += 1
      }
      continue
    }

    if (!quote && char === "'") quote = "'"
    else if (!quote && char === '"') quote = '"'
    else if (quote === '"' && char === '"') quote = ''
    output += char
    index += 1
  }
  return output
}

function logicalShellCommands(value) {
  const outer = collapseLineContinuations(value)
  const commands = [outer]

  for (const tokens of shellSegments(outer)) {
    let index = 0
    while (isAssignment(tokens[index])) index += 1

    if (baseName(tokens[index]) === 'exec') {
      index += 1
      while (tokens[index]?.startsWith('-')) {
        if (tokens[index] === '-a') index += 2
        else index += 1
      }
      while (isAssignment(tokens[index])) index += 1
    }

    if (baseName(tokens[index]) === 'env') {
      index += 1
      while (index < tokens.length) {
        const token = tokens[index]
        if (isAssignment(token)) index += 1
        else if (['-u', '--unset', '-C', '--chdir', '-S', '--split-string'].includes(token)) index += 2
        else if (token.startsWith('-')) index += 1
        else break
      }
    }

    if (!['bash', 'sh', 'zsh'].includes(baseName(tokens[index]))) continue
    index += 1
    while (index < tokens.length) {
      const option = tokens[index]
      if (/^-[A-Za-z]*c[A-Za-z]*$/.test(option) && tokens[index + 1] !== undefined) {
        commands.push(collapseLineContinuations(tokens[index + 1]))
        break
      }
      if (['-o', '+o', '-O', '+O'].includes(option)) index += 2
      else if (option.startsWith('-') || option.startsWith('+')) index += 1
      else break
    }
  }
  return commands
}

function shellSegments(value) {
  const segments = []
  let tokens = []
  let word = ''
  let wordStarted = false
  let quote = ''
  let index = 0

  const pushWord = () => {
    if (!wordStarted) return
    tokens.push(word)
    word = ''
    wordStarted = false
  }
  const pushSegment = () => {
    pushWord()
    if (tokens.length > 0) segments.push(tokens)
    tokens = []
  }

  while (index < value.length) {
    const char = value[index]
    if (quote) {
      if (char === quote) {
        quote = ''
        wordStarted = true
        index += 1
      } else if (quote === '"' && char === '\\' && index + 1 < value.length) {
        word += value[index + 1]
        wordStarted = true
        index += 2
      } else {
        word += char
        wordStarted = true
        index += 1
      }
      continue
    }

    if (char === "'" || char === '"') {
      quote = char
      wordStarted = true
      index += 1
    } else if (char === '\\' && index + 1 < value.length) {
      word += value[index + 1]
      wordStarted = true
      index += 2
    } else if (char === '\n' || ';|&()'.includes(char)) {
      pushSegment()
      index += 1
    } else if (/\s/.test(char)) {
      pushWord()
      index += 1
    } else {
      word += char
      wordStarted = true
      index += 1
    }
  }
  pushSegment()
  return segments
}

function baseName(value) {
  return typeof value === 'string' ? value.split('/').pop() : ''
}

function isAssignment(value) {
  return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*=/.test(value)
}

const curlUpload = /\bcurl\b(?=[^\n]*(?:\s(?:-d|-F|-T)\b|--(?:data(?:-binary|-raw|-urlencode)?|form|upload-file)\b|(?:-X|--request)\s*(?:POST|PUT|PATCH)\b))[^\n]*\bhttps?:\/\//i
const wgetUpload = /\bwget\b(?=[^\n]*--post-(?:data|file)\b)[^\n]*\bhttps?:\/\//i
const netcatUpload = /\|[^\n]*\b(?:nc|ncat|netcat)\b/i
const remoteCopy = /\b(?:scp|rsync)\b[^\n]*\.env(?:\.[A-Za-z0-9_-]+)?[^\n]*\b[A-Za-z0-9._-]+@[^\s:]+:/i

const blocked = logicalShellCommands(command).some((logicalCommand) => {
  const hasSecretSource = /(?:\$\{?(?:[A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL)[A-Z0-9_]*)\}?|\b(?:printenv|env)(?:\s+[A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL)\b|\s*\|)|\bgh\s+auth\s+token\b|\bop\s+read\b|(?:^|[\s"'=@/])\.env(?:\.[A-Za-z0-9_-]+)?\b)/i.test(logicalCommand)
  return hasSecretSource && (curlUpload.test(logicalCommand) || wgetUpload.test(logicalCommand) || netcatUpload.test(logicalCommand) || remoteCopy.test(logicalCommand))
})

if (blocked) {
  process.stderr.write('⛔ [security] 명백한 시크릿 외부 전송 패턴을 차단했습니다. 네트워크 전송이 필요하면 시크릿을 제거하고 사용자 승인을 받으세요.\n')
  process.exit(2)
}

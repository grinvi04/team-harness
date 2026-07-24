#!/usr/bin/env node
/*
 * Codex replacement for the Claude-only PreToolUse prompt hook.
 * It blocks only explicit secret-egress shapes; ambiguous commands remain for
 * Codex sandbox/approval, matching the intentionally narrow Claude prompt policy.
 */
import { createHash } from 'node:crypto'
import { appendFileSync, chmodSync, mkdirSync } from 'node:fs'
import path from 'node:path'

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
  const commands = []
  const pending = [outer]
  const seen = new Set()

  while (pending.length > 0 && commands.length < 32) {
    const current = pending.shift()
    if (seen.has(current)) continue
    seen.add(current)
    commands.push(current)

    for (const nested of backtickShellCommands(current)) pending.push(nested)
    for (const nested of dollarParenShellCommands(current)) pending.push(nested)
    for (const nested of processSubstitutionShellCommands(current)) pending.push(nested)
    for (const tokens of shellSegments(current)) {
      const index = commandIndex(tokens)
      if (!['ash', 'bash', 'csh', 'dash', 'fish', 'ksh', 'mksh', 'sh', 'tcsh', 'yash', 'zsh'].includes(baseName(tokens[index]))) continue
      for (const initCommand of shellInitCommandOperands(tokens, index)) {
        pending.push(collapseLineContinuations(initCommand))
      }
      const operand = shellCommandOperand(tokens, index)
      if (operand !== undefined) pending.push(collapseLineContinuations(operand))
    }
  }
  return { commands, truncated: pending.length > 0 }
}

function backtickShellCommands(value) {
  const commands = []
  let quote = ''
  let index = 0

  while (index < value.length) {
    const char = value[index]
    if (quote === "'") {
      if (char === "'") quote = ''
      index += 1
      continue
    }
    if (char === '\\' && index + 1 < value.length) {
      index += 2
      continue
    }
    if (!quote && char === "'") {
      quote = "'"
      index += 1
      continue
    }
    if (char === '"') {
      quote = quote === '"' ? '' : '"'
      index += 1
      continue
    }
    if (char !== '`') {
      index += 1
      continue
    }

    let nested = ''
    let closed = false
    index += 1
    while (index < value.length) {
      const nestedChar = value[index]
      if (nestedChar === '\\' && index + 1 < value.length) {
        nested += nestedChar + value[index + 1]
        index += 2
      } else if (nestedChar === '`') {
        closed = true
        index += 1
        break
      } else {
        nested += nestedChar
        index += 1
      }
    }
    if (closed) commands.push(collapseLineContinuations(nested))
  }
  return commands
}

function dollarParenShellCommands(value) {
  const commands = []
  let quote = ''
  let index = 0

  while (index < value.length) {
    const char = value[index]
    if (quote === "'") {
      if (char === "'") quote = ''
      index += 1
      continue
    }
    if (char === '\\' && index + 1 < value.length) {
      index += 2
      continue
    }
    if (!quote && char === "'") {
      quote = "'"
      index += 1
      continue
    }
    if (char === '"') {
      quote = quote === '"' ? '' : '"'
      index += 1
      continue
    }
    if (char !== '$' || value[index + 1] !== '(') {
      index += 1
      continue
    }

    let nested = ''
    let nestedQuote = ''
    let depth = 1
    index += 2
    while (index < value.length && depth > 0) {
      const nestedChar = value[index]
      if (nestedQuote === "'") {
        nested += nestedChar
        if (nestedChar === "'") nestedQuote = ''
        index += 1
      } else if (nestedChar === '\\' && index + 1 < value.length) {
        nested += nestedChar + value[index + 1]
        index += 2
      } else if (!nestedQuote && nestedChar === "'") {
        nestedQuote = "'"
        nested += nestedChar
        index += 1
      } else if (nestedChar === '"') {
        nestedQuote = nestedQuote === '"' ? '' : '"'
        nested += nestedChar
        index += 1
      } else if (!nestedQuote && nestedChar === '(') {
        depth += 1
        nested += nestedChar
        index += 1
      } else if (!nestedQuote && nestedChar === ')') {
        depth -= 1
        if (depth > 0) nested += nestedChar
        index += 1
      } else {
        nested += nestedChar
        index += 1
      }
    }
    if (depth === 0) commands.push(collapseLineContinuations(nested))
  }
  return commands
}

function readParenthesizedCommand(value, openIndex) {
  let command = ''
  let quote = ''
  let depth = 1
  let index = openIndex + 1

  while (index < value.length && depth > 0) {
    const char = value[index]
    if (quote === "'") {
      command += char
      if (char === "'") quote = ''
      index += 1
    } else if (char === '\\' && index + 1 < value.length) {
      command += char + value[index + 1]
      index += 2
    } else if (!quote && char === "'") {
      quote = "'"
      command += char
      index += 1
    } else if (char === '"') {
      quote = quote === '"' ? '' : '"'
      command += char
      index += 1
    } else if (!quote && char === '(') {
      depth += 1
      command += char
      index += 1
    } else if (!quote && char === ')') {
      depth -= 1
      if (depth > 0) command += char
      index += 1
    } else {
      command += char
      index += 1
    }
  }
  return depth === 0 ? { command, nextIndex: index } : null
}

function processSubstitutionShellCommands(value) {
  const commands = []
  let quote = ''
  let index = 0

  while (index < value.length) {
    const char = value[index]
    if (quote === "'") {
      if (char === "'") quote = ''
      index += 1
      continue
    }
    if (char === '\\' && index + 1 < value.length) {
      index += 2
      continue
    }
    if (!quote && char === "'") {
      quote = "'"
      index += 1
      continue
    }
    if (char === '"') {
      quote = quote === '"' ? '' : '"'
      index += 1
      continue
    }
    if (!quote && ['<', '>'].includes(char) && value[index + 1] === '(') {
      const parsed = readParenthesizedCommand(value, index + 1)
      if (parsed) {
        commands.push(collapseLineContinuations(parsed.command))
        index = parsed.nextIndex
        continue
      }
    }
    index += 1
  }
  return commands
}

function shellSegments(value) {
  return shellParts(value).map(({ tokens }) => tokens)
}

function isActiveShellExpansion(value, index) {
  if (value[index] === '`') return true
  if (value[index] !== '$') return false
  return /[({A-Za-z_0-9*@#?$!-]/.test(value[index + 1] || '')
}

function shellParts(value) {
  const parts = []
  let tokens = []
  let activeShellExpansionOffsets = []
  let word = ''
  let wordStarted = false
  let wordActiveShellExpansionOffsets = []
  let quote = ''
  let index = 0
  let separatorBefore = ''

  const pushWord = () => {
    if (!wordStarted) return
    tokens.push(word)
    activeShellExpansionOffsets.push(wordActiveShellExpansionOffsets)
    word = ''
    wordStarted = false
    wordActiveShellExpansionOffsets = []
  }
  const pushSegment = (separatorAfter = '') => {
    pushWord()
    if (tokens.length > 0) {
      parts.push({
        tokens,
        activeShellExpansionOffsets,
        separatorBefore,
      })
      tokens = []
      activeShellExpansionOffsets = []
    }
    separatorBefore = separatorAfter
  }

  while (index < value.length) {
    const char = value[index]
    if (quote) {
      const closingQuote = quote === 'ansi' ? "'" : quote
      if (char === closingQuote) {
        quote = ''
        wordStarted = true
        index += 1
      } else if (quote === 'ansi' && char === '\\' && index + 1 < value.length) {
        const escaped = decodeAnsiC(value, index)
        word += escaped.value
        wordStarted = true
        index = escaped.nextIndex
      } else if (quote === '"' && char === '\\' && index + 1 < value.length) {
        word += value[index + 1]
        wordStarted = true
        index += 2
      } else {
        if (quote === '"' && isActiveShellExpansion(value, index)) {
          wordActiveShellExpansionOffsets.push(word.length)
        }
        word += char
        wordStarted = true
        index += 1
      }
      continue
    }

    if (char === '$' && value[index + 1] === "'") {
      quote = 'ansi'
      wordStarted = true
      index += 2
    } else if (char === '$' && value[index + 1] === '"') {
      quote = '"'
      wordStarted = true
      index += 2
    } else if (char === "'" || char === '"') {
      quote = char
      wordStarted = true
      index += 1
    } else if (['<', '>'].includes(char) && value[index + 1] === '(') {
      const parsed = readParenthesizedCommand(value, index + 1)
      if (parsed) {
        word += `${char}(${parsed.command})`
        wordStarted = true
        index = parsed.nextIndex
      } else {
        word += char
        wordStarted = true
        index += 1
      }
    } else if (char === '\\' && index + 1 < value.length) {
      word += value[index + 1]
      wordStarted = true
      index += 2
    } else if (char === '\n' || ';()'.includes(char)) {
      pushSegment(char)
      index += 1
    } else if (char === '|' && value[index + 1] === '&') {
      pushSegment('|&')
      index += 2
    } else if ('|&'.includes(char)) {
      const doubled = value[index + 1] === char
      pushSegment(doubled ? `${char}${char}` : char)
      index += doubled ? 2 : 1
    } else if (/\s/.test(char)) {
      pushWord()
      index += 1
    } else {
      if (isActiveShellExpansion(value, index)) {
        wordActiveShellExpansionOffsets.push(word.length)
      }
      word += char
      wordStarted = true
      index += 1
    }
  }
  pushSegment()
  return parts
}

function decodeAnsiC(value, index) {
  const marker = value[index + 1]
  const controls = {
    a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f',
    n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', "'": "'", '"': '"',
  }
  if (Object.hasOwn(controls, marker)) return { value: controls[marker], nextIndex: index + 2 }

  const remaining = value.slice(index + 1)
  const encoded = remaining.match(/^(?:x([0-9A-Fa-f]{1,2})|u([0-9A-Fa-f]{4})|U([0-9A-Fa-f]{8})|([0-7]{1,3}))/)
  if (encoded) {
    const digits = encoded.slice(1).find(Boolean)
    const radix = encoded[4] ? 8 : 16
    const codePoint = Number.parseInt(digits, radix)
    if (Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff) {
      return { value: String.fromCodePoint(codePoint), nextIndex: index + 1 + encoded[0].length }
    }
  }
  return { value: marker, nextIndex: index + 2 }
}

function baseName(value) {
  return typeof value === 'string' ? value.split('/').pop() : ''
}

function isAssignment(value) {
  return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*=/.test(value)
}

function commandIndex(tokens) {
  let index = 0
  while (index < tokens.length) {
    while (isAssignment(tokens[index])) index += 1
    const executable = baseName(tokens[index])

    if (executable === 'exec') {
      index += 1
      while (tokens[index]?.startsWith('-')) {
        if (tokens[index] === '-a') index += 2
        else index += 1
      }
      continue
    }

    if (executable === 'env') {
      index += 1
      while (index < tokens.length) {
        const token = tokens[index]
        if (isAssignment(token)) index += 1
        else if (['-u', '--unset', '-C', '--chdir', '-S', '--split-string'].includes(token)) index += 2
        else if (token.startsWith('-')) index += 1
        else break
      }
      continue
    }

    if (executable === 'builtin') {
      let nested = index + 1
      while (tokens[nested] === '--') nested += 1
      if (['command', 'exec'].includes(baseName(tokens[nested]))) {
        index = nested
        continue
      }
    }

    if (executable === 'command') {
      index += 1
      while (tokens[index]?.startsWith('-')) index += 1
      continue
    }

    if (executable === 'sudo') {
      index += 1
      while (tokens[index]?.startsWith('-')) {
        if (['-u', '--user', '-g', '--group', '-h', '--host', '-p', '--prompt', '-C', '--close-from', '-T', '--command-timeout'].includes(tokens[index])) index += 2
        else index += 1
      }
      continue
    }

    if (['timeout', 'gtimeout'].includes(executable)) {
      index += 1
      while (tokens[index]?.startsWith('-')) {
        if (tokens[index] === '--') {
          index += 1
          break
        }
        if (['-k', '--kill-after', '-s', '--signal'].includes(tokens[index])) index += 2
        else index += 1
      }
      if (index < tokens.length) index += 1
      continue
    }

    if (['time', 'nohup'].includes(executable)) {
      index += 1
      while (tokens[index]?.startsWith('-')) index += 1
      continue
    }
    break
  }
  return index
}

function shellCommandOperand(tokens, shellIndex) {
  let index = shellIndex + 1
  let foundCommandOption = false
  const shell = baseName(tokens[shellIndex])
  const shellValueOptions = shell === 'fish'
    ? new Set([
        '-C', '--init-command', '-d', '--debug', '-D', '--debug-stack-frames',
        '-f', '--features', '-o', '--debug-output', '--profile-startup',
      ])
    : new Set(['--init-file', '--rcfile'])

  while (index < tokens.length) {
    const option = tokens[index]
    if (!foundCommandOption) {
      if (option === '--') return undefined
      if (shellValueOptions.has(option)) {
        index += 2
        continue
      }
      if (shell === 'fish' && option === '--command') {
        foundCommandOption = true
        index += 1
        continue
      }
      if (shell === 'fish' && option.startsWith('--command=')) {
        return option.slice('--command='.length)
      }
      if (/^-[A-Za-z]*c[A-Za-z]*$/.test(option)) {
        foundCommandOption = true
        index += 1
        continue
      }
    } else if (option === '--') {
      index += 1
      continue
    } else if (!option.startsWith('-') && !option.startsWith('+')) {
      return option
    }

    if (['-o', '+o', '-O', '+O'].includes(option)) index += 2
    else if (option.startsWith('-') || option.startsWith('+')) index += 1
    else break
  }
  return undefined
}

function shellInitCommandOperands(tokens, shellIndex) {
  if (baseName(tokens[shellIndex]) !== 'fish') return []
  const commands = []
  for (let index = shellIndex + 1; index < tokens.length; index += 1) {
    const option = tokens[index]
    if (option === '--') break
    if (option === '-C' || option === '--init-command') {
      if (tokens[index + 1] !== undefined) commands.push(tokens[index + 1])
      index += 1
    } else if (option.startsWith('--init-command=')) {
      commands.push(option.slice('--init-command='.length))
    } else if (/^-C.+/.test(option)) {
      commands.push(option.slice(2))
    }
  }
  return commands
}

function isRemoteTarget(token) {
  return token.length > 0 && !/^file:\/\//i.test(token)
}

function hasRemoteTarget(tokens) {
  return tokens.some(isRemoteTarget)
}

const curlShortValueOptions = new Set([
  'A', 'C', 'D', 'E', 'F', 'H', 'K', 'P', 'Q', 'T', 'U', 'X', 'Y',
  'b', 'c', 'd', 'e', 'h', 'm', 'o', 'r', 't', 'u', 'w', 'x', 'y', 'z',
])

function curlShortValueOption(token) {
  if (!/^-[^-]/.test(token)) return undefined
  const options = token.slice(1)
  for (let offset = 0; offset < options.length; offset += 1) {
    const name = options[offset]
    if (!curlShortValueOptions.has(name)) continue
    return {
      name,
      value: options.slice(offset + 1),
      consumesNext: offset === options.length - 1,
    }
  }
  return undefined
}

function curlCommandInfo(tokens, index) {
  const targets = []
  let hasConfig = false
  let importsSecretVariable = false
  const valueOptions = new Set([
    '--abstract-unix-socket', '--alt-svc', '--aws-sigv4', '--cacert', '--capath',
    '--cert', '--cert-type', '--ciphers', '--config', '--connect-timeout',
    '--connect-to', '--continue-at', '--cookie', '--cookie-jar',
    '--create-file-mode', '--crlfile', '--curves', '--data', '--data-ascii',
    '--data-binary', '--data-raw', '--data-urlencode', '--delegation',
    '--dns-interface', '--dns-ipv4-addr', '--dns-ipv6-addr', '--dns-servers',
    '--doh-url', '--dump-header', '--egd-file', '--engine', '--etag-compare',
    '--etag-save', '--expect100-timeout', '--form', '--form-string',
    '--ftp-account', '--ftp-alternative-to-user', '--ftp-method', '--ftp-port',
    '--ftp-ssl-ccc-mode', '--happy-eyeballs-timeout-ms', '--haproxy-clientip',
    '--header', '--help', '--hostpubmd5', '--hostpubsha256', '--hsts',
    '--interface', '--ipfs-gateway', '--json', '--keepalive-time', '--key',
    '--key-type', '--krb', '--libcurl', '--limit-rate', '--local-port',
    '--login-options', '--mail-auth', '--mail-from', '--mail-rcpt',
    '--max-filesize', '--max-redirs', '--max-time', '--netrc-file', '--noproxy',
    '--oauth2-bearer', '--output', '--output-dir', '--parallel-max', '--pass',
    '--pinnedpubkey', '--preproxy', '--proto', '--proto-default', '--proto-redir',
    '--proxy', '--proxy-cacert', '--proxy-capath', '--proxy-cert',
    '--proxy-cert-type', '--proxy-ciphers', '--proxy-crlfile', '--proxy-header',
    '--proxy-key', '--proxy-key-type', '--proxy-pass', '--proxy-pinnedpubkey',
    '--proxy-service-name', '--proxy-tls13-ciphers', '--proxy-tlsauthtype',
    '--proxy-tlspassword', '--proxy-tlsuser', '--proxy-user', '--proxy1.0',
    '--pubkey', '--quote', '--random-file', '--range', '--rate', '--referer',
    '--request', '--request-target', '--resolve', '--retry', '--retry-delay',
    '--retry-max-time', '--sasl-authzid', '--service-name', '--socks4',
    '--socks4a', '--socks5', '--socks5-gssapi-service', '--socks5-hostname',
    '--speed-limit', '--speed-time', '--stderr', '--telnet-option',
    '--tftp-blksize', '--time-cond', '--tls-max', '--tls13-ciphers',
    '--tlsauthtype', '--tlspassword', '--tlsuser', '--trace', '--trace-ascii',
    '--trace-config', '--unix-socket', '--upload-file', '--url-query', '--user',
    '--user-agent', '--variable', '--write-out'
  ])

  for (let offset = index + 1; offset < tokens.length; offset += 1) {
    const token = tokens[offset]
    if (token === '--') {
      targets.push(...tokens.slice(offset + 1))
      break
    }
    if (token === '--url') {
      if (tokens[offset + 1] !== undefined) targets.push(tokens[offset + 1])
      offset += 1
      continue
    }
    if (token === '--expand-url') {
      if (tokens[offset + 1] !== undefined) targets.push(tokens[offset + 1])
      offset += 1
      continue
    }
    if (token.startsWith('--url=')) {
      targets.push(token.slice('--url='.length))
      continue
    }
    if (token.startsWith('--expand-url=')) {
      targets.push(token.slice('--expand-url='.length))
      continue
    }
    const shortOption = curlShortValueOption(token)
    if (shortOption) {
      if (shortOption.name === 'K') hasConfig = true
      if (shortOption.consumesNext) offset += 1
      continue
    }
    if (token === '--config' || token.startsWith('--config=')) hasConfig = true
    if (token === '--variable' && curlSecretVariablePattern.test(tokens[offset + 1] || '')) {
      importsSecretVariable = true
    } else if (
      token.startsWith('--variable=') &&
      curlSecretVariablePattern.test(token.slice('--variable='.length))
    ) {
      importsSecretVariable = true
    }
    if (valueOptions.has(token)) {
      offset += 1
      continue
    }
    if (token.startsWith('-')) continue
    targets.push(token)
  }
  return { hasConfig, importsSecretVariable, targets }
}

function wgetTargets(tokens, index) {
  const targets = []
  const valueOptions = new Set([
    '--post-data', '--post-file', '-O', '--output-document', '-o', '--output-file',
    '-a', '--append-output', '-P', '--directory-prefix', '-U', '--user-agent',
    '--header', '--user', '--password', '--proxy-user', '--proxy-password',
    '--timeout', '--tries', '--wait', '--limit-rate', '--bind-address', '--referer',
    '--certificate', '--private-key', '--ca-certificate'
  ])

  for (let offset = index + 1; offset < tokens.length; offset += 1) {
    const token = tokens[offset]
    if (token === '--') {
      targets.push(...tokens.slice(offset + 1))
      break
    }
    if (valueOptions.has(token)) {
      offset += 1
      continue
    }
    if (/^-(?:O|o|a|P|U).+/.test(token) || token.startsWith('-')) continue
    targets.push(token)
  }
  return targets
}

function isAuthorizationHeader(value) {
  return /^\s*(?:proxy-)?authorization:\s*\S+/i.test(value)
}

function hasUrlUserinfo(value) {
  return /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/@\s]+@/.test(value)
}

function readBracedParameterExpansion(value, openIndex) {
  const quotes = ['']
  let index = openIndex + 1

  while (index < value.length) {
    const char = value[index]
    const quote = quotes.at(-1)

    if (quote === "'") {
      if (char === "'") quotes[quotes.length - 1] = ''
      index += 1
      continue
    }
    if (char === '\\' && index + 1 < value.length) {
      index += 2
      continue
    }
    if (char === '"') {
      quotes[quotes.length - 1] = quote === '"' ? '' : '"'
      index += 1
      continue
    }
    if (!quote && char === "'") {
      quotes[quotes.length - 1] = "'"
      index += 1
      continue
    }
    if (char === '$' && value[index + 1] === '{') {
      quotes.push('')
      index += 2
      continue
    }
    if (char === '$' && value[index + 1] === '(') {
      const parsed = readParenthesizedCommand(value, index + 1)
      if (!parsed) return null
      index = parsed.nextIndex
      continue
    }
    if (char === '`') {
      index += 1
      while (index < value.length && value[index] !== '`') {
        index += value[index] === '\\' && index + 1 < value.length ? 2 : 1
      }
      if (index === value.length) return null
      index += 1
      continue
    }
    if (!quote && char === '}') {
      quotes.pop()
      index += 1
      if (quotes.length === 0) return { nextIndex: index }
      continue
    }
    index += 1
  }
  return null
}

function shiftedExpansionOffsets(offsets, startIndex) {
  return (offsets || [])
    .filter((offset) => offset >= startIndex)
    .map((offset) => offset - startIndex)
}

function codexHomeSuffix(value, activeExpansionOffsets = []) {
  const plainPrefix = '$CODEX_HOME'
  const bracedPrefix = '${CODEX_HOME'
  const activeOffsets = new Set(activeExpansionOffsets)
  const containingExpansions = []
  const replacementWordStart = (openIndex, endIndex) => {
    const body = value.slice(openIndex + 2, endIndex - 1)
    const matched = body.match(
      /^(?:[A-Za-z_][A-Za-z0-9_]*|[0-9]+|[@*#?$!-])(?::)?[-=?+]/,
    )
    return matched ? openIndex + 2 + matched[0].length : undefined
  }
  const hasPureWrapperPrefix = (referenceIndex) => {
    if (containingExpansions.length === 0) return referenceIndex === 0
    if (containingExpansions[0].openIndex !== 0) return false
    return containingExpansions.every((expansion, expansionIndex) => {
      const nextStart =
        containingExpansions[expansionIndex + 1]?.openIndex ?? referenceIndex
      return activeOffsets.has(expansion.openIndex) &&
        expansion.wordStart === nextStart
    })
  }
  const activeExpansionEnd = (startIndex) => {
    if (value[startIndex] === '`') {
      let index = startIndex + 1
      while (index < value.length) {
        if (value[index] === '\\' && index + 1 < value.length) index += 2
        else if (value[index] === '`') return index + 1
        else index += 1
      }
      return undefined
    }
    if (value[startIndex] !== '$') return undefined
    if (value[startIndex + 1] === '{') {
      return readBracedParameterExpansion(value, startIndex + 1)?.nextIndex
    }
    if (value[startIndex + 1] === '(') {
      return readParenthesizedCommand(value, startIndex + 1)?.nextIndex
    }
    const parameter = value.slice(startIndex + 1).match(
      /^(?:[A-Za-z_][A-Za-z0-9_]*|[0-9]|[*@#?$!-])/,
    )
    return parameter ? startIndex + 1 + parameter[0].length : undefined
  }
  const hasPotentiallyEmptyPrefix = (referenceIndex) => {
    let prefixIndex = 0
    while (prefixIndex < referenceIndex) {
      if (!activeOffsets.has(prefixIndex)) return false
      const nextIndex = activeExpansionEnd(prefixIndex)
      if (nextIndex === undefined || nextIndex > referenceIndex) return false
      prefixIndex = nextIndex
    }
    return prefixIndex === referenceIndex
  }
  const hasAcceptedPrefix = (referenceIndex) =>
    hasPureWrapperPrefix(referenceIndex) ||
    hasPotentiallyEmptyPrefix(referenceIndex)
  const hasActiveSuffixExpansion = (referenceEnd) =>
    activeExpansionOffsets.some((offset) => offset >= referenceEnd)
  const containingSuffix = (referenceEnd) => {
    if (containingExpansions.length === 0) return undefined
    const closingIndexes = new Set(
      containingExpansions.map(({ endIndex }) => endIndex - 1),
    )
    let suffix = ''
    for (let index = referenceEnd; index < value.length; index += 1) {
      if (!closingIndexes.has(index)) suffix += value[index]
    }
    return suffix
  }

  for (let index = 0; index < value.length; index += 1) {
    while (containingExpansions.at(-1)?.endIndex <= index) {
      containingExpansions.pop()
    }
    if (
      value.startsWith(plainPrefix, index) &&
      !/[A-Za-z0-9_]/.test(value[index + plainPrefix.length] || '') &&
      activeOffsets.has(index) &&
      hasAcceptedPrefix(index)
    ) {
      const referenceEnd = index + plainPrefix.length
      return {
        suffix: value.slice(referenceEnd),
        containingSuffix: containingSuffix(referenceEnd),
        hasActiveSuffixExpansion: hasActiveSuffixExpansion(referenceEnd),
      }
    }
    let parsedBraced
    if (value.startsWith(bracedPrefix, index)) {
      const operator = value[index + bracedPrefix.length]
      if (
        operator === '}' ||
        operator === '[' ||
        /[-:=?+%#/,^@]/.test(operator || '')
      ) {
        parsedBraced = readBracedParameterExpansion(value, index + 1)
        if (!parsedBraced) return undefined
        const operation = value.slice(
          index + bracedPrefix.length,
          parsedBraced.nextIndex - 1,
        )
        const substringOffset =
          /^:(?![-=?+])[ \t]*[+-]?([0-9]+)$/.exec(operation)
        const isSubstringOperation =
          operation.startsWith(':') && !/^:[-=?+]/.test(operation)
        const isNonzeroSimpleSubstring =
          substringOffset && /[1-9]/.test(substringOffset[1])
        const subscript = /^\[([^\]]*)\]$/.exec(operation)
        const decimalSubscript =
          subscript &&
          /^[ \t]*\+?(0*[1-9][0-9]*)[ \t]*$/.exec(subscript[1])
        const significantSubscriptDigits =
          decimalSubscript?.[1].replace(/^0+/, '')
        const isKnownNonidentitySubscript =
          significantSubscriptDigits !== undefined &&
          significantSubscriptDigits.length <= 18
        if (
          operation === '' ||
          /^(?::)?[-=?]/.test(operation) ||
          (isSubstringOperation && !isNonzeroSimpleSubstring) ||
          (subscript && !isKnownNonidentitySubscript) ||
          /^[%#/,^@]/.test(operation)
        ) {
          if (!activeOffsets.has(index) || !hasAcceptedPrefix(index)) {
            containingExpansions.push({
              openIndex: index,
              endIndex: parsedBraced.nextIndex,
              wordStart: replacementWordStart(index, parsedBraced.nextIndex),
            })
            continue
          }
          return {
            suffix: value.slice(parsedBraced.nextIndex),
            containingSuffix: containingSuffix(parsedBraced.nextIndex),
            hasActiveSuffixExpansion:
              hasActiveSuffixExpansion(parsedBraced.nextIndex),
          }
        }
      }
    }
    if (value[index] !== '$' || value[index + 1] !== '{') continue
    const parsed = parsedBraced || readBracedParameterExpansion(value, index + 1)
    if (!parsed) return undefined
    containingExpansions.push({
      openIndex: index,
      endIndex: parsed.nextIndex,
      wordStart: replacementWordStart(index, parsed.nextIndex),
    })
  }
  return undefined
}

function isHighSignalCredentialPath(token, activeExpansionOffsets = []) {
  if (typeof token !== 'string' || token.length === 0) return false
  const candidates = [{ raw: token, startIndex: 0 }]
  const equalIndex = token.indexOf('=')
  if (equalIndex >= 0) {
    candidates.push({ raw: token.slice(equalIndex + 1), startIndex: equalIndex + 1 })
  }
  return candidates.some(({ raw, startIndex }) => {
    let value = raw
    let valueOffsets = shiftedExpansionOffsets(activeExpansionOffsets, startIndex)
    const redirection = value.match(/^(?:[0-9]*)<{1,2}(?!<)/)?.[0] || ''
    value = value.slice(redirection.length)
    valueOffsets = shiftedExpansionOffsets(valueOffsets, redirection.length)
    if (value.startsWith('@')) {
      value = value.slice(1)
      valueOffsets = shiftedExpansionOffsets(valueOffsets, 1)
    }
    if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value)) return false
    if (/(?:^|\/)\.aws\/credentials$/i.test(value)) return true
    if (/(?:^|\/)\.codex\/auth\.json$/i.test(value)) return true
    const codexHome = codexHomeSuffix(value, valueOffsets)
    if (codexHome) {
      if (codexHome.hasActiveSuffixExpansion) return true
      if ([codexHome.suffix, codexHome.containingSuffix].some((suffix) =>
        suffix !== undefined &&
        path.posix.normalize(`/__CODEX_HOME__${suffix}`) ===
          '/__CODEX_HOME__/auth.json'
      )) return true
    }
    if (
      process.env.CODEX_HOME &&
      path.isAbsolute(value) &&
      path.resolve(value) === path.resolve(process.env.CODEX_HOME, 'auth.json')
    ) return true
    if (/(?:^|\/)\.ssh\/id_[^/]+$/i.test(value) && !/\.pub$/i.test(value)) return true
    return /\.(?:pem|key|p12|pfx)$/i.test(value)
  })
}

function isDotEnvPath(token) {
  if (typeof token !== 'string' || token.length === 0) return false
  const candidates = [token]
  if (token.includes('=')) candidates.push(token.slice(token.indexOf('=') + 1))
  return candidates.some((raw) =>
    /(?:^|\/)\.env(?:\.[A-Za-z0-9_-]+)?$/.test(
      raw.replace(/^(?:[0-9]*)<{1,2}(?!<)/, '').replace(/^@/, ''),
    )
  )
}

function isSensitiveFilePath(token, activeExpansionOffsets = []) {
  return isDotEnvPath(token) ||
    isHighSignalCredentialPath(token, activeExpansionOffsets)
}

function isSensitiveFileReference(token, activeExpansionOffsets = []) {
  if (typeof token !== 'string') return false
  const candidates = [{ value: token, startIndex: 0 }]
  const equalIndex = token.indexOf('=')
  if (equalIndex >= 0) {
    candidates.push({
      value: token.slice(equalIndex + 1),
      startIndex: equalIndex + 1,
    })
  }
  return candidates.some(({ value, startIndex }) =>
    value.startsWith('@') &&
      isSensitiveFilePath(
        value,
        shiftedExpansionOffsets(activeExpansionOffsets, startIndex),
      )
  )
}

function hasLiteralCurlCredential(tokens, index) {
  if (curlCommandInfo(tokens, index).targets.some(hasUrlUserinfo)) return true
  for (let offset = index + 1; offset < tokens.length; offset += 1) {
    const option = tokens[offset]
    const shortOption = curlShortValueOption(option)
    if (shortOption) {
      const optionValue = shortOption.consumesNext ? (tokens[offset + 1] || '') : shortOption.value
      if (['u', 'U'].includes(shortOption.name) && optionValue.length > 0) return true
      if (shortOption.name === 'H' && isAuthorizationHeader(optionValue)) return true
    }
    if (['--oauth2-bearer', '--proxy-user', '--user'].includes(option) && (tokens[offset + 1] || '').length > 0) return true
    if (/^--(?:oauth2-bearer|proxy-user|user)=.+/.test(option)) return true
    if (['--header', '--proxy-header'].includes(option) && isAuthorizationHeader(tokens[offset + 1] || '')) return true
    if (/^--(?:header|proxy-header)=/.test(option) && isAuthorizationHeader(option.slice(option.indexOf('=') + 1))) return true
  }
  return false
}

function hasLiteralWgetCredential(tokens, index) {
  if (wgetTargets(tokens, index).some(hasUrlUserinfo)) return true
  for (let offset = index + 1; offset < tokens.length; offset += 1) {
    const option = tokens[offset]
    if (option === '--header' && isAuthorizationHeader(tokens[offset + 1] || '')) return true
    if (option.startsWith('--header=') && isAuthorizationHeader(option.slice('--header='.length))) return true
    if (
      ['--user', '--password', '--proxy-user', '--proxy-password'].includes(option) &&
      (tokens[offset + 1] || '').length > 0
    ) return true
    if (/^--(?:user|password|proxy-user|proxy-password)=.+/.test(option)) return true
  }
  return false
}

function hasCurlUpload(tokens, index) {
  const { hasConfig, targets } = curlCommandInfo(tokens, index)
  if (hasConfig) return true
  if (!hasRemoteTarget(targets)) return false
  if (targets.some((target) => hasSecretSource(target) || hasUrlUserinfo(target))) return true
  for (let offset = index + 1; offset < tokens.length; offset += 1) {
    const option = tokens[offset]
    const shortOption = curlShortValueOption(option)
    if (shortOption) {
      const value = shortOption.consumesNext ? (tokens[offset + 1] || '') : shortOption.value
      if (['d', 'F', 'T'].includes(shortOption.name)) return true
      if (shortOption.name === 'K' && (value === '-' || hasSecretSource(value))) return true
      if (shortOption.name === 'X' && /^(POST|PUT|PATCH)$/i.test(value)) return true
      if (['u', 'U'].includes(shortOption.name) && value.length > 0) return true
      if (shortOption.name === 'H' && (isAuthorizationHeader(value) || hasSecretSource(value))) return true
      if (['A', 'b', 'e'].includes(shortOption.name) && hasSecretSource(value)) return true
    }
    if (
      /^--(?:expand-)?(?:data(?:-ascii|-binary|-raw|-urlencode)?|form(?:-string)?|upload-file|json)(?:=|$)/.test(option)
    ) return true
    if (
      /^--expand-(?:header|proxy-header|cookie|referer|user-agent|url-query|request-target|url)(?:=|$)/.test(option)
    ) return true
    if (option === '--request' && /^(POST|PUT|PATCH)$/i.test(tokens[offset + 1] || '')) return true
    if (/^--request=(?:POST|PUT|PATCH)$/i.test(option)) return true
    if (
      /^(?:--user|--proxy-user|--oauth2-bearer)$/.test(option) &&
      (tokens[offset + 1] || '').length > 0
    ) return true
    if (
      /^--(?:user|proxy-user|oauth2-bearer)=.+/.test(option)
    ) return true
    if (
      /^(?:--header|--proxy-header)$/.test(option) &&
      (isAuthorizationHeader(tokens[offset + 1] || '') || hasSecretSource(tokens[offset + 1] || ''))
    ) return true
    if (
      /^--(?:header|proxy-header)=/.test(option) &&
      (isAuthorizationHeader(option.slice(option.indexOf('=') + 1)) || hasSecretSource(option.slice(option.indexOf('=') + 1)))
    ) return true
    if (
      /^(?:--cookie|--referer|--user-agent|--url-query|--request-target)$/.test(option) &&
      hasSecretSource(tokens[offset + 1] || '')
    ) return true
    if (
      /^--(?:cookie|referer|user-agent|url-query|request-target)=/.test(option) &&
      hasSecretSource(option.slice(option.indexOf('=') + 1))
    ) return true
  }
  return false
}

function hasWgetEgress(tokens, index) {
  const targets = wgetTargets(tokens, index)
  if (!hasRemoteTarget(targets)) return false
  if (targets.some((target) => hasSecretSource(target) || hasUrlUserinfo(target))) return true
  for (let offset = index + 1; offset < tokens.length; offset += 1) {
    const option = tokens[offset]
    if (/^--post-(?:data|file)(?:=|$)/.test(option)) return true
    if (
      option === '--header' &&
      (isAuthorizationHeader(tokens[offset + 1] || '') || hasSecretSource(tokens[offset + 1] || ''))
    ) return true
    if (
      option.startsWith('--header=') &&
      (isAuthorizationHeader(option.slice('--header='.length)) ||
        hasSecretSource(option.slice('--header='.length)))
    ) return true
    if (
      ['--user', '--password', '--proxy-user', '--proxy-password'].includes(option) &&
      (tokens[offset + 1] || '').length > 0
    ) return true
    if (/^--(?:user|password|proxy-user|proxy-password)=.+/.test(option)) return true
  }
  return false
}

function isRemoteCopyTarget(token) {
  return /^(?:s(?:cp|ync):\/\/|(?:[A-Za-z0-9._-]+@)?(?:[A-Za-z0-9._-]+|\[[0-9A-Fa-f:]+(?:%[A-Za-z0-9._-]+)?\]):)/i.test(token)
}

const remoteCopyValueOptions = {
  scp: new Set(['-c', '-D', '-F', '-i', '-J', '-l', '-o', '-P', '-S', '-X']),
  rsync: new Set([
    '-e', '-M',
    '--backup-dir', '--bwlimit', '--chown', '--compare-dest', '--contimeout',
    '--copy-dest', '--exclude', '--exclude-from', '--files-from', '--filter', '--groupmap',
    '--include', '--include-from', '--link-dest', '--log-file', '--max-size', '--min-size',
    '--out-format', '--password-file', '--remote-option', '--rsync-path', '--rsh',
    '--suffix', '--temp-dir', '--timeout', '--usermap',
  ]),
}

function remoteCopyOperandEntries(tokens, index, executable) {
  const operands = []
  for (let offset = index + 1; offset < tokens.length; offset += 1) {
    const token = tokens[offset]
    if (token === '--') {
      for (let operandIndex = offset + 1; operandIndex < tokens.length; operandIndex += 1) {
        operands.push({ token: tokens[operandIndex], index: operandIndex })
      }
      break
    }
    if (remoteCopyValueOptions[executable].has(token)) {
      offset += 1
      continue
    }
    if (token.startsWith('-')) continue
    operands.push({ token, index: offset })
  }
  return operands
}

function hasUpload(value) {
  for (const {
    tokens,
    activeShellExpansionOffsets,
    separatorBefore,
  } of shellParts(value)) {
    const index = commandIndex(tokens)
    const executable = baseName(tokens[index])
    if (executable === 'curl' && hasCurlUpload(tokens, index)) return true
    if (executable === 'wget' && hasWgetEgress(tokens, index)) return true
    if (
      ['nc', 'ncat', 'netcat'].includes(executable) &&
      (
        ['|', '|&'].includes(separatorBefore) ||
        tokens.slice(index + 1).some((token) => /^(?:[0-9]+)?<{1,3}/.test(token))
      )
    ) return true
    if (['scp', 'rsync'].includes(executable)) {
      const operands = remoteCopyOperandEntries(tokens, index, executable)
      const destination = operands.at(-1)
      if (
        destination &&
        (
          isRemoteCopyTarget(destination.token) ||
          activeShellExpansionOffsets[destination.index].length > 0
        ) &&
        operands.slice(0, -1).some(({ token, index: operandIndex }) =>
          isSensitiveFilePath(
            token,
            activeShellExpansionOffsets[operandIndex],
          )
        )
      ) return true
    }
  }
  return false
}

const secretName = String.raw`(?:[A-Z0-9_]*(?:API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL)[A-Z0-9_]*|(?:[A-Z0-9_]+_)?PAT(?:_[A-Z0-9_]+)?)`
const curlSecretVariablePattern = new RegExp(String.raw`^%${secretName}(?:=|$)`, 'i')
const secretSourcePattern = new RegExp(
  String.raw`(?:\$\{?${secretName}\}?|\b(?:printenv|env)(?:\s+${secretName}\b|\s*\|)|\bgh\s+auth\s+token\b|\bop\s+read\b)`,
  'i',
)

function curlSensitiveFileSource(tokens, activeShellExpansionOffsets, index) {
  const directOptions = new Set(['--config', '--cookie', '--netrc-file', '--upload-file'])
  const referenceOptions =
    /^--(?:data(?:-ascii|-binary|-urlencode)?|form|header|json|proxy-header)$/
  for (let offset = index + 1; offset < tokens.length; offset += 1) {
    const option = tokens[offset]
    const shortOption = curlShortValueOption(option)
    if (shortOption) {
      const valueIndex = shortOption.consumesNext ? offset + 1 : offset
      const optionValue = shortOption.consumesNext ? (tokens[valueIndex] || '') : shortOption.value
      const valueStart = shortOption.consumesNext
        ? 0
        : option.length - optionValue.length
      const valueOffsets = shiftedExpansionOffsets(
        activeShellExpansionOffsets[valueIndex],
        valueStart,
      )
      if (
        ['K', 'T', 'b'].includes(shortOption.name) &&
        isSensitiveFilePath(optionValue, valueOffsets)
      ) return true
      if (
        ['d', 'F', 'H'].includes(shortOption.name) &&
        isSensitiveFileReference(optionValue, valueOffsets)
      ) return true
      if (shortOption.consumesNext) offset += 1
      continue
    }
    if (
      directOptions.has(option) &&
      isSensitiveFilePath(
        tokens[offset + 1] || '',
        activeShellExpansionOffsets[offset + 1],
      )
    ) return true
    if (
      referenceOptions.test(option) &&
      isSensitiveFileReference(
        tokens[offset + 1] || '',
        activeShellExpansionOffsets[offset + 1],
      )
    ) return true
    const equal = option.indexOf('=')
    if (equal > 0) {
      const name = option.slice(0, equal)
      const optionValue = option.slice(equal + 1)
      const valueOffsets = shiftedExpansionOffsets(
        activeShellExpansionOffsets[offset],
        equal + 1,
      )
      if (
        directOptions.has(name) &&
        isSensitiveFilePath(optionValue, valueOffsets)
      ) return true
      if (
        referenceOptions.test(name) &&
        isSensitiveFileReference(optionValue, valueOffsets)
      ) return true
    }
  }
  return false
}

function wgetSensitiveFileSource(tokens, activeShellExpansionOffsets, index) {
  for (let offset = index + 1; offset < tokens.length; offset += 1) {
    const option = tokens[offset]
    if (
      option === '--post-file' &&
      isSensitiveFilePath(
        tokens[offset + 1] || '',
        activeShellExpansionOffsets[offset + 1],
      )
    ) return true
    if (
      option.startsWith('--post-file=') &&
      isSensitiveFilePath(
        option.slice('--post-file='.length),
        shiftedExpansionOffsets(
          activeShellExpansionOffsets[offset],
          '--post-file='.length,
        ),
      )
    ) {
      return true
    }
  }
  return false
}

function hasSensitiveFileSource(value) {
  return shellParts(value).some(({ tokens, activeShellExpansionOffsets }) => {
    const index = commandIndex(tokens)
    const executable = baseName(tokens[index])
    if (executable === 'curl') {
      return curlSensitiveFileSource(tokens, activeShellExpansionOffsets, index)
    }
    if (executable === 'wget') {
      return wgetSensitiveFileSource(tokens, activeShellExpansionOffsets, index)
    }
    if (['scp', 'rsync'].includes(executable)) {
      return remoteCopyOperandEntries(tokens, index, executable)
        .slice(0, -1)
        .some(({ token, index: operandIndex }) =>
          isSensitiveFilePath(
            token,
            activeShellExpansionOffsets[operandIndex],
          )
        )
    }
    return tokens.some((token, tokenIndex) =>
      isSensitiveFilePath(token, activeShellExpansionOffsets[tokenIndex])
    )
  })
}

function hasSecretSource(value) {
  if (secretSourcePattern.test(value)) return true
  if (hasSensitiveFileSource(value)) return true
  return shellParts(value).some(({ tokens }) => {
    const index = commandIndex(tokens)
    const executable = baseName(tokens[index])
    if (executable === 'curl') {
      const info = curlCommandInfo(tokens, index)
      return hasLiteralCurlCredential(tokens, index) || info.importsSecretVariable
    }
    return executable === 'wget' && hasLiteralWgetCredential(tokens, index)
  })
}

function auditEgressBlock() {
  const log = process.env.HARNESS_GUARD_LOG
  if (!log) return
  const sanitize = (value, limit) => Array.from(String(value ?? ''))
    .map((char) => (/[\p{Cc}]/u.test(char) ? ' ' : char))
    .join('')
    .slice(0, limit)
  const fingerprint = createHash('sha256').update(command).digest('hex')
  const line = `${new Date().toISOString()} session=${sanitize(hook?.session_id, 80) || '?'} cwd=${sanitize(hook?.cwd, 256) || '?'} DENY 시크릿 외부 전송 차단 | cmd=sha256:${fingerprint}\n`
  try {
    mkdirSync(path.dirname(log), { recursive: true, mode: 0o700 })
    appendFileSync(log, line, { encoding: 'utf8', mode: 0o600 })
    chmodSync(log, 0o600)
  } catch {
    process.stderr.write('Codex secret-egress audit log write failed\n')
  }
}

const logicalCommands = logicalShellCommands(command)
const blocked = logicalCommands.truncated || logicalCommands.commands.some((logicalCommand) => {
  return hasSecretSource(logicalCommand) && hasUpload(logicalCommand)
})

if (blocked) {
  auditEgressBlock()
  process.stderr.write('⛔ [security] 명백한 시크릿 외부 전송 패턴을 차단했습니다. 네트워크 전송이 필요하면 시크릿을 제거하고 사용자 승인을 받으세요.\n')
  process.exit(2)
}

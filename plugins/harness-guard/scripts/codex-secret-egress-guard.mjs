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
    for (const tokens of shellSegments(current)) {
      const index = commandIndex(tokens)
      if (!['ash', 'bash', 'csh', 'dash', 'fish', 'ksh', 'mksh', 'sh', 'tcsh', 'yash', 'zsh'].includes(baseName(tokens[index]))) continue
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

function shellSegments(value) {
  return shellParts(value).map(({ tokens }) => tokens)
}

function shellParts(value) {
  const parts = []
  let tokens = []
  let word = ''
  let wordStarted = false
  let quote = ''
  let index = 0
  let separatorBefore = ''

  const pushWord = () => {
    if (!wordStarted) return
    tokens.push(word)
    word = ''
    wordStarted = false
  }
  const pushSegment = (separatorAfter = '') => {
    pushWord()
    if (tokens.length > 0) {
      parts.push({ tokens, separatorBefore })
      tokens = []
    }
    separatorBefore = separatorAfter
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
      word += char
      wordStarted = true
      index += 1
    }
  }
  pushSegment()
  return parts
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

  while (index < tokens.length) {
    const option = tokens[index]
    if (!foundCommandOption) {
      if (option === '--') return undefined
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

function curlTargets(tokens, index) {
  const targets = []
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
    if (token.startsWith('--url=')) {
      targets.push(token.slice('--url='.length))
      continue
    }
    const shortOption = curlShortValueOption(token)
    if (shortOption) {
      if (shortOption.consumesNext) offset += 1
      continue
    }
    if (valueOptions.has(token)) {
      offset += 1
      continue
    }
    if (token.startsWith('-')) continue
    targets.push(token)
  }
  return targets
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

function hasCurlUpload(tokens, index) {
  const targets = curlTargets(tokens, index)
  if (!hasRemoteTarget(targets)) return false
  if (targets.some(hasSecretSource)) return true
  for (let offset = index + 1; offset < tokens.length; offset += 1) {
    const option = tokens[offset]
    const shortOption = curlShortValueOption(option)
    if (shortOption) {
      const value = shortOption.consumesNext ? (tokens[offset + 1] || '') : shortOption.value
      if (['d', 'F', 'T'].includes(shortOption.name)) return true
      if (shortOption.name === 'X' && /^(POST|PUT|PATCH)$/i.test(value)) return true
      if (['A', 'H', 'U', 'b', 'e', 'u'].includes(shortOption.name) && hasSecretSource(value)) return true
    }
    if (
      /^--(?:data(?:-ascii|-binary|-raw|-urlencode)?|form(?:-string)?|upload-file|json)(?:=|$)/.test(option)
    ) return true
    if (option === '--request' && /^(POST|PUT|PATCH)$/i.test(tokens[offset + 1] || '')) return true
    if (/^--request=(?:POST|PUT|PATCH)$/i.test(option)) return true
    if (
      /^(?:--header|--proxy-header|--user|--proxy-user|--oauth2-bearer|--cookie|--referer|--user-agent|--url-query|--request-target)$/.test(option) &&
      hasSecretSource(tokens[offset + 1] || '')
    ) return true
    if (
      /^(?:--header|--proxy-header|--user|--proxy-user|--oauth2-bearer|--cookie|--referer|--user-agent|--url-query|--request-target)=/.test(option) &&
      hasSecretSource(option.slice(option.indexOf('=') + 1))
    ) return true
  }
  return false
}

function hasUpload(value) {
  for (const { tokens, separatorBefore } of shellParts(value)) {
    const index = commandIndex(tokens)
    const executable = baseName(tokens[index])
    if (executable === 'curl' && hasCurlUpload(tokens, index)) return true
    if (
      executable === 'wget' &&
      hasRemoteTarget(wgetTargets(tokens, index)) &&
      tokens.slice(index + 1).some((token) => /^--post-(?:data|file)(?:=|$)/.test(token))
    ) return true
    if (
      ['nc', 'ncat', 'netcat'].includes(executable) &&
      (
        ['|', '|&'].includes(separatorBefore) ||
        tokens.slice(index + 1).some((token) => /^(?:[0-9]+)?<{1,3}/.test(token))
      )
    ) return true
    if (
      ['scp', 'rsync'].includes(executable) &&
      tokens.slice(index + 1).some((token) => /(?:^|\/)\.env(?:\.[A-Za-z0-9_-]+)?$/.test(token)) &&
      tokens.slice(index + 1).some((token) => /^[A-Za-z0-9._-]+@[^\s:]+:/.test(token))
    ) return true
  }
  return false
}

const secretName = String.raw`(?:[A-Z0-9_]*(?:API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL)[A-Z0-9_]*|(?:[A-Z0-9_]+_)?PAT(?:_[A-Z0-9_]+)?)`
const secretSourcePattern = new RegExp(
  String.raw`(?:\$\{?${secretName}\}?|\b(?:printenv|env)(?:\s+${secretName}\b|\s*\|)|\bgh\s+auth\s+token\b|\bop\s+read\b|(?:^|[\s"'=@/<])\.env(?:\.[A-Za-z0-9_-]+)?\b)`,
  'i',
)

function hasSecretSource(value) {
  return secretSourcePattern.test(value)
}

const logicalCommands = logicalShellCommands(command)
const blocked = logicalCommands.truncated || logicalCommands.commands.some((logicalCommand) => {
  return hasSecretSource(logicalCommand) && hasUpload(logicalCommand)
})

if (blocked) {
  process.stderr.write('⛔ [security] 명백한 시크릿 외부 전송 패턴을 차단했습니다. 네트워크 전송이 필요하면 시크릿을 제거하고 사용자 승인을 받으세요.\n')
  process.exit(2)
}

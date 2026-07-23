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
  const wrapper = /(?:^|[;&|()]\s*)(?:\/(?:usr\/)?bin\/)?(?:bash|sh|zsh)\b[ \t]+-[A-Za-z]*c[A-Za-z]*[ \t]+(?:"((?:\\[\s\S]|[^"])*)"|'([^']*)')/g
  let match
  while ((match = wrapper.exec(outer)) !== null) {
    commands.push(collapseLineContinuations(match[1] ?? match[2]))
  }
  return commands
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

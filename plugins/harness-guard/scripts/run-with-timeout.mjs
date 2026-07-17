#!/usr/bin/env node
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const secondsIndex = args.indexOf('--seconds')
const separatorIndex = args.indexOf('--')
const seconds = Number(secondsIndex >= 0 ? args[secondsIndex + 1] : NaN)
const command = separatorIndex >= 0 ? args.slice(separatorIndex + 1).join(' ') : ''

if (!Number.isFinite(seconds) || seconds <= 0 || !command) {
  console.error('사용법: run-with-timeout.mjs --seconds <양수> -- "<shell command>"')
  process.exit(2)
}

const shell = process.env.SHELL || '/bin/sh'
const detached = process.platform !== 'win32'
const child = spawn(shell, ['-lc', command], { stdio: 'inherit', detached })
let timedOut = false

function signalChild(signal) {
  try {
    if (detached) process.kill(-child.pid, signal)
    else child.kill(signal)
  } catch {
    // 이미 종료된 프로세스는 별도 처리가 필요 없다.
  }
}

const timer = setTimeout(() => {
  timedOut = true
  console.error(`검증 명령 timeout: ${seconds}초`)
  signalChild('SIGTERM')
  // group leader가 먼저 끝나도 descendant 정리가 완료될 때까지 프로세스를 유지한다.
  setTimeout(() => signalChild('SIGKILL'), 1000)
}, seconds * 1000)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => signalChild(signal))
}

child.on('error', (error) => {
  clearTimeout(timer)
  console.error(`검증 명령 실행 실패: ${error.message}`)
  process.exitCode = 2
})

child.on('exit', (code, signal) => {
  clearTimeout(timer)
  if (timedOut) process.exitCode = 124
  else if (signal) process.exitCode = 1
  else process.exitCode = code ?? 1
})

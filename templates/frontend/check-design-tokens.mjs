#!/usr/bin/env node
/*
 * 디자인 토큰 게이트 — 하드코딩 색 클래스를 빌드 실패로 막는다.
 * 원칙: 색은 시맨틱 토큰(text-foreground·bg-card·text-muted-foreground·bg-primary·text-chart-1 …)만.
 * 숫자 스케일(gray-500·blue-600 등)과 bg-white는 다크모드를 깨뜨리므로 금지.
 * 의도적 예외(고정 그라데이션 위 흰 글자 등)는 줄 끝에 `// design-token-ok` 주석으로 허용.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'src'
const EXTS = ['.ts', '.tsx', '.js', '.jsx']
// 금지: (text|bg|border|ring|fill|stroke|from|to|via|divide|outline|shadow|accent|placeholder)-<색이름>-<숫자>  + 단독 bg-white
const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const PREFIX = 'text|bg|border|ring|fill|stroke|from|to|via|divide|outline|accent|placeholder|shadow'
const BANNED = new RegExp(`\\b(?:${PREFIX})-(?:${PALETTE})-\\d{2,3}\\b|\\bbg-white\\b`, 'g')
const ALLOW = '// design-token-ok'

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) out.push(...walk(p))
    else if (EXTS.some((e) => p.endsWith(e))) out.push(p)
  }
  return out
}

const violations = []
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.includes(ALLOW)) return
    const m = line.match(BANNED)
    if (m) violations.push({ file, line: i + 1, hits: [...new Set(m)].join(', ') })
  })
}

if (violations.length) {
  console.error(`\n✖ 하드코딩 색 ${violations.length}건 — 시맨틱 토큰을 쓰세요(다크모드 보장):`)
  for (const v of violations.slice(0, 50)) console.error(`  ${v.file}:${v.line}  →  ${v.hits}`)
  if (violations.length > 50) console.error(`  … 외 ${violations.length - 50}건`)
  console.error('\n  매핑: gray-900→foreground, gray-500→muted-foreground, bg-white→bg-card, blue→primary, green→success, red→destructive, amber→warning.')
  console.error('  의도적 예외(고정 그라데이션 위 흰 글자 등)는 줄 끝에 `// design-token-ok`.\n')
  process.exit(1)
}
console.log('✓ 디자인 토큰 게이트 통과 — 하드코딩 색 0건')

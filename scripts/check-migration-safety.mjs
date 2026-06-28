#!/usr/bin/env node
/*
 * 마이그레이션 안전성 게이트 — 운영 DB 기동 실패 클래스를 CI에서 결정적으로 차단한다.
 *
 * 운영 장애 클래스: 모듈/도메인별 접두사 번호 규약(0xxx=common·1xxx=A·2xxx=B …)을 쓰면
 * 새 저접두사 마이그레이션이 이미 적용된 고접두사보다 버전이 낮은 "구조적 out-of-order"가 된다.
 * 이때 도구의 out-of-order 허용이 꺼져 있으면 기존·운영 DB가 validate 실패로 기동 불가하다.
 * (CI는 빈 DB에서 처음부터 적용하므로 통과 — liveness ≠ freshness. 이 함정을 정적으로 잡는다.)
 *
 * 정책(team-harness): 체크 가능한 규칙은 prose가 아니라 결정적 게이트로.
 *   - 검사 A: 접두사 번호 대역인데 out-of-order 설정이 없음 → FAIL
 *   - 검사 B: 접두사 번호 대역인데 out-of-order: false 명시됨 → FAIL (더 강한 신호)
 *   - 단조 증가 번호만 쓰는 repo / 마이그레이션·설정 미발견 / 타임스탬프 버전 → 통과(오탐 금지)
 *
 * 단일 출처: docs/db-standards.md · templates/rules/stacks/flyway.md
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

// ── 인자 파싱 ─────────────────────────────────────────────
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`마이그레이션 안전성 게이트 — 접두사 번호 대역 + out-of-order 설정 정합성 검사

사용법:
  node scripts/check-migration-safety.mjs [루트경로 …]
  node scripts/check-migration-safety.mjs --migrations <디렉터리> --config <설정파일>

옵션:
  [루트경로]            마이그레이션 파일·설정 파일을 함께 탐색할 루트 (기본: 현재 디렉터리)
  --migrations <dir>   마이그레이션 디렉터리 명시 (env: MIGRATION_DIR)
  --config <file>      Flyway 설정 파일 명시 (env: MIGRATION_CONFIG)
  --help, -h           이 도움말

종료 코드:
  0  통과 또는 skip(대상 없음 — 오탐 금지)
  1  FAIL — 접두사 대역인데 out-of-order 허용이 없음/false

검사 대상: Flyway류 버전 파일(V{번호}__설명.sql)과 out-of-order 설정.
`)
  process.exit(0)
}

function optVal(name) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : null
}
const explicitMigrations = optVal('--migrations') || process.env.MIGRATION_DIR || null
const explicitConfig = optVal('--config') || process.env.MIGRATION_CONFIG || null
const roots = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--migrations' && args[i - 1] !== '--config')
if (roots.length === 0) roots.push('.')

// ── 파일 탐색 ─────────────────────────────────────────────
const IGNORE = new Set(['node_modules', '.git', 'build', 'target', '.gradle', 'dist', '.next', 'out', 'vendor', '.venv'])
const FLYWAY_RE = /^V\d+.*__.*\.sql$/i           // V1__x.sql, V0001__x.sql, V20240101__x.sql
const CONFIG_NAMES = /^(application.*\.ya?ml|flyway\.conf|flyway\.toml|alembic\.ini)$/i

function walk(dir, onFile, depth = 0) {
  if (depth > 12 || !existsSync(dir)) return
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    if (IGNORE.has(name)) continue
    const p = join(dir, name)
    let s
    try { s = statSync(p) } catch { continue }
    if (s.isDirectory()) walk(p, onFile, depth + 1)
    else onFile(p, name)
  }
}

const migrationFiles = []
const configFiles = []

if (explicitMigrations) {
  walk(explicitMigrations, (p, name) => { if (FLYWAY_RE.test(name)) migrationFiles.push(p) })
}
if (explicitConfig) {
  if (existsSync(explicitConfig)) configFiles.push(explicitConfig)
}
if (!explicitMigrations || !explicitConfig) {
  for (const root of roots) {
    walk(root, (p, name) => {
      if (!explicitMigrations && FLYWAY_RE.test(name)) migrationFiles.push(p)
      if (!explicitConfig && CONFIG_NAMES.test(name)) configFiles.push(p)
    })
  }
}

// ── skip: 마이그레이션 없음 (무관 스택) ────────────────────
if (migrationFiles.length === 0) {
  console.log('• 마이그레이션 안전성 게이트: Flyway류 마이그레이션 파일 없음 — 통과(skip)')
  process.exit(0)
}

// ── 버전 파싱 + 대역(out-of-order) 판정 ────────────────────
const versions = []
for (const f of migrationFiles) {
  const m = basename(f).match(/^V(\d+)/i)
  if (m) versions.push(Number(m[1]))
}
const sorted = [...new Set(versions)].sort((a, b) => a - b)

// 타임스탬프 버전(8자리 이상, 예: 20240101…)은 접두사 대역 규약이 아님 → 검사 A 비대상
const TIMESTAMP_MIN = 1e7
const isTimestamp = sorted.length > 0 && Math.max(...sorted) >= TIMESTAMP_MIN

// 대역 판정: 정렬된 버전 사이에 예약 점프(큰 갭)가 1개 이상 있으면 접두사 대역.
// 단조 증가(…,3,4,5,…)는 큰 갭이 없어 단일 대역 → 안전.
const GAP_THRESHOLD = 100
let bandBoundaries = 0
for (let i = 1; i < sorted.length; i++) {
  if (sorted[i] - sorted[i - 1] >= GAP_THRESHOLD) bandBoundaries++
}
const bands = 1 + bandBoundaries
const isBanded = !isTimestamp && bands >= 2

// ── 설정에서 out-of-order 상태 추출 ───────────────────────
// Flyway: spring `out-of-order: true` (yaml) / `flyway.outOfOrder=true` (conf)
const OOO_RE = /out[-_]?of[-_]?order\s*[:=]\s*["']?(true|false)/gi
let oooState = 'absent' // 'true' | 'false' | 'absent'
for (const cf of configFiles) {
  let text
  try { text = readFileSync(cf, 'utf8') } catch { continue }
  let m
  OOO_RE.lastIndex = 0
  while ((m = OOO_RE.exec(text)) !== null) {
    const v = m[1].toLowerCase()
    if (v === 'true') { oooState = 'true'; break }
    if (v === 'false') oooState = 'false'
  }
  if (oooState === 'true') break
}

// ── 판정 ──────────────────────────────────────────────────
const summary = `대상 ${migrationFiles.length}개 · 대역 ${bands}개${isTimestamp ? ' · 타임스탬프 버전' : ''} · out-of-order=${oooState}`

// 단조 증가 → 안전 (out-of-order:false여도 정상)
if (!isBanded) {
  console.log(`✓ 마이그레이션 안전성 게이트 통과 — ${summary}`)
  console.log(isTimestamp
    ? '  타임스탬프 버전이라 접두사 대역 규약 비대상.'
    : '  단조 증가 번호 — 구조적 out-of-order 위험 없음.')
  process.exit(0)
}

// 대역인데 설정 파일을 못 찾음 → skip (오탐 금지)
if (configFiles.length === 0) {
  console.log(`• 마이그레이션 안전성 게이트: 접두사 대역(${bands}개) 감지됐으나 설정 파일 미발견 — 통과(skip)`)
  console.log('  ⚠ out-of-order: true 가 설정돼 있는지 수동 확인하세요 (application*.yml / flyway.conf).')
  process.exit(0)
}

// 대역 + out-of-order 허용 → 통과
if (oooState === 'true') {
  console.log(`✓ 마이그레이션 안전성 게이트 통과 — ${summary}`)
  console.log('  접두사 대역 + out-of-order: true — 기존·운영 DB 증분 적용 안전.')
  process.exit(0)
}

// 대역 + (out-of-order 없음 | false) → FAIL
const why = oooState === 'false'
  ? '검사 B: out-of-order: false 가 명시돼 있습니다'
  : '검사 A: out-of-order 설정이 없습니다'
console.error(`\n✖ 마이그레이션 안전성 게이트 실패 — ${summary}`)
console.error(`  ${why}.`)
console.error(`  접두사 번호 대역(${bands}개 대역)은 새 저접두사 마이그레이션이 이미 적용된 고접두사보다`)
console.error('  버전이 낮은 "구조적 out-of-order"를 만듭니다. 허용이 꺼져 있으면 기존·운영 DB가')
console.error('  validate 실패로 기동 불가합니다 (CI는 빈 DB라 통과 — 운영에서만 터집니다).')
console.error('\n  해결:')
console.error('    • Spring(yaml):  spring.flyway.out-of-order: true')
console.error('    • flyway.conf:   flyway.outOfOrder=true')
console.error('  또는 모든 모듈을 단일 단조 증가 번호 체계로 통일하세요.')
console.error('  단일 출처: docs/db-standards.md · templates/rules/stacks/flyway.md\n')
process.exit(1)

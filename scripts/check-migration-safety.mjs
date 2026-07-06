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
 * ⚠ 적용 범위 — 이 정적 게이트는 **Flyway 전용**이다 (버전 파일 명명 `V###__….sql`만 검출).
 *   - Prisma/Supabase: 타임스탬프 명명(`20240101…`)이라 구조적으로 단조 증가 → out-of-order 위험 없음(안전).
 *   - Alembic: down_revision 체인이 분기하면 **다중 head(분기 미머지)**가 위험인데, 이는 파일명이 아니라
 *     리비전 그래프 문제라 이 스크립트가 검출하지 못한다 — Alembic 스택은 별도 CI 점검(`alembic heads | wc -l`)
 *     으로 다중 head를 차단한다(templates/rules/stacks/alembic.md). 여기서 Flyway가 아니면 정직하게 skip한다.
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
  2  사용법 오류 — --migrations 와 --config 는 함께 지정해야 함(한쪽만 주면 무관 대상 오판)

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

// S2: --migrations 와 --config 는 짝이다. 한쪽만 명시하면 나머지를 cwd에서 긁어
// 무관한 마이그레이션/설정을 대상으로 오판(false-pass/false-fail)할 수 있으므로 fail-fast.
// 둘 다 명시하거나(정밀 모드), 둘 다 생략하고 [루트경로]로 탐색(발견 모드)해야 한다.
if (Boolean(explicitMigrations) !== Boolean(explicitConfig)) {
  console.error('✖ --migrations 와 --config 는 함께 지정해야 합니다.')
  console.error('  한쪽만 주면 나머지를 현재 디렉터리에서 탐색해 무관 대상을 오판합니다.')
  console.error('  → 둘 다 명시하거나, 둘 다 생략하고 [루트경로]로 탐색하세요.')
  process.exit(2)
}

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

if (explicitMigrations && explicitConfig) {
  // 정밀 모드: 둘 다 명시 — 지정된 경로만 검사(무관 대상 오판 없음).
  walk(explicitMigrations, (p, name) => { if (FLYWAY_RE.test(name)) migrationFiles.push(p) })
  if (existsSync(explicitConfig)) configFiles.push(explicitConfig)
} else {
  // 발견 모드: 둘 다 생략 — [루트경로](기본 cwd)에서 마이그레이션·설정을 함께 탐색.
  for (const root of roots) {
    walk(root, (p, name) => {
      if (FLYWAY_RE.test(name)) migrationFiles.push(p)
      if (CONFIG_NAMES.test(name)) configFiles.push(p)
    })
  }
}

// ── skip: 마이그레이션 없음 (무관 스택) ────────────────────
// 이 게이트는 Flyway 전용이다 — Prisma/Supabase(타임스탬프 명명=단조 안전), Alembic(다중 head는
// 파일명이 아닌 리비전 그래프 문제라 별도 CI 점검)은 여기서 검출 대상이 아니다.
if (migrationFiles.length === 0) {
  console.log('• 마이그레이션 안전성 게이트: Flyway류 버전 파일(V###__…​.sql) 없음 — 통과(skip, 이 게이트는 Flyway 전용)')
  console.log('  Prisma/Supabase=타임스탬프 명명이라 구조적 단조(안전) · Alembic=다중 head는 alembic.md의 별도 CI 점검 소관.')
  process.exit(0)
}

// ── 버전 파싱 + 대역(out-of-order) 판정 ────────────────────
const versions = []
for (const f of migrationFiles) {
  const m = basename(f).match(/^V(\d+)/i)
  if (m) versions.push(Number(m[1]))
}
const sorted = [...new Set(versions)].sort((a, b) => a - b)

// 타임스탬프 버전(8자리 이상, 예: 20240101…)은 접두사 대역 규약이 아님 → 검사 A 비대상.
// B2: **모든** 버전이 임계 이상일 때만 순수 타임스탬프로 본다(Math.min). 접두사 대역(1xxx..4xxx)에
// 타임스탬프 하나만 섞이면(min<임계) 대역 검사를 계속 켜야 함 — Math.max면 하나로 검사 전체가 꺼져 false-pass.
const TIMESTAMP_MIN = 1e7
const isTimestamp = sorted.length > 0 && Math.min(...sorted) >= TIMESTAMP_MIN

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
// S1: out-of-order 크레딧은 **운영에 적용되는** 설정에서만 인정한다. test/dev/ci 등 비운영
// 프로파일(application-test.yml 등)에만 true가 있고 운영 설정엔 없으면 운영 DB는 여전히
// 기동 실패하므로, 그 프로파일의 true를 신뢰하면 안전게이트가 false-pass 한다.
const NONPROD_PROFILE_RE = /application-(test|dev|ci|local|it|e2e|integration)\b/i
const prodConfigFiles = configFiles.filter((cf) => !NONPROD_PROFILE_RE.test(basename(cf)))
const OOO_RE = /out[-_]?of[-_]?order\s*[:=]\s*["']?(true|false)/gi
// S1b(#182): 단일 application.yml 안에 `---`로 구분된 다중 프로파일 문서에서, 비운영(test/dev/ci) 문서의
//   out-of-order:true 가 운영 문서의 false/미설정을 덮어 게이트를 false-pass 시키던 것 차단. 파일명(basename)
//   필터만으로는 프로파일 문서가 단일 파일에 합쳐진 경우를 못 걸러 — 문서 단위로 on-profile을 보고 비운영 문서를
//   OOO 크레딧에서 제외한다(운영·프로파일無 문서만 신뢰). .properties/.conf 등 `---` 없는 파일은 단일 문서로 처리(무변경).
const NONPROD_TOKEN_RE = /\b(test|dev|ci|local|it|e2e|integration)\b/i
const ON_PROFILE_RE = /(?:on-profile|spring\.profiles(?:\.active|\.include)?)\s*[:=]\s*(.+)/i
// 문서의 on-profile 값이 '운영에 적용되는가'를 의미론적으로 판정(#197). out-of-order 크레딧은 운영 적용 문서에서만 인정.
//   - `!prod`/`!production`(부정): 운영 제외 → 적용 안 됨(false). (#2 false-pass 차단)
//   - `prod`/`production` 토큰 포함(예: `test | prod`): 운영 적용됨(true). (#7 false-FAIL 차단)
//   - 비운영 토큰(test/dev/…)만: 적용 안 됨(false).
//   - 인식 가능한 프로파일 없음(default 문서): 운영 적용(true).
const isProdApplicable = (val) => {
  const v = (val || '').toLowerCase()
  if (/![\s"']*prod(uction)?\b/.test(v)) return false
  if (/\bprod(uction)?\b/.test(v)) return true
  if (NONPROD_TOKEN_RE.test(v)) return false
  return true
}
let oooState = 'absent' // 'true' | 'false' | 'absent'
// B3: 라인 단위로 읽고 주석(`#` 이후)을 제거한 뒤 스캔 — 주석 처리된 `# out-of-order: true`가
// 실제 false를 덮어 게이트를 false-pass 시키던 것 차단(yaml/conf/toml/ini 공통 주석문자 #).
outer:
for (const cf of prodConfigFiles) {
  let text
  try { text = readFileSync(cf, 'utf8') } catch { continue }
  for (const doc of text.split(/^\s*---\s*$/m)) {
    const lines = doc.split(/\r?\n/).map((l) => l.replace(/#.*$/, '')) // 라인 내 주석 제거
    // 이 문서가 비운영 프로파일 전용이면(on-profile: test 등) OOO 크레딧 대상에서 제외.
    const profileLine = lines.find((l) => ON_PROFILE_RE.test(l))
    if (profileLine && !isProdApplicable(profileLine.match(ON_PROFILE_RE)[1])) continue
    for (const line of lines) {
      let m
      OOO_RE.lastIndex = 0
      while ((m = OOO_RE.exec(line)) !== null) {
        const v = m[1].toLowerCase()
        if (v === 'true') { oooState = 'true'; break }
        if (v === 'false') oooState = 'false'
      }
      if (oooState === 'true') break outer
    }
  }
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

// 대역인데 운영 설정 파일을 못 찾음(비운영 프로파일만 존재하는 경우 포함) → skip (오탐 금지)
if (prodConfigFiles.length === 0) {
  console.log(`• 마이그레이션 안전성 게이트: 접두사 대역(${bands}개) 감지됐으나 운영 설정 파일 미발견 — 통과(skip)`)
  console.log('  ⚠ out-of-order: true 가 운영 설정(application.yml/application-prod.yml/flyway.conf)에 있는지 수동 확인하세요.')
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

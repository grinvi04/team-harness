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
import { join, basename, dirname, sep } from 'node:path'

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

// 타임스탬프 버전(예: 20240101…)은 접두사 대역 규약이 아님 → 검사 A 비대상.
// #219-3: 자릿수(과거 TIMESTAMP_MIN=1e7)가 아니라 **실제 날짜형식**으로 판정한다 — V10000001(월=00) 같은
//   8자리 모듈 접두사 대역이 자릿수만으로 타임스탬프로 오판돼 대역검사가 꺼지던 false-pass 차단.
//   8자리=yyyymmdd(월 1-12·일 1-31), 14자리=yyyymmddHHMMSS. 그 외 자릿수·범위밖은 날짜 아님.
// B2 유지: **모든** 버전이 유효 날짜일 때만 순수 타임스탬프(every). 대역에 타임스탬프 하나만 섞여도(비-날짜 존재)
//   대역 검사를 계속 켠다 — 하나로 검사 전체가 꺼지는 false-pass 방지.
function isValidDate(n) {
  const s = String(n)
  if (s.length !== 8 && s.length !== 14) return false
  const mo = +s.slice(4, 6), d = +s.slice(6, 8)
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false
  if (s.length === 14) {
    const h = +s.slice(8, 10), mi = +s.slice(10, 12), se = +s.slice(12, 14)
    if (h > 23 || mi > 59 || se > 59) return false
  }
  return true
}

// 대역 판정: 정렬된 버전 사이에 예약 점프(큰 갭)가 1개 이상 있으면 접두사 대역.
// 단조 증가(…,3,4,5,…)는 큰 갭이 없어 단일 대역 → 안전.
const GAP_THRESHOLD = 100

// #219-1: 대역/out-of-order 판정을 **모듈(=가장 가까운 설정 디렉터리) 단위**로 하기 위해 순수 함수로 분리.
// analyzeBand: 한 그룹의 버전 목록 → {bands, isBanded, isTimestamp} (기존 로직 그대로, 대상만 그룹으로 축소).
function analyzeBand(versions) {
  const sorted = [...new Set(versions)].sort((a, b) => a - b)
  const isTimestamp = sorted.length > 0 && sorted.every(isValidDate)
  let bandBoundaries = 0
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] >= GAP_THRESHOLD) bandBoundaries++
  }
  const bands = 1 + bandBoundaries
  const isBanded = !isTimestamp && bands >= 2
  return { bands, isBanded, isTimestamp }
}

// ── 설정에서 out-of-order 상태 추출 ───────────────────────
// Flyway: spring `out-of-order: true` (yaml) / `flyway.outOfOrder=true` (conf)
// S1: out-of-order 크레딧은 **운영에 적용되는** 설정에서만 인정한다. 비운영 프로파일 파일(application-test.yml 등)에만
// true가 있고 운영 설정엔 없으면 운영 DB는 기동 실패하므로 그 true를 신뢰하면 false-pass 한다.
//   **safe-default(#227)**: 하드코딩 nonprod 토큰 리스트는 본질적으로 불완전(staging/uat/qa/sandbox/… 누락 시 false-pass).
//   그래서 `application-<profile>.<ext>`는 profile이 **prod/production일 때만** 운영 파일로 보고, 그 외 명명된 프로파일은
//   비운영으로 제외한다(리스트 무관 — 임의 프로파일명 자동 처리). `application.<ext>`(프로파일無)·비-application 설정
//   (flyway.conf 등)은 운영으로 취급. isProdApplicable(in-document)의 safe-default와 동일 원리.
const NONPROD_PROFILE_FILE_RE = /^application-(?!prod(uction)?\b)[^.]+\.(ya?ml|properties|conf)$/i
const OOO_RE = /out[-_]?of[-_]?order\s*[:=]\s*["']?(true|false)/gi
// S1b(#182): 단일 application.yml 안에 `---`로 구분된 다중 프로파일 문서에서, 비운영(test/dev/ci) 문서의
//   out-of-order:true 가 운영 문서의 false/미설정을 덮어 게이트를 false-pass 시키던 것 차단. 파일명(basename)
//   필터만으로는 프로파일 문서가 단일 파일에 합쳐진 경우를 못 걸러 — 문서 단위로 on-profile을 보고 비운영 문서를
//   OOO 크레딧에서 제외한다(운영·프로파일無 문서만 신뢰). .properties/.conf 등 `---` 없는 파일은 단일 문서로 처리(무변경).
const ON_PROFILE_RE = /(?:on-profile|spring\.profiles(?:\.active|\.include)?)\s*[:=]\s*(.+)/i
// on-profile을 가진 문서가 '운영에 적용되는가'를 의미론적으로 판정. out-of-order 크레딧은 운영 적용 문서에서만 인정.
//   **safe-default**: 하드코딩 비운영 토큰 리스트는 본질적으로 불완전(staging/uat/qa/sandbox/… 누락 시 false-pass, #214).
//   그래서 '명시 on-profile을 가진 문서'는 **운영에 적용된다는 확실한 신호가 있을 때만** 크레딧한다:
//     - `!prod`/`!production`(운영 제외 부정) → 미적용(false)
//     - `prod`/`production` 토큰 포함(예: `test | prod`, `production-eu`) → 적용(true)
//     - 표현식의 **모든 항이 부정(!X)**이면(예: `!test`, `!dev & !test`) prod가 배제되지 않아 적용(true)
//     - **양의(비운영) 항이 하나라도** 있으면(예: `staging`, `staging & !test`, `qa,!smoke`) 그 항이 문서를
//       비운영으로 스코프하므로 **미적용(false)** ← 리스트 무관, 복합식(`&`/`|`/`,`)도 정확, 안전측
//   (프로파일 라인이 아예 없는 default 문서는 호출측이 isProdApplicable을 부르지 않고 그대로 스캔한다.)
const isProdApplicable = (val) => {
  const v = (val || '').toLowerCase()
  // 괄호 그룹(예: `!(prod | staging)`)은 정규식+split로 안전 파싱 불가 — bare `prod` 토큰이 부정 안에 있어도
  //   양의 prod로 오인해 위험한 false-pass가 난다. 안전측으로 **미적용(false)** 처리해 OOO 크레딧을 거부한다.
  //   (드문 over-block(`!(test)`류 = 실제 운영적용인데 FAIL)을 감수하고 위험한 false-pass를 막는다 — 비가역>가역.
  //    진짜 완전한 해법은 boolean 표현식 파서 #220-A. 이건 부분 교정이며 '전 클래스를 닫았다'고 주장하지 않는다.)
  if (/[()]/.test(v)) return false
  if (/![\s"']*prod(uction)?\b/.test(v)) return false   // !prod/!production → 운영 제외 → 미적용
  if (/\bprod(uction)?\b/.test(v)) return true           // 양의 prod/production 토큰 포함(예: test|prod) → 적용
  // 항 단위로 분해 — 모든 항이 부정(!X)이면 적용(부정은 배제만), 양의 비운영 항이 있으면 미적용.
  const terms = v.replace(/["']/g, ' ').split(/[\s&|,]+/).filter(Boolean)
  if (terms.length && terms.every((t) => t.startsWith('!'))) return true
  return false                                           // 양의 비운영 항 존재 or 미인식 → 미적용(safe-default)
}

// #219-1: scanOoo — 한 그룹의 설정 파일 목록에서 out-of-order 상태를 추출. 기존 전역 스캔 로직을
// 그대로 그룹 단위 함수로 이동(비운영 파일명 필터 → 문서 분리 → on-profile 판정 → 주석 제거 → OOO_RE 스캔).
function scanOoo(groupConfigFiles) {
  const prodConfigFiles = groupConfigFiles.filter((cf) => !NONPROD_PROFILE_FILE_RE.test(basename(cf)))
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
  return oooState
}

// #219-2: 선택적 scheme 선언 — 지배 config의 주석 `# migration-safety: scheme=<x>`을 raw 스캔(주석제거 전).
//   촘촘 밴드(갭<GAP_THRESHOLD)는 휴리스틱으로 단조와 구분 불가라, 선언이 있으면 그것을 신뢰한다(없으면 휴리스틱=하위호환).
//   prefix-band→강제 대역 · monotonic→강제 비대역 · timestamp→타임스탬프 취급 · 미인식→무시+경고(휴리스틱 폴백).
const SCHEME_RE = /migration-safety:\s*scheme\s*=\s*([a-z][a-z-]*)/i
const VALID_SCHEMES = new Set(['prefix-band', 'monotonic', 'timestamp'])
function readScheme(groupConfigFiles) {
  for (const cf of groupConfigFiles) {
    let text
    try { text = readFileSync(cf, 'utf8') } catch { continue }
    const m = text.match(SCHEME_RE)
    if (!m) continue
    const s = m[1].toLowerCase()
    if (VALID_SCHEMES.has(s)) return s
    console.error(`⚠ migration-safety: 미인식 scheme='${m[1]}' (${basename(cf)}) — 무시하고 휴리스틱으로 판정. 유효값: prefix-band|monotonic|timestamp`)
    return null   // 선언은 됐으나 미인식 → 휴리스틱 폴백(AC-8)
  }
  return null
}

// ── 그룹핑: nearest-config 파티션(#219-1) ──────────────────
// 발견 모드: 마이그레이션 파일마다 "가장 가까운(=deepest) 조상 설정 디렉터리"를 찾아 그 디렉터리가
//   관장하는 그룹으로 묶는다. 같은 디렉터리의 설정 파일 전부가 그 그룹의 설정. 조상 설정 디렉터리가
//   없는 마이그레이션은 하나의 "미연결" 그룹(설정 없음)으로 모아 무관 모듈 간 크레딧 교차를 막는다.
// 정밀 모드(--migrations/--config 둘 다 명시): 단일 그룹(발견된 전체 마이그레이션 + 지정 설정 하나).
const groups = []
if (explicitMigrations && explicitConfig) {
  groups.push({ dir: null, migrations: migrationFiles, configs: existsSync(explicitConfig) ? [explicitConfig] : [] })
} else {
  const configDirs = [...new Set(configFiles.map(dirname))]
  const UNASSOCIATED = Symbol('unassociated')
  const byKey = new Map() // governing dir(문자열) 또는 UNASSOCIATED → group
  for (const mf of migrationFiles) {
    let governingDir = null
    for (const dir of configDirs) {
      if (mf.startsWith(dir + sep) && (governingDir === null || dir.length > governingDir.length)) {
        governingDir = dir
      }
    }
    const key = governingDir === null ? UNASSOCIATED : governingDir
    if (!byKey.has(key)) byKey.set(key, { dir: governingDir, migrations: [], configs: [] })
    byKey.get(key).migrations.push(mf)
  }
  for (const cf of configFiles) {
    const d = dirname(cf)
    if (byKey.has(d)) byKey.get(d).configs.push(cf)
  }
  groups.push(...byKey.values())
}

// ── 판정(그룹별 집계) ───────────────────────────────────────
const failures = []
for (const g of groups) {
  const versions = []
  for (const f of g.migrations) {
    const m = basename(f).match(/^V(\d+)/i)
    if (m) versions.push(Number(m[1]))
  }
  const analysis = analyzeBand(versions)
  const bands = analysis.bands
  let { isBanded, isTimestamp } = analysis
  // #219-2: 선언 override(휴리스틱보다 우선). 없으면 휴리스틱 그대로(하위호환).
  const scheme = readScheme(g.configs)
  if (scheme === 'prefix-band') isBanded = true
  else if (scheme === 'monotonic') isBanded = false
  else if (scheme === 'timestamp') { isTimestamp = true; isBanded = false }
  const label = g.dir ? ` [${g.dir}]` : ''
  const schemeNote = scheme ? ` · scheme=${scheme}(선언)` : ''

  // 단조 증가 → 안전 (out-of-order:false여도 정상)
  if (!isBanded) {
    console.log(`✓ 마이그레이션 안전성 게이트 통과${label} — 대상 ${g.migrations.length}개 · 대역 ${bands}개${isTimestamp ? ' · 타임스탬프 버전' : ''}${schemeNote}`)
    console.log(isTimestamp
      ? '  타임스탬프 버전이라 접두사 대역 규약 비대상.'
      : '  단조 증가 번호 — 구조적 out-of-order 위험 없음.')
    continue
  }

  // 대역인데 운영 설정 파일을 못 찾음(비운영 프로파일만 존재하는 경우 포함) → 이 그룹만 skip (오탐 금지)
  const prodConfigFiles = g.configs.filter((cf) => !NONPROD_PROFILE_FILE_RE.test(basename(cf)))
  if (prodConfigFiles.length === 0) {
    console.log(`• 마이그레이션 안전성 게이트${label}: 접두사 대역(${bands}개) 감지됐으나 운영 설정 파일 미발견 — 통과(skip)`)
    console.log('  ⚠ out-of-order: true 가 운영 설정(application.yml/application-prod.yml/flyway.conf)에 있는지 수동 확인하세요.')
    continue
  }

  const oooState = scanOoo(g.configs)
  const summary = `대상 ${g.migrations.length}개 · 대역 ${bands}개${schemeNote} · out-of-order=${oooState}`

  // 대역 + out-of-order 허용 → 통과
  if (oooState === 'true') {
    console.log(`✓ 마이그레이션 안전성 게이트 통과${label} — ${summary}`)
    console.log('  접두사 대역 + out-of-order: true — 기존·운영 DB 증분 적용 안전.')
    continue
  }

  // 대역 + (out-of-order 없음 | false) → 이 그룹 FAIL
  failures.push({ label, bands, oooState, summary })
}

if (failures.length > 0) {
  for (const { label, bands, oooState, summary } of failures) {
    const why = oooState === 'false'
      ? '검사 B: out-of-order: false 가 명시돼 있습니다'
      : '검사 A: out-of-order 설정이 없습니다'
    console.error(`\n✖ 마이그레이션 안전성 게이트 실패${label} — ${summary}`)
    console.error(`  ${why}.`)
    console.error(`  접두사 번호 대역(${bands}개 대역)은 새 저접두사 마이그레이션이 이미 적용된 고접두사보다`)
    console.error('  버전이 낮은 "구조적 out-of-order"를 만듭니다. 허용이 꺼져 있으면 기존·운영 DB가')
    console.error('  validate 실패로 기동 불가합니다 (CI는 빈 DB라 통과 — 운영에서만 터집니다).')
    console.error('\n  해결:')
    console.error('    • Spring(yaml):  spring.flyway.out-of-order: true')
    console.error('    • flyway.conf:   flyway.outOfOrder=true')
    console.error('  또는 모든 모듈을 단일 단조 증가 번호 체계로 통일하세요.')
  }
  console.error('  단일 출처: docs/db-standards.md · templates/rules/stacks/flyway.md\n')
  process.exit(1)
}

process.exit(0)

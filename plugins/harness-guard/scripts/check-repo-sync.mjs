#!/usr/bin/env node
/*
 * 기존 repo ↔ 표준(team-harness) 드리프트 점검 — 신규 셋업(new-repo.sh)의 대칭 도구.
 *
 * 배경: templates/는 "신규 repo 셋업"에만 적용되고 기존 repo에 자동 전파되지 않는다
 * (harness-maintenance.md). 그래서 기존 repo는 표준 게이트가 빠진 채로 드리프트가 쌓인다
 * (예: test-guard 게이트 누락). new-repo.sh가 신규를 채운다면, 이 도구는 기존이 표준과
 * sync 됐는지 점검해 그 공백을 메운다.
 *
 * 설계 원칙 — 오탐 회피가 핵심:
 *   - repo 스택을 파일 신호로 감지하고, 그 스택에 해당하는 자산만 검사한다(무관 스택은 스킵).
 *   - 스택별로 의도적 커스터마이즈되는 자산(ci-gate 본문)은 내용을 diff하지 않고 "존재"만 본다.
 *   - 스택 무관 게이트(test-guard·commitlint·secret-scan)는 파일명이 자유라 "내용 sentinel"로
 *     매칭한다(완전일치 강요 X). sentinel이 있으면 OK, 비슷한 파일은 있으나 sentinel이 없으면 WEAK.
 *   - 룰 문서는 "존재"만 본다(내용 stale은 경고 수준 — 본 도구는 content를 강제하지 않는다).
 *
 * 종료 코드:
 *   0  표준과 sync (또는 WEAK/룰 경고만 — 머지를 막지 않는 약한 신호)
 *   1  필수 자산 MISSING — 드리프트(머지 차단 수준)
 *
 * 단일 출처: docs/harness-maintenance.md · scripts/new-repo.sh(신규=대칭)
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── 인자 파싱 ─────────────────────────────────────────────
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`기존 repo ↔ 표준(team-harness) 드리프트 점검 — new-repo.sh(신규)의 대칭 도구

사용법:
  node scripts/check-repo-sync.mjs [--repo <경로>] [--harness <team-harness 경로>]

옵션:
  --repo <경로>      점검할 대상 repo 루트 (기본: 현재 디렉터리)
  --harness <경로>   표준 출처 team-harness 루트 (기본: 이 스크립트의 repo 루트)
  --help, -h         이 도움말

동작:
  1) 대상 repo의 파일 신호로 스택 감지 (java/flyway/typescript/nestjs/nextjs/vue/vite/python/prisma/alembic/supabase)
  2) 감지된 스택에 해당하는 표준 harness 자산(게이트·룰)이 sync 됐는지 점검
  3) 자산별 OK / WEAK / MISSING / WARN 표 + 요약 출력

판정:
  OK       자산 존재 (+ 필요 시 핵심 sentinel 포함)
  WEAK     비슷한 자산은 있으나 핵심 sentinel 없음 — 경고(exit 0)
  WARN     룰 문서 없음 등 약한 신호 — 경고(exit 0)
  MISSING  필수 게이트/자산 없음 — 드리프트(exit 1)

종료 코드:
  0  sync (또는 WEAK/WARN만)
  1  필수 자산 MISSING
`)
  process.exit(0)
}

function optVal(name) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : null
}
const REPO = resolve(optVal('--repo') || '.')
// 기본 harness = team-harness repo 루트.
// 이 스크립트는 plugins/harness-guard/scripts/ 에 있으므로 세 단계 위가 루트다.
// (플러그인으로 설치돼 templates/ 가 없으면 standardHas=false 로 graceful — detail 힌트만 생략.)
const HARNESS = optVal('--harness') || join(__dirname, '../../..')

if (!existsSync(REPO)) {
  console.error(`✖ --repo 경로가 없습니다: ${REPO}`)
  process.exit(1)
}

// ── 파일 탐색 ─────────────────────────────────────────────
const IGNORE = new Set(['node_modules', '.git', 'build', 'target', '.gradle', 'dist', '.next', 'out', 'vendor', '.venv', '__pycache__', '.team-harness'])

function walk(dir, onEntry, depth = 0) {
  if (depth > 12 || !existsSync(dir)) return
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    if (IGNORE.has(name)) continue
    const p = join(dir, name)
    let s
    try { s = statSync(p) } catch { continue }
    if (s.isDirectory()) { onEntry(p, name, true); walk(p, onEntry, depth + 1) }
    else onEntry(p, name, false)
  }
}

// 신호 수집 (한 번 순회)
const files = []          // 모든 파일 경로
const dirsRel = []        // 디렉터리 상대경로 (슬래시 정규화)
const packageJsons = []   // package.json 경로
let hasFlywayDir = false
let hasFlywayVersionFile = false
const FLYWAY_RE = /^V\d+.*__.*\.sql$/i

walk(REPO, (p, name, isDir) => {
  const rel = p.slice(REPO.length).replace(/\\/g, '/').replace(/^\/+/, '')
  if (isDir) {
    dirsRel.push(rel)
    if (/(^|\/)db\/migration$/.test(rel)) hasFlywayDir = true
  } else {
    files.push({ p, name, rel })
    if (name === 'package.json') packageJsons.push(p)
    if (FLYWAY_RE.test(name)) hasFlywayVersionFile = true
  }
})

const hasFile = (re) => files.some((f) => re.test(f.name))
const hasDir = (re) => dirsRel.some((d) => re.test(d))

// ── 스택 감지 ─────────────────────────────────────────────
const hasGradle = hasFile(/^build\.gradle(\.kts)?$/)
const hasFlyway = hasFlywayDir || hasFlywayVersionFile
const hasPackageJson = packageJsons.length > 0
const hasVite = hasFile(/^vite\.config\.[cm]?[jt]s$/)
const hasPython = hasFile(/^pyproject\.toml$/) || hasFile(/^requirements.*\.txt$/)
const hasPrisma = hasDir(/(^|\/)prisma$/) || hasFile(/^schema\.prisma$/)
const hasAlembic = hasFile(/^alembic\.ini$/) || hasDir(/(^|\/)alembic$/)
const hasSupabase = hasDir(/(^|\/)supabase$/)

// 의존성 신호: nestjs=@nestjs/*, nextjs=next, vue=vue (한 번 순회로 세 스택 동시 감지)
let isNest = false, isNext = false, isVue = false
for (const pj of packageJsons) {
  try {
    const j = JSON.parse(readFileSync(pj, 'utf8'))
    const deps = { ...(j.dependencies || {}), ...(j.devDependencies || {}) }
    if (Object.keys(deps).some((d) => d.startsWith('@nestjs/'))) isNest = true
    if ('next' in deps) isNext = true
    if ('vue' in deps) isVue = true
  } catch { /* ignore */ }
}
// 파일 신호 병용 — next.config.* / vue.config.* / *.vue (의존성 없이도 감지)
const hasNext = isNext || hasFile(/^next\.config\.[cm]?[jt]s$/)
const hasVue = isVue || hasFile(/^vue\.config\.[cm]?[jt]s$/) || hasFile(/\.vue$/)

// typescript 룰 대상 = node 계열(package.json 또는 vite)
const hasTypescript = hasPackageJson || hasVite

const stacks = {
  java: hasGradle,
  flyway: hasFlyway,
  typescript: hasTypescript,
  nestjs: isNest,
  nextjs: hasNext,
  vue: hasVue,
  vite: hasVite,
  python: hasPython,
  prisma: hasPrisma,
  alembic: hasAlembic,
  supabase: hasSupabase,
}
const detected = Object.entries(stacks).filter(([, v]) => v).map(([k]) => k)

// ── 워크플로 내용 수집 (sentinel 매칭용) ──────────────────
const wfFiles = files.filter((f) => /(^|\/)\.github\/workflows\/.+\.ya?ml$/.test(f.rel))
// sentinel 매칭 전 YAML 주석 제거(#183) — 주석 처리된(비활성) 게이트가 존재 신호로 오인돼
//   드리프트가 미탐지되던 것 차단. 실제 실행 텍스트(run/echo/uses)는 유지한다: 하네스 자체 test-guard가
//   `run: echo allow-test-removal`을 정당한 신호로 쓰므로 echo를 '언급'으로 보고 제거하면 정당 신호가 깨진다.
//   echo/텍스트 기반 sentinel의 느슨함(functional 검증 아님)은 설계상 수용 — OK/WEAK 티어가 그 부정확성을 인정.
//   주석 판정: 라인 시작 `#` 또는 공백 뒤 `#`(YAML 규약) — 문자열 안 `#42` 같은 비주석은 보존.
const stripComments = (raw) => raw.split(/\r?\n/).map((l) => l.replace(/(^|\s)#.*$/, '$1')).join('\n')
const wfList = wfFiles.map((f) => {
  let text = ''
  try { text = stripComments(readFileSync(f.p, 'utf8')) } catch { /* ignore */ }
  return { name: f.name, rel: f.rel, text }
})
const wfText = wfList.map((w) => w.text).join('\n')

// sentinel 기반 게이트 판정: 내용에 sentinel 있으면 OK,
// 파일명이 게이트를 닮았으나 sentinel 없으면 WEAK, 둘 다 아니면 MISSING.
function sentinelStatus(sentinelRe, filenameHintRe) {
  if (sentinelRe.test(wfText)) return 'OK'
  if (filenameHintRe && wfList.some((w) => filenameHintRe.test(w.name))) return 'WEAK'
  return 'MISSING'
}

// 루트(또는 얕은 경로) 파일 존재 검사
function existsAnywhere(re) {
  return files.some((f) => re.test(f.name))
}

// 룰 문서 존재 — .claude/rules/<name>.md 또는 .claude/rules/stacks/<name>.md
function ruleExists(name) {
  return (
    existsSync(join(REPO, '.claude/rules', `${name}.md`)) ||
    existsSync(join(REPO, '.claude/rules/stacks', `${name}.md`))
  )
}

// ── 매니페스트(스택별 필수 harness 자산) ──────────────────
// severity: 'error' → MISSING 시 exit 1 / 'warn' → 없어도 exit 0(약한 신호)
const checks = []

// 전 스택 공통 게이트
checks.push({
  asset: 'ci-gate 워크플로',
  severity: 'error',
  applicable: true,
  // 본문은 스택별 커스터마이즈라 내용 diff 금지 — "주 품질 게이트가 존재하는가"만 본다.
  // 파일명은 repo마다 다르다(ci-gate.yml·ci.yml·quality.yml) → 파일명 힌트 OR
  // 내용 신호(lint계열 + test계열 스텝을 모두 가진 워크플로 = 주 품질 게이트)로 인식한다.
  status: wfList.some(
    (w) =>
      /ci-gate|^ci\.ya?ml$|quality/i.test(w.name) ||
      (/\b(lint|ruff|eslint|gradlew[^\n]*check)\b/i.test(w.text) &&
        /\b(test|pytest|jest|vitest|gradlew[^\n]*test|npm[^\n]*test)\b/i.test(w.text)),
  )
    ? 'OK'
    : 'MISSING',
  detail: '.github/workflows의 주 품질 게이트(ci-gate.yml·ci.yml 등 — lint+test 스텝 보유)',
})
checks.push({
  asset: 'test-guard 게이트',
  severity: 'error',
  applicable: true,
  status: sentinelStatus(/allow-test-removal/i, /test[-_]?guard/i),
  detail: '테스트 삭제 차단 잡 (sentinel: allow-test-removal)',
})
checks.push({
  asset: 'commitlint 게이트',
  severity: 'error',
  applicable: true,
  status: sentinelStatus(/wagoid\/commitlint|commitlint-github-action/i, /commitlint/i),
  detail: '커밋 컨벤션 잡 (sentinel: wagoid/commitlint)',
})
checks.push({
  asset: 'commitlint config',
  severity: 'error',
  applicable: true,
  status: existsAnywhere(/^(commitlint\.config\.[cm]?[jt]s|\.commitlintrc(\.\w+)?)$/) ? 'OK' : 'MISSING',
  detail: '루트 commitlint.config.cjs (또는 .commitlintrc*)',
})
checks.push({
  asset: 'secret-scan(gitleaks)',
  severity: 'error',
  applicable: true,
  status: /gitleaks/i.test(wfText) ? 'OK' : 'MISSING',
  detail: 'gitleaks 시크릿 스캔 잡 (sentinel: gitleaks)',
})

// 아키텍처 다이어그램 — 산출물(svg)이 있으면 소스(생성기)도 있어야 재생성 가능(소스-less 산출물 방지).
// applicable=산출물 보유 repo만(다이어그램 없는 repo는 스킵). severity=warn(비차단 — 다이어그램은 선택).
checks.push({
  asset: '아키텍처 다이어그램 소스',
  severity: 'warn',
  applicable: existsSync(join(REPO, 'docs/architecture.svg')),
  status: existsSync(join(REPO, 'docs/gen_arch_svg.py')) ? 'OK' : 'WARN',
  detail:
    'docs/architecture.svg가 있으면 소스 docs/gen_arch_svg.py도 커밋 (없으면 재생성 불가한 소스-less 산출물 — templates/gen_arch_svg.py에서 복사)',
})

// Flyway 스택 — 마이그레이션 안전성 게이트
checks.push({
  asset: 'migration-safety 워크플로',
  severity: 'error',
  applicable: stacks.flyway,
  status: sentinelStatus(/check-migration-safety/i, /migration[-_]?safety/i),
  detail: 'Flyway 접두사 대역 게이트 (sentinel: check-migration-safety)',
})
checks.push({
  asset: 'check-migration-safety.mjs',
  severity: 'error',
  applicable: stacks.flyway,
  status: existsAnywhere(/^check-migration-safety\.mjs$/) ? 'OK' : 'MISSING',
  detail: 'scripts/check-migration-safety.mjs (무의존 정적 검사)',
})

// Alembic 스택 — 다중 head 차단 CI 스텝
checks.push({
  asset: 'alembic heads 스텝',
  severity: 'error',
  applicable: stacks.alembic,
  status: /alembic\s+heads/i.test(wfText) ? 'OK' : 'MISSING',
  detail: 'CI에 다중 head 차단 (sentinel: alembic heads)',
})

// 룰 문서 — 스택 해당분 존재(내용 stale은 경고 수준이라 존재만 본다)
const ruleMap = [
  ['java', stacks.java],
  ['flyway', stacks.flyway],
  ['typescript', stacks.typescript],
  ['nextjs', stacks.nextjs],
  ['vue', stacks.vue],
  ['python', stacks.python],
  ['prisma', stacks.prisma],
  ['alembic', stacks.alembic],
]
for (const [rule, applicable] of ruleMap) {
  const standardHas = existsSync(join(HARNESS, 'templates/rules/stacks', `${rule}.md`))
  checks.push({
    asset: `룰: ${rule}.md`,
    severity: 'warn',
    applicable,
    status: ruleExists(rule) ? 'OK' : 'WARN',
    detail: standardHas
      ? `.claude/rules/${rule}.md (표준: templates/rules/stacks/${rule}.md)`
      : `.claude/rules/${rule}.md`,
  })
}

// ── 출력 ──────────────────────────────────────────────────
console.log(`\n기존 repo 드리프트 점검 — ${REPO}`)
console.log(`감지된 스택: ${detected.length ? detected.join(', ') : '(없음)'}\n`)

const active = checks.filter((c) => c.applicable)
const pad = Math.max(...active.map((c) => c.asset.length), 8)
console.log(`  ${'STATUS'.padEnd(8)} ${'ASSET'.padEnd(pad)}  DETAIL`)
console.log(`  ${'-'.repeat(8)} ${'-'.repeat(pad)}  ${'-'.repeat(6)}`)
for (const c of active) {
  const mark = c.status === 'OK' ? '✓' : c.status === 'MISSING' ? '✗' : c.status === 'WEAK' ? '~' : '!'
  console.log(`  ${(mark + ' ' + c.status).padEnd(8)} ${c.asset.padEnd(pad)}  ${c.detail}`)
}

const missing = active.filter((c) => c.severity === 'error' && c.status === 'MISSING')
const weak = active.filter((c) => c.status === 'WEAK')
const warn = active.filter((c) => c.status === 'WARN')

console.log('')
console.log(`요약: 대상 ${active.length}개 · OK ${active.filter((c) => c.status === 'OK').length} · WEAK ${weak.length} · WARN ${warn.length} · MISSING ${missing.length}`)

if (missing.length > 0) {
  console.error(`\n✗ 드리프트 — 필수 자산 ${missing.length}개 누락: ${missing.map((c) => c.asset).join(', ')}`)
  console.error('  표준을 반영하세요: 해당 워크플로/스크립트를 team-harness templates/에서 가져와 PR.')
  console.error('  단일 출처: docs/harness-maintenance.md (기존 repo 드리프트 점검 절)\n')
  process.exit(1)
}

if (weak.length > 0 || warn.length > 0) {
  console.log(`\n~ 경고만 — 필수 게이트는 모두 존재. WEAK(sentinel 없음)/WARN(룰 없음)은 수동 확인 권장.\n`)
} else {
  console.log('\n✓ 표준과 sync — 드리프트 없음.\n')
}
process.exit(0)

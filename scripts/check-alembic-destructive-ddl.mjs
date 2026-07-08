#!/usr/bin/env node
/*
 * Alembic 파괴적 DDL 정적 게이트 — Alembic .py 마이그레이션의 upgrade() 경로에 있는 비가역
 *   데이터-손실 DDL을 배포 전 결정적으로 차단한다. SQL판(check-destructive-ddl.mjs)의 .py 축 형제.
 *
 * 운영 장애 클래스: CI는 빈 DB에 마이그레이션을 처음부터 적용하므로 op.drop_table/op.drop_column이
 *   있어도 "지울 데이터가 없어" 통과한다(liveness ≠ 데이터 보존). 운영(기존 데이터)에서만 비가역 손실.
 *   alembic-heads.yml은 다중 head(분기)만 보지 파괴 DDL은 안 본다 → 이 정적 게이트가 그 갭을 메운다.
 *
 * 스캔 범위 — upgrade() 본문만(핵심):
 *   정상 autogenerate 마이그레이션은 downgrade()에 파괴 op를 **항상** 담는다(upgrade의 add_column을
 *   downgrade의 drop_column으로 되돌림). 파일 전체를 스캔하면 정상 마이그레이션 거의 100%가 오탐된다.
 *   배포 시 실행되는 것은 upgrade()(alembic upgrade head)이므로 그 경로만 본다 — SQL 게이트가 "앞으로
 *   적용되는 마이그레이션 파일"을 스캔하는 것과 동형. downgrade()·헬퍼는 비대상(계층0 소관).
 *
 * 정책(team-harness): 체크 가능한 규칙은 prose가 아니라 결정적 게이트로. 단, Python도 정규언어가 아니므로
 *   **흔한 데이터-손실 형태만** 잡는다(종단 우회는 계층0 코드리뷰 소관 — decisions.md 판정 철학).
 *   - 파괴 판정: op.drop_table() · op.drop_column() · op.execute(내 DROP TABLE/DATABASE/SCHEMA·TRUNCATE·DROP COLUMN)
 *   - 비대상(오탐 금지): op.drop_index/op.drop_constraint(데이터-행 손실 아님) — SQL판 DROP INDEX/CONSTRAINT와 동형.
 *   - forward-only 2단계 배포(db-standards.md §마이그레이션)의 정당한 DROP은 **승인마커**로 통과:
 *       파괴 op와 같은 논리 문장의 실제 `#` 주석 `# migration-safety: destructive-ok`.
 *
 * 반증(anti-spoof): 주석(#)·문자열 리터럴('..','".."','''..''',"""..""") 안의 파괴 키워드는 무시하고,
 *   승인마커도 **실제 # 주석 안**일 때만 인정한다(문자열 값 스푸핑 차단). op.execute의 raw SQL DROP 검사는
 *   **op.execute 문장의 문자열에만** 적용한다(일반 문자열·docstring 속 DROP TABLE 텍스트는 무시 — 오탐 금지).
 *   검증은 통과가 아니라 우회 실패로 확정 — tests/alembic-destructive-ddl-test.sh의 스푸핑 픽스처.
 *
 * ⚠ 적용 범위 — **Alembic 마이그레이션 .py 전용**(지문 기반, 경로 무관):
 *   `from alembic import op` + 모듈-레벨 `def upgrade(` 를 가진 .py만 대상(script_location 편차 무관, 더 견고).
 *   지문 없는 .py(앱 코드·versions 폴더 헬퍼)는 비대상(오탐 금지).
 *   - 한계(흔한 형태만): 헬퍼 함수로 숨긴 파괴 op·동적 SQL 조립·암묵적 문자열 연결(op.execute("DR" "OP"))은
 *     미검출 — 계층0 정본(SQL판 dollar-quoting 한계와 동형).
 *
 * 단일 출처: docs/db-standards.md · docs/specs/alembic-destructive-ddl.md
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Alembic 파괴적 DDL 게이트 — .py 마이그레이션 upgrade()의 비가역 데이터-손실 DDL을 배포 전 차단

사용법:
  node scripts/check-alembic-destructive-ddl.mjs [루트경로 …]

파괴 판정: op.drop_table() · op.drop_column() · op.execute(내 DROP TABLE/DATABASE/SCHEMA·TRUNCATE·DROP COLUMN)
비대상   : op.drop_index/op.drop_constraint (데이터-손실 아님) · downgrade()·헬퍼(upgrade()만 스캔)
승인마커 : 파괴 op와 같은 논리 문장의 실제 # 주석 \`# migration-safety: destructive-ok\` → 통과
스캔대상 : \`from alembic import op\` + \`def upgrade(\` 지문을 가진 .py (경로 무관, 지문 없으면 비대상)

종료 코드:
  0  통과 또는 skip(Alembic 마이그레이션 없음 — 오탐 금지)
  1  FAIL — 승인마커 없는 파괴 DDL 발견
  2  사용법 오류 — 미인식 옵션
`)
  process.exit(0)
}

// 미인식 옵션 → 사용법 오류(SQL판 S2 규약과 일치)
const badFlag = args.find((a) => a.startsWith('-'))
if (badFlag) {
  console.error(`✖ 미인식 옵션: ${badFlag}  (--help 참조)`)
  process.exit(2)
}

const roots = args.length ? args : ['.']

// ── 파일 탐색 ─────────────────────────────────────────────
const IGNORE = new Set(['node_modules', '.git', 'build', 'target', '.gradle', 'dist', '.next', 'out', 'vendor', '.venv'])

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

// Alembic 마이그레이션 지문: op 임포트 + 모듈-레벨 upgrade() 정의. 둘 다 있어야 대상(오탐 금지).
const HAS_OP_IMPORT = /^\s*from\s+alembic\s+import\b[^\n]*\bop\b/m
const HAS_UPGRADE = /^def\s+upgrade\s*\(/m

const pyFiles = []
for (const root of roots) {
  walk(root, (p, name) => { if (/\.py$/i.test(name)) pyFiles.push(p) })
}

const migrationFiles = []
const fileText = new Map()
for (const f of pyFiles) {
  let text
  try { text = readFileSync(f, 'utf8') } catch { continue }
  if (HAS_OP_IMPORT.test(text) && HAS_UPGRADE.test(text)) {
    migrationFiles.push(f)
    fileText.set(f, text)
  }
}

// ── skip: Alembic 마이그레이션 없음 (오탐 금지) ────────────
if (migrationFiles.length === 0) {
  console.log('• Alembic 파괴 DDL 게이트: Alembic 마이그레이션 .py 없음 — 통과(skip)')
  console.log('  대상: `from alembic import op` + `def upgrade(` 지문을 가진 .py.')
  process.exit(0)
}

// ── upgrade() 본문 추출 ────────────────────────────────────
// 모듈-레벨 `def upgrade(` 라인부터 다음 모듈-레벨(컬럼0 비공백) 라인 전까지. downgrade()·헬퍼는 제외.
function extractUpgradeBody(text) {
  const lines = text.split('\n')
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^def\s+upgrade\s*\(/.test(lines[i])) { start = i + 1; break }
  }
  if (start === -1) return null
  const body = []
  for (let i = start; i < lines.length; i++) {
    if (/^\S/.test(lines[i])) break // 컬럼0 비공백 = 모듈 레벨로 dedent → upgrade() 끝
    body.push(lines[i])
  }
  return body.join('\n')
}

// ── Python-인식 토크나이저: 논리 문장 단위 {code, comments, strings} ──────────
//   code     = # 주석·문자열 리터럴 제거본(op 호출 탐지용 — 문자열/주석 속 키워드 무시).
//   comments = 실제 # 주석 내용만(승인마커 탐지용 — 문자열 값 스푸핑 배제).
//   strings  = 문자열 리터럴 값 배열(op.execute 문장의 raw DROP 내용 검사용).
//   논리 문장 경계 = 괄호/대괄호/중괄호 depth 0에서의 개행(다중행 op 호출을 한 문장으로).
function matchStringStart(src, i) {
  let j = i
  let prefix = ''
  while (j < src.length && /[rRbBuUfF]/.test(src[j]) && prefix.length < 3) { prefix += src[j]; j++ }
  const q3 = src.substr(j, 3)
  if (q3 === "'''" || q3 === '"""') return { raw: /[rR]/.test(prefix), quote: q3, start: j }
  const q1 = src[j]
  if (q1 === "'" || q1 === '"') return { raw: /[rR]/.test(prefix), quote: q1, start: j }
  return null
}

function scanString(src, i, quote, raw) {
  const n = src.length
  const qlen = quote.length
  let val = ''
  while (i < n) {
    if (!raw && src[i] === '\\') { val += src[i] + (src[i + 1] ?? ''); i += 2; continue }
    if (src.startsWith(quote, i)) { i += qlen; break }
    val += src[i]; i++
  }
  return { end: i, val }
}

function parseStatements(src) {
  const stmts = []
  let code = '', comments = '', strings = []
  let depth = 0
  const push = () => {
    if (code.trim() || comments.trim() || strings.length) stmts.push({ code, comments, strings })
    code = ''; comments = ''; strings = []
  }
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    // 라인 주석 # … EOL
    if (c === '#') {
      let j = i + 1
      while (j < n && src[j] !== '\n') j++
      comments += src.slice(i + 1, j) + '\n'
      i = j
      continue
    }
    // 문자열 리터럴(접두사·triple·single 인식) → strings에 값 보존, code엔 공백(토큰 병합 방지)
    const sm = matchStringStart(src, i)
    if (sm) {
      const { end, val } = scanString(src, sm.start + sm.quote.length, sm.quote, sm.raw)
      strings.push(val)
      code += ' '
      i = end
      continue
    }
    // 문장 종결: depth 0에서의 개행
    if (c === '\n') {
      if (depth === 0) push()
      else code += ' '
      i++
      continue
    }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') { if (depth > 0) depth-- }
    code += c
    i++
  }
  push()
  return stmts
}

// ── 파괴 판정 규칙 ──────────────────────────────────────────
const OP_DESTRUCTIVE = [
  { label: 'op.drop_table', re: /\bop\.drop_table\s*\(/ },
  { label: 'op.drop_column', re: /\bop\.drop_column\s*\(/ },
]
const EXEC_RE = /\bop\.execute\s*\(/
// op.execute 내 raw SQL 파괴 키워드 — SQL판(check-destructive-ddl.mjs)과 동일 세트.
const SQL_DESTRUCTIVE = [
  { label: 'op.execute: DROP TABLE', re: /\bDROP\s+TABLE\b/i },
  { label: 'op.execute: DROP DATABASE', re: /\bDROP\s+DATABASE\b/i },
  { label: 'op.execute: DROP SCHEMA', re: /\bDROP\s+SCHEMA\b/i },
  { label: 'op.execute: TRUNCATE', re: /\bTRUNCATE\b/i },
  { label: 'op.execute: DROP COLUMN', re: /\bDROP\s+COLUMN\b/i },
]
const MARKER_RE = /migration-safety:\s*destructive-ok/i

const failures = []
for (const f of migrationFiles) {
  const body = extractUpgradeBody(fileText.get(f))
  if (body == null) continue
  for (const stmt of parseStatements(body)) {
    // 파괴 op 호출
    let hit = OP_DESTRUCTIVE.find((d) => d.re.test(stmt.code))
    // op.execute 문장이면 문자열 값에서 raw DROP 검사(다른 문자열은 검사 안 함 — 오탐 금지)
    if (!hit && EXEC_RE.test(stmt.code)) {
      for (const s of stmt.strings) {
        const sqlHit = SQL_DESTRUCTIVE.find((d) => d.re.test(s))
        if (sqlHit) { hit = sqlHit; break }
      }
    }
    if (!hit) continue
    if (MARKER_RE.test(stmt.comments)) continue // 승인마커(실제 # 주석) → 통과
    const snippet = stmt.code.trim().replace(/\s+/g, ' ').slice(0, 80)
    failures.push({ file: f, label: hit.label, snippet })
  }
}

if (failures.length > 0) {
  console.error('\n✖ Alembic 파괴적 DDL 게이트 실패 — 승인마커 없는 데이터-손실 DDL(upgrade()):')
  for (const { file, label, snippet } of failures) {
    console.error(`  • ${label}  (${file})`)
    console.error(`      ${snippet}`)
  }
  console.error('\n  파괴 DDL은 CI(빈 DB)는 통과하고 운영(기존 데이터)에서만 비가역 손실을 냅니다.')
  console.error('  해결:')
  console.error('    • 정당한 변경(예: forward-only 2단계 배포의 컬럼 제거)이면 파괴 op와 같은 문장에')
  console.error('      승인 주석을 답니다:  # migration-safety: destructive-ok')
  console.error('    • 아니면 파괴 DDL을 제거하고 forward-only(새 리비전 추가) 경로로 대체하세요.')
  console.error('  단일 출처: docs/db-standards.md · docs/specs/alembic-destructive-ddl.md\n')
  process.exit(1)
}

console.log(`✓ Alembic 파괴적 DDL 게이트 통과 — 마이그레이션 ${migrationFiles.length}개 · upgrade()에 승인 없는 파괴 DDL 없음`)
process.exit(0)

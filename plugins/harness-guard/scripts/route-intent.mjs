#!/usr/bin/env node
/*
 * route-intent.mjs — UserPromptSubmit 훅 라우터
 * 의존: node:* 빌트인만 (무의존)
 *
 * 인터페이스:
 *   decide(state) → { inject: boolean, phase?: string, skill?: string, message?: string }
 *   state = { prompt, branch, dirty, committed, openPR, hasSpec, isSolo }
 *
 *   --explain 모드: 플래그로 상태 주입 → deterministic 결정 JSON 출력(stdout)
 *   라이브 모드:   stdin 훅 JSON 읽기 → 상태 수집 → decide → 주입 출력 또는 무출력
 */

import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'

// ── 액션어블 판정 ─────────────────────────────────────────────────────────────
// 조회·분석·질문 신호: 있으면 actionable 아님(오버트리거 방지 — "확인해줘"·"진행상황 알려줘" 등).
const NON_ACTIONABLE = [
  '?', '？', '뭐', '뭔', '무엇', '어때', '어떻게', '왜', '언제', '어디', '누가',
  '보여', '알려', '확인', '요약', '설명', '복사', '공유', '검토', '분석', '상황', '비교',
  '말고', '말아', // 부정문 — "배포하지 말고"·"머지하지 말아"는 실행 지시 아님 (F6)
]
// 알려진 한계(decisions #46): '해줘' 같은 generic 접미사는 비-하네스 동사와 붙어("정리해줘")
// 오탐 가능 — 키워드 substring은 근본적으로 부정확. veto로 흔한 경우만 거르고,
// 정밀 라우팅은 상태 신호(branch·PR·spec)에 의존한다. 키워드 확장 금지(두더지잡기).
// 명확한 실행 지시(한국어 + 최소 영어). substring 매칭이되 위 veto가 먼저 걸러낸다.
const ACTIONABLE = [
  '진행해', '진행시', '머지', '배포', '릴리즈', '올려줘', '커밋해', '푸시해',
  '고고', 'ㄱㄱ', '계속해', '해줘', 'go ahead', 'merge it', 'proceed', 'ship it',
]

export function isActionable(prompt) {
  const p = (prompt ?? '').trim().toLowerCase()
  if (!p) return false
  // veto 먼저 — 조회·분석·질문이면 실행 지시어가 섞여 있어도 actionable 아님
  if (NON_ACTIONABLE.some(kw => p.includes(kw.toLowerCase()))) return false
  return ACTIONABLE.some(kw => p.includes(kw.toLowerCase()))
}

// inject=true 결과 빌더 — 주입 메시지 형식의 단일 출처
function inject(skill) {
  return {
    inject: true,
    phase: skill,
    skill,
    message: `[하네스] 현재=${skill}. 사용자 지시를 다음 단계로 해석: /${skill} 호출. 맨손 gh/git 대신 Skill 도구로 실제 호출하라.`,
  }
}

const isFeatureBranch = (b) => b.startsWith('feature/') || b.startsWith('fix/')

// ── 순수 코어 ─────────────────────────────────────────────────────────────────
export function decide(state) {
  const { prompt, branch = '', committed, openPR, hasSpec, isSolo } = state

  if (!isActionable(prompt)) return { inject: false }

  // 1. openPR 있음 → 머지 게이트 (최우선). 솔로 repo면 solo-merge.
  if (openPR) return inject(isSolo ? 'solo-merge' : 'pr-review-gate')

  // 2. feature/fix 브랜치 + 커밋됨 → feature-merge (PR 생성)
  if (isFeatureBranch(branch) && committed) return inject('feature-merge')

  // 3. spec 있고 아직 feature 브랜치 아님 → feature-add (개발 시작)
  if (hasSpec && !isFeatureBranch(branch)) return inject('feature-add')

  // 4. 판정 신호 없음 → 무주입
  return { inject: false }
}

// ── CLI 플래그 파싱 ────────────────────────────────────────────────────────────
function parseFlags(argv) {
  const get = (f) => {
    const i = argv.indexOf(f)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null
  }
  return {
    prompt:    get('--prompt')   ?? '',
    branch:    get('--branch')   ?? '',
    dirty:     argv.includes('--dirty'),
    committed: argv.includes('--committed'),
    openPR:    get('--open-pr') ? Number(get('--open-pr')) : 0,
    hasSpec:   argv.includes('--has-spec'),
    isSolo:    argv.includes('--solo'),
  }
}

// ── 라이브 모드: 상태 수집 ────────────────────────────────────────────────────
// {status, stdout, stderr} 반환(예외는 status=-1). 모든 호출 fail-soft.
function run(cmd, args, cwd) {
  try {
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 4000 })
    return { status: r.status, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() }
  } catch {
    return { status: -1, stdout: '', stderr: '' }
  }
}
const ok = (r) => r.status === 0 ? r.stdout : null

// isSolo 판정(순수): branch protection 조회 결과(status·stderr)만으로. gh 호출과 분리해 테스트가 주입 검증(T4).
//   status 0 = 보호 있음 → team(false). 404/not found = 보호 없음 → solo(true).
//   403/5xx/네트워크 등 '불확실' = team(false, 안전 — solo-merge가 보호를 해제하려는 오판 방지).
export function classifySolo(status, stderr = '') {
  if (status === 0) return false
  if (/not found|404/i.test(stderr)) return true
  return false
}

// solo 판정을 위해 branch protection을 조회할 대상 브랜치 — PR이 머지되는 **base**(develop/main)여야 한다.
//   현재(feature) 브랜치를 조회하면 항상 비보호 404 → team repo도 solo 오분류돼 solo-merge(리뷰요건 해제)로
//   오라우팅되던 버그(#181) 교정. openPR 없음(머지 대상 PR 없음)·base 불명이면 null → 호출측 team-safe(isSolo=false) 유지.
export function soloProtectionRef({ openPR, prBase }) {
  if (!openPR || !prBase) return null
  return prBase
}

function collectState(cwd, prompt) {
  const branch = ok(run('git', ['-C', cwd, 'branch', '--show-current'], cwd)) ?? ''

  const statusOut = ok(run('git', ['-C', cwd, 'status', '--porcelain'], cwd))
  const dirty = statusOut !== null && statusOut.length > 0

  // committed: 기본 base(origin/HEAD)보다 앞선 커밋 수 — upstream 미설정과 무관하게 동작
  let committed = false
  let baseRef = ok(run('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'origin/HEAD'], cwd))
  if (!baseRef) baseRef = 'origin/main'
  const aheadOut = ok(run('git', ['-C', cwd, 'rev-list', '--count', `${baseRef}..HEAD`], cwd))
  if (aheadOut !== null) committed = Number(aheadOut) > 0

  // open PR — 반드시 현재 브랜치(--head)로 한정(무관한 repo PR 오탐 방지). baseRefName도 함께 조회(solo 판정용).
  let openPR = 0
  let prBase = ''
  if (branch) {
    const prOut = ok(run('gh', ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number,baseRefName', '--limit', '1'], cwd))
    if (prOut) {
      try {
        const prs = JSON.parse(prOut)
        if (Array.isArray(prs) && prs.length > 0) { openPR = prs[0].number; prBase = prs[0].baseRefName ?? '' }
      } catch {}
    }
  }

  // spec 파일
  let hasSpec = false
  try {
    const specDir = `${cwd}/docs/specs`
    if (existsSync(specDir)) hasSpec = readdirSync(specDir).some(f => f.endsWith('.md'))
  } catch {}

  // isSolo: PR이 머지되는 **base 브랜치**(develop/main)의 protection이 404(보호 없음)일 때만 solo=true.
  //   (현재 feature 브랜치를 조회하면 항상 비보호 404라 team repo도 solo로 오분류돼 solo-merge로 오라우팅되던
  //    버그#181 — base로 교정. soloProtectionRef가 조회 대상을 결정: openPR 없음/base 불명이면 team-safe.)
  //   403/5xx/네트워크 등 '불확실'은 team으로 안전 기본값(solo-merge가 보호를 해제하려 시도하는 오판 방지).
  let isSolo = false
  const soloRef = soloProtectionRef({ openPR, prBase })
  if (soloRef) {
    const repo = ok(run('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], cwd))
    if (repo) {
      const r = run('gh', ['api', `repos/${repo}/branches/${soloRef}/protection`], cwd)
      isSolo = classifySolo(r.status, r.stderr)   // 404=solo · 그 외 불확실=team(안전)
    }
  }

  return { prompt, branch, dirty, committed, openPR, hasSpec, isSolo }
}

// ── 진입점 ────────────────────────────────────────────────────────────────────
const _isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (_isMain) {
  const args = process.argv.slice(2)

  if (args.includes('--explain')) {
    // --explain 모드: 플래그로 상태 주입 → decide → JSON 한 줄 출력 (방어적 — 절대 crash 안 함)
    try {
      process.stdout.write(JSON.stringify(decide(parseFlags(args))) + '\n')
    } catch {
      process.stdout.write(JSON.stringify({ inject: false }) + '\n')
    }
    process.exit(0)
  }

  // 라이브 모드: stdin 훅 JSON → (actionable일 때만 상태 수집) → decide → 주입 또는 무출력
  // fail-open: 어떤 에러·비-repo·gh 부재여도 항상 exit 0, 무주입.
  ;(async () => {
    try {
      const chunks = []
      for await (const chunk of process.stdin) chunks.push(chunk)
      const hook = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      const prompt = hook.prompt ?? ''
      const cwd = hook.cwd ?? process.cwd()

      // 단락: 비-actionable이면 git/gh 수집을 아예 건너뜀(오버트리거 0 + 비용 0)
      if (!isActionable(prompt)) { process.exit(0) }

      const result = decide(collectState(cwd, prompt))
      if (result.inject) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: result.message,
          },
        }) + '\n')
      }
    } catch {
      // fail-open: 어떤 에러도 무시
    }
    process.exit(0)
  })()
}

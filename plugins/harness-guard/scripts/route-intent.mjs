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
function isActionable(prompt) {
  const p = (prompt ?? '').trim()
  // Non-actionable: 질문·탐색 패턴을 먼저 체크
  if (p.includes('?') || p.includes('뭐야') || p.includes('보여줘')) {
    return false
  }
  // Actionable: 명령형 키워드
  const ACTIONABLE = ['진행해', '해줘', '계속', '머지해', '올려', '배포해', '진행', '고고']
  return ACTIONABLE.some(kw => p.includes(kw))
}

// inject=true 결과 빌더 — 주입 메시지 형식의 단일 출처
function inject(skill) {
  return {
    inject: true,
    phase: skill,
    skill,
    message: `[하네스] 현재=${skill}. 사용자 지시를 다음 단계로 해석: /${skill} 호출. 맨손 gh/git 대신 Skill 도구로 실제 호출하라.`
  }
}

const isFeatureBranch = (b) => b.startsWith('feature/') || b.startsWith('fix/')

// ── 순수 코어 ─────────────────────────────────────────────────────────────────
export function decide(state) {
  const { prompt, branch, committed, openPR, hasSpec, isSolo } = state

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
function runCmd(cmd, args, cwd) {
  try {
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 5000 })
    return r.status === 0 ? r.stdout.trim() : null
  } catch {
    return null
  }
}

function collectState(cwd, prompt) {
  // git 브랜치
  const branch = runCmd('git', ['-C', cwd, 'branch', '--show-current'], cwd) ?? ''

  // dirty: 변경된 파일 있음
  const statusOut = runCmd('git', ['-C', cwd, 'status', '--porcelain'], cwd)
  const dirty = statusOut !== null && statusOut.length > 0

  // committed: 업스트림보다 앞선 커밋 있음
  const logOut = runCmd('git', ['-C', cwd, 'log', '@{u}..HEAD', '--oneline'], cwd)
  const committed = logOut !== null && logOut.length > 0

  // open PR
  let openPR = 0
  const prOut = runCmd('gh', ['pr', 'list', '--json', 'number', '--limit', '1'], cwd)
  if (prOut) {
    try {
      const prs = JSON.parse(prOut)
      if (Array.isArray(prs) && prs.length > 0) openPR = prs[0].number
    } catch {}
  }

  // spec 파일
  let hasSpec = false
  try {
    const specDir = `${cwd}/docs/specs`
    if (existsSync(specDir)) {
      hasSpec = readdirSync(specDir).some(f => f.endsWith('.md'))
    }
  } catch {}

  // isSolo: branch protection 조회 403/404이면 solo=true
  let isSolo = false
  try {
    const repoOut = runCmd('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], cwd)
    if (repoOut && branch) {
      const apiOut = runCmd('gh', ['api', `repos/${repoOut}/branches/${branch}/protection`], cwd)
      isSolo = apiOut === null
    }
  } catch {
    isSolo = false
  }

  return { prompt, branch, dirty, committed, openPR, hasSpec, isSolo }
}

// ── 진입점 ────────────────────────────────────────────────────────────────────
const _isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (_isMain) {
  const args = process.argv.slice(2)

  if (args.includes('--explain')) {
    // --explain 모드: 플래그로 상태 주입 → decide → JSON 한 줄 출력
    const state = parseFlags(args)
    const result = decide(state)
    process.stdout.write(JSON.stringify(result) + '\n')
    process.exit(0)
  }

  // 라이브 모드: stdin 훅 JSON 읽기 → 상태 수집 → decide → 주입 또는 무출력
  // fail-open: git/gh 실패·비-repo 환경이어도 항상 exit 0
  ;(async () => {
    try {
      const chunks = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk)
      }
      const raw = Buffer.concat(chunks).toString('utf8')
      const hook = JSON.parse(raw)
      const prompt = hook.prompt ?? ''
      const cwd = hook.cwd ?? process.cwd()

      const state = collectState(cwd, prompt)
      const result = decide(state)

      if (result.inject) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: result.message
          }
        }) + '\n')
      }
    } catch {
      // fail-open: 어떤 에러도 무시, 프롬프트 처리 막지 않음
    }
    process.exit(0)
  })()
}

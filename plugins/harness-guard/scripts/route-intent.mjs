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
import { readPolicy } from './repo-policy.mjs'

// 일반·복합 요청의 의미는 native agent가 판단한다. 짧은 명시 요청에만 상태 후보를 연결한다.
function requestedPhase(prompt) {
  if (typeof prompt !== 'string') return null
  const p = prompt.trim().toLowerCase()
  if (/^(?:머지해(?:줘)?|머지해 주세요|merge it)[.!]?$/.test(p)) return 'integrate'
  if (/^(?:구현해(?:줘)?|구현해 주세요|implement it)[.!]?$/.test(p)) return 'implement'
  return null
}

export function isActionable(prompt) {
  return requestedPhase(prompt) !== null
}

// inject=true 결과 빌더 — 주입 메시지 형식의 단일 출처
function inject(skill) {
  return {
    inject: true,
    phase: skill,
    skill,
    message: `[하네스] 상태 기반 후보=${skill}. 이 후보는 현재 작업 단계나 실행 승인을 확정하지 않는다. 실제 사용자 요청·기존 승인 범위·프로젝트 원본과 대조해 적합한 skill을 선택하라. 후보가 맞으면 ${skill}/SKILL.md를 읽고 그 절차와 wrapper를 적용하라. 맞지 않으면 요청에 맞는 계약을 따른다. 별도 skill 호출 surface가 없는 도구는 현재 agent가 절차를 직접 수행한다. 선택 후 사용자 업데이트에 적용 skill과 현재 phase를 표시하라.`,
  }
}

const isFeatureBranch = (b) => ['feature/', 'fix/', 'codex/'].some(prefix => b.startsWith(prefix))

// ── 순수 코어 ─────────────────────────────────────────────────────────────────
export function decide(state) {
  const { prompt, branch = '', committed, openPR, hasSpec, isSolo } = state

  const intent = requestedPhase(prompt)
  if (intent === 'integrate') {
    if (openPR) return inject(isSolo ? 'solo-merge' : 'pr-review-gate')
    if (isFeatureBranch(branch) && committed) return inject('feature-merge')
  }
  if (intent === 'implement' && !openPR && hasSpec && ['main', 'develop'].includes(branch)) {
    return inject('feature-add')
  }

  // 판정 근거가 부족하면 일반 요청을 막지 않고 후보만 생략한다.
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
  if (!openPR || !['develop', 'main'].includes(prBase)) return null
  return prBase
}

// committed 판정의 base 브랜치 — feature/fix는 develop에서 갈라져 develop로 PR되므로(pr-create과 정합) develop 우선.
//   origin/main 기준이면 develop이 main보다 앞선 만큼 0-커밋 신규 feature 브랜치도 committed=true로 오판(#209).
export function committedBaseRef(hasOriginDevelop, originHead) {
  if (hasOriginDevelop) return 'origin/develop'
  return originHead || 'origin/main'
}

function collectState(cwd, prompt) {
  const policy = readPolicy(cwd)
  const branch = ok(run('git', ['-C', cwd, 'branch', '--show-current'], cwd)) ?? ''

  const statusOut = ok(run('git', ['-C', cwd, 'status', '--porcelain'], cwd))
  const dirty = statusOut !== null && statusOut.length > 0

  // committed: 통합 base(develop 우선, 없으면 origin/HEAD)보다 앞선 커밋 수 — upstream 미설정과 무관하게 동작.
  let committed = false
  const hasDevelop = run('git', ['-C', cwd, 'rev-parse', '--verify', '--quiet', 'refs/remotes/origin/develop'], cwd).status === 0
  const baseRef = committedBaseRef(hasDevelop, ok(run('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'origin/HEAD'], cwd)))
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

  if (policy.stackedPRs?.enabled) {
    // A trunk-relative count includes inherited parent commits. The prompt hook
    // does not refresh native metadata or fetch refs just to guess a workflow.
    // Before a PR exposes its direct parent, leave this hint unverified.
    committed = false
    if (openPR && prBase) {
      const parent = `refs/remotes/origin/${prBase}`
      if (run('git', ['-C', cwd, 'merge-base', '--is-ancestor', parent, 'HEAD'], cwd).status === 0) {
        const count = ok(run('git', ['-C', cwd, 'rev-list', '--count', `${parent}..HEAD`], cwd))
        committed = count !== null && /^\d+$/.test(count) && Number(count) > 0
      }
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
  if (soloRef && policy.mode === 'solo') {
    const repo = ok(run('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], cwd))
    if (repo) {
      const r = run('gh', ['api', `repos/${repo}/branches/${soloRef}/protection`], cwd)
      isSolo = classifySolo(r.status, r.stderr) // hint only; actual solo owner/collaborator authorization remains in the wrapper
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

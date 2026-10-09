// /harness-review — team-harness 정합성 회귀 검토 워크플로
// 문서·가드·커맨드·템플릿을 변경한 뒤 "문서가 주장하는 것 = 구현이 하는 것"을 회귀 검사한다.
// 7개 관점 병렬 검토 → 발견사항별 적대적 검증 → 확정/기각/미확인 + 범위 리포트.
export const meta = {
  name: 'harness-review',
  description: 'team-harness 정합성 회귀 검토 — 7개 관점 병렬 검토 + 발견사항별 적대적 검증',
  whenToUse: '문서·플러그인·템플릿 변경 후 repo 전체 정합성을 회귀 검사할 때',
  phases: [
    { title: 'Review', detail: '가드·커맨드·템플릿·docs·표준·AGENTS·README 7개 관점 병렬 검토' },
    { title: 'Verify', detail: '발견사항별 적대적 검증 (오탐 제거)' },
  ],
}

const FINDINGS = {
  type: 'object',
  required: ['findings', 'status'],
  properties: {
    status: { type: 'string', enum: ['reviewed', 'unverified'] },
    reason: { type: 'string', description: '관점 검토를 완료하지 못한 이유' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'file', 'detail', 'severity'],
        properties: {
          title: { type: 'string' },
          file: { type: 'string', description: '근거 파일 경로(:라인 포함)' },
          detail: { type: 'string', description: '무엇이 어떻게 불일치하는지 + 양쪽 파일:라인 근거' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
}

const VERDICT = {
  type: 'object',
  required: ['status', 'reason'],
  properties: {
    status: { type: 'string', enum: ['confirmed', 'rejected', 'unverified'] },
    reason: { type: 'string' },
  },
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string' && value.trim().length > 0
const validFinding = finding => record(finding)
  && ['title', 'file', 'detail'].every(key => text(finding[key]))
  && ['high', 'medium', 'low'].includes(finding.severity)

function verdictStatus(verdict) {
  if (!record(verdict) || !text(verdict.reason)) return 'unverified'
  // Preserve explicit uncertainty in older boolean responses as well as the new schema.
  if (verdict.uncertain === true || /\buncertain\b|불확실|미확인|확인하지 못|cannot verify|not verified/i.test(verdict.reason)) return 'unverified'
  if (Object.hasOwn(verdict, 'status')) {
    if (!['confirmed', 'rejected', 'unverified'].includes(verdict.status)) return 'unverified'
    if (Object.hasOwn(verdict, 'isReal') && verdict.isReal !== (verdict.status === 'confirmed')) return 'unverified'
    return verdict.status
  }
  if (verdict.isReal === true) return 'confirmed'
  if (verdict.isReal === false) return 'rejected'
  return 'unverified'
}

function unverified(dim, reason, finding = null) {
  return { ...(validFinding(finding) ? finding : { title: '검토 결과 미확인', finding }), dim, status: 'unverified', reason }
}

const COMMON = `대상: 현재 작업 디렉토리의 team-harness repo — working tree 기준으로 파일을 직접 Read해서 검증하라.
확실한 불일치·모순·깨진 참조·사실 오류만 보고하라. 스타일 취향·일반적 개선 제안·추측은 제외.
모든 발견에 양쪽 파일:라인 근거 필수. 관점 검토를 끝냈으면 status=reviewed이며 발견 없으면 빈 배열을 반환하라.
필수 파일·관찰을 확인할 수 없거나 관점 검토가 불완전하면 status=unverified와 reason을 반환하라.
불완전한 검토에서 빈 findings를 정상 미검출로 표현하지 마라. 확인한 발견사항은 그대로 남겨라.`

const DIMENSIONS = [
  {
    key: 'guard-docs',
    prompt: `가드 구현과 문서 주장의 정합성을 검토하라.
구현: plugins/harness-guard/scripts/guard.sh, hooks/hooks.json, templates/githooks/pre-commit
주장: README.md 가드 서술, templates/AGENTS.md 금지 사항, docs/ai-collaboration.md
문서가 "차단된다"고 주장하는 패턴을 echo '{"tool_name":"Bash","tool_input":{"command":"..."}}' | bash guard.sh 로 실측해서, 주장과 실동작이 어긋나는 것만 보고하라. 가드는 보조 장치(주석 참조)이므로 문서가 주장하지 않는 완벽성은 요구하지 마라.`,
  },
  {
    key: 'commands-gate',
    prompt: `git-flow 커맨드와 게이트 절차의 정합성을 검토하라.
대상: plugins/harness-guard/skills/ 전체(git-flow 스킬 — 과거 commands/는 skills/로 이전됨), agents/security-reviewer.md
스킬이 절차를 복붙해 단일 출처와 드리프트가 생겼는지, 스킬 간 상호 참조·전제가 실제 파일 내용과 맞는지, 참조하는 섹션명(AGENTS.md 등)이 실존하는지, 지시가 자기 가드·branch protection에 차단되어 실행 불가능하지 않은지 확인하라.`,
  },
  {
    key: 'templates-onboarding',
    prompt: `templates/와 docs/onboarding.md의 정합성을 검토하라.
온보딩 체크리스트가 언급하는 템플릿 파일·복사 목적지가 실존하는지, CI job 이름이 required checks 지정과 일치하는지, gh api 예시가 유효한 페이로드인지, settings.json 키·권한이 플러그인이 실행하는 명령을 커버하는지, gitignore.snippet이 문서·에이전트가 전제하는 파일들을 커버하는지 확인하라.`,
  },
  {
    key: 'docs-cross',
    prompt: `docs/*.md 전체의 상호 참조·교차 일관성을 검토하라.
참조하는 문서·섹션(§N)이 실존하고 그 내용을 실제로 담는지, 같은 주제(브랜치 정책·커밋 컨벤션·리뷰 절차·기술 결정·확정 상태)를 두 문서가 다르게 서술하는 모순이 있는지, 단일 출처 선언과 실제 내용 분담이 맞는지, 한 문서의 예시가 다른 문서(또는 자신)가 정의한 포맷을 위반하는지 확인하라.`,
  },
  {
    key: 'standards-impl',
    prompt: `docs 표준이 주장하는 자동 점검을 플러그인·CI가 실제로 수행하는지 검토하라.
대상: agents/security-reviewer.md, skills/release-check/SKILL.md, templates/ci/ 전체 vs docs/auth-standards.md·db-standards.md·api-standards.md·operations.md
문서가 "X가 점검한다"고 주장하는 항목이 해당 구현의 정의에 실제로 있는지, 구현의 점검 정의가 표준의 용어 정의(forward-only 등)와 같은 의미인지, 귀속(계층 0 vs 플러그인)이 정확한지 확인하라.`,
  },
  {
    key: 'agents-source',
    prompt: `templates/AGENTS.md(타 도구 사용자의 유일한 규약 출처)와 docs·플러그인의 정합성을 검토하라.
'팀 표준 문서' 표의 각 행 요약이 해당 문서의 실제 핵심과 맞는지, 품질 게이트·브랜치 정책·금지 사항이 docs/code-review.md·onboarding.md·guard.sh와 일치하는지(머지 조건 요소 누락 등), 가드가 차단하는 항목이 금지 사항에 빠짐없이 명문화됐는지 확인하라.`,
  },
  {
    key: 'readme',
    prompt: `README.md가 repo 실제 내용과 일치하는지 검토하라.
구조 트리 vs 실제 디렉터리, 계층 표·플러그인 구성 표의 주장 vs 실제 파일 내용, 배지 버전 vs plugin.json, docs 표 링크·요약 vs 해당 문서, 빠른 시작 명령 vs onboarding.md, 로드맵·제약 서술의 사실 오류를 확인하라.`,
  },
]

phase('Review')
const results = await pipeline(
  DIMENSIONS,
  async d => {
    try {
      return await agent(`${d.prompt}\n\n${COMMON}`, { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS })
    } catch (error) { return { error: String(error?.message || error) } }
  },
  async (review, d) => {
    if (!record(review) || !Array.isArray(review.findings)) {
      return { dim: d.key, findings: [unverified(d.key, review?.error || 'findings 응답 누락 또는 형식 오류')] }
    }
    const coverageGap = review.uncertain === true || review.status !== 'reviewed'
      ? [unverified(d.key, text(review.reason) ? review.reason : '관점 검토 범위 미완료 또는 상태 형식 오류')]
      : []
    if (!review.findings.length) return { dim: d.key, findings: coverageGap }
    log(`review:${d.key} — 발견 ${review.findings.length}건, 검증 시작`)
    const findings = await parallel(review.findings.map(f => async () => {
      if (!validFinding(f)) return unverified(d.key, '발견사항의 필수 근거·심각도 형식 오류', f)
      try {
        const verdict = await agent(
        `다음은 team-harness repo 정합성 검토 발견사항이다. 적대적으로 검증하라 — 근거 파일들을 직접 Read해서 반박을 시도하라.
제목: ${f.title}
근거 파일: ${f.file}
내용: ${f.detail}

판정 기준: 실제 존재하는 불일치·모순·깨진 참조이며 수정 가치가 있으면 status=confirmed. 사실과 다르거나, 오독이거나, 의도된 설계(요약·역할 분담·보조 장치 성격)거나, 사소한 표현 차임을 근거로 확인했으면 status=rejected. 근거를 확인할 수 없거나 불확실하면 status=unverified. reason에 판정 근거 또는 확인하지 못한 이유를 파일:라인과 함께 적어라.`,
        { label: `verify:${d.key}`, phase: 'Verify', schema: VERDICT }
        )
        return { ...f, dim: d.key, verdict, status: verdictStatus(verdict), reason: text(verdict?.reason) ? verdict.reason : 'verdict 응답 누락 또는 형식 오류' }
      } catch (error) { return unverified(d.key, String(error?.message || error), f) }
    }))
    return { dim: d.key, findings: [...findings, ...coverageGap] }
  }
).catch(error => { log(`검토 실행 미확인 — ${String(error?.message || error)}`); return [] })

const all = []
const dimensions = DIMENSIONS.map(({ key }) => {
  const matches = Array.isArray(results) ? results.filter(result => record(result) && result.dim === key) : []
  const rawFindings = matches.length === 1 && Array.isArray(matches[0].findings)
    ? matches[0].findings : [unverified(key, '검토 관점 결과 누락·중복 또는 형식 오류')]
  const findings = rawFindings.map(f => record(f) && ['confirmed', 'rejected', 'unverified'].includes(f.status)
    ? f : unverified(key, '관점별 검증 결과 형식 오류', f))
  all.push(...findings)
  return { dim: key, status: findings.some(f => f.status === 'unverified') ? 'unverified' : 'reviewed', findings: findings.length }
})
const confirmed = all.filter(f => f.status === 'confirmed')
const rejected = all.filter(f => f.status === 'rejected')
const unresolved = all.filter(f => f.status === 'unverified')
const complete = unresolved.length === 0
log(`검토 결과 — 확정 ${confirmed.length}건 / 기각 ${rejected.length}건 / 미확인 ${unresolved.length}건`)
return {
  confirmed,
  rejected: rejected.map(f => ({ title: f.title, dim: f.dim, reason: f.reason })),
  unverified: unresolved,
  coverage: { dimensions, complete },
  status: complete ? 'complete' : 'unverified',
}

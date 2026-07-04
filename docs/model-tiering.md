# 모델 티어링 — Haiku · Sonnet · Opus

작업 복잡도에 모델을 맞춰 **비용·정확도를 균형** 맞춘다. team-harness 커맨드의 서브에이전트 `model:` 지정이 이 표를 따른다 — 정책의 단일 출처.

## 3-tier

| 티어 | 쓰는 곳 | 기준 |
|---|---|---|
| **Haiku** | 조회·파일 읽기·상태/헬스 체크·디자인토큰/a11y 스캔·기계적 변환 | 판단이 거의 없는 **단순** 작업 |
| **Sonnet** | 코드 빌드·구현·테스트 작성·품질/마이그레이션 검증 · 비용 인식 실행(`opusplan`의 실행 단계) | 중간 복잡도, 약간의 추론 |
| **Opus** | 보안·설계 판단·리서치·복잡 추론·다각도 검증·워크플로 오케스트레이션 · **메인 세션 기본(Anthropic 권장)** | 깊은 추론·정확도가 비용보다 중요 |

## 원칙

1. **메인 세션 = Opus 기본 (현 Anthropic 권장 "Start with Opus").** Max·Team Premium·Enterprise·API 티어의 계정 default가 Opus 4.8(Pro·Team Standard은 Sonnet 4.6). Haiku는 메인 부적합(오케스트레이션·판단·대화 약함). **비용 인식**: 계획은 opus·기계적 실행은 sonnet이 유리하면 **`opusplan` 별칭**(plan mode=opus → 실행=sonnet), 또는 세션 중 기계적 구간에 `/model sonnet`↔`/model opus` 수동 전환. (⚠️ 과거 이 문서는 "Sonnet 기본"이었으나 Opus 4.8 이후 공식 권장이 뒤집혀 현행화 — 기준: Claude Code *Model configuration* "Start with Opus", 2026-07 확인.)
2. **단순 작업은 Haiku로 적극 위임** — Sonnet도 과하다. 단, 메인이 직접 하는 **1회성 자잘한 작업**(git 한 줄·파일 읽기·작은 편집)은 위임 오버헤드 > 이득 → 인라인. 위임은 "묶음 단순작업"·"명확히 분리된 단순 서브태스크"에만.
3. **빌드·구현은 Sonnet 서브에이전트 위임이 원칙** — 메인이 Opus여도 빌드를 Opus 인라인으로 하지 않는다.
4. **검증·리서치·설계는 Opus.** 검증 프롬프트에 "전체 재스캔"·"다른 각도로 접근"을 명시하면 누락을 더 잘 잡는다.
5. **타입이 곧 티어다 — 모델은 타입을 따라온다.** 판단 없는 read-only 작업(조회·헬스체크·진행률 조회)은 `subagent_type: Explore`(읽기전용 도구로 제한 = 최소권한, Haiku 티어). 파일을 **수정**하거나 빌드·구현하면 `general-purpose`(Sonnet) — 단순 집계라도 파일을 쓰면 Explore 불가. `general-purpose`에 `model: haiku`를 붙이는 건 타입↔티어 불일치(빌드 타입에 단순 티어) → 지양.

## 커맨드별 적용 (현행)

| 커맨드 | 서브에이전트 | 모델 |
|---|---|---|
| `/feature-add`·`/feature-modify` | 테스트 계약·구현 | **Sonnet** |
| `/hotfix` | 재현·수정 | **Sonnet** |
| `/qa` | 디자인 토큰·a11y 스캔 | **Haiku** |
| `/release-check` | 품질·마이그레이션 | **Sonnet** · 보안 = `security-reviewer` 에이전트 |
| `/release` | 배포 후 헬스 체크 | **Haiku** · (ci-gate에 e2e 없을 때) e2e = Sonnet |
| 모든 커맨드 | 오케스트레이션(메인) | **Opus**(권장 기본) · 비용 인식 시 `opusplan`/`sonnet` |

## 설정 (적용 방법)

- **메인 모델 기본 = Opus (권장)**: Anthropic 공식 "Start with Opus"(`claude --model opus` 또는 계정 tier default). **비용 인식 대안**: `"model": "opusplan"`(계획=opus·실행=sonnet 자동 전환) 또는 세션 중 기계적 구간 `/model sonnet`↔`/model opus`. *프로젝트 `.claude/`는 gitignore 대상이라 전역 설정이 레버 — 프로젝트 CLAUDE.md에 모델 정책을 복붙하지 않는다(드리프트 금지, 단일 출처는 이 문서).*
- **effort 레벨**(`/effort`: high 기본 · xhigh · max · **ultracode**=xhigh+opus+"cost is not a constraint")은 비용이 크다 — 전면 감사·다각도 리뷰·깊은 리서치 때만 상향, 라우틴은 기본(high).
- **세션 위생**(비용의 큰 축): 긴 단일 세션은 컨텍스트가 매 턴 캐시 read돼 opus 비용을 키운다 — 페이즈 전환 시 `/clear`, 컨텍스트가 커지면 `/compact`. (모델 선택과 독립적인 별도 레버.)

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
2. **위임 정책(무엇을 어느 티어·도구에)의 단일 출처 = 아래 [실전 결정표].** 1회성 단일 trivial만 메인 인라인 — 애매하거나 여러 개면 위임('자잘' 확대 적용 금지).
3. **읽기·검색·빌드를 상위(Opus) 메인 인라인으로 몰지 않는다** — 하위 티어 서브에이전트에 위임(결정표대로).
4. **검증·리서치·설계는 Opus.** 검증 프롬프트에 "전체 재스캔"·"다른 각도로 접근"을 명시하면 누락을 더 잘 잡는다.
5. **타입=티어**: read-only(조회·검색·헬스체크)=`subagent_type: Explore`(읽기전용=최소권한, Haiku), 파일 수정·빌드=`general-purpose`(Sonnet) — 단순 집계라도 파일 쓰면 Explore 불가. `general-purpose`에 `model:haiku`는 타입↔티어 불일치라 지양.

## 실전 결정표 (무엇을 어디서 — 원칙의 구체 적용)

추상 지침("단순 작업 위임")은 "1회성 자잘"로 확대 해석되기 쉽다. 아래로 판단을 기계화한다:

| 작업 유형 | 구체 예시 | 처리 (기본값) |
|---|---|---|
| 읽기·검색·조회 | `grep`·`cat`·`find`·여러 파일 읽기·상태/로그 확인 | **Explore(haiku)에 위임** — 묶어서 |
| 빌드·구현·편집 | 테스트·픽스처 작성·여러 파일 편집·스크립트 구현 | **general-purpose(sonnet)에 위임** |
| 검증·리뷰·설계 | diff 정합성·보안 리뷰·근거 대조·설계 판단 | **opus** — 인라인 또는 `verifier` |
| 계획·오케스트레이션 | 스펙 설계·단계 조율·결정 | **opus 메인** |
| 무거운 다단계(병렬성 有) | N건 감사·대량 마이그레이션·전면 리뷰 | **Workflow** — 스크립트가 stage별 모델을 결정론적 지정(매 다중편집이 아니라 *병렬 가능한 대규모*만) |
| 좁은 예외: 단일 trivial | 한 줄 명령·**파일 1개** 읽기·작은 단일 편집 | 메인 인라인 OK — **애매하거나 여러 개면 위 행대로 위임** |

> 이 표가 위임 정책의 **단일 출처**. **무엇을 위임할지는 재량 안내**지만, **위임된 뒤의 강제는 실재한다**:
> ① **서브에이전트 모델 = 훅 강제** — `~/.claude/hooks/enforce-subagent-model.py`(PreToolUse, matcher: Agent)가 타입별로 `updatedInput.model`을 주입한다: Explore→haiku · general-purpose/claude→sonnet · 특권타입(verifier·security-reviewer·Plan·harness-manager)은 미터치=opus 유지(frontmatter/상속). 결정은 `~/.claude/hooks/subagent-model.log`에 기록돼 **감사 가능**(실측: 실제 세션에서 general-purpose→sonnet·Explore→haiku 확인).
> ② **스킬 effort = frontmatter 강제** — 각 SKILL.md의 `effort:` 필드가 실제 적용된다(A/B 실측: 동일 과제에서 `max`가 `low` 대비 출력 토큰 **3.4×**).
> ③ Workflow stage별 모델 지정·`opusplan`(도구 기능).
> 즉 문서는 **정책 출처**, 강제는 위 셋이 담당한다. (effort는 요청 파라미터라 세션 로그엔 안 남고 A/B로만 검증됨 · 서브에이전트 모델은 로그로 직접 검증됨.)

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

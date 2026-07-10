---
name: feature-add
description: TDD로 신규 기능 개발 — 브랜치→테스트계약→구현→검증→커밋 (stack-agnostic)
argument-hint: <feature-name> "<설명>"
effort: high
---

# /feature-add — TDD 기반 신규 기능 개발

## Codex 실행

Claude의 `subagent_type`·`model`·`run_in_background` 표기는 Claude 경로용 역할 경계다. Codex에서는
테스트 계약·구현·커밋은 현재 agent가 **순차** 수행한다. 읽기 전용 탐색은 `harness-explorer`
(`gpt-5.6-terra`, medium), 최종 반증은 `harness-verifier` (`gpt-5.6-terra`, high)에만 위임한다.
둘 다 구현 파일을 수정하지 않는다.

**사용법**: `/feature-add <feature-name> "<설명>"`
예) `/feature-add bookmark "북마크 저장 기능"`

> Red → Green → Refactor. 테스트가 구현보다 먼저 존재하고, **테스트는 변경 불가 계약**이다.
> **TDD는 로직(백엔드 + 프론트엔드 로직: 훅·상태·검증·데이터·조건부 동작)의 정확성을 본다 — 층 무관.**
> 프론트 비주얼·접근성은 직교한 `/qa`(디자인 토큰·WCAG)가 본다. 순수 프레젠테이셔널/비주얼은 단위 TDD 대상이 아니라 e2e + `/qa`로 커버.

> **스택 의존 값은 repo의 `AGENTS.md`에서 읽는다** — 테스트·품질·빌드 명령(`빌드·테스트 명령` 섹션),
> 소스 디렉터리, 프론트엔드 유무. 하드코딩하지 않는다. 프론트엔드가 없는 repo면 프론트 단계(Phase 4)는 생략한다.

---

## 완료 기준 (Definition of Done) — 통과까지 루프한다

아래가 **모두** 충족돼야 완료. 하나라도 미충족이면 해당 Phase로 돌아가 루프(구현 루프 3회 실패 시 중단·보고):

| # | 기준 | 검증 방법 |
|---|---|---|
| 1 | 작성한 모든 테스트 GREEN (정상·예외·경계 커버) | AGENTS.md 테스트 명령 `exit 0` |
| 2 | spec/test가 구현 단계에서 변경되지 않음(테스트 무결성) | `git diff -- <spec/test 파일>` 빈 결과 |
| 3 | 회귀 없음 — 전체 품질(lint·test·build) 통과 | AGENTS.md 전체 품질 명령 `exit 0` |
| 4 | Cross-domain 체크리스트 해당 항목이 구현·테스트에 반영 | Phase 1 체크리스트 대조 |
| 5 | Refactor 완료(중복·난잡 제거) 후 테스트 재통과 | 재실행 `exit 0` |

프론트엔드가 있으면 1·5는 **프론트 로직 테스트에도 동일 적용**. 비주얼·접근성은 `/qa`(직교 축)가 별도로 본다 — 이 커맨드의 완료 기준에 a11y/디자인은 포함하지 않는다.

---

## Phase 0 — 진입 전 점검 + 브랜치 + TDD 적합성 판정 (오케스트레이터 직접 실행)

> ⚠️ **진입 계약 (상류 plan 선행 — guard가 강제):** 신규 `feature/<name>` 브랜치는 승인된 `docs/specs/<name>.md`(`/plan` 산출)가 있어야 생성된다. 없으면 guard.sh가 브랜치 생성을 차단한다 — 먼저 `/plan`으로 스펙을 만들 것. **trivial 변경**(typo·1줄 등 계획 불필요)이면 `HARNESS_TRIVIAL=1 git checkout -b feature/<name>`로 **의식적으로 면제**한다(침묵 우회가 아니라 명시). 기존 feature 브랜치 계속·fix/hotfix는 게이트 무관.

**브랜치 결정 (한 기능 = 한 브랜치):**
- **이미 `feature/*` 브랜치에 있고 작업트리가 깨끗하면** → 그 브랜치에서 **계속한다**(새로 만들지 않음). `/plan`으로 분해된 기능의 **후속 태스크**가 이 경우 — 여러 태스크가 한 브랜치에 원자적 커밋으로 쌓여 한 PR이 된다.
- **`develop`/`main`에 있으면** → 새 feature 브랜치 생성:
  ```bash
  git checkout develop && git pull origin develop
  git checkout -b feature/$FEATURE_NAME
  ```
- 동일 모듈이 이미 있으면 중단하고 `/feature-modify` 사용을 안내.
- **TDD 적합성**: 탐색적 spike·빠르게 변하는 UI 비주얼·새 기술 학습·요구사항 미확정이면 TDD를 강제하지 않는다 — 먼저 spike로 학습 후 production을 TDD로 재작성하거나, "TDD 완화 모드"를 사용자에게 확인. (TDD는 동작이 명확한 로직에 가장 잘 맞는다.)

---

## Phase 1 — 요구사항 분석 + 영향 범위 (오케스트레이터 직접 실행)

$ARGUMENTS에서 도출: API/인터페이스 계약(요청·응답·비즈니스 규칙: 정상·예외·경계값), (프론트 있으면) 화면/컴포넌트 구조, 재사용할 기존 코드, DB 스키마 변경 여부.

**Cross-domain 체크리스트 (반드시 확인):**
- [ ] 새 에러 유형 → 중앙 에러 핸들러에 대응이 있는가
- [ ] 역할(admin 등) 전용 → 인가 레이어에서 접근 제어가 적용되는가
- [ ] 다른 도메인에 side effect → 연관 상태까지 동기화되는가
- [ ] 외부 입력 → 입력값 검증이 적용되는가
- [ ] HTTP/API 응답 코드가 의미(성공/실패/권한)에 맞는가

**테스트 시나리오 리스트**를 산출한다(정상 경로 + 예외 + 경계). 분석 결과·리스트를 Phase 2 프롬프트에 명시적으로 포함한다 — $ARGUMENTS만으로 추론하지 않는다.

**Preflight (테스트·코드 쓰기 전 선독, 필수)**: 이 작업이 건드리는 ① 해당 team-harness **표준 섹션**과
② **설치된 라이브러리의 실제 API/소스**(학습데이터가 아니라 `node_modules`의 설치본 문서·`src/components/ui/*`
등 repo에 들어온 실제 코드)를 *Phase 2 테스트 계약을 쓰기 전에* 읽는다. 알아낸 함정(시그니처·기본동작·버전
차이)을 테스트 시나리오·구현 메모에 반영한다. (근거: 'This is NOT the Next.js you know — node_modules 문서를
읽어라' — 기억으로 API를 가정하면 RED가 틀린다.)

---

## Phase 2 — 테스트 계약 작성 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

> "테스트는 코드의 명세다." 구현 없이 기대 동작을 기술한다.

**작업 순서:**
1. 빈 stub 생성(import 오류 방지)
2. spec/test 작성 — **공개 인터페이스의 동작(결과)을 단언**한다. 내부 구현·private·mock 호출 횟수에 결합하지 말 것(brittle test). test double은 진짜 외부 경계(network·DB·시간·외부 API)에만. 정상 경로 + 예외 + 경계값(빈 입력·중복·null)을 시나리오 리스트대로 커버.
   - **프론트엔드가 있고 AGENTS.md에 프론트 테스트 명령(vitest·jest·RTL·Vue Test Utils 등)이 선언돼 있으면**: 로직 컴포넌트(훅·상태·폼 검증·조건부 렌더 동작)의 **동작 테스트**도 함께 작성. 순수 프레젠테이셔널/비주얼 컴포넌트는 단위 TDD 대상이 아님(e2e + `/qa`로 커버) — `renders a div`류 약한 테스트 금지.
   - **프론트 테스트 명령이 없으면**: 프론트 동작 테스트는 생략하고 빌드 + e2e(Phase 6) + `/qa`로 커버한다 — 단, 프론트 로직이 있으면 테스트 러너 도입을 권고한다.
3. AGENTS.md 테스트 명령으로 실행 → **전부 FAIL(RED) 확인** (의도된 상태, 수정 금지)

완료 후 **작성한 spec/test 파일 경로 목록**·테스트 목록·RED 결과 리포트. 오케스트레이터는 이 spec 파일 목록을 기록한다(Phase 3 잠금 검증용).

### RED 검수 게이트 (오케스트레이터 인라인 — Phase 3 진입 전 필수)
다음을 직접 확인하고 통과해야 Phase 3로 간다:
- (a) 각 테스트가 **약한 단언(truthy·존재만)이나 구현 미러링이 아니라** 실제 동작/계약을 단언하는가
- (b) 정상·예외·경계가 실제로 커버됐는가
- (c) RED 실패 사유가 **AssertionError(기대 동작 미구현)**인가, import/문법 오류가 아닌가

미흡하면 Phase 2로 되돌린다. (별도 에이전트·의존성그래프 분석은 이 규모에 과함 — 인라인 검수로 충분.)
**프론트가 있는 repo면 Phase 3·4 병렬 spawn. 백엔드 전용이면 Phase 3만.**

---

## Phase 3 — (백엔드) 구현 (`subagent_type: general-purpose`, `model: sonnet`, `run_in_background: true`)

Phase 2 spec을 **계약서**로 구현.

> ⛔ **테스트 잠금**: spec/test 파일을 **절대 수정·삭제·약화하지 말 것.** 통과시키려면 오직 구현 코드만 바꾼다. RED가 틀렸다고 판단되면 **멈추고 보고**하라(직접 고치지 말 것).

**작업 순서:**
1. DB 스키마 변경 필요 시 마이그레이션(`/migration-add` 있으면 사용)
2. stub → 실제 구현. **한 번에 한 동작**, 테스트 통과시키는 **최소 코드**(YAGNI). 큰 점프 금지 — 실패하면 가장 작은 단위로 좁힌다.
3. 단위가 GREEN이 될 때마다 **즉시 작은 refactor**(중복 제거).
4. **구현→테스트 루프(최대 3회)**: AGENTS.md 테스트 명령. 3회 실패 시 에러·이력 리포트 후 **즉시 중단**.
5. 회귀 검사: AGENTS.md 품질 명령(lint·test·build)

완료 후 생성 파일·테스트 결과 리포트. **오케스트레이터는 Phase 3 후 `git diff -- <spec 파일들>`로 spec이 변경되지 않았는지 검증**한다(변경됐으면 되돌리고 사유 확인).

---

## Phase 4 — 프론트엔드 구현 (프론트엔드가 있는 repo만, Phase 3와 병렬)

(`subagent_type: general-purpose`, `model: sonnet`, `run_in_background: true`)

프론트 테스트 명령이 있으면 백엔드와 동일하게 **test-first**: Phase 2의 프론트 동작 테스트를 계약으로 구현(⛔ **테스트 잠금** 동일 적용 — 테스트 약화 금지).
1. **구현→테스트 루프(최대 3회)**: AGENTS.md 프론트 테스트 명령으로 동작 테스트 통과까지. 단위 GREEN마다 작은 refactor. *(프론트 테스트 명령 없으면 이 루프 생략.)*
2. **빌드 루프(최대 3회)**: AGENTS.md 프론트 빌드 명령.
3회 실패 시 리포트 후 중단. 완료 후 생성 파일·테스트·빌드 결과 리포트.
(순수 비주얼/레이아웃은 단위 테스트 대신 e2e(Phase 6) + `/qa`로 검증.)

---

## Phase 5 — Refactor (오케스트레이터 직접 실행, **필수**)

> Refactor는 선택이 아니다 — Green에서 생긴 중복·난잡함을 제거하지 않으면 TDD 가치가 무너진다.

전체 구조 검토(AGENTS.md·하위 규약 기준: 불필요한 타입·과도한 책임·중복).

**설계 품질 lens (clean-arch 본질 + SOLID, 규모에 맞게):**
- **의존성 규칙**: 비즈니스/도메인 로직이 IO·프레임워크·UI 세부에 의존하지 않는가(의존성은 안쪽으로). repo가 AGENTS.md(또는 team-harness `clean-architecture.md`)에 선언한 도메인 경계·계층을 위반하지 않는가.
- **SOLID(judicious)**: SRP·DIP 위반이 *실제 복잡도를 키울 때만* 정리. 추측성 추상화·인터페이스 폭발 금지 — 단순함 우선.
- **규모 스케일링**: 작은 모듈에 풀 ports/adapters ceremony 강요 금지(순수주의 배제). 새 코드가 표준으로 수렴하게 하되 기존 코드 대규모 retrofit은 하지 않는다.

수정 후 테스트 재확인(AGENTS.md 테스트 명령) — **테스트는 여기서도 잠금**(동작이 같다면 테스트는 그대로 통과해야 한다).

---

## Phase 6 — E2E + 최종 검증 + 커밋 (오케스트레이터 직접 실행)

1. e2e가 있는 repo면 핵심 시나리오 1~3개 추가
2. 최종 검증: AGENTS.md 전체 품질 명령
3. 커밋 — 메시지 형식은 AGENTS.md `커밋 메시지` 규약을 따른다:
   ```bash
   git add <변경 디렉터리>
   git commit -m "feat($FEATURE_NAME): $DESCRIPTION ..."
   ```

브랜치는 develop에 머지하지 않는다 — 사용자 확인 후 `/feature-merge`. (`/plan`으로 여러 태스크로 분해된 기능이면 **모든 태스크 완료 후** 한 번에 `/feature-merge` — 한 기능=한 PR.)

---

## Phase 7 — Act: 회고 (오케스트레이터 직접 실행)

테스트 계약이 충분했는지·반복 오류 패턴·하네스 개선 제안을 간략 검토한다.
프로젝트 상태·백로그·작업로그·결정·도메인 지식은 로컬 메모리에 저장하지 않는다.
팀이 알아야 할 하네스 개선 제안은 GitHub Issue 또는 `docs/decisions.md`/관련 표준 문서에 남기고,
로컬 메모리는 팀 공유가 필요 없는 개인 작업습관·행동교정에만 최소로 쓴다. 없으면 생략.

---
description: TDD로 기존 기능 수정 — 변경분만 RED, 나머지 GREEN 유지 (stack-agnostic)
argument-hint: <feature-name> "<변경 설명>"
---

# /feature-modify — TDD 기반 기존 기능 수정

**사용법**: `/feature-modify <feature-name> "<변경 설명>"`
예) `/feature-modify chat "응답에 출처 링크 포함"`

> 변경된 동작만 RED로 만들고, 나머지는 GREEN을 유지한 채 구현한다. **테스트는 변경 불가 계약**이다.
> **TDD는 로직(백엔드 + 프론트 로직: 훅·상태·검증·조건부 동작)의 정확성을 본다 — 층 무관.** 프론트 비주얼·접근성은 직교한 `/qa`가 본다. 순수 비주얼은 e2e + `/qa`로.

> **스택 의존 값은 repo의 `AGENTS.md`에서 읽는다**(테스트·품질·빌드 명령, 소스 디렉터리, 프론트 유무). 프론트가 없는 repo는 프론트 단계 생략.

---

## 완료 기준 (Definition of Done) — 통과까지 루프한다

아래가 **모두** 충족돼야 완료. 미충족이면 해당 Phase로 루프(구현 루프 3회 실패 시 중단·보고):

| # | 기준 | 검증 방법 |
|---|---|---|
| 1 | 변경 동작 테스트 GREEN **+ 유지 테스트 전부 PASS**(회귀 없음) | AGENTS.md 테스트 명령 `exit 0` |
| 2 | 유지(잠금) 테스트가 변경되지 않음(테스트 무결성) | `git diff -- <잠금 테스트>` 빈 결과 |
| 3 | 전체 품질(lint·test·build) 통과 | AGENTS.md 전체 품질 명령 `exit 0` |
| 4 | 외과적 — 변경 요청 외 코드 미수정 | 변경 파일 목록 검토 |
| 5 | Refactor 완료 후 테스트 재통과 | 재실행 `exit 0` |

프론트 로직 변경이면 1·5는 프론트 동작 테스트에도 적용. 비주얼·a11y는 `/qa` 별도 축.

---

## Phase 0 — 진입 전 점검 (오케스트레이터 직접 실행)

```bash
git checkout develop && git pull origin develop
```
기존 spec/test 파일 존재 확인 — 없으면 Phase 2에서 feature-add 방식으로 새로 작성한다.

---

## Phase 1 — 영향 범위 분석 (오케스트레이터 직접 실행)

$ARGUMENTS에서 도출: 수정 범위(영향 파일), **변경할 기존 테스트 vs 유지할 테스트**(목록으로 명확히), DB 스키마 변경 여부, 브랜치 전략:
- 기능 확장 → `feature/$FEATURE_NAME-update`, 커밋 타입 `feat`
- 버그 수정 → `fix/$FEATURE_NAME`, 커밋 타입 `fix`

```bash
git checkout -b <결정된 브랜치명>
```
분석 결과(특히 **유지 테스트 = 잠금 목록**)를 Phase 2·3 프롬프트에 명시적으로 포함한다.

---

## Phase 2 — 테스트 계약 갱신 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

**작업 순서:**
1. spec이 없었으면 feature-add Phase 2 방식으로 새로 작성(공개 동작 단언·classicist 기본).
2. 있으면: **변경 동작만** 케이스 수정/추가, **유지 동작은 기존 테스트 그대로 보존**.
3. AGENTS.md 테스트 명령 실행 → **변경된 테스트만 FAIL(RED), 유지 테스트는 PASS** 확인.

완료 후 변경 테스트 목록·**유지(잠금) 테스트 목록**·RED 결과 리포트.

### RED 검수 게이트 (오케스트레이터 인라인 — Phase 3 진입 전 필수)
- 변경 테스트가 약한 단언·구현 미러링이 아니라 실제 새 동작을 단언하는가
- RED 사유가 AssertionError인가(import/문법 오류 아님)
- **유지 테스트가 진짜 PASS인가**(변경이 기존 동작을 깨지 않았는지 사전 확인)

미흡하면 Phase 2로 되돌린다.
**프론트 영향 있으면 Phase 4는 Phase 3 완료 후 순차(API 변경 의존이라 병렬 불가).**

---

## Phase 3 — (백엔드) 수정 (`subagent_type: general-purpose`, `model: sonnet`, `run_in_background: true`)

> ⛔ **테스트 잠금**: 어떤 테스트도 추가로 수정·삭제하지 말 것. 변경 테스트는 Phase 2에서 이미 갱신됐고, **유지(잠금) 목록 테스트는 불가침**이다. 통과시키려면 구현 코드만 바꾼다. 테스트가 틀렸다고 판단되면 멈추고 보고.

1. DB 스키마 변경 필요 시 마이그레이션
2. **구현→테스트 루프(최대 3회)**: AGENTS.md 테스트 명령. 한 번에 한 동작·최소 수정. 단위 GREEN마다 작은 refactor. 3회 실패 시 리포트 후 중단.
3. **회귀 검사**: AGENTS.md 품질 명령 — 유지 테스트가 새로 실패하면 회귀, 반드시 수정(테스트가 아니라 구현을).

완료 후 수정 파일·전체 테스트 결과 리포트. **오케스트레이터는 `git diff -- <잠금 테스트들>`로 유지 테스트가 변경되지 않았는지 검증**한다.

---

## Phase 4 — 프론트엔드 수정 (영향받는 경우만, Phase 3 완료 후 순차)

(`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

**외과적 수정** — 변경 요청과 직접 관련된 파일만. 로직 변경이면 **test-first**(Phase 2에서 갱신한 프론트 동작 테스트를 계약으로, ⛔ 테스트 잠금):
1. **구현→테스트 루프(최대 3회)**: AGENTS.md 프론트 테스트 명령.
2. **빌드 루프(최대 3회)**: AGENTS.md 프론트 빌드 명령.
3회 실패 시 리포트 후 중단. (순수 비주얼 변경은 e2e + `/qa`로 검증.)

---

## Phase 5 — Refactor (오케스트레이터 직접 실행, **필수**)

변경 요청 외 코드를 건드리지 않았는지(외과적 원칙) 검토.

**설계 품질 lens (clean-arch 본질 + SOLID, 규모에 맞게):**
- **의존성 규칙**: 변경이 비즈니스/도메인 로직을 IO·프레임워크·UI에 결합시키지 않는가. repo가 AGENTS.md(또는 team-harness `clean-architecture.md`)에 선언한 도메인 경계·계층을 위반하지 않는가.
- **SOLID(judicious)**: SRP·DIP 위반이 *실제 복잡도를 키울 때만* 정리. 추측성 추상화 금지 — 단순함 우선. (외과적 원칙과 충돌하면 외과적 우선, 설계 개선은 별도 작업으로 분리.)

테스트 재확인(AGENTS.md 테스트 명령). **유지 테스트가 구현 결합 때문에 깨졌다면 그것은 brittle test 신호** — 테스트를 약화하지 말고, 동작 기준 단언으로 고치는 것은 별도 작업으로 분리해 보고한다.

---

## Phase 6 — E2E + 최종 검증 + 커밋 (오케스트레이터 직접 실행)

1. 변경 동작에 대한 e2e 추가/수정(있는 repo)
2. 최종 검증: AGENTS.md 전체 품질 명령
3. 커밋 — Phase 1에서 결정한 타입 + AGENTS.md `커밋 메시지` 규약:
   ```bash
   git add <변경 디렉터리>
   git commit -m "<타입>($FEATURE_NAME): $DESCRIPTION ..."
   ```

브랜치는 develop에 머지하지 않는다 — 사용자 확인 후 `/feature-merge`.

---

## Phase 7 — Act: 회고 (오케스트레이터 직접 실행)

영향 분석이 실제 범위와 일치했는지·회귀 테스트 충분성·하네스 개선을 간략 검토하고, 의미있는 인사이트만 메모리에 저장. 없으면 생략.

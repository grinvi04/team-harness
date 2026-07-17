---
name: loop
description: 반복 수정으로 명령 exit 0을 달성해야 할 때 사용. CI·lint·기존 테스트·의존성 정리에 적합하며 신규 기능·불명확한 설계·시간 예약 polling은 제외
argument-hint: "\"<작업 설명>\" \"<통과 기준 명령>\" [--max <N=5>] [--timeout <초=300>] [--no-commit]"
effort: high
---

# /loop — 조건 기반 자율 수정 루프

**사용법**: `/loop "<작업 설명>" "<통과 기준 명령>" [--max <N>] [--timeout <초>] [--no-commit]`

예)
```
/loop "모든 lint 에러 수정" "npm run lint"
/loop "백엔드 테스트 전부 통과" "cd backend && ./gradlew test"
/loop "프론트 타입 에러 제거" "npm run type-check" --max 10
/loop "CI 가장 최근 실패 재현·수정" "gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId')"
/loop "의존성 취약점 해소" "npm audit --audit-level=high" --no-commit
```

> **Claude Code 내장 `/loop`와의 구분**:
> 내장 `/loop`는 `ScheduleWakeup` 기반 **비동기 예약 재실행** — "N분 뒤 같은 프롬프트를 다시 실행"하는 세션 재스케줄링 도구다.
> 이 `/loop`는 **동기 조건-루프** — 한 세션 안에서 통과 기준 명령이 exit 0될 때까지 즉시 반복하는 수정 자동화 도구다.
> 시간 간격 폴링·예약 재실행이 필요하면 내장 `/loop`를 써라.
>
> **`/loop`의 목적**: 반복 실행이 필요한 수정 작업을 자율적으로 처리한다.
> 각 반복마다 ONE 타깃 수정 → 통과 기준 검증 → 체크포인트 커밋(기본값) → 다음 반복.
> 기능 개발(Red→Green→Refactor)은 이 커맨드가 아니라 `/feature-add`가 담당한다.
> 자연어 맥락에서 자동 선택된 **implicit invocation**은 commit 권한을 새로 만들지 않는다.
> 사용자가 현재 요청에서 commit을 명시적으로 요청하지 않았다면 `--no-commit`과 동일하게 실행한다.
>
> **이 커맨드를 쓰지 말아야 할 때**:
> - 새 기능 개발 → `/feature-add`
> - 명세된 태스크 실행 → 승인된 `/plan` 스펙의 각 태스크를 `/feature-add`로
> - 설계 없이 대규모 리팩터링 → `/plan`으로 먼저 범위를 잡는다
> - 시간 간격 폴링 → 내장 `/loop`

---

## 안전 장치 (기업 환경 기본값)

| 장치 | 기본값 | 설명 |
|---|---|---|
| `--max N` | 5 | 최대 반복 횟수. 도달 시 중단 후 잔여 이슈 리포트 |
| stuck 감지 | 2회 연속 무변경 | 수정 없이 같은 결과가 반복되면 즉시 중단 |
| 명령 timeout | 300초 | 검증 명령과 worktree fingerprint가 멈춰 전체 루프를 무기한 점유하는 것을 차단 (`--timeout`) |
| 체크포인트 커밋 | 명시적 `/loop`는 반복마다, implicit는 끔 | 각 반복 후 진행 상태 보존. implicit invocation은 현재 요청의 명시적 commit 허가가 있어야 활성화 |
| 실패 임계 | max 도달 | 잔여 이슈 목록 + 권장 수동 조치 리포트 |

---

## Phase 0 — 사전 검증 (오케스트레이터 직접 실행)

### 0-0. 인수 파싱·commit 권한 결정

`$ARGUMENTS`에서:
- `GOAL` ← 첫 번째 따옴표 문자열 (작업 설명)
- `EXIT_CMD` ← 두 번째 따옴표 문자열 (통과 기준 명령)
- `MAX_ITER` ← `--max` 뒤 숫자 (없으면 기본값 5)
- `TIMEOUT_SECONDS` ← `--timeout` 뒤 숫자 (없으면 기본값 300)
- `NO_COMMIT` ← `--no-commit` 플래그 유무

호출 방식에 따라 commit 권한을 결정한다.
- 사용자가 `/loop`를 명시적으로 호출하면 `--no-commit` 유무를 그대로 따른다.
- 자연어 맥락으로 선택된 **implicit invocation이면**, 사용자가 현재 요청에서 commit을 명시적으로 요청하지
  않은 한 `NO_COMMIT=true`로 둔다.
- implicit invocation 도중 commit으로 전환하려면 첫 체크포인트 전에 멈추고 사용자에게 명시적 승인을 받는다.

```
MAX_ITER 유효 범위: 1~20. 범위 초과 시 에러 출력 후 중단.
TIMEOUT_SECONDS 유효 범위: 1~3600 정수. 범위 초과 시 에러 출력 후 중단.
```

**`GOAL` 또는 `EXIT_CMD`가 없으면 즉시 중단**:
```
❌ /loop 인수 오류
사용법: /loop "<작업 설명>" "<통과 기준 명령>" [--max N]
예)   /loop "lint 에러 수정" "npm run lint"
```

### 0-1. 작업 브랜치 확인 (K4)

체크포인트 커밋은 `develop`/`main`에서 guard에 차단된다(진행 보존 불가). commit이 활성화된 루프는
**작업 브랜치(feature/fix/…)** 에서 돌려야 한다.

```bash
BR=$(git branch --show-current 2>/dev/null)
if { [ "$BR" = "develop" ] || [ "$BR" = "main" ]; } && [ "$NO_COMMIT" != "true" ]; then
  echo "⛔ /loop 는 보호 브랜치($BR)에서 체크포인트 커밋을 못 한다. 작업 브랜치로 전환 후 재실행하거나 --no-commit 을 쓰세요."; exit 1
fi
```
> `--no-commit` 또는 commit 권한 없는 implicit invocation은 보호 브랜치에서도 실행 가능하나, 진행이
> 커밋으로 보존되지 않는다.

### 0-2. 초기 상태 점검

```bash
# 미커밋 변경사항 확인
git status --short
```

미커밋 변경사항이 있으면 **사용자에게 확인**한다. 체크포인트가 활성화된 경우:
```
⚠️ 미커밋 변경사항이 있습니다.
  /loop는 반복마다 체크포인트 커밋을 생성합니다.
  계속하면 현재 변경사항이 첫 커밋에 포함됩니다. 진행하시겠습니까?
```
- 확인 시: 계속 진행
- 거부 시: "먼저 커밋·stash 후 재실행하세요." 출력 후 중단

`NO_COMMIT=true`이면 기존 변경을 커밋하지는 않지만, 루프 수정과 섞일 수 있음을 알리고 계속할지 확인한다.

### 0-3. 통과 기준 즉시 실행

```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}"
node "$PLUGIN_ROOT/scripts/run-with-timeout.mjs" --seconds "$TIMEOUT_SECONDS" -- "$EXIT_CMD"
```

**이미 통과(exit 0)이면 즉시 종료**:
```
✅ 이미 통과 — 수정 불필요
  통과 기준: $EXIT_CMD
  반복 0회
```

**실패(exit non-0)이면 Phase 1로 진행.**

---

## Phase 1 — 컨텍스트 분석 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

**프롬프트:**
- 작업 목표: `$GOAL`
- 통과 기준 명령: `$EXIT_CMD`
- 현재 오류 출력 (Phase 0-3의 exit command 결과):

  ```
  <Phase 0-3 오류 출력 전체>
  ```

- AGENTS.md를 읽어 프로젝트 구조·디렉터리를 파악한다.
- 오류의 **근본 원인을 분류**하라:
  1. **유형**: (lint 위반 / 타입 에러 / 테스트 실패 / 빌드 오류 / 보안 취약점 / 기타)
  2. **범위**: 영향받는 파일 목록 (최대 20개 — 초과하면 "20개 초과, 파일 패턴으로 요약")
  3. **반복 추정**: 이 유형의 수정에 예상되는 반복 횟수 (근거 포함)
  4. **전략**: 반복당 처리할 수정 단위 (예: "파일 단위로 순서대로", "오류 유형별로 분류 후")
  5. **금지 사항**: 이 수정에서 건드리면 안 되는 파일/섹션 (테스트 파일, 마이그레이션 파일 등)
- 반환 형식: 위 1~5 항목을 명시.

오케스트레이터는 이 결과를 기록하고 Phase 2 반복 프롬프트에 포함한다.

---

## Phase 2 — 반복 루프 (오케스트레이터 직접 제어)

루프 상태 변수:
```
ITER=0            # 현재 반복 횟수
STUCK=0           # 연속 무변경 횟수
PASS=false        # 통과 기준 달성 여부
FIXED_FILES=""    # 줄바꿈으로 구분한 누적 수정 파일 목록
```

**루프 조건**: `PASS=false AND ITER < MAX_ITER`

---

### Phase 2a — 단일 반복 실행 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

각 반복마다 아래 프롬프트로 에이전트를 spawn한다 (반드시 **foreground**, 이전 결과가 다음 프롬프트에 포함돼야 한다).

에이전트 spawn **직전** 오케스트레이터는 stuck 감지용 기준 지문(이번 반복 시작 시 워킹트리 상태)을 캡처한다:
```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}"
ITER=$((ITER+1))
TREE_BEFORE=$(
  node "$PLUGIN_ROOT/scripts/run-with-timeout.mjs" --seconds "$TIMEOUT_SECONDS" -- \
    "node \"$PLUGIN_ROOT/scripts/worktree-fingerprint.mjs\" --repo ."
)
FINGERPRINT_EXIT=$?
if [ "$FINGERPRINT_EXIT" -ne 0 ]; then
  echo "⛔ 반복 전 worktree fingerprint 실패 또는 timeout($FINGERPRINT_EXIT) — 안전한 stuck 판정 불가"
  break  # Phase 3 (중단)으로
fi
```

**프롬프트 (반복마다 갱신):**

```
작업 목표: $GOAL
통과 기준: $EXIT_CMD
반복: $ITER / $MAX_ITER

## 컨텍스트 (Phase 1 분석 결과)
<Phase 1 결과 전체>

## 현재 오류 출력
<직전 $EXIT_CMD 실행 결과 전체>

## 이전 반복 수정 이력
<FIXED_FILES — 누적 수정 파일 목록>

## 지침

1. 현재 오류를 읽고 **가장 영향이 큰 ONE 수정 단위**를 선택하라.
   - 오류가 여러 유형이면 **같은 유형**의 것을 먼저 묶어서 처리 (한 반복에 두 유형 혼합 금지)
   - 파일 단위 처리가 명확하면 파일 1~3개를 한 반복에 처리해도 된다
2. 금지: 테스트 파일 수정, 마이그레이션 파일 수정, 기존 동작 변경(오류 수정 이외)
3. 금지: 오류를 suppress/ignore로 우회 (예: `// eslint-disable`, `@Suppress`, `any` 캐스팅으로 타입 에러 은폐)
4. 수정 후 `$EXIT_CMD`를 **직접 실행하지 않는다** — 오케스트레이터가 검증한다.
5. 수정한 파일 목록을 반환한다 (없으면 "수정 없음").
```

---

### Phase 2b — 반복 후 검증 (오케스트레이터 직접 실행)

```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}"

# 수정 파일 목록 확인
CHANGED=$(git status --short)

TREE_AFTER=$(
  node "$PLUGIN_ROOT/scripts/run-with-timeout.mjs" --seconds "$TIMEOUT_SECONDS" -- \
    "node \"$PLUGIN_ROOT/scripts/worktree-fingerprint.mjs\" --repo ."
)
FINGERPRINT_EXIT=$?
if [ "$FINGERPRINT_EXIT" -ne 0 ]; then
  echo "⛔ 반복 후 worktree fingerprint 실패 또는 timeout($FINGERPRINT_EXIT) — 안전한 stuck 판정 불가"
  break  # Phase 3 (중단)으로
fi

# 최신 통과 기준을 먼저 확인한다. 외부 CI 상태가 바뀐 경우 worktree가 같아도 성공할 수 있다.
node "$PLUGIN_ROOT/scripts/run-with-timeout.mjs" --seconds "$TIMEOUT_SECONDS" -- "$EXIT_CMD"
EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  PASS=true
fi

# stuck 감지 — 커밋 여부와 무관하게 '이번 반복이 워킹트리를 실제로 바꿨는가'로 판정(#198).
# 성공 판정 뒤에 수행해 외부 상태 변화의 통과를 무변경 중단이 가리지 않게 한다.
if [ "$TREE_AFTER" = "$TREE_BEFORE" ]; then
  STUCK=$((STUCK+1))
  if [ "$PASS" != "true" ] && [ "$STUCK" -ge 2 ]; then
    # Phase 3 (중단 — stuck)으로
    break
  fi
else
  STUCK=0
  # git status --short의 상태 3문자를 제거하고 경로를 중복 없이 누적한다.
  while IFS= read -r STATUS_LINE; do
    [ -z "$STATUS_LINE" ] && continue
    FILE_PATH="${STATUS_LINE#???}"
    if ! printf '%s\n' "$FIXED_FILES" | grep -Fqx -- "$FILE_PATH"; then
      FIXED_FILES="${FIXED_FILES}${FIXED_FILES:+$'\n'}${FILE_PATH}"
    fi
  done <<< "$CHANGED"
fi
```

**통과(exit 0)**이면:
- `PASS=true` → Phase 2c에서 성공 체크포인트를 처리한 뒤 Phase 3(성공)으로

**실패(exit non-0, timeout은 124)**이면:
- Phase 2c에서 현재 반복 체크포인트를 처리한 뒤 분기한다.
- `ITER >= MAX_ITER`이면 Phase 3(max 도달)으로
- 아니면 Phase 2a로 돌아간다

---

### Phase 2c — 체크포인트 커밋 (오케스트레이터 직접 실행, `--no-commit`이 아니면)

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ -n "$(git -C "$REPO_ROOT" status --porcelain=v1)" ] && [ "$NO_COMMIT" != "true" ]; then
  git -C "$REPO_ROOT" add -A -- .
  if [ "$PASS" = "true" ]; then
    git commit -m "fix(loop): 반복 수정 완료" \
      -m "이유: $GOAL 통과 기준을 충족한 상태를 보존"
  else
    git commit -m "fix(loop): 반복 수정 ${ITER}차 반영" \
      -m "이유: $GOAL 통과 기준 달성을 위한 중간 상태를 보존"
  fi
fi
```

공용 skill은 특정 AI 이름·모델의 `Co-Authored-By`를 만들지 않는다. 실행 도구가 실제 작성자 정보를
제공한 경우에만 그 도구의 공식 trailer를 유지한다.

> 체크포인트 커밋은 롤백 단위다 — 루프가 중간에 끊어져도 진행 상태가 보존된다.
> `git revert <커밋>`으로 특정 반복의 수정만 되돌릴 수 있다.

---

## Phase 3 — 종료 처리 (오케스트레이터 직접 실행)

루프 종료 사유에 따라 분기한다.

### 성공 (`PASS=true`)

마지막 반복에서 변경이 있었다면 Phase 2c가 성공 체크포인트를 이미 만들었다. `--no-commit` 또는 commit
권한 없는 implicit invocation이면 검증된 변경을 작업트리에 그대로 둔다.

출력:
```
✅ /loop 완료
- 목표: $GOAL
- 통과 기준: $EXIT_CMD
- 반복: $ITER / $MAX_ITER
- 수정 파일: N개
  <FIXED_FILES 목록>
```

### Stuck 감지 (`STUCK >= 2`)

에이전트가 2회 연속 수정을 만들지 못했다 — 수동 개입이 필요하다.

```
⚠️ /loop 중단 — 진행 불가
  사유: $ITER회 반복 후 수정 없이 2회 연속 실패 (stuck)
  반복: $ITER / $MAX_ITER

통과 기준 최신 오류:
<마지막 $EXIT_CMD 출력>

권장 조치:
  1. 오류를 직접 확인하고 수동으로 수정한다.
  2. 외부 의존성(설치 필요 패키지, 환경 변수)이 문제라면 환경을 먼저 고친다.
  3. 수정 후 /loop을 다시 실행하거나 직접 처리한다.
```

### Max 도달 (`ITER >= MAX_ITER`)

```
⚠️ /loop 최대 반복 도달
  반복: $MAX_ITER / $MAX_ITER
  목표: $GOAL
  통과 기준: $EXIT_CMD

## 완료된 수정
<FIXED_FILES 누적 목록 — 반복당 커밋으로 이미 보존됨>

## 잔여 이슈
<마지막 $EXIT_CMD 실패 출력>

권장 조치:
  A. /loop "$GOAL" "$EXIT_CMD" --max <N> 로 추가 반복 (현재 진행 상태에서 이어짐)
  B. 잔여 이슈를 직접 확인하고 수동 처리
  C. 근본 원인이 구조적 문제라면 /plan으로 재설계
```

> `--max` 없이 재실행하면 기존 체크포인트 커밋 위에서 이어진다 — 처음부터 시작하지 않는다.

---

## 사용 패턴 참고

### 패턴 A — CI 통과 루프

```bash
/loop "CI 실패 수정" "gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId')" --max 3
```

> CI 완료까지 시간이 걸리므로 max를 낮게 유지한다.
> CI 실패 로그: `gh run view --log-failed`로 확인.

### 패턴 B — 정적 분석 클린업

```bash
/loop "모든 checkstyle 위반 수정" "cd backend && ./gradlew checkstyleMain" --max 10
/loop "ESLint 에러 수정" "cd frontend && npm run lint" --max 8
```

> 파일 수가 많으면 오류 유형별로 분류해 반복한다 — 에이전트가 자동으로 그룹화한다.

### 패턴 C — 의존성 취약점

```bash
/loop "npm 취약점 해소" "npm audit --audit-level=high" --max 5 --no-commit
```

> `--no-commit`: 의존성 변경이 연쇄 영향을 줄 수 있어 검토 후 수동 커밋.
> 루프 종료 후 `npm test`로 회귀를 확인한다.

### 패턴 D — 테스트 수정

```bash
/loop "실패 테스트 전부 통과" "cd backend && ./gradlew test" --max 7
```

> 테스트 파일 수정 금지 — 구현 코드만 수정한다.
> 테스트가 잘못 작성됐다고 판단되면 루프를 중단하고 `/feature-modify`로 처리한다.

---

## 이 커맨드를 쓰지 말아야 할 때

| 상황 | 대신 쓸 커맨드 |
|---|---|
| 신규 기능 구현 | `/feature-add` |
| 기존 기능 수정 | `/feature-modify` |
| 범위가 불명확한 작업 | `/plan`으로 먼저 정의 |
| 보안 취약점 패치 (운영 중단 수준) | `/hotfix` |
| 대규모 리팩터링 | `/plan` → `/feature-modify` |

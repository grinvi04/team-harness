---
name: loop
description: 반복 수정으로 명령 exit 0을 달성해야 할 때 사용. CI·lint·기존 테스트·의존성 정리에 적합하며 신규 기능·불명확한 설계·시간 예약 polling은 제외
argument-hint: "\"<작업 설명>\" \"<통과 기준 명령>\" [--max <N=5>] [--timeout <초=300>] [--no-commit]"
---

# /loop — 조건 기반 자율 수정 루프

스크립트 실행 전 [현재 스킬 경로 검증](../../runtime-path.md)을 각 도구 호출에서 적용한다.

**사용법**: `/loop "<작업 설명>" "<통과 기준 명령>" [--max <N>] [--timeout <초>] [--no-commit]`

예)
```
/loop "모든 lint 에러 수정" "npm run lint"
/loop "백엔드 테스트 전부 통과" "cd backend && ./gradlew test"
/loop "프론트 타입 에러 제거" "npm run type-check" --max 10
/loop "CI 가장 최근 실패 재현·수정" "gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId')"
/loop "의존성 취약점 해소" "npm audit --audit-level=high" --no-commit
```

일반 수정·디버깅은 선택한 방법론 하나를 따른다. 이 연결은 timeout·fingerprint·exit 증거와
반복 중단·체크포인트 계약만 더한다. 새 기능·설계가 불명확한 변경에는 사용하지 않는다.
예약 재실행은 현재 플랫폼의 자동화 도구를 사용하며 이 스킬과 같은 동기 수정 루프로 취급하지 않는다.
자연어 맥락의 implicit invocation은 commit 권한을 새로 만들지 않는다.
사용자가 현재 요청에서 commit을 명시적으로 요청하지 않았다면 `--no-commit`으로 실행한다.

---

## 반복의 안전 장치

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
PLUGIN_ROOT="${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}"
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

## Phase 1 — 컨텍스트 분석

Phase 1 실행 **전에** [분석 프롬프트·사용 패턴](analysis-and-patterns.md)을 읽고 전체 분석 결과를 Phase 2에 전달한다.

## Phase 2 — 반복 루프 (오케스트레이터 직접 제어)

**Phase 2에 들어가기 전에** [반복 전체 절차](iteration.md)를 읽는다.

루프 상태 변수:
```
ITER=0            # 현재 반복 횟수
STUCK=0           # 연속 무변경 횟수
PASS=false        # 통과 기준 달성 여부
FINGERPRINT_ERROR="" # fingerprint 실패 위치·종료코드 (없으면 빈 문자열)
FIXED_FILES=""    # 줄바꿈으로 구분한 누적 수정 파일 목록
```

**루프 조건**: `PASS=false AND ITER < MAX_ITER`

---

### Phase 2a — 단일 반복 실행

현재 담당자가 직접 실행한다. 필요한 위임이 허용된 경우에만 순서대로 나누고 이전 결과를 전달한다.

수정 **직전** 오케스트레이터는 stuck 감지용 기준 지문(이번 반복 시작 시 워킹트리 상태)을 캡처한다:
```bash
PLUGIN_ROOT="${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}"
ITER=$((ITER+1))
TREE_BEFORE=$(
  node "$PLUGIN_ROOT/scripts/run-with-timeout.mjs" --seconds "$TIMEOUT_SECONDS" --argv -- \
    node "$PLUGIN_ROOT/scripts/worktree-fingerprint.mjs" --repo .
)
FINGERPRINT_EXIT=$?
if [ "$FINGERPRINT_EXIT" -ne 0 ]; then
  FINGERPRINT_ERROR="반복 전 fingerprint 종료코드=$FINGERPRINT_EXIT"
  echo "⛔ 반복 전 worktree fingerprint 실패 또는 timeout($FINGERPRINT_EXIT) — 안전한 stuck 판정 불가"
  break  # Phase 3 (중단)으로
fi
```

**Phase 2 실행 전에** [반복 프롬프트와 Phase 2b·2c 전체 절차](iteration.md)를 읽는다. 반복 전후 지문 실패 시 추가 반복·체크포인트 없이 Phase 3으로 간다.

### Phase 2b — 반복 후 검증 (오케스트레이터 직접 실행)

[실제 timeout·fingerprint 판정 명령](iteration.md)을 실행하며 prose 요약으로 대체하지 않는다.

### Phase 2c — 체크포인트 커밋 (오케스트레이터 직접 실행, `--no-commit`이 아니면)

[커밋 경계](iteration.md)를 따른다. `--no-commit`이면 체크포인트를 만들지 않는다.

## Phase 3 — 종료 처리 (오케스트레이터 직접 실행)

Phase 3 판정·보고 **전에** [종료 분기와 보고 형식](completion.md)을 읽는다. Fingerprint 실패는 안전한 stuck 판정이 불가능하므로 추가 반복이나 체크포인트 없이 실패로 종료한다.

## 사용 패턴 참고

목표·명령을 정할 때 [패턴과 비적용 사례](analysis-and-patterns.md)를 읽는다.

## 이 커맨드를 쓰지 말아야 할 때

적용 여부는 목표·명령 확정 **전에** [비적용 표](analysis-and-patterns.md)를 읽어 판단한다.

# Loop 종료 판정과 사용자 보고

[상위 문서](SKILL.md)로 돌아간다. 아래는 원문의 해당 주제 본문을 순서대로 보존한 실행 계약이다. 상위 문서와 함께 적용한다.

## Phase 3 — 종료 처리 (오케스트레이터 직접 실행)

루프 종료 사유에 따라 분기한다.

### Fingerprint 실패 (`FINGERPRINT_ERROR`가 비어 있지 않음)

안전한 stuck 판정을 만들 수 없으므로 추가 반복이나 체크포인트 없이 실패로 종료한다.

```
⛔ /loop 중단 — worktree fingerprint 실패
  사유: $FINGERPRINT_ERROR
  반복: $ITER / $MAX_ITER

권장 조치:
  1. 대용량·변경 중인 untracked 파일과 파일 권한을 확인한다.
  2. 필요하면 --timeout 값을 조정한 뒤 /loop을 다시 실행한다.
```

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

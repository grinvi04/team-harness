# Loop 반복 프롬프트·판정·체크포인트

[상위 문서](SKILL.md)로 돌아간다. 각 shell 호출은 [경로 검증](../../runtime-path.md)을 먼저 적용한다. 아래는 원문의 해당 주제 본문을 순서대로 보존한 실행 계약이다. 상위 문서와 함께 적용한다.

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
PLUGIN_ROOT="${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}"

# 수정 파일 목록 확인
CHANGED=$(git status --short)

TREE_AFTER=$(
  node "$PLUGIN_ROOT/scripts/run-with-timeout.mjs" --seconds "$TIMEOUT_SECONDS" --argv -- \
    node "$PLUGIN_ROOT/scripts/worktree-fingerprint.mjs" --repo .
)
FINGERPRINT_EXIT=$?
if [ "$FINGERPRINT_EXIT" -ne 0 ]; then
  FINGERPRINT_ERROR="반복 후 fingerprint 종료코드=$FINGERPRINT_EXIT"
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

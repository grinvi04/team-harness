#!/bin/bash
# tests/route-intent-test.sh — route-intent.mjs 시나리오 테스트 (RED)
# 로컬·CI 동일 실행: bash tests/route-intent-test.sh
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/plugins/harness-guard/scripts/route-intent.mjs"
PASS=0; FAIL=0

# check_grep desc pattern [--explain flags...]
# --explain 모드 출력에서 JSON 패턴을 단언한다 (패턴이 있어야 PASS).
check_grep() {
  local desc="$1" pat="$2"
  shift 2
  local out
  out=$(node "$SCRIPT" --explain "$@" 2>/dev/null)
  if echo "$out" | grep -q "$pat"; then
    echo "PASS: $desc"; PASS=$((PASS+1))
  else
    echo "FAIL: $desc — '$pat' 없음 | 출력: $out"; FAIL=$((FAIL+1))
  fi
}

# check_no_grep desc pattern [--explain flags...]
# 패턴이 출력에 없어야 PASS — inject=false 등 비-트리거 단언용.
check_no_grep() {
  local desc="$1" pat="$2"
  shift 2
  local out
  out=$(node "$SCRIPT" --explain "$@" 2>/dev/null)
  if ! echo "$out" | grep -q "$pat"; then
    echo "PASS: $desc"; PASS=$((PASS+1))
  else
    echo "FAIL: $desc — '$pat' 존재(없어야 함) | 출력: $out"; FAIL=$((FAIL+1))
  fi
}

# ── AC-1: 상태별 올바른 skill ──────────────────────────────────────────────
echo "=== AC-1: 상태별 올바른 skill ==="

# AC-1a: openPR 존재 + isSolo=false → pr-review-gate
check_grep "AC-1a: openPR+notSolo → skill=pr-review-gate" \
  '"skill":"pr-review-gate"' \
  --prompt "진행해" --branch "feature/x" --open-pr 5

# AC-1b: openPR 존재 + isSolo=true → solo-merge
check_grep "AC-1b: openPR+solo → skill=solo-merge" \
  '"skill":"solo-merge"' \
  --prompt "진행해" --branch "feature/x" --open-pr 5 --solo

# AC-1c: feature 브랜치 + committed + openPR 없음 → feature-merge
check_grep "AC-1c: feature+committed+noPR → skill=feature-merge" \
  '"skill":"feature-merge"' \
  --prompt "진행해" --branch "feature/x" --committed

# AC-1d: hasSpec + develop(비-feature) 브랜치 → feature-add
check_grep "AC-1d: hasSpec+develop → skill=feature-add" \
  '"skill":"feature-add"' \
  --prompt "진행해" --branch "develop" --has-spec

# ── AC-2: 액션어블 감지 (오버트리거 0) ────────────────────────────────────
echo ""
echo "=== AC-2: 액션어블 감지 (오버트리거 0) ==="

# AC-2a: "진행해" + openPR → inject=true AND skill=pr-review-gate (복합 단언)
out_2a=$(node "$SCRIPT" --explain --prompt "진행해" --branch "feature/x" --open-pr 5 2>/dev/null)
if echo "$out_2a" | grep -q '"inject":true' && echo "$out_2a" | grep -q '"skill":"pr-review-gate"'; then
  echo "PASS: AC-2a: 진행해 → inject=true+skill=pr-review-gate"; PASS=$((PASS+1))
else
  echo "FAIL: AC-2a: 진행해 → inject=true+skill=pr-review-gate 없음 | 출력: $out_2a"; FAIL=$((FAIL+1))
fi

# AC-2b: "해줘" + openPR → inject=true AND skill=pr-review-gate
out_2b=$(node "$SCRIPT" --explain --prompt "해줘" --branch "feature/x" --open-pr 5 2>/dev/null)
if echo "$out_2b" | grep -q '"inject":true' && echo "$out_2b" | grep -q '"skill":"pr-review-gate"'; then
  echo "PASS: AC-2b: 해줘 → inject=true+skill=pr-review-gate"; PASS=$((PASS+1))
else
  echo "FAIL: AC-2b: 해줘 → inject=true+skill=pr-review-gate 없음 | 출력: $out_2b"; FAIL=$((FAIL+1))
fi

# AC-2c: "머지해" + openPR → inject=true AND skill=pr-review-gate
out_2c=$(node "$SCRIPT" --explain --prompt "머지해" --branch "feature/x" --open-pr 5 2>/dev/null)
if echo "$out_2c" | grep -q '"inject":true' && echo "$out_2c" | grep -q '"skill":"pr-review-gate"'; then
  echo "PASS: AC-2c: 머지해 → inject=true+skill=pr-review-gate"; PASS=$((PASS+1))
else
  echo "FAIL: AC-2c: 머지해 → inject=true+skill=pr-review-gate 없음 | 출력: $out_2c"; FAIL=$((FAIL+1))
fi

# AC-2d: 비-액션어블 "이게 뭐야?" → inject=false (inject:true가 없어야)
check_no_grep "AC-2d: 이게 뭐야? → inject=false (오버트리거 없음)" \
  '"inject":true' \
  --prompt "이게 뭐야?" --branch "feature/x" --open-pr 5

# AC-2e: 비-액션어블 "상태 보여줘" → inject=false
check_no_grep "AC-2e: 상태 보여줘 → inject=false (오버트리거 없음)" \
  '"inject":true' \
  --prompt "상태 보여줘" --branch "feature/x" --open-pr 5

# AC-2f: "확인해줘"(분석 요청, 해줘 포함) → inject=false (substring 오버트리거 방지)
check_no_grep "AC-2f: 확인해줘 → inject=false (해줘 substring 오버트리거 방지)" \
  '"inject":true' \
  --prompt "에러 메시지 확인해줘" --branch "feature/x" --open-pr 5

# AC-2g: "진행상황 알려줘"(진행 포함) → inject=false (진행 substring 오버트리거 방지)
check_no_grep "AC-2g: 진행상황 알려줘 → inject=false (진행 substring 오버트리거 방지)" \
  '"inject":true' \
  --prompt "진행상황 알려줘" --branch "feature/x" --open-pr 5

# AC-2h: "요약해줘" → inject=false
check_no_grep "AC-2h: 요약해줘 → inject=false" \
  '"inject":true' \
  --prompt "이 로그 요약해줘" --branch "feature/x" --open-pr 5

# ── AC-3: 상태 불명확 → inject=false ──────────────────────────────────────
echo ""
echo "=== AC-3: 상태 불명확 → inject=false ==="

# 아무 판정 신호 없음(main 브랜치, 액션어블 프롬프트지만 컨텍스트 없음) → inject=false
check_no_grep "AC-3: 신호 없음(main+액션어블) → inject=false" \
  '"inject":true' \
  --prompt "진행해" --branch "main"

# ── AC-4: isSolo 라우팅 ──────────────────────────────────────────────────
echo ""
echo "=== AC-4: isSolo 라우팅 ==="

# AC-4a: isSolo=true + openPR → solo-merge
check_grep "AC-4a: isSolo=true+openPR → skill=solo-merge" \
  '"skill":"solo-merge"' \
  --prompt "진행해" --branch "feature/x" --open-pr 3 --solo

# AC-4b: isSolo=false(기본) + openPR → pr-review-gate
check_grep "AC-4b: isSolo=false+openPR → skill=pr-review-gate" \
  '"skill":"pr-review-gate"' \
  --prompt "진행해" --branch "feature/x" --open-pr 3

# ── AC-5: fail-open (라이브 모드) ─────────────────────────────────────────
echo ""
echo "=== AC-5: fail-open (라이브 모드) ==="

# 비-repo 디렉터리에서 라이브 모드 실행 → exit 0 + 프롬프트 처리 미차단
_tmpdir=$(mktemp -d)
_out=$(printf '{"prompt":"진행해","cwd":"%s"}' "$_tmpdir" | node "$SCRIPT" 2>/dev/null)
_rc=$?
rm -rf "$_tmpdir"
if [ "$_rc" -eq 0 ]; then
  echo "PASS: AC-5: 비-repo 라이브 모드 → exit 0"; PASS=$((PASS+1))
else
  echo "FAIL: AC-5: 비-repo 라이브 모드 → exit $_rc (0 예상)"; FAIL=$((FAIL+1))
fi
# AC-5b: 비-repo서 주입도 없어야(fail-open의 핵심 보장 = 무주입)
if [ -z "$_out" ]; then
  echo "PASS: AC-5b: 비-repo → 무주입(stdout 비어있음)"; PASS=$((PASS+1))
else
  echo "FAIL: AC-5b: 비-repo서 주입됨 | 출력: $_out"; FAIL=$((FAIL+1))
fi

# ── 신규 라우트 확장 케이스 (v0.12.0) ────────────────────────────────────

echo ""
echo "=== 신규 라우트 확장 케이스 (v0.12.0) ==="

# Route 2 — 릴리즈 (develop 브랜치 한정)
check_grep "Route2-a: 릴리즈해+develop → skill=release-check" \
  '"skill":"release-check"' \
  --prompt "릴리즈해" --branch "develop"

check_grep "Route2-b: 배포해+develop → skill=release-check" \
  '"skill":"release-check"' \
  --prompt "배포해" --branch "develop"

check_no_grep "Route2-c: 릴리즈해+feature/x(develop 아님) → inject=false" \
  '"inject":true' \
  --prompt "릴리즈해" --branch "feature/x"

# Route 3 — 핫픽스
check_grep "Route3-a: 핫픽스 진행해 → skill=hotfix" \
  '"skill":"hotfix"' \
  --prompt "핫픽스 진행해" --branch "main"

check_grep "Route3-b: 긴급 수정해야 해 → skill=hotfix" \
  '"skill":"hotfix"' \
  --prompt "긴급 수정해야 해" --branch "main"

# Route 5 — QA
check_grep "Route5-a: qa 해줘 → skill=qa" \
  '"skill":"qa"' \
  --prompt "qa 해줘" --branch "develop"

check_grep "Route5-b: 접근성 검사 해줘 → skill=qa" \
  '"skill":"qa"' \
  --prompt "접근성 검사 해줘" --branch "develop"

check_no_grep "Route5-c: a11y 확인해줘 → inject=false (확인 veto)" \
  '"inject":true' \
  --prompt "a11y 확인해줘" --branch "develop"

# Route 6 — repo-sync
check_grep "Route6-a: 드리프트 점검해줘 → skill=repo-sync" \
  '"skill":"repo-sync"' \
  --prompt "드리프트 점검해줘" --branch "develop"

check_grep "Route6-b: 동기화 해줘 → skill=repo-sync" \
  '"skill":"repo-sync"' \
  --prompt "동기화 해줘" --branch "develop"

# Route 7 — loop
check_grep "Route7-a: 루프 돌려줘 → skill=loop" \
  '"skill":"loop"' \
  --prompt "루프 돌려줘" --branch "develop"

check_grep "Route7-b: 통과까지 반복해줘 → skill=loop" \
  '"skill":"loop"' \
  --prompt "통과까지 반복해줘" --branch "develop"

# Route 8 — milestone
check_grep "Route8-a: 마일스톤 진행해줘 → skill=milestone" \
  '"skill":"milestone"' \
  --prompt "마일스톤 진행해줘" --branch "develop"

check_no_grep "Route8-b: 목표 달성률 보여줘 → inject=false (보여 veto)" \
  '"inject":true' \
  --prompt "목표 달성률 보여줘" --branch "develop"

# Route 9 — plan
check_grep "Route9-a: 계획 세워줘 → skill=plan" \
  '"skill":"plan"' \
  --prompt "계획 세워줘" --branch "develop"

check_grep "Route9-b: 스펙 짜줘 → skill=plan" \
  '"skill":"plan"' \
  --prompt "스펙 짜줘" --branch "develop"

# Route 10 — feature-add (develop 한정)
check_grep "Route10-a: 로그인 기능 만들어줘+develop → skill=feature-add" \
  '"skill":"feature-add"' \
  --prompt "로그인 기능 만들어줘" --branch "develop"

check_grep "Route10-b: 알림 기능 추가해줘+develop → skill=feature-add" \
  '"skill":"feature-add"' \
  --prompt "알림 기능 추가해줘" --branch "develop"

check_no_grep "Route10-c: 로그인 기능 만들어줘+feature/x → inject=false (Route10 조건 불충족)" \
  '"inject":true' \
  --prompt "로그인 기능 만들어줘" --branch "feature/x"

# Route 11 — feature-modify (develop 한정)
check_grep "Route11-a: 로그인 버그 수정해줘+develop → skill=feature-modify" \
  '"skill":"feature-modify"' \
  --prompt "로그인 버그 수정해줘" --branch "develop"

check_grep "Route11-b: 프로필 기능 고쳐줘+develop → skill=feature-modify" \
  '"skill":"feature-modify"' \
  --prompt "프로필 기능 고쳐줘" --branch "develop"

# Route 12 — fallback + 상태 추론 (기존 AC-1d 유지 확인)
check_grep "Route12-a: 진행해+develop+hasSpec → skill=feature-add" \
  '"skill":"feature-add"' \
  --prompt "진행해" --branch "develop" --has-spec

# 오버트리거 방지
check_no_grep "OT-a: 릴리즈 일정 확인해줘 → inject=false (확인 veto)" \
  '"inject":true' \
  --prompt "릴리즈 일정 확인해줘" --branch "develop"

check_no_grep "OT-b: sync 상황 요약해줘 → inject=false (요약 veto)" \
  '"inject":true' \
  --prompt "sync 상황 요약해줘" --branch "develop"

check_no_grep "OT-c: 핫픽스 내용이 뭐야? → inject=false (뭐 veto)" \
  '"inject":true' \
  --prompt "핫픽스 내용이 뭐야?" --branch "main"

check_no_grep "OT-d: qa 결과 알려줘 → inject=false (알려 veto)" \
  '"inject":true' \
  --prompt "qa 결과 알려줘" --branch "develop"

# ── 결과 ──────────────────────────────────────────────────────────────────
echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

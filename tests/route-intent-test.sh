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

# AC-2i~k: 일반 코딩 지시 → inject=false (v0.17.0 오버트리거 방지 — 실증 케이스)
# "루프"·"접근성"·"동기화"가 /loop·/hotfix·/repo-sync를 키워드 매칭으로 오주입했던 케이스.
# 상태 기반 라우터(v0.16.x)는 키워드를 보지 않으므로 당연히 PASS.
# 이 케이스들이 FAIL이면 키워드 기반 로직이 다시 들어온 것 — 즉시 리버트.
check_no_grep "AC-2i: for 루프 고쳐줘 → inject=false (loop 오버트리거 방지)" \
  '"inject":true' \
  --prompt "for 루프 고쳐줘" --branch "develop"

check_no_grep "AC-2j: 장애인 접근성 고쳐줘 → inject=false (hotfix 오버트리거 방지)" \
  '"inject":true' \
  --prompt "장애인 접근성 고쳐줘" --branch "develop"

check_no_grep "AC-2k: DB 동기화 로직 만들어줘 → inject=false (repo-sync 오버트리거 방지)" \
  '"inject":true' \
  --prompt "DB 동기화 로직 만들어줘" --branch "develop"

# AC-2l: 부정문("~하지 말고") → inject=false (F6 — '배포' substring 오버트리거 방지)
check_no_grep "AC-2l: 배포하지 말고 로그만 남겨줘 → inject=false (부정문 veto, F6)" \
  '"inject":true' \
  --prompt "배포하지 말고 로그만 남겨줘" --branch "feature/x" --committed

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

# ── 결과 ──────────────────────────────────────────────────────────────────
echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

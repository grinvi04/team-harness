#!/bin/bash
# tests/solo-merge-test.sh — solo-merge.sh break-glass 원자성·복구 검증.
#  태스크1: 순수 판정 함수(had_protection·extract_restore_payload) 단위(SOLO_MERGE_SOURCE_ONLY, gh 무관).
#  태스크2~3: 원자 코어(trap 복구)·pre-gate — fake-bin 주입 E2E(추가 예정).
# 로컬·CI 동일: bash tests/solo-merge-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SM="$ROOT/plugins/harness-guard/scripts/solo-merge.sh"
PASS=0; FAIL=0

# ── had_protection: 설정 JSON → yes/no (AC-4 경계·보호없음) ──
hp() { # desc, config_json, want
  local desc="$1" cfg="$2" want="$3" got
  got=$(SOLO_MERGE_SOURCE_ONLY=1 bash -c 'source "$1"; printf "%s" "$2" | had_protection' _ "$SM" "$cfg")
  if [ "$got" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want '$want' got '$got'"; FAIL=$((FAIL+1)); fi
}
FULL='{"url":"https://api.github.com/x","required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"require_last_push_approval":false}'
hp "빈 설정 → no(보호 없음)"                 ""                                              no
hp "요건 없는 설정 → no"                       '{"url":"https://api.github.com/x"}'            no
hp "요건 있는 설정 → yes"                      "$FULL"                                         yes
hp "count=0이라도 필드 존재 → yes"             '{"required_approving_review_count":0}'         yes

# ── extract_restore_payload: 설정 JSON → 4필드 복구 payload (AC-5 payload 정확성·멱등) ──
erp() { # desc, config_json, want_json
  local desc="$1" cfg="$2" want="$3" got
  got=$(SOLO_MERGE_SOURCE_ONLY=1 bash -c 'source "$1"; printf "%s" "$2" | extract_restore_payload' _ "$SM" "$cfg")
  if [ "$got" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want '$want' got '$got'"; FAIL=$((FAIL+1)); fi
}
# 4필드만 남기고 url 등 비관련 필드는 드롭. 키 순서 = 추출 튜플 순서(결정론적).
erp "4필드 추출·비관련 필드 드롭" "$FULL" \
  '{"required_approving_review_count": 1, "dismiss_stale_reviews": true, "require_code_owner_reviews": false, "require_last_push_approval": false}'
# 값 보존: count·bool 원값 유지(복구가 원 상태로 되돌리는지 — 잘못된 값이면 보호 변형)
erp "값 보존(전 필드 원값 유지)" \
  '{"required_approving_review_count":2,"dismiss_stale_reviews":false,"require_code_owner_reviews":true,"require_last_push_approval":true}' \
  '{"required_approving_review_count": 2, "dismiss_stale_reviews": false, "require_code_owner_reviews": true, "require_last_push_approval": true}'
# 일부 필드 결측 → 있는 것만(존재 필드만 PATCH, 없는 것 생략)
erp "결측 필드 생략(count만)" \
  '{"required_approving_review_count":1}' \
  '{"required_approving_review_count": 1}'

# ── 멱등: 같은 입력 두 번 추출 → 동일 출력(복구 재적용해도 같은 상태) (AC-5) ──
a=$(SOLO_MERGE_SOURCE_ONLY=1 bash -c 'source "$1"; printf "%s" "$2" | extract_restore_payload' _ "$SM" "$FULL")
b=$(SOLO_MERGE_SOURCE_ONLY=1 bash -c 'source "$1"; printf "%s" "$2" | extract_restore_payload' _ "$SM" "$FULL")
if [ "$a" = "$b" ] && [ -n "$a" ]; then echo "PASS: 멱등 — 재추출 동일"; PASS=$((PASS+1)); else echo "FAIL: 멱등 — '$a' vs '$b'"; FAIL=$((FAIL+1)); fi

# ══ E2E 원자성: fake gh(DELETE/PATCH 로깅) + 주입 merge로 중단 시 복구 반증 검증 ══
# 반증 기반: "복구된다"를 통과가 아니라 merge 실패·시그널을 주입해 복구 실패를 시도해서 확인.
E2E_DIR=$(mktemp -d); trap 'rm -rf "$E2E_DIR"' EXIT
# fake gh: 메타데이터 응답 + DELETE/PATCH를 GH_LOG에 기록. FAKE_REVIEWS_CONFIG로 보호 유무 주입.
cat > "$E2E_DIR/gh" <<'GHEOF'
#!/bin/sh
args="$*"
case "$args" in
  *"repo view"*) echo "owner/repo"; exit 0 ;;
  *"pr view"*"--json number"*) echo 42; exit 0 ;;
  *"pr view"*"--json baseRefName"*) echo main; exit 0 ;;
  *"pr view"*"--json state"*) echo MERGED; exit 0 ;;
esac
case "$args" in
  *"-X DELETE"*required_pull_request_reviews*) echo DELETE >> "$GH_LOG"; exit 0 ;;
  *"-X PATCH"*required_pull_request_reviews*) payload=$(cat); echo "PATCH $payload" >> "$GH_LOG"; exit 0 ;;
  *required_pull_request_reviews*--jq*) echo 1; exit 0 ;;                       # verify count(복원값)
  *required_pull_request_reviews*) printf '%s' "$FAKE_REVIEWS_CONFIG"; [ -n "$FAKE_REVIEWS_CONFIG" ]; exit $? ;;  # GET save
esac
exit 0
GHEOF
chmod +x "$E2E_DIR/gh"
E2E_N=0; L=""; RC=0
run_e2e() { # merge_body, fake_config → 전역 L(로그경로)·RC 설정 (커맨드치환 서브셸 회피)
  E2E_N=$((E2E_N+1)); L="$E2E_DIR/log.$E2E_N"; local mc="$E2E_DIR/merge.$E2E_N.sh"
  : > "$L"; printf '#!/bin/sh\n%s\n' "$1" > "$mc"; chmod +x "$mc"
  PATH="$E2E_DIR:$PATH" GH_LOG="$L" FAKE_REVIEWS_CONFIG="$2" SOLO_MERGE_MERGE_CMD="$mc" \
    bash "$SM" 42 >/dev/null 2>&1; RC=$?
}
ok() { [ "$1" = "$2" ] && { echo "PASS: $3"; PASS=$((PASS+1)); } || { echo "FAIL: $3 — want '$2' got '$1'"; FAIL=$((FAIL+1)); }; }

# AC-1 정상: DELETE 1·PATCH 1(4필드)·RC0
run_e2e 'exit 0' "$FULL"
ok "$(grep -c '^DELETE' "$L")" 1 "AC-1 정상 — DELETE 1회"
ok "$(grep -c '^PATCH'  "$L")" 1 "AC-1 정상 — PATCH(복구) 1회(멱등)"
grep -q '^PATCH .*required_approving_review_count.*dismiss_stale_reviews' "$L" && { echo "PASS: AC-1 PATCH 원본 4필드"; PASS=$((PASS+1)); } || { echo "FAIL: AC-1 PATCH 페이로드"; FAIL=$((FAIL+1)); }
ok "$RC" 0 "AC-1 정상 — RC 0"

# AC-2 머지실패: merge exit 1 → set -e 이탈해도 trap이 PATCH 복구, RC≠0
run_e2e 'exit 1' "$FULL"
ok "$(grep -c '^PATCH' "$L")" 1 "AC-2 머지실패 — trap 복구 PATCH 1회"
[ "$RC" -ne 0 ] && { echo "PASS: AC-2 머지실패 — RC≠0(=$RC)"; PASS=$((PASS+1)); } || { echo "FAIL: AC-2 — RC=$RC(기대≠0)"; FAIL=$((FAIL+1)); }

# AC-3 시그널: merge가 wrapper에 SIGTERM → trap이 복구 PATCH 실행
run_e2e 'kill -TERM $PPID' "$FULL"
ok "$(grep -c '^PATCH' "$L")" 1 "AC-3 시그널(TERM) — trap 복구 PATCH 1회"
[ "$RC" -ne 0 ] && { echo "PASS: AC-3 시그널 — 비정상 종료(RC=$RC)"; PASS=$((PASS+1)); } || { echo "FAIL: AC-3 — RC=$RC(기대≠0)"; FAIL=$((FAIL+1)); }

# AC-4 보호없음: HAD_PROTECTION=no → DELETE·PATCH 0건(요건 신규 생성 방지)
run_e2e 'exit 0' ""
ok "$(grep -c '^DELETE' "$L")" 0 "AC-4 보호없음 — DELETE 0건"
ok "$(grep -c '^PATCH'  "$L")" 0 "AC-4 보호없음 — PATCH 0건"
ok "$RC" 0 "AC-4 보호없음 — RC 0(정상 머지)"

echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

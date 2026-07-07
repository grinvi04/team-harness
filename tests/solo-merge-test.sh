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
# 상태 있는(stateful) fake gh: 리소스를 실제처럼 모델 — DELETE 후 '삭제됨'은 non-empty PATCH가 있어야 복원.
#   복구 안 된 상태의 count GET은 404(→wrapper "?")로 응답 → verify가 실데이터처럼 sentinel을 본다(반증 충실도).
cat > "$E2E_DIR/gh" <<'GHEOF'
#!/bin/sh
args="$*"; S="$GH_STATE"
case "$args" in
  *"repo view"*) echo "owner/repo"; exit 0 ;;
  *"pr view"*"--json number"*) echo 42; exit 0 ;;
  *"pr view"*"--json baseRefName"*) echo main; exit 0 ;;
  *"pr view"*"--json state"*) echo MERGED; exit 0 ;;
  *"pr view"*"--json mergeable"*) echo "${FAKE_MERGEABLE:-MERGEABLE}"; exit 0 ;;
  *"pr checks"*) exit "${FAKE_CI_RC:-0}" ;;
  *"api graphql"*reviewThreads*) echo "${FAKE_UNRESOLVED:-0}"; exit 0 ;;
esac
cur=$(cat "$S" 2>/dev/null || echo present)
case "$args" in
  *"-X DELETE"*required_pull_request_reviews*) echo DELETE >> "$GH_LOG"; echo deleted > "$S"; exit 0 ;;
  *"-X PATCH"*required_pull_request_reviews*) p=$(cat)
    if [ "${FAKE_PATCH_RC:-0}" != 0 ]; then echo "PATCH-FAIL" >> "$GH_LOG"; exit 1; fi   # PATCH 5xx 시뮬(복원 안 됨)
    if [ -n "$p" ]; then echo "PATCH $p" >> "$GH_LOG"; echo restored > "$S"; exit 0
    else echo "PATCH(empty)" >> "$GH_LOG"; exit 1; fi ;;                                  # 빈 payload=422, 복원 안 됨
  *required_pull_request_reviews*--jq*) [ "$cur" = deleted ] && exit 1; echo 1; exit 0 ;; # 삭제상태 count GET=404
  *required_pull_request_reviews*) [ "$cur" = deleted ] && exit 1; printf '%s' "$FAKE_REVIEWS_CONFIG"; [ -n "$FAKE_REVIEWS_CONFIG" ]; exit $? ;;  # GET save
esac
exit 0
GHEOF
chmod +x "$E2E_DIR/gh"
# 파서 stub 디렉터리: python3만 깨뜨림 / python3·jq 둘 다 깨뜨림 (앞에 붙여 PATH 셰도)
PYSTUB="$E2E_DIR/pystub"; mkdir -p "$PYSTUB"; printf '#!/bin/sh\nexit 1\n' > "$PYSTUB/python3"; chmod +x "$PYSTUB/python3"
NOPARSE="$E2E_DIR/noparse"; mkdir -p "$NOPARSE"; for b in python3 jq; do printf '#!/bin/sh\nexit 1\n' > "$NOPARSE/$b"; chmod +x "$NOPARSE/$b"; done
E2E_N=0; L=""; RC=0
run_e2e() { # merge_body, fake_config, [path_prefix] → 전역 L(로그경로)·RC 설정 (커맨드치환 서브셸 회피)
  E2E_N=$((E2E_N+1)); L="$E2E_DIR/log.$E2E_N"; local mc="$E2E_DIR/merge.$E2E_N.sh"
  : > "$L"; local st="$E2E_DIR/state.$E2E_N"; : > "$st"; printf '#!/bin/sh\n%s\n' "$1" > "$mc"; chmod +x "$mc"
  PATH="${3:+$3:}$E2E_DIR:$PATH" GH_LOG="$L" GH_STATE="$st" FAKE_REVIEWS_CONFIG="$2" SOLO_MERGE_MERGE_CMD="$mc" \
    FAKE_CI_RC="${FAKE_CI_RC:-0}" FAKE_UNRESOLVED="${FAKE_UNRESOLVED:-0}" FAKE_MERGEABLE="${FAKE_MERGEABLE:-MERGEABLE}" \
    FAKE_PATCH_RC="${FAKE_PATCH_RC:-0}" \
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

# ── AC-6 pre-gate: 미달이면 DELETE 이전에 중단(보호 무손상) ──
# solo_gate_decide 순수 판정 단위
gate() { # desc, ci_rc, unresolved, mergeable, want_rc
  local got; got=$(SOLO_MERGE_SOURCE_ONLY=1 bash -c 'source "$1"; if solo_gate_decide "$2" "$3" "$4" >/dev/null; then echo 0; else echo $?; fi' _ "$SM" "$2" "$3" "$4")
  ok "$got" "$5" "AC-6 단위 — $1"
}
gate "전부 통과 → 0"        0 0 MERGEABLE     0
gate "CI 미통과 → 1"        1 0 MERGEABLE     1
gate "미해결 스레드>0 → 1"  0 2 MERGEABLE     1
gate "mergeable 아님 → 1"   0 0 CONFLICTING   1
# E2E: gate 미달 주입 시 DELETE·PATCH 0건(break-glass 창 안 엶) + RC≠0
FAKE_CI_RC=1 run_e2e 'exit 0' "$FULL"
ok "$(grep -c '^DELETE' "$L")" 0 "AC-6 CI미달 — DELETE 0건(창 안 엶)"
[ "$RC" -ne 0 ] && { echo "PASS: AC-6 CI미달 — RC≠0(=$RC)"; PASS=$((PASS+1)); } || { echo "FAIL: AC-6 CI미달 — RC=$RC(기대≠0)"; FAIL=$((FAIL+1)); }
FAKE_UNRESOLVED=3 run_e2e 'exit 0' "$FULL"
ok "$(grep -c '^DELETE' "$L")" 0 "AC-6 스레드미달 — DELETE 0건"
FAKE_MERGEABLE=CONFLICTING run_e2e 'exit 0' "$FULL"
ok "$(grep -c '^DELETE' "$L")" 0 "AC-6 mergeable미달 — DELETE 0건"

# ══ review 반영(verifier 발견): python3-degraded 복구/검증 fail-closed ══
# R2 파서(python3·jq) 둘 다 부재/실패 → 복구 payload 생성 불가. 기존엔 ORIG/RESTORED 둘 다 "?"로 degrade해
#   [?!=?]=false → 조용한 성공 + 보호 삭제 방치(silent catastrophic). 그 회귀를 fail-closed로 봉쇄한다.
run_e2e 'exit 0' "$FULL" "$NOPARSE"
ok "$(grep -c '^DELETE' "$L")" 1 "R2 파서無 — DELETE 발생(보호 삭제됨)"
ok "$(grep -c '^PATCH'  "$L")" 0 "R2 파서無 — 빈 PATCH 안 보냄"
[ "$RC" -ne 0 ] && { echo "PASS: R2 파서無 — fail-closed RC≠0(조용한 성공 아님)"; PASS=$((PASS+1)); } || { echo "FAIL: R2 파서無 — RC=$RC(기대≠0·silent success 회귀!)"; FAIL=$((FAIL+1)); }

# R3 PATCH 실패(python3 존재) → 복원 안 됨 → verify가 sentinel 감지해 fail-closed(정상 경로 복구실패도 조용히 통과 안 함)
FAKE_PATCH_RC=1 run_e2e 'exit 0' "$FULL"
[ "$RC" -ne 0 ] && { echo "PASS: R3 PATCH실패 — verify fail-closed RC≠0"; PASS=$((PASS+1)); } || { echo "FAIL: R3 PATCH실패 — RC=$RC(기대≠0)"; FAIL=$((FAIL+1)); }

# R1 jq 폴백(python3만 깨짐, jq 존재) → jq로 복구 payload 생성·PATCH 발생, 정상 성공(#239 일관)
if command -v jq >/dev/null 2>&1; then
  run_e2e 'exit 0' "$FULL" "$PYSTUB"
  ok "$(grep -c '^PATCH' "$L")" 1 "R1 jq폴백 — 복구 PATCH 발생"
  grep -q '^PATCH .*required_approving_review_count' "$L" && { echo "PASS: R1 jq폴백 — payload 4필드"; PASS=$((PASS+1)); } || { echo "FAIL: R1 jq폴백 — payload 누락"; FAIL=$((FAIL+1)); }
  ok "$RC" 0 "R1 jq폴백 — 정상 성공(RC0)"
  # R1b: jq-branch payload 값 보존(bool 포함) 정확 검증 — python3 셰도로 jq 경로 강제(값 어서션, grep 아님)
  JQOUT=$(PATH="$PYSTUB:$PATH" SOLO_MERGE_SOURCE_ONLY=1 bash -c 'source "$1"; printf "%s" "$2" | extract_restore_payload' _ "$SM" "$FULL")
  ok "$JQOUT" '{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"require_last_push_approval":false}' "R1b jq-branch payload 4필드 값 보존"
  # R1c: _json_field jq-branch — count=0(falsy)이 sentinel로 오독되지 않음
  JF=$(PATH="$PYSTUB:$PATH" SOLO_MERGE_SOURCE_ONLY=1 bash -c 'source "$1"; printf "%s" "{\"required_approving_review_count\":0}" | _json_field required_approving_review_count' _ "$SM")
  ok "$JF" "0" "R1c jq-branch count=0 보존(sentinel 오독 없음)"
else
  echo "SKIP: R1 jq 폴백 (jq 미설치)"
fi

echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

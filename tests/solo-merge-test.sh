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

echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

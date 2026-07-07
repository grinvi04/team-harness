#!/usr/bin/env bash
# solo-merge.sh — 솔로 break-glass 원자 래퍼. 승인요건이 걸린 base에서 솔로 머지를 위해
# required_pull_request_reviews를 일시 삭제(DELETE)→머지→복구(PATCH)하되, 전 과정을 trap으로 감싸
# 어떤 종료 경로(정상·에러·시그널)에서도 복구 PATCH가 반드시 실행되게 한다([F] 원자성, #220).
#
# 기존 solo-merge/SKILL.md 프로즈는 DELETE·merge·PATCH를 AI가 별도 호출로 수동 실행 → 단계 사이
# 중단 시 PATCH 미실행 → base 브랜치 보호가 승인요건 삭제된 채 방치(조용한 약화)됐다. 이 래퍼가 그 창을 닫는다.
#
# ⚠️ 한계: SIGKILL·전원손실은 trap으로 잡을 수 없다(uncatchable). 2차 안전망 = repo-sync protection-on 검증.
#
# 사용: solo-merge.sh [<PR#>]   (PR# 생략 시 현재 브랜치의 PR)
#   삭제 대상은 승인요건(required_pull_request_reviews)뿐 — allow_force_pushes·enforce_admins·status-check 등
#   다른 보호는 절대 건드리지 않는다. 보호 없던 repo엔 요건을 새로 만들지 않는다.
set -euo pipefail

# ── 순수 판정 함수 (gh I/O와 분리 — 테스트가 SOLO_MERGE_SOURCE_ONLY=1로 주입 검증) ──

# had_protection: stdin=required_pull_request_reviews 설정 JSON → "yes"(승인요건 존재) / "no".
#   빈 입력·요건 없는 설정 = no(보호 없던 repo엔 DELETE/PATCH 안 함 — 요건 신규 생성 방지).
had_protection() {
  local cfg; cfg=$(cat)
  if [ -n "$cfg" ] && printf '%s' "$cfg" | grep -q required_approving_review_count; then
    echo yes
  else
    echo no
  fi
}

# extract_restore_payload: stdin=설정 JSON → 복구 PATCH 본문(4필드만: required_approving_review_count·
#   dismiss_stale_reviews·require_code_owner_reviews·require_last_push_approval). count만 복구하면 나머지
#   필드가 유실돼 base 보호가 매 실행 영구 약화(K1)되므로 전체 필드를 보존한다. 없는 필드는 생략.
extract_restore_payload() {
  python3 -c "import sys,json; c=json.load(sys.stdin); print(json.dumps({k:c[k] for k in ('required_approving_review_count','dismiss_stale_reviews','require_code_owner_reviews','require_last_push_approval') if k in c}))"
}

[ -n "${SOLO_MERGE_SOURCE_ONLY:-}" ] && return 0 2>/dev/null || true

# ── main (태스크2~3에서 구현) ──

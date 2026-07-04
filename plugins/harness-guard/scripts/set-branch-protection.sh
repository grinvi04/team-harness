#!/usr/bin/env bash
# set-branch-protection.sh — 기존 repo에 **표준 솔로 브랜치 보호**를 적용/검증한다.
# 플러그인과 함께 배포(check-repo-sync.mjs와 동일 위치) — /repo-sync 스킬이 참조.
# new-repo.sh는 신규 repo(생성 시 STACK_CHECKS 명시 등록)를, 이 스크립트는 **기존 repo**를 다룬다
# (실제 보고되는 check context를 자동 감지 → 이름 불일치 데드락 회피).
#
# 사용:
#   bash set-branch-protection.sh <repo>            # <repo>의 main·develop에 표준 보호 적용
#   bash set-branch-protection.sh <repo> --check    # 적용 안 하고 현재 상태만 검증(드리프트 리포트)
#   <repo> = owner/name 또는 name(=$(gh api user)/name)
#
# 표준 config(솔로, decisions "브랜치 보호 표준"):
#   required status checks(자동감지·strict) · 대화 resolve · force-push/삭제 차단,
#   **승인요건 0 · enforce_admins=false** (솔로 자기승인 불가 → 승인요건 걸면 데드락. CI가 게이트).
#   리뷰어 합류 시 승인요건을 수동 1↑ 조정(그때만 /solo-merge break-glass 필요).
set -uo pipefail

REPO="${1:?사용: set-branch-protection.sh <repo> [--check]}"
CHECK=false; [ "${2:-}" = "--check" ] && CHECK=true
[[ "$REPO" == */* ]] || REPO="$(gh api user --jq .login 2>/dev/null)/$REPO"

rc=0
for branch in main develop; do
  if ! gh api "repos/$REPO/branches/$branch" >/dev/null 2>&1; then
    echo "skip $REPO:$branch (브랜치 없음/비공개)"; continue
  fi

  if $CHECK; then
    prot=$(gh api "repos/$REPO/branches/$branch/protection" 2>/dev/null || true)
    if [ -z "$prot" ]; then echo "✗ $REPO:$branch — 보호 미적용"; rc=1; continue; fi
    appr=$(printf '%s' "$prot" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('required_pull_request_reviews'); print(r.get('required_approving_review_count') if r else 0)" 2>/dev/null || echo "?")
    if [ "$appr" = "0" ] || [ "$appr" = "None" ]; then echo "✓ $REPO:$branch — 보호 적용(승인0, 솔로 표준)"
    else echo "⚠ $REPO:$branch — 보호 있으나 승인요건=$appr (솔로 표준=0 불일치 · 리뷰어 有면 의도된 것)"; rc=1; fi
    continue
  fi

  # 적용: 실제 보고되는 check 이름만 required로(없으면 생략 → 데드락 방지)
  ctx=$(gh api "repos/$REPO/commits/$branch/check-runs" --jq '[.check_runs[].name]|unique' 2>/dev/null); [ -z "$ctx" ] && ctx='[]'
  rsc="null"; [ "$ctx" != "[]" ] && rsc="{\"strict\":true,\"contexts\":$ctx}"
  if gh api -X PUT "repos/$REPO/branches/$branch/protection" --input - >/dev/null 2>&1 <<JSON
{"required_status_checks":$rsc,"enforce_admins":false,"required_pull_request_reviews":null,"restrictions":null,"required_conversation_resolution":true,"allow_force_pushes":false,"allow_deletions":false}
JSON
  then echo "✓ $REPO:$branch — 보호 적용(승인0 · checks=$ctx)"
  else echo "✗ $REPO:$branch — 적용 실패(private+Free? 권한?)"; rc=1; fi
done
exit $rc

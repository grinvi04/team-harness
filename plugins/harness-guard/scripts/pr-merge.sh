#!/usr/bin/env bash
# pr-merge.sh — 머지 단일 경로(래퍼). guard.sh가 맨손 `gh pr merge`를 차단하므로,
# 머지는 이 스크립트를 통해서만 한다(내부 gh는 자식 프로세스라 PreToolUse 훅에 안 걸린다).
# 머지 *전에* 게이트를 직접 검증한다 — CI required green · 미해결 리뷰 스레드 0 · mergeable.
# 게이트를 통과하지 못하면 머지하지 않고 종료(게이트가 머지 경로에 박혀 건너뛸 수 없음).
#
# 사용: pr-merge.sh [<PR#>] [--base <branch>]   (PR# 생략 시 현재 브랜치의 PR)
#   브랜치 보호(승인 요건) 해제·복구는 이 스크립트가 하지 않는다 — solo-merge가 별도로 감싼다.
set -euo pipefail

PR="" BASE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="${2:-}"; shift 2;;
    -*) echo "pr-merge.sh: 알 수 없는 인자 '$1'" >&2; exit 2;;
    *) PR="$1"; shift;;
  esac
done

OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
[ -z "$PR" ] && PR=$(gh pr view --json number --jq .number)
OWNER="${OWNER_REPO%/*}"; NAME="${OWNER_REPO#*/}"
echo "게이트 검증: $OWNER_REPO PR #$PR"

# 1) CI required check 전부 통과 (required check 없으면 통과로 간주)
if ! gh pr checks "$PR" --repo "$OWNER_REPO" --required >/dev/null 2>&1; then
  # required check가 아예 없으면 gh가 비0을 줄 수 있으니, 실패가 'no checks'인지 구분
  if gh pr checks "$PR" --repo "$OWNER_REPO" --required 2>&1 | grep -qi "no checks"; then
    echo "  CI: required check 없음 → 통과"
  else
    echo "  ⛔ CI required check 미통과 — 머지 중단" >&2; exit 1
  fi
else
  echo "  CI: required green"
fi

# 2) 미해결 리뷰 스레드 0 — fail-CLOSED(쿼리 실패=검증 불가 → 중단). CI·mergeable 게이트와 일관.
UNRESOLVED=$(gh api graphql -f query='query($o:String!,$n:String!,$p:Int!){repository(owner:$o,name:$n){pullRequest(number:$p){reviewThreads(first:100){nodes{isResolved}}}}}' \
  -F o="$OWNER" -F n="$NAME" -F p="$PR" \
  --jq '[.data.repository.pullRequest.reviewThreads.nodes[]|select(.isResolved==false)]|length' 2>/dev/null) || UNRESOLVED="ERR"
if [ "$UNRESOLVED" != "0" ]; then
  echo "  ⛔ 미해결 리뷰 스레드 미통과(값=$UNRESOLVED · ERR=API오류) — 머지 중단" >&2; exit 1
fi
echo "  미해결 스레드: 0"

# 3) mergeable — push 직후 GitHub가 비동기 계산 중이면 UNKNOWN을 줄 수 있어 잠깐 폴링.
MERGEABLE=""
for _ in 1 2 3 4; do
  MERGEABLE=$(gh pr view "$PR" --repo "$OWNER_REPO" --json mergeable --jq .mergeable)
  [ "$MERGEABLE" != "UNKNOWN" ] && break
  sleep 2
done
if [ "$MERGEABLE" != "MERGEABLE" ]; then
  echo "  ⛔ mergeable=$MERGEABLE (충돌 또는 계산 미완) — 머지 중단" >&2; exit 1
fi
echo "  mergeable: MERGEABLE"

echo "게이트 통과 → 머지"
gh pr merge "$PR" --repo "$OWNER_REPO" --merge --delete-branch
echo "✅ PR #$PR 머지 완료"

#!/usr/bin/env bash
# pr-create.sh — PR 생성 단일 경로(래퍼). guard.sh가 맨손 `gh pr create`를 차단하므로,
# PR 생성은 이 스크립트를 통해서만 한다(내부 gh는 자식 프로세스라 PreToolUse 훅에 안 걸린다).
# 명시한 base 또는 repo branchFlow 선언을 검증하고, 원격 base 확인 후 push·생성한다.
#
# 사용: pr-create.sh --title "<t>" --body "<b>" [--body-file <file>] [--base <branch>] [--draft] [--milestone <m>] [--stack]
#   --base 미지정 시 branchFlow 선언 필수. GitFlow hotfix/release는 --base main 필수.
set -euo pipefail

# ── 순수 검증 함수 — gh/git 호출과 분리해 테스트가 주입 검증(tests/pr-create-test.sh). ──
# title/body는 함께 주거나 둘 다 생략(--fill). 한쪽만 = 비대화형 gh 에러 → rc2로 push 전 선거절.
valid_title_body() {
  local t="$1" b="$2"
  if { [ -n "$t" ] && [ -z "$b" ]; } || { [ -z "$t" ] && [ -n "$b" ]; }; then return 2; fi
  return 0
}
# 현재 브랜치가 base(main/develop)면 PR 생성 대상이 아님 → rc0(거절 신호).
is_base_branch() { case "$1" in main|develop) return 0;; *) return 1;; esac; }

# 테스트 훅: 함수만 로드하고 종료(인자 파싱·git/gh 없이 순수 함수만 검증).
[ -n "${PRCREATE_SOURCE_ONLY:-}" ] && return 0 2>/dev/null || true
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TITLE="" BODY="" BASE="" DRAFT="" MILESTONE="" STACK=""
while [ $# -gt 0 ]; do
  case "$1" in
    --title)     TITLE="${2:-}"; shift 2;;
    --body)      BODY="${2:-}"; shift 2;;
    --body-file) BODY="$(cat "${2:?body file required}")"; shift 2;;
    --base)      [ -n "${2:-}" ] && [ -z "$BASE" ] || { echo "--base 값은 한 번 지정하세요." >&2; exit 2; }; BASE="$2"; shift 2;;
    --milestone) MILESTONE="${2:-}"; shift 2;;
    --draft)     DRAFT="--draft"; shift;;
    --stack)     [ -z "$STACK" ] || exit 2; STACK=1; shift;;
    *) echo "pr-create.sh: 알 수 없는 인자 '$1'" >&2; exit 2;;
  esac
done

# title/body는 함께 주거나 둘 다 생략(--fill). 한쪽만은 gh가 비대화형에서 에러 → push 전에 거절.
if ! valid_title_body "$TITLE" "$BODY"; then
  echo "pr-create.sh: --title과 --body는 함께 주세요(둘 다 생략 시 --fill 사용)." >&2; exit 2
fi

# Opt-in declaration for existing consumers; adopting CI can require its presence.
# Validate before any push. The body is data, never interpolated into shell code.
if [[ "$BODY" == *'```harness-doc-sync'* ]]; then
  printf '%s\n' "$BODY" | node "$SCRIPT_DIR/check-document-sync.mjs" --repo . --record /dev/stdin --committed
fi

BRANCH=$(git branch --show-current)
[ -z "$BRANCH" ] && { echo "detached HEAD — feature/* 또는 fix/* 브랜치에서 실행하세요." >&2; exit 2; }
if is_base_branch "$BRANCH"; then
  echo "현재 브랜치가 base($BRANCH)입니다 — feature/fix 브랜치에서 실행하세요." >&2; exit 2
fi
# 추적 파일의 dirty 상태만 차단(untracked 스크래치 파일은 PR에 안 들어가므로 무시).
if ! STATUS=$(git status --porcelain --untracked-files=no); then
  echo "작업 트리 상태 조회 실패 — push를 중단합니다." >&2; exit 2
fi
if [ -n "$STATUS" ]; then
  echo "미커밋 변경사항이 있습니다(추적 파일) — 커밋 또는 stash 후 재실행하세요." >&2; exit 2
fi

# 정책과 명시 인자를 먼저 대조한다. 로컬/원격 develop 존재는 제품 정책이 아니다.
POLICY_ROOT=$(git rev-parse --show-toplevel)
if [ "$STACK" = 1 ]; then
  STACK_ARGS=(check-create --base "$BASE")
  [ -n "$DRAFT" ] && STACK_ARGS+=(--draft)
  if ! STACK_CONTEXT=$(node "$SCRIPT_DIR/stack.mjs" "${STACK_ARGS[@]}"); then exit 2; fi
  BASE=$(printf '%s' "$STACK_CONTEXT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).base))')
  STACK_REPO=$(printf '%s' "$STACK_CONTEXT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).repo))')
else
  if ! BASE=$(node "$SCRIPT_DIR/repo-policy.mjs" "$POLICY_ROOT" base "$BRANCH" "$BASE"); then exit 2; fi
fi
# 확인된 base가 현재 브랜치와 같으면 self-PR(예: 기본 브랜치명이 trunk라 is_base_branch에 안 걸린 경우) → 거절(#215).
if [ "$BRANCH" = "$BASE" ]; then
  echo "현재 브랜치($BRANCH)가 확인된 base와 같습니다 — feature/fix 브랜치에서 실행하세요(self-PR 방지)." >&2; exit 2
fi
if ! REMOTE_BASE=$(git ls-remote --exit-code --heads origin "refs/heads/$BASE"); then
  echo "원격 base($BASE) 조회 실패 — push를 중단합니다." >&2; exit 2
fi
IFS=$'\t' read -r REMOTE_SHA REMOTE_REF <<< "$REMOTE_BASE"
if [[ ! "$REMOTE_SHA" =~ ^[0-9a-f]{40}$ ]] || [ "$REMOTE_REF" != "refs/heads/$BASE" ] \
  || [ "$REMOTE_BASE" != "$REMOTE_SHA"$'\t'"refs/heads/$BASE" ]; then
  echo "원격 base 응답이 유효하지 않습니다 — push를 중단합니다." >&2; exit 2
fi
echo "확인된 base: $BASE  (브랜치: $BRANCH)"

if [ "$STACK" = 1 ]; then
  # The adapter normally published this exact layer already. Never repeat its
  # push through ambient followTags/refspec defaults or a mutable source ref.
  STACK_REFS=$(printf '%s' "$STACK_CONTEXT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);console.log([c.headOid,c.remoteOid??""].join("|"))})')
  IFS='|' read -r STACK_HEAD STACK_REMOTE <<< "$STACK_REFS"
  if [ "$STACK_HEAD" != "$STACK_REMOTE" ]; then
    git push --atomic --no-follow-tags origin \
      "--force-with-lease=refs/heads/$BRANCH:$STACK_REMOTE" "$STACK_HEAD:refs/heads/$BRANCH"
  fi
else
  git push -u origin "$BRANCH"
fi

ARGS=(pr create --base "$BASE" --head "$BRANCH")
[ -n "$TITLE" ]     && ARGS+=(--title "$TITLE")
[ -n "$BODY" ]      && ARGS+=(--body "$BODY")
[ -z "$TITLE$BODY" ] && ARGS+=(--fill)
[ -n "$DRAFT" ]     && ARGS+=("$DRAFT")
[ -n "$MILESTONE" ] && ARGS+=(--milestone "$MILESTONE")
if [ "$STACK" = 1 ]; then
  GH_REPO="$STACK_REPO" GH_HOST=github.com gh "${ARGS[@]}"
else
  gh "${ARGS[@]}"
fi

#!/usr/bin/env bash
# pr-create.sh — PR 생성 단일 경로(래퍼). guard.sh가 맨손 `gh pr create`를 차단하므로,
# PR 생성은 이 스크립트를 통해서만 한다(내부 gh는 자식 프로세스라 PreToolUse 훅에 안 걸린다).
# base를 자동 감지(develop 있으면 develop, 없으면 origin 기본 브랜치=main)하고 push 후 생성한다.
#
# 사용: pr-create.sh --title "<t>" --body "<b>" [--base <branch>] [--draft] [--milestone <m>]
#   --base 미지정 시 자동 감지. hotfix/release처럼 base를 강제해야 하면 --base로 지정.
set -euo pipefail

TITLE="" BODY="" BASE="" DRAFT="" MILESTONE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --title)     TITLE="${2:-}"; shift 2;;
    --body)      BODY="${2:-}"; shift 2;;
    --base)      BASE="${2:-}"; shift 2;;
    --milestone) MILESTONE="${2:-}"; shift 2;;
    --draft)     DRAFT="--draft"; shift;;
    *) echo "pr-create.sh: 알 수 없는 인자 '$1'" >&2; exit 2;;
  esac
done

BRANCH=$(git branch --show-current)
[ -z "$BRANCH" ] && { echo "detached HEAD — feature/* 또는 fix/* 브랜치에서 실행하세요." >&2; exit 2; }
case "$BRANCH" in
  main|develop) echo "현재 브랜치가 base($BRANCH)입니다 — feature/fix 브랜치에서 실행하세요." >&2; exit 2;;
esac
if [ -n "$(git status --porcelain)" ]; then
  echo "미커밋 변경사항이 있습니다 — 커밋 또는 stash 후 재실행하세요." >&2; exit 2
fi

# base 감지(미지정 시): origin 도달되면 원격 진실, 아니면 로컬 캐시 폴백
if [ -z "$BASE" ]; then
  BASE=main
  HEADS=$(git ls-remote --heads origin 2>/dev/null || true)
  if [ -n "$HEADS" ]; then
    if echo "$HEADS" | grep -q 'refs/heads/develop$'; then BASE=develop
    else BASE=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || true); fi
  elif git show-ref --verify --quiet refs/remotes/origin/develop; then BASE=develop
  else BASE=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || true); fi
  [ -z "$BASE" ] && BASE=main
fi
echo "감지된 base: $BASE  (브랜치: $BRANCH)"

git push -u origin "$BRANCH"

ARGS=(pr create --base "$BASE" --head "$BRANCH")
[ -n "$TITLE" ]     && ARGS+=(--title "$TITLE")
[ -n "$BODY" ]      && ARGS+=(--body "$BODY")
[ -z "$TITLE$BODY" ] && ARGS+=(--fill)
[ -n "$DRAFT" ]     && ARGS+=("$DRAFT")
[ -n "$MILESTONE" ] && ARGS+=(--milestone "$MILESTONE")
gh "${ARGS[@]}"

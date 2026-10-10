#!/usr/bin/env bash
# Run after release and back-merge. Cleanup failure does not undo their merges.
set -u
if [ "$#" -ne 1 ] || ! [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'usage: release-cleanup.sh <major.minor.patch>' >&2
  exit 2
fi
version=$1
failed=0
for branch in "release/v$version" "sync/backmerge-v$version"; do
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    state=0
  else
    state=$?
  fi
  if [ "$state" -eq 1 ]; then
    echo "🧹 로컬 브랜치 없음 확인: $branch"
  elif [ "$state" -ne 0 ]; then
    echo "⚠️ 로컬 브랜치 정리 미확인: $branch; 조회 실패($state)" >&2
    failed=1
  elif git branch -d "$branch"; then
    if git show-ref --verify --quiet "refs/heads/$branch"; then
      state=0
    else
      state=$?
    fi
    if [ "$state" -eq 1 ]; then
      echo "🧹 로컬 브랜치 삭제 확인: $branch"
    else
      echo "⚠️ 로컬 브랜치 정리 미확인: $branch; 삭제 후 조회($state)" >&2
      failed=1
    fi
  else
    echo "⚠️ 로컬 브랜치 보존: $branch; 사용 중인 worktree·미병합 여부를 확인하세요" >&2
    failed=1
  fi
done
branch="release/v$version"
if remote=$(git ls-remote --exit-code --heads origin "refs/heads/$branch" 2>&1); then
  state=0
else
  state=$?
fi
if [ "$state" -eq 0 ]; then
  if git push origin --delete "$branch"; then
    if remote=$(git ls-remote --exit-code --heads origin "refs/heads/$branch" 2>&1); then
      state=0
    else
      state=$?
    fi
  else
    echo "⚠️ 원격 브랜치 삭제 실패: $branch" >&2
    failed=1
    state=-1
  fi
fi
if [ "$state" -eq 2 ]; then
  echo "🧹 원격 브랜치 없음 확인: $branch"
elif [ "$state" -eq 0 ]; then
  echo "⚠️ 원격 브랜치 남아 있음: $branch" >&2
  failed=1
elif [ "$state" -ne -1 ]; then
  echo "⚠️ 원격 브랜치 정리 미확인: $branch; 조회 실패($state): $remote" >&2
  failed=1
fi
exit "$failed"

#!/usr/bin/env bash
# Run after release and back-merge. Cleanup failure does not undo their merges.
set -u
if [ "$#" -ne 1 ] || ! [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'usage: release-cleanup.sh <major.minor.patch>' >&2
  exit 2
fi
version=$1
failed=0
if [ "$(git symbolic-ref --quiet --short HEAD)" != develop ]; then
  echo '⚠️ 정리 중단: develop에서만 실행하세요' >&2
  exit 1
fi
if ! git rev-parse --verify 'refs/heads/develop^{commit}' >/dev/null; then
  echo '⚠️ 정리 중단: 병합 대상 develop 조회 실패' >&2
  exit 1
fi
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
  elif ! git merge-base --is-ancestor "refs/heads/$branch" refs/heads/develop; then
    echo "⚠️ 로컬 브랜치 보존: $branch; develop 병합 미확인" >&2
    failed=1
  # Recheck against develop inside Git's normal deletion path, even if a
  # tracking upstream or local tip changed after our explicit ancestry query.
  # Command-scoped configuration preserves the stored upstream and worktree guard.
  elif git -c "branch.$branch.remote=" branch -d "$branch"; then
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
  read -r remote_oid remote_ref <<< "$remote"
  if [ "$remote_ref" != "refs/heads/$branch" ] ||
     ! git merge-base --is-ancestor "$remote_oid" refs/heads/develop; then
    echo "⚠️ 원격 브랜치 보존: $branch; develop 병합 미확인" >&2
    failed=1
    state=-1
  elif git push --force-with-lease="refs/heads/$branch:$remote_oid" origin ":refs/heads/$branch"; then
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

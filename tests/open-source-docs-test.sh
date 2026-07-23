#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }
contains() {
  local file="$1" pattern="$2" label="$3"
  if grep -Eq "$pattern" "$ROOT/$file"; then pass "$label"; else fail "$label"; fi
}

for file in docs/quick-start.md docs/support.md SECURITY.md CONTRIBUTING.md CHANGELOG.md; do
  if [[ -s "$ROOT/$file" ]]; then pass "$file 존재"; else fail "$file 존재"; fi
done

contains README.md 'docs/quick-start\.md' 'README에서 영문 Quick Start 연결'
contains README.md 'docs/support\.md' 'README에서 지원 환경 연결'
contains docs/quick-start.md 'profile-doctor\.mjs' 'Quick Start doctor 안내'
contains docs/quick-start.md 'installable:false|not.*marketplace|not marketplace' 'Quick Start 미승격 경계'
contains docs/support.md 'supported' '지원 수준 명시'
contains docs/support.md 'best-effort' 'best-effort 수준 명시'
contains docs/support.md 'unsupported' '미지원 수준 명시'
contains SECURITY.md 'private|privately|비공개' '비공개 보안 신고 안내'
contains SECURITY.md 'secret|token|credential' '보안 신고 민감정보 주의'
contains CONTRIBUTING.md 'develop' 'develop 기반 기여 안내'
contains CONTRIBUTING.md 'pr-create\.sh' 'PR wrapper 안내'
contains CONTRIBUTING.md 'Conventional Commits' '커밋 형식 안내'
contains CHANGELOG.md 'generated|Generated' 'CHANGELOG 생성물 표시'
contains CHANGELOG.md 'generate-changelog\.mjs' 'CHANGELOG 재생성 명령'

node "$ROOT/scripts/generate-changelog.mjs" >"$TMP/tagged-a.md"
node "$ROOT/scripts/generate-changelog.mjs" >"$TMP/tagged-b.md"
if cmp -s "$TMP/tagged-a.md" "$TMP/tagged-b.md" &&
   grep -q '^## v0\.60\.0 - ' "$TMP/tagged-a.md"; then
  pass "태그 기반 CHANGELOG 결정론"
else
  fail "태그 기반 CHANGELOG 결정론"
fi

node "$ROOT/scripts/generate-changelog.mjs" --release v0.61.0 >"$TMP/candidate-a.md"
node "$ROOT/scripts/generate-changelog.mjs" --release v0.61.0 >"$TMP/candidate-b.md"
if cmp -s "$TMP/candidate-a.md" "$TMP/candidate-b.md"; then
  pass "사전 태그 release candidate 결정론"
else
  fail "사전 태그 release candidate 결정론"
fi
if cmp -s "$ROOT/CHANGELOG.md" "$TMP/candidate-a.md"; then
  pass "현재 CHANGELOG release candidate 재현"
else
  fail "현재 CHANGELOG release candidate 재현"
fi
if grep -q '^## v0\.61\.0 - ' "$TMP/candidate-a.md" &&
   grep -q '^## v0\.60\.0 - ' "$TMP/candidate-a.md" &&
   [ "$(grep -n '^## v0\.61\.0 - ' "$TMP/candidate-a.md" | cut -d: -f1)" -lt "$(grep -n '^## v0\.60\.0 - ' "$TMP/candidate-a.md" | cut -d: -f1)" ]; then
  pass "사전 태그 v0.61.0 항목 생성"
else
  fail "사전 태그 v0.61.0 항목 생성"
fi
if grep -q 'generate-changelog\.mjs --release' "$ROOT/plugins/harness-guard/skills/release/SKILL.md"; then
  pass "release skill이 사전 태그 CHANGELOG 생성"
else
  fail "release skill이 사전 태그 CHANGELOG 생성"
fi
contains plugins/harness-guard/skills/release/SKILL.md \
  'git pull --ff-only origin main' 'release skill이 divergent local main 차단'
contains plugins/harness-guard/skills/release/SKILL.md \
  'mergeCommit\.oid' 'release skill이 merged PR SHA 조회'
contains plugins/harness-guard/skills/release/SKILL.md \
  'git rev-parse origin/main.*MERGE_SHA' 'release skill이 origin/main과 merge SHA 일치 검증'
contains plugins/harness-guard/skills/release/SKILL.md \
  'git tag v\$VERSION "\$MERGE_SHA"' 'release skill이 검증된 merge SHA를 명시적으로 태그'
contains plugins/harness-guard/skills/release/SKILL.md \
  'git push origin "refs/tags/v\$VERSION"' 'release skill이 exact tag ref push'

STABLE_REPO="$TMP/stable-repo"
mkdir -p "$STABLE_REPO/scripts"
cp "$ROOT/scripts/generate-changelog.mjs" "$STABLE_REPO/scripts/"
git -C "$STABLE_REPO" init -q
git -C "$STABLE_REPO" config user.name tester
git -C "$STABLE_REPO" config user.email tester@example.test
printf 'base\n' >"$STABLE_REPO/state.txt"
git -C "$STABLE_REPO" add .
GIT_AUTHOR_DATE=2026-01-01T00:00:00Z GIT_COMMITTER_DATE=2026-01-01T00:00:00Z \
  git -C "$STABLE_REPO" commit -qm "chore: baseline"
git -C "$STABLE_REPO" tag v1.0.0
printf 'fix\n' >>"$STABLE_REPO/state.txt"
git -C "$STABLE_REPO" add state.txt
GIT_AUTHOR_DATE=2026-01-02T00:00:00Z GIT_COMMITTER_DATE=2026-01-02T00:00:00Z \
  git -C "$STABLE_REPO" commit -qm "fix: release note"
node "$STABLE_REPO/scripts/generate-changelog.mjs" --release v1.1.0 >"$TMP/stable-a.md"
printf 'docs\n' >>"$STABLE_REPO/state.txt"
git -C "$STABLE_REPO" add state.txt
GIT_AUTHOR_DATE=2026-01-03T00:00:00Z GIT_COMMITTER_DATE=2026-01-03T00:00:00Z \
  git -C "$STABLE_REPO" commit -qm "docs: release prep"
node "$STABLE_REPO/scripts/generate-changelog.mjs" --release v1.1.0 >"$TMP/stable-b.md"
if cmp -s "$TMP/stable-a.md" "$TMP/stable-b.md" &&
   grep -q '^## v1\.1\.0 - 2026-01-02$' "$TMP/stable-b.md"; then
  pass "release prep 커밋 뒤 candidate 날짜 안정"
else
  fail "release prep 커밋 뒤 candidate 날짜 안정"
fi
git -C "$STABLE_REPO" tag v1.1.0
node "$STABLE_REPO/scripts/generate-changelog.mjs" --release v1.1.0 >"$TMP/stable-tagged.md"
if cmp -s "$TMP/stable-b.md" "$TMP/stable-tagged.md"; then
  pass "정식 태그 뒤 candidate 명령 byte 재현"
else
  fail "정식 태그 뒤 candidate 명령 byte 재현"
fi

echo "RESULT: $PASS PASS, $FAIL FAIL"
[[ "$FAIL" -eq 0 ]]

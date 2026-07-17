#!/usr/bin/env bash
# /loop 결정적 안전장치 실행 계약.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="$ROOT/plugins/harness-guard/skills/loop/SKILL.md"
TIMEOUT="$ROOT/plugins/harness-guard/scripts/run-with-timeout.mjs"
FINGERPRINT="$ROOT/plugins/harness-guard/scripts/worktree-fingerprint.mjs"
PASS=0
FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass() { echo "PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }

node "$TIMEOUT" --seconds 1 -- "printf 완료" >/dev/null 2>&1 && pass "timeout helper 정상 명령" || fail "timeout helper 정상 명령"
node "$TIMEOUT" --seconds 0.05 -- "sleep 1" >/dev/null 2>&1
[ "$?" -eq 124 ] && pass "timeout helper가 124로 중단" || fail "timeout helper timeout 종료코드"

REPO="$TMP/repo"
mkdir -p "$REPO"
git -C "$REPO" init -q
git -C "$REPO" config user.name test
git -C "$REPO" config user.email test@example.com
printf '기준\n' > "$REPO/tracked.txt"
git -C "$REPO" add tracked.txt
git -C "$REPO" commit -qm 'test: baseline'

fp() { node "$FINGERPRINT" --repo "$REPO"; }
BASE=$(fp)
printf '첫 내용\n' > "$REPO/untracked file.txt"
UNTRACKED_ONE=$(fp)
printf '둘째 내용\n' > "$REPO/untracked file.txt"
UNTRACKED_TWO=$(fp)
git -C "$REPO" add "untracked file.txt"
STAGED=$(fp)
printf '수정\n' > "$REPO/tracked.txt"
TRACKED=$(fp)

if [ "$BASE" != "$UNTRACKED_ONE" ] && [ "$UNTRACKED_ONE" != "$UNTRACKED_TWO" ] \
  && [ "$UNTRACKED_TWO" != "$STAGED" ] && [ "$STAGED" != "$TRACKED" ]; then
  pass "tracked·staged·동일 untracked 경로의 내용 변화 감지"
else
  fail "worktree fingerprint 변화 감지"
fi

grep -Fq -- '--timeout' "$SKILL" && pass "사용자 지정 timeout 옵션" || fail "timeout 옵션 누락"
[ "$(grep -Fc 'run-with-timeout.mjs' "$SKILL")" -ge 2 ] && pass "초기·반복 검증 timeout 적용" || fail "timeout 적용 지점 부족"
grep -Fq 'worktree-fingerprint.mjs' "$SKILL" && pass "내용 기반 fingerprint 적용" || fail "fingerprint helper 누락"
grep -Fq 'ITER=$((ITER+1))' "$SKILL" && pass "실제 반복 시작 시 count 증가" || fail "반복 count 교정 누락"
grep -Fq 'git add -A -- .' "$SKILL" && pass "공백·삭제·untracked 안전 staging" || fail "안전 staging 누락"
if ! grep -Fq 'git add $(git diff' "$SKILL"; then pass "취약한 명령 치환 staging 제거"; else fail "취약한 staging 잔존"; fi
if ! grep -Eq 'Co-Authored-By: Claude|Claude Sonnet' "$SKILL"; then pass "특정 AI attribution 하드코딩 제거"; else fail "특정 AI attribution 잔존"; fi

if python3 - "$SKILL" <<'PY'
from pathlib import Path
import sys

phase = Path(sys.argv[1]).read_text(encoding="utf-8").split("### Phase 2b", 1)[1].split("### Phase 2c", 1)[0]
command = phase.index('node "$PLUGIN_ROOT/scripts/run-with-timeout.mjs"')
stuck_break = phase.index('if [ "$TREE_AFTER" = "$TREE_BEFORE" ]')
assert command < stuck_break
PY
then
  pass "최신 통과 판정을 stuck 중단보다 먼저 실행"
else
  fail "stuck이 최신 통과 판정을 가림"
fi

if python3 - "$SKILL" <<'PY'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")
phase = text.split("### Phase 2b", 1)[1].split("### Phase 2c", 1)[0]
assert 'FILE_PATH="${STATUS_LINE#???}"' in phase
assert 'grep -Fqx -- "$FILE_PATH"' in phase
assert 'FIXED_FILES="${FIXED_FILES}${FIXED_FILES:+$\'\\n\'}${FILE_PATH}"' in phase
PY
then
  pass "반복별 수정 파일을 중복 없이 누적"
else
  fail "FIXED_FILES 누적 구현 누락"
fi

if python3 - "$SKILL" <<'PY'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")
root = 'PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}"'
phase_0 = text.split("### 0-3.", 1)[1].split("---", 1)[0]
phase_2a = text.split("### Phase 2a", 1)[1].split("### Phase 2b", 1)[0]
phase_2b = text.split("### Phase 2b", 1)[1].split("### Phase 2c", 1)[0]
assert all(root in phase for phase in (phase_0, phase_2a, phase_2b))
PY
then
  pass "독립 shell phase마다 plugin root 복구"
else
  fail "phase 간 PLUGIN_ROOT 의존"
fi

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

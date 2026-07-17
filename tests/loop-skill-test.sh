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
SURVIVOR_PID=""
cleanup() {
  if [ -n "$SURVIVOR_PID" ] && kill -0 "$SURVIVOR_PID" 2>/dev/null; then
    kill -KILL "$SURVIVOR_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

pass() { echo "PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }

node "$TIMEOUT" --seconds 1 -- "printf 완료" >/dev/null 2>&1 && pass "timeout helper 정상 명령" || fail "timeout helper 정상 명령"
node "$TIMEOUT" --seconds 0.05 -- "sleep 1" >/dev/null 2>&1
[ "$?" -eq 124 ] && pass "timeout helper가 124로 중단" || fail "timeout helper timeout 종료코드"

DESCENDANT_PID_FILE="$TMP/timeout-descendant.pid"
TIMEOUT_RC=0
node "$TIMEOUT" --seconds 0.2 -- "sh -c 'trap \"\" TERM; printf \"%s\\n\" \"\$\$\" > \"$DESCENDANT_PID_FILE\"; while :; do sleep 1; done' & wait" \
  >/dev/null 2>&1 || TIMEOUT_RC=$?
if [ "$TIMEOUT_RC" -eq 124 ] && [ -s "$DESCENDANT_PID_FILE" ]; then
  SURVIVOR_PID="$(head -n 1 "$DESCENDANT_PID_FILE")"
  if kill -0 "$SURVIVOR_PID" 2>/dev/null; then
    fail "timeout helper가 TERM 무시 descendant를 남김"
  else
    SURVIVOR_PID=""
    pass "timeout helper가 TERM 무시 descendant까지 종료"
  fi
else
  fail "timeout helper descendant 종료 계약 준비"
fi

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

: > "$REPO/empty.bin"
EMPTY=$(fp)
dd if=/dev/zero of="$REPO/multi-chunk.bin" bs=65536 count=3 2>/dev/null
MULTI_CHUNK_BEFORE=$(fp)
printf 'x' | dd of="$REPO/multi-chunk.bin" bs=1 seek=131072 conv=notrunc 2>/dev/null
MULTI_CHUNK_AFTER=$(fp)
if [ -n "$EMPTY" ] && [ "$EMPTY" != "$MULTI_CHUNK_BEFORE" ] \
  && [ "$MULTI_CHUNK_BEFORE" != "$MULTI_CHUNK_AFTER" ]; then
  pass "빈 파일·다중 청크 파일 fingerprint 변화 감지"
else
  fail "빈 파일 또는 다중 청크 fingerprint 계약"
fi

if grep -Fq 'readSync' "$FINGERPRINT" \
  && grep -Fq 'FILE_READ_CHUNK_SIZE' "$FINGERPRINT" \
  && ! grep -Fq 'readFileSync(fd)' "$FINGERPRINT"; then
  pass "untracked 일반 파일을 고정 크기 청크로 hash"
else
  fail "untracked 일반 파일이 전체 크기 Buffer를 사용"
fi

OUTSIDE_FILE="$TMP/outside-secret.txt"
printf '외부 비밀 1\n' > "$OUTSIDE_FILE"
ln -s "$OUTSIDE_FILE" "$REPO/untracked-link"
LINK_BEFORE=$(fp)
printf '외부 비밀 2\n' > "$OUTSIDE_FILE"
LINK_AFTER=$(fp)
if [ "$LINK_BEFORE" = "$LINK_AFTER" ]; then
  pass "untracked symlink는 repo 밖 대상 내용 대신 링크 문자열 hash"
else
  fail "untracked symlink가 repo 밖 대상 내용을 읽음"
fi

FIFO_TARGET="$TMP/fingerprint-target.pipe"
mkfifo "$FIFO_TARGET"
ln -sfn "$FIFO_TARGET" "$REPO/untracked-link"
SYMLINK_FIFO_RC=0
node "$TIMEOUT" --seconds 1 -- "node '$FINGERPRINT' --repo '$REPO'" >/dev/null 2>&1 \
  || SYMLINK_FIFO_RC=$?
if [ "$SYMLINK_FIFO_RC" -eq 0 ]; then
  pass "FIFO 대상 symlink를 따라가지 않고 fingerprint 완료"
else
  fail "FIFO 대상 symlink fingerprint 종료코드=$SYMLINK_FIFO_RC"
fi

ln -sfn "$OUTSIDE_FILE" "$REPO/untracked-link"
mkfifo "$REPO/untracked.pipe"
SPECIAL_RC=0
node "$TIMEOUT" --seconds 1 -- "node '$FINGERPRINT' --repo '$REPO'" >/dev/null 2>&1 \
  || SPECIAL_RC=$?
if [ "$SPECIAL_RC" -eq 0 ]; then
  pass "untracked special file을 읽지 않고 fingerprint 완료"
else
  fail "untracked special file fingerprint 종료코드=$SPECIAL_RC"
fi
if grep -Fq 'captureParentDirectories' "$FINGERPRINT" \
  && [ "$(grep -Fc 'assertRegularPath' "$FINGERPRINT")" -ge 3 ] \
  && grep -Fq 'realpathSync(absolutePath)' "$FINGERPRINT"; then
  pass "untracked regular 파일 읽기 전·후 parent·실제 경로 재검증"
else
  fail "parent-directory symlink race 재검증 누락"
fi

grep -Fq -- '--timeout' "$SKILL" && pass "사용자 지정 timeout 옵션" || fail "timeout 옵션 누락"
[ "$(grep -Fc 'run-with-timeout.mjs' "$SKILL")" -ge 2 ] && pass "초기·반복 검증 timeout 적용" || fail "timeout 적용 지점 부족"
grep -Fq 'worktree-fingerprint.mjs' "$SKILL" && pass "내용 기반 fingerprint 적용" || fail "fingerprint helper 누락"
grep -Fq 'ITER=$((ITER+1))' "$SKILL" && pass "실제 반복 시작 시 count 증가" || fail "반복 count 교정 누락"
if grep -Fq 'REPO_ROOT=$(git rev-parse --show-toplevel)' "$SKILL" \
  && grep -Fq 'git -C "$REPO_ROOT" add -A -- .' "$SKILL"; then
  pass "repo root 전체를 공백·삭제·untracked 안전 staging"
else
  fail "repo root 기준 안전 staging 누락"
fi
if ! grep -Fq 'git add $(git diff' "$SKILL"; then pass "취약한 명령 치환 staging 제거"; else fail "취약한 staging 잔존"; fi
if ! grep -Eq 'Co-Authored-By: Claude|Claude Sonnet' "$SKILL"; then pass "특정 AI attribution 하드코딩 제거"; else fail "특정 AI attribution 잔존"; fi

if python3 - "$SKILL" <<'PY'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")
argument_phase = text.split("### 0-0.", 1)[1].split("### 0-1.", 1)[0]
branch_phase = text.split("### 0-1.", 1)[1].split("### 0-2.", 1)[0]
assert "implicit invocation" in argument_phase
assert "NO_COMMIT=true" in argument_phase
assert "commit을 명시적으로 요청" in argument_phase
assert '&& [ "$NO_COMMIT" != "true" ]' in branch_phase
PY
then
  pass "commit 권한을 먼저 계산하고 보호 브랜치는 checkpoint일 때만 차단"
else
  fail "implicit no-commit보다 보호 브랜치 차단이 먼저 실행됨"
fi

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

phase = Path(sys.argv[1]).read_text(encoding="utf-8").split("### Phase 2b", 1)[1].split("### Phase 2c", 1)[0]
success = phase.split("**통과(exit 0)**이면:", 1)[1].split("**실패", 1)[0]
failure = phase.split("**실패", 1)[1]
assert "Phase 2c" in success and success.index("Phase 2c") < success.index("Phase 3")
assert "Phase 2c" in failure and failure.index("Phase 2c") < failure.index("Phase 3")
PY
then
  pass "성공·실패 모두 checkpoint 후 다음 분기"
else
  fail "성공 또는 실패가 checkpoint를 건너뜀"
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

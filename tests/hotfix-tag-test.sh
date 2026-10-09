#!/usr/bin/env bash
# Execute the skill's real tag block against fake Git/GitHub boundaries.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
python3 - "$ROOT/plugins/harness-guard/skills/hotfix/SKILL.md" "$TMP/tag.sh" <<'PY'
import sys,pathlib,re
text=pathlib.Path(sys.argv[1]).read_text().split('## Phase 3',1)[1].split('## Phase 4',1)[0]
blocks=re.findall(r'```bash\n(.*?)```',text,re.S)
block=next(b for b in blocks if '# 2.' in b)
pathlib.Path(sys.argv[2]).write_text('set -euo pipefail\n'+block)
PY
cat > "$TMP/gh" <<'SHGH'
#!/usr/bin/env bash
[ "${META_FAIL:-0}" = 0 ] || exit 1
case "$*" in
 *'--json state'*) printf '%s\n' "${PR_STATE:-MERGED}";;
 *'--json mergeCommit'*) printf '%s\n' "${MERGE_SHA:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}";;
 *) exit 9;;
esac
SHGH
cat > "$TMP/git" <<'SHGIT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$CALLS"
case "$1" in
 describe) echo v1.2.3;;
 rev-parse) echo bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb;;
 show-ref) [ "${EXISTING_TAG:-0}" = 1 ];;
 tag) printf 'TAG %s %s\n' "$2" "${3:-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb}" >> "$EFFECTS";;
 push) printf 'PUSH %s\n' "$*" >> "$EFFECTS";;
 *) exit 0;;
esac
SHGIT
chmod +x "$TMP/gh" "$TMP/git"
PASS=0 FAIL=0
check() {
 local desc=$1 mode=$2; shift 2
 : > "$TMP/calls"; : > "$TMP/effects"
 set +e
 env PATH="$TMP:$PATH" CALLS="$TMP/calls" EFFECTS="$TMP/effects" PR=42 TAG=v1.2.4 PATCH=1.2.4 "$@" bash "$TMP/tag.sh" > "$TMP/out" 2>&1
 local rc=$?
 set -e
 if [ "$mode" = valid ]; then
  if [ "$rc" = 0 ] && [ "$(cat "$TMP/effects")" = $'TAG v1.2.4 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nPUSH push origin refs/tags/v1.2.4' ]; then
   echo "PASS: $desc"; PASS=$((PASS+1)); return
  fi
 elif [ "$rc" -ne 0 ] && [ ! -s "$TMP/effects" ]; then
  echo "PASS: $desc"; PASS=$((PASS+1)); return
 fi
 echo "FAIL: $desc exit=$rc"; FAIL=$((FAIL+1))
}
check 'later main and unrelated local tag cannot change target/tag push' valid
check 'unmerged PR cannot be tagged' invalid PR_STATE=OPEN
check 'metadata failure cannot be tagged' invalid META_FAIL=1
check 'malformed merge SHA cannot be tagged' invalid MERGE_SHA=bad
check 'existing target tag cannot be replaced' invalid EXISTING_TAG=1
check 'malformed requested tag cannot be published' invalid TAG=bad
printf '결과: PASS=%s FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" = 0 ]

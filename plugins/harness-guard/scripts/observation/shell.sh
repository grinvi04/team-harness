# Internal observation bridge. No child process while capture has no lease file.
OBS_STATE="" OBS_RESTORE_STATE="" OBS_OUTCOME="unverified" OBS_REASON="RESULT_UNVERIFIED" OBS_MERGE_RESULT=0
_obs_bridge="${BASH_SOURCE[0]%/*}/bridge.mjs"
obs_start() {
  local data="${HARNESS_OBSERVE_DIR:-${PLUGIN_DATA:+$PLUGIN_DATA/observability}}" response found="" file
  [ -n "$data" ] && [ -d "$data" ] || return 0
  for file in "$data"/lease-*.json; do [ ! -f "$file" ] || found=1; done
  [ -n "$found" ] || return 0
  response=$(printf '%s' "${2:-}" | node "$_obs_bridge" start "$1" "${3:-}" "${4:-}" 2>/dev/null) || return 0
  [ -n "$response" ] || return 0
  HARNESS_OBSERVE_PARENT="${response%%$'\n'*}"; export HARNESS_OBSERVE_PARENT
  OBS_STATE="${response#*$'\n'}"
}
obs_finish() {
  [ -n "$OBS_STATE" ] || return 0
  printf '%s' "$OBS_STATE" | node "$_obs_bridge" finish "$2" "$1" "$3" >/dev/null 2>&1 || true
}
obs_exit() {
  local rc="$1" outcome="$OBS_OUTCOME" reason="$OBS_REASON"
  if [ "$rc" -ne 0 ]; then
    if [ "$OBS_MERGE_RESULT" != 1 ]; then outcome=fail; [ "$reason" != RESULT_UNVERIFIED ] || reason=EXECUTION_ERROR
    elif [ "$outcome" = pass ]; then outcome=unverified; reason=RESULT_UNVERIFIED; fi
  fi
  obs_finish "$rc" "$outcome" "$reason"
  return 0
}
obs_merge_begin() {
  OBS_MERGE_RESULT=1 OBS_OUTCOME=unverified OBS_REASON=RESULT_UNVERIFIED
}
obs_merge_result() {
  local response
  obs_merge_begin
  [ -n "$OBS_STATE" ] || return 0
  response=$(printf '%s' "$OBS_STATE" | node "$_obs_bridge" result "$1" 2>/dev/null) || return 0
  [ -n "$response" ] || return 0
  OBS_OUTCOME="${response%%$'\n'*}" OBS_REASON="${response#*$'\n'}"
}
obs_restore_start() {
  [ -n "$OBS_STATE" ] && [ -z "$OBS_RESTORE_STATE" ] || return 0
  OBS_RESTORE_STATE=$(printf '%s' "$OBS_STATE" | node "$_obs_bridge" child pending 0 RESTORE_ATTEMPT 2>/dev/null) || true
}
obs_restore_finish() {
  [ -n "$OBS_RESTORE_STATE" ] || return 0
  printf '%s' "$OBS_RESTORE_STATE" | node "$_obs_bridge" finish "$1" "$2" "$3" >/dev/null 2>&1 || true
  OBS_RESTORE_STATE=""
}

#!/usr/bin/env bash
# Install non-bypassable local Codex feature pins for every supported local surface.
set -euo pipefail

TARGET=${CODEX_REQUIREMENTS_PATH:-/etc/codex/requirements.toml}
MARKER='# team-harness managed codex requirements v2'
LEGACY_MARKER='# team-harness managed codex requirements v1'
MODE=${1:---install}

usage() {
  echo "usage: $0 [--install|--check|--uninstall]" >&2
}

is_managed() {
  [ -f "$TARGET" ] || return 1
  first=$(sed -n '1p' "$TARGET")
  [ "$first" = "$MARKER" ] || [ "$first" = "$LEGACY_MARKER" ]
}

expected() {
  printf '%s\n' \
    "$MARKER" \
    '' \
    '[features]' \
    'hooks = true'
}

require_write_access() {
  local parent
  parent=$(dirname "$TARGET")
  if { [ -e "$TARGET" ] && [ ! -w "$TARGET" ]; } || { [ ! -e "$TARGET" ] && [ ! -w "$parent" ]; }; then
    [ "${HARNESS_CODEX_REQUIREMENTS_ESCALATED:-0}" = 1 ] && {
      echo "write access denied: $TARGET" >&2
      exit 3
    }
    exec sudo env HARNESS_CODEX_REQUIREMENTS_ESCALATED=1 CODEX_REQUIREMENTS_PATH="$TARGET" bash "$0" "$MODE"
  fi
}

case "$MODE" in
  --check)
    is_managed || { echo "not managed: $TARGET" >&2; exit 1; }
    [ "$(cat "$TARGET")" = "$(expected)" ] || { echo "managed requirements drift: $TARGET" >&2; exit 1; }
    echo "OK: hooks=true, unified_exec=native ($TARGET)"
    ;;
  --install)
    if [ -e "$TARGET" ] && ! is_managed; then
      echo "refusing to overwrite foreign requirements: $TARGET" >&2
      exit 2
    fi
    mkdir -p "$(dirname "$TARGET")" 2>/dev/null || true
    require_write_access
    mkdir -p "$(dirname "$TARGET")"
    tmp="${TARGET}.tmp.$$"
    trap 'rm -f "${tmp:-}"' EXIT
    expected >"$tmp"
    chmod 0644 "$tmp"
    mv "$tmp" "$TARGET"
    trap - EXIT
    "$0" --check
    ;;
  --uninstall)
    [ -e "$TARGET" ] || { echo "already absent: $TARGET"; exit 0; }
    is_managed || { echo "refusing to remove foreign requirements: $TARGET" >&2; exit 2; }
    require_write_access
    rm "$TARGET"
    echo "removed: $TARGET"
    ;;
  *) usage; exit 2;;
esac

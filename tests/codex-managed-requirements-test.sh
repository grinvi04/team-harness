#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
INSTALLER="$ROOT/scripts/install-codex-managed-requirements.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
TARGET="$TMP/etc/codex/requirements.toml"
export CODEX_REQUIREMENTS_PATH="$TARGET"

mkdir -p "$(dirname "$TARGET")"
bash "$INSTALLER" --install
bash "$INSTALLER" --check
first=$(cksum "$TARGET")
bash "$INSTALLER" --install
[ "$(cksum "$TARGET")" = "$first" ] || { echo 'FAIL: install is not idempotent'; exit 1; }

if ! grep -Fxq '[features]' "$TARGET" \
  || ! grep -Fxq 'hooks = true' "$TARGET" \
  || ! grep -Fxq 'unified_exec = false' "$TARGET"; then
  echo 'FAIL: required feature pins missing'
  exit 1
fi

bash "$INSTALLER" --uninstall
[ ! -e "$TARGET" ] || { echo 'FAIL: uninstall left managed file'; exit 1; }
bash "$INSTALLER" --uninstall

printf '%s\n' '[features]' 'unified_exec = true' >"$TARGET"
before=$(cksum "$TARGET")
if bash "$INSTALLER" --install >/dev/null 2>&1; then
  echo 'FAIL: foreign requirements were overwritten'
  exit 1
fi
if bash "$INSTALLER" --uninstall >/dev/null 2>&1; then
  echo 'FAIL: foreign requirements were removed'
  exit 1
fi
[ "$(cksum "$TARGET")" = "$before" ] || { echo 'FAIL: foreign requirements changed'; exit 1; }

echo 'PASS: managed requirements install/check/idempotence/uninstall/foreign-file refusal'

#!/usr/bin/env bash
# Official gh-stack engine + Harness candidate checks; never installs an extension.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/stack.mjs" "$@"

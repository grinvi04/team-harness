#!/usr/bin/env bash
# Common project checks only; product-specific checks remain required.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

{{CHECKS}}printf 'PASS\n'

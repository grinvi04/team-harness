#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node --test "$ROOT/tests/observation-integration-test.mjs"

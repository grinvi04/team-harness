#!/usr/bin/env bash
# Common project checks only; product-specific checks remain required.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

(
  cd "$PROJECT_ROOT/backend"
  ./gradlew check bootJar
)

(
  cd "$PROJECT_ROOT/frontend"
  npm ci
  npm run type-check
  npm run lint
  npm run test:unit
  npm run build
  ./node_modules/.bin/playwright install chromium
  npm run test:e2e
)

printf 'PASS\n'

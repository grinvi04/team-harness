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

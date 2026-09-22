#!/usr/bin/env node
import { constants, accessSync, lstatSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const usage = 'Usage: node scripts/setup-local.mjs --project <Spring Boot+Vue project> [--apply]'
function stat(file) {
  try { return lstatSync(file) } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}
function requiredFile(file) {
  if (!stat(file)?.isFile()) throw new Error(`Required regular file: ${file}`)
}
function readObject(file) {
  requiredFile(file)
  const value = JSON.parse(readFileSync(file, 'utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Expected JSON object: ${file}`)
  return value
}
function main(args) {
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return }
  let project, apply = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && !project && args[i + 1] && !args[i + 1].startsWith('--')) project = args[++i]
    else if (args[i] === '--apply' && !apply) apply = true
    else throw new Error(usage)
  }
  if (!project) throw new Error(usage)
  const root = path.resolve(project)
  if (!stat(root)?.isDirectory()) throw new Error(`Project must be an existing directory, not a link: ${root}`)
  requiredFile(path.join(root, 'backend/gradlew'))
  accessSync(path.join(root, 'backend/gradlew'), constants.X_OK)
  if (!['build.gradle', 'build.gradle.kts'].some(name => stat(path.join(root, 'backend', name))?.isFile())) {
    throw new Error('Required: backend/build.gradle or backend/build.gradle.kts')
  }
  const pkg = readObject(path.join(root, 'frontend/package.json'))
  readObject(path.join(root, 'frontend/package-lock.json'))
  for (const dependency of ['vue', '@playwright/test']) {
    const version = pkg.dependencies?.[dependency] || pkg.devDependencies?.[dependency]
    if (typeof version !== 'string' || !version.trim()) throw new Error(`Required frontend dependency: ${dependency}`)
  }
  const commands = ['type-check', 'lint', 'test:unit', 'build', 'test:e2e']
  for (const name of commands) {
    if (typeof pkg.scripts?.[name] !== 'string' || !pkg.scripts[name].trim()) throw new Error(`Required frontend script: ${name}`)
  }
  const directory = path.join(root, 'scripts'), target = path.join(directory, 'check-harness.sh')
  const parent = stat(directory)
  if (parent && !parent.isDirectory()) throw new Error(`scripts must be a regular directory, not a link: ${directory}`)
  if (stat(target)) throw new Error(`Refusing to replace existing destination: ${target}`)
  const template = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../templates/local/spring-vue/check-harness.sh')
  const content = readFileSync(template, 'utf8')
  console.log(`${apply ? 'CREATE' : 'PREVIEW'}: ${target}`)
  console.log('backend: ./gradlew check bootJar')
  console.log(`frontend: npm ci → ${commands.slice(0, -1).map(name => `npm run ${name}`).join(' → ')} → ./node_modules/.bin/playwright install chromium → npm run test:e2e`)
  if (stat(path.join(directory, 'check-local.sh'))) console.log('Keep existing check-local.sh and its product-specific checks; this adds a separate common checker.')
  if (!apply) { console.log('No files changed. Add --apply to create the checker.'); return }
  if (!parent) mkdirSync(directory)
  writeFileSync(target, content, { flag: 'wx', mode: 0o755 })
  console.log('Created. Review the file, then run: bash scripts/check-harness.sh (from the project root).')
  console.log('Installation did not run checks. Keep product-specific checks and document the command in AGENTS.md.')
}
try { main(process.argv.slice(2)) } catch (error) {
  console.error(`ERROR: ${error.message}`)
  process.exitCode = 1
}

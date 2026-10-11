#!/usr/bin/env node
import { constants, accessSync, lstatSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { loadCatalog, repositoryRoot, selectStack } from './stack-catalog.mjs'

const usage = 'Usage: node scripts/setup-local.mjs --project <project> [--stack spring-boot|vue|spring-boot+vue] [--backend-dir relative] [--frontend-dir relative] [--apply]'
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
function requiredDirectory(root, relative = '') {
  let current = root
  for (const part of ['', ...relative.split('/').filter(Boolean)]) {
    if (part) current = path.join(current, part)
    if (!stat(current)?.isDirectory()) throw new Error(`Required directory, not a link: ${current}`)
  }
  return current
}
function main(args) {
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return }
  const values = {}, flags = { '--project': 'project', '--stack': 'stack', '--backend-dir': 'backendDir', '--frontend-dir': 'frontendDir' }
  let apply = false
  for (let i = 0; i < args.length; i++) {
    const key = flags[args[i]]
    if (key && !Object.hasOwn(values, key) && args[i + 1] && !args[i + 1].startsWith('--')) values[key] = args[++i]
    else if (args[i] === '--apply' && !apply) apply = true
    else throw new Error(usage)
  }
  if (!values.project) throw new Error(usage)
  const stack = ({ spring: 'spring-boot', 'spring+vue': 'spring-boot+vue' })[values.stack] ?? values.stack ?? 'spring-boot+vue'
  if (!['spring-boot', 'vue', 'spring-boot+vue'].includes(stack)) throw new Error(`Unsupported local stack: ${stack}`)
  const options = Object.fromEntries(['backendDir', 'frontendDir'].filter(key => Object.hasOwn(values, key)).map(key => [key, values[key]]))
  const selected = selectStack(stack === 'spring-boot+vue' ? '2+6' : stack === 'spring-boot' ? '2' : '6', options)
  const root = path.resolve(values.project)
  requiredDirectory(root)
  const directories = selected.mode === 'composed' ? selected.directories : { backend: '', frontend: '' }
  const commands = ['type-check', 'lint', 'test:unit', 'build', 'test:e2e']
  if (stack !== 'vue') {
    const backend = requiredDirectory(root, directories.backend)
    requiredFile(path.join(backend, 'gradlew'))
    accessSync(path.join(backend, 'gradlew'), constants.X_OK)
    if (!['build.gradle', 'build.gradle.kts'].some(name => stat(path.join(backend, name))?.isFile())) {
      throw new Error('Required: build.gradle or build.gradle.kts in the Spring Boot directory')
    }
  }
  if (stack !== 'spring-boot') {
    const frontend = requiredDirectory(root, directories.frontend)
    const pkg = readObject(path.join(frontend, 'package.json'))
    readObject(path.join(frontend, 'package-lock.json'))
    for (const dependency of ['vue', '@playwright/test']) {
      const version = pkg.dependencies?.[dependency] || pkg.devDependencies?.[dependency]
      if (typeof version !== 'string' || !version.trim()) throw new Error(`Required frontend dependency: ${dependency}`)
    }
    for (const name of commands) {
      if (typeof pkg.scripts?.[name] !== 'string' || !pkg.scripts[name].trim()) throw new Error(`Required frontend script: ${name}`)
    }
  }
  const directory = path.join(root, 'scripts'), target = path.join(directory, 'check-harness.sh')
  const parent = stat(directory)
  if (parent && !parent.isDirectory()) throw new Error(`scripts must be a regular directory, not a link: ${directory}`)
  if (stat(target)) throw new Error(`Refusing to replace existing destination: ${target}`)
  const catalog = loadCatalog()
  const checks = (stack === 'spring-boot+vue' ? ['spring-boot', 'vue'] : [stack]).map(key => {
    const source = catalog.stacks.find(entry => entry.key === key).localCheck
    const role = key === 'spring-boot' ? 'backend' : 'frontend'
    const destination = directories[role] ? `$PROJECT_ROOT/${directories[role]}` : '$PROJECT_ROOT'
    return readFileSync(path.join(repositoryRoot, source), 'utf8').replace(`$PROJECT_ROOT/${role}`, destination)
  }).join('\n') + '\n'
  const content = readFileSync(path.join(repositoryRoot, 'templates/local/check-harness.sh'), 'utf8').replace('{{CHECKS}}', checks)
  console.log(`${apply ? 'CREATE' : 'PREVIEW'}: ${target}`)
  if (stack !== 'vue') console.log(`${directories.backend || '.'}: ./gradlew check bootJar`)
  if (stack !== 'spring-boot') console.log(`${directories.frontend || '.'}: npm ci → ${commands.slice(0, -1).map(name => `npm run ${name}`).join(' → ')} → ./node_modules/.bin/playwright install chromium → npm run test:e2e`)
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

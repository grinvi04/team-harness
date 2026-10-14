#!/usr/bin/env node
import { constants, accessSync, lstatSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { loadCatalog, repositoryRoot } from './stack-catalog.mjs'

const usage = 'Usage: node scripts/setup-local.mjs --list | --project <project> --stack <stack> [--e2e] [--apply]'
function stat(file) {
  try { return lstatSync(file) } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}
function requiredFile(file) {
  if (!stat(file)?.isFile()) throw new Error(`Required regular file, not a link: ${file}`)
}
function readObject(file) {
  requiredFile(file)
  const value = JSON.parse(readFileSync(file, 'utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Expected JSON object: ${file}`)
  return value
}
function requiredDirectory(root) {
  let current = path.parse(root).root
  for (const part of root.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part)
    if (!stat(current)?.isDirectory()) throw new Error(`Required directory, not a link: ${current}`)
  }
}
function main(args) {
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return }
  const catalog = loadCatalog()
  if (args.length === 1 && args[0] === '--list') {
    for (const stack of catalog.stacks) console.log(`${stack.key}: ${stack.localProfile ? `supported (${stack.localProfile.runner}; E2E ${stack.localProfile.e2e})` : 'unsupported locally'}`)
    console.log('npm only: pnpm/yarn/bun unsupported; Spring Boot Gradle only: Maven unsupported. Local combinations unsupported.')
    return
  }
  const values = {}, flags = { '--project': 'project', '--stack': 'stack' }
  let apply = false, e2e = false
  for (let i = 0; i < args.length; i++) {
    const key = flags[args[i]]
    if (key && !Object.hasOwn(values, key) && args[i + 1] && !args[i + 1].startsWith('--')) values[key] = args[++i]
    else if (args[i] === '--apply' && !apply) apply = true
    else if (args[i] === '--e2e' && !e2e) e2e = true
    else throw new Error(usage)
  }
  if (!values.project || !values.stack) throw new Error(usage)
  const key = values.stack === 'spring' ? 'spring-boot' : values.stack
  const stack = catalog.stacks.find(entry => entry.key === key), profile = stack?.localProfile
  if (!profile) throw new Error(`Unsupported local stack: ${key}`)
  if (e2e && profile.e2e === 'unsupported') throw new Error(`E2E unsupported for ${key}`)
  const root = path.resolve(values.project)
  requiredDirectory(root)
  let commands, skipped = []
  if (profile.runner === 'Gradle') {
    requiredFile(path.join(root, 'gradlew'))
    accessSync(path.join(root, 'gradlew'), constants.X_OK)
    if (!['build.gradle', 'build.gradle.kts'].some(name => stat(path.join(root, name))?.isFile())) {
      throw new Error('Required: build.gradle or build.gradle.kts in the Spring Boot directory')
    }
    commands = ['./gradlew check bootJar']
  } else if (profile.runner === 'npm') {
    const pkg = readObject(path.join(root, 'package.json'))
    readObject(path.join(root, 'package-lock.json'))
    for (const lock of ['npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb']) {
      if (stat(path.join(root, lock))) throw new Error(`Unsupported or ambiguous lockfile: ${lock}`)
    }
    if (Object.hasOwn(pkg, 'packageManager') && (typeof pkg.packageManager !== 'string' || !/^npm@\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.+-]+)?$/.test(pkg.packageManager))) {
      throw new Error('Unsupported packageManager: expected npm@<version>')
    }
    const includeE2e = e2e || profile.e2e === 'required'
    for (const dependency of [...profile.dependencies, ...(includeE2e ? ['@playwright/test'] : [])]) {
      const version = pkg.dependencies?.[dependency] || pkg.devDependencies?.[dependency]
      if (typeof version !== 'string' || !version.trim()) throw new Error(`Required dependency: ${dependency}`)
    }
    const required = [...profile.required, ...(includeE2e ? ['test:e2e'] : [])]
    for (const name of [...required, ...profile.optional.filter(name => Object.hasOwn(pkg.scripts ?? {}, name))]) {
      if (typeof pkg.scripts?.[name] !== 'string' || !pkg.scripts[name].trim()) throw new Error(`Required script: ${name}`)
    }
    const names = profile.order.filter(name => required.includes(name) || Object.hasOwn(pkg.scripts ?? {}, name))
    skipped = profile.optional.filter(name => !names.includes(name)).map(name => `NOT SELECTED: ${name} (not declared)`)
    if (!includeE2e) skipped.push('NOT SELECTED: E2E (use --e2e if required by the product)')
    commands = ['npm ci', ...names.filter(name => name !== 'test:e2e').map(name => key === 'node' && name === 'test' ? 'npm test' : `npm run ${name}`),
      ...(includeE2e ? ['./node_modules/.bin/playwright install chromium', 'npm run test:e2e'] : [])]
  } else throw new Error(`Unsupported local runner: ${profile.runner}`)
  const directory = path.join(root, 'scripts'), target = path.join(directory, 'check-harness.sh')
  const parent = stat(directory)
  if (parent && !parent.isDirectory()) throw new Error(`scripts must be a regular directory, not a link: ${directory}`)
  if (stat(target)) throw new Error(`Refusing to replace existing destination: ${target}`)
  // Legacy sources retain their exact commands; new npm profiles render the selected catalog order.
  const checks = stack.localCheck
    ? readFileSync(path.join(repositoryRoot, stack.localCheck), 'utf8').replace(`$PROJECT_ROOT/${key === 'spring-boot' ? 'backend' : 'frontend'}`, '$PROJECT_ROOT') + '\n'
    : `(\n  cd "$PROJECT_ROOT"\n${commands.map(command => `  ${command}`).join('\n')}\n)\n\n${skipped.map(message => `printf '%s\\n' '${message}'`).join('\n')}\n`
  const content = readFileSync(path.join(repositoryRoot, 'templates/local/check-harness.sh'), 'utf8').replace('{{CHECKS}}', checks)
  console.log(`${apply ? 'CREATE' : 'PREVIEW'}: ${target}`)
  console.log(`.: ${commands.join(' → ')}`)
  for (const message of skipped) console.log(message)
  if (stat(path.join(directory, 'check-local.sh'))) console.log('Keep existing check-local.sh and its product-specific checks; this adds a separate common checker.')
  if (!apply) { console.log('No files changed. Add --apply to create the checker.'); return }
  if (!parent) mkdirSync(directory)
  writeFileSync(target, content, { flag: 'wx', mode: 0o755 })
  console.log('Created. Review the file, then run: bash scripts/check-harness.sh (from the project root).')
  console.log('Installation did not run checks. Execution runs product commands and install scripts. Keep product-required checks and document the command in AGENTS.md.')
}
try { main(process.argv.slice(2)) } catch (error) {
  console.error(`ERROR: ${error.message}`)
  process.exitCode = 1
}

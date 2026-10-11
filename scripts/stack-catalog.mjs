#!/usr/bin/env node
// Stack selection metadata shared by setup and deterministic CI generation.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadCatalog(root = repositoryRoot) {
  const catalog = JSON.parse(readFileSync(resolve(root, 'templates/stacks.json'), 'utf8'));
  const keys = ['node', 'spring', 'python', 'rails', 'nextjs', 'vue'];
  if (catalog.schemaVersion !== 2 || !Array.isArray(catalog.stacks)
      || catalog.stacks.length !== 6 || catalog.stacks.some((stack, i) => stack.id !== i + 1
        || stack.key !== keys[i] || JSON.stringify(stack.roles) !== JSON.stringify(
          i === 0 ? ['backend', 'frontend'] : i < 4 ? ['backend'] : ['frontend']))) {
    throw new Error('Invalid stack catalog: expected schema 2 and selections 1..6');
  }
  return catalog;
}

function validateDirectory(directory) {
  if (typeof directory !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_.-]*(\/[A-Za-z0-9_][A-Za-z0-9_.-]*)*$/.test(directory)) {
    throw new Error('Invalid directory: use a relative path without traversal or special characters');
  }
  return directory;
}

export function selectStack(selection, options = {}, catalog = loadCatalog()) {
  if (!options || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some(key => !['backendDir', 'frontendDir'].includes(key))) {
    throw new Error('Invalid stack options');
  }
  const id = String(selection);
  if (!/^[1-6](\+[1-6])?$/.test(id)) throw new Error('Invalid stack selection: choose 1..6 or backend+frontend');
  const stacks = id.split('+').map(value => catalog.stacks.find(entry => entry.id === Number(value)));
  if (stacks.length === 1) {
    if (Object.keys(options).length) throw new Error('Directory options require a composed selection');
    const stack = stacks[0];
    return {
      ...stack,
      mode: 'single',
      checks: [...stack.checks, ...catalog.commonChecks, ...stack.database.checks],
    };
  }
  const [backend, frontend] = stacks;
  if (!backend.roles.includes('backend') || !frontend.roles.includes('frontend')) {
    throw new Error('Invalid composition: backend must be 1..4 and frontend must be 1, 5 or 6');
  }
  const backendDir = validateDirectory(Object.hasOwn(options, 'backendDir') ? options.backendDir : 'backend');
  const frontendDir = validateDirectory(Object.hasOwn(options, 'frontendDir') ? options.frontendDir : 'frontend');
  if (backendDir === frontendDir) throw new Error('Backend and frontend directories must be different');
  return {
    mode: 'composed',
    selection: id,
    label: `${backend.label} + ${frontend.label}`,
    template: null,
    backend: { id: backend.id, key: backend.key, preset: backend.key, directory: backendDir },
    frontend: { id: frontend.id, key: frontend.key, preset: frontend.key, directory: frontendDir },
    directories: { backend: backendDir, frontend: frontendDir },
    checks: ['backend', 'frontend', 'secret-scan', ...catalog.commonChecks, ...backend.database.checks],
    rules: [...new Set([...backend.rules, ...frontend.rules])],
    database: backend.database,
  };
}

export function parseSelectionArgs(args) {
  if (!args.length) throw new Error('Missing stack selection');
  const options = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = { '--backend-dir': 'backendDir', '--frontend-dir': 'frontendDir' }[args[i]];
    if (!key || Object.hasOwn(options, key) || i + 1 >= args.length) throw new Error('Invalid or duplicate directory option');
    options[key] = args[i + 1];
  }
  return { selection: args[0], options };
}

export function renderMenu(catalog = loadCatalog()) {
  return ['스택을 선택하세요:', ...catalog.stacks.map(stack => `  ${stack.id}) ${stack.label}`)].join('\n');
}

function main(args) {
  if (args.length === 1 && args[0] === '--menu') {
    console.log(renderMenu());
    return;
  }
  if (args[0] !== '--select') {
    throw new Error('Usage: stack-catalog.mjs --menu | --select <1..6|backend+frontend> [--backend-dir relative] [--frontend-dir relative]');
  }
  const { selection, options } = parseSelectionArgs(args.slice(1));
  console.log(JSON.stringify(selectStack(selection, options)));
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

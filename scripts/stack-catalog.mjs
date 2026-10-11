#!/usr/bin/env node
// Stack selection metadata shared by setup and deterministic CI generation.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadCatalog(root = repositoryRoot) {
  const catalog = JSON.parse(readFileSync(resolve(root, 'templates/stacks.json'), 'utf8'));
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.stacks)
      || catalog.stacks.length !== 8 || catalog.stacks.some((stack, i) => stack.id !== i + 1)) {
    throw new Error('Invalid stack catalog: expected schema 1 and selections 1..8');
  }
  return catalog;
}

export function selectStack(selection, frontend, catalog = loadCatalog()) {
  const id = String(selection);
  if (!/^[1-8]$/.test(id)) throw new Error('Invalid stack selection: choose 1..8');
  const stack = catalog.stacks.find(entry => entry.id === Number(id));
  const selectedFrontend = frontend ?? stack.frontend.default;
  if (frontend !== undefined && !stack.frontendOptions.includes(frontend)) {
    throw new Error(`Unsupported frontend '${frontend}' for stack ${id}`);
  }
  const extraRules = selectedFrontend === null ? [] : catalog.frontendPresets[selectedFrontend]?.rules;
  if (!Array.isArray(extraRules)) throw new Error('Invalid frontend preset');
  return {
    ...stack,
    checks: [...stack.checks, ...catalog.commonChecks, ...stack.database.checks],
    rules: [...new Set([...stack.rules, ...extraRules])],
    frontend: { ...stack.frontend, selected: selectedFrontend },
  };
}

export function renderMenu(catalog = loadCatalog()) {
  return ['스택을 선택하세요:', ...catalog.stacks.map(stack => `  ${stack.id}) ${stack.label}`)].join('\n');
}

function main(args) {
  if (args.length === 1 && args[0] === '--menu') {
    console.log(renderMenu());
    return;
  }
  if (args[0] !== '--select' || ![2, 4].includes(args.length)
      || (args.length === 4 && args[2] !== '--frontend')) {
    throw new Error('Usage: stack-catalog.mjs --menu | --select <1..8> [--frontend node|vue|nextjs]');
  }
  console.log(JSON.stringify(selectStack(args[1], args[3])));
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

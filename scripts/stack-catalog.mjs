#!/usr/bin/env node
// Stack selection metadata shared by setup and deterministic CI generation.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadCatalog(root = repositoryRoot) {
  const catalog = JSON.parse(readFileSync(resolve(root, 'templates/stacks.json'), 'utf8'));
  const stacks = catalog.stacks;
  if (catalog.schemaVersion !== 3 || catalog.pathBase !== 'repository-root' || !Array.isArray(stacks)
      || !stacks.length || stacks.some(stack => !Number.isSafeInteger(stack.id) || stack.id < 1
        || !/^[a-z][a-z0-9-]*$/.test(stack.key) || !Array.isArray(stack.roles) || !stack.roles.length
        || stack.roles.some(role => !['backend', 'frontend'].includes(role))
        || new Set(stack.roles).size !== stack.roles.length)
      || new Set(stacks.map(stack => stack.id)).size !== stacks.length
      || new Set(stacks.map(stack => stack.key)).size !== stacks.length) {
    throw new Error('Invalid stack catalog: expected schema 3, unique ids/keys and declared roles');
  }
  for (const file of [...Object.values(catalog.commonSources), ...Object.values(catalog.ruleSources),
    ...catalog.stacks.flatMap(stack => [stack.sources.header, ...stack.sources.jobs,
      ...Object.values(stack.assetSources), ...(stack.localCheck ? [stack.localCheck] : []),
      ...(stack.profileQuality ? [stack.profileQuality] : []),
      ...Object.values(stack.frameworks ?? stack.uiProfiles ?? {}).map(profile => profile.steps)])]) {
    if (typeof file !== 'string' || !/^templates\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(file)
        || file.split('/').some(part => part === '.' || part === '..')) throw new Error('Invalid catalog path');
  }
  for (const stack of catalog.stacks) {
    if (stack.rules.some(rule => !catalog.ruleSources[rule])) throw new Error('Missing catalog rule source');
  }
  return catalog;
}

function withProfile(stack, options) {
  for (const key of ['framework', 'ui']) {
    if (Object.hasOwn(options, key) && (typeof options[key] !== 'string' || !/^[a-z][a-z-]*$/.test(options[key]))) {
      throw new Error(`Invalid ${key} option`);
    }
  }
  const framework = options.framework ?? null;
  let ui = options.ui ?? null;
  if (framework && (stack.key !== 'python' || !stack.frameworks?.[framework])) {
    throw new Error('Unsupported framework for selected stack');
  }
  let profile;
  if (framework) {
    profile = stack.frameworks[framework];
    ui ??= profile.defaultUi;
    if (!profile.uiModes.includes(ui)) throw new Error('Unsupported UI for selected Python framework');
  } else if (ui) {
    if (stack.key !== 'rails' || !stack.uiProfiles?.[ui]) throw new Error('UI requires a Python framework or Rails');
    profile = stack.uiProfiles[ui];
  }
  return { ...stack, framework, ui, legacy: stack.id <= 6 && !profile,
    versionComponents: { ...stack.versionComponents, ...profile?.versionComponents },
    ...(profile ? { profile, rules: [...new Set([...stack.rules, ...profile.rules])],
      database: stack.key === 'python' ? { tool: null, checks: stack.database.checks, optional: true } : { tool: null, checks: [] } } : {}) };
}

function project(stack, role, directory) {
  return { role, directory, stackKey: stack.key, framework: stack.framework, ui: stack.ui, legacy: stack.legacy, versionComponents: stack.versionComponents };
}

function validateDirectory(directory) {
  if (typeof directory !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_.-]*(\/[A-Za-z0-9_][A-Za-z0-9_.-]*)*$/.test(directory)) {
    throw new Error('Invalid directory: use a relative path without traversal or special characters');
  }
  return directory;
}

export function selectStack(selection, options = {}, catalog = loadCatalog()) {
  if (!options || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some(key => !['backendDir', 'frontendDir', 'framework', 'ui'].includes(key))) {
    throw new Error('Invalid stack options');
  }
  const id = String(selection);
  if (!/^[1-9][0-9]*(\+[1-9][0-9]*)?$/.test(id)) throw new Error('Invalid stack selection: choose a catalog id or backend+frontend');
  const stacks = id.split('+').map(value => catalog.stacks.find(entry => entry.id === Number(value)));
  if (stacks.some(stack => !stack)) throw new Error('Invalid stack selection: id not in catalog');
  if (stacks.length === 1) {
    if (Object.hasOwn(options, 'backendDir') || Object.hasOwn(options, 'frontendDir')) throw new Error('Directory options require a composed selection');
    const stack = withProfile(stacks[0], options);
    return {
      ...stack,
      mode: 'single',
      ruleSources: catalog.ruleSources,
      checks: [...stack.checks, ...catalog.commonChecks, ...stack.database.checks],
      projects: [project(stack, 'project', '.')],
    };
  }
  const backend = withProfile(stacks[0], options), frontend = withProfile(stacks[1], {});
  if (!backend.roles.includes('backend') || !frontend.roles.includes('frontend')) {
    throw new Error('Invalid composition: selected stacks must declare backend and frontend roles');
  }
  if (backend.profile && backend.ui !== 'api') throw new Error('Separate frontend composition requires API UI mode');
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
    ruleSources: catalog.ruleSources,
    assetSources: backend.assetSources,
    projects: [project(backend, 'backend', backendDir), project(frontend, 'frontend', frontendDir)],
  };
}

export function parseSelectionArgs(args) {
  if (!args.length) throw new Error('Missing stack selection');
  const options = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = { '--backend-dir': 'backendDir', '--frontend-dir': 'frontendDir', '--framework': 'framework', '--ui': 'ui' }[args[i]];
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
    throw new Error('Usage: stack-catalog.mjs --menu | --select <catalog-id|backend+frontend> [--backend-dir relative] [--frontend-dir relative] [--framework name] [--ui mode]');
  }
  const { selection, options } = parseSelectionArgs(args.slice(1));
  console.log(JSON.stringify(selectStack(selection, options)));
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

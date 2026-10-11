// Read declared project evidence only. No package manager or application code is executed.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const helper = join(dirname(fileURLToPath(import.meta.url)), 'read-stack-pyproject.py');
const exact = value => typeof value === 'string' && /^v?\d+(?:\.\d+){0,3}(?:[-+][A-Za-z0-9.-]+)?$/.test(value.trim());
const safeNpmRange = value => typeof value === 'string' && /^[A-Za-z0-9*^~<>=|.,+! -]+$/.test(value) ? value : 'unsupported declaration';
const canonicalPython = name => name.toLowerCase().replace(/[-_.]+/g, '-');

function literalGradleEvidence(build) {
  // A bounded lexical reader, not a Gradle evaluator. Only direct named DSL blocks are supported.
  const evidence={boot:[],java:[],vendor:null};
  if(build.includes('"""') || build.includes("'".repeat(3)))return evidence;
  const tokens=[...build.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|[A-Za-z_][A-Za-z0-9_]*|\d+|[^\s]/g)]
    .map(m=>m[0]).filter(t=>!t.startsWith('//') && !t.startsWith('/*'));
  const scopes=[];
  const literal=t=>t && (t[0]==='"' || t[0]==="'") ? t.slice(1,-1):null;
  for(let i=0;i<tokens.length;i++) {
    if(tokens[i]==='{'){scopes.push(tokens[i-1]);continue;}
    if(tokens[i]==='}'){scopes.pop();continue;}
    if(scopes.length===1 && scopes[0]==='plugins' && tokens[i]==='id'){
      let k=i+1;if(tokens[k]==='(')k++;if(literal(tokens[k])!=='org.springframework.boot')continue;k++;if(tokens[k]===')')k++;
      if(tokens[k++]!=='version'){evidence.boot.push('unresolved');continue;}if(tokens[k]==='(')k++;
      evidence.boot.push(literal(tokens[k]) || 'unresolved');
    }
    if(scopes.length===2 && scopes[0]==='java' && scopes[1]==='toolchain'){
      if(tokens.slice(i,i+4).join('')==='JavaLanguageVersion.of(')evidence.java.push(/^\d+$/.test(tokens[i+4]) && tokens[i+5]===')'?tokens[i+4]:'unresolved');
      if(tokens.slice(i,i+3).join('')==='JvmVendorSpec.ADOPTIUM')evidence.vendor='adoptium';
    }
  }
  if(evidence.boot.length>1)evidence.boot=['unresolved'];
  if(evidence.java.length>1)evidence.java=['unresolved'];
  return evidence;
}

export function inspectStackProjects(projectRoot, selected) {
  const root = resolve(projectRoot), result = { selection: selected, observed: {}, inputs: [], issues: [], requirements: [], packages: {}, tooling: {} };
  const issue = (code, target, action) => result.issues.push({ code, target, action });
  function safePath(path, allowMissing = false) {
    const rel = relative(root, path);
    if (rel.startsWith('../') || rel === '..' || rel.startsWith('/') || rel.includes('\\')) throw new Error('outside project');
    let current = root;
    for (const part of ['.', ...rel.split('/').filter(Boolean)]) {
      if (part !== '.') current = join(current, part);
      try { if (lstatSync(current).isSymbolicLink()) throw new Error('symlink input'); }
      catch (error) { if (allowMissing && error.code === 'ENOENT') return; throw error; }
    }
  }
  function read(project, path) {
    const absolute = resolve(root, project.directory, path), inputPath = relative(root, absolute).split('\\').join('/');
    try {
      safePath(absolute, true);
      let stat;
      try { stat = lstatSync(absolute); }
      catch (error) { if (error.code === 'ENOENT') { result.inputs.push({ path: inputPath, sha256: null }); return null; } throw error; }
      if (!stat.isFile() || stat.size > 8 * 1024 * 1024) throw new Error('not a bounded regular file');
      const data = readFileSync(absolute);
      result.inputs.push({ path: inputPath, sha256: createHash('sha256').update(data).digest('hex') });
      return data.toString('utf8');
    } catch { issue('UNSAFE_PATH', inputPath, 'Use a regular project-local input; symlinks and oversized files cannot be inspected.'); return null; }
  }
  function json(project, path) {
    const text = read(project, path);
    if (text === null) return null;
    try {
      const value = JSON.parse(text);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object required');
      return value;
    } catch { issue('INVALID_JSON', `${project.role}.${path}`, 'Repair the JSON manifest or lockfile and run inspection again.'); return null; }
  }
  function observe(project, component, descriptor, values, declared = null) {
    const target = `${project.role}.${component}`, candidates = values.filter(v => v !== null && v !== undefined);
    let state = 'absent', version = null;
    if (candidates.length) {
      const isExact = value => {
        if (['node', 'python', 'ruby'].includes(descriptor.ecosystem)) return typeof value === 'string' && /^v?\d+\.\d+\.\d+$/.test(value.trim());
        if (descriptor.ecosystem === 'pypi') return typeof value === 'string' && /^\d+(?:\.\d+)+(?:a\d+|b\d+|rc\d+|\.post\d+|\.dev\d+)?(?:\+[a-z0-9.]+)?$/i.test(value.trim());
        return exact(value);
      };
      if (candidates.every(isExact) && new Set(candidates.map(v => v.trim().replace(/^v/, ''))).size === 1) {
        state = 'exact'; version = candidates[0].trim().replace(/^v/, '');
      } else { state = 'unresolved'; issue('UNRESOLVED_VERSION', target, 'Provide one consistent exact version in the supported runtime declaration or lockfile.'); }
    }
    if (state === 'absent' && descriptor.required) issue('MISSING_COMPONENT', target, 'Confirm that the selected component is declared and locked; inspection does not install it.');
    result.observed[target] = { state, version, ...descriptor, ...(declared ? { declared } : {}) };
  }
  function runtime(project, component, files, descriptor) {
    const declarations = files.map(path => read(project, path)).filter(v => v !== null).map(v => v.trim());
    observe(project, component, descriptor, declarations);
  }
  function node(project, components) {
    const usesNpm = Object.values(components).some(d => d.ecosystem === 'npm');
    const pkg = json(project, 'package.json'), lock = json(project, 'package-lock.json');
    if (!pkg) issue('MISSING_MANIFEST', project.role, 'Provide a valid package.json for this existing Node project.');
    const alternate = ['pnpm-lock.yaml', 'yarn.lock', 'npm-shrinkwrap.json', 'bun.lock', 'bun.lockb'].filter(path => read(project, path) !== null);
    if (alternate.length) issue('UNSUPPORTED_LOCK', project.role, 'This inspector supports package-lock.json v2/v3 only; do not convert the application lockfile automatically.');
    if (lock && (![2, 3].includes(lock.lockfileVersion) || !lock.packages || typeof lock.packages !== 'object')) issue('UNSUPPORTED_LOCK', project.role, 'Use a supported npm lock v2/v3 with the root package declaration.');
    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies, ...pkg?.optionalDependencies };
    result.tooling[project.role]={...result.tooling[project.role],scripts:Object.keys(pkg?.scripts || {}).filter(k=>typeof pkg.scripts[k]==='string' && pkg.scripts[k].trim())};
    if (pkg && ['dependencies', 'devDependencies', 'optionalDependencies'].some(key => pkg[key] && (typeof pkg[key] !== 'object' || Array.isArray(pkg[key])))) issue('INVALID_MANIFEST', project.role, 'Dependency maps must contain static package ranges.');
    if (usesNpm && !lock) issue('MISSING_LOCK', project.role, 'Resolve dependencies outside this read-only command and provide the npm lockfile.');
    if (project.stackKey === 'node') {
      for (const [name, range] of Object.entries(deps)) {
        // General Node profiles inspect direct npm declarations, never transitive packages.
        components[`npm:${name}`] = { ecosystem: 'npm', packageName: name, required: true };
        if (typeof range !== 'string') issue('INVALID_MANIFEST', `${project.role}.${name}`, 'Use a static dependency declaration.');
      }
    }
    if (project.stackKey === 'nuxt') {
      const configs = ['nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mjs'].map(path => read(project, path)).filter(v => v !== null);
      for (const config of configs) {
        const declaration = config.match(/\bmodules\s*:\s*\[([^\]]*)\]/s);
        if (/\bmodules\s*:/.test(config) && !declaration) issue('DYNAMIC_DECLARATION', `${project.role}.nuxt.modules`, 'Declare a static module list or review these modules separately.');
        if (declaration) {
          const entries = declaration[1].split(',').map(v => v.trim()).filter(Boolean);
          for (const entry of entries) {
            const match = entry.match(/^['"]([^'"]+)['"]$/);
            if (!match || !Object.hasOwn(deps, match[1])) { issue('UNRESOLVED_MODULE', `${project.role}.nuxt.modules`, 'Only declared packages in a static module list are supported.'); continue; }
            components[`module:${match[1]}`] = { ecosystem: 'npm', packageName: match[1], required: true };
          }
        }
      }
    }
    if (Object.hasOwn(deps, 'typescript')) components.typescript = { ecosystem: 'npm', packageName: 'typescript', required: false };
    result.packages[project.role] = Object.fromEntries(Object.entries(deps).map(([name, range]) => [name, { range:safeNpmRange(range), version: lock?.packages?.[`node_modules/${name}`]?.version ?? null, declared:true }]));
    for (const [path, entry] of Object.entries(lock?.packages ?? {})) {
      const name = path.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)$/)?.[1];
      if (name && !Object.hasOwn(result.packages[project.role], name)) result.packages[project.role][name] = { range:null, version:entry.version ?? null, declared:false };
    }
    for (const [component, descriptor] of Object.entries(components).filter(([, d]) => d.ecosystem === 'npm')) {
      const name = descriptor.packageName, rawDeclared = deps[name], declared = rawDeclared === undefined ? undefined : safeNpmRange(rawDeclared), entry = lock?.packages?.[`node_modules/${name}`];
      if (declared !== undefined) {
        const lockRoot = lock?.packages?.[''];
        const lockedRange = { ...lockRoot?.dependencies, ...lockRoot?.devDependencies, ...lockRoot?.optionalDependencies }[name];
        if (lock && rawDeclared !== lockedRange) issue('MANIFEST_LOCK_MISMATCH', `${project.role}.${component}`, 'Regenerate the application lockfile deliberately, then repeat inspection.');
        if (entry?.link) issue('UNSUPPORTED_LOCK', `${project.role}.${component}`, 'Workspace/link dependencies require a separate reviewed version check.');
        observe(project, component, descriptor, [entry?.version ?? (exact(declared) ? declared : declared)], declared);
        result.requirements.push({ target: `${project.role}.${component}`, ecosystem: 'npm', range: declared, origin: 'manifest' });
      } else observe(project, component, descriptor, []);
    }
    const engines = pkg?.engines?.node;
    if (engines !== undefined) result.requirements.push({ target: `${project.role}.node`, ecosystem: 'npm', range: safeNpmRange(engines), origin: 'engines.node' });
    runtime(project, 'node', ['.nvmrc', '.node-version'], components.node ?? { ecosystem: 'node', required: false });
  }
  function python(project, components) {
    const dependencies = [], req = [read(project, 'requirements.txt'), read(project, 'requirements-dev.txt')].filter(value=>value !== null).join('\n'), pyproject = read(project, 'pyproject.toml');
    for (const path of ['poetry.lock', 'uv.lock', 'Pipfile.lock']) if (read(project, path) !== null) issue('UNSUPPORTED_LOCK', project.role, 'Only PEP621/static requirements are supported; retain the existing application tooling.');
    if (req !== null) {
      for (const line of req.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        if (trimmed.startsWith('-') || /\s@\s/.test(trimmed)) issue('DYNAMIC_DECLARATION', project.role, 'Included files, editable or URL requirements are not resolved by this inspector.');
        else dependencies.push(trimmed.replace(/\s+#.*$/, ''));
      }
    }
    if (pyproject !== null) {
      const child = spawnSync(process.env.STACK_VERSION_PYTHON ?? 'python3', ['-I', helper], { input: pyproject, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 });
      let parsed;
      try { parsed = JSON.parse(child.stdout ?? ''); } catch { /* failure is reported below */ }
      if (child.error || child.status !== 0 || !parsed || parsed.error) issue('PYPROJECT_PARSER_UNAVAILABLE', project.role, 'Provide Python3.11+ with tomllib using STACK_VERSION_PYTHON; malformed PEP621 is also unverified.');
      else {
        dependencies.push(...parsed.dependencies);
        if (parsed.dynamicDependencies || parsed.unsupportedDependencyTable) issue('DYNAMIC_DECLARATION', project.role, 'Dynamic/non-PEP621 dependencies require a separate check.');
        if (parsed.requiresPython) result.requirements.push({ target: `${project.role}.python`, ecosystem: 'python', range: parsed.requiresPython, origin: 'requires-python' });
      }
    }
    const byName = new Map();
    for (const line of dependencies) {
      if (/:\/\/|\s@\s/.test(line)) { issue('DYNAMIC_DECLARATION',project.role,'URL dependency declarations are unsupported and are not echoed.'); continue; }
      const match = line.match(/^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?\s*(.*)$/);
      if (match) { const name = canonicalPython(match[1]); byName.set(name, [...(byName.get(name) ?? []), match[2]]); }
      else issue('INVALID_MANIFEST', project.role, 'Use static PEP508 dependency declarations.');
    }
    result.tooling[project.role]={dependencies:[...byName.keys()]};
    const frameworks = ['django', 'fastapi', 'flask'].filter(name => byName.has(name));
    if (!project.framework && frameworks.length > 1) issue('AMBIGUOUS_FRAMEWORK', project.role, 'Select --framework django, fastapi or flask explicitly.');
    if (!project.framework && frameworks.length === 1) components[frameworks[0]] = { ecosystem: 'pypi', packageName: frameworks[0], required: true };
    for (const [component, descriptor] of Object.entries(components).filter(([, d]) => d.ecosystem === 'pypi')) {
      const ranges = byName.get(canonicalPython(descriptor.packageName)) ?? [];
      const pinned = ranges.map(range => range.match(/^==\s*([0-9][A-Za-z0-9.+-]*)(?:\s*;.*)?$/)?.[1]).filter(Boolean);
      const versions = pinned.length ? pinned : ranges;
      observe(project, component, descriptor, versions, ranges[0]);
      for (const range of ranges) result.requirements.push({ target: `${project.role}.${component}`, ecosystem: 'python', range, origin: 'manifest' });
    }
    runtime(project, 'python', ['.python-version'], components.python);
    const runtimeTxt = read(project, 'runtime.txt');
    if (runtimeTxt !== null) {
      const version = runtimeTxt.trim().replace(/^python-/, '');
      const existing = result.observed[`${project.role}.python`];
      observe(project, 'python', components.python, [existing.state === 'exact' ? existing.version : null, version]);
    }
    if (project.ui === 'htmx') {
      const pkg = json(project, 'package.json');
      if (Object.hasOwn({ ...pkg?.dependencies, ...pkg?.devDependencies }, 'htmx.org')) {
        node(project, { node: { ecosystem: 'node', required: false }, htmx: { ecosystem: 'npm', packageName: 'htmx.org', required: true } });
      } else issue('UNRESOLVED_UI_VERSION', `${project.role}.htmx`, 'An exact htmx.org npm pin is supported. CDN/browser pins outside these manifests need a separate check; django-htmx is not required.');
    }
  }
  function rails(project, components) {
    const gemfile = read(project, 'Gemfile'), lock = read(project, 'Gemfile.lock'), importmap = read(project, 'config/importmap.rb');
    const gems = new Map(), declarations = new Map();
    if (!gemfile) issue('MISSING_MANIFEST', project.role, 'Provide the existing Gemfile.');
    if (!lock) issue('MISSING_LOCK', project.role, 'Provide Gemfile.lock; this read-only inspector does not resolve gems.');
    for (const line of lock?.split('\n') ?? []) {
      const match = line.match(/^    ([A-Za-z0-9_-]+) \(([0-9][A-Za-z0-9.+-]*)\)/);
      if (match) gems.set(match[1], match[2]);
    }
    for (const line of gemfile?.split('\n') ?? []) {
      const text = line.trim();
      if (!/^gem\b/.test(text)) continue;
      const match = text.match(/^gem\s+['"]([A-Za-z0-9_-]+)['"](?:\s*,\s*['"]([^'"]+)['"])?\s*(?:#.*)?$/);
      if (!match) issue('DYNAMIC_DECLARATION', project.role, 'Only literal Gemfile names/ranges are inspected; Ruby is never evaluated.');
      else declarations.set(match[1], match[2] ?? '>= 0');
    }
    result.tooling[project.role]={dependencies:[...declarations.keys()].filter(name=>gems.has(name))};
    const uiEvidence = [declarations.has('turbo-rails') || declarations.has('stimulus-rails') ? 'hotwire' : null, declarations.has('inertia_rails') ? 'inertia' : null].filter(Boolean);
    if (!project.ui && uiEvidence.length > 1) issue('AMBIGUOUS_UI', project.role, 'Select --ui hotwire, inertia-react, inertia-vue or api explicitly.');
    if (!project.ui && uiEvidence.length === 1) issue('UI_SELECTION_REQUIRED', project.role, 'Select the UI scope explicitly so the matching CI/rules can be generated.');
    for (const [component, descriptor] of Object.entries(components).filter(([, d]) => d.ecosystem === 'gem')) {
      const declared = declarations.get(descriptor.packageName), version = gems.get(descriptor.packageName);
      observe(project, component, descriptor, declared ? [version ?? declared] : [], declared);
      if (declared) result.requirements.push({ target: `${project.role}.${component}`, ecosystem: 'ruby', range: declared, origin: 'Gemfile' });
    }
    runtime(project, 'ruby', ['.ruby-version'], components.ruby);
    const lockedRuby = lock?.match(/RUBY VERSION\s*\n\s*ruby (\d+\.\d+\.\d+)(?:p\d+)?/)?.[1];
    if (lockedRuby) {
      const current = result.observed[`${project.role}.ruby`];
      observe(project, 'ruby', components.ruby, [current.state === 'exact' ? current.version : current.state === 'unresolved' ? 'unresolved' : null, lockedRuby]);
    }
    if (project.ui === 'hotwire') {
      const pkg = json(project, 'package.json');
      const npmDeps = { ...pkg?.dependencies, ...pkg?.devDependencies };
      const npmComponents = {};
      for (const [name, component, gem] of [['@hotwired/turbo-rails', 'turbo', 'turbo-rails'], ['@hotwired/stimulus', 'stimulus', 'stimulus-rails']]) {
        const line = importmap?.split('\n').find(value => value.includes(`"${name}"`) || value.includes(`'${name}'`));
        if (Object.hasOwn(npmDeps, name)) { npmComponents[component] = { ecosystem: 'npm', packageName: name, required: true }; }
        if (!line && Object.hasOwn(npmDeps, name)) continue;
        if (!line) { issue('UNRESOLVED_UI', `${project.role}.${component}`, 'Provide supported literal importmap pins or an npm-backed Hotwire declaration.'); continue; }
        const to = line.match(/\bto:\s*['"]([^'"]+)['"]/);
        if (!to) { issue('UNRESOLVED_IMPORTMAP', `${project.role}.${component}`, 'Provide a literal gem-local file or exact external version pin.'); continue; }
        if (/^https?:/.test(to[1])) {
          const version = to[1].match(/@(\d+\.\d+\.\d+)(?:[/?]|$)/)?.[1];
          const descriptor = { ecosystem: 'npm', packageName: component === 'turbo' ? '@hotwired/turbo' : name, required: true };
          observe(project, component, descriptor, [version ?? 'unresolved external pin']);
          if (!version) issue('UNRESOLVED_IMPORTMAP', `${project.role}.${component}`, 'Pin an exact browser package version; the gem version does not prove an external CDN version.');
        } else if (to[1].includes('/') || !gems.has(gem)) issue('UNRESOLVED_IMPORTMAP', `${project.role}.${component}`, 'Only gem-bundled local file names are supported; verify custom JS separately.');
      }
      // Importmap-only Hotwire has no mandatory Node runtime.
      if (Object.keys(npmComponents).length) node(project, { node: { ecosystem: 'node', required: false }, ...npmComponents });
      else observe(project, 'node', { ecosystem: 'node', required: false }, []);
    } else if (Object.values(components).some(d => d.ecosystem === 'npm')) node(project, components);
  }
  function springBoot(project, components) {
    const builds = ['build.gradle', 'build.gradle.kts'].map(path => read(project, path)).filter(v => v !== null);
    if (read(project, 'pom.xml') !== null) issue('UNSUPPORTED_BUILD_TOOL', project.role, 'The existing supported build tool is Gradle; do not convert Maven automatically.');
    if (builds.length !== 1) issue('UNRESOLVED_BUILD', project.role, 'Provide one supported Gradle build declaration.');
    const build=builds.join('\n'), evidence=literalGradleEvidence(build);
    if((!evidence.boot.length || evidence.boot.includes('unresolved')) && /org\.springframework\.boot/.test(build))issue('DYNAMIC_DECLARATION',`${project.role}.spring-boot`,'Only a literal version inside the direct plugins block is supported.');
    observe(project,'spring-boot',components['spring-boot'],evidence.boot.length?evidence.boot:[build?'unresolved':null]);
    observe(project,'java',{...components.java,versionScope:'feature',...(evidence.vendor?{vendor:evidence.vendor}:{})},evidence.java.length?evidence.java:[build?'unresolved':null]);
    const wrapper = read(project, 'gradle/wrapper/gradle-wrapper.properties');
    const gradle = wrapper?.match(/^distributionUrl=.*\/gradle-(\d+(?:\.\d+){1,2})-(?:bin|all)\.zip\s*$/m)?.[1];
    observe(project, 'gradle', components.gradle, [gradle ?? (wrapper ? 'unresolved' : null)]);
  }
  try { safePath(root); if (!lstatSync(root).isDirectory()) throw new Error('not directory'); }
  catch { issue('MISSING_PROJECT', '.', 'Provide an existing regular project directory.'); return result; }
  if (!Array.isArray(selected?.projects) || !selected.projects.length) { issue('INVALID_SELECTION', '.', 'Use the shared catalog selector.'); return result; }
  for (const project of selected.projects) {
    try { safePath(resolve(root, project.directory)); if (!lstatSync(resolve(root, project.directory)).isDirectory()) throw new Error('not directory'); }
    catch { issue('UNSAFE_PATH', project.directory, 'Each selected project must be an existing directory inside the project root without symlinks.'); continue; }
    if (!project.versionComponents || !Object.keys(project.versionComponents).length) { issue('UNCONFIGURED_SELECTION', project.role, 'Use a catalog with version component definitions.'); continue; }
    const components = structuredClone(project.versionComponents);
    if (project.stackKey === 'python') python(project, components);
    else if (project.stackKey === 'rails') rails(project, components);
    else if (project.stackKey === 'spring-boot') springBoot(project, components);
    else node(project, components);
  }
  result.inputs = [...new Map(result.inputs.map(input => [input.path, input])).values()].sort((a, b) => a.path.localeCompare(b.path));
  return result;
}

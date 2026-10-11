#!/usr/bin/env node
// Dependency-free CI fingerprint checker. A matching record is scoped evidence, not an app safety guarantee.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export const nodeInputs = ['package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','npm-shrinkwrap.json','bun.lock','bun.lockb','.nvmrc','.node-version'];
export const pythonInputs = ['requirements.txt','requirements-dev.txt','pyproject.toml','poetry.lock','uv.lock','Pipfile.lock','.python-version','runtime.txt'];
export const railsInputs = ['Gemfile','Gemfile.lock','config/importmap.rb','.ruby-version'];
export const bootInputs = ['build.gradle','build.gradle.kts','pom.xml','gradle/wrapper/gradle-wrapper.properties'];
export const nuxtInputs = ['nuxt.config.ts','nuxt.config.js','nuxt.config.mjs'];
const knownStacks = new Set(['node','spring-boot','python','rails','nextjs','vue','react','nuxt']);
const officialHosts = new Set(['registry.npmjs.org','pypi.org','rubygems.org','nodejs.org','raw.githubusercontent.com','api.github.com','www.python.org','www.ruby-lang.org','services.gradle.org','docs.gradle.org','docs.spring.io','api.adoptium.net']);
export function expectedStackInputs(project, observed) {
  const key=project.stackKey, paths=key === 'python' ? [...pythonInputs] : key === 'rails' ? [...railsInputs] : key === 'spring-boot' ? [...bootInputs] : [...nodeInputs];
  if (key === 'nuxt') paths.push(...nuxtInputs);
  if (key === 'python' && project.ui === 'htmx') paths.push(...nodeInputs);
  if (key === 'rails') {
    if (Object.entries(observed).some(([target,o])=>target.startsWith(`${project.role}.`) && o.ecosystem === 'npm')) paths.push(...nodeInputs);
    else if (project.ui === 'hotwire') paths.push('package.json');
  }
  return [...new Set(paths)].map(path=>project.directory === '.' ? path : `${project.directory}/${path}`);
}
export function fingerprintStackInput(root, input) {
  if (typeof input !== 'string' || !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(input) || input.split('/').some(p=>p === '.' || p === '..')) throw new Error('Unsafe input path');
  const absolute=resolve(root,input), rel=relative(root,absolute);
  if (rel.startsWith('../') || rel === '..') throw new Error('Input outside root');
  let current=resolve(root);
  if (!lstatSync(current).isDirectory() || lstatSync(current).isSymbolicLink()) throw new Error('Unsafe project root');
  for (const part of input.split('/')) {
    current=resolve(current,part);
    try { if (lstatSync(current).isSymbolicLink()) throw new Error('Symlink input'); }
    catch (error) { if(error.code === 'ENOENT') return null; throw error; }
  }
  const stat=lstatSync(absolute);
  if(!stat.isFile() || stat.size > 8*1024*1024) throw new Error('Not a bounded regular input');
  return createHash('sha256').update(readFileSync(absolute)).digest('hex');
}
export function checkStackRecord(projectRoot, record) {
  const root=resolve(projectRoot), issues=[];
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const issue=(code,target,action)=>issues.push({code,target,action});
  if (!record || record.schema !== 1 || record.status !== 'compatible' || !Array.isArray(record.issues) || record.issues.length
      || !Array.isArray(record.selection?.projects) || !record.selection.projects.length || !record.selection.projects.every(object) || !object(record.observed) || !Object.values(record.observed).every(object) || !object(record.targets) || !object(record.sources) || !Array.isArray(record.requirements) || !Array.isArray(record.inputs)) {
    return {valid:false,issues:[{code:'INVALID_RECORD',target:'record',action:'Run the full version checker to produce a compatible schema1 record.'}]};
  }
  const projects=record.selection.projects, allowed=new Set(), roles=new Set();
  for (const project of projects) {
    if (!['project','backend','frontend'].includes(project.role) || roles.has(project.role) || !knownStacks.has(project.stackKey)
        || typeof project.directory !== 'string' || (project.directory !== '.' && !/^[A-Za-z0-9_][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_][A-Za-z0-9_.-]*)*$/.test(project.directory))) {
      issue('INVALID_SELECTION','selection','Use the shared selector with unique roles and safe project directories.');continue;
    }
    roles.add(project.role);
    for (const path of expectedStackInputs(project,record.observed)) allowed.add(path);
  }
  if (projects.length > 2 || (projects.length === 1 && projects[0].role !== 'project') || (projects.length === 2 && (!roles.has('backend') || !roles.has('frontend') || projects[0].directory === projects[1].directory))) issue('INVALID_SELECTION','selection','Use one project or separate backend/frontend projects.');
  const actual=new Map();
  for (const input of record.inputs) {
    if (!input || !allowed.has(input.path) || actual.has(input.path) || (input.sha256 !== null && !/^[a-f0-9]{64}$/.test(input.sha256))) { issue('INVALID_FINGERPRINT','inputs','Only complete unique allowed input hashes or explicit absence are accepted.');continue; }
    actual.set(input.path,input.sha256);
    try { if (fingerprintStackInput(root,input.path) !== input.sha256) issue('INPUT_DRIFT',input.path,'Re-run version checking after deliberate project changes.'); }
    catch { issue('UNSAFE_INPUT',input.path,'Use regular project-local files without symlinks.'); }
  }
  for (const path of allowed) if (!actual.has(path)) issue('MISSING_FINGERPRINT',path,'Re-run inspection; absent inputs must also be recorded.');
  if (!Object.keys(record.observed).length || !Object.keys(record.targets).length) issue('MISSING_VERSION_EVIDENCE','record','A record needs observed and exact target versions.');
  for (const [target,observation] of Object.entries(record.observed)) {
    if (!roles.has(target.split('.')[0]) || !['exact','absent'].includes(observation.state)) { issue('INVALID_OBSERVATION',target,'Unresolved or unknown-role evidence cannot be applied.');continue; }
    const version=record.targets[target];
    if ((observation.state === 'exact' || observation.required) && !version) issue('MISSING_TARGET',target,'Every resolved or required component needs an exact target.');
    if (observation.state === 'exact' && version && observation.version !== version && !(observation.versionScope === 'feature' && version.split('.')[0] === observation.version)) issue('VERSION_DRIFT',target,'Existing exact and target versions must agree.');
  }
  for (const [target,version] of Object.entries(record.targets)) {
    const observation=record.observed[target], source=record.sources[target];
    if (!observation || typeof version !== 'string' || !/^\d+(?:\.\d+){0,3}(?:[A-Za-z][A-Za-z0-9.-]*|[-+][A-Za-z0-9.-]+)?$/.test(version)) { issue('INVALID_TARGET',target,'Only exact observed component targets are accepted.');continue; }
    try {
      const urls=source?.urls ?? [source?.url];
      if (source?.version !== version || !Number.isFinite(Date.parse(source?.checkedAt)) || !urls.length || !urls.every(value=>{const u=new URL(value);return u.protocol === 'https:' && !u.username && !u.password && officialHosts.has(u.hostname);})) throw new Error('source');
      if (observation.ecosystem === 'java' && (observation.vendor !== 'adoptium' || !/^\d+\.\d+\.\d+\+\d+$/.test(source.runtimePin) || source.runtimeVendor !== 'temurin' || source.runtimePin.split('.')[0] !== version.split('.')[0])) throw new Error('Java pin');
    } catch { issue('INVALID_SOURCE',target,'Keep version-specific official sources/times and an exact selected-vendor Java runtime pin.'); }
  }
  return {valid:issues.length === 0,issues};
}
export function runStackRecordCLI(args) {
  let root=process.cwd(), file='harness-stack.versions.json';
  for(let i=0;i<args.length;i+=2) {
    if(!['--project','--record'].includes(args[i]) || !args[i+1]) throw new Error('Usage: check-stack-record.mjs [--project path] [--record path]');
    if(args[i] === '--project') root=resolve(args[i+1]);else file=args[i+1];
  }
  const path=resolve(root,file);
  if(lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || lstatSync(path).size > 8*1024*1024) throw new Error('Record must be a bounded regular file');
  const result=checkStackRecord(root,JSON.parse(readFileSync(path,'utf8')));
  console.log(JSON.stringify(result));return result.valid ? 0:1;
}
if(process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { process.exitCode=runStackRecordCLI(process.argv.slice(2)); } catch { console.error('Stack record could not be verified; re-run the version checker.');process.exitCode=1; }
}

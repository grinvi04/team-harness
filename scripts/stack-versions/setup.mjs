#!/usr/bin/env node
// Setup preflight performs no writes or remote mutations. Application dependencies stay untouched.
import {lstatSync,readFileSync,realpathSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseVersionArgs} from '../check-stack-versions.mjs';
import {repositoryRoot} from '../stack-catalog.mjs';
import {inspectStackProjects} from '../../plugins/harness-guard/scripts/stack-project.mjs';
import {checkStackRecord} from '../../plugins/harness-guard/scripts/check-stack-record.mjs';
import {checkStackVersions} from './check.mjs';
import {writeVersionRecord} from './record.mjs';
import {renderSelectedWorkflow} from '../generate-stack-templates.mjs';
const checkerSource=resolve(repositoryRoot,'plugins/harness-guard/scripts/check-stack-record.mjs');
const commonDestinations=['.gitignore','.githooks/pre-commit','.githooks/commit-msg','.github/PULL_REQUEST_TEMPLATE.md','.github/workflows/ci-gate.yml',...['test-guard','commitlint','integration-e2e','destructive-ddl'].map(n=>`.github/workflows/${n}.yml`),'commitlint.config.cjs','AGENTS.md','CLAUDE.md','.claude/settings.json',...['check-commit-message.cjs','check-destructive-ddl.mjs','check-alembic-destructive-ddl.mjs','check-activerecord-destructive-ddl.mjs','check-stack-record.mjs'].map(n=>`scripts/${n}`),'harness-stack.versions.json'];
function destinations(selected){const paths=[...commonDestinations,...selected.rules.map(n=>`.claude/rules/${n}.md`),'.claude/rules/korean-ux.md'];if(selected.database.tool==='flyway') paths.push('.github/workflows/migration-safety.yml','scripts/check-migration-safety.mjs');if(selected.database.tool==='alembic') paths.push('.github/workflows/alembic-heads.yml');if(selected.backend.preset==='spring-boot'){const dir=selected.projects[0].directory;paths.push(`${dir}/.gitignore`,`${dir}/config/checkstyle/checkstyle.xml`);}if(selected.mode==='composed')paths.push(`${selected.frontend.directory}/.prettierrc`,`${selected.frontend.directory}/scripts/check-design-tokens.mjs`);return [...new Set(paths)];}
function regularOrAbsent(root,path){let current=resolve(root);const parts=relative(current,resolve(root,path)).split(sep);if(parts.some(p=>p==='..'))throw Error('Unsafe destination');for(const [index,part] of ['.',...parts].entries()){if(part!=='.')current=resolve(current,part);try{const s=lstatSync(current);if(s.isSymbolicLink() || (index===parts.length ? !s.isFile():!s.isDirectory()))throw Error('Unsafe destination: '+path);}catch(e){if(e.code==='ENOENT')return false;throw e;}}return true;}
function preflight(root,prepared){for(const path of destinations(prepared.selection))regularOrAbsent(root,path);const ci='.github/workflows/ci-gate.yml';if(regularOrAbsent(root,ci) && readFileSync(resolve(root,ci),'utf8')!==prepared.workflow)throw Error('Existing CI preserved; review exact runtime pins and fingerprint gate manually before setup.');if(regularOrAbsent(root,'scripts/check-stack-record.mjs') && !readFileSync(resolve(root,'scripts/check-stack-record.mjs')).equals(readFileSync(checkerSource)))throw Error('Existing fingerprint checker preserved; review its contract before setup.');const file=resolve(root,'harness-stack.versions.json');if(regularOrAbsent(root,'harness-stack.versions.json')){let old;try{old=JSON.parse(readFileSync(file,'utf8'));}catch{throw Error('Existing record preserved; invalid JSON.');}if(!checkStackRecord(root,old).valid || JSON.stringify(old.selection.projects)!==JSON.stringify(prepared.selection.projects) || JSON.stringify(old.targets)!==JSON.stringify(prepared.result.targets) || Object.keys(old.sources).some(k=>old.sources[k].runtimePin!==prepared.result.sources[k]?.runtimePin))throw Error('Existing record preserved; selection, inputs or targets differ.');return 'reuse';}return 'create';}
export async function prepareStackSetup({projectRoot,selected,requests={},lookup}){
  const root=resolve(projectRoot),inspection=inspectStackProjects(root,selected);
  if(inspection.issues.length)throw Error(`Version unverified; setup refused: ${inspection.issues.map(i=>`${i.code}:${i.target}`).join(', ')}`);
  // Static command/tool declarations are prerequisites, not proof that app checks pass.
  for(const project of selected.projects){
    const tools=inspection.tooling[project.role] || {};
    if(['react','nuxt'].includes(project.stackKey) || project.stackKey==='rails' && project.ui?.startsWith('inertia-')){
      for(const name of ['lint','typecheck','test:unit','build'])if(!tools.scripts?.includes(name))throw Error(`Missing required command ${project.role}.${name}; define the application check before setup.`);
    }
    const required=project.stackKey==='python' && project.framework ? ['ruff','mypy',...(project.framework==='django'?[]:['pytest'])] : project.stackKey==='rails' && project.ui ? ['rubocop']:[];
    for(const name of required)if(!tools.dependencies?.includes(name))throw Error(`Missing declared check tool ${project.role}.${name}; prepare the application checks before setup.`);
  }
  const result=await checkStackVersions({inspection,requests,...(lookup?{lookup}:{})});
  if(result.status!=='compatible')throw Error(`Version ${result.status}; setup refused: ${result.issues.map(i=>`${i.code}:${i.target}`).join(', ')}`);
  const prepared={selection:selected,result,workflow:renderSelectedWorkflow(selected,result)};
  prepared.recordAction=preflight(root,prepared);return prepared;
}
export function applyStackSetup(projectRoot,prepared){const root=resolve(projectRoot);if(!checkStackRecord(root,prepared.result).valid)throw Error('Input drift or incomplete version record; setup refused.');const action=preflight(root,prepared);if(action==='create')writeVersionRecord(root,prepared.result);return action;}
if(process.argv[1] && import.meta.url===pathToFileURL(realpathSync(process.argv[1])).href){try{const [mode,...args]=process.argv.slice(2);if(mode==='prepare'){const parsed=parseVersionArgs(args);if(parsed.apply)throw Error('Setup prepare is read-only.');console.log(JSON.stringify(await prepareStackSetup(parsed)));}else if(mode==='apply' && args.length===1){const text=readFileSync(0,'utf8');if(Buffer.byteLength(text)>8*1024*1024)throw Error('Oversized setup input');console.log(applyStackSetup(args[0],JSON.parse(text)));}else throw Error('Use prepare with version options, or apply <project> with prepared JSON on stdin.');}catch(e){console.error(e.message);process.exitCode=1;}}

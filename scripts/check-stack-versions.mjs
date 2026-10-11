#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { selectStack } from './stack-catalog.mjs';
import { inspectStackProjects } from '../plugins/harness-guard/scripts/stack-project.mjs';
import { checkStackVersions } from './stack-versions/check.mjs';
import { writeVersionRecord } from './stack-versions/record.mjs';
export function parseVersionArgs(args) {
  const values={},requests={},options={};let apply=false;
  for(let i=0;i<args.length;i++) {
    const flag=args[i];
    if(flag === '--apply') {if(apply) throw new Error('Duplicate --apply');apply=true;continue;}
    if(!['--project','--stack','--framework','--ui','--backend-dir','--frontend-dir','--version'].includes(flag) || !args[i+1] || args[i+1].startsWith('--')) throw new Error('Use --project path --stack number [--framework name] [--ui mode] [--version role.component=exact|latest] [--apply].');
    const value=args[++i];
    if(flag === '--version') {
      const index=value.indexOf('='),key=value.slice(0,index),version=value.slice(index+1);
      if(index<1 || !/^(project|backend|frontend)\.[A-Za-z0-9@/_.:-]+$/.test(key) || !/^(latest|\d[0-9A-Za-z.+-]*)$/.test(version) || Object.hasOwn(requests,key)) throw new Error('Invalid or duplicate version request');
      requests[key]=version;
    } else {if(Object.hasOwn(values,flag)) throw new Error('Duplicate option');values[flag]=value;}
  }
  if(!values['--project'] || !values['--stack']) throw new Error('--project and --stack are required.');
  for(const key of ['framework','ui']) if(values[`--${key}`]) options[key]=values[`--${key}`];
  for(const [flag,key] of [['--backend-dir','backendDir'],['--frontend-dir','frontendDir']]) if(values[flag]) options[key]=values[flag];
  return {projectRoot:resolve(values['--project']),selected:selectStack(values['--stack'],options),requests,apply};
}
export async function runStackVersions(args, dependencies={}) {
  let parsed;
  try {parsed=parseVersionArgs(args);}catch(error){console.error(error.message);return 2;}
  const inspection=inspectStackProjects(parsed.projectRoot,parsed.selected);
  const result=await checkStackVersions({inspection,requests:parsed.requests,...dependencies});
  if(parsed.apply && result.status === 'compatible') {
    try {writeVersionRecord(parsed.projectRoot,result);}catch {result.issues.push({code:'APPLY_REFUSED',target:'harness-stack.versions.json',action:'Preserve any existing file/link and re-run after input drift or storage issues are resolved.'});result.status='unverified';}
  }
  console.log(JSON.stringify(result,null,2));return result.status === 'compatible' ? 0:1;
}
if(process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {process.exitCode=await runStackVersions(process.argv.slice(2));}catch {console.error('Version checking could not be completed; no project dependencies were changed.');process.exitCode=1;}
}

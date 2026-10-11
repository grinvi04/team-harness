import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, linkSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { selectStack } from '../scripts/stack-catalog.mjs';
import { inspectStackProjects } from '../plugins/harness-guard/scripts/stack-project.mjs';
import { checkStackVersions } from '../scripts/stack-versions/check.mjs';
import { writeVersionRecord } from '../scripts/stack-versions/record.mjs';
import { checkStackRecord } from '../plugins/harness-guard/scripts/check-stack-record.mjs';
import { renderSelectedWorkflow } from '../scripts/generate-stack-templates.mjs';
const fixtures=resolve('tests/fixtures/stack-profiles');
function fixture(t) { const root=mkdtempSync(join(tmpdir(),'stack-cli-'));cpSync(join(fixtures,'react'),root,{recursive:true});t.after(()=>rmSync(root,{recursive:true,force:true}));return root; }
function snapshot(root) { return readdirSync(root).sort().map(name=>[name,lstatSync(join(root,name)).isSymbolicLink()?'link':createHash('sha256').update(readFileSync(join(root,name))).digest('hex')]); }
function cli(root,...args) { return spawnSync(process.execPath,['--import',join(fixtures,'metadata-fetch.mjs'),resolve('scripts/check-stack-versions.mjs'),'--project',root,'--stack','7',...args],{encoding:'utf8'}); }
async function checked(root, selected=selectStack('7')) {
  const inspection=inspectStackProjects(root,selected);
  return checkStackVersions({inspection,lookup:async(component,request)=>({version:request,source:'https://registry.npmjs.org/fixture/'+request,checkedAt:'2026-10-12T00:00:00Z',requirements:[]})});
}
test('CLI preview is read-only; apply creates one compatible exact record',t=>{
  const root=fixture(t),before=snapshot(root),preview=cli(root);
  assert.equal(preview.status,0,preview.stderr);assert.equal(JSON.parse(preview.stdout).status,'compatible');assert.deepEqual(snapshot(root),before);
  const applied=cli(root,'--apply');assert.equal(applied.status,0,applied.stderr);
  const record=JSON.parse(readFileSync(join(root,'harness-stack.versions.json'),'utf8'));
  assert.equal(record.targets['project.node'],'22.22.3');assert.equal(checkStackRecord(root,record).valid,true);
  assert.deepEqual(Object.keys(record).sort(),['inputs','issues','observed','requirements','schema','selection','sources','status','targets'].sort());
});
test('CLI malformed flags exit2; conflicts/unknown exit1 and cannot create a record',t=>{
  const root=fixture(t),before=snapshot(root);
  assert.equal(cli(root,'--unknown').status,2);assert.equal(cli(root,'--version','project.node=22.22.3','--version','project.node=24.1.0').status,2);
  const conflict=cli(root,'--apply','--version','project.react=19.3.0');assert.equal(conflict.status,1);assert.deepEqual(snapshot(root),before);
  writeFileSync(join(root,'.nvmrc'),'22\n');const unknown=cli(root,'--apply');assert.equal(unknown.status,1);assert.ok(!existsSync(join(root,'harness-stack.versions.json')));
});
test('existing record and symlink are never overwritten; temporary files are cleaned',async t=>{
  const root=fixture(t),result=await checked(root),target=join(root,'harness-stack.versions.json');
  writeFileSync(target,'USER RECORD');assert.throws(()=>writeVersionRecord(root,result));assert.equal(readFileSync(target,'utf8'),'USER RECORD');
  rmSync(target);const outside=join(root,'kept.txt');writeFileSync(outside,'KEPT');symlinkSync(outside,target);
  assert.throws(()=>writeVersionRecord(root,result));assert.equal(readFileSync(outside,'utf8'),'KEPT');assert.ok(lstatSync(target).isSymbolicLink());
  assert.ok(!readdirSync(root).some(n=>n.startsWith('.harness-stack-')));
});
test('late manifest drift and newly appearing allowed input refuse atomic apply',async t=>{
  const root=fixture(t),result=await checked(root);writeFileSync(join(root,'.node-version'),'22.22.3\n');
  assert.throws(()=>writeVersionRecord(root,result),/drift/i);assert.ok(!existsSync(join(root,'harness-stack.versions.json')));
});
test('publish failure after temporary write cleans only its temporary file',async t=>{
  const root=fixture(t),result=await checked(root);
  assert.throws(()=>writeVersionRecord(root,result,{publish(){throw new Error('simulated disk publish failure');}}),/publish failure/);
  assert.ok(!existsSync(join(root,'harness-stack.versions.json')));assert.ok(!readdirSync(root).some(n=>n.startsWith('.harness-stack-')));
});
test('exclusive native publish preserves a concurrent record',async t=>{
  const root=fixture(t),result=await checked(root),target=join(root,'harness-stack.versions.json');
  assert.throws(()=>writeVersionRecord(root,result,{publish(temp,file){writeFileSync(file,'CONCURRENT');linkSync(temp,file);}}));
  assert.equal(readFileSync(target,'utf8'),'CONCURRENT');assert.ok(!readdirSync(root).some(n=>n.startsWith('.harness-stack-')));
});
test('CI checker rejects manifest drift, secret/outside paths, missing fingerprints and false compatible record',async t=>{
  const root=fixture(t),record=await checked(root);
  assert.equal(checkStackRecord(root,record).valid,true);
  const noInputs={...record,inputs:[]};assert.equal(checkStackRecord(root,noInputs).valid,false);
  for(const path of ['.env','../outside']) assert.equal(checkStackRecord(root,{...record,inputs:[...record.inputs,{path,sha256:null}]}).valid,false);
  assert.equal(checkStackRecord(root,{...record,targets:{}}).valid,false);
  writeFileSync(join(root,'package.json'),'{}');assert.equal(checkStackRecord(root,record).valid,false);
});
test('rendered record CI pins runtime and checks fingerprints before dependency installation',async t=>{
  const root=fixture(t),selected=selectStack('7'),record=await checked(root,selected);
  const yaml=renderSelectedWorkflow(selected,record);
  assert.ok(yaml.includes("node-version: '22.22.3'"));
  assert.ok(yaml.indexOf('check-stack-record.mjs') < yaml.indexOf('run: npm ci'));
  assert.ok(!/version:\s*['\"]?latest/.test(yaml));assert.ok(!yaml.includes('check-stack-versions.mjs'));assert.ok(yaml.includes('contents: read'));
  assert.throws(()=>renderSelectedWorkflow(selectStack('8'),record),/selection/i);
});

test('custom composition paths use the same selector in the version CLI',t=>{
  const root=fixture(t);
  const child=spawnSync(process.execPath,['--import',join(fixtures,'metadata-fetch.mjs'),resolve('scripts/check-stack-versions.mjs'),'--project',root,'--stack','1+7','--backend-dir','api','--frontend-dir','web'],{encoding:'utf8'});
  assert.equal(child.status,1);assert.equal(JSON.parse(child.stdout).selection.projects[0].directory,'api');
});
test('CI pins Python/Ruby/Java without adding Node to importmap Hotwire',async t=>{
  for(const [fixtureName,selection,options,runtimeKey,pin] of [['python-pep621','3',{framework:'flask',ui:'templates'},'python-version','3.13.7'],['rails-hotwire','4',{ui:'hotwire'},'ruby-version','3.4.6'],['spring-boot','2',{},'java-version','21.0.9+10']]) {
    const root=mkdtempSync(join(tmpdir(),'stack-runtime-ci-'));t.after(()=>rmSync(root,{recursive:true,force:true}));cpSync(join(fixtures,fixtureName),root,{recursive:true});
    if(selection === '2') writeFileSync(join(root,'build.gradle.kts'),readFileSync(join(root,'build.gradle.kts'),'utf8')+'\njava { toolchain { vendor = JvmVendorSpec.ADOPTIUM } }\n');
    const selected=selectStack(selection,options),record=await checked(root,selected);
    if(selection === '2') record.sources['project.java']={...record.sources['project.java'],runtimePin:pin,runtimeVendor:'temurin'};
    const yaml=renderSelectedWorkflow(selected,record);assert.ok(yaml.includes(`${runtimeKey}: '${pin}'`));
    assert.equal(checkStackRecord(root,record).valid,true);
    if(selection === '4') assert.ok(!yaml.includes('setup-node@'));
    if(selection === '2') {assert.ok(yaml.includes('distribution: temurin'));assert.ok(yaml.includes("working-directory: '.'"));}
  }
});
test('Python pinned requirements plus PEP621 range are resolved together; dev override is checked',async t=>{
  const root=mkdtempSync(join(tmpdir(),'stack-python-pins-'));t.after(()=>rmSync(root,{recursive:true,force:true}));cpSync(join(fixtures,'python-pep621'),root,{recursive:true});
  writeFileSync(join(root,'pyproject.toml'),'[project]\nname="fixture"\nversion="0.1.0"\ndependencies=["Flask>=3.1"]\n');writeFileSync(join(root,'requirements.txt'),'Flask==3.1.2\n');
  const selected=selectStack('3',{framework:'flask',ui:'templates'}),record=await checked(root,selected);assert.equal(record.status,'compatible');assert.equal(checkStackRecord(root,record).valid,true);
  writeFileSync(join(root,'requirements-dev.txt'),'Flask==3.0.0\n');assert.equal(checkStackRecord(root,record).valid,false);assert.equal((await checked(root,selected)).status,'unverified');
});
test('unsupported authenticated dependency URL is not echoed in JSON output',t=>{
  const root=fixture(t),pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8')),lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8'));
  const secret='private-user:private-password';pkg.dependencies.react=`https://${secret}@example.invalid/react.tgz`;lock.packages[''].dependencies.react=pkg.dependencies.react;
  writeFileSync(join(root,'package.json'),JSON.stringify(pkg));writeFileSync(join(root,'package-lock.json'),JSON.stringify(lock));const result=cli(root);
  assert.equal(result.status,1);assert.ok(!result.stdout.includes(secret));
});
test('malformed record objects produce invalid results without throwing',t=>{
  const root=fixture(t);
  for(const record of [{schema:1,status:'compatible',issues:[],selection:{projects:[null]},observed:{},targets:{},sources:{},requirements:[],inputs:[]},{schema:1,status:'compatible',issues:[],selection:{projects:[{role:'project',directory:'.',stackKey:'rails'}]},observed:{'project.rails':null},targets:{},sources:{},requirements:[],inputs:[]}]) {
    assert.equal(checkStackRecord(root,record).valid,false);
  }
});
test('Java CI distribution cannot be invented when the project did not select a vendor',async t=>{
  const root=mkdtempSync(join(tmpdir(),'stack-no-vendor-'));t.after(()=>rmSync(root,{recursive:true,force:true}));cpSync(join(fixtures,'spring-boot'),root,{recursive:true});
  const result=await checked(root,selectStack('2'));result.sources['project.java']={...result.sources['project.java'],runtimePin:'21.0.9+10',runtimeVendor:'temurin'};
  assert.equal(checkStackRecord(root,result).valid,false);
});
test('optional Node setup inherits its reviewed action source instead of duplicating a pin',t=>{
  const root=mkdtempSync(join(tmpdir(),'stack-node-source-'));t.after(()=>rmSync(root,{recursive:true,force:true}));cpSync(resolve('templates'),join(root,'templates'),{recursive:true});
  const source=join(root,'templates/stacks/node/ci/quality.yml'),changed='0000000000000000000000000000000000000000';
  writeFileSync(source,readFileSync(source,'utf8').replace('a0853c24544627f65ddf259abe73b1d18a591444',changed));
  const selected=selectStack('3',{framework:'django',ui:'htmx'});
  const record={schema:1,status:'compatible',issues:[],selection:selected,targets:{'project.python':'3.13.7','project.node':'22.22.3'},sources:{}};
  const yaml=renderSelectedWorkflow(selected,record,root);assert.ok(yaml.includes('actions/setup-node@'+changed));assert.ok(yaml.indexOf('run: npm ci') < yaml.indexOf('Install dependencies'));
});

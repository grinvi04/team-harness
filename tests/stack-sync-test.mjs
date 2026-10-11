import assert from 'node:assert/strict';
import test from 'node:test';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {selectStack} from '../scripts/stack-catalog.mjs';
import {inspectStackProjects} from '../plugins/harness-guard/scripts/stack-project.mjs';
import {checkStackVersions} from '../scripts/stack-versions/check.mjs';
import {writeVersionRecord} from '../scripts/stack-versions/record.mjs';
import {seedProject} from './fixtures/stack-profiles/seed-project.mjs';
function root(t){const p=mkdtempSync(join(tmpdir(),'sync-profile-'));t.after(()=>rmSync(p,{recursive:true,force:true}));return p;}
function sync(p,...args){const r=spawnSync(process.execPath,[resolve('scripts/check-repo-sync.mjs'),'--repo',p,'--json',...args],{encoding:'utf8'});assert.ok(r.stdout.trim(),r.stderr);return {code:r.status,...JSON.parse(r.stdout)};}
const lookup=async(component,request)=>({version:request,source:'https://registry.npmjs.org/fixture/'+request,checkedAt:'2026-10-12T00:00:00Z',requirements:[]});
async function record(p,id,options={}){const selected=selectStack(id,options),result=await checkStackVersions({inspection:inspectStackProjects(p,selected),lookup});assert.equal(result.status,'compatible',JSON.stringify(result.issues));writeVersionRecord(p,result);}
test('sync separates missing legacy evidence from profile version drift',async t=>{const p=root(t);seedProject(p,'8');let r=sync(p);assert.equal(r.versionStatus,'unverified');assert.ok(r.rules.includes('vue'));assert.ok(r.profiles.includes('nuxt'));await record(p,'8');r=sync(p);assert.equal(r.versionStatus,'compatible');writeFileSync(join(p,'.node-version'),'22.22.3\n');r=sync(p);assert.equal(r.versionStatus,'unverified');assert.equal(r.code,1);});
test('Python selected framework and Rails same-app UI appear without invented fullstack',async t=>{for(const [id,framework,ui,expected] of [['3','django','templates','django:templates'],['4','','hotwire','rails:hotwire'],['4','','inertia-react','rails:inertia-react']]){const p=root(t);seedProject(p,id,'api','web',framework,ui);await record(p,id,{...(framework?{framework}:{}),ui});const r=sync(p);assert.ok(r.profiles.includes(expected));assert.equal(r.versionStatus,'compatible');assert.ok(!r.profiles.includes('fullstack'));}});
test('installed plugin script has the same record/inspector result without source catalog',async t=>{const p=root(t),installed=root(t);seedProject(p,'7');await record(p,'7');const scripts=join(installed,'scripts');mkdirSync(scripts);for(const n of ['check-repo-sync.mjs','check-stack-record.mjs','stack-project.mjs','read-stack-pyproject.py'])cpSync(resolve('plugins/harness-guard/scripts',n),join(scripts,n));const child=spawnSync(process.execPath,[join(scripts,'check-repo-sync.mjs'),'--repo',p,'--json'],{encoding:'utf8'});assert.ok(child.stdout,child.stderr);const packaged=JSON.parse(child.stdout),source=sync(p);assert.equal(packaged.versionStatus,source.versionStatus);assert.deepEqual(packaged.profiles,source.profiles);assert.deepEqual(packaged.rules,source.rules);assert.equal(packaged.catalogStatus,'unavailable');});

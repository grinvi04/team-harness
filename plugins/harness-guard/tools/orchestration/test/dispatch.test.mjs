import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateDispatch } from '../scripts/validate-dispatch.mjs';

const sample = name => JSON.parse(readFileSync(new URL(`../examples/${name}.json`, import.meta.url)));
function pair() { const task = sample('task'); const assignment = sample('assignment'); assignment.state = 'READY'; return [task, assignment]; }
const ok = { valid: true, scope: 'dispatch-only', errors: [] };
test('checks a READY write allocation without an Artifact or input mutation', () => {
 const values = pair(); const before = structuredClone(values);
 assert.deepEqual(validateDispatch(...values), ok); assert.deepEqual(values, before);
});
test('checks independent read-only allocation with a fixed candidate', () => {
 const [task, assignment] = pair();
 task.roles.push({ role: 'verifier', instance_id: 'v1' }); task.verification.mode = 'independent'; task.verification.verifier_instance_id = 'v1';
 assignment.producer = { role: 'verifier', instance_id: 'v1' }; assignment.bindings.push({ instance_id:'v1', agent_id:'native-verifier' }); assignment.mode = 'read-only'; assignment.candidate_ref = 'snapshot:candidate';
 assert.deepEqual(validateDispatch(task, assignment), ok);
});
const cases = [
 ['wrong task', (t,a) => { a.task_id='different'; }],
 ['wrong role', (t,a) => { a.producer.role='verifier'; }],
 ['missing binding', (t,a) => { a.bindings.pop(); }],
 ['duplicate actual agent', (t,a) => { a.bindings[1].agent_id=a.bindings[0].agent_id; }],
 ['duplicate instance', (t,a) => { a.bindings.push({instance_id:'writer-1',agent_id:'other'}); }],
 ['omitted writer history', (t,a) => { a.candidate_writers=[]; }],
 ['wrong epoch', (t,a) => { a.ownership_epoch=2; }],
 ['unsafe task epoch', t => { t.ownership[0].epoch=9007199254740992; }],
 ['unknown owner', t => { t.ownership[0].owner='unknown'; }],
 ['duplicate input ref', t => { t.input_refs.push({...t.input_refs[0]}); }],
 ['conflicting input ref', t => { t.input_refs.push({...t.input_refs[0], revision:'conflicting'}); }],
 ['conflicting source ref', t => { t.source={...t.input_refs[0], revision:'conflicting'}; }],
 ['conflicting oracle ref', t => { t.verification.oracle_refs.push({...t.input_refs[0], revision:'conflicting'}); }],
 ['duplicate oracle ref', t => { t.verification.oracle_refs.push({...t.verification.oracle_refs[0]}); }],
 ['duplicate target', t => { t.ownership.push({...t.ownership[0]}); }],
 ['duplicate role', t => { t.roles.push({...t.roles[0]}); }],
 ['duplicate acceptance', t => { t.acceptance.push({...t.acceptance[0]}); }],
 ['optional critical criterion', t => { t.acceptance[0].required=false; }],
 ['high-risk self check', t => { t.risk.level='high'; }],
 ['triggered self check', t => { t.risk.triggers=['security']; }],
 ['writer verifying own work', t => { t.verification.mode='independent';t.verification.verifier_instance_id='writer-1'; }],
 ['missing verifier', t => { t.verification.mode='independent';t.verification.verifier_instance_id='missing'; }],
 ['read-only owner', (t,a) => { a.mode='read-only';a.candidate_ref='snapshot:fixed'; }],
 ['unowned writer', t => { t.ownership=[]; }],
 ['unfinished dependency', t => { t.dependencies=[{task_id:'previous',owner:'writer-1',state:'RUNNING'}]; }],
 ['scratch overlaps source', (t,a) => { a.scratch_paths=['src/label.mjs']; }],
 ['reused attempt', (t,a) => { a.previous_attempt={attempt_id:a.attempt_id,ownership_epoch:0,stop_ref:a.source}; }],
 ['nonincreasing retry epoch', (t,a) => { a.previous_attempt={attempt_id:'old',ownership_epoch:1,stop_ref:a.source}; }],
];
for(const [name,mutate] of cases) test(`rejects ${name} before release`, () => { const values=pair();mutate(...values);assert.equal(validateDispatch(...values).valid,false); });
for(const state of ['DRAFT','RUNNING','VERIFYING','BLOCKED','ACCEPTED','FAILED','CANCELLED','SUPERSEDED']) test(`rejects ${state} for new dispatch`,()=>{const [t,a]=pair();a.state=state;assert.equal(validateDispatch(t,a).valid,false);});
for(const value of [null, [], {}, true, 'bad']) test(`rejects invalid structures ${JSON.stringify(value)}`,()=>{assert.equal(validateDispatch(value,pair()[1]).valid,false);assert.equal(validateDispatch(pair()[0],value).valid,false);});
test('accepts fulfilled dependency and distinct retry',()=>{const [t,a]=pair();t.dependencies=[{task_id:'previous',owner:'writer-1',state:'ACCEPTED'}];a.previous_attempt={attempt_id:'old',ownership_epoch:0,stop_ref:a.source};assert.deepEqual(validateDispatch(t,a),ok);});

const cli=fileURLToPath(new URL('../scripts/validate-dispatch.mjs',import.meta.url));
test('CLI works from another cwd and preserves JSON inputs',t=>{
 const dir=mkdtempSync(join(tmpdir(),'ao-dispatch-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const contents=pair().map(JSON.stringify);const files=contents.map((text,i)=>{const p=join(dir,`${i}.json`);writeFileSync(p,text);return p;});
 const run=paths=>spawnSync(process.execPath,[cli,...paths],{cwd:dir,encoding:'utf8'});
 let result=run(files);assert.equal(result.status,0);assert.deepEqual(JSON.parse(result.stdout),ok);assert.deepEqual(files.map(p=>readFileSync(p,'utf8')),contents);
 writeFileSync(files[1],contents[1].replace('"kind":','"kind":"PRIVATE","k\\u0069nd":'));
 result=run(files);assert.equal(result.status,1);assert.match(result.stdout,/duplicate-key/);assert(!result.stdout.includes('PRIVATE'));
 writeFileSync(files[1],contents[1].replace('"ownership_epoch":1','"ownership_epoch":1e0'));
 result=run(files);assert.equal(result.status,1);assert.match(result.stdout,/invalid-epoch-literal/);
 writeFileSync(files[0],'{bad');result=run([files[0],join(dir,'PRIVATE-MISSING')]);assert.equal(result.status,2);assert.match(result.stdout,/read-error/);assert(!result.stdout.includes('PRIVATE'));
 assert.equal(run([]).status,2);
});
test('import does not dispatch, print or run the CLI',()=>{const result=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(new URL('../scripts/validate-dispatch.mjs',import.meta.url).href)});`],{encoding:'utf8'});assert.equal(result.status,0);assert.equal(result.stdout,'');assert.equal(result.stderr,'');});

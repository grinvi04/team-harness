import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {selectStack} from '../scripts/stack-catalog.mjs';
test('stack rules compose shared layers with dedicated framework/UI guidance',()=>{
 for(const [id,options,required] of [['5',{},['typescript','react','nextjs']],['8',{},['typescript','vue','nuxt']],['3',{framework:'django',ui:'htmx'},['python','django']],['3',{framework:'fastapi',ui:'api'},['python','fastapi']],['3',{framework:'flask',ui:'templates'},['python','flask']],['4',{ui:'hotwire'},['ruby','rails-hotwire']],['4',{ui:'inertia-react'},['ruby','typescript','react','rails-inertia-react']],['4',{ui:'inertia-vue'},['ruby','typescript','vue','rails-inertia-vue']],['4',{ui:'api'},['ruby','rails-api']]]){
  const selected=selectStack(id,options);assert.deepEqual([...selected.rules].sort(),required.sort());
  for(const rule of selected.rules){const text=readFileSync(selected.ruleSources[rule],'utf8');assert.ok(text.startsWith('---\npaths:'));assert.ok(text.split('\n').length<=200);assert.match(text,/https:\/\//);}
 }
});

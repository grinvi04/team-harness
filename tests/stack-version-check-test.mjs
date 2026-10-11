import assert from 'node:assert/strict';
import test from 'node:test';
import { checkStackVersions } from '../scripts/stack-versions/check.mjs';
import { lookupVersionMetadata } from '../scripts/stack-versions/metadata.mjs';
import { satisfies } from '../scripts/stack-versions/ranges.mjs';
const stamp = '2026-10-12T00:00:00.000Z';
function inspection(versions, { requirements = [], packages = {}, issues = [] } = {}) {
  return { selection: { projects:[{role:'project', directory:'.',stackKey:'nuxt'}] }, inputs:[], requirements, packages:{project:packages}, issues,
    observed:Object.fromEntries(Object.entries(versions).map(([component,v]) => [`project.${component}`, { state:v === null ? 'absent':'exact', version:v, ecosystem:component === 'node' ? 'node':'npm', ...(component !== 'node' ? {packageName:component}:{}), required:component !== 'node' }])) };
}
function metadata(version, extra = {}) { return { version, source:'https://registry.npmjs.org/fixture/'+version, checkedAt:stamp, requirements:[], ...extra }; }
function lookupTable(table) { return async (component, request) => { const result = table[component]?.[request] ?? table[component]; if (!result?.version) throw new Error('missing fixed fixture metadata'); return structuredClone(result); }; }
const basic = { 'npm:nuxt':metadata('4.6.1',{requirements:[{component:'node',ecosystem:'npm',range:'^22.22.3 || ^24.15.0 || >=26.0.0'}]}), 'node:node':metadata('22.22.3') };
async function check(i, requests = {}, table = basic) { return checkStackVersions({inspection:i, requests, lookup:lookupTable(table), parsers:{satisfies}}); }
test('Nuxt Node engine boundary rejects old patch and accepts declared compatible patch', async () => {
  assert.equal((await check(inspection({nuxt:'4.6.1',node:'22.0.0'}))).status,'conflict');
  assert.equal((await check(inspection({nuxt:'4.6.1',node:'22.22.3'}))).status,'compatible');
});
test('existing exact preserved; explicit latest difference is a conflict without dependency rewrite', async () => {
  const i=inspection({nuxt:'4.6.1',node:'22.22.3'});const r=await check(i);
  assert.equal(r.targets['project.nuxt'],'4.6.1');
  const table={...basic,'npm:nuxt':{ '4.6.1':basic['npm:nuxt'],latest:metadata('4.7.0') }};
  assert.equal((await check(i,{'project.nuxt':'latest'},table)).status,'conflict');
  assert.equal((await check(i,{'project.nuxt':'4.6.1'},table)).status,'compatible');
});
test('absent runtime proposes highest compatible official candidate; unpinned existing never replaced', async () => {
  const table={...basic,'node:node':metadata('24.15.0',{candidates:['24.15.0','22.22.3']})};
  assert.equal((await check(inspection({nuxt:'4.6.1',node:null}),{},table)).targets['project.node'],'24.15.0');
  const i=inspection({nuxt:'4.6.1',node:null});i.observed['project.nuxt']={...i.observed['project.nuxt'],state:'unresolved',version:null};
  assert.equal((await check(i,{'project.nuxt':'latest'},table)).status,'unverified');
});
test('missing Inertia adapter and lookup timeout remain unverified', async () => {
  const i=inspection({'inertia-react':null,node:'22.22.3'},{issues:[{code:'MISSING_COMPONENT',target:'project.inertia-react',action:'declare matching adapter'}]});
  assert.equal((await check(i)).status,'unverified');
  const timeout = await checkStackVersions({inspection:inspection({nuxt:'4.6.1',node:'22.22.3'}),requests:{},lookup:async()=>{throw new Error('timeout');},parsers:{satisfies}});
  assert.equal(timeout.status,'unverified'); assert.ok(timeout.issues.some(i=>i.code==='METADATA_UNAVAILABLE'));
});
test('optional npm peer absent is skipped; installed optional peer version is checked', async () => {
  const table={...basic,'npm:nuxt':metadata('4.6.1',{peers:{typescript:'>=5.8'},optionalPeers:['typescript']})};
  assert.equal((await check(inspection({nuxt:'4.6.1',node:'22.22.3'}),{},table)).status,'compatible');
  table['npm:typescript']=metadata('5.7.3');
  const i=inspection({nuxt:'4.6.1',node:'22.22.3'},{packages:{typescript:{range:'5.7.3',version:'5.7.3'}}});
  assert.equal((await check(i,{},table)).status,'conflict');
});
test('required peers without resolved installation fail; selected dependency ranges also checked', async () => {
  const table={...basic,'npm:nuxt':metadata('4.6.1',{peers:{vue:'^3.5.43'}}),'npm:vue':metadata('3.5.40')};
  assert.equal((await check(inspection({nuxt:'4.6.1',node:'22.22.3'}),{},table)).status,'unverified');
  assert.equal((await check(inspection({nuxt:'4.6.1',vue:'3.5.40',node:'22.22.3'}),{},table)).status,'conflict');
});
test('native npm parser enforces prerelease and range grammar', () => {
  assert.equal(satisfies('npm','22.22.3','^22.22.3 || ^24.15.0').matches,true);
  assert.equal(satisfies('npm','2.0.0-beta.1','>=1.0.0').matches,false);
  assert.equal(satisfies('npm','2.0.0-beta.1','>=2.0.0-beta.0 <2.0.0').matches,true);
  assert.ok(satisfies('npm','1.0.0','nonsense').issues.length);
});
test('native Python packaging applies markers only with declared target environment', () => {
  assert.equal(satisfies('python','5.2.7','>=5.2; python_version >= "3.12"',{python_version:'3.13',python_full_version:'3.13.7'}).matches,true);
  assert.equal(satisfies('python','4.2.9','>=5.2; python_version >= "3.12"',{python_version:'3.11',python_full_version:'3.11.9'}).matches,true);
  assert.ok(satisfies('python','5.2.7','>=5.2; sys_platform == "win32"',{}).issues.length);
  assert.equal(satisfies('python','6.0rc1','>=5.2').matches,true); // packaging26.3 native single-version semantics
  assert.equal(satisfies('python','6.0rc1','>=5.2,<6.0').matches,false);
  assert.equal(satisfies('python','6.0rc1','>=6.0rc1').matches,true);
});
test('native RubyGems distinguishes ~> minor and patch boundaries', () => {
  assert.equal(satisfies('ruby','3.4.6','~> 3.4').matches,true);
  assert.equal(satisfies('ruby','4.0.0','~> 3.4').matches,false);
  assert.equal(satisfies('ruby','3.5.0','~> 3.4.0').matches,false);
  assert.equal(satisfies('ruby','8.0.3','>= 8.0, < 9').matches,true);
});
test('unknown request keys and metadata exact mismatch cannot pass', async () => {
  assert.equal((await check(inspection({nuxt:'4.6.1',node:'22.22.3'}),{'frontend.node':'22.22.3'})).status,'unverified');
  const table={...basic,'npm:nuxt':metadata('4.6.2')};
  assert.equal((await check(inspection({nuxt:'4.6.1',node:'22.22.3'}),{},table)).status,'unverified');
});
function jsonFetch(body) { return async url => new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}}); }
test('npm metadata uses version-specific official URL and validates response schema', async () => {
  let source;
  const r=await lookupVersionMetadata('npm:nuxt','4.6.1',async url => {source=url;return new Response(JSON.stringify({name:'nuxt',version:'4.6.1',engines:{node:'^22.22.3'},peerDependencies:{vue:'^3.5.43'},peerDependenciesMeta:{vue:{optional:true}}}));});
  assert.equal(source,'https://registry.npmjs.org/nuxt/4.6.1'); assert.equal(r.version,'4.6.1');
  assert.deepEqual(r.optionalPeers,['vue']);
  await assert.rejects(lookupVersionMetadata('npm:nuxt','4.6.1',jsonFetch({version:'4.6.1',engines:'bad'})));
  await assert.rejects(lookupVersionMetadata('npm:nuxt','latest',jsonFetch({name:'nuxt',version:'5.0.0-beta.1'})));
});
test('metadata network refusal, malformed response, oversized body and unknown component fail closed', async () => {
  await assert.rejects(lookupVersionMetadata('npm:nuxt','4.6.1',async()=>new Response('no',{status:503})));
  await assert.rejects(lookupVersionMetadata('npm:nuxt','4.6.1',async()=>new Response('{bad')));
  await assert.rejects(lookupVersionMetadata('npm:nuxt','4.6.1',async()=>new Response('x'.repeat(8*1024*1024+1))));
  await assert.rejects(lookupVersionMetadata('unknown:thing','latest',jsonFetch({})));
});
test('missing Java vendor or extractable version-specific support remains unknown', async () => {
  await assert.rejects(lookupVersionMetadata('java:java','latest',jsonFetch({})));
  await assert.rejects(lookupVersionMetadata('spring-boot:spring-boot','3.5.6',async()=>new Response('Spring Boot 3.5.16 requires at least Java 17')));
});
test('PyPI/gem metadata extracts official runtime conditions and rejects yanked or invalid metadata', async () => {
  const py = await lookupVersionMetadata('pypi:django','5.2.7',jsonFetch({info:{name:'Django',version:'5.2.7',requires_python:'>=3.10'},urls:[{yanked:false}]}));
  assert.deepEqual(py.requirements,[{component:'python',ecosystem:'python',range:'>=3.10'}]);
  const gem = await lookupVersionMetadata('gem:rails','8.0.3',jsonFetch({name:'rails',version:'8.0.3',ruby_version:'>= 3.2.0',dependencies:{runtime:[]}}));
  assert.equal(gem.requirements[0].range,'>= 3.2.0');
  await assert.rejects(lookupVersionMetadata('pypi:django','5.2.7',jsonFetch({info:{version:'5.2.7'},urls:[{yanked:true}]})));
});
test('Node latest excludes prerelease/EOL/non-LTS; exact supported current release is allowed', async () => {
  const response = async url => new Response(JSON.stringify(url.includes('schedule.json') ? {v22:{end:'2028-01-01'},v24:{end:'2029-01-01'},v26:{end:'2029-01-01'},v18:{end:'2025-01-01'}} : [
    {version:'v26.1.0',lts:false},{version:'v24.15.0',lts:'Krypton'},{version:'v22.22.3',lts:'Jod'},{version:'v18.20.8',lts:'Hydrogen'},{version:'v28.0.0-rc.1',lts:false}
  ]));
  const r=await lookupVersionMetadata('node:node','latest',response);assert.equal(r.version,'24.15.0');assert.deepEqual(r.candidates,['24.15.0','22.22.3']);
  assert.equal((await lookupVersionMetadata('node:node','26.1.0',response)).version,'26.1.0');
  await assert.rejects(lookupVersionMetadata('node:node','18.20.8',response));
});
test('Boot exact conditions are read from the matching official source tag, not a mutable redirected page', async () => {
  let source;
  const r=await lookupVersionMetadata('spring-boot:spring-boot','3.5.6',async url=>{
    source=url;return new Response('Spring Boot {version-spring-boot} requires at least https://www.java.com[Java 17] and is compatible with versions up to and including Java 25.\n| Gradle\n| Gradle 7.x (7.6.4 or later) or 8.x (8.4 or later)');
  });
  assert.ok(source.includes('/spring-projects/spring-boot/v3.5.6/'));assert.equal(r.requirements[0].range,'>=17.0.0 <26.0.0');
  assert.equal(satisfies('gradle','9.0.0',r.requirements[1].range).matches,false);
});
test('Java selected vendor LTS and version-specific Gradle JVM matrix are checked', async () => {
  const java=await lookupVersionMetadata('java:adoptium','latest',async url=>new Response(JSON.stringify(url.includes('available_releases') ? {available_lts_releases:[17,21,25]} : [{release_name:'jdk-25.0.1+8',version:{openjdk_version:'25.0.1+8-LTS'}}])));
  assert.equal(java.version,'25');
  const gradle=await lookupVersionMetadata('gradle:gradle','8.14.3',async()=>new Response('<table><tr><th>Java version</th></tr><tr><td>17</td><td>7.3</td><td>7.3 and after</td></tr><tr><td>21</td><td>8.4</td><td>8.5 and after</td></tr><tr><td>25</td><td>9.1</td><td>9.1.0 and after</td></tr></table>'));
  assert.equal(satisfies('java','21',gradle.requirements[0].range).matches,true);
  assert.equal(satisfies('java','25',gradle.requirements[0].range).matches,false);
});
test('native parser absence produces unverified; malformed required range cannot pass', async () => {
  const i=inspection({nuxt:'4.6.1',node:'22.22.3'});
  const r=await checkStackVersions({inspection:i,lookup:lookupTable(basic),parsers:{satisfies:()=>({matches:false,issues:[{code:'RANGE_PARSER_UNAVAILABLE',action:'prepare tooling'}]})}});
  assert.equal(r.status,'unverified');
  const bad={...basic,'npm:nuxt':metadata('4.6.1',{requirements:[{component:'node',ecosystem:'npm',range:'bogus'}]})};
  assert.equal((await check(i,{},bad)).status,'unverified');
});
test('compatible Java latest selection includes Gradle constraints collected before runtime proposal', async () => {
  const i=inspection({'spring-boot':'3.5.6',java:null,gradle:'8.14.3'});
  i.observed['project.spring-boot']={state:'exact',version:'3.5.6',ecosystem:'spring-boot',required:true};
  i.observed['project.java']={state:'absent',version:null,ecosystem:'java',vendor:'adoptium',required:false};
  i.observed['project.gradle']={state:'exact',version:'8.14.3',ecosystem:'gradle',required:false};
  const table={'spring-boot:spring-boot':metadata('3.5.6',{requirements:[{component:'java',ecosystem:'java',range:'>=17.0.0 <=25.0.0'}]}),'java:adoptium':metadata('25',{candidates:['25','21','17']}),'gradle:gradle':metadata('8.14.3',{requirements:[{component:'java',ecosystem:'java',range:'17.0.0 || 21.0.0'}]})};
  const r=await check(i,{},table);assert.equal(r.status,'compatible');assert.equal(r.targets['project.java'],'21');
});
test('missing optional peer installed by npm is checked from root lock evidence', async () => {
  const i=inspection({nuxt:'4.6.1',node:'22.22.3'},{packages:{typescript:{range:null,version:'5.7.3',declared:false}}});
  const table={...basic,'npm:nuxt':metadata('4.6.1',{peers:{typescript:'>=5.8'},optionalPeers:['typescript']}),'npm:typescript':metadata('5.7.3')};
  assert.equal((await check(i,{},table)).status,'conflict');
});
test('latest metadata malformed required engines range is refused at extraction', async()=>{
  await assert.rejects(lookupVersionMetadata('npm:nuxt','4.6.1',jsonFetch({name:'nuxt',version:'4.6.1',engines:{node:{invalid:true}}})));
});
test('Java feature declaration records an exact selected-vendor CI runtime pin', async () => {
  const java = await lookupVersionMetadata('java:adoptium','21', async url => new Response(JSON.stringify(url.includes('available_releases') ? {available_lts_releases:[17,21,25]} : [{release_name:'jdk-21.0.9+10',version:{openjdk_version:'21.0.9+10'},binary:{image_type:'jdk'}}])));
  assert.equal(java.version,'21');assert.equal(java.runtimePin,'21.0.9+10');assert.equal(java.runtimeVendor,'temurin');
});
test('Python/Ruby latest extracts stable official releases without prerelease defaults', async()=>{
  const python=await lookupVersionMetadata('python:python','latest',jsonFetch([{name:'Python 3.15.0',is_published:true,pre_release:false},{name:'Python 3.16.0rc1',is_published:true,pre_release:true}]));
  assert.equal(python.version,'3.15.0');
  const ruby=await lookupVersionMetadata('ruby:ruby','latest',async()=>new Response('- version: 3.4.6\n  date: 2025-10-01\n- version: 3.5.0-preview1\n  date: 2026-01-01\n'));
  assert.equal(ruby.version,'3.4.6');
});
test('metadata timeout also bounds a stalled response body', {timeout:15000}, async () => {
  const stuckFetch=lookupVersionMetadata('npm:nuxt','4.6.1',async()=>new Promise(()=>{}));
  const stuckBody=lookupVersionMetadata('npm:nuxt','4.6.1',async()=>new Response(new ReadableStream({start(){}})));
  const outcomes=await Promise.allSettled([stuckFetch,stuckBody]);
  assert.ok(outcomes.every(r=>r.status==='rejected' && /timeout/.test(r.reason.message)));
});

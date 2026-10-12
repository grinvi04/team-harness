// Owned test preload: replace network responses, never consumer application code.
const versions={'react':'19.2.0','react-dom':'19.2.0','vite':'7.1.9','@vitejs/plugin-react':'5.0.4','@vitejs/plugin-vue':'6.0.1',vue:'3.5.22',next:'15.5.4',nuxt:'4.1.2','htmx.org':'2.0.7','@inertiajs/react':'2.2.8','@inertiajs/vue3':'2.2.8'};
globalThis.fetch=async url=>{
  if(process.env.STACK_FIXTURE_METADATA_FAILURE==='1')return new Response('failure',{status:503});
  const u=new URL(url);let body,text;
  if(u.hostname==='registry.npmjs.org') {const name=decodeURIComponent(u.pathname.slice(1).split('/')[0]);body={name,version:versions[name],engines:{node:'>=22.12.0'}};if(!body.version)return new Response('missing',{status:404});}
  else if(u.hostname==='nodejs.org')body=[{version:'v22.22.3',lts:'Jod'}];
  else if(u.hostname==='raw.githubusercontent.com' && u.pathname.endsWith('schedule.json'))body={v22:{end:'2028-01-01'}};
  else if(u.hostname==='pypi.org'){const name=u.pathname.split('/')[2];body={info:{name,version:{django:'5.2.7',fastapi:'0.118.0',flask:'3.1.2'}[name],requires_python:'>=3.10'},urls:[{yanked:false}]};}
  else if(u.hostname==='www.python.org')body=[{name:'Python 3.13.7',is_published:true,pre_release:false}];
  else if(u.hostname==='rubygems.org'){const p=u.pathname.split('/');body={name:p[4],version:p[6].replace('.json',''),ruby_version:'>= 3.2',dependencies:{runtime:[]}};}
  else if(u.hostname==='raw.githubusercontent.com' && u.pathname.endsWith('releases.yml'))text='- version: 3.4.6\n';
  else if(u.hostname==='raw.githubusercontent.com' && u.pathname.endsWith('system-requirements.adoc'))text='Spring Boot {version-spring-boot} requires at least Java 17 and is compatible up to and including Java 25.\nGradle 7.x (7.6.4 or later) or 8.x (8.4 or later)\n';
  else if(u.hostname==='docs.gradle.org')text='<table>Java version<tr><td>21</td><td>8.4</td><td>8.5 and after</td></tr></table>';
  else if(u.hostname==='api.adoptium.net')body=u.pathname.endsWith('available_releases')?{available_lts_releases:[21]}:[{release_name:'jdk-21.0.9+10'}];
  else return new Response('missing',{status:404});
  return new Response(text ?? JSON.stringify(body));
};

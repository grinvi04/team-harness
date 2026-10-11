// Owned declarations only; never create or execute an application.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
export function seedProject(root,selection,backendDir='apps/api',frontendDir='apps/web',framework='',ui=''){
  const ids=String(selection).split('+');
  for(const [index,id] of ids.entries()){
    const directory=ids.length===1 ? root : join(root,index===0?backendDir:frontendDir);mkdirSync(directory,{recursive:true});
    const write=(name,text)=>{mkdirSync(resolve(directory,name,'..'),{recursive:true});writeFileSync(join(directory,name),text);};
    if(id==='2'){write('build.gradle.kts','plugins { id("org.springframework.boot") version "3.5.6" }\njava { toolchain { languageVersion = JavaLanguageVersion.of(21); vendor = JvmVendorSpec.ADOPTIUM } }\n');write('gradle/wrapper/gradle-wrapper.properties','distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-bin.zip\n');}
    else if(id==='3'){write('requirements.txt',framework?`${framework}==${{django:'5.2.7',fastapi:'0.118.0',flask:'3.1.2'}[framework]}\n`:'');write('.python-version','3.13.7\n');}
    else if(id==='4'){const gems={rails:'8.0.3',...(ui==='hotwire'?{'turbo-rails':'2.0.17','stimulus-rails':'1.3.4'}:{}),...(ui.startsWith('inertia-')?{inertia_rails:'3.11.0'}:{})};write('Gemfile',Object.keys(gems).map(n=>`gem "${n}"`).join('\n')+'\n');write('Gemfile.lock','GEM\n  specs:\n'+Object.entries(gems).map(([n,v])=>`    ${n} (${v})`).join('\n')+'\n');write('.ruby-version','3.4.6\n');if(ui==='hotwire')write('config/importmap.rb','pin "@hotwired/turbo-rails", to: "turbo.min.js"\npin "@hotwired/stimulus", to: "stimulus.min.js"\n');}
    if(['1','5','6','7','8'].includes(id) || id==='4' && ui.startsWith('inertia-') || id==='3' && ui==='htmx'){
      const deps=id==='1'?{}:id==='5'?{next:'15.5.4',react:'19.2.0','react-dom':'19.2.0'}:id==='6'?{vue:'3.5.22',vite:'7.1.9','@vitejs/plugin-vue':'6.0.1'}:id==='8'?{nuxt:'4.1.2',vue:'3.5.22'}:id==='3'?{'htmx.org':'2.0.7'}:id==='4'?ui==='inertia-react'?{'@inertiajs/react':'2.2.8',react:'19.2.0','react-dom':'19.2.0'}:{'@inertiajs/vue3':'2.2.8',vue:'3.5.22'}:{react:'19.2.0','react-dom':'19.2.0',vite:'7.1.9','@vitejs/plugin-react':'5.0.4'};
      write('package.json',JSON.stringify({private:true,dependencies:deps,scripts:{lint:'fixture-lint',typecheck:'fixture-types','test:unit':'fixture-tests',build:'fixture-build',preinstall:'touch APP_EXECUTED'}}));
      write('package-lock.json',JSON.stringify({lockfileVersion:3,packages:{'':{dependencies:deps},...Object.fromEntries(Object.entries(deps).map(([n,v])=>[`node_modules/${n}`,{version:v}]))}}));write('.nvmrc','22.22.3\n');
    }
  }
}
if(process.argv[1]?.endsWith('seed-project.mjs'))seedProject(...process.argv.slice(2));

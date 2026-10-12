// Version-specific upstream evidence only; no persistent cache or project code execution.
import { createRequire } from 'node:module';
let semver;
try { semver = createRequire(import.meta.url)('./node_modules/semver'); } catch { /* no automatic tooling installation */ }
const hosts = new Set(['registry.npmjs.org', 'pypi.org', 'rubygems.org', 'nodejs.org', 'raw.githubusercontent.com', 'api.github.com', 'www.python.org', 'www.ruby-lang.org', 'services.gradle.org', 'docs.gradle.org', 'docs.spring.io', 'api.adoptium.net']);
const stable = version => /^\d+(?:\.\d+){1,2}$/.test(version);
const sorted = versions => [...new Set(versions)].sort((a,b) => semver.rcompare(semver.coerce(a),semver.coerce(b)));
export async function lookupVersionMetadata(component, request, fetchImpl = fetch) {
  if (!semver) throw new Error('Prepare isolated npm semver tooling before metadata checks');
  if (typeof component !== 'string' || typeof request !== 'string' || !/^(latest|\d[0-9A-Za-z.+-]*)$/.test(request)) throw new Error('Invalid exact/latest metadata request');
  const split = component.indexOf(':'), ecosystem = component.slice(0, split), name = component.slice(split + 1);
  if (split < 1 || !/^[A-Za-z0-9@/_.-]+$/.test(name) || name.includes('..')) throw new Error('Invalid component');
  const checkedAt = new Date().toISOString(), sources = [];
  async function get(url, json = true) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !hosts.has(parsed.hostname)) throw new Error('Unofficial metadata host');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    const aborted = new Promise((_,reject) => controller.signal.addEventListener('abort',()=>reject(new Error('Metadata timeout')), {once:true}));
    try {
      const response = await Promise.race([fetchImpl(url, { signal: controller.signal, redirect: 'error', headers: { Accept: json ? 'application/json':'text/plain', 'User-Agent':'team-harness-version-check' } }), aborted]);
      if (!response.ok || (response.url && new URL(response.url).href !== parsed.href)) throw new Error('Metadata request failed or redirected');
      const chunks = [], reader = response.body?.getReader(); let size = 0;
      if (!reader) throw new Error('Missing metadata body');
      while (true) {
        const part = await Promise.race([reader.read(), aborted]); if (part.done) break; size += part.value.byteLength;
        if (size > 8 * 1024 * 1024) { await reader.cancel(); throw new Error('Oversized metadata'); }
        chunks.push(part.value);
      }
      const text = Buffer.concat(chunks).toString('utf8'); sources.push(url);
      return json ? JSON.parse(text) : text;
    } finally { clearTimeout(timer); }
  }
  let version, requirements = [], peers = {}, optionalPeers = [], dependencies = {}, candidates, runtimePin, runtimeVendor;
  if (ecosystem === 'npm') {
    const data = await get(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(request)}`);
    if (data.name !== name || !semver.valid(data.version) || (request === 'latest' && semver.prerelease(data.version))
        || ['engines','peerDependencies','peerDependenciesMeta','dependencies'].some(k => data[k] && (typeof data[k] !== 'object' || Array.isArray(data[k])))) throw new Error('Invalid npm metadata');
    version = data.version;
    if (data.engines && Object.values(data.engines).some(value=>typeof value !== 'string')) throw new Error('Invalid engine constraints');
    if (data.engines?.node) requirements.push({ component:'node', ecosystem:'npm', range:data.engines.node });
    peers = data.peerDependencies ?? {}; dependencies = data.dependencies ?? {};
    optionalPeers = Object.entries(data.peerDependenciesMeta ?? {}).filter(([,v]) => v.optional === true).map(([key])=>key);
    if ([...Object.values(peers), ...Object.values(dependencies)].some(v => typeof v !== 'string')) throw new Error('Invalid npm dependency ranges');
  } else if (ecosystem === 'pypi') {
    const data = await get(`https://pypi.org/pypi/${encodeURIComponent(name)}/${request === 'latest' ? '' : `${encodeURIComponent(request)}/`}json`);
    if (!data.info || typeof data.info.name !== 'string' || data.info.name.toLowerCase().replace(/[-_.]+/g,'-') !== name.toLowerCase().replace(/[-_.]+/g,'-') || typeof data.info.version !== 'string' || !Array.isArray(data.urls) || !data.urls.some(u=>u.yanked === false)) throw new Error('Invalid/yanked PyPI metadata');
    version = data.info.version;
    if (request === 'latest' && !stable(version)) throw new Error('Prerelease is not a default');
    if (data.info.requires_python && typeof data.info.requires_python !== 'string') throw new Error('Invalid Python condition');
    if (data.info.requires_python) requirements.push({ component:'python', ecosystem:'python', range:data.info.requires_python });
  } else if (ecosystem === 'gem') {
    let url;
    if (request === 'latest') {
      const versions = await get(`https://rubygems.org/api/v1/versions/${encodeURIComponent(name)}.json`);
      if (!Array.isArray(versions)) throw new Error('Invalid gem versions');
      candidates = sorted(versions.filter(v=>!v.prerelease && stable(v.number)).map(v=>v.number));
      version = candidates[0];
    } else version = request;
    url = `https://rubygems.org/api/v2/rubygems/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}.json`;
    const data = await get(url);
    if (data.name !== name || data.version !== version || typeof data.ruby_version !== 'string') throw new Error('Invalid gem metadata');
    requirements.push({ component:'ruby',ecosystem:'ruby',range:data.ruby_version });
    dependencies = Object.fromEntries((data.dependencies?.runtime ?? []).map(d=>[d.name,d.requirements]));
  } else if (ecosystem === 'node' && name === 'node') {
    const releases = await get('https://nodejs.org/dist/index.json');
    const schedule = await get('https://raw.githubusercontent.com/nodejs/Release/main/schedule.json');
    if (!Array.isArray(releases) || !schedule || typeof schedule !== 'object') throw new Error('Invalid Node release data');
    const supported = releases.filter(row=>typeof row.version === 'string' && stable(row.version.replace(/^v/,'')) && schedule[`v${row.version.replace(/^v/,'').split('.')[0]}`]?.end > checkedAt.slice(0,10));
    candidates = sorted(supported.filter(row=>request !== 'latest' || row.lts).map(row=>row.version.replace(/^v/,'')));
    version = request === 'latest' ? candidates[0] : request;
    if (!candidates.includes(version)) throw new Error('The requested Node release is not a supported stable release');
  } else if (ecosystem === 'python' && name === 'python') {
    const data = await get('https://www.python.org/api/v2/downloads/release/?is_published=true');
    if (!Array.isArray(data)) throw new Error('Invalid Python release data');
    candidates = sorted(data.filter(v=>v.is_published === true && v.pre_release === false).map(v=>v.name?.replace(/^Python /,'')).filter(v=>typeof v==='string' && stable(v)));
    version = request === 'latest' ? candidates[0] : request;
    if (!candidates.includes(version)) throw new Error('Python release evidence missing');
  } else if (ecosystem === 'ruby' && name === 'ruby') {
    const data = await get('https://raw.githubusercontent.com/ruby/www.ruby-lang.org/master/_data/releases.yml',false);
    candidates = sorted([...data.matchAll(/^\s*(?:- )?version:\s*['"]?(\d+\.\d+\.\d+)['"]?\s*$/gm)].map(m=>m[1]));
    version = request === 'latest' ? candidates[0] : request;
    if (!candidates.includes(version)) throw new Error('Ruby release evidence missing');
  } else if (ecosystem === 'java' && name === 'adoptium') {
    const data = await get('https://api.adoptium.net/v3/info/available_releases');
    if (!Array.isArray(data.available_lts_releases)) throw new Error('Invalid selected Java vendor release data');
    candidates = data.available_lts_releases.map(String).sort((a,b)=>Number(b)-Number(a));
    version = request === 'latest' ? candidates[0] : request;
    const feature=version.split('.')[0];
    if (!candidates.includes(feature)) throw new Error('Selected vendor LTS evidence missing');
    const assets = await get(`https://api.adoptium.net/v3/assets/latest/${feature}/hotspot?architecture=x64&image_type=jdk&os=linux&vendor=eclipse`);
    if (!Array.isArray(assets) || !assets.length) throw new Error('Selected Java vendor exact runtime unavailable');
    const pins=[...new Set(assets.map(asset=>asset.release_name?.match(/^jdk-(\d+\.\d+\.\d+\+\d+)$/)?.[1]))];
    if (pins.length !== 1 || typeof pins[0] !== 'string' || !/^\d+\.\d+\.\d+\+\d+$/.test(pins[0]) || pins[0].split('.')[0] !== feature) throw new Error('Ambiguous Java runtime release');
    runtimePin=pins[0];runtimeVendor='temurin';
    if (version.includes('.') && version !== runtimePin) throw new Error('Requested exact Java patch is not the verified selected vendor release');
  } else if (ecosystem === 'spring-boot' && name === 'spring-boot') {
    if (request === 'latest') {
      const latest = await get('https://api.github.com/repos/spring-projects/spring-boot/releases/latest');
      version = latest.tag_name?.replace(/^v/,'');
    } else version = request;
    if (!version || !stable(version)) throw new Error('Invalid Boot stable release');
    const text = await get(`https://raw.githubusercontent.com/spring-projects/spring-boot/v${version}/spring-boot-project/spring-boot-docs/src/docs/antora/modules/ROOT/pages/system-requirements.adoc`,false);
    const java = text.match(/Spring Boot \{version-spring-boot\} requires at least (?:https:\/\/www\.java\.com\[)?Java (\d+)\]?.*?up to and including Java (\d+)/);
    const gradle = text.match(/Gradle (\d+)\.x \((\d+\.\d+(?:\.\d+)?) or later\) or (\d+)\.x \((\d+\.\d+(?:\.\d+)?) or later\)/);
    if (!java || !gradle) throw new Error('Version-specific Boot support conditions unavailable');
    requirements = [{component:'java',ecosystem:'java',range:`>=${java[1]}.0.0 <${Number(java[2])+1}.0.0`},{component:'gradle',ecosystem:'gradle',range:`>=${gradle[2]} <${Number(gradle[1])+1}.0.0 || >=${gradle[4]} <${Number(gradle[3])+1}.0.0`}];
  } else if (ecosystem === 'gradle' && name === 'gradle') {
    if (request === 'latest') {
      const data = await get('https://services.gradle.org/versions/all');
      if (!Array.isArray(data)) throw new Error('Invalid Gradle releases');
      candidates=sorted(data.filter(v=>!v.snapshot && !v.nightly && !v.releaseCandidate && stable(v.version)).map(v=>v.version));
      version=candidates[0];
    } else version=request;
    const html = await get(`https://docs.gradle.org/${version}/userguide/compatibility.html`,false);
    const table = html.match(/<table[^>]*>.*?Java version.*?<\/table>/s)?.[0];
    if (!table) throw new Error('Gradle Java compatibility table unavailable');
    const supported = [...table.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].flatMap(match=>{
      const cells=[...match[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(m=>m[1].replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim());
      if (cells.length<3 || !/^\d+$/.test(cells[0])) return [];
      const start=cells[2].match(/^(\d+(?:\.\d+){1,2})(?: and (?:after|later))?$/)?.[1];
      return start && semver.gte(semver.coerce(version),semver.coerce(start)) ? [Number(cells[0])] : [];
    });
    if (!supported.length) throw new Error('Gradle Java support conditions unextractable');
    requirements=[{component:'java',ecosystem:'java',range:supported.map(v=>`${v}.0.0`).join(' || ')}];
  } else throw new Error('Unsupported component or Java vendor not selected');
  if (!version || (request !== 'latest' && version !== request)) throw new Error('Exact metadata version mismatch');
  return { version,requirements,peers,optionalPeers,dependencies,...(candidates ? {candidates}:{}),source:sources[0],sources,checkedAt,...(runtimePin ? {runtimePin,runtimeVendor}: {}) };
}

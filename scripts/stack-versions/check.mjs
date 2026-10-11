import { lookupVersionMetadata } from './metadata.mjs';
import { satisfies } from './ranges.mjs';
const runtimes = new Set(['node','python','ruby','java']);
const buildTools = new Set(['gradle']);
export async function checkStackVersions({ inspection, requests = {}, lookup = lookupVersionMetadata, parsers = { satisfies } }) {
  const result = { schema:1, selection:inspection.selection, observed:structuredClone(inspection.observed), targets:{}, requirements:[...(inspection.requirements ?? [])], sources:{}, inputs:inspection.inputs, issues:[...inspection.issues], status:'unverified' };
  const metadata = new Map(), pending = [], done = new Set();
  const issue = (code,target,action) => result.issues.push({code,target,action});
  const roleOf = target => target.slice(0,target.indexOf('.'));
  const componentOf = target => target.slice(target.indexOf('.')+1);
  for (const key of Object.keys(requests)) if (!Object.hasOwn(result.observed,key)) issue('UNKNOWN_VERSION_TARGET',key,'Select a component present in this inspection.');
  for (const [target, observation] of Object.entries(result.observed)) {
    if (observation.state === 'unresolved') { issue('UNRESOLVED_VERSION',target,'Existing unresolved evidence cannot be replaced by a latest proposal.'); continue; }
    if (observation.state === 'absent' && observation.required) { issue('MISSING_COMPONENT',target,'Declare and resolve the selected component outside this read-only checker.'); continue; }
    // Node is irrelevant to importmap-only Hotwire. Do not propose an unused runtime.
    if (observation.state === 'absent' && componentOf(target) === 'node' && inspection.selection.projects.some(p=>p.role === roleOf(target) && p.stackKey === 'rails' && p.ui === 'hotwire')
        && !Object.entries(result.observed).some(([key,o])=>roleOf(key) === roleOf(target) && o.ecosystem === 'npm')) continue;
    pending.push(target);
  }
  function findPackage(role,name) {
    return Object.entries(result.observed).find(([target,o])=>roleOf(target) === role && (o.packageName === name || componentOf(target) === name));
  }
  function requirementsFrom(target,data) {
    const role=roleOf(target);
    for (const requirement of data.requirements ?? []) result.requirements.push({target:`${role}.${requirement.component}`,ecosystem:requirement.ecosystem,range:requirement.range,origin:target});
    for (const [name,range] of Object.entries(data.dependencies ?? {})) {
      const found=findPackage(role,name);
      if (found) result.requirements.push({target:found[0],ecosystem:found[1].ecosystem === 'gem' ? 'ruby' : 'npm',range,origin:target});
    }
    for (const [name,range] of Object.entries(data.peers ?? {})) {
      let found=findPackage(role,name);
      if (!found) {
        const evidence=inspection.packages?.[role]?.[name];
        if (!evidence && (data.optionalPeers ?? []).includes(name)) continue;
        if (!evidence?.version) { issue('UNRESOLVED_PEER',`${role}.${name}`,'A used/required peer needs resolved installation evidence.'); continue; }
        const key=`${role}.peer:${name}`;
        result.observed[key]={state:'exact',version:evidence.version,ecosystem:'npm',packageName:name,required:false};pending.push(key);found=[key,result.observed[key]];
      }
      if (found[1].state === 'absent' && (data.optionalPeers ?? []).includes(name)) continue;
      result.requirements.push({target:found[0],ecosystem:'npm',range,origin:target});
    }
  }
  async function resolveTarget(target) {
    if (done.has(target)) return;
    done.add(target);
    const observation=result.observed[target], component=componentOf(target), request=requests[target] ?? (observation.state === 'exact' ? observation.version : 'latest');
    if (typeof request !== 'string' || !/^(latest|\d[0-9A-Za-z.+-]*)$/.test(request)) { issue('INVALID_VERSION_REQUEST',target,'Use an exact version or latest.'); return; }
    const name=observation.ecosystem === 'java' ? observation.vendor ?? 'java' : observation.packageName ?? component;
    try {
      let data=await lookup(`${observation.ecosystem}:${name}`,request);
      if (!data || typeof data.version !== 'string' || !Array.isArray(data.requirements) || typeof data.source !== 'string' || !Number.isFinite(Date.parse(data.checkedAt))
          || (request !== 'latest' && data.version !== request)) { issue('INVALID_METADATA',target,'Version-specific official evidence must match the requested exact release.'); return; }
      let chosen=data.version;
      if (request === 'latest' && (runtimes.has(component) || buildTools.has(component)) && Array.isArray(data.candidates)) {
        chosen=data.candidates.find(version => result.requirements.filter(r=>r.target === target).every(r=>{
          const check=parsers.satisfies(r.ecosystem,version,r.range,{});return check.matches && check.issues.length === 0;
        }));
        if (!chosen) { issue('NO_COMPATIBLE_RUNTIME',target,'No supported stable runtime satisfies the declared conditions.'); return; }
      }
      if (chosen !== data.version && (data.requirements.length || data.runtimePin || buildTools.has(component))) {
        data = await lookup(`${observation.ecosystem}:${name}`, chosen);
        if (!data || data.version !== chosen || !Array.isArray(data.requirements)) { issue('INVALID_METADATA',target,'Selected candidate support conditions must be version-specific.'); return; }
      }
      result.targets[target]=chosen;
      result.sources[target]={version:chosen,url:data.source,urls:data.sources ?? [data.source],checkedAt:data.checkedAt,...(data.runtimePin ? {runtimePin:data.runtimePin,runtimeVendor:data.runtimeVendor}: {})};
      metadata.set(target,data);requirementsFrom(target,data);
      if (observation.state === 'exact' && chosen !== observation.version && !(observation.versionScope === 'feature' && chosen.split('.')[0] === observation.version)) issue('VERSION_CONFLICT',target,'Requested and existing exact versions differ; update the application deliberately and recheck.');
    } catch { issue('METADATA_UNAVAILABLE',target,'Official metadata, supported release or extractable support conditions are unavailable; repeat when evidence/tooling is available.'); }
  }
  // Framework/adapter metadata supplies runtime constraints before a latest runtime is proposed.
  for (let round=0; pending.length && round < 128; round++) {
    pending.sort((a,b)=>{
      const rank = target => runtimes.has(componentOf(target)) ? 2 : buildTools.has(componentOf(target)) ? 1 : 0;
      return rank(a) - rank(b);
    });
    await resolveTarget(pending.shift());
  }
  if (pending.length) issue('TOO_MANY_COMPONENTS','selection','Bound the declared verification scope before applying.');
  for (const requirement of result.requirements) {
    const version=result.targets[requirement.target] ?? result.observed[requirement.target]?.version;
    if (!version) { issue('MISSING_CONSTRAINT_TARGET',requirement.target,'Provide resolved version evidence for the required runtime/dependency.'); continue; }
    const pythonTarget=`${roleOf(requirement.target)}.python`, py=result.targets[pythonTarget] ?? result.observed[pythonTarget]?.version;
    const environment=py ? {python_version:py.split('.').slice(0,2).join('.'),python_full_version:py}:{};
    const checked=parsers.satisfies(requirement.ecosystem,version,requirement.range,environment);
    if (checked.issues.length) for (const problem of checked.issues) issue(problem.code,requirement.target,problem.action);
    else if (!checked.matches) issue('VERSION_CONFLICT',requirement.target,`The selected version does not satisfy ${requirement.range} required by ${requirement.origin}.`);
  }
  result.status=result.issues.some(i=>i.code === 'VERSION_CONFLICT') ? 'conflict' : result.issues.length ? 'unverified':'compatible';
  return result;
}

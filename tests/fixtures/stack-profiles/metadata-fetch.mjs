// Owned test preload: replace network responses, never consumer application code.
const versions={'react':'19.2.0','react-dom':'19.2.0','vite':'7.1.9','@vitejs/plugin-react':'5.0.4'};
globalThis.fetch=async url=>{
  const u=new URL(url);let body;
  if(u.hostname==='registry.npmjs.org') {
    const parts=u.pathname.slice(1).split('/');const name=decodeURIComponent(parts[0]);
    body={name,version:versions[name],engines:{node:'>=22.12.0'}};
    if(!body.version) return new Response('missing',{status:404});
  } else if(u.hostname==='nodejs.org') body=[{version:'v22.22.3',lts:'Jod'}];
  else if(u.hostname==='raw.githubusercontent.com' && u.pathname.endsWith('schedule.json')) body={v22:{end:'2028-01-01'}};
  else return new Response('missing',{status:404});
  return new Response(JSON.stringify(body));
};

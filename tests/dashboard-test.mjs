import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { startOperation, finishOperation, startChild } from '../plugins/harness-guard/scripts/observation/client.mjs';
const plugin = path.resolve('plugins/harness-guard');
const digest = value => createHash('sha256').update(value).digest('hex');
function fixture(t, repoName = 'repo') {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-viewer-')));
  const installed = path.join(root, 'installed'), repo = path.join(root, repoName), dataDir = path.join(root, 'data');
  fs.mkdirSync(path.join(installed, 'scripts'), { recursive: true });
  fs.cpSync(path.join(plugin, 'scripts/observation'), path.join(installed, 'scripts/observation'), { recursive: true });
  fs.copyFileSync(path.join(plugin, 'scripts/observe.mjs'), path.join(installed, 'scripts/observe.mjs'));
  fs.mkdirSync(path.join(installed, 'dashboard/assets'), { recursive: true });
  const files = { 'index.html': '<!doctype html><html><body>static</body></html>', 'assets/app-a.js': 'console.log("static")', 'assets/app-a.css': 'body{color:black}' };
  const mime = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8' };
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(installed, 'dashboard', name), content);
  fs.writeFileSync(path.join(installed, 'dashboard/asset-manifest.json'), JSON.stringify({ schemaVersion: 1, files: Object.entries(files).map(([name, content]) => ({ path: name, mime: mime[name.split('.').at(-1)], sha256: digest(content) })) }));
  fs.mkdirSync(repo); fs.mkdirSync(dataDir, { mode: 0o700 });
  const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init', '-q']); git(['config', 'user.name', 'Fixture']); git(['config', 'user.email', 'fixture@example.invalid']);
  git(['-c', 'core.hooksPath=/dev/null', 'commit', '--allow-empty', '-qm', 'fixture']);
  const viewers = [];
  t.after(async () => { for (const v of viewers) await v.close(); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, installed, repo, dataDir, git, viewers, load: () => import(pathToFileURL(path.join(installed, 'scripts/observe.mjs')).href) };
}
function request(url, route, options = {}) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: u.port, path: route, method: options.method || 'GET', headers: options.headers || {} }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end();
  });
}
const bearer = url => ({ Authorization: `Bearer ${new URL(url).hash.slice(1)}` });
async function viewer(t, f) {
  const v = await (await f.load()).startViewer({ dataDir: f.dataDir, repo: f.repo, port: 0 });
  f.viewers.push(v); return v;
}
test('loopback, exact Host/Origin/token/path/method allowlist and static bytes', async t => {
  const f = fixture(t), v = await viewer(t, f), u = new URL(v.url);
  assert.equal(u.hostname, '127.0.0.1'); assert.equal(u.search, ''); assert.match(u.hash, /^#[A-Za-z0-9_-]{43}$/);
  const ok = await request(v.url, '/api/context', { headers: { ...bearer(v.url), Origin: u.origin } });
  assert.equal(ok.status, 200); const c = JSON.parse(ok.text); assert.equal(c.schemaVersion, 1); assert.match(c.viewerId, /^[a-f0-9-]{36}$/);
  assert.equal(ok.text.includes(u.hash.slice(1)), false); assert.equal(ok.text.includes(f.root), false);
  for (const route of ['/api/context', '/api/snapshot']) {
    assert.equal((await request(v.url, route)).status, 401);
    assert.equal((await request(v.url, route, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
    for (const Origin of ['null', 'https://attacker.example', u.origin + '.attacker.example'])
      assert.equal((await request(v.url, route, { headers: { ...bearer(v.url), Origin } })).status, 403);
    for (const Host of ['attacker.example', '127.0.0.1:1'])
      assert.equal((await request(v.url, route, { headers: { ...bearer(v.url), Host } })).status, 403);
    assert.equal((await request(v.url, route, { headers: bearer(v.url), method: 'POST' })).status, 405);
  }
  for (const route of ['/.env', '/assets/../secret', '/assets/%2e%2e/secret', '/assets/a%2fb.js', '/assets/a%5cb.js', '/assets/missing.js', '/api/snapshot?token=abc', '/api/snapshot?repoId=wrong'])
    assert.equal((await request(v.url, route, { headers: bearer(v.url) })).status, 404, route);
  const asset = await request(v.url, '/assets/app-a.js'); assert.equal(asset.status, 200); assert.match(asset.headers['content-type'], /^text\/javascript/);
  assert.equal(asset.headers['x-content-type-options'], 'nosniff'); assert.equal(asset.headers['cache-control'], 'no-store');
  assert.match(asset.headers['content-security-policy'], /default-src 'none'/);
  fs.writeFileSync(path.join(f.installed, 'dashboard/assets/app-a.js'), 'changed-after-validation');
  assert.equal((await request(v.url, '/assets/app-a.js')).text, asset.text);
});
test('viewer tokens and fixed targets are distinct; close removes only its own renewable lease', async t => {
  const f = fixture(t), a = await viewer(t, f), b = await viewer(t, f);
  assert.equal((await request(b.url, '/api/snapshot', { headers: bearer(a.url) })).status, 401);
  const leases = () => fs.readdirSync(f.dataDir).filter(n => n.startsWith('lease-'));
  assert.equal(leases().length, 2);
  const initial = leases().map(n => JSON.parse(fs.readFileSync(path.join(f.dataDir, n))));
  await new Promise(r => setTimeout(r, 10100));
  assert.ok(leases().every(n => Date.parse(JSON.parse(fs.readFileSync(path.join(f.dataDir, n))).expiresAt) > Date.parse(initial.find(x => n.includes(x.viewerId)).expiresAt)));
  await a.close(); assert.equal(leases().length, 1);
  const response = await request(b.url, '/api/snapshot', { headers: bearer(b.url) }); assert.equal(response.status, 200);
  await b.close(); assert.equal(leases().length, 0);
});
test('actual observed results retain candidate identity, unfinished and restoration attempt remain unknown', async t => {
  const f = fixture(t), v = await viewer(t, f), options = { cwd: f.repo, dataDir: f.dataDir };
  const passed = startOperation('check-runner', options); assert.ok(passed);
  finishOperation(passed, { outcome: 'pass', reasonCode: 'CHECK_PASSED', exitCode: 0, evidenceId: 'fixture-check' });
  const unfinished = startOperation('check-runner', options); assert.ok(unfinished);
  const parent = startOperation('solo-merge', options), restore = startChild(parent, 'RESTORE_ATTEMPT'); assert.ok(restore);
  const read = async () => JSON.parse((await request(v.url, '/api/snapshot', { headers: bearer(v.url) })).text);
  const first = await read(); assert.equal(first.operations.find(o => o.operationId === passed.operationId).state, 'pass');
  assert.equal(first.operations.find(o => o.operationId === unfinished.operationId).state, 'unverified');
  assert.equal(first.operations.find(o => o.operationId === restore.operationId).state, 'unverified');
  assert.equal(first.target.headSha, passed.headSha); assert.equal(first.target.repoAlias, 'repo');
  f.git(['-c', 'core.hooksPath=/dev/null', 'commit', '--allow-empty', '-qm', 'next candidate']);
  const second = await read(); assert.notEqual(second.target.headSha, passed.headSha);
  assert.equal(second.operations.find(o => o.operationId === passed.operationId).headSha, passed.headSha);
  assert.equal((await read()).operations.length, second.operations.length);
  assert.equal(JSON.stringify(second).includes(f.root), false);
  fs.writeFileSync(path.join(f.dataDir, `evt-${randomUUID()}.json`), '{broken', { mode: 0o600 });
  const broken = await read(); assert.equal(broken.health.captureState, 'loss-suspected'); assert.ok(broken.health.parseErrors > 0);
});
test('unsafe assets fail before activation: hashes, MIME, traversal, duplicates, symlinks and extra files', async t => {
  for (const kind of ['hash', 'mime', 'traversal', 'duplicate', 'symlink', 'extra']) {
    const f = fixture(t), dir = path.join(f.installed, 'dashboard'), manifest = path.join(dir, 'asset-manifest.json');
    const value = JSON.parse(fs.readFileSync(manifest));
    if (kind === 'hash') value.files[0].sha256 = '0'.repeat(64);
    if (kind === 'mime') value.files[0].mime = 'application/javascript';
    if (kind === 'traversal') value.files[0].path = '../outside';
    if (kind === 'duplicate') value.files.push(value.files[0]);
    if (kind === 'symlink') { fs.unlinkSync(path.join(dir, 'assets/app-a.js')); fs.symlinkSync(manifest, path.join(dir, 'assets/app-a.js')); }
    if (kind === 'extra') fs.writeFileSync(path.join(dir, 'notes.txt'), 'preserve');
    fs.writeFileSync(manifest, JSON.stringify(value));
    await assert.rejects(() => (async () => (await f.load()).startViewer({ repo: f.repo, dataDir: f.dataDir }))(), /ASSET|ELOOP|UNMANAGED/, kind);
    assert.deepEqual(fs.readdirSync(f.dataDir), []);
  }
});
test('retained history above the HTTP budget still returns newest complete operations and declares omissions', async t => {
  const f = fixture(t), v = await viewer(t, f);
  const state = startOperation('check-runner', {cwd:f.repo,dataDir:f.dataDir});
  finishOperation(state, {outcome:'pass',reasonCode:'CHECK_PASSED',exitCode:0});
  const originals = fs.readdirSync(f.dataDir).filter(n => n.startsWith('evt-'));
  const pair = originals.map(n => JSON.parse(fs.readFileSync(path.join(f.dataDir,n)))).sort((a,b)=>a.sequence-b.sequence);
  for (const n of originals) fs.unlinkSync(path.join(f.dataDir,n));
  const expected = []; let storedBytes = 0;
  for (let i=0;i<6500;i++) {
    const operationId=randomUUID(); expected.push(operationId);
    for(const e of pair) {
      const event={...e,operationId,eventId:randomUUID(),recordedAt:new Date(Date.now()-6500+i).toISOString()};
      const bytes=JSON.stringify(event)+'\n'; storedBytes+=Buffer.byteLength(bytes);
      fs.writeFileSync(path.join(f.dataDir,`evt-${event.eventId}.json`),bytes,{mode:0o600});
    }
  }
  assert.ok(storedBytes<32*1024*1024);
  const response=await request(v.url,'/api/snapshot',{headers:bearer(v.url)});
  assert.equal(response.status,200); assert.ok(Buffer.byteLength(response.text)<=8*1024*1024);
  const data=JSON.parse(response.text);
  assert.equal(data.health.parseErrors,0); assert.ok(data.health.omittedOperations>0);
  assert.equal(data.operations.length+data.health.omittedOperations,6500);
  assert.equal(data.operations[0].operationId,expected.at(-1));
  assert.ok(data.operations.every(op=>op.events.length===2&&op.state==='pass'));
  assert.equal(fs.readdirSync(f.dataDir).filter(n=>n.startsWith('evt-')).length,13000);
});
test('one oversized operation is omitted whole, never turned into a partial success', async t => {
  const f=fixture(t),v=await viewer(t,f);
  const state=startOperation('check-runner',{cwd:f.repo,dataDir:f.dataDir});
  finishOperation(state,{outcome:'pass',reasonCode:'CHECK_PASSED',exitCode:0});
  const files=fs.readdirSync(f.dataDir).filter(n=>n.startsWith('evt-'));
  const pair=files.map(n=>JSON.parse(fs.readFileSync(path.join(f.dataDir,n)))).sort((a,b)=>a.sequence-b.sequence);
  for(const n of files)fs.unlinkSync(path.join(f.dataDir,n));
  let storedBytes=0;
  for(let i=0;i<10000;i++) {
    const event={...pair[i===0?0:1],eventId:randomUUID(),sequence:i+1,branch:'b'.repeat(255),evidenceId:'e'.repeat(128),hostSessionId:'s'.repeat(128)};
    const bytes=JSON.stringify(event)+'\n';storedBytes+=Buffer.byteLength(bytes);
    fs.writeFileSync(path.join(f.dataDir,`evt-${event.eventId}.json`),bytes,{mode:0o600});
  }
  assert.ok(storedBytes>8*1024*1024&&storedBytes<32*1024*1024);
  const response=await request(v.url,'/api/snapshot',{headers:bearer(v.url)});
  assert.equal(response.status,200);const data=JSON.parse(response.text);
  assert.equal(data.health.parseErrors,0);assert.equal(data.health.omittedOperations,1);
  assert.deepEqual(data.operations,[]);assert.equal(data.health.lastEventAt,pair[1].recordedAt);
  assert.equal(fs.readdirSync(f.dataDir).filter(n=>n.startsWith('evt-')).length,10000);
});

test('legal repository names produce display aliases accepted by the snapshot client', async t => {
  for (const [name, expected] of [['repo\\name', 'reponame'], ['\\\\', 'repository']]) {
    const f = fixture(t, name), v = await viewer(t, f);
    const response = await request(v.url, '/api/snapshot', { headers: bearer(v.url) });
    assert.equal(response.status, 200);
    const { target } = JSON.parse(response.text);
    assert.equal(target.repoAlias, expected);
    assert.equal(target.worktreeAlias, expected);
  }
});

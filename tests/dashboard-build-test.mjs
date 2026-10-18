import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDashboard } from '../scripts/build-dashboard.mjs';
const source = path.resolve('dashboard');
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-build-'))), author = path.join(root, 'dashboard');
  fs.mkdirSync(author); fs.mkdirSync(path.join(root, 'plugins/harness-guard'), { recursive: true });
  fs.copyFileSync(path.join(source, 'package.json'), path.join(author, 'package.json'));
  fs.copyFileSync(path.join(source, 'vite.config.ts'), path.join(author, 'vite.config.ts'));
  fs.symlinkSync(path.join(source, 'node_modules'), path.join(author, 'node_modules'), 'dir');
  fs.writeFileSync(path.join(author, 'index.html'), '<!doctype html><html><body><script type="module" src="/main.ts"></script></body></html>');
  fs.writeFileSync(path.join(author, 'main.ts'), 'import "./style.css"; document.body.textContent = String(import.meta.env.VITE_FILE_CANARY) + String(import.meta.env.VITE_PROCESS_CANARY) + "fixture";');
  fs.writeFileSync(path.join(author, 'style.css'), 'body{color:#123456}');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, author, output: path.join(root, 'plugins/harness-guard/dashboard') };
}
function tree(dir) {
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir, { recursive: true }).sort().map(name => {
    const p = path.join(dir, name), st = fs.lstatSync(p);
    return [name, st.isSymbolicLink() ? fs.readlinkSync(p) : st.isFile() ? fs.readFileSync(p).toString('base64') : 'directory'];
  });
}
test('actual isolated rebuild excludes env canaries and authoring paths; --check preserves all deployed bytes', t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.author, '.env'), 'VITE_FILE_CANARY=FILE_SECRET_CANARY_729\n');
  const previous = process.env.VITE_PROCESS_CANARY; process.env.VITE_PROCESS_CANARY = 'PROCESS_SECRET_CANARY_729';
  try {
    buildDashboard({ repoRoot: f.root, mode: 'write' }); const before = tree(f.output);
    buildDashboard({ repoRoot: f.root, mode: 'check' }); assert.deepEqual(tree(f.output), before);
    const bytes = JSON.stringify(before);
    assert.equal(bytes.includes('FILE_SECRET_CANARY'), false); // Also inspect decoded files, not only tree encoding.
    for (const [name] of before) {
      if (!fs.lstatSync(path.join(f.output, name)).isFile()) continue;
      const text = fs.readFileSync(path.join(f.output, name), 'utf8');
      for (const secret of ['FILE_SECRET_CANARY_729', 'PROCESS_SECRET_CANARY_729', f.root]) assert.equal(text.includes(secret), false, name);
    }
    assert.equal(fs.readFileSync(path.join(f.author, '.env'), 'utf8'), 'VITE_FILE_CANARY=FILE_SECRET_CANARY_729\n');
    const manifest = JSON.parse(fs.readFileSync(path.join(f.output, 'asset-manifest.json')));
    assert.ok(manifest.files.some(x => x.path.endsWith('.js'))); assert.ok(manifest.files.some(x => x.path.endsWith('.css')));
    assert.ok(manifest.files.every(x => !x.path.endsWith('.map') && !x.path.startsWith('.')));
  } finally { if (previous === undefined) delete process.env.VITE_PROCESS_CANARY; else process.env.VITE_PROCESS_CANARY = previous; }
});
test('missing, tampered, extra and old hashed files all fail --check without repair', t => {
  const f = fixture(t); buildDashboard({ repoRoot: f.root, mode: 'write' }); const good = tree(f.output);
  for (const kind of ['missing', 'tamper', 'extra', 'old']) {
    fs.rmSync(f.output, { recursive: true }); fs.mkdirSync(path.join(f.output, 'assets'), { recursive: true });
    for (const [name, bytes] of good) if (bytes !== 'directory') fs.writeFileSync(path.join(f.output, name), Buffer.from(bytes, 'base64'));
    if (kind === 'missing') fs.unlinkSync(path.join(f.output, 'index.html'));
    if (kind === 'tamper') fs.appendFileSync(path.join(f.output, 'index.html'), 'tamper');
    if (kind === 'extra') fs.writeFileSync(path.join(f.output, 'notes.txt'), 'owned by user');
    if (kind === 'old') fs.writeFileSync(path.join(f.output, 'assets/old-deadbeef.js'), 'old');
    const before = tree(f.output);
    assert.throws(() => buildDashboard({ repoRoot: f.root, mode: 'check' }), /ASSET|ENOENT|DRIFT|UNMANAGED/);
    assert.deepEqual(tree(f.output), before, kind);
  }
});
test('--write preserves unexpected files and rejects broken manifests, path escape and symlinks before any deployment mutation', t => {
  const f = fixture(t); buildDashboard({ repoRoot: f.root, mode: 'write' });
  const manifestPath = path.join(f.output, 'asset-manifest.json'), original = fs.readFileSync(manifestPath);
  fs.writeFileSync(path.join(f.output, 'notes.txt'), 'preserve'); let before = tree(f.output);
  assert.throws(() => buildDashboard({ repoRoot: f.root, mode: 'write' }), /UNMANAGED/); assert.deepEqual(tree(f.output), before);
  fs.unlinkSync(path.join(f.output, 'notes.txt'));
  for (const value of ['{broken', JSON.stringify({ schemaVersion: 1, files: [{ path: '../outside', mime: 'text/html; charset=utf-8', sha256: 'a'.repeat(64) }] })]) {
    fs.writeFileSync(manifestPath, value); before = tree(f.output);
    assert.throws(() => buildDashboard({ repoRoot: f.root, mode: 'write' })); assert.deepEqual(tree(f.output), before);
  }
  fs.writeFileSync(manifestPath, original); fs.unlinkSync(path.join(f.output, 'index.html')); fs.symlinkSync(path.join(f.author, 'index.html'), path.join(f.output, 'index.html'));
  before = tree(f.output); assert.throws(() => buildDashboard({ repoRoot: f.root, mode: 'write' }), /UNSAFE|ELOOP/); assert.deepEqual(tree(f.output), before);
});
test('--write removes only previously managed obsolete chunks and repeated output is reproducible', t => {
  const f = fixture(t); buildDashboard({ repoRoot: f.root, mode: 'write' });
  const old = JSON.parse(fs.readFileSync(path.join(f.output, 'asset-manifest.json'))).files.map(x => x.path);
  fs.appendFileSync(path.join(f.author, 'main.ts'), 'document.body.dataset.changed="second";');
  buildDashboard({ repoRoot: f.root, mode: 'write' }); const now = tree(f.output);
  assert.ok(old.some(name => name.endsWith('.js') && !fs.existsSync(path.join(f.output, name))));
  buildDashboard({ repoRoot: f.root, mode: 'check' }); assert.deepEqual(tree(f.output), now);
});
test('--write refuses a newly created unmanaged chunk during Vite build without replacing its contents', t => {
  const f = fixture(t); buildDashboard({ repoRoot: f.root, mode: 'write' });
  const before = tree(f.output);
  fs.appendFileSync(path.join(f.author, 'main.ts'), 'document.body.dataset.newChunk="race";');
  fs.writeFileSync(path.join(f.author, 'vite.config.ts'), `import fs from 'node:fs'; import path from 'node:path'; import {defineConfig} from 'vite';
    export default defineConfig({base:'./',envDir:process.env.HARNESS_DASHBOARD_ENV_DIR,build:{sourcemap:false},plugins:[{name:'concurrent-user-file',writeBundle(_options,bundle){const name=Object.keys(bundle).find(n=>n.endsWith('.js')); fs.writeFileSync(path.join(${JSON.stringify(f.output)},name),'USER_SENTINEL');}}]});`);
  assert.throws(() => buildDashboard({ repoRoot: f.root, mode: 'write' }), /UNMANAGED|CHANGED|EEXIST/);
  for (const [name, bytes] of before) if (bytes !== 'directory') assert.equal(fs.readFileSync(path.join(f.output, name)).toString('base64'), bytes);
  const added = tree(f.output).filter(([name]) => !before.some(([old]) => old === name));
  assert.equal(added.length, 1); assert.equal(Buffer.from(added[0][1], 'base64').toString(), 'USER_SENTINEL');
});

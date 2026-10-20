#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { MIME, sha256, artifactFiles, fileBytes, loadAssets, safeDirectory } from '../plugins/harness-guard/scripts/observation/assets.mjs';

export function buildDashboard({ repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), mode } = {}) {
  if (!['write', 'check'].includes(mode)) throw Error('USAGE: --write or --check');
  const author = path.join(repoRoot, 'dashboard'), output = path.join(repoRoot, 'plugins/harness-guard/dashboard');
  const exists = fs.existsSync(output);
  // Validate ownership before running a build or changing a deployment file.
  const previous = exists ? loadAssets(output, { verifyHashes: mode === 'check' }) : null;
  if (!exists && mode === 'check') throw Error('ASSET_MISSING');
  const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-dashboard-build-')));
  try {
    const built = path.join(temp, 'output'), emptyEnv = path.join(temp, 'env'); fs.mkdirSync(emptyEnv);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VITE_')));
    env.HARNESS_DASHBOARD_ENV_DIR = emptyEnv;
    const result = spawnSync(process.execPath, [path.join(author, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', built, '--emptyOutDir'],
      { cwd: author, env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 60000, killSignal: 'SIGKILL' });
    if (result.error || result.status !== 0) throw Error(`DASHBOARD_BUILD_FAILED: ${result.stderr || result.error?.message || result.status}`);
    const names = artifactFiles(built), buffers = new Map(names.map(name => [name, fileBytes(path.join(built, name))]));
    const manifest = { schemaVersion: 1, files: names.map(name => ({ path: name, mime: MIME[path.extname(name)], sha256: sha256(buffers.get(name)) })) };
    const encoded = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(path.join(built, 'asset-manifest.json'), encoded); loadAssets(built);
    buffers.set('asset-manifest.json', encoded);
    if (mode === 'check') {
      if (JSON.stringify(artifactFiles(output)) !== JSON.stringify([...buffers.keys()].sort()) ||
        [...buffers].some(([name, bytes]) => !fileBytes(path.join(output, name)).equals(bytes))) throw Error('DASHBOARD_ASSET_DRIFT');
      return { mode, files: manifest.files.length };
    }
    safeDirectory(path.dirname(output));
    // A long build does not reserve deployment ownership. Recheck before the first write.
    if (exists) {
      const current = loadAssets(output, { verifyHashes: false });
      if (JSON.stringify(current.manifest) !== JSON.stringify(previous.manifest) ||
        [...previous.files].some(([name, file]) => !current.files.get(name)?.bytes.equals(file.bytes))) throw Error('ASSET_CHANGED_DURING_BUILD');
    } else fs.mkdirSync(output);
    safeDirectory(output); const identity = fs.lstatSync(output);
    const ensure = () => {
      safeDirectory(output); const current = fs.lstatSync(output);
      if (current.dev !== identity.dev || current.ino !== identity.ino) throw Error('ASSET_DIRECTORY_CHANGED');
    };
    const assetPath = path.join(output, 'assets');
    if (manifest.files.some(f => f.path.startsWith('assets/')) && !fs.existsSync(assetPath)) fs.mkdirSync(assetPath);
    // New chunks first; index and manifest last. Every removal is named by the old manifest.
    for (const [name, bytes] of [...buffers].sort(([a], [b]) => Number(a === 'asset-manifest.json' || a === 'index.html') - Number(b === 'asset-manifest.json' || b === 'index.html'))) {
      ensure(); safeDirectory(path.dirname(path.join(output, name)));
      const tmp = path.join(path.dirname(path.join(output, name)), `.build-${randomUUID()}`);
      try {
        fs.writeFileSync(tmp, bytes, { flag: 'wx' }); ensure();
        const owned = name === 'asset-manifest.json' && exists || previous?.manifest.files.some(f => f.path === name);
        if (owned) fs.renameSync(tmp, path.join(output, name));
        else fs.linkSync(tmp, path.join(output, name)); // Atomic no-overwrite for newly managed paths.
      }
      finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
    }
    for (const file of previous?.manifest.files || []) if (!buffers.has(file.path)) { ensure(); fs.unlinkSync(path.join(output, file.path)); }
    loadAssets(output); return { mode, files: manifest.files.length };
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1 || !['--write', '--check'].includes(args[0])) throw Error('USAGE: --write or --check');
    const result = buildDashboard({ mode: args[0].slice(2) }); console.log(`dashboard ${result.mode}: PASS (${result.files} assets)`);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const MIME = Object.freeze({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' });
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function safeDirectory(dir) {
  if (!path.isAbsolute(dir) || path.resolve(dir) !== dir) throw Error('UNSAFE_ASSET_DIRECTORY');
  let current = path.parse(dir).root;
  for (const name of dir.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, name);
    if (!fs.lstatSync(current).isDirectory()) throw Error('UNSAFE_ASSET_DIRECTORY');
  }
}
export function fileBytes(file, max = 8 * 1024 * 1024) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile() || st.nlink !== 1 || st.size > max) throw Error('UNSAFE_ASSET_FILE');
    const bytes = fs.readFileSync(fd), after = fs.lstatSync(file);
    if (bytes.length > max || after.dev !== st.dev || after.ino !== st.ino || !after.isFile()) throw Error('ASSET_CHANGED');
    return bytes;
  } finally { fs.closeSync(fd); }
}
export function parseManifest(value) {
  if (!value || Object.keys(value).sort().join() !== 'files,schemaVersion' || value.schemaVersion !== 1 ||
    !Array.isArray(value.files) || value.files.length < 1 || value.files.length > 100) throw Error('INVALID_ASSET_MANIFEST');
  const seen = new Set();
  for (const item of value.files) {
    if (!item || Object.keys(item).sort().join() !== 'mime,path,sha256' || typeof item.path !== 'string' ||
      !(item.path === 'index.html' || /^assets\/[A-Za-z0-9][A-Za-z0-9_-]*\.(?:js|css)$/.test(item.path)) ||
      seen.has(item.path) || item.mime !== MIME[path.extname(item.path)] || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) throw Error('INVALID_ASSET_MANIFEST');
    seen.add(item.path);
  }
  if (!seen.has('index.html')) throw Error('MISSING_ASSET_INDEX');
  return value;
}
export function artifactFiles(dir) {
  safeDirectory(dir); const names = [];
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name), st = fs.lstatSync(file);
    if (name === 'assets' && st.isDirectory()) {
      for (const child of fs.readdirSync(file)) {
        if (!fs.lstatSync(path.join(file, child)).isFile()) throw Error('UNSAFE_ASSET_ENTRY');
        names.push(`assets/${child}`);
      }
    } else {
      if (!st.isFile()) throw Error('UNSAFE_ASSET_ENTRY');
      names.push(name);
    }
  }
  return names.sort();
}
export function loadAssets(dir, { verifyHashes = true } = {}) {
  safeDirectory(dir);
  const manifest = parseManifest(JSON.parse(fileBytes(path.join(dir, 'asset-manifest.json'), 65536)));
  const expected = ['asset-manifest.json', ...manifest.files.map(f => f.path)].sort();
  if (JSON.stringify(artifactFiles(dir)) !== JSON.stringify(expected)) throw Error('UNMANAGED_ASSET');
  const files = new Map(); let size = 0;
  for (const item of manifest.files) {
    const bytes = fileBytes(path.join(dir, item.path)); size += bytes.length;
    if (size > 16 * 1024 * 1024 || verifyHashes && sha256(bytes) !== item.sha256) throw Error('ASSET_DIGEST_MISMATCH');
    files.set('/' + item.path, { bytes, mime: item.mime });
  }
  files.set('/', files.get('/index.html'));
  return { manifest, files };
}

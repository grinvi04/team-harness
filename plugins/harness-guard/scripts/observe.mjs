#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadAssets, safeDirectory } from './observation/assets.mjs';
import { directory } from './observation/storage.mjs';
import { writeLease, removeLease } from './observation/event.mjs';
import { resolveContext } from './observation/context.mjs';
import { readSnapshot } from './observation/read.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const MAX_RESPONSE = 8 * 1024 * 1024;
const alias = value => path.basename(value).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 160);
function target(repo, initial) {
  const current = resolveContext(repo);
  const valid = current?.repoId === initial.repoId && current?.worktreeId === initial.worktreeId;
  const branch = spawnSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { cwd: repo, encoding: 'utf8', timeout: 250, maxBuffer: 4096, killSignal: 'SIGKILL' });
  const name = branch.status === 0 ? branch.stdout.trim() : null;
  return { repoAlias: alias(initial.commonDir.endsWith('/.git') ? path.dirname(initial.commonDir) : initial.commonDir),
    worktreeAlias: alias(repo), branch: valid && name && name.length <= 255 && !/[\x00-\x1f\x7f]/.test(name) ? name : null,
    headSha: valid ? current.headSha : null };
}
export async function startViewer({ dataDir, repo, port = 0 }) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('INVALID_PORT');
  const assets = loadAssets(path.resolve(here, '../dashboard'));
  const resolvedRepo = fs.realpathSync(repo), context = resolveContext(resolvedRepo);
  if (!context) throw Error('REPO_CONTEXT_UNAVAILABLE');
  const common = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: resolvedRepo, encoding: 'utf8', timeout: 250, maxBuffer: 8192, killSignal: 'SIGKILL' });
  if (common.status !== 0 || common.error) throw Error('REPO_CONTEXT_UNAVAILABLE');
  const initial = { ...context, commonDir: fs.realpathSync(common.stdout.trim()) };
  if (typeof dataDir !== 'string' || path.resolve(dataDir) !== dataDir) throw Error('INVALID_DATA_DIRECTORY');
  safeDirectory(path.dirname(dataDir));
  try { fs.mkdirSync(dataDir, { mode: 0o700 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  directory(dataDir);
  const viewerId = randomUUID(), token = randomBytes(32).toString('base64url');
  const publicContext = { schemaVersion: 1, viewerId, repoId: context.repoId, worktreeId: context.worktreeId };
  const refresh = () => writeLease(dataDir, { schemaVersion: 1, viewerId, repoId: context.repoId, worktreeId: context.worktreeId, expiresAt: new Date(Date.now() + 30000).toISOString() });
  let origin, closed = false, timer, captureError = false;
  const server = http.createServer({ maxHeaderSize: 8192, requestTimeout: 2000, headersTimeout: 2000 }, (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Cache-Control', 'no-store');
    const send = (code, bytes, mime = 'text/plain; charset=utf-8') => {
      res.writeHead(code, { 'Content-Type': mime, 'Content-Length': Buffer.byteLength(bytes) }); res.end(bytes);
    };
    const deny = code => send(code, 'Request rejected\n');
    try {
      if (req.headers.host !== new URL(origin).host || req.headers.origin !== undefined && req.headers.origin !== origin) return deny(403);
      if (req.method !== 'GET') return deny(405);
      // Match the raw path. URL normalization must not turn traversal into an allowed route.
      const route = req.url;
      if (route === '/api/context' || route === '/api/snapshot') {
        const supplied = req.headers.authorization, expected = `Bearer ${token}`;
        if (typeof supplied !== 'string' || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return deny(401);
        const snapshot = route === '/api/context' ? publicContext : {
          ...publicContext, ...readSnapshot(dataDir, context), target: target(resolvedRepo, initial),
        };
        if (captureError && snapshot.health) snapshot.health.captureState = 'error';
        const encoded = JSON.stringify(snapshot);
        if (Buffer.byteLength(encoded) > MAX_RESPONSE) return deny(413);
        return send(200, encoded, 'application/json; charset=utf-8');
      }
      const asset = assets.files.get(route);
      if (!asset) return deny(404);
      send(200, asset.bytes, asset.mime);
    } catch { deny(503); }
  });
  server.maxRequestsPerSocket = 100;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  try { refresh(); } catch (e) { server.close(); throw e; }
  timer = setInterval(() => { try { refresh(); captureError = false; } catch { captureError = true; } }, 10000);
  timer.unref();
  return { url: `${origin}/#${token}`, async close() {
    if (closed) return; closed = true; clearInterval(timer);
    const stopped = new Promise(resolve => server.close(resolve)); server.closeAllConnections();
    try { removeLease(dataDir, viewerId); } finally { await stopped; }
  } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    while (args.length) {
      const flag = args.shift();
      if (!['--repo', '--data-dir'].includes(flag) || options[flag] || !args.length) throw Error('USAGE');
      options[flag] = args.shift();
    }
    if (!options['--repo'] || !options['--data-dir']) throw Error('USAGE');
    const viewer = await startViewer({ repo: options['--repo'], dataDir: path.resolve(options['--data-dir']) });
    console.log(`Team Harness 관측: ${viewer.url}`);
    console.log('종료: Ctrl+C. 이 viewer의 수집만 종료합니다.');
    const stop = () => viewer.close().then(() => process.exit(0), () => process.exit(1));
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  } catch { console.error('관측 시작 실패. --repo 경로와 --data-dir 소유자 전용 경로, 배포 파일을 확인하세요.'); process.exitCode = 1; }
}

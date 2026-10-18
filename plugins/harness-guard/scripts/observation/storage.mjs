import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const EVENT_FILE = /^evt-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/;
export const MAX_EVENT = 4096, MAX_SPOOL = 32 * 1024 * 1024, MAX_AGE = 7 * 86400000;
export function directory(dir) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir) || path.resolve(dir) !== dir) throw Error('UNSAFE_STORAGE');
  let part = path.parse(dir).root;
  for (const name of dir.slice(part.length).split(path.sep).filter(Boolean)) {
    part = path.join(part, name);
    if (!fs.lstatSync(part).isDirectory()) throw Error('UNSAFE_STORAGE');
  }
  const st = fs.lstatSync(dir);
  if (st.uid !== process.getuid() || (st.mode & 0o777) !== 0o700) throw Error('UNSAFE_STORAGE');
  return { dir, dev: st.dev, ino: st.ino };
}
export function unchanged(root) {
  const current = directory(root.dir);
  if (root.dev !== current.dev || root.ino !== current.ino) throw Error('STORAGE_CHANGED');
}
function regular(st, size, links = 1) {
  if (!st.isFile() || st.uid !== process.getuid() || (st.mode & 0o777) !== 0o600 || st.nlink > links || st.size > size)
    throw Error('UNSAFE_RECORD');
}
export function statRecord(root, name, links = 1) {
  const st = fs.lstatSync(path.join(root.dir, name)); regular(st, MAX_EVENT, links); return st;
}
export function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; }
}
function firstWriter(root) {
  const entries = [];
  for (const name of fs.readdirSync(root.dir)) {
    const match = /^\.owner-([1-9][0-9]*)-([0-9a-f-]+)$/.exec(name);
    if (!match || !UUID.test(match[2]) || !alive(Number(match[1]))) continue;
    try {
      const st = statRecord(root, name, 2);
      entries.push({ name, created: st.birthtimeMs || st.mtimeMs });
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  entries.sort((a, b) => a.created - b.created || a.name.localeCompare(b.name));
  return entries[0]?.name;
}
export function cleanDeadTemps(root) {
  let removed = false;
  for (const name of fs.readdirSync(root.dir)) {
    const match = /^\.(?:tmp|owner)-([1-9][0-9]*)-([0-9a-f-]+)$/.exec(name);
    if (!match || !UUID.test(match[2]) || alive(Number(match[1]))) continue;
    try { statRecord(root, name); unchanged(root); fs.unlinkSync(path.join(root.dir, name)); removed = true; }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return removed;
}
export function readFile(root, name, max = MAX_EVENT, links = 1, batch = false) {
  if (!batch) unchanged(root);
  if (path.basename(name) !== name) throw Error('UNSAFE_RECORD');
  const file = path.join(root.dir, name);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const st = fs.fstatSync(fd); regular(st, max, links);
    const data = fs.readFileSync(fd); if (data.length > max) throw Error('OVERSIZE');
    if (!batch) unchanged(root);
    const after = fs.lstatSync(file);
    if (after.ino !== st.ino || after.dev !== st.dev) throw Error('RECORD_CHANGED');
    return { data, stat: st };
  } finally { fs.closeSync(fd); }
}
export function atomicWrite(root, name, data) {
  unchanged(root);
  if (path.basename(name) !== name) throw Error('UNSAFE_RECORD');
  const target = path.join(root.dir, name);
  try { regular(fs.lstatSync(target), MAX_EVENT); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const tmp = path.join(root.dir, `.tmp-${process.pid}-${randomUUID()}`);
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, data); fs.fsyncSync(fd); unchanged(root); fs.renameSync(tmp, target);
  } finally { fs.closeSync(fd); try { fs.unlinkSync(tmp); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
}
export async function withWriterLock(root, fn) {
  const token = randomUUID(), ownerName = `.owner-${process.pid}-${token}`;
  const owner = path.join(root.dir, ownerName), lock = path.join(root.dir, '.writer-lock');
  unchanged(root); fs.writeFileSync(owner, JSON.stringify({ pid: process.pid, token }), { flag: 'wx', mode: 0o600 });
  const deadline = Date.now() + 10000; let held = false;
  try {
    while (!held) {
      unchanged(root);
      // Do not enumerate thousands of event files while another writer owns
      // the lock. Only the handoff window needs the fair queue scan.
      try {
        const record = JSON.parse(readFile(root, '.writer-lock', 256, 2).data);
        if (!Number.isSafeInteger(record.pid) || record.pid < 1 || !UUID.test(record.token)) throw Error('UNSAFE_LOCK');
        if (alive(record.pid)) {
          if (Date.now() >= deadline) throw Error('WRITER_BUSY');
          await delay(10); continue;
        }
      } catch (e) { if (e.code !== 'ENOENT' && e.message !== 'RECORD_CHANGED') throw e; }
      if (firstWriter(root) !== ownerName) {
        if (Date.now() >= deadline) throw Error('WRITER_BUSY');
        await delay(5); continue;
      }
      try { fs.linkSync(owner, lock); held = true; }
      catch (e) {
        if (e.code !== 'EEXIST') throw e;
        try {
          const entry = readFile(root, '.writer-lock', 256, 2), record = JSON.parse(entry.data);
          if (!Number.isSafeInteger(record.pid) || record.pid < 1 || !UUID.test(record.token)) throw Error('UNSAFE_LOCK');
          try { process.kill(record.pid, 0); }
          catch (err) {
            if (err.code !== 'ESRCH') throw err;
            const st = fs.lstatSync(lock);
            if (st.ino === entry.stat.ino && st.dev === entry.stat.dev) fs.unlinkSync(lock);
          }
        } catch (err) { if (err.code !== 'ENOENT' && err.message !== 'RECORD_CHANGED') throw err; }
        if (Date.now() >= deadline) throw Error('WRITER_BUSY');
        await delay(3 + Math.random() * 10);
      }
    }
    return await fn();
  } finally {
    if (held) {
      const st = fs.lstatSync(owner);
      try { const actual = fs.lstatSync(lock); if (st.ino === actual.ino && st.dev === actual.dev) fs.unlinkSync(lock); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    fs.unlinkSync(owner);
    // Yield between consecutive writes so another process can acquire the lock.
    await delay(1);
  }
}

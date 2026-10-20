import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

const key = s => createHash('sha256').update(JSON.stringify([s.repo, s.trunk])).digest('hex')
function directory(dir) {
  const st = fs.lstatSync(dir)
  if (!st.isDirectory() || st.uid !== process.getuid() || (st.mode & 0o777) !== 0o700)
    throw Error('merge journal directory must be owned, regular and 0700')
  return fs.realpathSync(dir)
}
function location(dir, file) {
  const root = directory(dir), absolute = path.resolve(root, file)
  if (path.dirname(absolute) !== root || !/^[a-f0-9]{64}\.json$/.test(path.basename(absolute)))
    throw Error('journal path is outside the active journal directory')
  const st = fs.lstatSync(absolute)
  if (!st.isFile() || st.uid !== process.getuid() || (st.mode & 0o777) !== 0o600)
    throw Error('merge journal must be an owned, regular 0600 file')
  return absolute
}
function validate(data, file) {
  if (data?.schemaVersion !== 1 || !data.snapshot?.repo || !data.snapshot.trunk
    || typeof data.requestStarted !== 'boolean' || typeof data.solo !== 'boolean'
    || typeof data.restored !== 'boolean' || !['reserved', 'pending', 'enqueued', 'failed', 'merged', 'unverified'].includes(data.state)
    || path.basename(file) !== `${key(data.snapshot)}.json`) throw Error('invalid merge journal')
}
function durableWrite(file, data) {
  const fd = fs.openSync(file, 'wx', 0o600)
  try { fs.writeFileSync(fd, JSON.stringify(data) + '\n'); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}
function syncDir(dir) {
  const fd = fs.openSync(dir, 'r')
  try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}
export function reserve(dir, snapshot, { solo = false, protection = null } = {}) {
  const root = directory(dir), file = path.join(root, `${key(snapshot)}.json`)
  const data = { schemaVersion: 1, snapshot, state: 'reserved', requestStarted: false,
    requestId: null, solo, protection, restored: !solo }
  validate(data, file)
  try { durableWrite(file, data) } catch (e) {
    if (e.code === 'EEXIST') throw Error(`unresolved merge reservation for this base: ${file}`)
    throw e
  }
  syncDir(root)
  return { file, data }
}
export function load(dir, file) {
  const absolute = location(dir, file), data = JSON.parse(fs.readFileSync(absolute, 'utf8'))
  validate(data, absolute)
  return data
}
export function save(dir, file, data) {
  const absolute = location(dir, file), previous = load(dir, file)
  validate(data, absolute)
  if (JSON.stringify(previous.snapshot) !== JSON.stringify(data.snapshot) || previous.solo !== data.solo
    || JSON.stringify(previous.protection) !== JSON.stringify(data.protection)) throw Error('journal identity changed')
  const temp = path.join(path.dirname(absolute), `.write-${randomUUID()}`)
  try { durableWrite(temp, data); fs.renameSync(temp, absolute); syncDir(path.dirname(absolute)) }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp) }
}
export function finish(dir, file, { restored }) {
  const absolute = location(dir, file), data = load(dir, file)
  data.restored = data.solo ? restored === true : true
  save(dir, file, data)
  if (!data.restored || (data.requestStarted && !['merged', 'failed'].includes(data.state))) return { released: false }
  // Keep the terminal proof before releasing the shared base reservation.
  const archive = path.join(path.dirname(absolute), `archive-${randomUUID()}.json`)
  fs.renameSync(absolute, archive); syncDir(path.dirname(absolute))
  return { released: true, archive }
}

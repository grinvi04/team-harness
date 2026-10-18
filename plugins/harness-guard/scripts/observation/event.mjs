import fs from 'node:fs';
import path from 'node:path';
import { directory, unchanged, readFile, statRecord, cleanDeadTemps, atomicWrite, withWriterLock, UUID, EVENT_FILE, MAX_EVENT, MAX_SPOOL, MAX_AGE } from './storage.mjs';

export const REASONS = Object.freeze({
  STARTED: '확인 시작', GUARD_ALLOWED: '가드 허용: 명령 성공을 뜻하지 않음', GUARD_DENIED: '가드 차단',
  GUARD_PARSER_UNAVAILABLE: '가드 입력 파서 사용 불가', GUARD_TOKENIZER_UNAVAILABLE: '가드 토크나이저 사용 불가',
  GUARD_PROTECTED_COMMIT: '보호 브랜치 직접 커밋 차단', GUARD_PROTECTED_FORCE_PUSH: '보호 브랜치 강제 push 차단',
  GUARD_SPEC_REQUIRED: 'feature 스펙 필요', GUARD_STACK_WRAPPER_REQUIRED: 'stack 래퍼 필요',
  GUARD_PR_CREATE_WRAPPER_REQUIRED: 'PR 생성 래퍼 필요', GUARD_PR_MERGE_WRAPPER_REQUIRED: 'PR 병합 래퍼 필요',
  GUARD_HARD_RESET: 'hard reset 차단', GUARD_VERIFICATION_DELETE: '검증기 삭제 차단',
  GUARD_CORE_DELETE: '핵심 디렉터리 삭제 차단', GUARD_GLOBAL_INSTALL: '전역 설치 차단',
  INPUT_INVALID: '입력 확인 실패', CONTEXT_MISSING: '실행 문맥 누락', CHECK_PASSED: '명시한 검사 통과',
  CHECK_FAILED: '명시한 검사 실패', PR_CREATED: 'PR 생성 확인', PR_CREATE_FAILED: 'PR 생성 실패',
  MERGE_REQUESTED: '병합 요청', MERGED: '원격 병합 확인', MERGE_PENDING: '병합 결과 대기',
  MERGE_FAILED: '병합 실패', RESTORE_ATTEMPT: '보호 복구 시도', RESTORE_VERIFIED: '보호 원값 재조회 일치',
  RESTORE_UNVERIFIED: '보호 복구 미확인', EXECUTION_ERROR: '실행 오류', RESULT_UNVERIFIED: '결과 미확인',
});
export const guardDenialReason = reason => typeof reason === 'string' && reason.startsWith('GUARD_') &&
  reason !== 'GUARD_ALLOWED' && Object.hasOwn(REASONS, reason) ? reason : 'GUARD_DENIED';
const required = ['schemaVersion', 'eventId', 'operationId', 'parentOperationId', 'sequence', 'recordedAt',
  'source', 'phase', 'outcome', 'reasonCode', 'pluginVersion', 'repoId', 'worktreeId', 'hostSessionId', 'headSha', 'baseSha'];
const optional = ['branch', 'prNumber', 'exitCode', 'durationMs', 'evidenceId'];
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid = value => typeof value === 'string' && UUID.test(value);
const sha = value => value === null || typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value));
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
export function validateEvent(e) {
  try {
    if (!e || Object.getPrototypeOf(e) !== Object.prototype || required.some(k => !Object.hasOwn(e, k)) ||
      Object.keys(e).some(k => !required.includes(k) && !optional.includes(k))) return false;
    if (e.schemaVersion !== 1 || !uuid(e.eventId) || !uuid(e.operationId) ||
      !(e.parentOperationId === null || uuid(e.parentOperationId)) || !integer(e.sequence, 1, 1000000) ||
      !date(e.recordedAt) || !['codex-hook', 'claude-hook', 'guard', 'check-runner', 'pr-create', 'pr-merge', 'solo-merge', 'stack'].includes(e.source) ||
      !['started', 'finished'].includes(e.phase) || !['allow', 'deny', 'pass', 'fail', 'pending', 'enqueued', 'unverified'].includes(e.outcome) ||
      e.phase === 'started' && e.outcome !== 'pending' || !Object.hasOwn(REASONS, e.reasonCode) ||
      typeof e.pluginVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(e.pluginVersion) ||
      !digest(e.repoId) || !digest(e.worktreeId) || !(e.hostSessionId === null || id(e.hostSessionId)) || !sha(e.headSha) || !sha(e.baseSha)) return false;
    if ('branch' in e && (typeof e.branch !== 'string' || e.branch.length > 255 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(e.branch) || /\.\.|\/\/|\.lock(?:\/|$)|[/.]$/.test(e.branch))) return false;
    if ('prNumber' in e && !integer(e.prNumber, 1, 1000000000) ||
      'exitCode' in e && !integer(e.exitCode, 0, 255) || 'durationMs' in e && !integer(e.durationMs, 0, 604800000) ||
      'evidenceId' in e && !id(e.evidenceId)) return false;
    return Buffer.byteLength(JSON.stringify(e) + '\n') <= MAX_EVENT;
  } catch { return false; }
}
export function validLease(lease, target, now = Date.now()) {
  return lease && Object.keys(lease).sort().join() === 'expiresAt,repoId,schemaVersion,viewerId,worktreeId' &&
    lease.schemaVersion === 1 && uuid(lease.viewerId) && digest(lease.repoId) && digest(lease.worktreeId) &&
    date(lease.expiresAt) && Date.parse(lease.expiresAt) > now && Date.parse(lease.expiresAt) <= now + 30000 &&
    lease.repoId === target.repoId && lease.worktreeId === target.worktreeId;
}
export function readLease(root, target, { allowAnyWorktree = false } = {}) {
  for (const name of fs.readdirSync(root.dir)) {
    if (!name.startsWith('lease-') || !name.endsWith('.json') || !UUID.test(name.slice(6, -5))) continue;
    try {
      const value = JSON.parse(readFile(root, name, 512).data);
      const leaseTarget = allowAnyWorktree && target.worktreeId === undefined
        ? { repoId: target.repoId, worktreeId: value.worktreeId } : target;
      if (value.viewerId === name.slice(6, -5) && validLease(value, leaseTarget)) return value;
    } catch (e) { if (e.code !== 'ENOENT' && e.message !== 'RECORD_CHANGED') throw e; }
  }
  return null;
}
export function writeLease(dataDir, lease) {
  // Expired leases are valid stored metadata, but never authorize append.
  if (!validLease(lease, lease, Date.parse(lease?.expiresAt) - 1)) throw Error('INVALID_LEASE');
  atomicWrite(directory(dataDir), `lease-${lease.viewerId}.json`, JSON.stringify(lease) + '\n');
}
export function removeLease(dataDir, viewerId) {
  if (!uuid(viewerId)) throw Error('INVALID_VIEWER');
  const root = directory(dataDir), name = `lease-${viewerId}.json`;
  try {
    const current = JSON.parse(readFile(root, name, 512).data);
    if (current.viewerId === viewerId) { unchanged(root); fs.unlinkSync(path.join(dataDir, name)); }
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
let cacheRoot = '', recordCache = new Map();
export function readEvents(root) {
  unchanged(root);
  const rootKey = `${root.dir}:${root.dev}:${root.ino}`;
  if (rootKey !== cacheRoot) { cacheRoot = rootKey; recordCache = new Map(); }
  const records = []; let parseErrors = 0, total = 0;
  const seen = new Set();
  for (const name of fs.readdirSync(root.dir).filter(n => EVENT_FILE.test(n))) {
    try {
      const stat = statRecord(root, name);
      const stamp = [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(':');
      let value = recordCache.get(name)?.stamp === stamp ? recordCache.get(name).value : null;
      if (!value) {
        value = JSON.parse(readFile(root, name, MAX_EVENT, 1, true).data);
        if (!validateEvent(value) || name !== `evt-${value.eventId}.json`) throw Error('INVALID_EVENT');
        Object.freeze(value); recordCache.set(name, { stamp, value });
      }
      seen.add(name);
      records.push({ name, value, size: stat.size }); total += stat.size;
    } catch (e) { if (e.code !== 'ENOENT') parseErrors++; }
  }
  for (const name of recordCache.keys()) if (!seen.has(name)) recordCache.delete(name);
  unchanged(root);
  return { records, parseErrors, total };
}
export async function appendEvent(dataDir, event) {
  if (!validateEvent(event)) return { written: false, reasonCode: 'INVALID_EVENT' };
  try {
    const root = directory(dataDir);
    if (!readLease(root, event)) return { written: false, reasonCode: 'CAPTURE_OFF' };
    return await withWriterLock(root, () => {
      if (!readLease(root, event)) return { written: false, reasonCode: 'CAPTURE_OFF' };
      if (cleanDeadTemps(root)) atomicWrite(root, 'retention-v1.json', JSON.stringify({ schemaVersion: 1, applied: true }) + '\n');
      const now = Date.now(), when = Date.parse(event.recordedAt);
      if (when > now + 5000 || when <= now - MAX_AGE) return { written: false, reasonCode: 'EVENT_TIME_INVALID' };
      const name = `evt-${event.eventId}.json`, file = path.join(dataDir, name);
      try { readFile(root, name); return { written: false, reasonCode: 'DUPLICATE' }; }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
      const scan = readEvents(root);
      // Malformed managed entries are evidence of loss, never silently deleted to make room.
      if (scan.parseErrors) throw Error('INVALID_STORAGE');
      let size = scan.total; const encoded = JSON.stringify(event) + '\n', incoming = Buffer.byteLength(encoded);
      const ordered = scan.records.sort((a, b) => a.value.recordedAt.localeCompare(b.value.recordedAt) || a.name.localeCompare(b.name));
      const removed = [];
      for (const item of ordered) {
        if (Date.parse(item.value.recordedAt) <= now - MAX_AGE || size + incoming > MAX_SPOOL) {
          removed.push(item); size -= item.size;
        }
      }
      if (removed.length) {
        // Commit loss evidence BEFORE removal so a terminated writer cannot hide retention.
        atomicWrite(root, 'retention-v1.json', JSON.stringify({ schemaVersion: 1, applied: true }) + '\n');
        for (const item of removed) { unchanged(root); fs.unlinkSync(path.join(dataDir, item.name)); }
      }
      unchanged(root); atomicWrite(root, name, encoded);
      return { written: true, reasonCode: 'RECORDED' };
    });
  } catch (e) {
    return { written: false, reasonCode: ['WRITER_BUSY', 'INVALID_STORAGE', 'STORAGE_CHANGED', 'RECORD_CHANGED'].includes(e.message) ? e.message : 'STORAGE_ERROR' };
  }
}

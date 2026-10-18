export type ViewerContext = { viewerId: string; repoId: string; worktreeId: string; accessToken: string };
export type Event = { schemaVersion: number; eventId: string; operationId: string; parentOperationId: string | null; sequence: number; recordedAt: string; source: string; phase: string; outcome: string; reasonCode: string; pluginVersion: string; repoId: string; worktreeId: string; hostSessionId: string | null; headSha: string | null; baseSha: string | null; branch?: string; prNumber?: number; exitCode?: number; durationMs?: number; evidenceId?: string };
export type Operation = Pick<Event, 'operationId' | 'source' | 'repoId' | 'worktreeId' | 'hostSessionId' | 'headSha' | 'baseSha'> & { state: string; events: Event[] };
export type Snapshot = { schemaVersion: number; viewerId: string; repoId: string; worktreeId: string; target: { repoAlias: string; worktreeAlias: string; branch: string | null; headSha: string | null }; observedAt: string; health: { captureState: string; lastEventAt: string | null; parseErrors: number; gaps: number; retentionApplied: boolean; omittedOperations?: number }; operations: Operation[] };

export const REASONS: Record<string, string> = {
  STARTED: '확인 시작', GUARD_ALLOWED: '가드 허용 · 명령 성공을 뜻하지 않음', GUARD_DENIED: '가드 차단', INPUT_INVALID: '입력 확인 실패', CONTEXT_MISSING: '실행 문맥 누락', CHECK_PASSED: '명시한 검사 통과', CHECK_FAILED: '명시한 검사 실패', PR_CREATED: 'PR 생성 확인', PR_CREATE_FAILED: 'PR 생성 실패', MERGE_REQUESTED: '병합 요청', MERGED: '원격 병합 확인', MERGE_PENDING: '병합 결과 대기', MERGE_FAILED: '병합 실패', RESTORE_ATTEMPT: '보호 복구 시도', RESTORE_VERIFIED: '보호 원값 재조회 일치', RESTORE_UNVERIFIED: '보호 복구 미확인', EXECUTION_ERROR: '실행 오류', RESULT_UNVERIFIED: '결과 미확인',
};
const sources = ['codex-hook', 'claude-hook', 'guard', 'check-runner', 'pr-create', 'pr-merge', 'solo-merge', 'stack'];
const outcomes = ['allow', 'deny', 'pass', 'fail', 'pending', 'enqueued', 'unverified'];
const uuid = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const sha = (v: unknown) => v === null || typeof v === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(v);
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v));
const id = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(v);
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const branch = (v: unknown) => typeof v === 'string' && v.length <= 255 && /^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(v) && !/\.\.|\/\/|\.lock(?:\/|$)|[/.]$/.test(v);
function requireValue(condition: unknown): asserts condition { if (!condition) throw Error('INVALID_SNAPSHOT'); }
function record(v: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  requireValue(v !== null && typeof v === 'object' && !Array.isArray(v));
  const r = v as Record<string, unknown>;
  requireValue(required.every(k => Object.hasOwn(r, k)) && Object.keys(r).every(k => required.includes(k) || optional.includes(k)));
  return r;
}
export function parseContext(value: unknown, accessToken: string): ViewerContext {
  const c = record(value, ['schemaVersion', 'viewerId', 'repoId', 'worktreeId']);
  requireValue(c.schemaVersion === 1 && uuid(c.viewerId) && digest(c.repoId) && digest(c.worktreeId) && /^[a-zA-Z0-9_-]{43}$/.test(accessToken));
  return { viewerId: c.viewerId as string, repoId: c.repoId as string, worktreeId: c.worktreeId as string, accessToken };
}
function parseEvent(value: unknown, context: ViewerContext): Event {
  const e = record(value, ['schemaVersion', 'eventId', 'operationId', 'parentOperationId', 'sequence', 'recordedAt', 'source', 'phase', 'outcome', 'reasonCode', 'pluginVersion', 'repoId', 'worktreeId', 'hostSessionId', 'headSha', 'baseSha'], ['branch', 'prNumber', 'exitCode', 'durationMs', 'evidenceId']);
  requireValue(e.schemaVersion === 1 && uuid(e.eventId) && uuid(e.operationId) && (e.parentOperationId === null || uuid(e.parentOperationId)) && integer(e.sequence, 1, 1000000) && date(e.recordedAt));
  requireValue(sources.includes(e.source as string) && ['started', 'finished'].includes(e.phase as string) && outcomes.includes(e.outcome as string) && (e.phase !== 'started' || e.outcome === 'pending'));
  requireValue(typeof e.reasonCode === 'string' && Object.hasOwn(REASONS, e.reasonCode) && typeof e.pluginVersion === 'string' && /^\d+\.\d+\.\d+$/.test(e.pluginVersion));
  requireValue(e.repoId === context.repoId && e.worktreeId === context.worktreeId && (e.hostSessionId === null || id(e.hostSessionId)) && sha(e.headSha) && sha(e.baseSha));
  requireValue((!('branch' in e) || branch(e.branch)) && (!('prNumber' in e) || integer(e.prNumber, 1, 1000000000)) && (!('exitCode' in e) || integer(e.exitCode, 0, 255)) && (!('durationMs' in e) || integer(e.durationMs, 0, 604800000)) && (!('evidenceId' in e) || id(e.evidenceId)));
  requireValue(new TextEncoder().encode(JSON.stringify(e) + '\n').length <= 4096);
  return e as Event;
}
export function parseSnapshot(value: unknown, context: ViewerContext): Snapshot {
  const s = record(value, ['schemaVersion', 'viewerId', 'repoId', 'worktreeId', 'target', 'observedAt', 'health', 'operations']);
  requireValue(s.schemaVersion === 1 && uuid(s.viewerId) && digest(s.repoId) && digest(s.worktreeId) && s.viewerId === context.viewerId && s.repoId === context.repoId && s.worktreeId === context.worktreeId && date(s.observedAt));
  const t = record(s.target, ['repoAlias', 'worktreeAlias', 'branch', 'headSha']);
  const alias = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 160 && !v.includes('/') && !v.includes('\\') && [...v].every(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127) && v !== '.' && v !== '..';
  requireValue(alias(t.repoAlias) && alias(t.worktreeAlias) && (t.branch === null || typeof t.branch === 'string' && t.branch.length > 0 && t.branch.length <= 255 && [...t.branch].every(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)) && sha(t.headSha));
  const h = record(s.health, ['captureState', 'lastEventAt', 'parseErrors', 'gaps', 'retentionApplied'], ['omittedOperations']);
  requireValue(['off', 'active', 'loss-suspected', 'error'].includes(h.captureState as string) && (h.lastEventAt === null || date(h.lastEventAt)) && integer(h.parseErrors, 0) && integer(h.gaps, 0) && typeof h.retentionApplied === 'boolean');
  requireValue(!('omittedOperations' in h) || integer(h.omittedOperations, 0));
  requireValue(Array.isArray(s.operations));
  const seen = new Set<string>();
  for (const raw of s.operations) {
    const op = record(raw, ['operationId', 'source', 'repoId', 'worktreeId', 'hostSessionId', 'headSha', 'baseSha', 'state', 'events']);
    requireValue(uuid(op.operationId) && sources.includes(op.source as string) && outcomes.includes(op.state as string) && op.repoId === context.repoId && op.worktreeId === context.worktreeId && (op.hostSessionId === null || id(op.hostSessionId)) && sha(op.headSha) && sha(op.baseSha) && Array.isArray(op.events) && op.events.length > 0);
    let previous = 0, gap = false;
    const events = (op.events as unknown[]).map(rawEvent => {
      const e = parseEvent(rawEvent, context);
      requireValue(!seen.has(e.eventId)); seen.add(e.eventId);
      requireValue(['operationId', 'source', 'repoId', 'worktreeId', 'hostSessionId', 'headSha', 'baseSha'].every(k => e[k as keyof Event] === op[k]));
      requireValue(e.sequence >= previous);
      if (e.sequence !== previous + 1) gap = true;
      previous = e.sequence; return e;
    });
    const expected = !gap && events[0].phase === 'started' && events.at(-1)?.phase === 'finished' ? events.at(-1)?.outcome : 'unverified';
    requireValue(op.state === expected);
  }
  return s as Snapshot;
}
const MAX_SNAPSHOT = 8 * 1024 * 1024;
async function requestJson(path: string, token: string, signal: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) controller.abort(); else signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 2000);
  try {
    const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error' });
    if (!response.ok) throw Error('HTTP_FAILURE');
    if (Number(response.headers.get('content-length')) > MAX_SNAPSHOT) throw Error('SNAPSHOT_TOO_LARGE');
    if (!response.body) throw Error('EMPTY_RESPONSE');
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
    try {
      for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > MAX_SNAPSHOT) throw Error('SNAPSHOT_TOO_LARGE'); chunks.push(value); }
    } catch (error) { await reader.cancel(); throw error; } finally { reader.releaseLock(); }
    if (controller.signal.aborted) throw Error('ABORTED');
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}
export async function fetchSnapshot(context: ViewerContext, signal: AbortSignal): Promise<Snapshot> {
  return parseSnapshot(await requestJson('/api/snapshot', context.accessToken, signal), context);
}
export async function fetchContext(accessToken: string, signal: AbortSignal): Promise<ViewerContext> {
  return parseContext(await requestJson('/api/context', accessToken, signal), accessToken);
}

export function consumeAccessToken(): string | null {
  const token = location.hash.slice(1);
  history.replaceState(null, '', location.pathname + location.search);
  return /^[a-zA-Z0-9_-]{43}$/.test(token) ? token : null;
}

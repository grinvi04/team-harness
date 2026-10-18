import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSnapshot, parseSnapshot } from './api';
import { context, snapshot } from './fixtures';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('snapshot boundary', () => {
  it('accepts explicit bounded-history metadata but rejects invalid omission counts', () => {
    const base=snapshot();
    const value={...base,health:{...base.health,omittedOperations:12}};
    expect(parseSnapshot(value,context)).toEqual(value);
    for(const count of [-1,1.2,'12']) expect(()=>parseSnapshot({...base,health:{...base.health,omittedOperations:count}},context)).toThrow();
  });
  it('accepts the reader contract', () => expect(parseSnapshot(snapshot(), context)).toEqual(snapshot()));
  it.each([['schema', { ...snapshot(), schemaVersion: 2 }], ['context', { ...snapshot(), worktreeId: 'd'.repeat(64) }], ['target', { ...snapshot(), target: { ...snapshot().target, repoAlias: '/private/path' } }], ['event', { ...snapshot(), operations: [{ ...snapshot().operations[0], events: [{ ...snapshot().operations[0].events[0], outcome: 'invented' }] }] }]])('rejects invalid %s', (_name, value) => expect(() => parseSnapshot(value, context)).toThrow());
  it('sends auth only in the header and forwards cancellation', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot()))); vi.stubGlobal('fetch', fetch);
    const controller = new AbortController(); await fetchSnapshot(context, controller.signal);
    expect(fetch.mock.calls[0][0]).toBe('/api/snapshot');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${context.accessToken}`);
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it('rejects HTTP failures', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 413 }))); await expect(fetchSnapshot(context, new AbortController().signal)).rejects.toThrow(); });
  it('times out at two seconds', async () => {
    vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(Error('ABORTED'))))));
    const pending = expect(fetchSnapshot(context, new AbortController().signal)).rejects.toThrow(); await vi.advanceTimersByTimeAsync(2000); await pending;
  });
});

it('rejects unknown context schema and unexpected context keys', async () => {
  const { parseContext } = await import('./api');
  expect(() => parseContext({ schemaVersion: 2, viewerId: context.viewerId, repoId: context.repoId, worktreeId: context.worktreeId }, context.accessToken)).toThrow();
  expect(() => parseContext({ schemaVersion: 1, viewerId: context.viewerId, repoId: context.repoId, worktreeId: context.worktreeId, rawPath: '/private' }, context.accessToken)).toThrow();
  expect(parseContext({ schemaVersion: 1, viewerId: context.viewerId, repoId: context.repoId, worktreeId: context.worktreeId }, context.accessToken)).toEqual(context);
});
it('rejects an event from another worktree within a matching snapshot', () => {
  const data = snapshot(); data.operations[0].events[0].worktreeId = 'e'.repeat(64);
  expect(() => parseSnapshot(data, context)).toThrow();
});
it('rejects a forged pass on an unfinished operation', () => {
  const data = snapshot(); data.operations[0].events = data.operations[0].events.slice(0, 1);
  expect(() => parseSnapshot(data, context)).toThrow();
});
it('rejects duplicate events rather than displaying them twice', () => {
  const data = snapshot(); data.operations[0].events[1].eventId = data.operations[0].events[0].eventId;
  expect(() => parseSnapshot(data, context)).toThrow();
});
it('aborts the actual fetch when the caller cancels', async () => {
  let observed!: AbortSignal;
  vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
    observed = init.signal as AbortSignal;
    observed.addEventListener('abort', () => reject(Error('ABORTED')));
  })));
  const caller = new AbortController(); const pending = expect(fetchSnapshot(context, caller.signal)).rejects.toThrow('ABORTED');
  caller.abort(); await pending; expect(observed.aborted).toBe(true);
});
it('rejects bodies above eight MiB without trusting content-length', async () => {
  const body = new Uint8Array(8 * 1024 * 1024 + 1);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
  await expect(fetchSnapshot(context, new AbortController().signal)).rejects.toThrow('SNAPSHOT_TOO_LARGE');
});

it('consumes a raw fragment token and immediately removes it from browser history', async () => {
  const { consumeAccessToken } = await import('./api');
  history.replaceState(null, '', `/#${context.accessToken}`);
  expect(consumeAccessToken()).toBe(context.accessToken);
  expect(location.hash).toBe('');
  expect(consumeAccessToken()).toBeNull();
  history.replaceState(null, '', '/#token=invalid');
  expect(consumeAccessToken()).toBeNull();
  expect(location.hash).toBe('');
});

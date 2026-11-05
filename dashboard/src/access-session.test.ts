import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { consumeAccessToken, fetchContext, fetchSnapshot } from './api';
import { context } from './fixtures';

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); history.replaceState(null, '', '/'); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function open(token = context.accessToken) {
  history.replaceState(null, '', `/#${token}`);
  return consumeAccessToken();
}
it('retains a CLI credential across a tokenless reload without retaining it in the URL or localStorage', () => {
  expect(open()).toBe(context.accessToken);
  expect(location.hash).toBe('');
  expect(consumeAccessToken()).toBe(context.accessToken);
  expect(localStorage.length).toBe(0);
});
it('replaces the prior credential and never falls back after an invalid explicit fragment', () => {
  open(); expect(open('b'.repeat(43))).toBe('b'.repeat(43));
  expect(consumeAccessToken()).toBe('b'.repeat(43));
  expect(open('invalid')).toBeNull();
  expect(consumeAccessToken()).toBeNull();
});
it('requires a CLI credential in an empty page session', () => {
  expect(consumeAccessToken()).toBeNull();
});
it.each([401, 403])('forgets a rejected credential on HTTP %s instead of restoring it on reload', async status => {
  open(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })));
  await expect(fetchContext(context.accessToken, new AbortController().signal)).rejects.toThrow();
  expect(consumeAccessToken()).toBeNull();
});
it('does not let a late rejection erase a newer credential', async () => {
  open(); open('b'.repeat(43));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
  await expect(fetchSnapshot(context, new AbortController().signal)).rejects.toThrow();
  expect(consumeAccessToken()).toBe('b'.repeat(43));
});
it('keeps token authentication when browser session storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('denied'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('denied'); });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw Error('denied'); });
  expect(open()).toBe(context.accessToken);
  expect(consumeAccessToken()).toBeNull();
});

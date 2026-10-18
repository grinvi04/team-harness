import { act, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { context, snapshot } from './fixtures';
import type { ViewerContext } from './api';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('reopens the CLI fragment in the same document, cancels stale authentication and isolates the new poller/cache', async () => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="root"></div>';
  history.replaceState(null, '', '/');
  const a = { ...context, accessToken: 'a'.repeat(43) };
  const b = { ...context, worktreeId: 'd'.repeat(64), accessToken: 'b'.repeat(43) };
  const c = { ...b, accessToken: 'c'.repeat(43) };
  const authentication: { token: string; signal: AbortSignal; resolve: (r: Response) => void }[] = [];
  const observations: { token: string; signal: AbortSignal }[] = [];
  let resolveC!: (r: Response) => void;
  const fetch = vi.fn((url: string, init: RequestInit) => {
    const token = (init.headers as Record<string, string>).Authorization.slice(7);
    const signal = init.signal as AbortSignal;
    if (url === '/api/context') return new Promise<Response>(resolve => authentication.push({ token, signal, resolve }));
    observations.push({ token, signal });
    if (token === c.accessToken) return new Promise<Response>(resolve => { resolveC = resolve; });
    return Promise.resolve(new Response(JSON.stringify(snapshot(b))));
  });
  vi.stubGlobal('fetch', fetch);
  async function tick(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); await vi.advanceTimersByTimeAsync(1); }); }
  async function navigate(token: string) {
    await act(async () => { history.replaceState(null, '', `/#${token}`); window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(location.hash).toBe('');
  }
  function contextResponse(ctx: ViewerContext) { return new Response(JSON.stringify({ schemaVersion: 1, viewerId: ctx.viewerId, repoId: ctx.repoId, worktreeId: ctx.worktreeId })); }
  await act(async () => { await import('./main'); });
  expect(screen.getByText('접근 주소가 필요합니다')).toBeTruthy();
  await navigate(a.accessToken);
  expect(authentication).toHaveLength(1);
  expect(authentication[0].token).toBe(a.accessToken);
  await navigate(b.accessToken);
  expect(authentication[0].signal.aborted).toBe(true);
  await act(async () => authentication[1].resolve(contextResponse(b))); await tick();
  expect(screen.getByText('worktree-B')).toBeTruthy();
  await act(async () => authentication[0].resolve(contextResponse(a))); await tick();
  expect(screen.queryByText('worktree-A')).toBeNull();
  expect(screen.getByText('worktree-B')).toBeTruthy();
  const initial = observations.length;
  await tick(2000);
  expect(observations.length - initial).toBe(1);
  await navigate(c.accessToken);
  expect(screen.getByText('대상 확인 중')).toBeTruthy();
  await act(async () => authentication[2].resolve(contextResponse(c))); await tick();
  expect(screen.getByTestId('current-state').textContent).toBe('현재 상태 미확인');
  expect(screen.queryByText('worktree-B')).toBeNull();
  expect(observations.at(-1)?.token).toBe(c.accessToken);
  await navigate('invalid');
  expect(observations.at(-1)?.signal.aborted).toBe(true);
  expect(screen.getByText('접근 주소가 필요합니다')).toBeTruthy();
  await act(async () => resolveC(new Response(JSON.stringify(snapshot(c))))); await tick();
  expect(screen.getByText('접근 주소가 필요합니다')).toBeTruthy();
  const stopped = observations.length; await tick(6000);
  expect(observations).toHaveLength(stopped);
});

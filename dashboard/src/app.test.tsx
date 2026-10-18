import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from './app';
import { context, snapshot } from './fixtures';
import type { ViewerContext } from './api';
let client: QueryClient;
beforeEach(() => { vi.useFakeTimers(); client = new QueryClient(); focusManager.setFocused(true); onlineManager.setOnline(true); });
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); focusManager.setFocused(undefined); onlineManager.setOnline(true); });
function mount(ctx: ViewerContext = context, strict = false) { const content = <QueryClientProvider client={client}><App context={ctx}/></QueryClientProvider>; return render(strict ? <StrictMode>{content}</StrictMode> : content); }
async function tick(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); await vi.advanceTimersByTimeAsync(1); }); }
function response(ctx = context, state = 'pass') { return new Response(JSON.stringify(snapshot(ctx, state))); }
it('cachedPassWhileDisconnectedIsUnknown', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response()).mockRejectedValue(Error('offline')); vi.stubGlobal('fetch', fetch); mount(); await tick();
  expect(screen.getByTestId('current-state').textContent).toContain('검사 통과'); await tick(2000);
  expect(screen.getByTestId('current-state').textContent).toContain('현재 상태 미확인'); expect(screen.getByText(/연결 끊김/)).toBeTruthy();
  expect(screen.getByText(/마지막 관측/)).toBeTruthy();
});
it('latePreviousWorktreeIgnored', async () => {
  let finish!: (r: Response) => void; const b = { ...context, worktreeId: 'd'.repeat(64) };
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise<Response>(r => { finish = r; })).mockResolvedValue(response(b, 'deny')));
  const view = mount(); await tick(); view.rerender(<QueryClientProvider client={client}><App context={b}/></QueryClientProvider>); await tick();
  await act(async () => { finish(response()); }); await tick(); expect(screen.getByText('worktree-B')).toBeTruthy(); expect(screen.getByTestId('current-state').textContent).toContain('차단'); expect(screen.queryByText('worktree-A')).toBeNull();
});
it('httpSuccessIsNotGatePass', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(context, 'deny'))); mount(); await tick(); expect(screen.getByTestId('current-state').textContent).toContain('차단'); expect(screen.getByTestId('current-state').textContent).not.toContain('검사 통과'); });
it('offlineLoopbackStillFetches', async () => { onlineManager.setOnline(false); const fetch = vi.fn().mockResolvedValue(response()); vi.stubGlobal('fetch', fetch); mount(); await tick(); expect(fetch).toHaveBeenCalledTimes(1); expect(screen.getByTestId('current-state').textContent).toContain('검사 통과'); });
it('focusReturnRevalidates', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response()).mockImplementation(() => new Promise(() => {})); vi.stubGlobal('fetch', fetch); mount(); await tick();
  act(() => focusManager.setFocused(false)); await tick(6000); expect(fetch).toHaveBeenCalledTimes(1);
  act(() => focusManager.setFocused(true)); await tick(); expect(fetch).toHaveBeenCalledTimes(2); expect(screen.getByTestId('current-state').textContent).toContain('현재 상태 미확인');
});
it('strictRemountLeavesOnePoller', async () => { const fetch = vi.fn().mockImplementation(() => Promise.resolve(response())); vi.stubGlobal('fetch', fetch); const view = mount(context, true); await tick(); const initial = fetch.mock.calls.length; await tick(2000); expect(fetch.mock.calls.length - initial).toBe(1); view.unmount(); await tick(6000); expect(fetch.mock.calls.length - initial).toBe(1); });
it('invalidSnapshotRejected', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...snapshot(), schemaVersion: 900 })))); mount(); await tick(); expect(screen.getByTestId('current-state').textContent).toContain('현재 상태 미확인'); expect(screen.queryByText('검사 통과')).toBeNull(); });

it('missingFinishIsUnknown', async () => {
  const data = snapshot(); data.operations[0].events = data.operations[0].events.slice(0, 1); data.operations[0].state = 'unverified';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); mount(); await tick();
  expect(screen.getByTestId('current-state').textContent).toContain('종료 미확인'); expect(screen.getByTestId('current-state').textContent).not.toContain('검사 통과');
});
it('staleShaIsHistorical', async () => {
  const data = snapshot(); data.target.headSha = 'e'.repeat(40);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); mount(); await tick();
  expect(screen.getByTestId('current-state').textContent).toContain('현재 상태 미확인'); expect(screen.getByText('이전 후보의 근거')).toBeTruthy();
});
it('restoreAttemptIsNotRestored', async () => {
  const data = snapshot(context, 'unverified'); data.operations[0].events[1].reasonCode = 'RESTORE_ATTEMPT';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); mount(); await tick();
  expect(screen.getByTestId('current-state').textContent).toContain('현재 상태 미확인'); expect(screen.getByText(/복구 주의/)).toBeTruthy(); expect(screen.getByText(/보호 설정 원값을 재조회/)).toBeTruthy();
});
it('untrustedLabelIsText', async () => {
  const data = snapshot(); data.target.repoAlias = '<img src=x onerror=alert(1)>';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); const view = mount(); await tick();
  expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy(); expect(view.container.querySelector('img')).toBeNull();
});
it('a warm cache is not current before a fresh mount response', async () => {
  client.setQueryData(['observation', context.viewerId, context.repoId, context.worktreeId], snapshot());
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {}))); mount(); await tick();
  expect(screen.getByTestId('current-state').textContent).toContain('현재 상태 미확인'); expect(screen.getByText('worktree-A')).toBeTruthy();
});
it('reconnectDoesNotDuplicate', async () => {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(response())); vi.stubGlobal('fetch', fetch); mount(); await tick(); await tick(2000);
  expect(screen.getByText('2개 사건')).toBeTruthy(); expect(screen.getAllByText('CHECK_PASSED')).toHaveLength(1);
});

it('scrolling into history pauses auto scroll until explicitly resumed', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response()))); mount(); await tick();
  const timeline = screen.getByRole('generic', { name: /사건 기록/ });
  Object.defineProperties(timeline, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 300 }, scrollTop: { configurable: true, value: 100 } });
  fireEvent.scroll(timeline);
  expect(screen.getByRole('button', { name: /새 사건 0개 · 자동 스크롤 재개/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /자동 스크롤 재개/ }));
  expect(screen.getByRole('button', { name: '자동 스크롤 중지' })).toBeTruthy();
});

it('noEventsIsUnknownRatherThanAnUnfinishedOperation', async () => {
  const data = snapshot(); data.operations = [];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); mount(); await tick();
  expect(screen.getByTestId('current-state').textContent).toBe('현재 상태 미확인');
  expect(screen.getByText('화면 캐시·접근 토큰은 브라우저 메모리에만 보관합니다. 사건은 지정한 로컬 경로에 기록합니다.')).toBeTruthy();
});
it.each([['PR_CREATED', 'pr-create', 'PR 생성 확인'], ['MERGED', 'pr-merge', '원격 병합 확인'], ['RESTORE_VERIFIED', 'solo-merge', '보호 복구 확인']])('passUsesActualReason %s', async (reason, source, label) => {
  const data = snapshot(); data.operations[0].source = source;
  for (const event of data.operations[0].events) event.source = source;
  data.operations[0].events[1].reasonCode = reason;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); mount(); await tick();
  expect(screen.getByTestId('current-state').textContent).toBe(label);
  expect(screen.getAllByText(label).some(node => node.classList.contains('badge'))).toBe(true);
  expect(screen.queryByText('검사 통과')).toBeNull();
});

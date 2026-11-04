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
  expect(screen.getByTestId('current-state').textContent).toContain('현재 상태 미확인'); expect(screen.getByText('현재 커밋과 다른 기록')).toBeTruthy();
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
  expect(screen.getByText('화면 캐시는 메모리, 접근 토큰은 이 주소의 탭 세션 저장소에 보관합니다. 새로고침 시 다시 인증합니다. 사건은 지정한 로컬 경로에 기록합니다.')).toBeTruthy();
});
it('bounded history explicitly identifies omitted operations without claiming disk deletion', async () => {
  const base=snapshot(); const data={...base,health:{...base.health,omittedOperations:12}};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); mount(); await tick();
  expect(screen.getByText(/화면 용량 한도.*12개 작업.*기록 파일은 유지/)).toBeTruthy();
  expect(screen.queryByText(/보존 한도 삭제 발생/)).toBeNull();
  expect(screen.getByTestId('current-state').textContent).toBe('검사 통과');
});
it('an operation too large to display remains unknown without claiming no events were observed', async () => {
  const base = snapshot(); const data = { ...base, operations: [], health: { ...base.health, omittedOperations: 1 } };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); mount(); await tick();
  expect(screen.getByTestId('current-state').textContent).toBe('현재 상태 미확인');
  expect(screen.getByText('관측 기록이 화면 용량 한도를 넘어 표시할 수 없습니다. 현재 상태는 미확인입니다.')).toBeTruthy();
  expect(screen.queryByText(/관측된 사건이 없습니다/)).toBeNull();
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

it('identifies different checks and a repeated check in current work, timeline and selected evidence', async () => {
  const data = snapshot();
  const makeCheck = (number: number, name: string) => {
    const op = structuredClone(data.operations[0]);
    op.operationId = `${number}3333333-3333-4333-8333-333333333333`;
    op.events.forEach((event, index) => { event.operationId = op.operationId; event.eventId = `${number}${index}222222-2222-4222-8222-222222222222`; event.evidenceId = name; });
    return op;
  };
  data.operations = [makeCheck(5, 'typecheck'), makeCheck(6, 'lint'), makeCheck(7, 'typecheck')];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); mount(); await tick();
  const current = screen.getByRole('region', { name: '최근 사건의 관측 결과' });
  expect(current.textContent).toContain('검사: typecheck');
  const typechecks = screen.getAllByRole('button', { name: /검사: typecheck/ });
  expect(typechecks).toHaveLength(2);
  expect(screen.getByRole('button', { name: /검사: lint/ })).toBeTruthy();
  fireEvent.click(typechecks[0]);
  const details = screen.getByRole('complementary', { name: '선택 근거' });
  expect(details.textContent).toContain('typecheck');
  expect(details.textContent).toContain('73333333-3333-4333-8333-333333333333');
  fireEvent.click(typechecks[1]);
  expect(screen.getByRole('complementary', { name: '선택 근거' }).textContent).toContain('53333333-3333-4333-8333-333333333333');
});
it('rejects an HTML check identifier without executing it or reporting a successful check', async () => {
  const data = snapshot(); data.operations[0].events[1].evidenceId = '<img src=x onerror=alert(1)>';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); const view = mount(); await tick();
  expect(screen.getByTestId('current-state').textContent).toBe('현재 상태 미확인');
  expect(view.container.querySelector('img')).toBeNull();
  expect(screen.queryByText('검사 통과')).toBeNull();
});
it.each([
  ['GUARD_PARSER_UNAVAILABLE', '명령 파서 사용 불가', '명령 파서 실행 환경을 복구'],
  ['GUARD_TOKENIZER_UNAVAILABLE', '명령 토크나이저 사용 불가', '명령 토크나이저 실행 환경을 복구'],
  ['GUARD_PROTECTED_COMMIT', '보호 브랜치 직접 커밋 차단', '작업 브랜치에서 커밋'],
  ['GUARD_PROTECTED_FORCE_PUSH', '보호 브랜치 강제 push 차단', '강제 push를 중단'],
  ['GUARD_SPEC_REQUIRED', '기능 스펙 누락', '승인된 기능 스펙을 확인'],
  ['GUARD_STACK_WRAPPER_REQUIRED', '의존 PR 전용 wrapper 필요', '의존 PR workflow의 stack wrapper'],
  ['GUARD_PR_CREATE_WRAPPER_REQUIRED', 'PR 생성 wrapper 필요', '기존 PR 생성 wrapper'],
  ['GUARD_PR_MERGE_WRAPPER_REQUIRED', 'PR 병합 wrapper 필요', '기존 PR 병합 wrapper'],
  ['GUARD_HARD_RESET', '파괴적 hard reset 차단', '변경을 보존하고 복구 가능한 방법'],
  ['GUARD_VERIFICATION_DELETE', '검증 파일 삭제 차단', '검증 파일을 보존'],
  ['GUARD_CORE_DELETE', '핵심 경로 삭제 차단', '핵심 경로를 보존'],
  ['GUARD_GLOBAL_INSTALL', '전역 설치 차단', '프로젝트 로컬 설치 경로'],
])('shows the specific safe reason and next action for %s', async (reason, label, action) => {
  const data = snapshot(context, 'deny'); data.operations[0].source = 'guard';
  for (const event of data.operations[0].events) event.source = 'guard';
  data.operations[0].events[1].reasonCode = reason;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); mount(); await tick();
  expect(screen.getByTestId('current-state').textContent).toBe('차단');
  expect(screen.getByRole('region', { name: '차단 이유 · 다음 행동' }).textContent).toContain(label);
  expect(screen.getByRole('region', { name: '차단 이유 · 다음 행동' }).textContent).toContain(action);
  expect(screen.getByRole('generic', { name: /사건 기록/ }).textContent).toContain(label);
});
it('keeps old generic guard denial records readable with fallback guidance', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(context, 'deny'))); mount(); await tick();
  const next = screen.getByRole('region', { name: '차단 이유 · 다음 행동' });
  expect(next.textContent).toContain('가드 차단'); expect(next.textContent).toContain('차단 규칙과 현재 후보를 확인');
});

it('keeps the recorded check name linked from start through finish and retry', async () => {
  const finished = snapshot();
  for (const event of finished.operations[0].events) event.evidenceId = 'lint';
  const started = structuredClone(finished); started.operations[0].events.splice(1); started.operations[0].state = 'unverified';
  const retry = structuredClone(started); retry.operations[0].operationId = '53333333-3333-4333-8333-333333333333';
  retry.operations[0].events[0].operationId = retry.operations[0].operationId;
  retry.operations[0].events[0].eventId = '52222222-2222-4222-8222-222222222222';
  retry.operations.push(finished.operations[0]);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(started))).mockResolvedValueOnce(new Response(JSON.stringify(finished))).mockResolvedValue(new Response(JSON.stringify(retry))));
  mount(); await tick();
  expect(screen.getByRole('region', { name: '최근 사건의 관측 결과' }).textContent).toContain('검사: lint');
  expect(screen.getByTestId('current-state').textContent).toBe('종료 미확인');
  await tick(2000);
  expect(screen.getByRole('region', { name: '최근 사건의 관측 결과' }).textContent).toContain('검사: lint');
  expect(screen.getByTestId('current-state').textContent).toBe('검사 통과');
  await tick(2000);
  expect(screen.getByRole('region', { name: '최근 사건의 관측 결과' }).textContent).toContain('검사: lint');
  expect(screen.getByTestId('current-state').textContent).toBe('종료 미확인');
  expect(screen.getAllByRole('button', { name: /검사: lint/ })).toHaveLength(2);
});
it('uses the recorded check-runner source when a legacy check has no identifier', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response())); mount(); await tick();
  expect(screen.getByRole('region', { name: '최근 사건의 관측 결과' }).textContent).toContain('검사: 식별자 미제공 · check-runner');
  fireEvent.click(screen.getByRole('button', { name: /check-runner.*33333333-3333-4333-8333-333333333333/ }));
  expect(screen.getByRole('complementary', { name: '선택 근거' }).textContent).toContain('식별자 미제공 · check-runner');
});

it('event diagram keeps the selected record and evidence coherent across views', async () => {
  const data = snapshot(); data.operations[0].events.forEach(e => { e.evidenceId = 'lint'; });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); mount(); await tick();
  expect(screen.getByRole('region', { name: '관측 사건 지도' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /check-runner.*검사: lint/ }));
  for (const name of ['목록 보기', '담당 관계', '사건 흐름']) {
    fireEvent.click(screen.getByRole('button', { name }));
    expect(screen.getByRole('complementary', { name: '선택 근거' }).textContent).toContain('lint');
    expect(screen.getByRole('region', { name: '관측 사건 지도' }).textContent).toContain('lint');
  }
  expect(screen.getByText('담당 관계를 아직 수집하지 않았습니다.')).toBeTruthy();
  expect(screen.getByText('실제 모델 · 미확인 / 미수집')).toBeTruthy();
  expect(screen.getByText('실제 effort · 미확인 / 미수집')).toBeTruthy();
});
it('event diagram never leaves evidence selected outside the active filter', async () => {
  const data = snapshot(); const other = structuredClone(data.operations[0]);
  other.operationId = '53333333-3333-4333-8333-333333333333';
  other.events.forEach((e, i) => { e.operationId = other.operationId; e.eventId = `${i}5555555-5555-4555-8555-555555555555`; e.evidenceId = 'other'; });
  data.operations.push(other);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); mount(); await tick();
  fireEvent.click(screen.getByRole('button', { name: /check-runner.*검사: other/ }));
  fireEvent.change(screen.getByRole('combobox', { name: '작업 필터' }), { target: { value: data.operations[0].operationId } });
  expect(screen.queryByRole('complementary', { name: '선택 근거' })).toBeNull();
  expect(screen.getByRole('region', { name: '관측 사건 지도' }).textContent).not.toContain('other');
});
it('event diagram separates lost records from current state and uses Korean absolute time', async () => {
  const data = snapshot(); data.health.captureState = 'loss-suspected'; data.health.retentionApplied = true;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); mount(); await tick();
  expect(screen.getByTestId('current-state').textContent).toBe('현재 상태 미확인');
  expect(screen.getByRole('region', { name: '관측 사건 지도' }).textContent).toContain('관측 기록');
  expect(screen.getByText(/업무 완료·병합 완료로 확대하지 않습니다/)).toBeTruthy();
  expect(screen.getAllByText(/2026년 10월 18일 09:00:00.*한국시간/).length).toBeGreaterThan(0);
  expect(screen.getByText(/PR 사건 미수집/)).toBeTruthy();
});
it('polling removes selected evidence when its record disappears from the snapshot', async () => {
  const initial = snapshot(); initial.operations[0].events.forEach(e => { e.evidenceId = 'removed-check'; });
  const updated = snapshot(); const remaining = updated.operations[0];
  remaining.operationId = '53333333-3333-4333-8333-333333333333';
  remaining.events.forEach((e, i) => { e.operationId = remaining.operationId; e.eventId = `${i}5555555-5555-4555-8555-555555555555`; e.evidenceId = 'remaining-check'; });
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(initial))).mockResolvedValueOnce(new Response(JSON.stringify(updated)));
  vi.stubGlobal('fetch', fetch); mount(); await tick();
  fireEvent.click(screen.getByRole('button', { name: /check-runner.*검사: removed-check/ }));
  expect(screen.getByRole('complementary', { name: '선택 근거' }).textContent).toContain('removed-check');
  await tick(2000);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('complementary', { name: '선택 근거' })).toBeNull();
  expect(screen.queryByRole('button', { name: /check-runner.*검사: removed-check/ })).toBeNull();
  const map = screen.getByRole('region', { name: '관측 사건 지도' });
  expect(map.textContent).not.toContain('removed-check');
  expect(map.textContent).toContain('remaining-check');
});
it('polling resets a removed operation filter so the remaining record stays visible', async () => {
  const initial = snapshot(); initial.operations[0].events.forEach(e => { e.evidenceId = 'filtered-A'; });
  const updated = snapshot(); const remaining = updated.operations[0];
  remaining.operationId = '53333333-3333-4333-8333-333333333333';
  remaining.events.forEach((e, i) => { e.operationId = remaining.operationId; e.eventId = `${i}5555555-5555-4555-8555-555555555555`; e.evidenceId = 'remaining-B'; });
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(initial))).mockResolvedValueOnce(new Response(JSON.stringify(updated)));
  vi.stubGlobal('fetch', fetch); mount(); await tick();
  const filter = screen.getByRole('combobox', { name: '작업 필터' }) as HTMLSelectElement;
  fireEvent.change(filter, { target: { value: initial.operations[0].operationId } });
  fireEvent.click(screen.getByRole('button', { name: /check-runner.*검사: filtered-A/ }));
  expect(filter.value).toBe(initial.operations[0].operationId);
  expect(screen.getByRole('complementary', { name: '선택 근거' }).textContent).toContain('filtered-A');
  await tick(2000);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(filter.value).toBe('all');
  expect(screen.queryByRole('complementary', { name: '선택 근거' })).toBeNull();
  expect(screen.queryByRole('button', { name: /check-runner.*검사: filtered-A/ })).toBeNull();
  expect(screen.getByRole('button', { name: /check-runner.*검사: remaining-B/ })).toBeTruthy();
  expect(screen.getByRole('region', { name: '관측 사건 지도' }).textContent).toContain('remaining-B');
  expect(screen.queryByText('관측된 사건이 없습니다. 수집 연결과 실제 실행을 확인하세요.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /check-runner.*검사: remaining-B/ }));
  expect(screen.getByRole('complementary', { name: '선택 근거' }).textContent).toContain('remaining-B');
});
it.each([
  ['same commit', 'a'.repeat(40), 'a'.repeat(40), '현재 커밋과 일치하는 기록'],
  ['different commit', 'b'.repeat(40), 'a'.repeat(40), '현재 커밋과 다른 기록'],
  ['record commit missing', 'a'.repeat(40), null, '커밋 정보 미제공 · 일치 여부 미확인'],
  ['current commit missing', null, 'a'.repeat(40), '커밋 정보 미제공 · 일치 여부 미확인'],
  ['both commits missing', null, null, '커밋 정보 미제공 · 일치 여부 미확인'],
])('record labels limit %s evidence to the recorded commit', async (_, currentSha, recordedSha, label) => {
  const data = snapshot(); data.target.headSha = currentSha; data.operations[0].headSha = recordedSha;
  data.operations[0].events.forEach(e => { e.headSha = recordedSha; });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))); mount(); await tick();
  const record = screen.getByRole('button', { name: new RegExp(data.operations[0].operationId) });
  expect(record.textContent).toContain(label);
  expect(record.textContent).not.toContain('현재 후보의 근거');
  const result = screen.getByRole('region', { name: '최근 사건의 관측 결과' });
  expect(result.textContent).toContain('관측 당시 결과');
  expect(result.textContent).toContain('현재 업무·프로세스 상태는 미확인입니다.');
  expect(result.textContent).toContain('미커밋 변경의 검증 여부는 확인하지 않습니다.');
  expect(screen.queryByRole('heading', { name: '현재 작업' })).toBeNull();
});

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { focusManager, useQuery } from '@tanstack/react-query';
import { fetchSnapshot, REASONS, type Operation, type ViewerContext } from './api';
import { currentOperation, nextAction, reasonFor, operationLabel } from './view-model';
const subscribeFocus = (onChange: () => void) => focusManager.subscribe(onChange);
const getFocused = () => focusManager.isFocused();
const operationKey = (op: Operation) => JSON.stringify([op.operationId, op.source, op.repoId, op.worktreeId, op.hostSessionId, op.headSha, op.baseSha]);
export function App({ context }: { context: ViewerContext }) {
  return <Observation key={`${context.viewerId}:${context.repoId}:${context.worktreeId}`} context={context}/>;
}
function Observation({ context }: { context: ViewerContext }) {
  const focused = useSyncExternalStore(subscribeFocus, getFocused);
  const query = useQuery({ queryKey: ['observation', context.viewerId, context.repoId, context.worktreeId], queryFn: ({ signal }) => fetchSnapshot(context, signal), refetchInterval: 2000, retry: false, networkMode: 'always', refetchOnWindowFocus: 'always', refetchOnMount: 'always', refetchIntervalInBackground: false, staleTime: 0 });
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [following, setFollowing] = useState(true);
  const [readCount, setReadCount] = useState(0);
  const timeline = useRef<HTMLDivElement>(null);
  const snapshot = query.data;
  const operation = currentOperation(snapshot);
  const currentKnown = focused && query.isFetchedAfterMount && !query.isFetching && !query.isError && snapshot?.health.captureState === 'active';
  const count = snapshot?.operations.reduce((sum, op) => sum + op.events.length, 0) ?? 0;
  useEffect(() => { if (following && count > 0 && timeline.current) timeline.current.scrollTo?.({ top: timeline.current.scrollHeight }); }, [following, count]);
  const operations = snapshot?.operations ?? [];
  const visible = operations.filter(op => filter === 'all' || op.operationId === filter);
  const details = operations.find(op => operationKey(op) === selected);
  function pause() { if (following) { setFollowing(false); setReadCount(count); } }
  return <main>
    <header><p className="eyebrow">TEAM HARNESS · LOCAL OBSERVATION</p><h1>실행 관측</h1><p>확인된 사건과 근거를 읽습니다. 조회 성공은 검사 통과를 뜻하지 않습니다.</p></header>
    <section aria-labelledby="target-title"><h2 id="target-title">대상</h2>
      {snapshot ? <><div className="target"><strong>{snapshot.target.repoAlias}</strong><span>{snapshot.target.worktreeAlias}</span></div><dl><dt>브랜치</dt><dd>{snapshot.target.branch ?? '분리된 HEAD / 미확인'}</dd><dt>현재 후보 SHA</dt><dd className="mono">{snapshot.target.headSha ?? '미확인'}</dd><dt>관측 호스트 / 세션</dt><dd>{operation ? `${operation.source} / ${operation.hostSessionId ?? '미제공'}` : '미확인'}</dd></dl><p className="muted">마지막 관측: <time dateTime={snapshot.observedAt}>{snapshot.observedAt}</time> · 마지막 사건: {snapshot.health.lastEventAt ?? '없음'}</p></> : <p>대상 확인 중 · 현재 상태 미확인</p>}
      <p role="status" className={query.isError ? 'status warn' : 'status'}>{query.isError ? '연결 끊김 · 현재 상태 미확인' : !focused ? '탭 숨김 · 조회 중지 · 현재 상태 미확인' : query.isFetching ? '갱신 중 · 현재 상태 미확인' : '조회 응답 수신'}</p>
      {snapshot && <p className="muted">수집: {({ active: '활성', off: '수집 미연결', 'loss-suspected': '관측 손실 의심', error: '기록 오류' })[snapshot.health.captureState]} · 파싱 오류 {snapshot.health.parseErrors} · 순서 누락 {snapshot.health.gaps}{snapshot.health.retentionApplied ? ' · 보존 한도 삭제 발생' : ''}</p>}
      <p className="muted">hook 연결: {operations.some(op => ['codex-hook', 'claude-hook'].includes(op.source)) ? 'hook 사건 관측됨 · 전체 호스트 실행을 보장하지 않음' : 'hook 연결 미확인'}</p>
    </section>
    <section aria-labelledby="current-title"><h2 id="current-title">현재 작업</h2><p data-testid="current-state" className={`current ${currentKnown ? operation?.state ?? 'unverified' : 'unverified'}`}>{currentKnown ? operationLabel(operation) : '현재 상태 미확인'}</p><p>{currentKnown ? reasonFor(operation) : '마지막 기록이 있어도 현재 실행 결과를 확정하지 않습니다.'}</p></section>
    <section aria-labelledby="next-title"><h2 id="next-title">차단 이유 · 다음 행동</h2><p>{reasonFor(operation)}</p><p>{query.isError ? 'viewer가 실행 중인지 확인하고 터미널의 CLI 주소를 다시 여세요.' : nextAction(operation)}</p>{operation?.events.at(-1)?.reasonCode.startsWith('RESTORE_') && <p className="status warn">복구 주의 · 시도와 원값 재조회 일치를 구분하세요.</p>}</section>
    <section aria-labelledby="timeline-title"><div className="section-head"><h2 id="timeline-title">타임라인</h2><span>{count}개 사건</span></div>
      <div className="controls"><label>작업 필터 <select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">모든 작업</option>{[...new Set(operations.map(op => op.operationId))].map(id => <option key={id} value={id}>{id}</option>)}</select></label><button onClick={() => { if (following) pause(); else setFollowing(true); }}>{following ? '자동 스크롤 중지' : `새 사건 ${Math.max(0, count - readCount)}개 · 자동 스크롤 재개`}</button></div>
      <div ref={timeline} className="timeline" tabIndex={0} aria-label="사건 기록, 과거 기록을 읽으면 자동 스크롤을 중지하세요" onScroll={e => { const node = e.currentTarget; if (node.scrollHeight - node.clientHeight - node.scrollTop > 24) pause(); }} onWheel={pause} onTouchMove={pause} onKeyDown={e => { if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) pause(); }}>
        {visible.length === 0 ? <p>관측된 사건이 없습니다. 수집 연결과 실제 실행을 확인하세요.</p> : <ol>{visible.slice().reverse().map(op => {
          const key = operationKey(op);
          const historical = op.headSha !== snapshot?.target.headSha;
          return <li key={key}><button className="operation" aria-expanded={selected === key} onClick={() => setSelected(selected === key ? null : key)}><span>{op.source}</span><strong className={`badge ${op.state}`}>{operationLabel(op)}</strong><span>{historical ? '이전 후보의 근거' : '현재 후보의 근거'}</span><span className="mono">{op.operationId}</span></button><ol>{op.events.map(e => <li key={e.eventId}><time dateTime={e.recordedAt}>{e.recordedAt}</time><span>{REASONS[e.reasonCode]}</span><code>{e.reasonCode}</code>{e.prNumber ? <span>PR #{e.prNumber}</span> : null}</li>)}</ol></li>;
        })}</ol>}
      </div>
      {details && <aside aria-label="선택 근거"><h3>선택 근거</h3><dl><dt>작업</dt><dd className="mono">{details.operationId}</dd><dt>확인 후보</dt><dd className="mono">{details.headSha ?? '미제공'}</dd><dt>세션</dt><dd>{details.hostSessionId ?? '미제공'}</dd><dt>상태 근거</dt><dd>{reasonFor(details)}</dd></dl><p>종료 사건 누락은 종료 미확인입니다. 허용·접수·복구 시도를 실행 성공·병합·복구 완료로 해석하지 않습니다.</p></aside>}
    </section>
    <footer>화면 캐시·접근 토큰은 브라우저 메모리에만 보관합니다. 사건은 지정한 로컬 경로에 기록합니다.</footer>
  </main>;
}

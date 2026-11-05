import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { focusManager, useQuery } from '@tanstack/react-query';
import { fetchSnapshot, type ViewerContext } from './api';
import { currentOperation, nextAction, reasonFor, operationLabel, checkIdentifier, operationKey, operationTitle, sourceLabel, koreanTime, eventLabel } from './view-model';
import { EventMap } from './event-map';
const subscribeFocus = (onChange: () => void) => focusManager.subscribe(onChange);
const getFocused = () => focusManager.isFocused();
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
  const activeFilter = filter === 'all' || operations.some(op => op.operationId === filter) ? filter : 'all';
  if (filter !== activeFilter) setFilter(activeFilter);
  const visible = operations.filter(op => activeFilter === 'all' || op.operationId === activeFilter);
  const details = visible.find(op => operationKey(op) === selected);
  const diagramOperation = details ?? visible[0];
  function pause() { if (following) { setFollowing(false); setReadCount(count); } }
  return <main>
    <header><p className="eyebrow">TEAM HARNESS · LOCAL OBSERVATION</p><h1>사건 흐름과 확인 근거</h1><p>확인된 사건과 근거를 읽습니다. 조회 성공은 검사 통과를 뜻하지 않습니다.</p></header>
    <div className="summary-grid"><section aria-labelledby="target-title"><h2 id="target-title">대상</h2>
      {snapshot ? <><div className="target"><strong>{snapshot.target.repoAlias}</strong><span>{snapshot.target.worktreeAlias}</span></div><details><summary>커밋·출처 정보</summary><dl><dt>브랜치</dt><dd>{snapshot.target.branch ?? '분리된 HEAD / 미확인'}</dd><dt>현재 커밋 SHA</dt><dd className="mono">{snapshot.target.headSha ?? '미확인'}</dd><dt>관측 호스트 / 세션</dt><dd>{operation ? `${operation.source} / ${operation.hostSessionId ?? '미제공'}` : '미확인'}</dd></dl></details><p className="muted">마지막 관측: <time dateTime={snapshot.observedAt} title={snapshot.observedAt}>{koreanTime(snapshot.observedAt)}</time> · 마지막 사건: {snapshot.health.lastEventAt ? koreanTime(snapshot.health.lastEventAt) : '없음'}</p></> : <p>대상 확인 중 · 현재 상태 미확인</p>}
      <p role="status" className={query.isError ? 'status warn' : 'status'}>{query.isError ? '연결 끊김 · 현재 상태 미확인' : !focused ? '탭 숨김 · 조회 중지 · 현재 상태 미확인' : query.isFetching ? '갱신 중 · 현재 상태 미확인' : '조회 응답 수신'}</p>
      {snapshot && <p className="muted">수집: {({ active: '활성', off: '수집 미연결', 'loss-suspected': '관측 손실 의심', error: '기록 오류' })[snapshot.health.captureState]} · 파싱 오류 {snapshot.health.parseErrors} · 순서 누락 {snapshot.health.gaps}{snapshot.health.retentionApplied ? ' · 보존 한도 삭제 발생' : ''}</p>}
      {!!snapshot?.health.omittedOperations && <p className="status warn">화면 용량 한도로 {snapshot.health.omittedOperations}개 작업을 생략했습니다. 최신 작업부터 표시하며 기록 파일은 유지합니다.</p>}
      <p className="muted">hook 연결: {operations.some(op => ['codex-hook', 'claude-hook'].includes(op.source)) ? 'hook 사건 관측됨 · 전체 호스트 실행을 보장하지 않음' : 'hook 연결 미확인'}</p>
    </section>
    <section aria-labelledby="current-title"><h2 id="current-title">최근 사건의 관측 결과</h2><p className="muted">현재 커밋과 일치하는 최근 기록의 관측 당시 결과입니다. 현재 업무·프로세스 상태는 미확인입니다. 미커밋 변경의 검증 여부는 확인하지 않습니다.</p>{currentKnown && operation?.source === 'check-runner' && <p>검사: {checkIdentifier(operation) ?? '식별자 미제공 · check-runner'}</p>}<p data-testid="current-state" className={`current ${currentKnown ? operation?.state ?? 'unverified' : 'unverified'}`}>{currentKnown ? operationLabel(operation) : '현재 상태 미확인'}</p><p>{currentKnown ? reasonFor(operation) : '마지막 기록이 있어도 현재 실행 결과를 확정하지 않습니다.'}</p></section>
    <section aria-labelledby="next-title"><h2 id="next-title">차단 이유 · 다음 행동</h2><p>{reasonFor(operation)}</p><p>{query.isError ? 'viewer가 실행 중인지 확인하고 터미널의 CLI 주소를 다시 여세요.' : currentKnown ? nextAction(operation) : '자료 상태와 터미널의 실제 결과를 확인하세요. 마지막 관측만으로 다음 업무를 배정하지 않습니다.'}</p>{operation?.events.at(-1)?.reasonCode.startsWith('RESTORE_') && <p className="status warn">복구 주의 · 시도와 원값 재조회 일치를 구분하세요.</p>}</section>
    </div><div className="observation-workspace"><EventMap operation={diagramOperation} operations={operations} selected={!!details}/>
      {details && <aside aria-label="선택 근거"><h3>선택 근거</h3><p><strong>{operationTitle(details)}</strong> · <span className={details.state}>{operationLabel(details)}</span></p><p className="muted">관측 당시 결과 · 현재 업무 상태와 구분합니다.</p><dl><dt>기록 출처</dt><dd>{sourceLabel(details.source)} · {details.source}</dd><dt>담당</dt><dd>미수집</dd><dt>마지막 사건</dt><dd><time dateTime={details.events.at(-1)!.recordedAt} title={details.events.at(-1)!.recordedAt}>{koreanTime(details.events.at(-1)!.recordedAt)}</time></dd><dt>작업</dt><dd className="mono">{details.operationId}</dd>{details.source === 'check-runner' && <><dt>검사</dt><dd>{checkIdentifier(details) ?? '식별자 미제공 · check-runner'}</dd></>}<dt>확인 후보</dt><dd className="mono">{details.headSha ?? '미제공'}</dd><dt>세션</dt><dd>{details.hostSessionId ?? '미제공'}</dd><dt>상태 근거</dt><dd>{reasonFor(details)}</dd></dl><p className="muted">확인 안내: {nextAction(details)}</p><p>종료 사건 누락은 종료 미확인입니다. 허용·접수·복구 시도를 실행 성공·병합·복구 완료로 해석하지 않습니다.</p></aside>}
    </div>
    <p className="muted">{operations.some(op => ['pr-create', 'pr-merge', 'solo-merge', 'stack'].includes(op.source)) ? 'PR 사건은 해당 기록이 확인한 범위만 표시합니다.' : 'PR 사건 미수집 · PR이 없다는 뜻은 아닙니다.'}</p>
    <section aria-labelledby="timeline-title"><div className="section-head"><h2 id="timeline-title">타임라인</h2><span>{count}개 사건</span></div>
      <div className="controls"><label>작업 필터 <select value={activeFilter} onChange={e => setFilter(e.target.value)}><option value="all">모든 작업</option>{[...new Set(operations.map(op => op.operationId))].map(id => <option key={id} value={id}>{operationTitle(operations.find(op => op.operationId === id)!)} · {id.slice(0, 8)}</option>)}</select></label><button onClick={() => { if (following) pause(); else setFollowing(true); }}>{following ? '자동 스크롤 중지' : `새 사건 ${Math.max(0, count - readCount)}개 · 자동 스크롤 재개`}</button></div>
      <div ref={timeline} className="timeline" tabIndex={0} aria-label="사건 기록, 과거 기록을 읽으면 자동 스크롤을 중지하세요" onScroll={e => { const node = e.currentTarget; if (node.scrollHeight - node.clientHeight - node.scrollTop > 24) pause(); }} onWheel={pause} onTouchMove={pause} onKeyDown={e => { if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) pause(); }}>
        {visible.length === 0 ? <p>{operations.length === 0 && snapshot?.health.omittedOperations ? '관측 기록이 화면 용량 한도를 넘어 표시할 수 없습니다. 현재 상태는 미확인입니다.' : '관측된 사건이 없습니다. 수집 연결과 실제 실행을 확인하세요.'}</p> : <ol>{visible.slice().reverse().map(op => {
          const key = operationKey(op);
          const commitLabel = !op.headSha || !snapshot?.target.headSha ? '커밋 정보 미제공 · 일치 여부 미확인' : op.headSha === snapshot.target.headSha ? '현재 커밋과 일치하는 기록' : '현재 커밋과 다른 기록';
          return <li key={key}><button className="operation" aria-label={`${op.source} ${operationTitle(op)} ${operationLabel(op)} ${op.operationId}`} aria-expanded={selected === key} onClick={() => setSelected(selected === key ? null : key)}><span>{sourceLabel(op.source)}</span>{checkIdentifier(op) && <span>검사: {checkIdentifier(op)}</span>}<strong className={`badge ${op.state}`}>{operationLabel(op)}</strong><span>{commitLabel}</span><span className="muted">기록 {op.operationId.slice(0, 8)}</span></button><ol>{op.events.map(e => <li key={e.eventId}><time dateTime={e.recordedAt} title={e.recordedAt}>{koreanTime(e.recordedAt)}</time><span>{eventLabel(e)}</span><details className="event-code"><summary>기술 근거</summary><code>{e.reasonCode}</code><p className="mono">{e.eventId}</p></details>{e.prNumber ? <span>PR #{e.prNumber}</span> : null}</li>)}</ol></li>;
        })}</ol>}
      </div>

    </section>
    <footer>화면 캐시는 메모리, 접근 토큰은 이 주소의 탭 세션 저장소에 보관합니다. 새로고침 시 다시 인증합니다. 사건은 지정한 로컬 경로에 기록합니다.</footer>
  </main>;
}

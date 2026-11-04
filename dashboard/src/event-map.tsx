import { useState } from 'react';
import type { Operation } from './api';
import { eventLabel, koreanTime, observationLinks, operationLabel, operationTitle, sourceLabel } from './view-model';
export function EventMap({ operation, operations, selected }: { operation: Operation | undefined; operations: Operation[]; selected: boolean }) {
  const [view, setView] = useState('flow');
  const parents = operation ? observationLinks(operation, operations) : [];
  return <section aria-labelledby="event-map-title" className="event-map">
    <div className="section-head"><h2 id="event-map-title">관측 사건 지도</h2><div className="view-controls" aria-label="사건 지도 보기">
      {([['flow', '사건 흐름'], ['list', '목록 보기'], ['owners', '담당 관계']] as const).map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}
    </div></div>
    {operation ? <><p className="map-selection">{selected ? '선택한 기록' : '최근 관측 기록'} · <strong>{operationTitle(operation)}</strong> <span className={operation.state}>{operationLabel(operation)}</span></p>
      <p className="muted">출처: {sourceLabel(operation.source)} · 관측 기록의 순서이며 업무 선행 조건·담당 배정이 아닙니다.</p>
      {view === 'owners' ? <div className="empty-relations">미수집 · 표시할 담당 관계선 없음</div> : <>
        {parents.length > 0 && <p className="observation-link">기록상 연결: {parents.map(parent => operationTitle(parent)).join(' · ')} → {operationTitle(operation)} <small>관측 호출 관계 · AI 계층 아님</small></p>}
        <ol className={view === 'flow' ? 'event-flow' : 'event-list'} aria-label="선택 기록의 관측 순서">{operation.events.map(event => <li key={event.eventId} data-event-id={event.eventId}>
          <span className="muted">{event.phase === 'started' ? '시작 관측' : '종료 관측'} · 순서 {event.sequence}</span><strong>{eventLabel(event)}</strong><time dateTime={event.recordedAt} title={event.recordedAt}>{koreanTime(event.recordedAt)}</time>
        </li>)}</ol></>}
    </> : <p>표시할 관측 기록이 없습니다. 자료 부재를 실행 부재나 업무 완료로 해석하지 않습니다.</p>}
    <div className="unknown-metadata"><p>담당 관계를 아직 수집하지 않았습니다.</p><span>실제 모델 · 미확인 / 미수집</span><span>실제 effort · 미확인 / 미수집</span></div>
    <p className="muted meaning">가드 허용은 실행 성공이 아닙니다. 검사·시도의 결과를 업무 완료·병합 완료로 확대하지 않습니다. 검토 대기·업무 배정·재개 관계는 수집된 근거 없이 만들지 않습니다.</p>
  </section>;
}

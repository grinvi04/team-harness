import { describe, expect, it } from 'vitest';
import { snapshot } from './fixtures';
import { checkIdentifier, eventLabel, koreanTime, observationLinks, operationKey, operationLabel, operationTitle } from './view-model';
describe('record presentation and evidence boundaries', () => {
  it('shares the exact recorded check name and reason without replacing an allow with success', () => {
    const op = snapshot().operations[0]; op.events[1].evidenceId = 'lint';
    expect(checkIdentifier(op)).toBe('lint'); expect(operationTitle(op)).toBe('검사: lint');
    expect(eventLabel(op.events[1])).toBe('명시한 검사 통과');
    op.source = 'guard'; op.state = 'allow'; op.events[1].reasonCode = 'GUARD_ALLOWED';
    expect(operationTitle(op)).toBe('가드'); expect(operationLabel(op)).toBe('가드 허용 · 실행 성공 미확인');
  });
  it('formats an absolute Korea timestamp while the event retains its UTC instant', () => {
    const op = snapshot().operations[0]; const instant = op.events[0].recordedAt;
    expect(koreanTime(instant)).toBe('2026년 10월 18일 09:00:00 한국시간');
    expect(op.events[0].recordedAt).toBe(instant);
  });
  it('links only explicit parents in the same session, worktree and candidate', () => {
    const parent = snapshot().operations[0]; parent.source = 'codex-hook'; parent.hostSessionId = 'session';
    const child = structuredClone(parent); child.source = 'guard'; child.operationId = '53333333-3333-4333-8333-333333333333';
    child.events.forEach(e => { e.parentOperationId = parent.operationId; });
    expect(observationLinks(child, [child, parent])).toEqual([parent]);
    for (const patch of [{ hostSessionId: 'other' }, { headSha: 'd'.repeat(40) }, { worktreeId: 'e'.repeat(64) }]) {
      expect(observationLinks(child, [child, { ...parent, ...patch }])).toEqual([]);
    }
    expect(observationLinks(child, [child, parent, { ...parent, source: 'guard' }])).toEqual([]);
    child.events.forEach(e => { e.parentOperationId = null; });
    expect(observationLinks(child, [child, parent])).toEqual([]);
  });
  it('does not combine the same operation ID across distinct recorded contexts', () => {
    const op = snapshot().operations[0];
    expect(operationKey(op)).not.toBe(operationKey({ ...op, hostSessionId: 'other' }));
    expect(operationKey(op)).not.toBe(operationKey({ ...op, headSha: 'd'.repeat(40) }));
  });
});

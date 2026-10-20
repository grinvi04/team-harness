import { directory, readFile } from './storage.mjs';
import { readEvents, readLease } from './event.mjs';

export function readSnapshot(dataDir, selection) {
  const health = { captureState: 'off', lastEventAt: null, parseErrors: 0, gaps: 0, retentionApplied: false };
  const operations = [], observedAt = new Date().toISOString();
  try {
    if (!selection || !/^[a-f0-9]{64}$/.test(selection.repoId)) throw Error('INVALID_SELECTION');
    const root = directory(dataDir), scan = readEvents(root); health.parseErrors = scan.parseErrors;
    if (readLease(root, selection, { allowAnyWorktree: true })) health.captureState = 'active';
    try {
      const loss = JSON.parse(readFile(root, 'writer-loss-v1.json', 128).data);
      if (loss.schemaVersion !== 1 || loss.lost !== true || Object.keys(loss).length !== 2) throw Error('INVALID_LOSS');
      health.captureState = 'loss-suspected';
    } catch (e) { if (e.code !== 'ENOENT') health.parseErrors++; }
    try {
      const retained = JSON.parse(readFile(root, 'retention-v1.json', 128).data);
      if (retained.schemaVersion !== 1 || retained.applied !== true || Object.keys(retained).length !== 2) throw Error('INVALID_RETENTION');
      health.retentionApplied = true;
    } catch (e) { if (e.code !== 'ENOENT') health.parseErrors++; }
    const groups = new Map(), seen = new Set();
    for (const { value: e } of scan.records) {
      if (e.repoId !== selection.repoId || selection.worktreeId && e.worktreeId !== selection.worktreeId ||
        selection.operationId && e.operationId !== selection.operationId || seen.has(e.eventId)) continue;
      seen.add(e.eventId);
      const context = [e.operationId, e.source, e.repoId, e.worktreeId, e.hostSessionId, e.headSha, e.baseSha];
      const key = JSON.stringify(context);
      if (!groups.has(key)) groups.set(key, { operationId: e.operationId, source: e.source, repoId: e.repoId,
        worktreeId: e.worktreeId, hostSessionId: e.hostSessionId, headSha: e.headSha, baseSha: e.baseSha,
        state: 'unverified', events: [] });
      groups.get(key).events.push(e);
      if (!health.lastEventAt || e.recordedAt > health.lastEventAt) health.lastEventAt = e.recordedAt;
    }
    for (const group of groups.values()) {
      group.events.sort((a, b) => a.sequence - b.sequence || a.recordedAt.localeCompare(b.recordedAt) || a.eventId.localeCompare(b.eventId));
      let previous = 0, gap = false;
      for (const e of group.events) {
        if (e.sequence !== previous + 1) { health.gaps++; gap = true; }
        previous = e.sequence;
      }
      const last = group.events.at(-1);
      if (!gap && group.events[0].phase === 'started' && last.phase === 'finished') group.state = last.outcome;
      operations.push(group);
    }
    operations.sort((a, b) => b.events.at(-1).recordedAt.localeCompare(a.events.at(-1).recordedAt));
    if (health.parseErrors || health.gaps || health.retentionApplied) health.captureState = 'loss-suspected';
  } catch { health.captureState = 'error'; }
  return { operations, health, observedAt };
}

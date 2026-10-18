import { REASONS, type Operation, type Snapshot } from './api';
export const stateLabels: Record<string, string> = { pass: '검사 통과', fail: '검사 실패', deny: '차단', allow: '가드 허용 · 실행 성공 미확인', pending: '결과 대기', enqueued: '요청 접수 · 병합 미확인', unverified: '종료 미확인' };
export function operationLabel(operation: Operation | undefined): string {
  if (!operation) return '현재 상태 미확인';
  if (operation.state === 'unverified') {
    return operation.events.some(event => event.phase === 'started') && operation.events.every(event => event.phase !== 'finished') ? '종료 미확인' : '현재 상태 미확인';
  }
  if (operation.state === 'pass') {
    const reason = operation.events.at(-1)?.reasonCode;
    if (reason === 'PR_CREATED') return 'PR 생성 확인';
    if (reason === 'MERGED') return '원격 병합 확인';
    if (reason === 'RESTORE_VERIFIED') return '보호 복구 확인';
    if (operation.source === 'check-runner') return '검사 통과';
    return '결과 확인 · 근거 범위 확인 필요';
  }
  return stateLabels[operation.state];
}
export function currentOperation(snapshot: Snapshot | undefined): Operation | undefined {
  if (!snapshot || snapshot.target.headSha === null) return undefined;
  return snapshot.operations.find(op => op.headSha === snapshot.target.headSha);
}
export function reasonFor(operation: Operation | undefined): string {
  const event = operation?.events.at(-1);
  return event ? REASONS[event.reasonCode] : '현재 후보에서 관측한 작업이 없습니다.';
}
export function nextAction(operation: Operation | undefined): string {
  const code = operation?.events.at(-1)?.reasonCode;
  if (code === 'RESTORE_UNVERIFIED' || code === 'RESTORE_ATTEMPT') return '보호 설정 원값을 재조회하여 복구를 확인하세요.';
  if (operation?.state === 'deny') return '차단 규칙과 현재 후보를 확인한 뒤 기존 workflow에서 수정하세요.';
  if (operation?.state === 'fail') return '해당 검사의 실패 근거를 확인하고 수정 후 다시 검사하세요.';
  if (!operation || operation.state === 'unverified') return '터미널의 실제 실행과 종료 결과를 확인하세요. 시간 경과로 완료를 추정하지 않습니다.';
  return '표시한 범위와 후보의 근거를 확인하고 기존 workflow의 다음 단계를 따르세요.';
}

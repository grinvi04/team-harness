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
export function checkIdentifier(operation: Operation | undefined): string | undefined {
  if (operation?.source !== 'check-runner') return undefined;
  return operation.events.findLast(event => event.evidenceId !== undefined)?.evidenceId;
}
const guardNextActions: Record<string, string> = {
  GUARD_PARSER_UNAVAILABLE: '명령 파서 실행 환경을 복구한 뒤 기존 workflow에서 다시 확인하세요.',
  GUARD_TOKENIZER_UNAVAILABLE: '명령 토크나이저 실행 환경을 복구한 뒤 기존 workflow에서 다시 확인하세요.',
  GUARD_PROTECTED_COMMIT: '작업 브랜치에서 커밋하고 기존 PR workflow를 따르세요.',
  GUARD_PROTECTED_FORCE_PUSH: '강제 push를 중단하고 기존 PR 전달 절차를 따르세요.',
  GUARD_SPEC_REQUIRED: '승인된 기능 스펙을 확인하고 작업 브랜치의 스펙 경로를 맞추세요.',
  GUARD_STACK_WRAPPER_REQUIRED: '의존 PR workflow의 stack wrapper로 현재 후보와 대상을 확인하세요.',
  GUARD_PR_CREATE_WRAPPER_REQUIRED: '기존 PR 생성 wrapper를 사용해 대상과 후보를 확인하세요.',
  GUARD_PR_MERGE_WRAPPER_REQUIRED: '기존 PR 병합 wrapper를 사용해 리뷰·CI·보호 gate를 확인하세요.',
  GUARD_HARD_RESET: '변경을 보존하고 복구 가능한 방법을 기존 workflow에서 확인하세요.',
  GUARD_VERIFICATION_DELETE: '검증 파일을 보존하고 필요한 변경을 기존 검사 절차로 검토하세요.',
  GUARD_CORE_DELETE: '핵심 경로를 보존하고 필요한 변경 범위를 기존 workflow에서 검토하세요.',
  GUARD_GLOBAL_INSTALL: '프로젝트 로컬 설치 경로와 기존 의존성 관리 절차를 사용하세요.',
};
export function reasonFor(operation: Operation | undefined): string {
  const event = operation?.events.at(-1);
  return event ? REASONS[event.reasonCode] : '현재 후보에서 관측한 작업이 없습니다.';
}
export function nextAction(operation: Operation | undefined): string {
  const code = operation?.events.at(-1)?.reasonCode;
  if (code && Object.hasOwn(guardNextActions, code)) return guardNextActions[code];
  if (code === 'RESTORE_UNVERIFIED' || code === 'RESTORE_ATTEMPT') return '보호 설정 원값을 재조회하여 복구를 확인하세요.';
  if (operation?.state === 'deny') return '차단 규칙과 현재 후보를 확인한 뒤 기존 workflow에서 수정하세요.';
  if (operation?.state === 'fail') return '해당 검사의 실패 근거를 확인하고 수정 후 다시 검사하세요.';
  if (!operation || operation.state === 'unverified') return '터미널의 실제 실행과 종료 결과를 확인하세요. 시간 경과로 완료를 추정하지 않습니다.';
  return '표시한 범위와 후보의 근거를 확인하고 기존 workflow의 다음 단계를 따르세요.';
}

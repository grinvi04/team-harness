# 로컬 실시간 대시보드 인수 기록

2026-10-18. 미발행1.2.0 후보. [설계·O1–O5](../specs/local-runtime-dashboard.md)와
[T1–T4 실행 계획](../specs/local-runtime-dashboard/implementation-plan.md)의 결과를 연결한다.
현재는 **T1 저장·reader 구현 시험 PASS**다. 훅·화면·실제 호스트·전체 기능 인수는 아직 완료하지 않았다.

## 후보와 환경

- 기반: PR584 원격 develop 병합 `4c1136eea0988dc252475eb5edfbfdc241b66ee5`.
- 별도 clone `team-harness/.runtime/dashboard-stack-20261018`, A층 `codex/dashboard-events`.
- macOS, 실제 파일시스템·독립 Node 프로세스. GitHub/실제 hook/UI를 이 시험의 실행 경계로 세지 않는다.
- 원문·파일 digest는 해당 clone의 `.runtime/dashboard/t1-*.{log,json}`에 보존한다.
  미커밋 시험은 `t1-final.json`의 소스4개·시험2개 SHA-256으로 현재 원본과 대조했다.
- core 배포 catalog와 CI quality에 저장·reader 및 두 시험 파일을 연결했다. 설치 후보 시험은 T4다.

## T1 검증 결과

실행: `node --test tests/observation-test.mjs tests/observation-boundaries-test.mjs`.
최종 exit0, 14 PASS/0 FAIL/0 SKIP, 151.44초. 기준을 낮추거나 실패 시험을 제외하지 않았다.

| 요구·위험 | 실제 관찰 | 판정·범위 |
|---|---|---|
| 기본 OFF·만료·대상 불일치 | 기록0; 활성 lease의 대상만 기록 | PASS, 저장 API |
| 민감정보·schema 경계 | 원문/출력/알 수 없는 필드·잘못된 UUID/SHA 거부 | PASS, 허용 필드만 저장 |
| 파일 안전성 | 0700/0600, symlink·hardlink·권한 위반 거부; sentinel 보존 | PASS, 시험한 로컬 경계 |
| 실행 구분 | 같은 operationId라도 worktree/session/head/base/source 분리 | PASS, reader |
| 유실·중단 | 중복 제거·sequence gap·잘린 JSON·미종료를 미확인/손실로 표시 | PASS, 확정 성공으로 승격 안 함 |
| 동시 쓰기 | 10개 독립 프로세스×100건, 1,000개 고유 사건·잘림0 | PASS, 17.98초 |
| 실제 용량 한도 | 8,192×4KiB seed 뒤 10×100; 사건 bytes≤32MiB | PASS, 133.15초·retention 표시 |
| 7일 경계 | 파일 mtime과 다른 recordedAt 기준 삭제·다른 파일 보존 | PASS, 다음 reader에도 손실 표시 |
| viewer 소유권 | 하나 종료 후 다른 viewer lease 유지·정확한 만료 | PASS, lease API |
| 중단 writer·캐시 | 죽은 PID 임시 기록 정리·손실 표시, 조회자가 캐시 변조 불가 | PASS, 안전한 fixture |

## 발견·수정과 최초 실패

최초 공개 API 시험은 0/9 RED였다. 원래9개 시험 digest `8a78eb13c76500bc7ec6d7da5abf951050b5b1bdb727d1a6319424ee39a2ce1b`를 유지했다.
첫 두 실행은 용량 경계에서 STORAGE_ERROR/WRITER_BUSY였다. 공정한 lock 대기 중 owner의 의도된
hardlink 두 개를 일반 사건 파일처럼 거부하는 오류도 실제 두 writer로 재현했다. owner만 별도 검사한다.
그다음 180초 timeout은 대기 writer가 큰 디렉터리를 반복 탐색한 경합이었다. 기존 live lock을 먼저
확인해 불필요한 탐색을 줄였고 동일 프로세스 수·용량·시간 제한으로 최종 통과했다.
추가 RED는 viewer lease 덮어쓰기, 죽은 writer 임시 파일, UUID의 암묵적 문자열 변환, 캐시 객체 변조를 잡았다.
`t1-red`, `t1-green-first`, `t1-green-second`, `t1-green-third`, `t1-green-fourth`, 경계 RED와 최종 로그를 보존한다.

## 내부 계약과 한계

공유 `storage.mjs`가 파일·lock 안전성을 맡고 `event/read/emit`이 이를 사용한다. 내부 파일명은
`evt-UUID.json`, viewer별 `lease-UUID.json`이다. 종료는 자기 lease만 삭제한다. 별도 사용자 설정은 없다.
retention marker는 삭제 전에 기록한다. 32MiB는 **사건 파일 bytes**의 상한이며 lease/lock/marker는 별도 메타데이터다.
기록의 과거 성공을 현재 후보의 성공으로 해석하지 않는다. reader는 판정 권한이 없고 native gate를 대체하지 않는다.
최대 용량 cold scan 실측314ms와 T2 emitter의250ms 상한은 별도 경계다. 현재 저장 시험 통과가
hook 성능·250ms 제한·실제 화면3초 반영을 증명하지 않는다. 해당 실패 시 gate 원결과 보존을 T2에서 확인한다.

## 남은 승인 범위

T2 실제 guard/검사/Git 연결의 OFF·ON·기록 실패 비교 → T3 React/Query·HTTP·실제 브라우저 과제 →
T4 패키지·전체 품질·Codex CLI/desktop과 실제 A/B/C stack(G3) 순서다. O1–O5 전체는 진행 중이다.
main·태그·설치는 아직 실행하지 않았다. Claude 실제 호스트는 미확인 보류다.
소비 저장소 변경과 실제 회사·사람 인수는 이 기능의 완료 조건에 추가하지 않는다.

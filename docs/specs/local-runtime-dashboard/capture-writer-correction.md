# 관측 writer의 cold scan 교정

원래 [O1–O5](../local-runtime-dashboard.md)의 기록·손실·gate 보존 계약을 유지한다.
당시 교정·develop 전달은 [인수 기록](../../pilots/local-runtime-dashboard.md)과 PR587을 따른다.
후속 현재 재현·정식 전달은 [1.2.0 검증 기록](../../pilots/local-runtime-dashboard-release-1.2.0.md)을 따른다.
판정은 **소유**다. 기존 사건 저장의 실행 비용을 고치며 native hook lifecycle은 바꾸지 않는다.

## 원인과 증거 경계

기존 emitter는 매 사건마다 새 프로세스로 전체 spool을 cold 검증했다. 실제 합성8000건,
4,232,000바이트에서 새 emitter가250ms에 종료되어 사건 파일이 없었다. 같은8000건의
cold scan311ms와 warm append108ms를 대조했다. 파일 읽기 비용이 반복되는 구조 결함이다.
기존 장수 프로세스 용량 시험은 이 fresh-process 경계를 지나지 않아 반례를 놓쳤다.
작은 최적화 두 개도250ms 실패를 유지해 폐기했다. 단언·timeout·payload 검증은 줄이지 않는다.

원래 C94032ee의 작은 spool에서 누락된 RESTORE_VERIFIED의 직접 원인은 미확정이다.
과거 trace가 없다는 사실을 성공으로 바꾸지 않으며, 이번 재현을 당시 원인 증명으로 삼지 않는다.
이번 종료 판정은 **확인된 구조 결함 교정 + 현재 후보의 원래 양성·손실 회귀 확인**이다.
단순 재실행 성공, 모든 부하에서 무손실, scheduler 정지의 해소를 주장하지 않는다.

후속 CI39408631043은 첫 기록 성공 뒤 두 번째 emitter status1로 실패했다. 외부250ms kill은
아니며 내부 오류 단계는 미확정이다. warm 경로의 불필요한 정렬을 확인해 보존 삭제가 필요할 때만
동일 순서로 정렬한다. 전체 stat·변경 payload 재검증·lock·fsync·ACK 순서는 그대로다.
손실 표식을 descriptor로 오인한 별도 결함은 실제 UUID 파일만 탐색하도록 교정한다.
이전/manual lease의 실제 emit·결과 조회 복구와 손실 경고 보존을 회귀로 확인한다.

## 실행 경계

`observe.mjs`는 viewer마다 전용 Node 자식 writer 하나를 소유한다. 자식은 전체 검증 cache를
준비하고 소유자 전용 Unix socket을 연다. 준비·descriptor 발행 뒤에만 viewer lease를 발행한다.
HTTP의 동기 snapshot/Git 처리와 writer는 다른 프로세스다. 별도 daemon·설치·설정은 없다.

- emitter는 같은 경로·repo·worktree의 활성 writer에 사건을 보낸다. 실제 `appendEvent`가
  종료된 뒤에만 결과 ACK를 돌려준다. 결과 조회도 같은 검증 cache의 정확한 자식 조회를 사용한다.
- descriptor는 spool의 inode/device·viewerId·repo/worktree에 결박하고0600 파일로 보관한다.
  임시 socket의 부모0700·socket0600·유형·소유자를 검사한다. capability는 argv나 사건에 넣지 않는다.
- 요청은 schema·허용 필드·문맥·capability와 정확한 viewer lease를 확인한다. 큐 진입 시와
  storage lock 획득 뒤에도 자기 lease를 확인한다. 다른 viewer의 lease로 종료된 권한을 연장하지 않는다.
- frame8192바이트, 응답256바이트, 연결·대기 큐 각32개, 요청 대기180ms로 제한한다.
  외부 emitter의250ms 상한은 유지한다. 성공 ACK 이전 timeout·응답 유실을 성공으로 추정하지 않는다.
- writer descriptor가 없는 이전/manual lease는 기존 직접 append 경로를 유지한다.
  광고된 writer의 오류 뒤에는 직접 쓰기로 재시도하지 않는다. 이미 commit됐을 가능성이 있기 때문이다.
- `event.mjs`의 안전한 파일·변경 감지·전체 payload 검증·중복·직렬 lock·retention을 재사용한다.
  변경 파일은 다시 읽고 malformed가 있으면 쓰기를 거부한다. 보존 삭제 전 손실 표식을 먼저 쓴다.
- 종료는 자기 lease·endpoint만 정리하고 자식의 실제 종료를 기다린다. 다른 viewer·사건은 보존한다.
  예상하지 못한 writer 종료는 자기 lease를 해제하고 손실 표식을 남긴다. 자동 재기동은 하지 않는다.

HTTP는 기존 loopback·GET-only·token·Host/Origin 제한을 유지한다. 화면에 실행·승인 API를 추가하지 않는다.
동일 사용자 소유의0700 저장소는 기존 신뢰 경계이며 같은 사용자 악성 프로세스까지 격리하지 않는다.

## 회귀와 판정자

| 경계 | 검사와 기대 결과 |
|---|---|
| 실제 cold 실패 |8000건+실제 viewer에서 fresh emitter와 별도 결과 조회가 각각250ms 내 성공; 실제 payload·부모 결과 일치 |
| 실행 격리 | 위 시험의 부모는 spawnSync로 막혀도 자식 writer의 기록·조회가 완료됨 |
| 원래 정상 사건 | 기존 observation 통합의 모든 양성·signal 단언 보존; 실제 writer에서도 RESTORE_VERIFIED와 MERGE_FAILED 필수 |
| gate 보존 | OFF/ON의 exit·stdout·stderr·원격 호출 동일, 부모 terminal 정확히1개·잘못된 MERGED 없음 |
| 손실 | lock 지연·ACK 유실에서 호출 결과 보존, writer-loss와 loss-suspected 표시 |
| 권한·수명 | 틀린 capability/viewer/context·깨진/과대 frame·unsafe descriptor 거부; 다른 viewer lease로 대기 쓰기 불가 |
| 저장 정합성 | 변경·malformed 재검증, 기록 시각 기준 만료·삭제 전 retention 표식, duplicate·모호한 자식 결과 거부 |
| 정리 | 정상 종료·자식 crash에서 자기 endpoint/lease만 제거; 다른 viewer·기존 사건 보존 |

시험 정본은 `tests/observation-{boundaries,writer,integration}-test.mjs`다.
새 writer 전체 디렉터리는 기존 core source 선택에 포함되며 현재 커밋의 package·bundle과 이동 실행으로 확인한다.
당시 승인된 교정 종료점은 PR587의 develop 병합이었다. 후속 사용자 승인으로 현재 후보 재현과
정식 전달을 진행하며 원래 quality·독립 리뷰·필수 CI·보호·Git Flow를 유지한다.

최종 독립 리뷰의 별칭 경계도 대조했다. POSIX에서 합법인 역슬래시 포함 폴더명은 화면의
별칭 계약에 맞춰 정규화하고, 비어지면 `repository`로 표시한다. repo/worktree 식별자는
바꾸지 않는다. 실제 viewer HTTP 응답으로 역슬래시 포함 이름과 빈 정규화 결과를 회귀 검증한다.

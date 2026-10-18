# 로컬 실시간 대시보드 인수 기록

2026-10-18. 미발행1.2.0 후보. [설계·O1–O5](../specs/local-runtime-dashboard.md)와
[T1–T4 실행 계획](../specs/local-runtime-dashboard/implementation-plan.md)의 결과를 연결한다.
현재는 **T1·T2 및 T3 개별 시험 PASS·브라우저 필수 과제 확인·T4 연결 구현 중**이다. 실제 호스트·전체 기능 인수는 미완료다.

## 후보와 환경

- 기반: PR584 원격 develop 병합 `4c1136eea0988dc252475eb5edfbfdc241b66ee5`.
- 별도 clone `team-harness/.runtime/dashboard-stack-20261018`, A층 `codex/dashboard-events` 커밋 `452cde5`, B층 `codex/dashboard-hooks` 커밋 `42f79d0`, C층 `codex/dashboard-viewer` 검증 후보(정확한 커밋은 실행 증거와 연결).
- macOS, 실제 파일시스템·독립 Node 프로세스. T1·T2는 GitHub/native hook/UI 인수가 아니며 T3 브라우저는 아래 별도 범위다.
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

## PR585 독립 검토 교정

실제 Codex Astra/medium/read-only 리뷰가 A `cc014ba`에서 repo-only 조회의 활성 상태 오류를 찾았다.
계약상 `worktreeId`를 생략하면 저장소 전체를 읽지만, 활성 lease도 정확한 worktree 일치만 요구해
사건이 기록되는 동안 `captureState=off`로 표시했다. `pr585-review/`에 원래 리뷰와 후보를 보존한다.
reader만 같은 repo의 유효한 worktree lease를 허용한다. append와 명시 worktree 선택은 계속 정확한
대상 lease를 요구한다. 만료·잘못된 schema·다른 repo의 lease는 활성 상태나 기록 권한을 만들지 않는다.

`pr585-lease-fix/`: 원래 A+새 회귀시험에서 기대 active/실제 off 2건 RED·유지7 PASS를 확인했다.
잠긴 시험을 유지한 최소 교정 후 타깃9/9, observation+boundaries22/22·exit0·160.91초 PASS다.
기존10×100 writer·32MiB 한도 시험과 구문·diff 검사도 유지했다. 소스2개와 시험1개의 digest를
실제 통합 바이트에 대조했다. 이 결과는 로컬 교정 검증이며 새 PR 후보의 독립 리뷰·CI는 별도다.
## T2 연결 검증 — 2026-10-18

현재 소스·시험의 SHA-256과 명령은 `.runtime/dashboard/t2-final.json`에 연결한다.
저장·경계·검사 runner·통합 시험을 함께 실행해 **29/29 PASS, 152.08초, exit0**다.
실제 격리 Git·프로세스·wrapper를 사용했으며 GitHub API만 기존 상태형 test double이다.
이 결과를 실제 원격 병합이나 Codex 호스트 실행 증거로 세지 않는다.

후속 독립 검토에서 stack의 `pending/enqueued/unverified`를 wrapper nonzero만으로 실패로
표시한 결함을 재현했다. CLI의 구조화된 결과를 기존 사건으로 연결하고 같은 parent·후보의
직접 자식 종료가 정확히 한 개일 때만 부모에 반영한다. 누락·모호함·조회 오류는 미확인이다.
원격 MERGED 뒤 보호 복구 실패도 전체 작업 성공으로 올리지 않는다. 결과 조회 자체는
별도 프로세스250ms 상한이며 지연 시 미확인으로 남기고 기존 복구·출력·exit를 유지한다.
교정 v2 통합22/22·기존 stack wrapper22/22 PASS, 원래 stdout/stderr·exit·보호 호출을 보존했다.
실제 CLI 종료 전인 stack 사건에는 추정 exitCode를 넣지 않으며 부모 wrapper가 실제 종료를 기록한다.
교정 증거는 `.runtime/dashboard/review-fix-b/`의 최초 RED·후속 GREEN과 후보별 digest다.

| 요구·위험 | 관찰한 결과 | 판정·범위 |
|---|---|---|
| capture OFF·ON·잘못된 저장 권한 | 허용/차단/에러의 exit·stdout·stderr 유지 | PASS, 실제 wrapper |
| 잘못된 hook·PLUGIN_DATA 누락·egress 거부 | 기존 거부·원래 오류와 출력 유지 | PASS, adapter fixture |
| 상관관계 | 독립 operation·parent 연결, 실제 session 부재=null | PASS, 저장 사건 대조 |
| 검사 명령 | 한 번 실행, 원출력 전달, nonzero·signal·ENOENT 보존 | PASS, 실제 자식 프로세스 |
| OFF·시간 제한 | OFF emitter0, 지연 emitter250ms 제한·원래 거부 유지 | PASS, 손실은 별도 표시 |
| PR 생성 실패·필수 CI 누락 | 기존 실패·호출·출력 유지, 가짜 완료 없음 | PASS, 원격 IO double |
| 일반 병합 요청 | 요청 성공은 MERGE_REQUESTED·현재 미확인 | PASS, MERGED 추정 안 함 |
| 보호 복구 | PATCH 성공 뒤 전체 정책 readback 일치에서만 RESTORE_VERIFIED | PASS, 정상·불일치·PATCH/병합 실패 |

최초 기능 시험3개는 모두 RED였고 구현 후 통과했다. 추가 solo/merge 사례는 A층 코드에
역적용한 음성 대조에서 관측 부재로 0/2 실패했다. 추가 사례까지 모두 구현 전 RED였다고 주장하지 않는다.
첫 확장 시험은 실행별 감사 UUID를 비교한 fixture 오류로 4/5, 다음은 실패 복구의 정상 잔류
예약을 다음 시험이 공유해 5/6이었다. 실제 감사 파일 검증 후 UUID 필드만 정규화하고 각 시험의
Git 저장소를 분리했다. 원래 복구·출력 기준은 유지하며 모든 실패 로그를 `t2-*`에 보존한다.

관측 실패는 조용한 bounded marker로 표시하며 원래 stderr를 바꾸지 않는다. 복구는 별도 자식
operation이다. gate 허용은 명령 완료가 아니며 기록 손실 건수·미제공 호스트 정보는 추정하지 않는다.
실제 원격 candidate가 있는 병합 사건은 로컬 HEAD 대신 wrapper가 확인한 head/base SHA를 사용한다.

기존 guard·Codex pretool·egress·pr-create·pr-merge-auto·solo-merge 회귀6개 묶음도 exit0이다.
추가8/8 통합 시험(47.60초)은 활성 emitter 실패/250ms timeout과 정상·readback 불일치·TERM143·HUP129를
결합했다. 원출력·exit·GH 호출 전체와 보호 원값 복구를 유지했다. A452cde5 음성 대조는 관측 부재로0/2였다.
최초7/8의 새 reason 기대값 오류를 원래 MERGE_FAILED로 바로잡았고 실패 원문을 보존한다.
이 보완은 검증 공백 보충이며 새 구현 전 RED로 세지 않는다. 증거: `t2-gap-*`, `t2-final-regressions.json`.

## T3 viewer·브라우저와 T4 연결 — 2026-10-18

현재 후보는 B층 `42f79d0` 위 C층 검증 소스·생성 asset이다. 정확한 커밋은 실행 증거와 연결한다. 아래는 개별 명령·관찰의 결과이며
커밋된 설치 artifact나 전체 quality·native 호스트 인수가 아니다. 원문은 같은 clone의 `.runtime/dashboard/`다.
제작 도구는 Node22.18.0/npm11.6.2, React/react-dom19.3.1·Query5.104.4이며 lockfile과 실제 설치 목록을 대조했다.

| 명령·관찰 경계 | 실제 결과·원문 | 판정 |
|---|---|---|
| `npm ci --prefix dashboard` | 의존성 재현 exit0; `t3-npm-ci.log` | PASS, 로컬 제작 |
| `npm run lint --prefix dashboard`, `npm run typecheck --prefix dashboard` | 오류0; `t3-bootstrap-{lint,typecheck}.log` | PASS, 제작 소스 |
| `npm run test:unit --prefix dashboard` | 34/34; `t3-ui-bootstrap-final.log` | PASS, jsdom·mock API |
| `node --test tests/dashboard-test.mjs` | 4/4; `t3-server-second.log` | PASS, 실제 loopback·파일 fixture |
| `node --test tests/dashboard-build-test.mjs` | 5/5; `t3-build-final.log` | PASS, Vite·격리 env·재빌드 fixture |
| `node --test tests/dashboard-workflow-test.mjs` | 2/2; `t4-workflow-green.log` | PASS, 현재 YAML 연결 계약 |

UI는 캐시 PASS 뒤 연결 실패·이전 worktree의 늦은 응답·HTTP200과 gate PASS 구분·오프라인 loopback·
복귀 재조회·StrictMode 단일 poller·unknown schema/대상 불일치·취소/2초 timeout·8MiB 경계를 확인했다.
서버는 exact Host/Origin/token/path/method, 고정 대상·viewer별 lease와 asset digest/MIME/경로 거부를 확인했다.
빌드는 `.env`·`VITE_*` canary 배제, 양방향 파일 비교, `--check` 무수정, 오래된 chunk·symlink 거부와
빌드 중 사용자 파일 생성 경합의 무덮어쓰기를 확인했다. 재현 fixture 성공을 현재 설치본 실행으로 세지 않는다.

최초 UI 9 FAIL/6 PASS와 첫 GREEN의 notification 경계 실패를 보존했다. fake timer의 다음 notification을
+1ms flush하도록 교정하고 기존 단언·2초 polling 기준은 유지했다. raw fragment·스크롤 반증도 보존한다.
실제 초기 화면 점검 뒤 문구 RED 6개를 확인했다. 사건 부재/이전 SHA와 finished-unverified를 종료 누락으로
기대한 두 시험을 원래 의미에 맞게 정정했고, pass는 검사·PR 생성·병합·복구의 실제 이유로 구분했다.
서버 첫 GREEN의 fixture 정리 순서 ENOENT, 빌드 경합 RED, workflow RED도 `t3-*`·`t4-*`에 남긴다.

실제 Node가 제공한 빌드 화면에서 정상 검사, main/develop guard 거부(exit2), 중간 SIGKILL 뒤 종료 미확인,
키보드·375px 폭·과거 기록·같은 탭의 다른 worktree URL 전환·연결 단절 후 캐시 미확인을 관찰했다.
`browser/{normal,deny,interrupted}.json`, `interrupted.ax.txt`, `worktree-b.ax.txt`, `disconnected.ax.txt`,
`mobile.png`, `timeline.png`가 근거다. 실제 guard·검사 실행과 화면의 연결이며 **native Codex hook 실행은 아니다**.
추가 live 검증에서 IAB 새로고침은 메모리 토큰 부재·CLI 주소 재개방 안내를 표시했다(`browser/tokenless-reload.ax.txt`).
Safari 전용 시험 창의 두 탭 전환에서24.035초 숨김 동안 snapshot 요청0건이었다. 숨김 중 실제 runCheck exit9를
기록했고 복귀 기준 시각 후201ms에 새 요청,713ms 안에 CHECK_FAILED 화면을 관찰했다.
근거는 `browser/visibility-result.json`, `visibility-requests.jsonl`, `safari-hidden.ax.txt`, `safari-return.ax.txt/png`다.
이 두 live 항목은 PASS이며 native Codex 호스트 인수가 아니다.

이어 같은 탭에서 원래 CLI URL을 다시 열면 fragment-only navigation으로 진입점이 재실행되지 않는 결함을 발견했다.
`browser/reopen-before-fix.ax.txt`에 주소 필요 화면과 미소비 fragment가 남았으며 bootstrap 타깃 회귀1개도 RED였다.
`main.tsx`가 hashchange를 소비·재인증하고 이전 인증을 abort·세대 검사하며 Query 캐시를 격리하도록 수정했다.
타깃 GREEN1·전체 UI34 PASS와 실제 재접속 복구(`browser/reopen-after-fix.ax.txt`)를 확인했다. 최초33개 결과는 보존한다.
정상534ms·거부959ms·중단2995ms의 사건 시각→화면 관측은 `browser/receipt.json`에 연결했다.
최초 정상4308ms는 도구 샘플 지연으로3초 증거가 부족했고, 다음 시도는 지연 사건 발생 전에 locator deadline이 끝났다.
세 번째 정상 시도에서534ms를 측정했다. 최초 두 시도를 성공으로 덮지 않는다.
정상은 bootstrap 수정 빌드, 거부·중단·숨김/복귀는 이전 bootstrap 빌드다. 표시·API·서버 소스는 변하지 않았다.
receipt의 현재 소스·manifest5개 SHA-256을 원본과 대조했다. 변경된 bootstrap은 타깃·전체 UI와 실제 재개로 재검사했다.

T4의 catalog asset 소유·좁은 gitignore·제작/배포 문서·고정 도구와 CI `--check` 연결은 소스에 반영했다.
[사용 가이드](../guides/observability.md)에 실행·종료·전용 디스크 경로·정리·미연결 해결을 한 번만 기록했다.
CI 연결 시험 PASS는 hosted CI나 전체 quality 성공을 뜻하지 않는다.

## 남은 승인 범위

C층 커밋된 후보의 package/bundle·전체 quality →
T4 설치 경로·Codex CLI/desktop hook→기록→화면 및 실제 A/B/C stack(G3) 인수 순서다.
O1–O5 전체는 진행 중이며 독립 최종 검수도 남았다. 새 관측 기능의 main·태그·설치는 실행하지 않았다.
Claude 실제 호스트는 미확인 보류다. 소비 저장소 변경과 회사·사람 인수는 숨은 완료 조건으로 추가하지 않는다.

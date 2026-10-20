# 로컬 실시간 대시보드 설계

상태: **실제 CLI·Desktop 연결 확인·전달 판정은 PR 원본 참조**. C640584c의 lease 교정 영향·격리 CLI·이동 artifact와 승인된 c62 Desktop 시험·v1.0.0 복구를 확인했다. 최초 실패·교정 결과를 보존하며 현재 후보 CI·독립 검토·G3 전달 판정은 연결된 실행 기록과 PR585·586·587 원본을 따른다. [현재·과거 결과](../pilots/local-runtime-dashboard.md)에 근거와 한계를 보존한다.
[최종 검토](stacked-git-workflow/final-review.md)에 따라 원래 연결 범위와 선행 순서를 유지한다.
사용자가 React + TanStack 채택을 승인했다. 아래는 초기 바닐라 JavaScript 안을 대체하는 설계다.
기존 재설계·문서 정리의 완료 판정은 유지한다. 아래는 새 기능의 완료 기준이다.

## 목표와 소유 경계

사용자가 “Harness가 지금 무엇을 확인했고, 왜 멈췄으며, 다음에 무엇을 해야 하는가”를
실제 관측값으로 판단하게 한다. AI가 작성한 진행 문장만으로 실행·완료를 판정하지 않는다.

- **소유:** Harness의 검사·차단·전달·복구 사건과 그 근거를 읽기 쉽게 보여준다.
- **연결:** 공식 hook payload, 현재 wrapper 결과, 명시적으로 제공된 검증 결과를 연결한다.
- **위임:** 모델 실행·skill 로딩·subagent·권한·hook lifecycle은 기존 호스트가 실행한다.
- 별도 실행 엔진, 원격 SaaS, DB, 유료 관측 도구, 원격 제어 버튼은 만들지 않는다.
- 현재 `.project-map/`은 목표·마일스톤 지도다. 이 화면은 실제 실행 관측이며 지도 정본을 대체하지 않는다.

제품 판단은 [제품 방향](../product-direction.md), 실행 작업은 [구현 계획](local-runtime-dashboard/implementation-plan.md)을 따른다.
Git 상태는 [stacked Git 설계](stacked-git-workflow.md)의 후보·병합 판정에 연결한다.

## 현재 코드에서 확인한 출발점

| 원본 | 현재 보이는 것 | 현재 증명하지 못하는 것 |
|---|---|---|
| `scripts/guard.sh`의 `deny()` | 차단 텍스트·exit 2 | 로그가 없다는 이유로 허용·실행 완료 |
| `scripts/codex-pretool-guard.mjs` | 입력 검증과 공통/egress guard 결과 | 모든 데스크톱 대화의 실행·skill 선택 |
| `scripts/pr-create.sh`, `pr-merge.sh` | 후보·게이트·GitHub 실행 결과 | 지속적인 구조화 타임라인 |
| `scripts/solo-merge.sh` | 정상 복구 후 원값 재조회 | trap의 PATCH 시도만으로 복구 확정 |
| `tests/acceptance/` | 시험 후보·명령·결과 근거 | 제품용 상시 collector |

위 `scripts/`는 `plugins/harness-guard/scripts/` 기준이다. 기존 감사 로그와 exit 계약은 유지한다.

## 사용 흐름과 화면

1. 설치된 플러그인의 `observe.mjs`를 명시한 저장소·데이터 디렉터리로 실행한다.
2. 터미널에 표시된 로컬 주소를 연다. 수집 연결 전에는 **수집 미연결**을 보여준다.
3. 평소처럼 개발을 요청한다. 실제 연결된 hook·wrapper 사건만 화면에 쌓인다.
4. 차단 항목을 열어 규칙, 확인된 후보, 근거 시각, 다음 행동을 읽는다.
5. 종료하면 수집 활성 표식을 해제한다. 비정상 종료는 유효기간 만료 후 수집을 중단한다.

화면의 우선순위는 다음과 같다. 처음 화면부터 실행 대상과 미확인 상태를 읽을 수 있어야 한다.

| 영역 | 내용·사용자 판단 |
|---|---|
| 대상 | 저장소 별칭, worktree, branch, head SHA, 관측된 호스트/session, 마지막 수신 시각 |
| 현재 작업 | 진행 중인 관측 작업, 마지막 성공/차단, 종료 미확인, 복구 주의 |
| 타임라인 | 검사 시작→결과→재시도; operation별 필터, 원인 코드·근거 연결 |
| Git 전달 | stack 순서·PR base/head, CI 확인, 병합·태그·설치 각각의 관측 시점 |
| 관측 상태 | 활성/미연결/손실 의심/기록 오류; 설치됨·로딩됨·hook 관측됨을 구분 |

작업 선택·필터는 브라우저 메모리의 화면 상태다. 기록 자체를 수정하지 않는다.
성공을 녹색만으로 표현하지 않고 상태 문구·아이콘을 함께 쓴다. 키보드·좁은 화면을 지원한다.
자동 스크롤은 사용자가 과거 사건을 읽는 동안 멈춘다. 새 사건 수와 재개 동작을 제공한다.

## 최소 구조와 연결 방법

```text
공식 hook / 기존 guard·PR wrapper / 검증 명령 실행 연결
  → 허용 필드만 기록하는 emitter → 로컬 event spool
  → 읽기 전용 Node HTTP 서버 → TanStack Query → React 타임라인
```

| 영역 | 선택·책임 |
|---|---|
| 로컬 서버·수집 | 기존 Node ESM 기본 모듈·Bash 연결. 서버 실행에 프런트 제작 의존성을 요구하지 않는다. |
| 화면 | React + TypeScript, CSS. 현재 작업·타임라인·상세 보기·Git 상태를 컴포넌트로 구성한다. |
| 서버 데이터 | TanStack Query. snapshot 조회·주기 갱신·조회 오류를 관리한다. |
| 제작·배포 | Vite로 정적 파일을 빌드하고 플러그인에 포함한다. 사용자는 npm 설치·빌드를 하지 않는다. |
| 시험 | 서버는 node:test·Bash 회귀, UI는 Vitest·Testing Library, 통합은 실제 브라우저로 확인한다. |

Router·Table·Virtual·Start·별도 전역 상태 라이브러리는 첫 버전에 넣지 않는다. SSR·DB·daemon도 없다.
제작 소스는 repo 루트 `dashboard/`, 배포 정적 파일은 `plugins/harness-guard/dashboard/`다.
2초 간격의 snapshot 조회 하나로 시작한다. 데이터 기록 후 활성 화면 반영은 기존 시험 환경에서 3초 이내다.
서버는 `127.0.0.1`의 임의 포트에만 bind한다. 정적 asset/API allowlist, Host·Origin 검사,
프로세스별 접근 토큰과8MiB 응답 한도를 적용한다. 최신순 작업 전체의 연속 구간만 반환하고
`health.omittedOperations`로 생략 수를 알린다. 디스크 기록은 유지하며 최신 작업 하나가 초과하면 빈 목록·현재 미확인이다.
파일 탐색·명령 실행·Git 쓰기 API는 없다.
화면 문자열은 text로 렌더하며 PR/근거 링크는 검증된 주소만 허용한다.

### React·Query 상태 계약

서버 snapshot이 관측값의 정본이다. Query의 success는 조회 성공이며 Harness pass·MERGED가 아니다.
QueryClient는 화면 수명당 하나, polling 담당도 하나다. 다른 컴포넌트는 그 조회 결과를 props로 받는다.
query key는 viewer 실행 ID·repoId·worktreeId로 구분한다. 필터·선택·스크롤만 React 화면 상태에 둔다.
snapshot을 Effect로 별도 store에 복사하지 않는다. 파생 목록·현재 후보 판정은 같은 응답에서 계산한다.
요청 취소 신호와 2초 timeout을 적용하고 대상 변경 뒤 늦게 온 이전 응답을 현재 화면에 표시하지 않는다.
`refetchInterval=2000`, `retry=false`, `networkMode=always`를 명시한다. 반복 갱신이 재시도 역할을 한다.
숨긴 탭의 polling은 멈추고 복귀 시 즉시 재조회한다. 이전 데이터는 조회 성공 전까지 마지막 관측값이다.
오류·timeout이면 캐시가 있어도 **연결 끊김·현재 상태 미확인**을 표시한다. 관측 시각과 갱신 상태를 함께 보인다.
Query 캐시·접근 토큰은 메모리에만 둔다. 토큰을 query key·저장소·이벤트·빌드 산출물에 넣지 않는다.
snapshot은 unknown에서 런타임 검증한다. TypeScript 타입이나 정상 HTTP 응답만으로 신뢰하지 않는다.
CLI가 출력하는 시작 URL의 fragment에서 토큰을 읽고 즉시 주소에서 지운다. API만 인증 헤더를 받는다.
정적 파일에는 사용자 데이터가 없다. 새로고침으로 메모리 토큰이 사라지면 CLI 주소를 다시 여는 안내를 표시한다.

### 정적 파일 배포 계약

React 소스·설정·lockfile·제작 Node/npm 버전과 정적 산출물을 같은 후보로 기록한다.
현재 builder는 커밋된 파일을 복사하므로 산출물을 Git에 포함한다. CI는 임시 경로에 재빌드해
파일 목록·내용을 양방향 비교한다. 누락·추가·남은 옛 chunk·수동 수정은 실패이며 checksum만으로 대체하지 않는다.
`node scripts/build-dashboard.mjs --write/--check`가 제작 진입점이다. --check는 배포 파일을 고치지 않는다.
Vite의 상대 asset 경로와 manifest로 배포 allowlist를 만들고 파일 경로·MIME·digest를 서버 시작 시 검사한다.
CDN·외부 font·원격 script·개발 서버에 의존하지 않는다. source map·원본 .env·개발 의존성을 배포 화면에 포함하지 않는다.
분리 package의 `installable:false`는 유지한다. 공개 플러그인 실제 설치 시험은 staged package 검사와 별개다.

### 수집 활성화·보관

수집은 기본 OFF다. CLI가 지정한 데이터 디렉터리에 현재 repo/worktree의 활성 lease를 쓴다.
lease는 10초마다 갱신하고 30초 후 만료한다. viewer 종료·lease 만료 후 새 사건은 기록하지 않는다.
viewer는 전용 writer의 검증 cache·소유자 전용 socket 준비 후 lease를 발행한다. 사건 쓰기와 결과 조회는
[writer 교정 계약](local-runtime-dashboard/capture-writer-correction.md)을 따르며 HTTP 처리와 실행을 분리한다.
Codex adapter는 실제 `PLUGIN_DATA` 아래 `observability/`를 사용한다. wrapper는 검증된
`HARNESS_OBSERVE_DIR`를 전달받는다. 화면 실행만으로 호스트에 환경변수가 전달됐다고 가정하지 않는다.
실제 hook이 같은 경로·활성 대상을 읽었다는 사건이 오기 전에는 **hook 연결 미확인**이다.
Claude는 명시 전달 경로와 fixture 계약을 유지하되 실제 호스트 검증은 기존 미확인 보류를 유지한다.

디렉터리는 소유자 전용 0700, 기록은 0600이며 symlink·다른 소유자·경로 탈출을 거부한다.
공유 JSONL 회전을 피하고 이벤트별 작은 파일을 atomic rename으로 확정한다. 이벤트는 최대 4 KiB,
전체는 32 MiB·7일 보존 중 먼저 도달한 한도로 정리한다. 동시 writer의 한도 초과도 시험한다.
원문 명령·argv·prompt·소스·stdout/stderr·환경변수·토큰·PR 본문은 저장하지 않는다.
외부 전송은 없다. 명시한 시험 기록 외 기존 파일을 삭제하지 않는다.

## 사건·판정 계약

필수 공통 필드: `schemaVersion=1`, `eventId`, `operationId`, `parentOperationId|null`,
`sequence`, `recordedAt`, `source`, `phase`, `outcome`, `reasonCode`, `pluginVersion`,
`repoId`, `worktreeId`, `hostSessionId|null`, `headSha|null`, `baseSha|null`.
`repoId`는 canonical Git common-dir, `worktreeId`는 worktree 경로의 digest다.
추가 필드는 검증한 branch/PR 식별자, exitCode, durationMs, 근거 ID만 허용한다.
같은 eventId는 중복 표시하지 않는다. 전역 sequence·완전한 전역 순서를 주장하지 않는다.
source는 `codex-hook|claude-hook|guard|check-runner|pr-create|pr-merge|solo-merge|stack` 중 하나다.
phase는 `started|finished`, outcome은 `allow|deny|pass|fail|pending|enqueued|unverified`로 제한한다.
started의 outcome은 pending이다. schema에 없는 key·자유 서술 reason·원문 output을 거부한다.
명시 검사는 시작·종료에 동일한 검증된 evidenceId를 남긴다. guard는 허용된 규칙별 code를 기록하며
부모 hook은 같은 문맥의 직접 자식 deny 결과 하나만 승계한다. 누락·모호함은 generic deny를 유지한다.

| 사건 | 확인 주체 | 표시 기준 |
|---|---|---|
| hook/guard 결과 | 실제 adapter·guard | allow/deny/error; 허용은 명령 성공이 아님 |
| 검증 시작/종료 | 명시 검증 실행 연결 | 명령 식별자·exit와 현재 SHA; 시험 범위 밖 품질을 보장하지 않음 |
| PR 생성·merge 단계 | 기존 wrapper와 원격 응답 | 실제 확인한 단계만; pending/enqueued는 MERGED 아님 |
| 보호 복구 | solo wrapper | PATCH 성공은 시도 성공, 전체 정책 readback 일치가 복구 확인 |
| skill/host 정보 | 공식 payload가 실제 제공한 값 | 미제공은 unknown; 프롬프트로 선택을 추정하지 않음 |

서로 다른 후보·worktree/session의 사건을 합쳐 성공으로 만들지 않는다. SHA가 바뀌면 이전 결과는
**이전 후보의 근거**다. start만 있고 종료 사건이 없으면 **종료 미확인**이며 시간만으로 실패/완료를 정하지 않는다.
sequence gap·깨진 파일·보존 한도 삭제는 관측 손실로 표시한다. 기록 자체가 실패한 모든 사건의 개수는 알 수 없다.
수집 실패가 기존 gate의 exit·허용/거부·복구를 바꾸지 않도록 emitter 실행에 시간 상한을 둔다.

## 고정 완료 기준

| ID | 완료 조건 | 검증 |
|---|---|---|
| O1 | OFF 무기록, ON 허용 필드만 기록, 동시 쓰기·한도·손실 표시 | emitter/reader 단위·실제 파일 시험 |
| O2 | 정상·차단·기록 실패에서도 기존 guard/wrapper 판정 동일 | 기존 회귀 + exit/stdout/stderr 비교 |
| O3 | 현재 후보·시점·미확인·복구 주의를 정확히 구분 | 재시도·중단·후보 변경·두 worktree·응답 역전·캐시 잔류 시험 |
| O4 | 사용자가 화면에서 현재 검사·차단 이유·다음 행동을 찾음 | 정상/차단/중단 브라우저 과제, 3초 반영·복귀 갱신·키보드·좁은 화면 |
| O5 | 설치 가능한 후보에서 실제 Codex hook→기록→화면 확인 | 격리 CLI·승인된 데스크톱, 재빌드 일치·package/bundle·설치 asset 로드 |

O5의 원격 PR·태그·설치 사건은 실제 실행된 범위만 인수한다. fixture를 실제 호스트·원격 실행으로 세지 않는다.
Claude 미확인, 실제 회사·사람 인수는 이 신규 범위의 숨은 완료 조건으로 추가하지 않는다.
필수 O1–O5 FAIL/미실행은 해당 기능 인수 미완료다. UI 캡처만으로 collector·gate 보존을 통과시키지 않는다.

## 두 작업의 실행 순서

아래 승인 순서를 유지한다. 최초 G0 FAIL을 보존하며 공식 trunk·그룹 보호 통합 시험과 G1 제출 경계 로컬 검사를 통과했다.
계획 당시 main의 trusted CI가 stacked 이벤트를 받지 않아 CI 선행 전달을 추가 승인받았다.
[CI1.1.0 전달 원문](stack-ci-bootstrap.md#원격-전달--2026-10-16)의 main·태그·역병합을 확인했다. 전체 후보는1.2.0이며 G1/G2 인수와 PR584의 develop4c1136e 통합이 완료됐다.
아래 순서와 [현재 T1–T4 실행 결과](../pilots/local-runtime-dashboard.md)를 따른다. 초기 결과는 별도 역사로 보존하고 새 후보의 영향 검사와 T4 필수 인수를 연결한다.

1. G0 공식 gh-stack 호환 시험 → G1 안전한 제출 → G2 검증된 순차 병합·복구.
2. 이 연결 자체는 기존 Git Flow로 검증·통합한다. 자기 구현을 미검증 stack 경로로 전달하지 않는다.
3. 대시보드 O1 계약/저장 → O2 수집 연결 → O3/O4 viewer → O5 설치 후보·실호스트 검증.
4. 대시보드 변경을 세 층의 stack으로 실제 사용해 G3 통합 인수와 O1–O5를 함께 확인한다.
5. 합의한 기능 인수 후에만 정식 전달한다. PR→develop→release→main→태그→역병합→설치 상태를 구분한다.

GitHub 상시 자동 조회, 비용·토큰 통계, 모든 앱의 내부 event 구독, 여러 사람의 중앙 화면,
대시보드에서 승인·병합하는 기능은 첫 버전 범위 밖이다. 필요할 때 별도 요구로 판단한다.
기존 PR 원격 판정은 wrapper가 계속 수행하므로 대시보드의 직접 GitHub polling은 필수 기능이 아니다.

## 계획 문서 검증 — 2026-10-15

초기안에서 변경 문서5개와 Git 관리 Markdown+신규 문서354개의 참조·앵커·199줄 검사를 통과했다.
최초 `--root .` 탐색은 과거 실행 사본까지1954개를 읽어375건 실패했다. 이를 현재 문서 성공으로 덮지 않는다.
과거 자료·검사기는 수정하지 않았다. React 전환안의 관련 문서5개 구조·참조·199줄 검사와
`git diff --check`를 통과했고, 스택·파일 책임·제작/배포·검증 연결을 대조했다.
계획 검토 당시 기능 시험·전체 quality·설치·원격 실행은 미실행이었다. 현재 결과는 위 T1–T4 기록을 따른다.

## 참고 원본

- [Codex App Server events](https://learn.chatgpt.com/docs/app-server): 공식 이벤트와 기존 desktop 연결 가능성은 별개다.
- [Claude hook](https://code.claude.com/docs/en/hooks): 공식 lifecycle을 재구현하지 않는다.
- [OpenTelemetry traces](https://opentelemetry.io/docs/concepts/signals/traces/): 사건 상관관계만 참고하며 수집 서버를 도입하지 않는다.
- [React 제작 도구](https://react.dev/learn/build-a-react-app-from-scratch), [Vite 정적 배포](https://vite.dev/guide/static-deploy).
- [Query polling](https://tanstack.com/query/latest/docs/framework/react/guides/polling), [network mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode), [query key](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys).

# 로컬 실시간 대시보드 구현 계획

> 실행자: `superpowers:executing-plans`로 순차 구현하고, 독립 검토는 별도 인스턴스에 맡긴다.
> 구현은 승인됐으며 선행 [공식 계약 검토](../stacked-git-workflow/final-review.md)·보호 통합 시험 PASS·연결 구현 중이다.
> 원래 연결 범위와 순서를 유지한다. T1 커밋452cde5 이후 T2 포함29개 시험을 통과했다. [현재 결과](../../pilots/local-runtime-dashboard.md)에 한계와 다음 단계를 기록한다.
> [현재 인수](../../pilots/gh-stack-adapter-acceptance.md): PR584 수정4dc0783의 필수5·hosted quality80·독립 리뷰 PASS, develop4c1136e 통합 완료. 대시보드 B층 연결 검증을 마치고 C층을 진행한다.

**Goal:** 현재 Harness 실행·차단·검증 근거를 로컬 읽기 전용 화면에서 확인한다.
**Architecture:** 선택형 emitter → 제한된 로컬 spool → reader → Node HTTP snapshot → Query → React 화면.
기존 gate가 판정하며 viewer는 판정 권한을 갖지 않는다.
**Tech Stack:** Node ESM·Bash, React·TypeScript·Vite·TanStack Query, CSS. DB·SSR·daemon 없음.
**Spec:** [대시보드 설계·O1–O5](../local-runtime-dashboard.md).

## 공통 제약

- 구현 전에 실제 base·작업공간·AGENTS·검증 계약을 다시 확인한다. 사용자·기존 작업을 보존한다.
- 제안 기본값: schema1, 2초 polling, 3초 반영, lease 갱신10초/만료30초, event4 KiB, spool32 MiB/7일.
- 첫 기능은 Codex 관측 경로를 필수 인수한다. Claude 실호스트는 미확인 보류다.
- event는 명령 원문·출력·비밀정보를 받지 않는다. 차단 이유는 허용된 code→설명으로 변환한다.
- 구현 후보는 MINOR 변경이다. 시작 시 원격 최신 버전을 확인하고 두 manifest·README를 같이 준비한다.
- 각 task는 검수한 실패 사례→최소 구현→유지 회귀→문서 현행화→규약 커밋으로 끝낸다.
- 아래 신규 파일/함수는 계획이며 현재 설치본에 존재하지 않는다.
- React·Query 채택은 승인됐다. Router·Table·Virtual·Start·별도 전역 store는 이번 구현에 추가하지 않는다.
- 제작 의존성·도구 버전은 구현 시 공식 지원 범위를 확인해 lockfile과 함께 고정한다. 소비자 설치 시 빌드하지 않는다.
- 서버 데이터는 Query, 필터·선택은 React가 소유한다. 토큰·Query 캐시는 메모리에만 두고 원문 .env는 읽지 않는다.
- `.claude/rules/`는 현재 없다. `templates/stacks/react/rules/react.md`와 공통 TypeScript rule을 읽어 연결한다.

## 집중 검토할 반례

1. 로그 쓰기 실패 때문에 기존 거부 exit가 허용으로 바뀌는 경우 — T2 비교 시험.
2. 두 worktree의 같은 branch명·다른 SHA를 하나의 성공으로 합치는 경우 — T1/T3.
3. 종료 유실·보존 한도 삭제·캐시 잔류·대상 전환 후 늦은 응답을 현재 성공으로 표시 — T1/T3.
4. 악성 event/URL/경로를 HTML·로컬 파일 접근으로 실행하는 경우 — T3.
5. source 변경과 다른 정적 파일·남은 옛 chunk가 패키징되거나 설치 위치에서 asset 로드 실패 — T3/T4.

## 파일 책임과 인터페이스

아래 서버·수집 경로는 `plugins/harness-guard/` 기준이다. 프런트 제작 소스는 repo 루트 `dashboard/`다.

| 신규 파일 | 책임·공개 인터페이스 |
|---|---|
| `scripts/observation/event.mjs` | `validateEvent(value)`, `appendEvent(dataDir,event) → {written,reasonCode}` |
| `scripts/observation/emit.mjs` | schema 검증 후 stdin 사건을 기록하는 Bash용 CLI |
| `scripts/observation/read.mjs` | `readSnapshot(dataDir,selection) → {operations,health,observedAt}` |
| `scripts/observe.mjs` | CLI 활성 lease와 HTTP server; `startViewer({dataDir,repo,port:0}) → {url,close}` |
| `scripts/observation/run-check.mjs` | `runCheck({id,argv,cwd,context}) → exitCode`; argv/output은 저장하지 않음 |
| `dashboard/index.html`, `assets/*`, `asset-manifest.json` | 제작 소스에서 생성·커밋되는 정적 파일. 직접 수정하지 않는다. |

`selection={repoId,worktreeId?,operationId?}`이며 `context`는 스펙의 repo/worktree/session/SHA 필드다.
`health={captureState,lastEventAt,parseErrors,gaps,retentionApplied}`이며 알 수 없는 손실 수는 추정하지 않는다.
`operations`는 operationId와 phase별 event 목록이다. `close()`는 자신이 쓴 lease만 해제한다.
이 API를 소비하는 기존 hook·wrapper는 원래 stderr/exit를 그대로 유지한다.

repo 루트의 제작 파일·인터페이스:

| 신규 파일 | 책임 |
|---|---|
| `dashboard/package.json`, `dashboard/package-lock.json`, `dashboard/.node-version` | 제작 전용 의존성·도구 버전·검사 명령; npm 버전도 packageManager에 고정 |
| `dashboard/vite.config.ts`, `dashboard/vitest.config.ts`, `dashboard/tsconfig.json`, `dashboard/eslint.config.mjs` | Vite·UI 시험·strict TypeScript·React hooks lint 설정 |
| `dashboard/index.html`, `dashboard/src/{main,app}.tsx`, `dashboard/src/styles.css` | 단일 QueryClient·polling 담당, 의미 있는 HTML·키보드·화면 배치 |
| `dashboard/src/{api,view-model}.ts`, `src/components/*.tsx` | `parseSnapshot(unknown) → Snapshot`, `fetchSnapshot(context,signal)`, 파생 화면·컴포넌트 |
| `dashboard/src/api.test.ts`, `dashboard/src/app.test.tsx` | 응답 경계·조회 오류·전환·사용자 행동 단언 |
| `scripts/build-dashboard.mjs`, `tests/dashboard-build-test.mjs` | `--write/--check`, 안전한 임시 빌드·완전 비교·배포 manifest 생성 |

`ViewerContext={viewerId,repoId,worktreeId,accessToken}`는 인증된 `/api/context`와 시작 URL에서 구성한다.
HTTP snapshot은 `readSnapshot` 결과에 `schemaVersion=1,viewerId,repoId,worktreeId`를 붙인다.
`Snapshot`은 그 검증된 응답 타입이다. TypeScript 타입만으로 승인하지 않으며 UI/API 계약 fixture를 함께 대조한다.

## T1 — 사건 저장·reader (O1·O3)

파일: 위 `event.mjs`, `emit.mjs`, `read.mjs`; 신규 `tests/observation-test.mjs`.

- [x] OFF·만료 lease에서는 `written=false`와 무기록, ON에서는 허용 필드만 기록하는 테스트를 먼저 쓴다.
- [x] `rejectsRawCommand`, `rejectsSymlink`, `separatesWorktrees`, `deduplicatesEventId`,
  `reportsSequenceGap`, `unfinishedIsUnknown`, `boundsConcurrentWrites`에 구체적 단언을 둔다.
- [x] `node --test tests/observation-test.mjs`의 의미 있는 RED를 확인하고 스펙을 잠근다.
- [x] 위 세 API를 구현한다. 10개 writer×100건, 잘린 파일·잘못된 schema·32 MiB/7일 경계를 처리한다.
- [x] 같은 시험 PASS, Node 구문 검사, 기록 권한·허용 필드·용량 측정 결과를 보존한다.
- [x] 설계의 O1/O3 충족 범위와 최초 실패를 갱신한 뒤 해당 파일만 규약대로 커밋한다.

## T2 — 실제 guard·검증·Git 경로 연결 (O2·O3)

수정: `scripts/{guard.sh,codex-pretool-guard.mjs,codex-secret-egress-guard.mjs,pr-create.sh,pr-merge.sh,solo-merge.sh}`.
신규: `run-check.mjs`, `tests/observation-integration-test.sh`. T1의 API를 소비한다.

- [x] 기존 허용/거부/에러를 capture OFF·ON·기록 실패 상태에서 실행하고 exit·기존 출력을 비교한다.
- [x] malformed hook·누락 PLUGIN_DATA·egress 거부·PR 실패·보호 PATCH 성공/readback 불일치 사례를 잠근다.
- [x] start/finish 상관관계, 자식 wrapper의 parentOperationId, 실제 session 부재=null을 연결한다.
- [x] `runCheck`가 실제 명령을 한 번만 실행하고 출력을 원래 터미널로 전달하며 원래 exit를 반환하게 한다.
  기존 QA workflow에서 선택적으로 감싸되 임의 명령의 의미·전체 테스트 PASS를 추정하지 않는다.
  started·finished에 동일한 검증된 검사 id를 남겨 실행 중·완료·재시도를 식별한다.
- [x] 규칙별 allowlist reason을 guard에서 직접 기록하고 부모 hook에 bounded 조회로 전달한다.
  같은 후보·세션의 직접 자식 결과가 없거나 모호하면 generic deny를 유지하며 원출력·exit는 바꾸지 않는다.
- [x] OFF에서는 추가 emitter process를 만들지 않는다. ON emitter는 250ms 상한으로 종료한다.
  emitter 실패/timeout은 진단만 남기고 기존 gate 결과를 덮어쓰지 않는지 확인한다.
- [x] `bash tests/observation-integration-test.sh`와 guard·pr-create·pr-merge-auto·solo-merge 기존 회귀를 실행한다.
- [x] 현재 동작·수집 한계·코드 소비자 문서를 갱신하고 규약대로 커밋한다.

## T3 — 로컬 viewer와 사용 과제 (O3·O4)

신규: plugin `scripts/observe.mjs`·배포 `dashboard/*`, root 제작 `dashboard/*`·build helper·시험.
안내: `docs/guides/observability.md`, `docs/README.md`. T1의 `readSnapshot`을 사용한다.

- [ ] HTTP는 loopback만, 허용하지 않은 Host/Origin/path와 API의 잘못된 token을 거부하는 실패 테스트를 작성한다.
- [ ] `missingFinishIsUnknown`, `staleShaIsHistorical`, `restoreAttemptIsNotRestored`,
  `untrustedLabelIsText`, `reconnectDoesNotDuplicate`를 reader/API/UI 경계에 단언한다.
- [ ] `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `eslint.config.mjs`와 제작 package를 구성한다.
  React/react-dom/Query만 화면 의존성으로 쓰고 Vite·TypeScript·ESLint·Vitest·Testing Library·jsdom은 제작용이다.
  기존 품질 gate에 `lint`, `typecheck`(tsc --noEmit), `test:unit`(vitest run)을 연결한다.
- [ ] UI RED: `cachedPassWhileDisconnectedIsUnknown`, `latePreviousWorktreeIgnored`, `httpSuccessIsNotGatePass`,
  `offlineLoopbackStillFetches`, `focusReturnRevalidates`, `strictRemountLeavesOnePoller`, `invalidSnapshotRejected`.
  동일 캐시를 먼저 채운 뒤 실패·전환·복귀시켜 화면 문구와 실제 요청 대상을 단언한다.
- [ ] 선택한 repo/worktree의 활성 lease와 고정 API/asset만 제공하고 임의 파일·shell route를 만들지 않는다.
- [ ] `observe.mjs`는 시작 URL fragment에 임시 토큰을 전달한다. 화면은 메모리로 읽고 history.replaceState로
  즉시 제거한 뒤 인증 헤더로 `/api/context`를 조회한다. 정적 asset에는 데이터·토큰을 주입하지 않는다.
  토큰이 없는 새로고침은 CLI 주소를 다시 열도록 안내한다. 잘못된 토큰·context·서버 재시작 시 캐시로 인증을 대신하지 않는다.
- [ ] `GET /api/snapshot`에 런타임 응답 검증·context 일치를 적용한다. 접근 토큰은 헤더로 보내고
  query key는 `['observation',viewerId,repoId,worktreeId]`다. 이전 대상의 placeholder data를 사용하지 않는다.
- [ ] 단일 QueryClient와 App의 조회 한 곳만 `refetchInterval=2000`, `retry=false`, `networkMode=always`를
  설정한다. 요청 취소·2초 timeout, 숨긴 탭 polling 중단·복귀 재조회를 적용하고 별도 interval은 만들지 않는다.
  처음/복귀 조회 전·조회 실패 시 현재 확정 상태를 표시하지 않는다. 캐시의 관측 시각은 보존한다.
- [ ] 현재 작업→차단 이유→근거 순서로 화면을 구현한다. 상태는 색·글자를 함께 사용한다.
  필터와 자동 스크롤 중지는 화면 상태로만 관리한다. snapshot을 별도 전역 store·Effect로 복제하지 않는다.
- [ ] Vite는 상대 base·source map OFF·격리 envDir를 사용한다. 빌드 자식 환경에서 VITE_*를 제거하고
  원본 .env·호스트 경로·토큰이 번들에 주입되지 않음을 합성 canary로 검사한다. 기존 환경 파일은 보존한다.
- [ ] build helper의 RED: asset 누락/추가/변조·옛 hashed chunk·경로 탈출·symlink·--check 무수정.
  임시 빌드의 파일 목록과 바이트를 양방향 비교한다. --write는 기존 manifest가 관리한 생성 파일만 교체·정리하고
  예상 밖 파일을 만나면 보존·중단한다. --check는 배포 경로를 수정하지 않는다.
  manifest에 상대 asset 경로·MIME·SHA-256을 넣는다. 서버는 검증한 항목만 제공하고 파일 탐색 fallback은 없다.
- [ ] `node --test tests/dashboard-test.mjs tests/observation-test.mjs tests/dashboard-build-test.mjs`와
  아래 제작 명령의 PASS를 확인한다. 새 명령들은 구현 전이며 현재 실행 가능한 사용법이 아니다.

```bash
npm ci --prefix dashboard
npm run lint --prefix dashboard
npm run typecheck --prefix dashboard
npm run test:unit --prefix dashboard
node scripts/build-dashboard.mjs --write
node scripts/build-dashboard.mjs --check
```

- [ ] 실제 브라우저에서 정상 검사·보호 branch 거부·중간 종료의 세 과제를 실행한다.
  제작 dev server 대신 Node가 제공하는 빌드 화면에서 값과 사건을 대조한다. 3초 반영·키보드·모바일 폭·
  과거 기록 읽기·대상 전환·탭 복귀를 확인한다. UI mock 시험을 실제 hook 연결 증거로 사용하지 않는다.
- [ ] 첫 실행/종료/기록 위치/지우기/미연결 해결을 새 가이드에 한 번만 쓰고 규약대로 커밋한다.

## T4 — 설치 후보·통합 인수 (O5, Git G3 연결)

수정: `experiments/split-packaging/packages.json`, `.github/workflows/ci-gate.yml`,
`.gitignore`, `docs/{repository-structure,harness-setup,harness-maintenance}.md`, 양쪽 plugin manifest와 README 배지.
추가 실제 실행 기록은 `docs/pilots/local-runtime-dashboard.md` 한 곳에 연결하고 원문은 `.runtime/`에 둔다.

- [ ] 세 층 A=계약/저장, B=수집 연결, C=viewer/패키지로 stack을 제출한다. T4 검증은 각 층 결과를 함께 대조한다.
- [ ] 배포 catalog에 core 파일·asset 소유와 adapter import를 연결하고 실제 staged 경로에서 실행한다.
- [ ] core sources에 plugin `dashboard/`를 포함한다. root 제작 소스·node_modules는 설치 artifact에 넣지 않는다.
  source archive는 root 제작 소스·lockfile도 보존한다. 기존 Git revision 복사·checksum builder는 유지한다.
- [ ] `.gitignore`에 제작 node_modules·cache·tsbuildinfo만 좁게 제외하고 plugin 정적 산출물은 커밋한다.
  구조 안내에 제작 정본·생성 위치·재생성/검사 명령을 기록한다. dashboard 제작에 repo 전체 TS 전환은 없다.
- [ ] 기존 quality 안에 제작 Node/npm 고정·npm ci·lint/typecheck/UI 시험·임시 재빌드 비교를 연결한다.
  trusted 검사와 후보 build 실행을 분리하고 비밀정보·쓰기 token을 후보에게 주지 않는다. CI 검사를 줄이지 않는다.
- [ ] package-build, package-artifact-integrity, package-catalog-integrity, package-workflow-binding,
  release-bundle 테스트 및 현재 quality 전체를 실행한다. artifact는 커밋된 후보를 대상으로 만든다.
- [ ] 설치 경로를 바꾸고 root 소스·제작 node_modules·외부 네트워크 없이 Node 서버에서 HTML/CSS/JS를
  로드한다. 해시 asset·MIME·접근 거부·오프라인 localhost 갱신을 확인한다. vite preview를 설치 실행기로 쓰지 않는다.
- [ ] 격리된 Codex CLI에서 실제 hook allow/deny→기록→화면을 확인하고 source/runtime 버전을 기록한다.
- [ ] 실제 desktop은 승인된 전용 대화·설치 대상에서 같은 연결을 확인한다. 전역 전환이 필요하면
  대상·복구 명령을 먼저 구체화한다. 임의 cache patch·다른 plugin 변경은 하지 않는다.
- [ ] 독립 검토자가 O1–O5와 G3의 실제 후보·명령·화면·실패 근거를 대조한다. fixture는 별도 표기한다.
- [ ] 현재 사용 안내·스펙의 판정을 갱신하고 구현/검증/PR/태그/설치를 각각 보고한다.

## 멈춤 조건과 후속 전달

O1–O5와 G3가 충족되면 기능 인수를 끝낸다. 토큰/비용 측정·중앙 관제 등을 추가 조건으로 붙이지 않는다.
필수 실제 실행이 불가능하면 해당 항목을 미확인으로 남기고 정확한 환경 조건을 보고한다.
정식 발행은 기존 release-check의 live provenance·quality·독립 리뷰·Git Flow를 그대로 적용한다.
공개 버전/설치 변경은 그 시점의 사용자 승인 범위 안에서만 실행한다. 계획 작성은 발행 승인이 아니다.

# 네 소비 프로젝트 적용 준비 점검 (2026-10-07)

이 문서 앞부분의 읽기 전용 조사·로컬 보류 기록은 당시 후보의 결과다. 현재 원격 전달·릴리즈·잔여 조건은 맨 아래 [최신 병합·실화면 점검](#후속-develop-병합과-실화면점검-2026-10-08)에서 구분한다.

## 범위와 완료 경계

사용자는 네 소비 프로젝트의 읽기 전용 준비 점검, QA 범위·완료 기준 대조, 적용 순서·최소 변경
계획 작성을 승인했다. 소비 repo 수정·설치·앱/시험/CI 실행·PR 생성·서버/DB/identity 변경·이미지
게시·배포·원격 보호/이벤트 정책 변경은 보류다. 이 보고와 관련 현재 안내만 Harness에서 갱신한다.
제품 방향 판정은 **연결**이다. Harness의 기존 계약을 각 제품의 기존 검사와 연결하며, 제품별
업무 사례·RLS·UAT·배포 로직을 공용 Harness에 구현하지 않는다.

점검 기준은 v0.81.0 정식 소스 `9838c2ef288b4566f81fae03acb56530ee165c06`이다. 현재 Harness
`6542462`와 해당 태그 사이 plugin/templates/scripts/workflow 변경은 없음을 확인했다.
[구조화된 실행 근거](consumer-readiness-2026-10-07.json)는 명령·대상·종료 코드·원문·지문을 보존한다.
이전 [10월 6일 점검](consumer-repo-sync-2026-10-06.json)은 당시 로컬 후보 결과로 유지한다.

| 이번 조사 수용 조건 | 관찰과 판정 |
|---|---|
| 네 대상의 신선한 원본 고정 | GitHub develop SHA 조회 → 해당 SHA archive → 선택 파일 bytes와 공식 Git blob 대조 PASS |
| 자산 차이와 서버 보호를 구분 | 로컬/원격 repo-sync exit 1을 보존; 보호 default --check exit 0과 실제 context 이름을 별도로 기록 |
| QA 명령·환경·관찰 경계 대조 | 각 AGENTS/rule/manifest/CI와 대표 정상·실패·경계 단언을 소스에서 확인; 앱 시험 NOT_RUN |
| 최소 적용 계획과 권한 경계 | 아래 공통 단계·프로젝트별 범위·진입/종료 기준 작성; 소비 변경 승인으로 확대하지 않음 |
| 현행화·보존·독립 검토 | Harness 현재 안내와 연결; 로컬 네 HEAD/branch/status 전후 동일; 문서 선언/링크·공개 안전성 20·공개 문서 32·제품 방향 13 PASS, 제한 독립 대조 finding 없음 |

**조사 완료와 제품 준비 완료는 다르다.** 자산 기준은 현재 FAIL이며 앱 품질/전체 적용 완료는
UNVERIFIED다. 소스의 단언 존재·기존 CI 설정·테스트 개수를 실제 시험 PASS로 쓰지 않는다.
파일 전체 불변성이나 모든 QA 공백 발견을 보장하지 않는다.

## 원본 신선도와 자산 결과

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-baseline.md)을 읽는다.

## 공통 적용 계획 — 아직 실행하지 않음

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-baseline.md)을 읽는다.

## 프로젝트별 QA와 진입 조건

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-baseline.md)을 읽는다.

### DriveTree — 첫 적용 후보

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-baseline.md)을 읽는다.

### webhook-service — 두 번째 후보, 게시 경계 선행

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-baseline.md)을 읽는다.

### siku — 세 번째 후보, DB/Storage 권한 경계

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-baseline.md)을 읽는다.

### erp — 네 번째 후보, 실인증 UAT 안전 경계 선행

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-baseline.md)을 읽는다.

## 순서·종료 조건·다음 행동

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-baseline.md)을 읽는다.

## 문서 선언

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-baseline.md)을 읽는다.

### 후속: DriveTree 로컬 계약·QA 준비

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-local-security.md)을 읽는다.

### 후속: 네 소비 프로젝트의 로컬 적용 진행

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-local-security.md)을 읽는다.

### 후속: 보안 잔여와 원격 전달 조건 조사

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-local-security.md)을 읽는다.

#### 전달 조건의 추가 확인 (2026-10-07)

[조회 경계·실행 순서](consumer-readiness-2026-10-07-remote-conditions.md)와 [그대로 보존한 metadata 원문](consumer-readiness-2026-10-07-remote-metadata.md)을 함께 읽는다.

### 최신 인증 SDK 전환 후보

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-security-acceptance.md)을 읽는다.

### DriveTree 깊이 보완과 ERP의 미적용 조건

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-security-acceptance.md)을 읽는다.

### 이번 연속 실행의 종료 범위와 증거 보존

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-security-acceptance.md)을 읽는다.

### 후속: 소비 원격 전달과 보류 조건 (2026-10-07)

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-remote-acceptance.md)을 읽는다.

### 후속: 의존성 재확인과 trusted 전환 준비 (2026-10-07)

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-remote-acceptance.md)을 읽는다.

### 후속: ERP 깊이 보완의 로컬 인수 (2026-10-07)

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-remote-acceptance.md)을 읽는다.

### 후속: 소비 원격 인수와 webhook 릴리즈 (2026-10-07)

관련 판단 전에 [전체 본문](consumer-readiness-2026-10-07-remote-acceptance.md)을 읽는다.

### 후속: develop 병합과 실화면점검 (2026-10-08)

사용자가 DriveTree → siku → ERP 순서의 develop 병합, 관련 preview/staging 관찰, 남은 보안 경고 노출 확인을 승인했다. 위 OPEN·병합 미실행 기록은 10월 7일 당시 결과다. 세 PR은 같은 고정 head의 필수 검사 6·6·8 PASS, 미해결 스레드 0, mergeable과 기존 독립 검토의 입력 불변 범위를 대조하고 기존 보호를 유지한 래퍼로 순서대로 병합했다. main 운영 배포·결제·새 인증 권한·보호 완화는 실행하지 않았다.

| 제품 | 검증한 앱 병합 SHA | 병합·검사 | 외부 관찰과 남은 경계 |
|---|---|---|---|
| DriveTree | `a355bd25166e285d899430464e5e311f37b55d5d` | [PR #85](https://github.com/grinvi04/drivertree/pull/85) MERGED; 고정 head `907ea045` 필수 6 PASS | 같은 merge SHA의 Preview #6917497665 SUCCESS. 실제 화면 렌더 PASS, 가이드·범칙금 빈 상태 화면 및 유지비 계산 오류로 연결된 기능 smoke FAIL. Railway staging에 현재 새 배포 증거 없음; production 제외 |
| siku | `92a929810c636aaec2670028a31566b50081811b` | [PR #87](https://github.com/grinvi04/siku/pull/87) MERGED; 고정 head `dea9994` 필수 6 PASS | 같은 merge SHA의 Preview #6917504540 SUCCESS. 실제 브라우저가 Vercel 로그인으로 이동해 앱 화면 UNVERIFIED. 감사 0의 이전 동일 입력 증거와 원격 DB drift 미측정은 구분 |
| ERP | `9acfb7600c2f2e3abfaf6886211a6fd20e0fe4cc` | [PR #255](https://github.com/grinvi04/erp/pull/255) MERGED; 고정 head `7a13802` 필수 8 PASS | GitHub deployment 0, Vercel 기존 CLI 인증 없음·확인한 Chrome 세션 로그인 필요로 preview UNVERIFIED. 결제 부족으로 단정하지 않음; 전체 감사 high 9·운영 의존성 그래프 high 7 FAIL |
| webhook-service | `e1eee56e101be3fc61526430599773116cd95797` | 앞선 v1.5.0·역병합·trusted 전환 유지 | 이번 앱/운영 배포 변경 없음. GHCR 직접 readback·운영 IdP·서비스 배포 미확인은 앞선 기록 유지 |

Railway live `service.repoTriggers`에서 DriveTree develop → staging, main → production을 확인했다. staging 최신 배포는 2026-06-08 FAILED/stopped, active deployment 0이고 현재 source는 null이다. develop 트리거 존재와 새 배포 성공은 다르다. Vercel 화면 렌더만으로 API 연결·데이터·계산 기능까지 완료로 판정하지 않는다. 실제 미리보기의 공개 JS는 API base를 `https://drivertree-staging.up.railway.app/api`로 지정한다. 이 주소의 calculator/penalties GET은 HTTP 404 `Application not found`였으므로 연결 대상이 서비스되지 않는 상태임을 확인했다. 배포 누락의 근본 원인은 미확인이며 이번에는 인프라 설정을 바꾸지 않았다.

현재 npm registry lock 감사 재확인은 DriveTree frontend high 5·backend moderate 20/운영 양쪽 0, ERP 전체 high 9/운영 그래프 high 7로 기존과 같다. 최초 inline 보고 스크립트 문법 오류는 raw 감사 결과 오류와 구분해 보존했고 성공한 운영 감사 exit 0을 전체 감사 PASS로 쓰지 않는다. [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)와 [sprintf-js advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)는 여전히 공식 수정판 None이다. 최신 버전 숫자나 npm 강제 다운그레이드를 안전한 호환 수정으로 취급하지 않는다.

ERP에서 shadcn은 globals.css의 빌드 CSS import에 사용한다. 이전 검증 이미지 `erp-braces-full:20261007`의 root require.resolve 및 전체 /app/node_modules package.json 순회에서 braces·micromatch·shadcn·@shadcn/registry·ts-morph는 없었다. 이 제한된 컨테이너 런타임 부재와 install/빌드 그래프 high 7 경고를 구분하며, 현재 원격 배포 이미지나 모든 서버 입력의 안전성을 보증하지 않는다. 기존 제품 전용 깊이 보완 및 ignore-scripts 명시 적용을 유지하고 새 공용 패치·제품 의존성 변경은 하지 않았다.

실행 원문·고정 후보·최초 실패·배포와 UI 관찰은 `$HOME/Documents/Codex/2026-10-08/consumer-merge-verification/`에 보존한다. ERP 사용자 primary feature `085d0ce`·미추적 `.codex/`와 Harness chat의 기존 `.gitignore` 변경을 유지한다. 제품 현재 안내는 문서 전용 [DriveTree PR #86](https://github.com/grinvi04/drivertree/pull/86)·[siku PR #88](https://github.com/grinvi04/siku/pull/88)·[ERP PR #256](https://github.com/grinvi04/erp/pull/256)의 필수 CI 6·6·8 PASS와 별도 문서 검토를 거쳐 develop에 병합했다. 표의 SHA는 실화면을 점검한 앱 병합 후보이며 이 문서 후속의 develop tip과 구분한다. 이슈 #496·프로젝트 지도도 이 관찰 범위로 갱신했고 과거 QA 기록은 그대로 둔다.

다음 단계는 DriveTree staging 연결 원인을 진단하고 승인된 비운영 복구 범위를 정한 뒤 실제 기능을 재확인하며, 기존 Vercel 로그인으로 siku 화면과 ERP 배포 연결을 확인하는 것이다. 세 제품 main/default trusted 활성화는 별도 운영 릴리즈 경계에서 진행하고, 공식 호환 보안 수정판·webhook 직접 registry 인수는 별도 잔여로 유지한다. 이번 develop 병합을 소비 도입 전체 완료로 취급하지 않는다.


#### staging 복구 진단 후속 (2026-10-08)

사용자가 다음 단계인 DriveTree staging 복구를 승인해 현재 API·실제 서비스 설정·계정 자격을 다시 확인했다. `/api/health`는 HTTP 404 `Application not found`다. live serviceInstance는 rootDirectory `/backend`·source null·활성 배포 0이고 develop→staging/main→production 트리거는 여전히 있다. Railway 계정은 INACTIVE·체험 남은 기간 0·체험 중 아님·활성 subscription 없음이다. [공식 안내](https://docs.railway.com/pricing/plans)의 활성 구독 요구와 함께 보면 현재 소스 재연결뿐 아니라 배포 자격 활성화도 선행 조건이다. 6월 배포 실패의 역사상 원인은 옛 build 로그 0줄로 미확인이며 계정 상태만으로 그 실패 원인을 소급 단정하지 않는다.

| 제품 | 검증한 앱 병합 SHA | 현재 복구 단계 | 선행 조건과 완료 한계 |
|---|---|---|---|
| DriveTree | `a355bd25166e285d899430464e5e311f37b55d5d` | 소스 연결 부재·배포 자격 비활성 확인; [제품 진단 기록 PR #87](https://github.com/grinvi04/drivertree/pull/87) | staging health404·실제 계산 FAIL 유지. 활성화 전 workspace/production 영향·무료 플랜 가능성·비용 확인과 사용자 선택 후 staging 단독 소스·DB 참조·고정 SHA 배포·정상/거부 기능을 검증해야 함. Railway/결제/DB/보호 변경 0; 운영 복구 완료 아님 |

재개 계약은 제품 `docs/specs/quality-remediation.md`가 소유하며 원문·schema·진단/수용 계획은 `$HOME/Documents/Codex/2026-10-08/drivetree-staging-recovery/`에 보존한다. 직접 환경 변경의 의미를 확인하기 전 `serviceInstanceUpdate`의 experimental 다중 환경 경로를 실행하지 않는다. 구독 변경·결제는 사용자 작업이고 workspace-wide 재시작 영향이 있을 수 있어 production 제외 경계를 먼저 재확인해야 한다. 코드 없는 진단 기록만 전달하며 공용 Harness 기능·버전·검사 기준은 바꾸지 않는다. 로컬 QA를 선택해도 원격 staging 복구 PASS로 쓰지 않는다.

다음 단계는 활성화 전에 workspace/production 영향·무료 플랜 가능성·비용을 확인하고 사용자가 선택하는 것이다. 활성화·결제는 미승인·미실행이며, 사용자 활성화 이후 배포 자격을 다시 읽는다. Vercel 인증·나머지 소비 잔여·운영 배포 제외는 유지한다. 현재 복구는 차단 상태이며 진단 기록 전달·정리와 서비스 복구 완료를 구분한다.


#### 비용·테스트 환경 결정과 인증된 미리보기 관찰 (2026-10-08)

현재 사용자 결정이 위 조건부 재개 계획보다 우선한다. DriveTree는 무료 tier 소진에 따른 추가 결제·Railway 활성화를 하지 않기로 해 원격 staging 복구를 보류했다. 기존 source null·활성 배포 0·health404는 복구하지 않았으며 역사상 6월 실패 원인은 미확인이다. 다른 호스팅·계정·플랜 변경도 승인된 것으로 간주하지 않는다.

기존 Chrome의 Vercel 로그인이 현재 유효해 siku 앱 병합 후보의 미리보기로 접근했다. 페이지는 흰색·DOM 비어 있음이고 콘솔은 Supabase URL/공개 키 누락을 명시했다. Vercel에서 `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY`는 Production에만 있고 Shared 변수 연결도 없다. 값을 표시·복사하지 않았다. 사용자는 별도 Supabase 테스트 프로젝트가 없으므로 원격 검증 보류를 선택했다. 운영 변수를 Preview에 복사하거나 원격 DB/Auth/Storage·재배포를 실행하지 않는다.

| 제품 | 검증한 앱 병합 SHA | 현재 인수 단계 | 선행 조건과 완료 한계 |
|---|---|---|---|
| DriveTree | `a355bd25166e285d899430464e5e311f37b55d5d` | 사용자 추가 결제·활성화 거절로 staging 복구 보류 | health404·연결 기능 FAIL 유지. 명시적 재개 결정 없이는 활성화·대체 호스팅·운영 변경 없음 |
| siku | `92a929810c636aaec2670028a31566b50081811b` | 배포 #6917504540 [고정 미리보기](https://siku-8cjueeozm-grinvi04-2237s-projects.vercel.app) 인증 접근; Supabase build-time 변수 누락으로 흰 화면 FAIL | 별도 테스트 프로젝트 없음·사용자 원격 검증 보류. 로컬 QA86/25 유지; Production 변수 복사·DB/Auth/Storage·재배포 변경 없음 |
| ERP | `9acfb7600c2f2e3abfaf6886211a6fd20e0fe4cc` | 현재 Vercel workspace `grinvi04-2237s-projects`의 ERP 검색 No Results Found; 현재 README는 운영 미배포·로컬 풀스택 | 현재 작업 공간 연결 미확인이고 모든 계정/공급자 부재를 증명하지 않음. 배포 가이드는 계획이며 새 프로젝트·Railway 활성화·운영 배포를 실행하지 않음. 원격 앱 QA UNVERIFIED |

비용 없는 보안 재확인은 DriveTree frontend 전체 high5/운영0, backend 전체 moderate20/운영0, ERP develop frontend 전체 high9/운영high7로 판정 변화가 없었다. 현재 병합 후보 잠금파일 복사본으로 audit 6개를 실행해 각 명령·cwd·SHA·exit·원문을 보존했다. braces3.0.3·sprintf-js1.1.3 advisory의 공식 수정판은 없고 braces PR78은 미병합이다. ERP `shadcn/tailwind.css` 실제 import를 확인해 경고 숫자를 위한 단순 삭제/dev 이동·강제 downgrade는 하지 않았다. 전체 보안 FAIL과 기존 보완의 한계를 유지하며 실제 배포 안전을 잠금파일 감사로 대체하지 않는다.

제품 미리보기 판정은 siku `docs/specs/quality-remediation.md` §9가 소유한다. 원문은 `$HOME/Documents/Codex/2026-10-08/preview-environment-verification/`, 보안 원문은 `no-cost-security-followup/`, 현재 결정은 이슈 #496과 지도에 연결한다. ERP 문서는 이미 운영 미배포·계획을 구분하므로 제품 파일을 변경하지 않고 이 소비 관찰만 연결했다. 앱·공용 Harness 기능·버전·검사 기준 변경은 없다.

승인된 이번 범위의 확인·기록 전달·소유 임시 worktree 정리를 끝낸 뒤, 새 환경·수정판·재개 결정이 없는 같은 실패를 반복하지 않는다. 세 제품 main/default trusted 전환·운영 인수와 webhook 직접 registry/실 IdP 잔여는 별도 실행 조건으로 유지한다. 보류는 제품 품질·클라우드 복구 완료가 아니며 소비 도입 전체 완료로 표시하지 않는다.

#### 배포 제외 범위의 최종 인수 (2026-10-08)

사용자는 배포 환경이 구성될 때 배포하기로 하고 이번 완료 범위에서 배포·원격 환경 기능 인수를 제외했다. 현재 단계는 **Harness QA 보강과 네 제품의 선정 로컬 QA·develop 필수 CI·독립 검토 적용 검증**이다. 위의 원래 ‘제품별 단계 종료’ 조건은 유지한다. DriveTree·siku·ERP의 trusted workflow 실제 원격 실행과 보호 readback은 별도 필수 전환이며, 배포 제외만으로 완료 처리하지 않는다. main 반영·자동 배포와 연결된 전환은 재개 조건을 마련한 다음 수행한다. 이슈 #496은 전체 소비 도입 후속을 위해 열어 둔다.

현재 대조 후보는 DriveTree `ff5f26f120ad4bb5629cc371839ff69edea544cc`, siku `2476e1754c4e2fcf2e53ce749f3464cd8228ea74`, ERP `origin/develop`의 `c8cb9056265c8f21c8e8ddb5f6f3c05cc194b445`, webhook `e1eee56e101be3fc61526430599773116cd95797`이다. DriveTree 기록의 최신 구간별 지문을 합쳐 비교한 18개 앱·설정·시험 입력은 일치하고 차이는 후속 QA 문서뿐이다. siku 101개 입력 중 차이는 이후 필수 CI를 통과한 commitlint 정본 동기화뿐이다. ERP braces 검증의 10개 입력과 보존된 원문 72개는 일치한다. 이를 ERP 백엔드 전체의 새 실행으로 확대하지 않으며 기존 Java·권한·DB 검증과 후보 변경 범위를 함께 대조했다.

DriveTree inline 원문은 경로 치환을 복원한 33개 SHA-256이 모두 일치한다. 최초 직접 비교의 경로 치환 차이도 보존했다. siku 명령 원문 9개 지문은 모두 일치한다. webhook 독립 검토는 실제 SDK 검증 호출, 관리자 UI/replay 역할 소비와 Redis GETDEL 경계를 현재 소스에서 확인했고, 필수 runtime/dev dependency audit 0의 기존 원문도 대조했다. 원문·입력 비교는 `$HOME/Documents/Codex/2026-10-08/non-deployment-final-acceptance/`에 보존한다. 입력이 유지된 시험을 절차 충족 목적으로 다시 실행하지 않았으며 독립 검토도 재실행이 아닌 원본·소비 경계 대조다.

이 좁은 범위에서 새 P1/P2나 필수 로컬 검증 공백은 발견하지 못했다. 선정 로컬 QA, develop 고정 후보의 필수 CI와 독립 검토 적용 인수는 완료다. 이는 모든 사용 사례의 보장이나 전체 소비 도입·보안·출시 준비 완료가 아니다. DriveTree 전체 감사 frontend high5/backend moderate20, ERP 전체 high9/운영 high7의 **FAIL은 유지**한다. 원래 로컬 QA 필수 표에 전체 npm audit 0을 소급 추가하거나 감사 실패를 PASS로 바꾸지 않는다. 확인한 보완은 해당 입력·깊이 경계에서만 유효하고 다른 공격 표면을 보장하지 않는다.

다음 행동은 공식 의존성 수정판·새 재현 증거가 나오면 관련 보완과 감사·회귀 시험을 다시 대조하는 것이다. trusted 전환은 배포를 유발하지 않는 승인된 실행 조건과 정확 후보가 마련되면 실제 target 이벤트·보호 readback으로 인수한다. 원격 앱 인수는 별도 안전한 테스트 환경과 재개 결정이 있을 때 진행한다. 운영 키 복사·새 유료 환경·기준 완화는 하지 않는다. 소비 제품의 과거 QA 문서는 당시 후보·실패·한계를 이미 구분하므로 변경하지 않고, 이번 공통 완료 범위 결정은 이 문서와 제품 방향 문서에 연결한다.

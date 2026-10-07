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

모든 로컬 HEAD는 원격 develop과 달랐다. ERP 로컬에는 진행 중 feature 브랜치와 기존 미추적
`.codex/`가 있었으며 읽지 않거나 변경하지 않았다. 로컬 checkout을 pull/reset하지 않고 별도
archive에서 현재 원격 소스를 읽었다. archive에 Git metadata가 없으므로 clean worktree로
칭하지 않는다. 아래 원격 SHA와 공식 tree/blob 대조가 원본 식별 근거다.

| 프로젝트 | 로컬 HEAD / 로컬 MISSING | 원격 develop / 원격 OK·MISSING | 실제 남은 차이 |
|---|---|---|---|
| erp | `085d0ce` / 4 (+WARN 1) | `d10a9164f1f440a26e4ea42c4cd6f7736c6eed15` / 20·1 | 기존 commitlint workflow가 신뢰 원본 방식 정본과 불일치 |
| siku | `08cad8f` / 11 | `c7b5bbdbbc8523cbe34189aae65f605801b4a2ce` / 13·3 | commitlint workflow·config·validator 정본 불일치 |
| webhook-service | `20669ab` / 11 | `83cd3989298636436ad1f26e734d0678f88d7440` / 17·1 | 기존 commitlint workflow 정본 불일치 |
| DriveTree | `ab86d13` / 3 | `bd634e62b2902cbd843a2d9bac9766464d06f9b6` / 17·1 | 기존 commitlint workflow 정본 불일치 |

여기서 MISSING은 checker의 **현재 정본 계약 불일치**도 포함한다. 해당 파일이 없다는 뜻으로
보고하지 않는다. 최신 원격의 네 commitlint.yml과 config/validator 파일은 존재한다.
static checker가 OK인 자산도 전체 구현 정확성이나 실행된 차단 증거는 아니다.

main/develop 보호 기본 검사는 네 repo 모두 exit 0이다. 현재 develop context는 다음과 같다.
기본 검사는 보호 속성·검사 존재를 확인하며 새 표준과 exact-set 일치나 CI 실행 성공을 증명하지 않는다.

| 프로젝트 | 현재 develop 필수 context |
|---|---|
| erp | backend, frontend, secret-scan, test-guard, commitlint, migration-safety, e2e, repo-sync |
| siku | quality, secret-scan, test-guard, commitlint, repo-sync, destructive-ddl |
| webhook-service | alembic-heads, build-and-test, secret-scan, commitlint, destructive-ddl |
| DriveTree | Backend — lint · build · test; Frontend — lint · build · e2e; Vercel Preview Comments; secret-scan; commitlint; destructive-ddl |

ERP repo-sync는 v0.67.0 SHA를 사용하고 다른 셋은 mutable `main`을 조회한다. 향후 채택은 호환성을
검증한 정식 SHA로 고정하고, 업데이트 때 차이를 별도로 검토한다. 기존 pin을 지금 갱신하지 않았다.
네 repo의 Actions policies 조회는 total_count 0이다. 이는 적용 가능한 조직 정책·실제 이벤트
실행 성공이나 모든 정책 부재의 증명이 아니다. 공식 문서는 공개 target 이벤트 기본 정책의
현재 evaluate 상태와 **2026-11-02 강제 예정**을 구분한다.
[GitHub 공식 target 보안 안내](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target).

## 공통 적용 계획 — 아직 실행하지 않음

1. **제품 계약 연결:** 각 AGENTS의 기존 업무·도구 지침을 보존하고
   [QA 계약/Markdown 완료 기준](../../templates/AGENTS.md)의 최소 조항만 연결한다.
   각 제품의 기존 스펙에 요구→위험→필수 시험→기대값→실제 명령/cwd/후보/최초·최종 결과를 둔다.
   같은 테스트를 다시 만들거나 제품별 사례를 Harness 스킬에 삽입하지 않는다.
2. **오래된 문서 대조:** Proposed/미착수/결함 서술을 현재 코드·원본 CI·실행 증거와 대조한다.
   일부 구현이 있어도 전체 AC를 완료 표시하지 않는다. 과거 결과를 보존하고 현재 미확인/잔여를 연결한다.
3. **커밋 검사 단계 전환:** [기존 전환 계약](../specs/trusted-commitlint.md)을 재사용한다.
   기존 필수 commitlint를 유지하면서 별도 이름 commitlint-trusted를 추가하고, 기본 브랜치에 안전하게
   배치한 뒤 후속 실제 PR의 정확한 SHA에서 새 검사의 성공을 확인한다. develop 파일 존재나
   bootstrap PR의 기존 green은 활성화 증거가 아니다. 새 context를 먼저 추가하고 서버 readback 후
   기존 context를 제거한다. 기존 CI·앱 binding·strict·승인·관리자·force-push/삭제 보호는 보존한다.
   경로별 target 이벤트 정책, 기본 main 변경과 자동 게시/배포 영향은 별도 승인 범위를 확인한다.
   새 검사 실패·미실행 시 기존 gate를 유지하며 성공 상태를 수동 게시하거나 검사를 끄지 않는다.
4. **후보별 실행·인수:** 격리 환경을 준비한 뒤 기존 품질 명령과 아래 필수 관찰 경계를 실행한다.
   정상뿐 아니라 거부/실패/경계 사례의 기대 불변식을 대조하고, 미실행·flaky·재사용을 구분한다.
   모든 필수 PASS, 범위 내 차단 결함 0, 문서와 후보 일치, 동일 HEAD의 원격 gate/독립 검토를 함께 확인한다.

각 단계는 소비 프로젝트 변경 승인 뒤에만 실행한다. 설치와 source sync, 제품 QA, develop 병합,
main 배치, 실제 배포 완료를 별도로 판정한다. 조사 결과만으로 배포 승인을 추정하지 않는다.

## 프로젝트별 QA와 진입 조건

명령은 현재 원격 소스에서 확인한 **향후 격리 실행 계획**이며 이번에는 실행하지 않았다.
`format`/`lint --fix`처럼 수정하는 명령을 읽기 전용 확인에 쓰지 않는다. 운영 키·DB·identity·
메일/Storage 대신 분리된 합성 fixture를 사용한다. 최신 runtime 지원은 실행 직전에 제품 원본과 대조한다.

### DriveTree — 첫 적용 후보

Node >=22.12, NestJS/Prisma/Postgres 및 Next.js/React, Chromium 환경이 필요하다.
backend의 format:check·lint:check·build·test·test:e2e, frontend의 format:check·lint·
test:unit·build·test:e2e를 현재 CI와 맞춰 실행한다. Prisma generate/migrate는 격리 DB에서만 수행한다.
기존 `lint`는 --fix를 포함하므로 검사 목적은 lint:check를 사용한다.

- 필수 관찰: malformed 400/oversize 413/예상 밖 오류 500, 정상 생성, 실제 DB CRUD·soft-delete
  후 활성 조회 제외/행 보존, 챗/RAG 실패 시 계약된 폴백. 기대값은 기존 spec·assertions에서 연결한다.
- 근거: [4xx 처리](https://github.com/grinvi04/drivertree/blob/bd634e62b2902cbd843a2d9bac9766464d06f9b6/backend/src/common/all-exceptions.filter.ts#L15),
  [실제 DB 단언](https://github.com/grinvi04/drivertree/blob/bd634e62b2902cbd843a2d9bac9766464d06f9b6/backend/test/content-chat.integration.e2e-spec.ts#L50).
- 최소 문서 변경: AGENTS와 기존 quality-remediation 스펙의 후보/AC 상태 대조. ‘미착수’와 hard-delete
  결함 서술을 현재 단언만으로 일괄 완료 처리하지 않는다. 기존 테스트가 이미 검증하는 동작은 재구현하지 않는다.
- 완료 기준: 위 관찰을 동일 후보에서 실제 실행하고 현재/과거 상태를 분리, 보안 검사의 단계 전환까지
  원격 증거로 확인. 현재 앱 판정 UNVERIFIED다.

### webhook-service — 두 번째 후보, 게시 경계 선행

Python 3.11, PostgreSQL 15, Redis 7 및 테스트용 독립 환경이 필요하다. 현재 CI의 ruff check,
ruff format --check, mypy, Alembic 단일 head, pytest를 게시 job과 분리해 격리 환경에서 실행한다.
pytest 설정은 .env를 로드하므로 실행 전 시험 전용 값을 준비하고 기존 운영 환경을 상속하지 않는다.

- 필수 관찰: 실 계산 HMAC 정상/변조·누락 거부, 없는/비활성 테넌트, 중복 전달의 정상 수용,
  queue 실패 후 예약 키 해제/재시도, replay의 인증·권한·교차 tenant 거부, DB 실패 health 503.
  예약 해제의 기존 시험은 Redis/DB/queue 대역의 delete 호출 단언이다. 향후 실제 격리 Redis/DB에서
  키 해제와 후속 재시도 성공을 관찰해야 하며 기존 대역 단언을 실제 경계 PASS로 확대하지 않는다.
- 근거: [서명 거부](https://github.com/grinvi04/webhook-service/blob/83cd3989298636436ad1f26e734d0678f88d7440/tests/test_unit_signatures.py#L49),
  [대역 예약 해제 단언](https://github.com/grinvi04/webhook-service/blob/83cd3989298636436ad1f26e734d0678f88d7440/tests/test_idempotency.py#L48).
- 진입 차단: [.github/workflows/ci.yml](https://github.com/grinvi04/webhook-service/blob/83cd3989298636436ad1f26e734d0678f88d7440/.github/workflows/ci.yml#L93)는 PR/push main·develop의
  품질 job에 packages:write·조건 없는 push:true 이미지 게시가 연결돼 있다. 실제 게시 성공은 미확인이다.
  소비 PR/전체 CI를 만들기 전에 게시 분리/조건과 외부쓰기 승인 범위를 먼저 해결한다.
- 최소 문서 변경: AGENTS와 오래된 Proposed 스펙을 현재 HMAC·멱등·health 단언에 대조한다.
  GitHub body-only 서명 replay 같은 미결정 정책은 기대값을 선택한 뒤 시험한다. 합의 없는 동작 변경을 추가하지 않는다.

### siku — 세 번째 후보, DB/Storage 권한 경계

Node 22, 로컬 Supabase CLI/DB/Auth/Storage와 Docker, Chromium, 시험 전용 env가 필요하다.
현재 format:check·lint·test·build·test:e2e를 재사용한다. service role fixture는 격리
Supabase에서만 생성하고 권한 거부 관찰은 실제 소유자/타 멤버 세션으로 수행한다.

- 필수 관찰: 초대/가입·악성 next 거부, 정산 잔액/송금, 확정 후 비용 잠금/취소 후 복구,
  사진 업로드/조회/삭제와 DB 행·Storage 객체의 일치, 실패 시 보존.
- 근거: [정산 단언](https://github.com/grinvi04/siku/blob/c7b5bbdbbc8523cbe34189aae65f605801b4a2ce/tests/e2e/settle.spec.ts#L35),
  [사진 정상 흐름](https://github.com/grinvi04/siku/blob/c7b5bbdbbc8523cbe34189aae65f605801b4a2ce/tests/e2e/flows.spec.ts#L99).
- 타 멤버 사진 삭제의 권한/행-객체 일관성은 조사한 사례만으로 입증되지 않았다. 실제 RLS/Storage
  정책과 Proposed 스펙을 대조해 기대 허용·거부·부분 실패 상태를 정한 뒤 필요한 단언만 보완한다.
  현재 실행 결함으로 확정하지 않는다. 원격 운영 DB drift 측정은 이 읽기 전용 조사와 분리한다.
- 최소 변경: AGENTS·기존 스펙 현행화, commitlint 세 자산 연결, 확인된 공백에 한한 격리 권한 회귀.

### erp — 네 번째 후보, 실인증 UAT 안전 경계 선행

Java 21/Gradle/PostgreSQL 16와 Node 22/Next.js, 실제 시험용 Keycloak·Mailpit·프런트/백엔드가 필요하다.
backend ./gradlew check와 frontend type-check·format:check·lint·lint:design·test·build·
test:e2e를 기존 CI와 연결한다. auth-gate 스모크와 실인증 UAT는 관찰 범위가 다르다.

- 기존 [온보딩 계약](https://github.com/grinvi04/erp/blob/d10a9164f1f440a26e4ea42c4cd6f7736c6eed15/docs/specs/tenant-user-onboarding.md#L26)의
  초대/재초대·멱등·기존 identity 409 무변경·권한상승 403·tenant 불변·실패 보상·감사 readback을 재사용한다.
- 진입 차단: localhost-only 스펙과 달리 [UAT 스크립트](https://github.com/grinvi04/erp/blob/d10a9164f1f440a26e4ea42c4cd6f7736c6eed15/scripts/verify-user-onboarding.sh#L6)는 endpoint 환경변수 override를 허용하며 loopback 검사 근거가 없다.
  opt-in 플래그는 목적지 검증이 아니다. 합성 identity의 삭제/재생성도 있으므로 실행하지 않았다.
- 향후 최소 보완 후보: 모든 endpoint를 첫 인증/네트워크 요청 전에 loopback으로 검증하는 거부 회귀, 분리된 합성 데이터와
  원복 범위 확인. 운영/외부 주소 및 malformed 주소에서 인증정보 전송·외부 요청 0과 mutation 0,
  허용된 loopback에서 기존 결과 유지가
  사전 기준이다. 이 consumer 코드 변경은 아직 승인·구현하지 않았다.
- 기존 feature/미추적 작업을 덮어쓰지 않고 원격 고정 후보의 별도 작업 공간에서 인수한다.
  출시 체크리스트의 빈 증거 칸을 채운 적이 없으므로 출시/UAT PASS를 주장하지 않는다.

## 순서·종료 조건·다음 행동

공통 계약과 안전 진입 조건을 먼저 정리한 뒤 **DriveTree → webhook-service → siku → erp** 순서를
권고한다. 첫 후보는 정본 차이가 작고 현재 실DB 단언을 재사용할 수 있다. 다음 후보들은 게시·
Storage 권한·실인증 mutation 경계를 차례로 해결한다. 긴급 장애 우선순위의 판단이나 배포 일정은 아니다.

제품별 단계 종료는 ‘파일 복사/설치’가 아니라 다음을 함께 만족해야 한다.

- 선정한 필수 정상·거부·실패·경계의 기대 불변식이 실제 API/DB/권한 소비자까지 PASS.
- 같은 후보의 필수 lint/test/build/브라우저/실인증 범위와 required CI가 PASS; 미실행·미해결 flaky는 완료 금지.
- 범위 내 차단 결함 0, 이전 작업/데이터 보존, 관련 스펙·체크리스트의 상태/다음 행동 현행화.
- 신뢰 원본 workflow의 실제 실행 및 원격 보호 readback. 독립 검토, 배포 승인·환경 증거는 해당 단계에서 별도 확인.

이번 작업의 종료는 **읽기 전용 조사·계획·Harness 기록 인수**다. 소비 적용/전체 앱 품질은 아직 완료가
아니다. 후속은 첫 소비 프로젝트의 변경·격리 실행 권한을 정하는 것이며, main/default 배치와 게시·
배포는 그 영향이 확인된 별도 범위다. braces 보완 제거와 split runtime WAIT는 이 계획과 독립이다.

## 문서 선언

### 후속: DriveTree 로컬 계약·QA 준비

위 표는 읽기 전용 조사 당시의 후보/결과로 보존한다. 이후 사용자 진행 승인으로 DriveTree의
QA·문서 계약 연결과 격리 시험을 진행했다. 제품 로컬 커밋 `b5fd437`(기준 `bd634e6`)에
AGENTS·기존 quality-remediation 스펙·실행 원문/지문 JSON과 새 trusted workflow,
실제 HTTP parser 회귀 4개·검색 출처 응답/DB 긍정 단언을 보존했다. runtime/schema/lock은 변경하지 않았다.

양쪽 format/lint/build와 backend 단위 70·실DB 통합 17, frontend 단위 8·Chromium 20이 PASS다.
DB는 새 pgvector/pg16 container의 loopback 전용 합성 fixture이며 운영 DB/키를 사용하지 않았다.
검색이 빈 배열인 반례를 새 단언이 검출하고 원본 복구 후 통합 검사를 다시 통과했다.
독립 검토의 검색 긍정 단언 공백은 보완 후 재검토에서 해소됐고 추가 P1/P2 finding은 없었다.
로컬 정본 자산 점검은 18/18 PASS이나 이는 신뢰 target 이벤트의 원격 실행 증거가 아니다.

보안 감사는 전체 backend 28·frontend 20이며 운영 의존성에도 각각 critical 1건이 남는다
(`proxy-addr`, `next`; 실제 악용 가능성은 미확인). 전체 보안/배포 준비는 FAIL이다.
원격 CI/PR·병합·main/default 배치·required context 변경·배포는 아직 실행하지 않았다.
develop 병합은 staging 자동 배포에 연결되므로 로컬 준비 완료를 배포 승인으로 확대하지 않는다.
후속 상태와 제품 기록·현재 후보 인계는 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)을 따른다.
다른 소비 프로젝트는 이 최초 후보 후속에서는 변경하지 않았다. 최신 승인·진행은 다음 절을 따른다.

### 후속: 네 소비 프로젝트의 로컬 적용 진행

사용자가 네 소비 프로젝트 모두의 진행을 승인했다. 위 조사 당시의 보류 상태를 보존하며,
현재 범위는 제품별 최소 계약·보안 보완, 격리 fixture QA, 관련 문서 현행화와 로컬 후보 보존이다.
원격 전달·main/default 검사 활성화·보호 정책 변경·운영/staging 배포의 완료로 확대하지 않는다.

아래는 최초 조사나 첫 DriveTree 후보와 구분한 **현재 로컬 후보**다. 제품별 실사용 사례는 제품 저장소에 두고 공통 Harness의 QA 계약만 연결했다. 이전 실패·미실행 결과는 제품 증거에서 보존한다.

| 제품 | 현재 로컬 후보 | 실제 로컬 검증 | 보안·검토 상태 / 한계 |
|---|---|---|---|
| DriveTree | `907ea04` | Swagger YAML·Prisma 내부 보완 유지. backend 단위 70·새 DB 통합 19/migrate 3와 frontend Chromium 20은 이전 동일 앱 입력 증거 재사용. 새 braces PR #78 고정 보완·클린 npm ci 6파일 적용·보안 10·형식/lint PASS. frontend 단위 8·build는 40ffba2 원문 재사용 | 새 설치기 후보 독립 검토 기존 P2 해소·추가 P1/P2 없음. braces source 6·설치 6·원문 34개 지문 일치, 앞선 Prisma 연구/QA 기록 보존. 전체 감사 backend moderate 20/high 0·frontend high 5 FAIL; 운영 backend 0·frontend 0. 원격 CI·병합·배포 미실행 |
| siku | `b6ed228` (코드 `5ad8a96`) | 클린 설치·형식·lint·build, 단위 86·실제 Auth/RLS/Storage 브라우저 25 PASS, 재시도 0, 전체 감사 0 | 코드·문서 독립 검토 기존 P2 해소·추가 P1/P2 없음. 권한 없는 0행 삭제 뒤 파일 보존, DB 삭제 뒤 Storage 실패의 함수·UI 부분 실패 처리 확인. 원격 DB 드리프트 미측정·DB/Storage 원자성 보장 안 함 |
| ERP | `7a13802` (보완 코드 `18b18a06`, 기존 기반 `b3fbfb36`) | braces 보안 회귀 11·FE 단위 60·Chromium 38(재시도 0), 타입/포맷/린트/디자인/빌드·CLI help·Docker deps/full PASS. CSS 2개·로그인 desktop/mobile·합성 인증 shell PNG 동일. Java 957·실 Keycloak은 backend 입력 불변으로 이전 증거 재사용 | 고정 후보 독립 검토 추가 P1/P2 없음. 합성 세션·backend 미기동 브라우저 smoke와 실제 HTTP BFF 세션 경계만 이번 실행. 전체 high 9/운영 high 7 FAIL·원격 보류 |
| webhook-service | `c4214248` (develop merge; PR head `aee5ccf`, 동일 앱 입력 `ef6585a`) | python-keycloak 7.1.1·공유 JWK decode·RS256/엄격한 만료/exp 필수·승인된 admin 역할 유지. 새 Python 환경 전체 110·집중 31, Ruff format/lint·mypy·Alembic 단일 head·pre-commit PASS. 별도 Keycloak 22.0.5·Chrome의 실제 로그인/코드 교환/callback·admin 허용/viewer 거부 PASS | 코드·문서 고정 후보 독립 검토 추가 P1/P2 없음. product source 20·설치/probe source 6·원문 93개 지문 일치. 전체 해석 runtime 74개 패키지·dev 포함 91개 pin graph 감사 각각 0. PR #71 필수 원격 CI/독립 검토·develop 병합 확인. 운영 realm issuer/audience·키 회전·main/default 검사 전환·배포 미확인 |

DriveTree의 최초 증분 lock 설치 실패와 클린 lock 복구, siku의 공식 CLI 서명/바인딩 차단·저장소 xattr 실패·PNG fixture 거부, ERP의 초기 포트 바인딩 문제·curlrc 반례·재사용 시험 DB 잔여 데이터로 인한 Java 2 FAIL(새 전용 DB에서 957 PASS), webhook의 최초 훅 환경 실패는 성공으로 덮어쓰지 않는다. 추가 커밋 훅의 잘못된 DB 사용자명에 의한 76 PASS·2 인증 오류는 보고를 보존했으나 전체 stdout 원문은 미보존이라는 한계도 명시했다. 올바른 전용 설정의 직접 driver 연결·최종 전체 훅은 새 원문으로 확인한다. 실제 실패 원인을 바꾼 재시도만 진행했다. OS 보안·전역 Docker 설정·RLS·기존 CI gate를 완화하지 않았다.

ERP는 원래 feature checkout과 기존 미추적 작업을 그대로 보존한 별도 worktree다. 모든 실서비스 시험은 새 합성 자격증명·데이터를 사용했으며 실제 공개 포트의 loopback 바인딩을 확인하고 사용한 전용 서비스의 중지를 확인했다. 제품 증거의 관찰 경계를 넘어 외부 인증·모든 업무 API·운영 데이터의 품질을 보장하지 않는다.

webhook의 이전 60/69/77 시험은 명시 주입한 로컬 DB/큐 실행 결과이며 기존 `.env`의 자동 로딩 차단 증거로 쓰지 않는다. 78개 후보에서 Pydantic 최초 import 전 차단과 합성 provider 회귀는 확인했으나 pytest-dotenv의 선행 로딩은 차단하지 못했다. 최종 `5fd2213`에서 초기 플러그인 로딩도 차단하고, 설치된 플러그인을 사용하는 실제 시작 회귀의 RED→GREEN과 전체 79 PASS를 확인했다. 앞선 자동 읽기 차단 주장은 제품 기록에서 철회·한계로 보존했다. 운영 설정 파일을 직접 조회하거나 제품 설정의 기본 동작을 바꾸지 않았다.

현재 증거 정본은 각 제품의 `docs/specs/quality-remediation.md`(siku/DriveTree), ERP의 `docs/specs/tenant-user-onboarding.md`와 외부 QA manifest, webhook의 `docs/qa/2026-10-07/README.md`와 해당 실행 manifest다. 선정한 로컬 QA·독립 검토·감사 FAIL·원격 gate 상태를 각각 기록한다. 새 trusted 파일 존재는 target 이벤트 실행/보호 강제의 증거가 아니다.

ERP 새 Java 원문·XML 172개/957 PASS와 siku 최종 기록의 독립 대조에서 추가 P1/P2 없음과 지문 일치를 확인했다. 네 고정 로컬 후보의 선정한 기능·회귀 검증과 독립 검토 인수는 마쳤다. 이후 Swagger YAML·관리자 인증 보완도 아래 기록의 고정 후보에서 인수했다. 최신 Prisma 내부 의존성 후보의 QA·독립 검토도 아래 기록에서 인수했다. 그 로컬 인수 시점의 다음 단계는 보류한 Vercel 확인과 정확 후보의 원격 전달·trusted 검사 초기 배치 조건 해결이었다. 현재 원격 인수와 다음 행동은 맨 아래 소비 원격 전달 후속을 따른다. 최신 로컬 보완·검증 결과는 아래 후속 기록을 따른다. main/default 배치·검사 전환·배포는 별도 단계다. 전체 소비 도입/보안/배포 준비는 아직 **NOT VERIFIED**이며 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)은 열어 둔다.

### 후속: 보안 잔여와 원격 전달 조건 조사

2026-10-07 사용자 진행 승인으로 현재 lock·공식 registry/advisory·GitHub 브랜치 보호·workflow와 최근 deployment 기록을 읽기 전용으로 대조했다. 조사 자체를 제품 적용·설치 또는 제품 실경로 악용 검증이나 새 후보의 원격 CI 통과 판정으로 취급하지 않는다. 이후 적용한 고정 후보의 로컬 결과는 위 표와 다음 기록에 구분한다.

- **DriveTree 최소 후보:** Swagger 11.4.7의 정확 pin인 `js-yaml 5.3.0`은 [merge 예산 우회](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm)에 해당한다. 공식 수정은 5.4.1 이상이며 registry의 5.4.3을 별도 임시 디렉터리에 scripts 비활성으로 설치해 합성 OpenAPI 객체 dump/load 왕복과 merge 예산 10/빈 source 11개를 시험했다. 현재 5.3.0은 예산 초과를 허용(RED), 5.4.3은 거부(GREEN), 정상 왕복은 양쪽 PASS다. 원문은 `/tmp/drivetree-yaml-compat-vLNpXM/yaml-compat.log`이며 이 라이브러리 조사 단계에서는 제품 파일/lock을 변경하지 않았다. 이 표본은 Swagger·제품 전체 호환성을 증명하지 않는다. 실행은 해당 임시 cwd의 Node stdin 검사(exit 0)이며 원문 SHA-256 `d9a14eb962fcd4bb542495b2f0e1fd10d5b5533214a96a4a4aabf6cb688ef1ab`다. 원문은 다음에 보존한다. 후속 제품 후보 `8c5b4f8`에서는 Swagger 아래에만 override를 적용했다. 실제 API 문서 JSON/YAML 생성·조회와 예산 초과 거부 RED→GREEN, backend 단위 70·실DB e2e 19, 클린 lock 설치·format/lint/build를 통과했다. 초기 증분 lock 설치 실패도 보존했다. 독립 검토에서 source 4·원문 18개 지문과 loopback fixture 종료를 확인했고 추가 P1/P2는 없었다. 전체 audit 24건·운영 high 4건은 FAIL이며 frontend 8+20은 이전 증거 재사용이다.
```json
{
  "old": "5.3.0",
  "candidate": "5.4.3",
  "validRoundTrip": "PASS",
  "oldExceedsBudget": "accepted RED",
  "patchedExceedsBudget": "rejected GREEN",
  "scope": "library-only synthetic, no Swagger/app/full QA"
}
```

- **DriveTree 다른 전이:** 현재 Prisma 7.10.0은 mysql2 3.15.3, @prisma/config는 deepmerge-ts 7.1.5를 고정한다. registry의 최신 config 7.10.0도 동일 pin이다. [deepmerge-ts 수정](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)은 8.0.0부터이며 [상위 이슈](https://github.com/prisma/orm/issues/30052)의 override 제안은 소비자 보고이지 upstream 호환성 보증이 아니다. Map 병합 의미 변경을 포함하므로 config·validate·generate·새 격리 DB migrate deploy·실제 ORM 흐름 회귀가 필요하다. mysql2의 [인증 downgrade](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr)·[압축 해제 위험](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3)은 별도 제약이다. 실제 제품은 PostgreSQL이며 MySQL 실행 경계의 도달성은 미확인이다. Prisma 6으로 내려 audit만 통과시키지 않는다.
- **공식 수정판 없는 항목:** registry의 braces는 3.0.3, sprintf-js는 1.1.3이다. [braces 이슈](https://github.com/micromatch/braces/issues/73)·[보완 PR #78](https://github.com/micromatch/braces/pull/78), [sprintf-js advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)를 근거로 upstream release 대기와 소비자 별도 보완을 구분한다. 샘플 patch를 자동 복사하거나 구버전 도구로 내려가지 않는다. 개별 patch를 채택하면 설치 후 검증·반례·원래 tool 동작·제거 조건을 제품 스펙에 연결해야 하며 audit 경고가 자동으로 사라지는 것은 아니다.

| 제품 | 이 조사 당시 읽기 전용 원격 확인 | 전달·병합 영향과 미확인 |
|---|---|---|
| DriveTree | default main, develop `bd634e6`, main `49621e6`; strict/app-bound 필수 context develop 6개·main 5개, enforce_admins true | 현재 후보의 원격 CI는 미실행. develop의 Vercel Preview 배포 기록 확인. 저장소 CI/규약은 develop→Railway staging, main→Railway/Vercel production을 명시하지만 당시 Railway 연결 상태는 미조회; 후속 metadata 조회 결과와 남은 미확인은 아래 참조. fix/feature의 CI-only 주석만으로 외부 Preview 배포 없음으로 확정하지 않음 |
| siku | default main, develop `c7b5bbd`, main `351ec7d`; 양쪽 strict/app-bound 필수 context 6개, enforce_admins true | CI는 PR에서 합성 Supabase·브라우저 흐름 실행. develop SHA의 Vercel Preview와 main SHA의 Production 배포 기록 확인. 새 후보의 Preview/원격 CI는 미실행이며 Supabase 원격 DB 드리프트 미측정 |
| ERP | default main, develop `d10a916`, main `8d83be6`; 양쪽 strict/app-bound 필수 context 8개, enforce_admins true, HARNESS_SYNC_ENABLED=true | Actions에 push/deploy/publish trigger 없음. 문서상 main→Railway/Vercel 재배포는 연결 활성 시 조건부이며 README local-only·deployment API 0과 구분. 외부 제어판 상태 미확인. develop PR은 기존 품질/repo-sync 검사, Preview 가능성은 별도 확인 |
| webhook-service | default main, develop `83cd398`, main `b905198`; 양쪽 strict/app-bound 필수 context 5개, enforce_admins true | build-and-test·alembic-heads·secret-scan 등 품질 후 main push에서만 GHCR latest 이미지 게시. develop PR/merge를 운영 서버 배포 완료로 간주하지 않으며 이미지 게시 후 소비 서버 갱신 연결은 미확인 |

ERP high 9건은 전부 braces에 연결되며 운영 그래프에도 high 7건이 남는다. shadcn 4.21.3의 CSS·registry·ts-morph 경로와 Next ESLint 경로를 확인했다. registry 최신 버전에도 전체 해소 경로가 없다. 강제 shadcn 1/Next ESLint 14 전환은 `shadcn/tailwind.css` export와 ESLint 9 계약을 깨뜨려 적용하지 않는다. 배포 standalone에 해당 디렉터리가 없다는 관찰은 전체 운영 안전의 증명이 아니다. zero-high가 필수면 CSS/CLI·lint 도구 교체 또는 소비자 보완을 별도 설계하고 시각·BFF·품질·클린 설치 회귀를 수행해야 한다.

webhook의 urllib3 1.26.20은 python-keycloak 2.0.0 제약으로 묶이며, 2.16.6 후보의 urllib3 2.8.0 해석 성공과 pkg_resources import 실패는 기존 기록을 보존한다. setuptools 호환 pin을 동반한 2.x 후보는 urllib3 경로만 개선하는 별도 시험 대안이며 전체 보안 해소가 아니다. [python-jose <=3.5.0](https://github.com/advisories/GHSA-3qf3-8w2g-rqmx)·[python-ecdsa](https://github.com/tlsfuzzer/python-ecdsa/security/advisories/GHSA-wj6h-64fc-37mp)는 공식 수정판 없음/라이브러리 보안 한계와 실제 호출 도달성을 구분한다. 현 SDK의 decode 기본 algorithms는 RS256으로 제한되어 있지만 외부 realm·키·issuer/audience·rotation 결과는 미확인이다. jwcrypto를 쓰는 상위 major 전환은 token decode·키 형식·클레임 검증 의미를 별도로 시험해야 하며 이번 로그인 수선에서 임의 전환하지 않는다. webhook에서는 실제 SDK에 없는 토큰 교환 메서드, 중복 realm URL, callback 이름·SQLAdmin mount 순서와 GET 로그인 연결을 고쳤다. API/UI의 공유 공개키를 PEM으로 정규화하고 실제 SDK의 자체 RSA 토큰 검증을 확인했다. 앞선 `5fd2213`의 79 PASS는 관리자 로그인 수용 흐름을 포함하지 않았으며 인증 전체의 증거로 확대하지 않는다. 사용자는 관리자 UI도 `realm_access.roles`의 `admin` 보유자만 허용하도록 명시 승인했다. UI와 기존 Replay 역할 검사는 정확한 목록 형식만 허용하고 잘못된 형식도 거부한다. OAuth state는 브라우저 세션 결박·5분 만료와 Redis 예약/원자적 `GETDEL`로 코드 교환 전에 일회 소비한다. 이전 서명 쿠키 재생·다른 브라우저·누락/불일치/만료·경쟁 소비·Redis 오류를 시험했다. callback 토큰 교환 뒤 보호된 UI 경로에서 역할을 검사한다. 새 로컬 후보 `eba4bfb`의 focused 25·전체 기존/새 환경 각각 104 PASS, Ruff format/lint·mypy·Alembic 단일 head·pre-commit PASS와 fixture 종료와 고정 후보 독립 검토 추가 P1/P2 없음을 확인했다. callback 흐름의 Redis는 대역이며 실제 Redis는 동시 `GETDEL` 단일 소비를 별도로 검증했다. 이는 자체 RSA·합성 HTTP·실제 격리 Redis/DB에 한정하며 외부 realm·redirect·issuer/audience·키 회전·실제 브라우저 상호 운용성은 미확인이다.


네 소비 repo의 원격 main/develop에는 새 `commitlint-trusted.yml`이 모두 없어 최초 PR의 신뢰 검사 실행을 완료로 간주할 수 없다. 기존 required `commitlint`는 유지되지만 PR 쪽 validator를 실행하는 한계가 있다. [기존 전환 순서](../specs/trusted-commitlint.md)에 따라 기본 브랜치 정본 배치, 이후 새 PR 이벤트의 동일 후보 신뢰 context 실행, 서버 필수 목록 추가/readback, 기존 context 제거 순서를 구분한다. 기본 브랜치 배치 자체의 자동 배포 영향도 먼저 확인해야 한다. 파일 존재·기존 commitlint green·로컬 repo-sync PASS는 이 활성화의 증거가 아니다.

[GitHub 공식 정책 안내](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)는 public repo의 기본 pull_request_target 정책이 현재 evaluate 모드이며 해당 대상에서 2026-11-02 집행 전환을 예고한다. 이미 적용한 별도 정책의 예외가 있어 네 repo가 모두 차단된다고 단정하지 않는다. 전달 전에 실제 Actions event policy·권한·target 실행 가능성을 읽기 전용 확인해야 한다. 정책을 자동 완화하거나 PR 코드를 높은 권한으로 실행하도록 전환하지 않는다.

#### 잔여 의존성의 격리 후보 비교 (2026-10-07)

DriveTree의 Prisma 7.10.0을 유지한 합성 복사본에서 `@prisma/config` 아래 deepmerge-ts 8.0.0과 `prisma` 아래 mysql2 3.23.1만 교체했다. 현재 `prisma.config.ts`는 문자열 설정이며 Map을 쓰지 않는다. v8 Map 병합 의미 변경은 별도 표본으로 보존했다. 클린 설치·Prisma validate/generate는 합성 URL과 dotenv 비활성 조건에서 통과했고 DB 연결은 하지 않았다. scratch lock 감사는 backend 전체 24→20(moderate), 운영 high 4→0이다. 이는 제품 인수 PASS가 아니다. 후속 제품 후보 `0a654e0`에 최소 변경을 적용하고 클린 설치·실제 resolve·validate/generate·backend 품질·단위 70·새 격리 DB migrate 3/실DB e2e 19를 통과했다. source 12·원문 21개 지문을 대조했고 fixture 종료를 확인했다. 제품 운영 감사 0·전체 개발 도구 moderate 20 FAIL이며 고정 후보 독립 검토에서 추가 P1/P2 없음과 원문 지문 일치를 확인했다. MySQL 연결과 Map 설정의 호환성은 이 제품 PostgreSQL 검증의 범위 밖이다. frontend braces와 backend dev sprintf-js의 경고는 이 변경으로 해소되지 않는다.

webhook의 두 SDK 대안도 제품 `eba4bfb`를 바꾸지 않고 scratch 환경에서 비교했다. 2.16.6 + setuptools 80.10.2는 해석/import와 서비스 비의존 인증 시험 24개를 통과하지만 setuptools의 새 보안 경고를 도입해 권고하지 않는다. 3.9.1은 jwcrypto로 바뀌며 현재 호출 옵션을 유지하면 **만료된 유효 서명 토큰을 거부하지 않는 회귀**가 발생했다. 시험 보조 패키지 누락의 최초 collection 오류와 실제 만료 검증 RED를 구분해 보존한다. 현재 SDK 의존성을 무조건 올리는 대신 키 형식·클레임/만료·issuer/audience·회전 계약을 명시한 별도 전환이 필요하다. 10초 만료 표본은 jwcrypto의 60초 허용 오차와 혼동할 수 있어 별도 동일 RSA/옵션 probe로 exp -120/-10/+300을 비교했다. 2.0.0은 두 만료값을 거부하고 미래값을 허용했지만 3.9.1은 모두 허용했다. 설치 SDK의 `check_claims={}`와 jwcrypto의 `check_claims is None` 조건을 원본에서 대조해 허용 오차 밖 만료 거부 실패를 확인했다. 3.9.1 runtime 감사 0건과 인증 시험 FAIL은 별도 판정이다. 비교 후보의 만료 수용은 독립 검토에서 P1로 판정되어 채택하지 않는다. 이 비교 당시 제품 `eba4bfb`는 변경 없는 clean 상태였다. 소스 13·원문 25·설치 SDK 소스 3개 지문은 독립 대조에서 모두 일치했다. 2.16.6 후보의 runtime 감사는 ecdsa/jose/setuptools 3개 패키지·5개 중복 포함 항목 FAIL이다. 이 비교를 제품 전체 QA 또는 실제 Keycloak 연동으로 확대하지 않는다.


격리 비교 근거: `/tmp/drivetree-prisma-compat-20261007/research.json`, 소스 6·원문 24, SHA-256 `373247c95be2ea8f9720518cbebca6c814006e6fa6f417b706d958c9ee956cd8`. 명령·cwd·종료와 원문 지문을 해당 기록에 보존한다.


격리 비교 근거: `/tmp/webhook-keycloak216-compare-20261007/manifest.json`, 소스 13·원문 25·설치 SDK 소스 3, SHA-256 `0200302fa63cf5047d312e916e8b88fbd7c612deef05529469ad15df297dc72e`. 명령·cwd·종료와 원문 지문을 해당 기록에 보존한다.

#### 전달 조건의 추가 확인 (2026-10-07)

공식 [Actions policy GET API](https://docs.github.com/en/rest/actions/policies#list-repository-actions-policies)에 API 버전 `2026-03-10`, `has_parents=true`를 지정했다. 네 repo 모두 HTTP 성공·`total_count:0`, workflow 기본 권한 `read`·자기 PR 승인 `false`다. 이는 명시 정책 목록의 관찰이며 플랫폼 기본 `pull_request_target` 정책 부재나 새 trusted workflow 실행 PASS를 뜻하지 않는다. 기본 브랜치 초기 배치·이후 동일 후보 target 실행과 서버 context 전환은 여전히 미실행이다.

Railway의 현재 인증으로 `DriverTree` 프로젝트의 정확한 service/repo 연결을 대조했다. staging은 현재 `source:null`, production은 `source.repo:grinvi04/drivertree`다. 양쪽 active deployment는 0, 최신 배포는 2026-06-08의 FAILED이며 당시 metadata만 staging develop/main production을 보여 준다. 따라서 문서상의 develop→staging 자동 배포를 현재 활성 연결로 확정하지 않는다. **현재 trigger branch·autodeploy·Wait for CI·PR environment·watch 설정은 이 CLI 조회에서 미확인**이다. deployment source 연결을 바꾸거나 실패 서비스를 복구하지 않았다. 변수·서비스 로그·DB는 조회하지 않았다.

Vercel CLI의 현재 인증은 invalid token으로 실패했다. 사용자는 이 단계의 Vercel 확인을 나중으로 미루도록 선택했다. 재인증·설정 조회·Vercel 전달은 후속이며 이번 단계에서 다시 시도하지 않는다. 다른 인증정보를 찾거나 자동 로그인·설치를 하지 않았다. 기존 GitHub Preview/Production 기록은 보존하되 현재 production branch·ignored build·PR Preview·환경 자격증명은 미확인이다. [Vercel Git 배포](https://vercel.com/docs/git)와 [Railway autodeploy](https://docs.railway.com/deployments/github-autodeploys)의 공식 설명처럼 별도 provider 연결은 Actions 결과만으로 통제됨을 보장하지 않는다. ERP의 Railway 프로젝트는 현재 목록에서 이름으로 매칭되지 않았으며 프로젝트 부재로 단정하지 않는다.

원문은 비밀정보가 없는 GitHub 정책·권한 응답과 Railway metadata 허용 필드만 기록했다. Railway 전체 응답/변수/로그는 저장하지 않았다. 현재 읽기 전용 결과와 명령·종료·지문은 다음에 보존한다.

```json
{
  "github": {
    "checkedAt": "2026-10-07T01:36:18.886321+00:00",
    "records": [
      {
        "repo": "erp",
        "kind": "policy",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/erp/actions/policies?has_parents=true&per_page=100"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/erp-policy.json",
        "sha256": "00daed3d9cccc99e8d2509f634ccb581741c67a9bc74d78b519ba39475f708ed"
      },
      {
        "repo": "erp",
        "kind": "permissions",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/erp/actions/permissions/workflow"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/erp-permissions.json",
        "sha256": "f6e178fc1e56cf43900da383f85398b61de9ae61c6b8433116c1856605745924"
      },
      {
        "repo": "siku",
        "kind": "policy",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/siku/actions/policies?has_parents=true&per_page=100"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/siku-policy.json",
        "sha256": "00daed3d9cccc99e8d2509f634ccb581741c67a9bc74d78b519ba39475f708ed"
      },
      {
        "repo": "siku",
        "kind": "permissions",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/siku/actions/permissions/workflow"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/siku-permissions.json",
        "sha256": "f6e178fc1e56cf43900da383f85398b61de9ae61c6b8433116c1856605745924"
      },
      {
        "repo": "webhook-service",
        "kind": "policy",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/webhook-service/actions/policies?has_parents=true&per_page=100"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/webhook-service-policy.json",
        "sha256": "00daed3d9cccc99e8d2509f634ccb581741c67a9bc74d78b519ba39475f708ed"
      },
      {
        "repo": "webhook-service",
        "kind": "permissions",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/webhook-service/actions/permissions/workflow"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/webhook-service-permissions.json",
        "sha256": "f6e178fc1e56cf43900da383f85398b61de9ae61c6b8433116c1856605745924"
      },
      {
        "repo": "drivertree",
        "kind": "policy",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/drivertree/actions/policies?has_parents=true&per_page=100"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/drivertree-policy.json",
        "sha256": "00daed3d9cccc99e8d2509f634ccb581741c67a9bc74d78b519ba39475f708ed"
      },
      {
        "repo": "drivertree",
        "kind": "permissions",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/drivertree/actions/permissions/workflow"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/drivertree-permissions.json",
        "sha256": "f6e178fc1e56cf43900da383f85398b61de9ae61c6b8433116c1856605745924"
      }
    ]
  },
  "railway": {
    "records": [
      {
        "path": "/tmp/harness-remote-conditions-20261007/railway-staging-selected.json",
        "sha256": "c05f4ad34757ba65f5b5a535626c82f2dba1a6df0ef9f36e078b129c3078c30a"
      },
      {
        "path": "/tmp/harness-remote-conditions-20261007/railway-production-selected.json",
        "sha256": "b7d9d085d09e965367602a6b37086cfbe2af65815298af95a8bdeaeb868526bf"
      }
    ],
    "staging": {
      "command": [
        "railway",
        "status",
        "--project",
        "eec41ebc-5bd4-4c65-bcce-f3d6d08081b5",
        "--environment",
        "staging",
        "--json"
      ],
      "exit": 0,
      "environment": "staging",
      "serviceName": "drivertree",
      "source": null,
      "latestDeployment": {
        "createdAt": "2026-06-08T12:58:50.419Z",
        "id": "4be810cc-b140-4042-8683-8bf23d641b48",
        "status": "FAILED"
      },
      "selectedDeploymentMeta": {
        "branch": "develop",
        "commitHash": "2f1bfb8a82b8ffa2c22cc3fdf79808800150e868",
        "commitMessage": "Merge pull request #15 from grinvi04/docs/claude-md-wording-align\n\ndocs(claude): .claude/ 규칙 문구 통일",
        "repo": "grinvi04/drivertree"
      },
      "activeDeploymentCount": 0,
      "scope": "metadata allowlist only; variables/logs not queried"
    },
    "production": {
      "command": [
        "railway",
        "status",
        "--project",
        "eec41ebc-5bd4-4c65-bcce-f3d6d08081b5",
        "--environment",
        "production",
        "--json"
      ],
      "exit": 0,
      "environment": "production",
      "serviceName": "drivertree",
      "source": {
        "image": null,
        "repo": "grinvi04/drivertree"
      },
      "latestDeployment": {
        "createdAt": "2026-06-08T07:05:52.504Z",
        "id": "d3fbaf98-f6f2-4f93-872f-3c84e07f6f1e",
        "status": "FAILED"
      },
      "selectedDeploymentMeta": {
        "branch": "main",
        "commitHash": "1198c4ec189653ae0c56afc79a3dd9d70f702932",
        "commitMessage": "Merge pull request #13 from grinvi04/release/v1.5.5\n\nrelease: v1.5.5",
        "repo": "grinvi04/drivertree"
      },
      "activeDeploymentCount": 0,
      "scope": "metadata allowlist only; variables/logs not queried"
    }
  },
  "vercel": {
    "command": "vercel whoami --non-interactive",
    "exit": 1,
    "result": "specified token is not valid",
    "boundary": "no login, token reading, retry or configuration change"
  },
  "classification": "read-only settings and metadata, not deployment execution"
}
```

이번 단계의 실행 순서와 종료 기준은 다음과 같다.

1. webhook 로그인 연결·state·승인된 admin 권한 보완: 실제 설치 SDK의 합성 HTTP·자체 서명 토큰·callback 대역 Redis에서 정상/오류/다른 브라우저/이전 쿠키 재생/만료/권한 거부를, 실제 격리 Redis에서 동시 원자 소비를 확인했다. `eba4bfb`의 전체 품질·독립 보안 검토·문서 인수를 마쳤다. 외부 운영 realm의 성공으로 확대하지 않는다.
2. DriveTree YAML 수정 후보 적용: Swagger 하위 pin만 제한하여 정상 문서 생성·조회와 예산 거부, 클린 lock 설치·전체 backend 품질/실DB·감사·독립 검토를 수행한다. `8c5b4f8`에서 이 로컬 보완·회귀·독립 검토를 마쳤다. 이전 `36f9b0d`의 115개 검증 기록과 라이브러리 표본의 한계를 보존하며 전체 감사·원격 인수 완료로 확대하지 않는다.
3. 공식 수정판 없는 braces/sprintf-js와 큰 의미 변경의 Prisma/Keycloak: DriveTree의 최소 Prisma 내부 보완은 `0a654e0`의 로컬 QA·감사·독립 검토로 인수했다. webhook 2.x 호환 pin은 새 감사 경고, 3.9.1은 만료 수용 P1 때문에 비교 후보로만 보존하고 채택하지 않는다. 최신 SDK 전환과 DriveTree braces 소비자 보완은 아래 최신 기록에서 구분한다. 남은 ERP braces/sprintf 경고는 현재 도달성·설치 정책과 공식 수정판 유무로 미해결 상태를 유지한다. 검증 전 강제 override·downgrade·감사 예외로 완료 처리하지 않는다. 잔여 경고의 수용 여부와 해제 조건을 제품 기록으로 결정한다.
4. 원격 전달: Preview·이미지 게시·외부 자동 배포 영향과 Actions event policy를 확인한 구체적 후보로 PR/CI 인수한다. trusted bootstrap과 필수 context 전환은 기존 보호 유지·정확 후보 실행·서버 readback을 각각 증명하며 이후 운영 배포는 별도 경계다.

### 최신 인증 SDK 전환 후보

`ef6585a`는 2.x/3.9.1 비교 결과를 바탕으로 python-keycloak 7.1.1로 전환했다.
SDK 기본값에 의존하지 않고 JWK·RS256·leeway 0·exp 필수 계약을 UI/API에서 공유한다.
집중 RED 5 FAIL/20 PASS, 추가 만료/누락 계약 RED 7 FAIL/24 PASS를 보존했고 최종 31 PASS다.
기존 DB/queue/dotenv 시작 차단 계약과 새 전체 110개 시험이 통과했다. 실제 별도 Keycloak
22.0.5와 Chrome에서 admin/viewer의 로그인·코드 교환·callback·접근 허용/거부도 확인했다.
공식 최신 pin의 runtime 해석 graph 74개·개발 graph 감사가 각각 0이다. 최초 직접 audit은
macOS ensurepip SIGABRT로 실패해 원문을 보존하고, 전체 해석 graph를 고정한 별도 감사로
대체했다. 직접 pin 감사만을 전체 감사로 쓰지 않는다. PyPI Alpha classifier와 외부 운영
realm의 issuer/audience·키 회전과 당시 원격 미확인은 로컬 후보의 한계로 남겼다.
현재 원격 CI·develop 병합은 맨 아래 소비 원격 전달 후속을 따르며 배포 준비 완료는 아니다.
코드 후보 manifest는 `97f868f702d554d4773f698d93286499fdbd2d090f150a625b2d26e6de162bdc`,
독립 문서 정정 후 `2d08281`의 manifest는 `a343fc23086fb962f9dd3cc85619154e855911dd957456b171525e4a8dd78b1f`다.
개발 pin 개수 110→91과 Alpha 분류 누락을 정정했고 코드·시험은 그대로다. 실제 Chrome
callback은 제품 lifespan과 별도 실제 Redis를 사용했으며, 앞선 대역 callback과 구분한다.
이전 `eba4bfb`의 104개/15 advisory와 위험 비교 후보는 당시 사실로 보존한다.

### DriveTree 깊이 보완과 ERP의 미적용 조건

DriveTree `40ffba2`는 braces 3.0.3의 원본/패치 lib 6파일 SHA와 PR #78 commit을
고정해 postinstall·실제 설치 확인·직접 Next ESLint 소비 시험에 연결했다. 격리 연구의 정상
비교 30개·100/101 경계와 제품의 깊이/직접 AST·설치 drift·재실행·symlink·omit 보안 9개를 구분한다.
독립 검토에서 stdin import ENOENT P2를 발견해 `907ea04`에서 RED→GREEN/보안 10개로
보완했다. 최신 clean npm ci는 6파일을 실제 적용했으며, 변경 script의 형식/lint도 통과했다.
앱 입력·lock·설치 패치 SHA가 같아 40ffba2의 단위 8/build와 앞선 Chromium 20을 재사용했다.
이전 script 후보를 현재 통과로 쓰지 않으며 원격/current-browser 미실행과 감사 high 5를 유지한다.
공식 수정판이 아니므로 >100 깊이 패턴을 의도적으로 거부하고 임의 AST/출력 폭증 안전은
보장하지 않는다. 공식 호환 수정판·동등 회귀를 확인할 때 로컬 보완을 제거한다.

ERP `03a4bad`는 문서 전용 후속이다. 같은 라이브러리 반례는 재현했으나 현 rootDir 입력
노출은 확인하지 못했고 CI·Docker의 npm ci --ignore-scripts 정책 때문에 단순 postinstall은
작동하지 않는다. 적용한다면 이 경로별 명시 실행·검사를 먼저 설계해야 하며 현재 패치는 없다.
sprintf-js는 직접 과대 정밀도 오류와 실제 Jest coverage 경로에서 import 0을 구분했다.
개발 도구 잔여 감사와 미확인 노출을 수용 완료로 바꾸지 않는다.

### 이번 연속 실행의 종료 범위와 증거 보존

사용자는 승인된 확인·수정·검증·문서 현행화와 소유 worktree 정리를 마칠 때까지
연속 진행을 요청했다. Vercel 조회 보류와 소비 프로젝트 운영 배포 경계는 유지한다.
하네스 코드·플러그인 버전은 변경하지 않았으며, 현재 기록 전달만 develop PR 대상으로 한다.

- 하네스 `7e55f8e`의 quality job 63개 run step을 그대로 로컬 실행해 63 PASS다.
  최초 step 7은 pipx 부재(exit 127)로 중단됐고, 전역 설치 없이 작업 전용 pipx 환경을
  준비해 step 7~63을 재실행했다. 미변경 후보의 step 1~6 증거는 재사용한다.
  이 결과는 GitHub의 별도 secret-scan/macOS/commitlint gate 통과 주장과 구분한다.
- 소비 비교 중 샘플 설치기의 경로 별칭 성공/no-op 결함도 발견했다. 샘플 `e3f1f47`은
  realpath 직접 실행 판정과 stdin import 보호를 보완했다. 별칭 RED 1 FAIL, stdin
  RED 1 PASS/1 FAIL → 보안 9 PASS·frontend lint PASS, 독립 검토 추가 P1/P2 없음이다.
  기존 앱 QA는 입력 불변으로 재사용했으며 전체 감사 high 5 잔여는 유지한다.
- 원문·실패·ERP JUnit XML 묶음은
  `$HOME/Documents/Codex/2026-10-07/team-harness-consumer-qa-evidence/`에
  같은 SHA-256으로 보존했다. `preservation-manifest.json`은 원래 cwd/파일 경로를 바꾸지
  않고 보존 사본 위치로 연결하며 `harness-quality-combined.json`은 63단계와 최초 실패를 연결한다.
- 기존 지도·사용자 마일스톤은 `$HOME/project/team-harness/.project-map/`에
  바이트 동일하게 보존했다. 다른 채팅의 지도 작업이 종료된 뒤 서비스의 하네스 원본
  경로만 이 일반 clone으로 변경했다. 나머지 네 프로젝트 설정은 유지했고 서비스 health와
  다섯 프로젝트 페이지 HTTP 200을 확인했다. 작업용 worktree 정리 후에도 이 경로를 사용한다.

```harness-doc-sync
{"version":1,"documents":[{"path":"docs/pilots/consumer-readiness-2026-10-07.md","reason":"원본 신선도·QA 준비·최소 적용 계획과 종료 경계"},{"path":"docs/pilots/consumer-readiness-2026-10-07.json","reason":"명령·후보·원문·지문·서버 정책·미실행 구분"},{"path":"docs/product-direction.md","reason":"현재 로컬 적용 범위·원격 전달 경계와 다음 행동"}],"items":[]}
```

제한 독립 보안 검토는 원문 32개·소스 지문 35개와 위험/QA 관련 추가 12파일의 고정 Git blob을
대조해 계획 범위의 추가 차단 finding 없음으로 판정했다. 소비 시험을 재실행하거나 제품 인수를
승인한 결과는 아니다. ERP 첫 요청 전 자격증명 전송 차단과 webhook 대역/실저장 관찰 구분을
검토 결과에 따라 보강했다. 최종 전달·CI·병합은 [PR #495](https://github.com/grinvi04/team-harness/pull/495) 원본을 따른다.
소비 적용의 후속 상태·승인 범위는 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)에서 추적한다.

### 후속: 소비 원격 전달과 보류 조건 (2026-10-07)

사용자는 네 소비 프로젝트의 인수와 완료 후 추가 worktree 정리를 요청했다. 앞선 로컬 단계의 실행·한계는 보존한다. Vercel 관련 원격 작업 보류를 다시 확인했으므로 DriveTree·siku는 push/PR을 실행하지 않는다. ERP도 문서의 선택형 Vercel PR preview 연결을 실제로 확인하지 못했으므로 원격 전달은 보류한다. webhook의 develop PR/CI/병합은 이미지 게시·운영 배포와 분리해서 진행한다.

- webhook 전달 후보 `aee5ccf`: 기존 `2d08281`의 앱·시험·의존성·workflow 파일을 유지한 채 미게시 메시지 오류를 해결하고 전달 문서를 연결했다. [PR #71](https://github.com/grinvi04/webhook-service/pull/71)의 최초 후보 `a328e3e`는 기능 품질 등 검사 PASS지만 secret-scan이 QA SHA-256 두 개를 API 키로 오탐하여 FAIL였다. scanner 8.24.3의 원래 range RED 2건·정확한 커밋/파일/규칙/행 fingerprint 두 개만 적용한 GREEN 0건·같은 파일 경로의 새 합성 token 거부 exit 1을 확인했다. workflow·규칙·디렉터리 전체를 제외하지 않았고 고정 후보 독립 보안 검토와 새 원격 CI를 대조한다. 전달 후보 `aee5ccf`에서 필수 원격 CI 5개와 추가 test-guard/repo-sync SUCCESS, 미해결 스레드 0, 독립 검토 추가 P1/P2 없음·동일 보호 설정을 확인하고 래퍼로 PR #71을 develop에 병합했다. 원격 merge SHA는 `c4214248`이며 로컬 develop도 같은 SHA로 fast-forward했다. main/default trusted 활성화·이미지 게시·운영 배포는 완료하지 않았다. 병합 뒤 같은 `c4214248`의 [develop push CI](https://github.com/grinvi04/webhook-service/actions/runs/37570548035)도 build-and-test·alembic-heads·secret-scan SUCCESS, publish-image SKIPPED로 확인했다.
- ERP `b3fbfb36`: `dc080bd`의 scope 누락만 고친 이력 `d72856e`의 전체 tree가 기존 `03a4bad`와 동일하다. 현재 validator range PASS와 스펙 후속 6줄을 독립 검토했다. 기존 Java 957/FE 60/Chromium 38 및 원문 보존은 동일 제품 입력의 증거를 재사용하며 이번 메시지 수정에서 다시 실행했다고 표시하지 않는다. 원래 feature `085d0ce`와 사용자 미추적 작업은 그대로다. high 9 잔여·원격 CI·병합·운영 적용 미확인은 유지한다.
- DriveTree `907ea04`, siku `b6ed228`: 기존 후보와 로컬 QA를 보존하며 Vercel 원격 전달은 보류한다. 새 main/default trusted 초기 배치·event 정책·필수 context 전환은 네 프로젝트 모두 수행하지 않았다. 기존 검사와 보호 설정을 유지한다.

webhook 최초 중간 reword 시도는 역사상 SDK 소스/현재 SDK 환경 불일치와 시험 환경 누락으로 훅 FAIL 후 abort했다. 그 최초 실패는 저장 원문 없이 잘린 도구 관찰만 남아 한계를 명시한다. 최종 전달 commit에서는 명시 주입한 격리 loopback PG/Redis로 Ruff·format·mypy·pytest 훅 전체 PASS를 확인했다. 최초 FAIL을 성공으로 재분류하지 않으며 검사 생략은 하지 않았다.

이번 원격 단계의 실행·실패·반증 원문과 현재 후보/정리 결과는 `$HOME/Documents/Codex/2026-10-07/team-harness-consumer-remote-delivery/`에 보존한다. 이전 `preservation-manifest.json`을 덮어쓰지 않는다. 제품별 QA/다음 행동은 제품 문서와 이슈 #496에서 계속 추적하며, Vercel 보류와 전체 보안·trusted 활성화 잔여 때문에 네 소비 도입 전체는 완료가 아니다.

정리 확인: 이번 ERP 임시 전달 worktree는 clean 상태·현재 fix ref/원래 후보 ref·원문 보존을 확인하고 제거했다. DriveTree·siku의 이미 없는 임시 경로 등록 3개도 refs를 유지하며 정리했다. 네 제품의 기본 checkout은 모두 보존했으며 추가 소비 worktree는 남지 않았다. ERP 기본 feature `085d0ce`와 미추적 `.codex/`는 바꾸지 않았다. 이 정리는 Vercel 보류 후보·감사 잔여·trusted 활성화를 완료 처리하지 않는다. 다음은 보류 해제 후 세 제품 원격 CI/리뷰 인수와 별도 main/default 검사 전환 조건 확인이다.


### 후속: 의존성 재확인과 trusted 전환 준비 (2026-10-07)

이번 범위는 남은 의존성의 현재 보완 가능성 확인, 기존 로컬 보완 재검증과 webhook trusted 전환 준비다. Vercel 원격 보류와 운영 배포 제외는 유지한다. 소비 앱·lock·workflow·보호 설정을 변경하지 않았다.

| 현재 대상 / 선정 이유 | 명령·관찰 경계 | 이번 결과 / 완료 한계 |
|---|---|---|
| DriveTree `907ea045` frontend·backend | 각 cwd에서 `npm audit --json`, `npm audit --json --omit=dev` | frontend 전체 high 5, backend 전체 moderate 20: exit 1/FAIL. 양쪽 운영 그래프 0: exit 0/PASS. 전체 보안 완료는 아님 |
| ERP 보완 후보 `b3fbfb36` frontend | 그 ref의 package.json·lock을 격리 디렉터리에 추출한 lock 감사; 같은 두 audit 명령 | 전체 high 9, 운영 high 7: exit 1/FAIL. 모든 항목이 braces 전이에 연결됨. 설치된 앱·전체 회귀 검사는 이번에 재실행하지 않음 |
| DriveTree 깊이 보완의 정상·거부·무결성 경계 | 실제 frontend에서 `npm run test:dependency-security` | 10/10 PASS·exit 0. 정상 문법/Next ESLint 소비, 깊이·직접 AST 거부, 설치 지문·재적용·변조/새 버전 거부, 개발 의존성 제외·stdin import 확인. npm 경고 해소와 구분 |
| webhook develop `c4214248` trusted 자산 | workflow·validator와 Harness 정본 byte parity; `bash tests/commitlint-trusted-test.sh` | 두 파일 동일, 실제 shell의 정상·잘못된 메시지·head 변경·fetch 실패·metadata·역병합 회귀 PASS/exit 0. 로컬 계약 시험이며 GitHub target 활성화는 UNVERIFIED |

최초 ERP 조회는 원래 작업 브랜치 `085d0ceb`에서 실행돼 전체 31(critical 4/high 19/moderate 8), 운영 26(critical 4/high 17/moderate 5)을 출력했다. 이 결과는 보완 후보의 퇴행이 아니다. 현재 전달 후보의 ref를 직접 읽어 별도 감사한 위 high 9/7과 분리해 보존했다. 첫 보안 시험 호출도 Harness cwd에서 실행해 package.json 부재로 exit 254였으며 파일 변경 없이 실제 DriveTree frontend에서 다시 실행했다. 최초 실패와 후보·cwd·raw 결과는 `$HOME/Documents/Codex/2026-10-07/team-harness-dependency-followup/`에 보존한다.

registry latest는 braces 3.0.3·sprintf-js 1.1.3이며, [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)와 [sprintf-js advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)의 patched versions는 None이다. 신규 공식 수정판으로 안전하게 교체할 대상은 이번 재확인에서 없었다. DriveTree의 기존 로컬 보완은 유지하고, ERP에 그 패치를 자동 복사하거나 Jest/Next lint를 강제 다운그레이드하지 않았다. ERP CSS/CLI·lint 경계의 별도 보완을 채택하려면 제품 스펙의 클린 설치·시각·BFF·품질 회귀 계약을 먼저 연결한다. sprintf-js는 앞선 소비 경로 조사와 같은 입력이므로 직접 라이브러리 위험과 현재 Jest 경로의 도달성 미확인을 유지한다.

#### webhook trusted 활성화의 실행 조건과 복구

현재 서버의 main/develop은 strict·GitHub Actions app binding을 가진 기존 필수 검사 5개를 유지하며 `commitlint-trusted`를 요구하지 않는다. main workflow 조회는 404, develop에는 파일이 있다. 명시 repository Actions policy 목록은 0이며 상위 정책 부재나 target 실행 가능성을 뜻하지 않는다. main push의 `publish-image`가 활성인 현재 구조에서 기본 브랜치 배치를 이번 준비 작업의 승인으로 실행하지 않는다.

1. 이미지 게시 영향을 포함한 main 릴리즈 승인 범위를 확인하고 기존 보호·이벤트 정책을 보관한다. [공통 전환 계약](../specs/trusted-commitlint.md)을 따르며 별도 우회 workflow를 만들지 않는다.
2. 승인된 기본 브랜치 후보에 workflow·validator를 배치하고 원격 blob/후보를 확인한다. 이 배치 PR의 기존 CI green으로 새 target 실행을 판정하지 않는다.
3. 이후 실제 정상 PR의 고정 head에서 trusted 검사가 실행·성공하고 PR 파일을 실행하지 않았는지 확인한다. target 정책 거부·미실행은 UNVERIFIED이며 정책을 자동 완화하지 않는다.
4. 기존 context를 유지한 채 새 app-bound context를 먼저 추가하고 전체 보호 readback을 대조한 다음에만 기존 요구/legacy workflow를 정리한다. strict·다른 필수 검사·승인·관리자 강제를 보존한다.
5. 실패 시 기존 검사가 실제 실행되는 상태를 먼저 복원한다. 이번 준비에서는 보호·정책·main을 쓰지 않았으므로 서버 복구 변경도 없다. 완료 기준은 기본 브랜치 정본, 후속 실제 target PASS, 보호 readback과 문서 상태의 일치다.

이번 재확인·로컬 계약 검증·전환 준비는 완료했지만 전체 소비 인수·전체 보안·trusted 활성화·배포는 완료되지 않았다. 다음 실행 경계는 공식 수정판 또는 별도 제품 보완 계약, 사용자의 Vercel 보류 해제, webhook 이미지 게시를 포함한 릴리즈 승인이다. 미확인을 완료로 올리지 않는다.

### 후속: ERP 깊이 보완의 로컬 인수 (2026-10-07)

사용자 진행 승인에 따라 ERP 제품 스펙에 필수 범위·기대값을 먼저 연결하고 별도 worktree에서 검증했다. 로컬 후보 `7a13802`의 보완 코드는 `18b18a06`이며 기존 `b3fbfb36` 이후 package-lock·backend 입력은 바꾸지 않았다. 이 보완은 제품 소유 코드이고 Harness 공통 스크립트·스킬·버전은 변경하지 않는다. 앞선 미적용 조사 기록은 당시 후보 결과로 보존한다.

- 상류 braces PR #78의 고정 SHA `97308a01d091b211cf015314a2d0696da28a5392`를 대조했다. 6개 중 5개 patched source는 그대로 같고, parse는 관련 없는 quote/comma 변경을 제외해 설치된 3.0.3의 정상 의미를 유지했다. 정확한 버전·원본/보완 지문을 쓰기 전에 검사하며 새 버전·변조는 거부한다. 100단계 초과 패턴 거부와 확장 수/임의 AST 전체 안전 보장 없음은 명시한다.
- 최초 깊이 시험 4개 중 정상 1 PASS·깊이 3 FAIL → 보완 뒤 설치·무결성·parser/AST·실제 Next rootDir/shadcn fast-glob·stdin import 등 11 PASS다. CI 두 ignore-scripts 설치와 Docker deps 설치 뒤 명시 patch/check를 연결했다. production-only 설치와 이미지 안 보완 지문도 실제 확인했다. Vercel 제공자 설치 설정은 변경하거나 검증하지 않았다.
- 클린 설치 뒤 FE 단위 60·Chromium 38(재시도 0)과 품질·빌드·CLI help PASS, CSS 2개 content와 세 PNG가 baseline과 byte 동일하다. 실제 HTTP BFF는 anonymous null, 합성 암호화 세션의 공개 tenant 응답 및 private token 미노출을 확인한다. 브라우저 시험은 합성 세션·backend 미기동이며 업무/실 IdP UAT 전체로 확대하지 않는다. Java 957/실 Keycloak의 이전 결과는 미변경 backend 입력에만 재사용한다.
- 전체 audit high 9·운영 high 7/exit 1은 계속 FAIL이다. 로컬 패치가 registry metadata를 지우지 않는다. 공식 호환 수정판이 나오면 같은 계약으로 검증하고 보완 제거를 검토한다. Python encoding·upstream parse 비교·shadcn exports fixture·BFF null oracle·validator range 인자 오류의 최초 실패는 그대로 보존하고 수정 이유를 연결했다.
- 원문·cwd·exit·지문과 고정 후보 독립 검토는 제품의 `docs/specs/erp-braces-local-evidence.json` 및 `$HOME/Documents/Codex/2026-10-07/erp-braces-local-adoption/`에 있다. 고정 코드 독립 검토는 추가 P1/P2·필수 로컬 검증 누락 없음으로 판정했다. 제품 스펙·설치 안내·배포 안내·결정 기록을 함께 갱신했다.

ERP 원래 feature `085d0ce`·미추적 사용자 작업은 보존한다. 후보와 원문을 보존한 뒤 소유 임시 worktree를 제거하며 최종 정리·하네스 문서 전달 근거는 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)에 연결한다. Vercel 관련 원격 전달, 실제 원격 CI·병합, main/default trusted 활성화·이미지 게시·운영 배포는 여전히 미완료다. 이번 로컬 인수를 네 제품 전체 완료로 취급하지 않는다.

### 후속: 소비 원격 인수와 webhook 릴리즈 (2026-10-07)

사용자가 소비 프로젝트의 Vercel 미리보기를 포함한 원격 push·PR·CI를 허용한 뒤 진행한 결과다. 위 Vercel 보류와 원격 미실행은 당시 상태로 보존한다. 세 제품 PR은 develop 대상으로 열려 있으며 병합·staging·운영 배포는 실행하지 않았다. 같은 후보의 GitHub required check와 외부 배포 결과를 별도로 판정한다.

| 제품 | 현재 후보 | 원격 PR·필수 CI | 외부 결과와 남은 경계 |
|---|---|---|---|
| DriveTree | `907ea04529f4ca4bb8b2c003f2eb3a8a886ae551` | [PR #85](https://github.com/grinvi04/drivertree/pull/85) OPEN, develop 대상 필수 6개 PASS | 같은 SHA의 Vercel Preview 배포 SUCCESS, [미리보기](https://drivertree-git-fix-harness-qa-contract-grinvi04-2237s-projects.vercel.app) GET 200. 로컬 전체 감사 frontend high 5·backend moderate 20 FAIL, 운영 그래프 양쪽 0은 별도 기록. 병합·staging/운영 반영 없음 |
| siku | `dea999426959627ebcac169a615905e67cdfdb97` | [PR #87](https://github.com/grinvi04/siku/pull/87) OPEN, 필수 6개 PASS. 최초 `b6ed228`의 repo-sync 정본 줄바꿈 FAIL을 설정 파일 한정 Prettier 폭 90·정본 바이트 적용으로 수정하고 새 head에서 다시 통과 | 같은 SHA의 Vercel Preview SUCCESS. [미리보기](https://siku-git-fix-harness-qa-contract-grinvi04-2237s-projects.vercel.app)는 비인증 GET 302로 Vercel 로그인에 이동하므로 앱 화면은 UNVERIFIED. 운영 DB drift 미측정·DB/Storage 삭제 비원자성 유지 |
| ERP | `7a13802ce712edb93240933bcd7841b629b42574` | [PR #255](https://github.com/grinvi04/erp/pull/255) OPEN, 필수 8개 PASS. 로컬 소스 10·원문 72개 지문 일치 | 이 SHA의 GitHub deployment·외부 commit status·Vercel PR 댓글 0건. CLI 인증이 없어 로그인 흐름을 중단했고 preview URL·실화면은 UNVERIFIED. 전체 감사 high 9·운영 high 7 FAIL; 실 Keycloak·업무 API 원격 UAT 미실행 |
| webhook-service | `e1eee56e101be3fc61526430599773116cd95797` | [정리 PR #75](https://github.com/grinvi04/webhook-service/pull/75) MERGED, head `84648232` 필수 5개 PASS·독립 검토 추가 P1/P2 없음. 앞선 main 릴리즈와 역병합·trusted 정상 PR은 아래 원본으로 구분 | main `661ee4f`/`v1.5.0` GHCR 게시 job SUCCESS, 직접 registry pull UNVERIFIED. main/develop 보호의 필수 context는 trusted로 전환됐지만 main의 역사상 legacy workflow 파일은 남음; 운영 배포 증거 없음 |

siku의 과거 QA 입력 101개 중 새 후보에서 `commitlint.config.cjs` 하나만 바뀌었고, 새 설정의 정본·형식·lint·repo-sync와 원격 필수 CI는 통과했다. 기존 앱 QA는 입력 불변 범위에만 재사용한다. ERP의 원래 feature `085d0ce`와 미추적 `.codex/`는 보존했고 이 원격 작업의 추가 소비 worktree는 0개다. 세 제품의 원문·초기 실패·현재 PR/배포 판정은 각 제품 스펙과 `$HOME/Documents/Codex/2026-10-07/siku-erp-remote-adoption/` 및 DriveTree 원격 인수 기록에 연결한다.

webhook-service는 [main PR #72](https://github.com/grinvi04/webhook-service/pull/72)를 병합해 main `661ee4fda9a78002383eeb38e0d7e49c1cbd0e59`에 `v1.5.0` 태그를 발행하고 [develop 역병합 PR #73](https://github.com/grinvi04/webhook-service/pull/73)도 병합했다. main push의 GHCR 이미지 게시 job은 SUCCESS이며 action metadata에 digest `sha256:79c2df3f934428cf7ac8a1a6f741cde7833d165b24636e27061a4f84785c4124`가 기록됐다. 익명 registry 조회 401·현재 PAT 패키지 조회 403이므로 직접 manifest pull/readback은 UNVERIFIED다. 이미지 게시 성공을 운영 서비스 배포나 registry 직접 검증으로 확대하지 않는다.

같은 제품의 [정상 PR #74](https://github.com/grinvi04/webhook-service/pull/74) 고정 head `2ae5c20fa1aedcf2d2e85d6c370f0d003da7aafa`에서 `commitlint-trusted`가 실제 SUCCESS였다. main/develop의 필수 5개는 기존 `commitlint`를 유지한 채 trusted를 먼저 추가·readback하고 이후 기존 요구만 제거·readback했다. 현재 양쪽 보호 목록은 `alembic-heads`, `build-and-test`, `secret-scan`, `destructive-ddl`, `commitlint-trusted`이며 strict·GitHub Actions app binding을 유지한다. [legacy 정리 PR #75](https://github.com/grinvi04/webhook-service/pull/75)의 고정 head `84648232d3d08c22b8c94296a4c03bd9bbd3769a`는 필수 5개 PASS·독립 읽기 전용 검토 추가 P1/P2 없음으로 develop `e1eee56e101be3fc61526430599773116cd95797`에 병합됐다. 같은 SHA의 [develop push CI](https://github.com/grinvi04/webhook-service/actions/runs/37623796575)에서도 build-and-test·alembic-heads·secret-scan SUCCESS, publish-image SKIPPED다. develop의 기존 `commitlint.yml`은 제거됐고 main v1.5.0에는 역사상 파일이 남아 다음 정상 릴리즈 전파를 기다린다. 현재 main의 trusted workflow 파일은 존재한다. 새로운 target 이벤트 정책 예외는 승인·적용하지 않았다.

현재 세 제품의 PR 병합·실서비스 반영, ERP preview와 siku 앱 화면, webhook registry 직접 readback, 각 제품의 잔여 전체 감사와 운영 인수는 완료가 아니다.

다음 단계는 PR별 리뷰·병합 영향과 미확인 provider/보안 경계를 해당 제품 원본에서 따로 판정하는 것이다. webhook main의 legacy 파일 전파도 다음 정상 릴리즈에서 분리해 확인한다. 이 문서 갱신 자체는 소비 제품 코드나 보호 정책을 변경하지 않는다.


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

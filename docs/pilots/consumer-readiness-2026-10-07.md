# 네 소비 프로젝트 적용 준비 점검 (2026-10-07)

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
| DriveTree | `76cb019` (코드 `0a654e0`) | Swagger YAML 보완 유지, Prisma 7.10.0 유지·내부 두 의존성만 보완. 클린 설치·resolve·validate/generate·backend format/lint/build·단위 70·새 격리 DB migrate 3/통합 19 PASS. frontend 단위 8·Chromium 20은 이전 동일 입력 증거 재사용 | 코드 후보 `0a654e0` 독립 검토 추가 P1/P2 없음. source 12·원문 21개·격리 연구 원문 24개 지문 일치. 전체 감사 backend moderate 20/high 0·frontend high 5 FAIL; 운영 backend 0·frontend 0. 원격 CI·병합·배포 미실행 |
| siku | `b6ed228` (코드 `5ad8a96`) | 클린 설치·형식·lint·build, 단위 86·실제 Auth/RLS/Storage 브라우저 25 PASS, 재시도 0, 전체 감사 0 | 코드·문서 독립 검토 기존 P2 해소·추가 P1/P2 없음. 권한 없는 0행 삭제 뒤 파일 보존, DB 삭제 뒤 Storage 실패의 함수·UI 부분 실패 처리 확인. 원격 DB 드리프트 미측정·DB/Storage 원자성 보장 안 함 |
| ERP | `4d4fbf4` (코드 `dc080bd`) | Java 실제 단위/통합 957·FE 단위 60·Chromium 38 PASS, 품질·Docker 두 이미지·repo-sync 21/21, 실제 격리 Keycloak 초대/재초대·동일 사용자 재조회 PASS | curl 설정 파일 우회 RED→GREEN·독립 코드 검토 추가 P1/P2 없음. Java UP-TO-DATE 기록은 실제 실행으로 세지 않으며 새 DB의 `--rerun-tasks`/XML 증거를 별도 보존. 전체 high 9/critical 0 FAIL |
| webhook-service | `eba4bfb` | 기존 DB/큐·dotenv 경계 유지, 관리자 SDK/로그인·state·서명·admin 권한 focused 25 PASS. 전체 기존/새 Python 환경 각각 104 PASS, Ruff format/lint·mypy·Alembic 단일 head·전체 훅 PASS | 고정 후보 독립 검토 추가 P1/P2 없음. source 19·원문 73개 지문 일치. 합성 HTTP·자체 RSA·callback 대역 Redis와 실제 Redis 동시 GETDEL 단일 소비를 구분. 전체 그래프 3개 패키지/15 advisory FAIL 유지. 외부 Keycloak·issuer/audience·키 회전·실제 브라우저·원격 gate 미확인 |

DriveTree의 최초 증분 lock 설치 실패와 클린 lock 복구, siku의 공식 CLI 서명/바인딩 차단·저장소 xattr 실패·PNG fixture 거부, ERP의 초기 포트 바인딩 문제·curlrc 반례·재사용 시험 DB 잔여 데이터로 인한 Java 2 FAIL(새 전용 DB에서 957 PASS), webhook의 최초 훅 환경 실패는 성공으로 덮어쓰지 않는다. 추가 커밋 훅의 잘못된 DB 사용자명에 의한 76 PASS·2 인증 오류는 보고를 보존했으나 전체 stdout 원문은 미보존이라는 한계도 명시했다. 올바른 전용 설정의 직접 driver 연결·최종 전체 훅은 새 원문으로 확인한다. 실제 실패 원인을 바꾼 재시도만 진행했다. OS 보안·전역 Docker 설정·RLS·기존 CI gate를 완화하지 않았다.

ERP는 원래 feature checkout과 기존 미추적 작업을 그대로 보존한 별도 worktree다. 모든 실서비스 시험은 새 합성 자격증명·데이터를 사용했으며 실제 공개 포트의 loopback 바인딩을 확인하고 사용한 전용 서비스의 중지를 확인했다. 제품 증거의 관찰 경계를 넘어 외부 인증·모든 업무 API·운영 데이터의 품질을 보장하지 않는다.

webhook의 이전 60/69/77 시험은 명시 주입한 로컬 DB/큐 실행 결과이며 기존 `.env`의 자동 로딩 차단 증거로 쓰지 않는다. 78개 후보에서 Pydantic 최초 import 전 차단과 합성 provider 회귀는 확인했으나 pytest-dotenv의 선행 로딩은 차단하지 못했다. 최종 `5fd2213`에서 초기 플러그인 로딩도 차단하고, 설치된 플러그인을 사용하는 실제 시작 회귀의 RED→GREEN과 전체 79 PASS를 확인했다. 앞선 자동 읽기 차단 주장은 제품 기록에서 철회·한계로 보존했다. 운영 설정 파일을 직접 조회하거나 제품 설정의 기본 동작을 바꾸지 않았다.

현재 증거 정본은 각 제품의 `docs/specs/quality-remediation.md`(siku/DriveTree), ERP의 `docs/specs/tenant-user-onboarding.md`와 외부 QA manifest, webhook의 `docs/qa/2026-10-07/README.md`와 해당 실행 manifest다. 선정한 로컬 QA·독립 검토·감사 FAIL·원격 gate 상태를 각각 기록한다. 새 trusted 파일 존재는 target 이벤트 실행/보호 강제의 증거가 아니다.

ERP 새 Java 원문·XML 172개/957 PASS와 siku 최종 기록의 독립 대조에서 추가 P1/P2 없음과 지문 일치를 확인했다. 네 고정 로컬 후보의 선정한 기능·회귀 검증과 독립 검토 인수는 마쳤다. 이후 Swagger YAML·관리자 인증 보완도 아래 기록의 고정 후보에서 인수했다. 최신 Prisma 내부 의존성 후보의 QA·독립 검토도 아래 기록에서 인수했다. 다음 단계는 남은 의존성 감사의 호환성·변경 범위 결정과 원격 전달·staging 자동 배포 영향의 확인이다. main/default 배치·검사 전환·배포는 별도 단계다. 전체 소비 도입/보안/배포 준비는 아직 **NOT VERIFIED**이며 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)은 열어 둔다.

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

| 제품 | 현재 읽기 전용 원격 확인 | 전달·병합 영향과 미확인 |
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

webhook의 두 SDK 대안도 제품 `eba4bfb`를 바꾸지 않고 scratch 환경에서 비교했다. 2.16.6 + setuptools 80.10.2는 해석/import와 서비스 비의존 인증 시험 24개를 통과하지만 setuptools의 새 보안 경고를 도입해 권고하지 않는다. 3.9.1은 jwcrypto로 바뀌며 현재 호출 옵션을 유지하면 **만료된 유효 서명 토큰을 거부하지 않는 회귀**가 발생했다. 시험 보조 패키지 누락의 최초 collection 오류와 실제 만료 검증 RED를 구분해 보존한다. 현재 SDK 의존성을 무조건 올리는 대신 키 형식·클레임/만료·issuer/audience·회전 계약을 명시한 별도 전환이 필요하다. 10초 만료 표본은 jwcrypto의 60초 허용 오차와 혼동할 수 있어 별도 동일 RSA/옵션 probe로 exp -120/-10/+300을 비교했다. 2.0.0은 두 만료값을 거부하고 미래값을 허용했지만 3.9.1은 모두 허용했다. 설치 SDK의 `check_claims={}`와 jwcrypto의 `check_claims is None` 조건을 원본에서 대조해 허용 오차 밖 만료 거부 실패를 확인했다. 3.9.1 runtime 감사 0건과 인증 시험 FAIL은 별도 판정이다. 비교 후보의 만료 수용은 독립 검토에서 P1로 판정되어 채택하지 않는다. 제품 `eba4bfb`는 변경 없는 clean 상태다. 소스 13·원문 25·설치 SDK 소스 3개 지문은 독립 대조에서 모두 일치했다. 2.16.6 후보의 runtime 감사는 ecdsa/jose/setuptools 3개 패키지·5개 중복 포함 항목 FAIL이다. 이 비교를 제품 전체 QA 또는 실제 Keycloak 연동으로 확대하지 않는다.


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
3. 공식 수정판 없는 braces/sprintf-js와 큰 의미 변경의 Prisma/Keycloak: DriveTree의 최소 Prisma 내부 보완은 `0a654e0`의 로컬 QA·감사·독립 검토로 인수했다. webhook 2.x 호환 pin은 새 감사 경고, 3.9.1은 만료 수용 P1 때문에 비교 후보로만 보존하고 채택하지 않는다. 다른 경고는 원래 제품 계약을 보존하는 소비자 보완 또는 상위 전환을 별도 설계한다. 검증 전 강제 override·downgrade·감사 예외로 완료 처리하지 않는다. 잔여 경고의 수용 여부와 해제 조건을 제품 기록으로 결정한다.
4. 원격 전달: Preview·이미지 게시·외부 자동 배포 영향과 Actions event policy를 확인한 구체적 후보로 PR/CI 인수한다. trusted bootstrap과 필수 context 전환은 기존 보호 유지·정확 후보 실행·서버 readback을 각각 증명하며 이후 운영 배포는 별도 경계다.

```harness-doc-sync
{"version":1,"documents":[{"path":"docs/pilots/consumer-readiness-2026-10-07.md","reason":"원본 신선도·QA 준비·최소 적용 계획과 종료 경계"},{"path":"docs/pilots/consumer-readiness-2026-10-07.json","reason":"명령·후보·원문·지문·서버 정책·미실행 구분"},{"path":"docs/product-direction.md","reason":"현재 로컬 적용 범위·원격 전달 경계와 다음 행동"}],"items":[]}
```

제한 독립 보안 검토는 원문 32개·소스 지문 35개와 위험/QA 관련 추가 12파일의 고정 Git blob을
대조해 계획 범위의 추가 차단 finding 없음으로 판정했다. 소비 시험을 재실행하거나 제품 인수를
승인한 결과는 아니다. ERP 첫 요청 전 자격증명 전송 차단과 webhook 대역/실저장 관찰 구분을
검토 결과에 따라 보강했다. 최종 전달·CI·병합은 [PR #495](https://github.com/grinvi04/team-harness/pull/495) 원본을 따른다.
소비 적용의 후속 상태·승인 범위는 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)에서 추적한다.

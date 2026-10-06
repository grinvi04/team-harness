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

```harness-doc-sync
{"version":1,"documents":[{"path":"docs/pilots/consumer-readiness-2026-10-07.md","reason":"원본 신선도·QA 준비·최소 적용 계획과 종료 경계"},{"path":"docs/pilots/consumer-readiness-2026-10-07.json","reason":"명령·후보·원문·지문·서버 정책·미실행 구분"},{"path":"docs/product-direction.md","reason":"현재 완료 범위·소비 적용 보류와 다음 행동"}],"items":[]}
```

제한 독립 보안 검토는 원문 32개·소스 지문 35개와 위험/QA 관련 추가 12파일의 고정 Git blob을
대조해 계획 범위의 추가 차단 finding 없음으로 판정했다. 소비 시험을 재실행하거나 제품 인수를
승인한 결과는 아니다. ERP 첫 요청 전 자격증명 전송 차단과 webhook 대역/실저장 관찰 구분을
검토 결과에 따라 보강했다. 최종 전달·CI·병합은 연결할 기록 PR 원본을 따른다.

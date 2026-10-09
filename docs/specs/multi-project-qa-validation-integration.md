# 다섯 프로젝트 실제 통합과 결함 수정

[상위 문서](multi-project-qa-validation.md)로 돌아간다. 아래는 원문의 해당 주제·당시 후보 기록을 순서대로 보존한 본문이다.

## 2차 결과 — 실제 통합 경계 (2026-09-29)

사용자의 이어 진행 요청에 따라 동일 제품 후보의 Git archive 사본에서 전용 DB·인증·큐를 준비했다.
제품 원본·기존 `.env`·운영 데이터는 사용하거나 변경하지 않았다. 임시 시험 구성과 진단 시험만 추가했다.
[2차 실행 증거](multi-project-integration-evidence.json)에 명령·결과·원본 로그 SHA-256·안전한 출력과
추가 시험 원문을 보존했다. 1차 증거와 샘플 시험을 다시 실행한 결과로 세지 않는다.

| 대상 | 실제 관찰·결과 | 판정과 한계 |
|---|---|---|
| ERP | PostgreSQL16 backend check/bootJar: 171 suites, 936 PASS, 실패·skip 0. 별도 Keycloak26 + 기본 보안 Spring API + Next BFF: 준비 1개, 업무 흐름 3개 PASS; 교차 테넌트 변경 단언 추가 후 준비 1개·업무 3개 재실행 PASS | AP/AR→GL·보고서/VAT, 재고 결재·감사, 타 테넌트 GET 404/목록 제외·POST 취소/DELETE 거부와 소유자 응답 불변, 저권한 403 확인. 브라우저 OAuth 전체와 만료 JWT 서버 거부는 미확인; BFF cookie와 만료 메타데이터는 시험이 구성 |
| Siku | 실제 Supabase Auth/DB/Storage + Chromium 기존 흐름 10 PASS. 일반 사용자 API 진단 5개 중 3 PASS·2 FAIL | 타 그룹 events/사진 접근 차단과 정상 확정/취소 PASS. 확정 지출·참여 내역의 부모 이동 잠금 우회 **FAIL** |
| webhook-service | 실제 PostgreSQL15·Redis7·Celery worker에서 중복 DB 저장 방지, tenant별 키 분리, enqueue 실패 후 예약 해제·재시도 PASS. 기존 mock/SQLite 23개도 별도 PASS | 실제 JWT 검증은 대체되어 미확인. worker 실패→DLQ 작업 실행은 PASS이나 영속 실패 payload 보존·복구는 미확인 |
| DriveTree | 실제 pgvector/PostgreSQL16에서 Prisma migration 3개 및 기존 E2E 13 PASS. 실제 AppModule HTTP 진단 4개 중 3 PASS·1 FAIL | 익명 읽기·익명 쓰기 거부·관리자 쓰기 PASS. DB soft-delete·embedding 보존·단건 404와 달리 기존 검색 캐시에 삭제 항목이 남음 **FAIL** |

ERP 추가 권한 시험은 `finance:write`·`inventory:write`가 있는 실제 테넌트 B 토큰을 사용했다.
테넌트 A의 DRAFT invoice에 `POST /api/finance/invoices/{id}/cancel`, A의 item에
`DELETE /api/inventory/items/{id}`를 요청해 모두 404를 확인했다. 소유자 재조회에서 invoice와 item의
전체 응답이 이전과 같았다. 이는 대표 재무·재고 변경 경계의 통과이며 모든 endpoint·역할 조합의 보장은 아니다.
첫 UAT와 변경 거부 단언을 보강한 재실행을 구분해 기록하며 같은 업무 사례를 서로 다른 기능 수로 합산하지 않는다.

### 재현된 결함과 수정 수용 기준

**Siku — 확정 상태에서 부모 참조 변경 우회.** 일반 사용자 인증을 받은 그룹 소유자로 정산을 확정한 뒤,
`expenses.event_id`를 미확정 행사로 옮기면 성공하고 기존 정산은 `closed`다.
`expense_participants.expense_id`를 미확정 지출로 옮기는 요청도 성공해 원래 참여 관계가 사라진다.
일반 금액 변경은 P0001로 거부되므로 정상 잠금 시험만으로는 이 결함을 놓친다.
기대 결과는 두 이동의 거부·원본 관계와 확정 상태 불변이다. 수정 시 OLD/NEW 부모 잠금 또는 부모 변경
금지 정책을 제품에서 결정하고, 두 실패 시험의 GREEN과 정상 reopen·그룹 접근 회귀를 확인한다.
다른 그룹 침입이나 비소유 그룹 멤버의 재현을 증명한 결과는 아니다.

**DriveTree — 쓰기 후 목록·검색 캐시 불일치.** 검색 URL을 먼저 읽은 뒤 항목을 삭제했다.
DB 삭제 표시·단건 ID/slug 404·새 검색 URL 제외는 정상이나 같은 검색 URL은 삭제 항목을 반환했다.
61초 뒤 같은 URL에서는 사라졌다. 정확한 만료 경계나 다중 인스턴스 동작은 미검증이다.
초기 생성 캐시 실험에서도 미반영이 보고됐으나 당시 probe 원문은 보존되지 않았다.
최종 원문과 실행이 함께 남은 확정 재현 증거는 삭제 시험으로 한정한다.
수정 수용 기준은 create/update/delete 후 관련 기존 검색·목록의 즉시 일관성과 단건/DB 상태 일치다.
제품의 기존 삭제 수용 조건에 따른 것이며 이번 시험에서 제품 캐시 코드를 수정하지 않았다.

### 통과로 확대하면 안 되는 경계

- ERP backend 검사 상당수는 `TestSecurityConfig`를 사용한다. 실제 Keycloak 증거는 별도 UAT에서 얻었다.
  UAT의 실제 토큰/API 업무 검증과 시험이 직접 구성한 브라우저 세션을 구분한다.
- Siku API 진단은 Playwright runner로 실행했지만 브라우저를 조작한 10개와 별개다. `events`와 시험한
  `photos` 작업만 RLS 통과이며 모든 테이블·권한 조합의 통과가 아니다. OCR은 대역이며 외부 Edge Function은 미실행이다.
- webhook replay 401/403/404/202 중 역할 판정은 검증된 JWT 대신 dependency override를 사용했다.
  URL tenant와 event 소유자 불일치 거부를 사용자 자체의 테넌트 격리로 확대하지 않는다.
  소스의 audience 검사 비활성화는 추가 확인 대상이며 다른 audience 토큰의 실제 공격 재현은 하지 않았다.
- webhook 재전달 시험의 고정 1초 대기는 반복 실행의 보장으로 부족하다. 이번 실행의 worker 로그에는
  DB unique 제약 중복 처리와 해당 작업 완료가 있어 **이번 실행의 단일 DB 행** 판정을 뒷받침한다.
  제품 회귀 시험으로 옮길 때 task 완료를 기다린 후 단언해야 한다. 모든 외부 부작용의 exactly-once 증거가 아니다.
- webhook DLQ 함수는 task ID·customer ID·오류 같은 실패 메타데이터만 로그로 남기며
  원본 이벤트 payload의 복구 가능한 영속 보존은 제공하지 않는다. 잘못된 payload는 event 생성 전에 실패하므로 FAILED 행도
  생성되지 않는다. DLQ task 실행 성공을 장애 자료의 영속 보존·재처리 가능으로 판정하지 않는다.
- 실제 유료 임베딩/OCR, 전체 UI·접근성·성능, 배포 환경, clean install 재현성은 이번 통합 범위에서 미확인이다.

### 환경·증거·정리

기존 의존성을 복사해 사용하고 모든 쓰기는 임시 사본과 폐기 DB를 대상으로 했다. ERP/Siku의 임시
자격증명은 보고서에 넣지 않았다. Siku CLI 2.107의 실행 종료137과 누락된 Chromium은 환경 문제로
분리하고, 임시 경로에 공식 CLI 2.118.0과 해당 브라우저를 설치해 실행했다. 서명 검사를 우회하지 않았다.
Supabase CLI는 전용 네트워크의 loopback 기본 설정에도 `0.0.0.0`에 포트를 게시했으며 ERP backend도
전체 인터페이스에 바인딩됐다. 폐기 데이터만 사용했지만 이 실행을 loopback 전용 격리라고 주장하지 않는다.
실행 후 이번 작업의 서버·컨테이너·볼륨·네트워크와 임시 자격증명을 정리하고 부재를 확인했다.
사용자의 기존 앱은 건드리지 않았다. 원본 다섯 repo의 HEAD·브랜치·상태도 시작 기록과 같았다.

### Harness에 남길 교훈과 현재 판정

이번 공통 계약은 테스트 개수에 기대지 않고 실제 경계의 반례로 이어져 새로운 결함을 검출했다.
읽기 전용 독립 검토가 Siku 부모 이동 반례, ERP 교차 테넌트 변경 단언 누락, webhook 증거 범위를 지적했다.
Siku 반례는 실제로 실행해 2 FAIL을 확인했고 ERP에는 실제 변경 거부·원본 불변 단언을 추가해 재통과했다.
구체적인 도구 구현은 제품에 두고
[근거 가이드](../qa-evidence-guide.md)에 상태 잠금·캐시·비동기 완료의 사례를 연결한다.

**통합 조사 결과와 재현 증거는 확보했으나 제품 전체 QA는 NOT VERIFIED**다.
2차 종료 시점에는 Siku·DriveTree의 확인된 결함 수정과 실패 시험 재검증이 다음 우선순위였다.
후속 로컬 수정 결과는 아래 3차 기록에서 구분한다.
webhook은 JWT/audience·tenant 권한 계약 및 실패 payload 영속 보존을 별도 필수 항목으로 남긴다.
Harness 0.76.0 후보를 릴리즈·설치한 결과나 모든 향후 작업의 자동 준수 증거로 확대하지 않는다.

## 3차 결과 — 확인된 두 결함 수정 (2026-09-29)

사용자가 후속 수정을 승인해 Siku와 DriveTree의 별도 로컬 작업 브랜치에서 수정했다.
운영 DB·배포와 원본 `develop` 작업트리는 변경하지 않았다. 앞선 1·2차 FAIL은 당시 후보의 역사적
증거로 보존한다. 새 후보의 로컬 통과를 이전 후보나 실제 배포 상태에 소급하지 않는다.

| 제품 | 수정 후보와 구현 | 검증 |
|---|---|---|
| Siku | `13d11faf2af8803ae0d6d5ec9277a75dfe719d3e`, `codex/fix-settlement-parent-lock`. 새 migration 0018에서 OLD/NEW 부모 양쪽 잠금 확인 | 같은 회귀 4 FAIL·2 PASS → 6 PASS. 소유자·일반 멤버 이동, 확정 추가/삭제/분담금 차단, 취소 후 허용. 단위 79, 전체 Playwright 24(기존 브라우저 18 + 직접 DB 6), lint·format·build PASS. 기존 DB 업그레이드·새 DB 전체 migration PASS |
| DriveTree | `2f7f08c3078c906645af6fc641dcffcf61896386`, `codex/fix-content-cache-consistency`. 콘텐츠 목록/검색 HTTP 캐시와 사용처 없는 전역 등록 제거 | 같은 회귀 3 FAIL·1 PASS → 4 PASS. 단위 70, 전체 DB/HTTP E2E 17, format·lint·build PASS. 인증·DB soft-delete·embedding 보존 유지 |

재현 시험은 이제 각 제품 소스에 포함된다. Siku `tests/e2e/settlement-lock.spec.ts`와
`docs/specs/settlement-parent-lock.md` 및 같은 이름의 `-evidence.json`, DriveTree
`backend/test/content-cache-consistency.e2e-spec.ts`와 `docs/specs/content-cache-consistency.md`에서
실행 조건·로그 digest·수용 기준과 한계를 확인한다. 기존 E2E 명령이 새 시험을 발견한다.

독립 검토에서 Siku의 INSERT/DELETE 유지 사례를 보강했고, DriveTree 시험의 하드코딩된 관리자
fixture가 기존 CI 계정과 맞지 않는 문제를 수정했다. DriveTree는 서로 다른 로컬 관리자 설정으로
동일 시험을 원래 코드와 수정 코드에 실행해 RED/GREEN을 다시 확인했다. 로그인 대역이나 기대값
완화로 해결하지 않았다. 최종 코드·시험 후보를 읽기 전용으로 재검토했고 남은 차단 지적은 없었다.

판정은 **확인된 두 결함의 로컬 수정·회귀 검증 PASS, 병합·배포 미실행**이다. Siku 운영 migration,
동시 정산 확정 경쟁 조건, DriveTree 프런트 상세 페이지의 별도 1시간 ISR은 검증 범위 밖이다.
DriveTree 목록 캐시 제거로 요청마다 DB를 조회하는 비용이 생기며 성능 SLO 통과를 주장하지 않는다.
webhook 실제 JWT/audience·사용자 tenant 권한 및 실패 payload 영속 보존은 여전히 미확인이다.
따라서 다섯 제품 전체 QA·출시가 완료됐다는 판정으로 확대하지 않는다.

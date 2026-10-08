# API 설계 표준

서비스 간·프론트-백 계약의 단일 기준. 미니서비스 분리(`architecture-infra.md` §2)의 전제 조건.

## URL·메서드

- 리소스는 **복수 명사 + kebab-case**: `/api/v1/purchase-orders`, `/api/v1/purchase-orders/{id}/items`
- 행위는 HTTP 메서드로: `GET`(조회) `POST`(생성) `PUT`(전체수정) `PATCH`(부분수정) `DELETE`(삭제)
- 메서드로 표현 불가한 도메인 행위만 동사 서브리소스 허용: `POST /purchase-orders/{id}/approve`
- 버저닝: URL 경로 `/api/v1/...` — 호환 깨지는 변경에만 버전 증가

## 공통 응답 Envelope (확정)

성공/실패 모두 동일 구조. HTTP 상태코드는 의미에 맞게 병행 사용한다 (envelope이 있다고 전부 200 금지).

```json
// 성공 (200/201)
{ "code": "OK", "message": null, "data": { "orderId": 123 } }

// 실패 (4xx/5xx)
{ "code": "ORDER_LIMIT_EXCEEDED", "message": "월 주문 한도를 초과했습니다", "data": null }
```

**에러 코드 체계**: `SCREAMING_SNAKE` + 도메인 모듈 프리픽스 (`ORDER_`, `INVENTORY_`, `AUTH_`, 공통 `COMMON_`).
코드는 모듈별 enum으로 중앙 관리하고, 프론트는 `code`로 분기한다 (message는 표시용 — 분기 금지).

| HTTP | 용도 | code 예 |
|---|---|---|
| 400 | 입력 검증 실패 | `COMMON_VALIDATION_FAILED` (+ `data.fieldErrors[]`) |
| 401 | 미인증 | `AUTH_UNAUTHENTICATED` |
| 403 | 권한 없음 | `AUTH_FORBIDDEN` |
| 404 | 리소스 없음 | `ORDER_NOT_FOUND` |
| 409 | 상태 충돌·중복 | `ORDER_ALREADY_APPROVED` |
| 500 | 서버 오류 | `COMMON_INTERNAL_ERROR` (내부 정보 노출 금지) |

에러 변환은 **전역 핸들러 한 곳**에서만 (`@RestControllerAdvice` 등) — 컨트롤러에서 envelope 수동 조립 금지.

**클라이언트 입력 오류는 4xx로 — 5xx 흡수 금지**: 잘못된 입력(역직렬화 실패·타입 불일치·검증 위반)이
전역 핸들러에 매핑이 없으면 **프레임워크 기본이 5xx로 흡수**해 on-call 알람·에러지표를 오염시킨다.
이들을 **4xx + 공통 Envelope**로 매핑한다. 5xx는 서버 실패에만 쓴다. (프레임워크별 예외명·핸들러는
스택 룰 파일 참조)

## 필드·데이터 포맷

- JSON 필드: **camelCase**
- 날짜/시각: **ISO 8601 + UTC** (`2026-06-11T03:00:00Z`) — 저장·전송은 UTC, 표시 변환은 클라이언트
- 금액: 통화·단위·최대 절댓값·소수 자릿수·반올림 모드/시점을 API와 DB에서 함께 정의한다.
  JSON number는 지원 클라이언트의 파싱·연산·합계·재직렬화까지 정밀도와 범위를 확인한 제한된 도메인만 허용한다.
  정확한 십진 금액은 정규화한 decimal 문자열, 또는 통화/scale을 명시한 최소 화폐 단위 정수로 계약한다.
  JS number로 전달하는 정수는 중간 연산·합계까지 `Number.isSafeInteger` 범위여야 한다.
  범위를 넘는 정수도 문자열로 전달하고, 클라이언트가 이를 무조건 `Number`로 변환하지 않게 한다.
  DB `numeric`만으로 JSON/클라이언트 정밀도가 보존되지는 않는다 ([금액 저장·전송 계약](db-standards.md#금액-저장전송-계약)).
  [JSON 숫자 상호운용 범위](https://www.rfc-editor.org/rfc/rfc8259.html#section-6)와
  [JS 안전 정수](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)를 따른다.
- enum 값: `SCREAMING_SNAKE` 문자열

## 페이지네이션·정렬·검색

백오피스 표준인 **offset 방식 기본**:

```
GET /api/v1/orders?page=0&size=20&sort=createdAt,desc&status=CONFIRMED
```

```json
{ "code": "OK", "message": null, "data": { "content": [...], "page": 0, "size": 20, "totalElements": 1234, "totalPages": 62 } }
```

- `size` 상한 100 강제 (무한 조회 방지)
- 대용량 무한스크롤/동기화 API만 cursor 방식 예외 허용 (문서화 필수)

## OpenAPI 스펙

- **코드 우선**: 컨트롤러 어노테이션에서 생성 (Spring: springdoc-openapi / NestJS: @nestjs/swagger)
- CI가 스펙(JSON)을 아티팩트로 생성 → 프론트는 스펙에서 **타입 자동 생성** (openapi-typescript) — 수동 타입 작성 금지
- 생성은 수동 타입 중복을 줄이지만 요구·설명·권한·오류·경계와 구현의 일치를 자동 보장하지 않는다.
  변경 operation의 생성 스펙 diff를 요구/수용 기준과 리뷰하고, 실제 응답·입력 검증·인증/인가 거부 사례와 대조한다.
  공통 핸들러의 오류 envelope/status, 보안 설정과 operation별 `security`, 금액 범위·표현도 확인한다.
  생성 타입이 컴파일된 사실을 런타임 검증·접근 제어·호환성 검사 통과로 보고하지 않는다.
  [OpenAPI Responses](https://spec.openapis.org/oas/v3.2.1.html#responses-object)와
  [Security Requirement](https://spec.openapis.org/oas/v3.2.1.html#security-requirement-object)는 계약 기술 형식이며 집행 증거는 별도다.

## 기타 규칙

- `PUT`/`DELETE`는 멱등하게 구현. 결제·전표 생성 등 중복 위험 `POST`는 `Idempotency-Key` 헤더 지원
  - 재시도 검증은 저장 전 실패와 **저장 성공 후 응답 유실**을 구분한다. 격리 환경에서 같은 논리 요청의
    재시도·동시 요청·새로고침 후 중복 저장/표시가 없고 후속 수정이 보존되는지 확인한다. 다른 payload의
    키 재사용, 키 유효기간·재시작 동작은 제품 계약에 맞춰 판정한다. 목 응답만으로 저장 정합성을 증명하지 않는다.
    [QA 범위·완료 기준](ai-collaboration.md#qa-범위와-완료-기준)에 조건·기대값·실제 관찰 경계를 연결한다.
- **낙관적 잠금 응답의 `version` 정확성**: update 응답은 **영속화 flush 후**(증가된 버전이 반영된
  상태) 매핑한다 — flush 전에 매핑하면 stale version을 반환해, UI가 그 값으로 재수정하면 거짓 409
  충돌을 유발한다 (ORM별 구체는 스택 룰 파일 참조)
- 서비스 간 호출도 이 표준 동일 적용 (envelope 포함) + 호출 측 타임아웃 명시 필수
- 응답에 내부 구조 노출 금지: 스택트레이스, SQL, 내부 ID 체계(외부 노출은 채번 코드 — `db-standards.md`)

## CSV·스프레드시트 export

- **CSV 구문 escape와 formula 중화는 별개다.** 구분자·따옴표·개행은 CSV writer로 escape한다.
  큰따옴표로 감싼 `"=SUM(1,2)"`도 파싱 뒤 `=SUM(1,2)`이며, spreadsheet가 수식으로 해석할 수 있다.
- 비신뢰 문자열의 수식 시작 문자(`=` `+` `-` `@`, TAB/CR/LF, locale별 전각 변형)와 셀 경계를 함께 다룬다.
  `'`·공백·인용 어느 하나도 모든 소비 도구와 재저장의 안전을 보장하지 않는다.
  [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection)은 Excel 재저장/재열기 위험과 도구별 차이를 설명한다.
- 지원 도구·버전·locale·직접 열기/가져오기 설정·재저장/재열기 경로를 정하고, 텍스트 import 또는 명시적 텍스트 셀 형식과
  중화 방식을 그 경로에서 검증한다. OWASP의 quoted TAB 방법도 Excel 대상 관찰이며, TAB이 원래 데이터에 남는 비용이 있다.
  CSV에는 셀 타입이 없고, typed workbook도 비신뢰 값을 수식 셀로 쓰면 안전하지 않다.
- 합성 정상 값·수식 모양 값·구분자/따옴표/개행을 실제 export로 생성해 셀 값·타입·수식 여부와 재저장/재열기를 대조한다.
  [Excel import 설정](https://support.microsoft.com/en-us/excel/text-import-wizard),
  [CSV 열기/저장](https://support.microsoft.com/en-us/excel/get-started/import-or-export-text-txt-or-csv-files)과
  [Sheets import](https://support.google.com/docs/answer/40608?hl=en)/[export](https://support.google.com/docs/answer/9331167?hl=en)를 기준으로 경로를 고정한다.
  소비 앱을 실행하지 못한 경로는 **UNVERIFIED**다. CSV parser 왕복이나 한 도구의 표본을 전체 formula 방지 PASS로 확대하지 않는다.

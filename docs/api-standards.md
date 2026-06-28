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

**클라이언트 입력 오류는 4xx로 — 5xx 흡수 금지**: 잘못된 enum·깨진 JSON 본문·경로변수 타입 불일치가
전역 핸들러에 매핑이 없으면 **500으로 흡수**돼 on-call 알람·에러지표를 오염시킨다(erp 실측).
역직렬화·타입변환·제약위반 예외(Spring: `HttpMessageNotReadableException`·
`MethodArgumentTypeMismatchException`·`ConstraintViolationException` 등)를 **400 + 공통 Envelope**로
매핑한다. 5xx는 서버 실패에만 쓴다.

## 필드·데이터 포맷

- JSON 필드: **camelCase**
- 날짜/시각: **ISO 8601 + UTC** (`2026-06-11T03:00:00Z`) — 저장·전송은 UTC, 표시 변환은 클라이언트
- 금액: 문자열 아닌 number, 소수 정밀도는 도메인 정의 따름 (DB는 numeric — `db-standards.md`)
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
- 스펙과 구현의 드리프트가 원천 차단되는 구조이므로 스펙 별도 리뷰는 하지 않는다

## 기타 규칙

- `PUT`/`DELETE`는 멱등하게 구현. 결제·전표 생성 등 중복 위험 `POST`는 `Idempotency-Key` 헤더 지원
- **낙관적 잠금 응답의 `version` 정확성**: update 응답 DTO를 **flush 전에** 매핑하면 `@Version` 증가가
  반영되지 않아 stale version을 반환한다 → UI가 그 값으로 재수정하면 거짓 409 충돌(erp 실측). update
  응답은 **flush 후**(또는 재조회) 매핑해 증가된 version을 반환한다
- 서비스 간 호출도 이 표준 동일 적용 (envelope 포함) + 호출 측 타임아웃 명시 필수
- 응답에 내부 구조 노출 금지: 스택트레이스, SQL, 내부 ID 체계(외부 노출은 채번 코드 — `db-standards.md`)

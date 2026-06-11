# 인증·인가 표준

ERP/SCM의 권한 모델은 후행 도입 시 전체 재작업이 되는 영역 — 첫 모듈부터 이 표준을 적용한다.

## 인증 (Authentication) — Keycloak (확정)

- **IdP: Keycloak 셀프호스트** (컨테이너 배포, `infra` repo에서 Terraform 관리)
- 프로토콜: **OIDC** — 모든 서비스·프론트가 표준 토큰으로 통일
- 사용자 화면 로그인: **Authorization Code + PKCE**
- 서비스 간 호출: **Client Credentials** (서비스 계정별 클라이언트 분리)
- 토큰 수명: access 5–15분 / refresh는 IdP 정책으로 — access 토큰 장기화 금지
- MFA·패스워드 정책·계정 잠금은 전부 **IdP에 위임** (자체 구현 금지)
- 향후 사내 SSO(AD/Okta 등) 등장 시 Keycloak의 Identity Brokering으로 연동 — 앱 코드 무변경

**토큰 취급 (프론트)**
- access 토큰을 `localStorage`에 저장 금지 — XSS 한 방에 털린다
- 권장: **BFF 패턴**(Next.js 서버가 토큰 보관, 브라우저는 httpOnly secure 쿠키 세션) 또는
  메모리 보관 + silent refresh. 선택은 프론트 스캐폴드 시점에 확정
- 백엔드는 모든 요청에서 서명·만료·audience 검증 (게이트웨이/필터 공통화)

## 인가 (Authorization) — RBAC + 데이터 스코프

권한 검사는 두 축이 **직교**한다:

| 축 | 질문 | 모델 |
|---|---|---|
| 기능 권한 | 이 기능을 쓸 수 있나? | RBAC: 사용자 → 역할 → 권한 |
| 데이터 스코프 | 어느 범위의 데이터를 보나? | 조직/부서 단위 스코프 |

**기능 권한 (RBAC)**
- 권한 코드: `{모듈}:{리소스}:{액션}` — `order:purchase-order:create`, `settlement:invoice:approve`
- 역할 = 권한의 묶음 (예: `구매담당자`, `정산관리자`) — **코드는 권한을 검사하고, 역할은 운영이 관리 화면에서 조합**한다. 코드에 역할명 하드코딩 금지 (역할 개편 때마다 배포하게 됨)
- 검사 위치: application 유스케이스 진입점 (`clean-architecture.md` 계층 기준) — 컨트롤러 어노테이션은 보조
- UI 메뉴/버튼 노출도 같은 권한 코드 기반 (프론트는 내 권한 목록 API로 제어 — 단 **서버 검사가 항상 최종**)

**데이터 스코프**
- 사용자 소속(부서/조직)과 스코프 정책(자기 부서만/하위 포함/전사)을 기준정보 모듈에서 관리
- 적용은 조회 쿼리에 공통 적용 (리포지토리 공통 필터) — 화면별 수작업 필터 금지 (누락 = 정보 유출)
- 도메인 결재선(승인 권한)은 RBAC가 아니라 **해당 도메인 모듈의 업무 규칙**으로 구현

**저장·감사**
- 역할·권한·매핑은 DB 관리 (기준정보 모듈 + 관리 화면)
- 권한 변경은 `db-standards.md` 감사 대상 — 누가 누구에게 어떤 권한을 줬는지 이력 필수

## 보안 공통 규칙

- 입력 검증: adapter 경계에서 (Bean Validation 등) — 길이·형식·범위. 도메인 불변식은 domain에서
- 개인정보: 식별 컬럼은 설계 시 표시 — 응답 마스킹(주민번호·계좌 등), 필요 시 컬럼 암호화, 로그에 개인정보 출력 금지
- 시크릿: 코드·설정 파일에 금지 — AWS Secrets Manager/SSM Parameter Store (`stack-guide.md` 운영 결정)
- release 전 자동 점검: security-reviewer 에이전트(XSS·SQL 인젝션·하드코딩 시크릿·`.env` 추적 — `harness-guard`) + CI secret-scan(gitleaks — 계층 0 `ci-gate.yml`).
  **OWASP Top 10 전체를 대체하지 않는다** — 접근 제어(A01)·인증 설정은 코드 리뷰(권한 변경 시 리드 지정, `code-review.md`)에서 확인

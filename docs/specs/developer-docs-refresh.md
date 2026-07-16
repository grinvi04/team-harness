# developer-docs-refresh 스펙

## 1. 목표 & Why

`intro.html`의 전체 구조 설명과 `developer-workflow.md`의 실행 절차를 최신 v0.56.0 기준으로 연결하고,
개발자가 자신의 현재 상태에서 다음 행동을 빠르게 찾을 수 있는 독립 HTML 가이드를 제공한다.
**성공 기준(측정 가능): Markdown 정본과 두 HTML의 버전·핵심 워크플로·상호 링크가 자동 검증되고,
모바일·키보드·reduced-motion 환경에서도 가이드를 사용할 수 있다.**

## 2. Scope

- **In:** `developer-workflow.md` 최신화, 독립 `developer-workflow.html` 생성, `intro.html`·README의 진입점 연결,
  문서 버전·링크·핵심 계약·접근성 회귀 테스트.
- **Out (Non-goals):** 스킬 실행 계약 변경, 가드·라우터 동작 변경, 플러그인 버전 변경, 외부 웹 호스팅,
  Markdown과 HTML을 자동 변환하는 빌드 파이프라인 도입.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (역할 분리):** WHEN 개발자가 문서 진입점을 열면, the system SHALL `intro.html`은 전체 구조,
  `developer-workflow.html`은 일상 작업 절차, `developer-workflow.md`는 편집 가능한 정본임을 명확히 안내한다.
- **AC-2 (최신성):** WHEN 플러그인 버전과 스킬 목록을 확인하면, the system SHALL 두 HTML이 현재 manifest
  버전과 16개 스킬 체계를 일관되게 표시하고 대표 진단·완료 검증 스킬을 포함한다.
- **AC-3 (행동 탐색):** WHEN 개발자가 계획·개발·디버깅·검증·머지·릴리즈 중 하나를 하려 하면,
  the system SHALL 시작 위치, 사용할 스킬, 완료 증거와 막혔을 때의 다음 행동을 한 페이지에서 찾게 한다.
- **AC-4 (상호 연결):** WHEN intro·개발자 HTML·Markdown·README 중 하나에서 문서를 탐색하면,
  the system SHALL 나머지 관련 문서로 이동할 수 있는 유효한 상대 링크를 제공한다.
- **AC-5 (접근성·반응형):** WHILE 키보드·모바일·reduced-motion 환경을 사용하면, the system SHALL
  skip link, 가시적 focus, 의미 구조, 모바일 레이아웃, 동작 감소 설정을 제공한다.
- **AC-6 (정적 배포):** IF JavaScript나 외부 네트워크가 없더라도 THEN the system SHALL 핵심 콘텐츠와
  내비게이션을 그대로 제공한다.

## 4. 제약 / 비기능

- 외부 폰트·프레임워크·이미지에 의존하지 않는 단일 정적 HTML이어야 한다.
- 본문 폭과 대비는 장문 읽기에 적합해야 하며, 360px 이상 화면에서 가로 스크롤 없이 동작해야 한다.

## 5. 경계 / Do-Not

- ✅ 해도 됨: 문서 정보 구조·카피·CSS를 목적에 맞게 재구성하고 정적 HTML을 추가한다.
- ⚠️ 먼저 물어봐: 자동 생성 파이프라인이나 외부 호스팅을 새로 도입한다.
- 🚫 절대 금지: 스킬·가드 실행 계약을 문서 최신화에 섞어 변경하거나 Markdown 정본을 제거한다.

## 6. Open Questions

- 없음. 사용자가 HTML 추가 여부와 상세 방향을 최선의 판단에 맡겼다.

## 7. 기술 접근 (HOW)

- `developer-workflow.md`를 내용 정본으로 유지하고, HTML은 작업 상태→스킬→증거를 빠르게 스캔하는
  별도 정보 구조로 작성한다. 자동 생성기는 이 규모에 과하므로 도입하지 않는다.
- 개발자 HTML은 “작업 관제판”을 시각 언어로 사용한다: 차분한 청회색 작업면, 상태 신호색, 흐름 레일,
  명령·증거용 고정폭 서체. 장식 대신 상태·게이트·순서가 구조를 만든다.
- `tests/developer-docs-test.sh`가 manifest 버전 parity, 핵심 스킬, 상호 링크, 접근성 표식과 로컬 링크
  존재를 검사한다. CI quality 잡에 구문·실행 단계를 연결한다.
- 영향 파일: `docs/developer-workflow.md`, `docs/developer-workflow.html`, `docs/intro.html`, `README.md`,
  `.github/workflows/ci-gate.yml`, `tests/developer-docs-test.sh`.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(이 명령 exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | 개발자 문서 계약 테스트를 RED로 추가 | AC-1~6 | `tests/developer-docs-test.sh`, `.github/workflows/ci-gate.yml` | `bash -n tests/developer-docs-test.sh && ! bash tests/developer-docs-test.sh` | — | |
| 2 | Markdown 정본 최신화와 개발자 HTML 구현 | AC-1~6 | `docs/developer-workflow.md`, `docs/developer-workflow.html` | `bash tests/developer-docs-test.sh` | #1 | |
| 3 | intro·README 진입점 연결과 전체 검증 | AC-1, AC-2, AC-4 | `docs/intro.html`, `README.md` | `bash tests/developer-docs-test.sh && git diff --check` | #2 | |

## 9. 승인 게이트

사용자가 “필요하면 HTML로 만들어도 상관없고 더 좋은 방향으로 진행”하도록 명시해,
Markdown 정본 + 작업 관제판 HTML + intro 상호 연결 방향을 승인한 것으로 간주한다.

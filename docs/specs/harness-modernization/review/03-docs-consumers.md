# 문서·소비 프로젝트·직접 소비자

## D01 — 줄 수 제한은 구조와 읽기 비용을 대신하지 않는다

현재 tracked MD 253개의 본문을 검토했다. 23개가 199줄을 초과한다. 전역 소유 MD 7개와 지도 문서도 별도로 검토했다.
공통 지침은 이미 152줄이지만 16,162바이트다. 길게 압축한 한 줄은 읽기 비용과 규칙 누락을 줄이지 않는다.
내용 단위로 분리하고 제목·책임·우선순위·적용 조건·필수 읽기를 명확히 해야 한다.

## D02 — 링크가 자동 로딩을 뜻하지 않는다

Codex는 AGENTS.md 체인과 설정된 fallback을 읽는다. 현재 CLAUDE.md fallback은 설정돼 있지 않다.
중요한 권한·원본 보존·미확인 완료 금지는 자동 진입점에 유지한다. 작업별 세부 문서는 실행 전에 명시적으로 읽게 연결한다.
199줄을 맞추며 핵심 규칙을 참조 파일로만 옮기면 규칙이 실제 실행에 전달되지 않을 수 있다.

## D03 — 역사와 현재 규칙이 구별되지 않는 부분

과거 managed hook·cache patch·agent copy·unified_exec 지침과 최신 native-first 결정이 같은 문서에서 현재 규범처럼 보인다.
[decisions](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/decisions.md)와 과거 스펙은 당시 후보·수용 기준·실패를 보존하고, 대체된 부분에 현재 정본을 연결해야 한다.
과거의 80KB 무분할 결정도 이번 199줄 지시의 현행 근거로 사용하지 않는다. 과거 PASS를 새 후보에 옮기지 않는다.

## D04 — 루트 Claude 안내의 모델·위임·참조

[CLAUDE.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/CLAUDE.md)는 Explore/General Purpose 호출을 일괄 전제하지만 현재 전역 규칙은 작업 비용·독립성에 따라 선택한다.
실전 결정표·세션 위생 등의 참조 제목도 현재 대상 문서와 맞지 않는다.
Workflow surface 가용성은 실제 실행과 별도로 확인해야 한다. 모든 고정 역할의 모델·effort도 재선정 대상이며 권한·독립성 계약과 따로 판단한다.

## D05 — 현행 README·그림의 오래된 사용 안내

[README](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/README.md)는 현재 0.81.0 안내와 Codex refresh 예시의 0.70.0을 함께 담고 있다.
[architecture.png](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/architecture.png)를 직접 확인했다. Claude 설정 중심 계층과 사람 승인 1+를 일률적으로 보여줘 현재 Codex 경로·solo/develop 정책과 맞지 않는다.
[gitflow 그림](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/architecture-gitflow.png)도 직접 확인했다. 문서·이미지·소개 HTML의 현행 정책을 같은 범위에서 대조해야 한다.

## D06 — CSV quoting을 수식 방어로 취급하면 안 된다

[API 표준](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/api-standards.md#L83)은 quote/apostrophe/space를 대안처럼 제시한다.
순수 CSV round-trip에서 `=1+1`을 큰따옴표로 감싸도 읽으면 같은 수식 문자열이다. 실제 Excel/Sheets 실행은 하지 않았다.
[OWASP](https://community.owasp.org/attacks/CSV_Injection)는 소비 도구와 재저장 과정의 한계를 설명한다. 소비자에 맞는 중화와 CSV escape를 함께 검증해야 한다.

## D07 — OpenAPI·금액 표준의 보장 범위

코드에서 OpenAPI를 생성한다고 요구·권한·경계·설명 누락과 drift가 불가능해지는 것은 아니다. 독립 계약 검토를 없애는 표현을 줄여야 한다.
JSON number와 DB numeric의 금액 표현도 소비자의 정밀도·최댓값·반올림 계약을 밝혀야 한다.
이 항목은 표준 보완·명료화이며, 네 앱 모두의 실제 금액 오류를 재현했다는 의미가 아니다.

## D08 — 로그 위치와 참조 경로

Codex 가드 로그의 현행 wrapper는 PLUGIN_DATA/guard-block.log를 쓰는데 운영·문제 해결 안내에 ~/.codex/hooks가 남아 있다.
실제 누락: ERP biz-vat 문서의 roadmap-localization 링크, siku README의 screenshot 자산 3개, architecture 표준의 docs/docs 상대 경로.
자동 링크 스캔은 436개 경로를 대조했지만 7개 apparent missing 중 예시·template 미래 경로도 있다. 이를 전부 결함으로 세지 않았다. 앵커·외부 URL 전수 검사는 아니다.

## D09 — 패키징·가드·검사기가 문서에 의존한다

F5와 route-intent는 docs/specs/<name>.md 및 최상위 스펙 탐색을 사용한다. 진입 경로를 유지해야 한다.
Codex skill wrapper는 상대 경로와 Codex 실행 제목을, loop 시험은 Phase 제목을 읽는다.
[package catalog](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/packaging/packages.json)는 loop/milestone SKILL의 명령 결합을 지정한다. 본문을 references로 옮기면 catalog·builder·binding 시험도 바꿔야 한다.
여러 product-boundary/flagship/platform/native-pilot 시험은 decisions의 문자열·세 제목 순서에 의존한다. 문자열 통과와 의미 판정은 구분한다.
CHANGELOG는 전체 태그로 생성하고 CI가 루트 파일과 바이트 비교한다. 나누려면 생성기·정본·CI를 함께 변경해야 한다.

## D10 — 프로젝트 지도 파서의 제목·본문 의존

지도 서비스 (`/Users/grinvi04/Documents/Codex/2026-10-07/claude-chatgpt-codex-codex-native-claude/outputs/project-map-service/projects.py`, 당시 로컬 원본)는 설정된 문서 경로·한국어 제목·굵은 AC를 읽는다.
순수 파서 시험에서 4개 roadmap의 전체 단계 제목을 바꾸거나 quality/commercial 본문을 링크만 남긴 index로 바꾸면 ValueError였다.
고정 제목·AC·날짜·후보 SHA를 보존하거나 파서를 함께 이전해야 한다. 원본 지도 서비스 파일은 변경하지 않았다.
Harness의 과거 지도에는 현재 입력이 아니라는 경계 문구가 있다. 오래된 기록을 현행 상태 오보로 분류하지 않았다.

## C01 — ERP 테넌트 안내가 현재 구현과 다르다

ERP AGENTS (`/Users/grinvi04/project/erp/AGENTS.md:70`, 당시 로컬 원본)는 @Filter 자동 적용·수동 tenant 조건 금지를 안내한다.
현재 BaseEntity는 @TenantId이고 AuditLogRepository에는 수동 tenant 조건이 필요하다.
DB 기반 DataScopeProvider/ApprovalAuthorityProvider 구현이 있는데 decisions의 JWT scope/authority·미완료 설명도 오래됐다.
문서·표준을 구현과 맞춰야 한다. 이번에 ERP 전체 테넌트 보안 시험을 다시 했다는 뜻은 아니다.

## C02 — DriveTree QA 명령과 Git 전달 안내

AGENTS (`/Users/grinvi04/project/drivetree/AGENTS.md:54`, 당시 로컬 원본)의 변경 없는 전체 QA와 CLAUDE/decisions/Makefile의 축소·format --write 흐름이 충돌한다.
backend의 format 명령과 Makefile은 파일을 쓰고 필요한 검사가 일부 빠져 있다.
CI_CD의 main/develop 직접 merge/push 안내는 현재 wrapper·보호 계약과 충돌한다. 현행 명령 하나로 연결해야 한다.

## C03 — DriveTree DB 시험과 하위 지침 로딩

backend CLAUDE는 실제 DB 시험을 금지하지만 quality 스펙은 DB 통합 시험을 요구한다.
backend/frontend CLAUDE의 중요 규칙을 root AGENTS가 Codex에 명시적으로 전달하지 않고 fallback도 없다.
신규 세션에서 실제 로딩은 미실행이다. 안전한 로컬 테스트 DB의 허용 범위와 필수 읽기 경로를 통일해야 한다.

## C04 — 복사한 stack rule의 적용성

siku의 Vite 프로젝트에 eslint-config-next 지시가 있고 type-check 스크립트는 없다. 실제 build는 tsc를 수행한다.
ERP Java rule의 도메인 @Entity 금지와 현재 Employee의 @Entity가 맞지 않는다.
표준 파일과 같은 바이트라는 사실만으로 소비 스택 적합성을 판단하지 않는다. 직접 명령·기술 선택과 대조해야 한다.

## C05 — 현재 계획과 과거 계획의 구별

DriveTree NEXT_STEPS의 npm install 안내, CI 변경 금지, PUBLIC_API_PLAN의 단계와 다른 취소·최신 기록 사이에 차이가 있다.
원격 staging 실패는 quality 스펙에 구분돼 있으나 상위 진입 문서에서 찾기 어렵다.
Webhook decisions의 SDK 미도입 설명과 requirements의 SDK 7.1.1이 다르다. 과거 기록은 보존하고 현행 안내로 연결한다.

## C06 — 실행 디렉터리·저자 표기

ERP release-readiness의 cd backend 후 cd frontend 안내는 sibling 폴더 구조와 맞지 않는다.
Webhook/DriveTree의 고정 Sonnet Co-author 문구는 실제 다른 모델 사용 시 출처를 잘못 표시할 수 있다.
실제 작성·도움·실행 모델의 근거에 맞춰야 한다. 사람의 직접 기여를 AI 출처와 섞지 않는다.

## C07 — 원본 보존 문서·현재 후보

DriveTree DESIGN에는 원본 보존 지시가 있다. 기계적 편집 대신 내용 보존 분할·원본 Git 후보 연결 또는 명시적 예외 설계를 제안해야 한다.
네 소비 프로젝트의 현재 product/quality 문서와 지도 문서를 대조했다. ERP의 원본 feature HEAD는 develop로 교체하지 않았다.
이전 로컬 PASS는 그 당시 후보의 기록이다. 향후 문서·설정 변경 후보에는 영향 검사를 새로 연결한다. 배포는 이번 완료 기준에서 제외한다.

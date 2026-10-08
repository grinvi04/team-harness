# 의사결정 기록 (Decision Log)

확정된 기술·프로세스 결정의 **단일 출처**. "무엇이 언제 확정됐고, 어느 문서가 정본인가"를 한 곳에서 답한다.

> 존재 이유: 결정이 문서 곳곳의 "(확정)" 표기로 흩어져 있으면, 먼저 쓰인 문서에 후속 결정이
> 역반영되지 않아 문서 간 모순이 생긴다 (2026-06 정합성 검토에서 동일 패턴 3건 확인).

## 규약

- 새 결정 확정 시: **이 표에 행 추가 + 영향받는 문서 갱신을 같은 PR에서** 처리한다
- 결정 변경 시: 행을 지우지 않고 상태를 `대체됨(→新행)`으로 바꾼다 — 이력 보존
- "검토 중"인 것은 여기 적지 않는다 — 확정만 기록 (후보 비교는 stack-guide.md 영역)

## 결정 목록

| 결정 | 시점 | 정본 문서 | 영향 문서 |
|---|---|---|---|
| **QA 보고는 명령별 원문에 결박, 프로젝트 계약은 AGENTS로 연결** — 같은 이름의 일반 검증 스킬을 Harness 계약 적용으로 간주하지 않는다. 제공된 Harness 계약을 실제 경로로 연결하고 미제공 시 최소 QA 기준과 미로딩을 밝힌다. native 선택/로딩은 복제하지 않으며 보고의 명령·디렉터리·후보·시도를 대조한다. | 2026-09-29 | verification-before-completion skill, qa-evidence-guide.md | AGENTS.md, templates/AGENTS.md, specs/qa-command-binding-validation.md |
| **요구·위험에서 QA 범위와 완료 기준 도출** — 기존 테스트 목록 대신 요구·소비자 경계·실패 영향으로 필수 사례와 관찰 가능한 품질 기준을 정한다. 에이전트가 검증을 수행하며 발견 결함의 수정과 원래 목표 달성을 구분한다. 결과 계약은 Harness가 소유하고 기존 개발 흐름에 연결하며 제품별 테스트·브라우저 실행은 위임한다. | 2026-09-29 | ai-collaboration.md, verification-before-completion skill | plan·feature-add·feature-modify·systematic-debugging·qa skill, frontend-design-standards.md, api-standards.md, development-coordination.md, specs/qa-scope-contract.md |
| **상태 라우팅은 후보, delivery는 현재 계약에 연결** — 과거 스펙·Git 상태로 고른 skill을 현재 단계로 단정하지 않고 실제 요청·기존 승인과 대조한다. 릴리즈·역병합 PR은 채택 repo의 문서 선언을 사전에 검사하고, 역병합의 사람 승인 여부는 대상 브랜치의 현재 보호 정책을 따른다. 라우팅 판정·JSON 계약·보호 게이트·소비 repo의 선택 도입 범위는 유지한다. | 2026-09-23 | ai-collaboration.md, specs/workflow-advisory-boundary.md | route-intent.mjs, release·pr-review-gate skill |
| **개인 개발부터 재사용·점진적 확산** — 사용자 목표에 맞춰 반복 설정·조사·검사 구성을 줄이는 것을 우선한다. 기존 GitHub 거버넌스는 연결 프로젝트에서 유지하고 로컬 샘플에 원격 생성·공개를 강요하지 않는다. 전체 시작 자동화는 아직 미완료로 추적한다. 기존 제품 방향의 거버넌스 전용 정체성은 이 결정으로 대체한다. | 2026-09-22 | product-direction.md, specs/personal-development-flow.md | README.md, AGENTS.md, onboarding.md, quick-start.md, product-boundaries.md, development-coordination.md |
| **Codex 저위험 구현 위임과 문서 현행화** — 현재 agent가 모든 구현을 해야 한다는 native wrapper 제한을 수정한다. 승인된 모델·effort의 scoped worker를 허용하고, 테스트 계약 검수·Git 통합·최종 판정은 부모가, 독립 반증은 다른 인스턴스가 맡는다. 기술적 권한 제한·CI·리뷰는 완화하지 않는다. 로드맵·체크리스트·진행 문서의 상태 대조를 개발·인계·완료 기준에 연결한다. 전역 설정 변경이나 특정 모델 사용량 할당제는 도입하지 않는다. | 2026-09-22 | specs/personal-development-flow.md, model-tiering.md, ai-collaboration.md | codex/native-runtime.md, Codex feature-add·feature-modify·ao-coordinate wrapper, 공용 개발·검증 skill, templates/AGENTS.md |
| **커밋 검사 신뢰 경계 분리** — 기본 브랜치의 metadata 전용 target workflow를 사용한다. 기존 필수 검사는 새 `commitlint-trusted`의 실제 PR 성공 확인 후 교체하며, PR 코드 실행·별도 App·수동 성공 상태 게시 없이 단계적으로 적용한다. | 2026-09-21 | specs/trusted-commitlint.md | code-review.md, specs/self-repo-common-gates.md |
| **Agent Orchestration에서 필요한 인계·재개 원칙만 선택 통합** — 사용자 정정에 따라 초안의 별도 npm 패키지·선언 검사 4개·기록 생성 CLI·연구용 역할 체계를 제거한다. 현재 요구·담당 범위·후보별 검증·다음 행동만 짧은 ao-coordinate로 연결하고 기존 workflow와 core gate를 유지한다. 초기 전체 이관 초안과 과거 증거는 Git에 보존한다. 후보 0.69.0; 전역 변경·Jev·새 runtime 실험은 제외한다. | 2026-09-20 | development-coordination.md, specs/agent-orchestration-integration.md | product-direction.md, product-boundaries.md, ai-collaboration.md, onboarding.md, README.md |
아래 후속 표는 원래 기록 순서를 유지한다. 과거 결정·대체 관계를 판단할 때 해당 표도 읽는다.

- [초기 표준과 거버넌스 하드닝 결정](decisions-foundation-and-hardening.md)
- [native 전환·제품 경계·소비 인수 결정](decisions-native-and-delivery.md)

## 브라우저 자동화 도구 선택 (2026-09-22)

현재 로컬 Spring Boot+Vue 검사 연결은 Playwright Test를 유지한다. Stagehand v4 도입 검토는
브라우저 실행을 외부 도구에 **위임**하는 선택이며 새 공용 실행기나 호환 계층을 만들지 않는다.

Stagehand v4는 테스트 프레임워크가 아니며 Playwright Page와 직접 호환되지 않는다.
현재 샘플이 사용하는 역할·라벨 locator, 요청 모킹, assertion과 Playwright 전용 접근성 연결은
그대로 옮길 수 없다. 테스트 실행·실패 진단까지 다시 구성할 근거가 아직 없다.
공식 근거: [Playwright 이관 안내](https://docs.stagehand.dev/v4/migrations/playwright).

자연어로 화면을 탐색·조작하는 별도 업무가 생기면 Stagehand를 선택 후보로 검토한다.
Codex 연결은 현재 실험적 통합이며, 모델·인증·비용 경로는 Codex 전역 모델 설정과 별개로 확인해야 한다.
로컬 브라우저 실행도 모델 추론까지 로컬이라는 뜻은 아니다.
공식 근거: [Codex 통합](https://docs.stagehand.dev/v4/integrations/codex),
[모델 설정](https://docs.stagehand.dev/v4/configuration/models).

이번 판정은 공식 문서와 기존 테스트 호출부를 대조한 결과다. Stagehand 설치·유료 호출·성능 비교는
실행하지 않았으며 공급자의 속도·비용 수치를 이 프로젝트의 측정 결과로 취급하지 않는다.
현재 테스트와 로컬 검사 구성·전역 브라우저 도구는 변경하지 않는다.


## 일반 개발 방법론과 프로젝트 계약 분리 (2026-09-22)

일반 설계·TDD·디버깅은 사용자 선택을 우선하고 설치된 Superpowers 등에 위임한다. Harness의
plan·feature-add·feature-modify·systematic-debugging은 기존 이름을 유지하며 프로젝트 기준·계획
산출물·테스트 잠금·진단 권한·인계만 연결한다. core의 verification-before-completion과 PR/CI/승인/
릴리즈 gate는 소유한다. 현재 후보·관련 환경·검사 범위가 같은 증거를 다시 실행하지 않고 연결한다.
이는 일반 방법론 **위임**, 결과 계약 **소유**, 사용 흐름 **연결**이다.

스킬 명령은 선택 사항이며 native 설명 기반 선택을 사용한다. 라우터 키워드·새 만능 스킬·실행 엔진을
추가하지 않는다. Superpowers 미설치에도 native 방식으로 동일 계약을 지킨다. 외부 플러그인이나
전역 모델 설정은 수정하지 않는다. 기존 로컬 샘플의 실제 결함 수정으로 연결을 확인하고 적용 범위·
한계를 기록한다. 상태와 수용 기준은 [명세](specs/workflow-responsibilities.md)를 따른다.


## 2026-09-23 진행 문서 동기화 검사

기존 스펙/PR에 선언한 문서·체크박스·파일 digest·정확한 태그를 같은 로컬/PR 검사로 연결한다.
의미·대상 누락은 독립 검토하며 중앙 상태 저장소·전체 Markdown 판정기·상시 LLM 호출은 두지 않는다.
제품 방향의 **소유** 영역이며 입력·수용 기준·배포 경계는 [명세](specs/progress-document-check.md)와
[사용 계약](ai-collaboration.md#선언한-문서의-기계적-검사)을 따른다. 기존 PR wrapper는 선언이 있을 때
사전 검사하고, 이 저장소 CI에서 먼저 선언을 필수화한다. 기존 소비 repo의 CI는 자동 변경하지 않는다.

## 2026-09-29 QA 관찰 경계와 행동 평가

요구 기반 QA 계약에 현장 반례의 관찰 경계를 조건부 참조로 연결한다. 공통 스킬과 함께 배포해
소비 repo에서 연구 문서 유무에 의존하지 않게 한다. 범위·완료 기준과 평가 자료는 **소유**,
native 새 컨텍스트 실행은 **연결**, 제품별 시험 구현은 **위임**한다. 구조 검사와 실제 판단
평가를 구분하고 자동 의미 판정 엔진·상시 모델 호출 CI는 만들지 않는다. 소비 결함 발견은
보류된 제품 수정 권한을 재개하지 않는다. [평가 명세](specs/qa-behavior-validation.md)를 따른다.

## 2026-09-29 QA 판정자와 미사용 과제 검증

기존 QA 범위·완료 계약에 기대값의 출처, 최초 실패 보존과 관련 시험 기법을 조건부 참조로 보강한다.
방법론·제품별 실행기를 복제하지 않으며 기존 운영 회고에는 누락 경계와 회귀 검출 증거만 연결한다.
Harness의 평가는 지침을 개발할 때 사용한 사례와 고정 후보 이후 별도 작성한 실제 과제를 구분한다.
정상/결함 쌍과 판정자 자체를 검증하고, 자연어 진입·다중 턴 결과를 명시적 로딩 평가와 별도로 기록한다.
상시 모델 CI는 추가하지 않는다. [조사·실행 계획](specs/qa-strategy-research-plan.md)을 따른다.

최종 [실제 작업 평가](specs/qa-practical-validation.md)는 보고 포함 26/28이며 자연어 본문 읽기는 4/12다.
후보 충분성을 NOT VERIFIED로 남기고, 평가자 자체의 거짓 양성/음성 수정과 원본 결과를 함께 보존한다.
조사·보강·평가 수행 완료는 릴리즈·설치 승인이나 모든 모델 실행의 준수 보장이 아니다.


## 2026-10-01 큰 문서의 커밋 일치 검사

PR 생성 전 검사에서 1 MiB 기본 출력 버퍼보다 큰 정제 평가 근거가 HEAD와 같은데도 거부됐다.
문서와 근거의 커밋 일치 검사는 Harness **소유** 범위이며 파일 크기에 따른 거짓 불일치를 고친다.
이미 읽은 파일 바이트 길이로 Git 출력 버퍼를 제한해 허용하고 실제 바이트 비교·미커밋 거부는 유지한다.
대상을 선언에서 빼거나 검사를 생략하지 않는다. 큰 문서/근거의 동일 파일 통과와 같은 길이·짧은·긴
변경 파일 거부를 회귀 검사로 확인하며, 과정과 결과는 [QA 전달 기록](specs/qa-command-binding-validation.md)에 남긴다.

## 2026-10-09 — 현대화 안전 검사 소스 후보

승인된 공통 개선의 소유는 Harness의 결정적 분류·GitHub 정책 연결이다. 플랫폼 permission·hook lifecycle을 복제하지 않는다.
조회 실패/빈 context에서 보호 쓰기를 하지 않으며, curl/wget 입력 문법·절대 실행 경로·유효 DDL 구문의 확인된 누락을 회귀로 고쳤다.
Profile quoting와 doctor의 정확한 등록 관계, SVG 충돌 실패/유효 XML을 직접 실행 결과로 판정한다.
[현재 스펙](specs/harness-modernization.md)에서 최초 실패·후보·명령·한계를 연결한다. 현재는 구현/영향 시험 후보이며 CI·독립 검토·발행·설치 완료가 아니다.

# Team Harness 제품 방향

이 문서는 Team Harness가 무엇을 만들고 무엇을 만들지 않을지 판단하는 **제품 방향의 단일 출처**다.
기능 제안·설계·감사·정리 작업은 이 경계를 먼저 적용한다.

## 제품 정체성

> **Team Harness는 개발자가 AI와 함께 백엔드·프론트엔드·DB·인프라 업무를 수행할 때,
> 검증된 기술 기준·설정·검사 절차를 프로젝트마다 재사용하는 개발 기반이다.**

먼저 한 개발자의 실제 프로젝트에서 반복 설정·조사·검사 구성에 드는 일을 줄이고, 도움이 확인된 구성을
차츰 다른 개발자에게 확산한다. 회사 공통 기준의 선행 확정은 필요하지 않으며, 제공하는 기술 선택은 제품
요구와 회사의 실제 정책에 맞게 채택한다. 특정 스택의 앱 코드나 모든 업무를 자동 해결하는 능력을 보장하지 않는다.

GitHub를 사용하는 프로젝트에는 기존 **GitHub-native AI 코딩 거버넌스**, `policy as code`,
`evidence-gated delivery`를 연결한다. 로컬 전용 개발에 원격 생성·공개·PR을 강요하지 않는다.
원격이 없는 작업의 로컬 검사와 GitHub 서버 통제는 구분한다. 실행 플랫폼의 에이전트·권한 기능은 복제하지 않는다.

## Team Harness가 소유하는 것

다음은 실행 플랫폼이 바뀌어도 Team Harness가 직접 책임진다.

- **개발 구성 재사용:** 스택별 기준·설정·검사 연결과 적용 안내. 제품별 차이는 제품 저장소에 남긴다.
- **작업의 연속성:** 요구·구현·검증·다음 행동과 관련 로드맵·체크리스트를 현재 제품 기록에 연결한다.
- **서버 강제 정책:** branch protection, required CI, commit·PR·release 게이트.
- **증거와 provenance:** 현재 SHA에 대응하는 테스트·리뷰·배포 상태, 생성된 commit의 출처와 형식.
- **감사와 복구:** 차단 사유, fail-closed 판정, 원자적 우회·복구, 릴리스 back-merge.
- **저장소 표준 전파:** 신규 repo baseline, 소비 repo 드리프트 검출, 정책 버전 관리.
- **개발 안전 게이트:** 테스트 삭제, 파괴적 마이그레이션, 시크릿 유출처럼 서버에서 재검증할 수 있는 규칙.
- **도구 간 결과 계약:** Claude Code·Codex 등 실행 방식이 달라도 같은 수용기준과 GitHub 게이트 결과.

## 실행 플랫폼에 위임하는 것

다음은 안정적인 공식 기능이 있으면 플랫폼에 맡기고 Team Harness가 복제하지 않는다.

- skill 발견·로딩·자동 선택과 명시적 호출 UI.
- hook lifecycle, sandbox, permission, managed policy의 실행 엔진.
- subagent 생성·병렬 실행·모델 선택·reasoning effort.
- MCP, connector, 브라우저, 자동화 등 외부 도구 연결.
- 일반적인 계획·TDD·디버깅·코드리뷰 방법론 자체.

Team Harness에 이미 있는 겹치는 기능은 즉시 제거하지 않는다. 공식 기능의 안정성·지원 surface·결과 계약을
검증한 뒤, 거버넌스 고유 부분만 남기고 순차적으로 위임하거나 얇은 연결 계층으로 축소한다.

## 설계 원칙

1. **native-first:** 공식 기능이 같은 문제를 안정적으로 풀면 그것을 우선한다.
2. **thin adapter:** 도구 차이는 최소 어댑터에서만 흡수하고 플랫폼 내부를 장기 복제하지 않는다.
3. **outcome parity:** 도구 호출 모양이 아니라 수용기준·CI·PR·릴리스 결과가 같은지를 검증한다.
4. **server-backed enforcement:** 중요한 거부 규칙은 로컬 프롬프트에만 두지 않고 GitHub·CI에서 재검증한다.
5. **evidence before claims:** 완료·안전·머지·릴리스 주장은 현재 SHA의 새 증거가 있을 때만 허용한다.
6. **small-team proportionality:** 개인 개발부터 작은 팀까지 실제로 필요한 구성만 유지한다. 조직 확산이나
   지원 스택 수를 늘리기 위해 추측성 기능·반복 실험을 만들지 않는다.
7. **reuse with verification:** 검사 도구·설정·회귀 테스트를 재사용하되 바뀐 코드의 검사는 실행한다.
   검증 결과의 재사용은 후보·관련 환경·검사 범위가 같을 때만 가능하다.

## 신규 기능 판단 게이트

새 기능을 추가하기 전에 다음 질문에 답한다.

1. 이 기능은 반복되는 프로젝트 설정·조사·검사 구성을 줄이거나 현재 변경의 증거 품질·필요한 정책 강제를 높이는가?
2. 실행 도구가 달라도 동일해야 하는 결과 계약을 제공하는가?
3. Claude Code·Codex·GitHub의 안정적인 공식 기능이 이미 같은 문제를 해결하는가?
4. 공식 기능이 있다면 Team Harness에는 연결·검증만 남기고 구현을 위임할 수 있는가?
5. 특정 프로젝트의 요구라면 공용 하네스가 아니라 소비 repo 설정에 두는 것이 맞지 않은가?
6. 추가되는 유지보수·호환성 비용이 실제로 줄이는 운영 위험보다 작은가?

판정은 세 가지 중 하나로 기록한다.

- **소유:** 재사용 구성·검사 연결·서버 강제·증거·감사·드리프트처럼 Team Harness의 핵심 책임이다.
- **연결:** 플랫폼 기능을 사용하되 도구 간 결과 계약이나 GitHub 게이트 연결이 필요하다.
- **위임:** 플랫폼 또는 소비 repo가 충분히 소유하므로 Team Harness에는 추가하지 않거나 기존 중복을 제거한다.

하나의 기능이 어느 판정인지 설명할 수 없으면 구현하지 않고 문제 정의로 돌아간다.

## 비목표

- 모든 AI 코딩 도구를 대체하는 범용 agent runtime.
- 하나의 개발 방법론을 모든 팀에 강제하는 workflow framework.
- 플랫폼 내부 동작을 추적해 복제하는 영구 호환 계층.
- 검증되지 않은 규칙을 많이 모은 prompt collection.
- 별도 통제·감사 체계 없이 기업 compliance를 보장한다는 주장.

## 우선순위 로드맵

현재 우선순위는 개인 개발의 반복 작업 감소다. 아래 완료는 해당 범위만 뜻하며 전체 제품 목표의 완료가 아니다.
실행 태스크·PR 상태는 GitHub Issues/PR, 이 문서는 제품 수준의 순서·완료 범위 정본이다.

1. [x] **개발 기준·선택형 조정:** 기술 기준과 인계·재개·현재 후보 검증 연결을 제공한다.
   [선택 통합](specs/agent-orchestration-integration.md)은 완료됐지만 모든 스택의 시작 자동화는 아니다.
2. [x] **개인 사용 흐름·위임·문서 현행화 보완:** [현재 명세](specs/personal-development-flow.md)의
   수용 기준으로 로컬 사용, 승인된 worker 활용, 로드맵·체크리스트 갱신을 연결한다.
3. [ ] **첫 재사용 시작 구성:** [실행 태스크 #462](https://github.com/grinvi04/team-harness/issues/462)에서
   로컬 샘플에서 확인한 Spring Boot+Vue 검사 연결을 출발점으로,
   신규·기존 프로젝트에서 필요한 설정만 적용하는 최소 경로를 만든다. 원격 생성·기존 파일 덮어쓰기 없이
   미리보기, 필요한 검사 실행, 실패 시 중단을 확인한다. 현재 `new-repo.sh`는 GitHub 온보딩 전용이며
   앱·DB·인프라까지 자동 완성하는 시작 도구가 아니다.
4. [ ] **실제 업무에서 필요한 다음 영역:** 실제 제품 요구가 생길 때 DB·인프라 또는 다른 스택의 부족한
   설정·검사 연결을 추가한다. 기존 테스트·기준을 재사용하고 수정된 부분의 결과로 채택 여부를 판단한다.
5. [ ] **점진적 공유:** 개인 프로젝트에서 유용성이 확인된 구성만 동료의 프로젝트에 적용한다.
   반복 설정 감소·검사 누락·재작업을 기준으로 판단하며 회사 전체 도입을 미리 완료 처리하지 않는다.

작업의 범위·결정·단계가 바뀌면 관련 현재 로드맵·스펙 체크리스트·안내를 같은 변경에서 갱신한다.
검사가 아직 없거나 미실행이면 완료 표시하지 않는다. 적용 절차는 [Markdown 동기화](ai-collaboration.md#markdown-동기화)를 따른다.

## 기존 거버넌스 작업과 보류 항목

아래는 기존 개발 결과와 플랫폼 조건 때문에 보류한 항목이다. 개인 개발의 현재 우선순위를 대신하지 않는다.

1. [x] **공개 안전성 감사:** Git 히스토리 시크릿, 공개 식별정보·개인 경로, 라이선스 provenance 점검. 결과는
   [`public-safety-audit.md`](public-safety-audit.md)에 기록했다.
2. [x] **플랫폼 중복 감사:** 현재 skill·hook·agent·Codex patch를 소유/연결/위임으로 전수 분류. 결과는
   [`platform-overlap-audit.md`](platform-overlap-audit.md)에 기록했다.
3. [x] **제품 경계 분리:** 서버 거버넌스 core, runtime adapter, 선택 workflow의 설치·운영 경계를
   [`product-boundaries.md`](product-boundaries.md)에 정의했다.
4. [x] **배포 단순화:** package 정본·재현 build와 세 profile의 filesystem 설치·업데이트·비활성화·제거·doctor
   실측을 완료했다. 사용자 전역 marketplace 승격은 호환성 검증 뒤 별도 승인으로 남긴다.
5. [x] **오픈소스 제품화:** 영문 Quick Start, 지원 환경, SECURITY·CONTRIBUTING·생성형 CHANGELOG와
   기록된 `HEAD` 기반 release bundle·SHA-256 provenance를 정리했다. marketplace 공개는 호환성 검증 뒤다.
6. [x] **호환성 검증:** 다른 plugin과 세 profile을 clean filesystem session에 함께 배치해 identity 충돌,
   namespaced skill 공존, hook overlap 위임, 파일 불변과 malformed·symlink 거부를 검증했다.
7. [x] **외부 파일럿:** DriveTree clean `develop`에서 profile 설치 952.225ms, doctor 38.883ms,
   guard 표본 오탐·누락 0/9, repo-sync MISSING 11을 측정했다. 결과와 한계는
   [`pilots/drivertree-v0.60.0.md`](pilots/drivertree-v0.60.0.md)에 기록했다. v0.61.0에서 stack-rule 전달
   backlog 1건을 실제 처리한 전후 증거와 잔여 MISSING 10은
   [`pilots/drivertree-v0.61.0.md`](pilots/drivertree-v0.61.0.md)에 기록했으며, 판정은 **연결**이고
   후속 commit-provenance·destructive-DDL 두 slice를 완료해 같은 보고서와
   [zero-drift 원본](pilots/drivertree-v0.61.0-remediated.json)에 OK 18 · MISSING 0,
   repositoryUnchanged와 main/develop required gate 적용을 기록했다. 단일 repo 표본이므로 split package의
   `installable:false`와 marketplace 승격 보류를 유지한다.
8. [x] **Codex 공식 loader 전환:** monolith에 native manifest·command hooks·16개 skill wrapper를 직접 싣고
   harness cache patch·overlay·custom agent 복사·unified exec 비활성화를 제거했다. 격리 loader와 실제 새 세션
   결과는 [`pilots/codex-native-loader-v0.61.0.md`](pilots/codex-native-loader-v0.61.0.md)에 기록한다. 이 증거는
   operator-approved GitHub ref의 exact revision, allowlisted subprocess 환경, 격리 HOME·XDG root,
   refresh/API-key와 inherited long-lived credential 환경이 없는 session credential에 결박한다. monolith
   전환만 승인하며 split package의 `installable:false`와 marketplace 승격 보류는 유지한다.
9. [x] **두 번째 외부 파일럿:** Python·Alembic 소비 repo webhook-service의 격리 clean `develop`에서
   profile healthy, guard 9/9, repo-sync OK 5 · WARN 2 · MISSING 11을 측정하고 정본 세 slice로
   OK 18 · WARN 0 · MISSING 0 수렴을 simulation했다. 원본·판정은
   [`pilots/webhook-service-v0.61.0.md`](pilots/webhook-service-v0.61.0.md)에 기록했다. 실제 소비 repo
   [PR #69](https://github.com/grinvi04/webhook-service/pull/69)을 develop에 병합하고 앱 품질 56 tests,
   zero-drift 재측정, main/develop의 `commitlint`·`destructive-ddl` 포함 required context 5개 강제를
    [완료 원본](pilots/webhook-service-v0.61.0-remediated.json)으로 고정했다. 판정은 **연결**이며 두 public
    repo·단일 운영 환경 표본이므로 split package의 `installable:false`와 marketplace 승격 보류를 유지한다.
10. [x] **split package 공식 loader·rollback:** v0.62.0 이후 exact commit `d580808`에서 생성한 staged
    package를 Codex 0.144.6 공식 local marketplace loader로 세 profile에 각각 설치했다. 생성 artifact와 설치
    cache의 전체 tree digest, core-first 설치, workflow→adapter→core 역순 제거, 사용자 Codex 상태 불변과 격리
    HOME 삭제를 [`pilots/codex-split-loader-v0.61.0.md`](pilots/codex-split-loader-v0.61.0.md)에 고정했다.
    판정은 **연결**이며 loader 수명주기 증거만 충족했으므로 `installable:false`를 유지한다.
11. [ ] **split runtime 결과 계약:** 독립 core+Codex adapter에서 native hook·skill fresh-session outcome parity를
    검증한다. Codex가 plugin dependency와 runtime binding을 선언하는 공식 surface를 제공하지 않는 동안 custom
    resolver를 만들지 않고 전환기 monolith를 유지한다. 공식 surface가 생기거나 지원 가능한 native 연결이
    확인된 뒤에만 marketplace 승격·호환 기간·rollback 계획을 별도 결정한다. 2026-09-03 Codex 0.144.6과 공식
    plugin manifest를 재확인했지만 연결 surface가 없었고, 독립 artifact의 hook도 core root를 해석하지 못함을
    [`pilots/codex-split-runtime-v0.61.0.md`](pilots/codex-split-runtime-v0.61.0.md)에 기록했다. 따라서 항목은
    **WAIT**로 열어 두고 `installable:false`·monolith를 유지한다.

기존 거버넌스는 유지한다. 보류 항목은 새 플랫폼 근거가 있을 때만 재개하며 같은 실험을 반복하지 않는다.

## 공통 개발 기반과 선택형 개발 조정

여러 개발자가 LLM으로 백엔드·프론트엔드·인프라를 다루는 공통 기반으로 사용한다. 기술 기준·governance core·native adapter에 [개발 조정](development-coordination.md)을 선택적으로 연결한다. Agent Orchestration에서는 인계·현재 증거 확인·재개 원칙만 선택해 workflow-pack의 짧은 skill로 연결한다. 별도 선언 검사 패키지·역할 상태 체계는 가져오지 않는다. 제품 코드·진행은 제품 저장소, 모델 실행·권한은 native 플랫폼, 품질 gate는 기존 core가 책임진다. 새 실행 엔진이나 별도 정책 체계를 만들지 않는다. 회사의 실제 기준 채택 여부는 제품 원본에서 확인한다.

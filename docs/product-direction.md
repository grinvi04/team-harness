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

## 일반 방법론과 프로젝트 계약

일반 설계·TDD·디버깅은 사용자 선택을 우선하고 설치된 Superpowers 같은 방법론 하나에 맡긴다.
Team Harness의 해당 스킬은 프로젝트 기준·계획 산출물·테스트 무결성·완료 증거를 연결하는 짧은 계약으로
유지한다. 방법론이 없으면 native 방식으로 같은 계약을 지키며 새 설치를 강제하지 않는다.
[자연어 사용 흐름](development-coordination.md#자연어-요청과-역할-분담)에서 같은 계획·승인·검사를
중복하지 않는 기준을 따른다. 현재 후보의 검증·PR·CI·승인 gate와 원래 권한은 그대로 유지한다.

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
3. [x] **첫 재사용 시작 구성:** [실행 태스크 #462](https://github.com/grinvi04/team-harness/issues/462)의
   [명세](specs/local-spring-vue-setup.md)에 따라 준비된 Spring Boot+Vue 프로젝트에 검사 진입점을 추가하는
   경로를 구현하고 검사·독립 검토를 통과했다. [사용 안내](local-development.md)에 준비 조건·미리보기·적용·실행을 정리했다.
   원격 생성·기존 파일 덮어쓰기가 없고 제품 전용 검사는 제품에 남긴다. 앱 생성·검사 도구 초기 설정이나
   모든 스택 자동화는 포함하지 않는다. `new-repo.sh`는 기존 GitHub 온보딩 전용이다.
4. [x] **방법론 중복 축소·자연어 사용 흐름:** [역할 정리 명세](specs/workflow-responsibilities.md)에 따라
   스킬의 프로젝트 계약을 보존하며 중복 절차를 줄이고 기존 샘플의 실제 수정·독립 검토로 확인했다.
   [PR #470](https://github.com/grinvi04/team-harness/pull/470)으로 통합했으며 릴리즈·설치의 현재 상태는
   [이슈 #469](https://github.com/grinvi04/team-harness/issues/469)에서 확인한다. 모든 요청의 자동 선택을 보장하지 않는다.
5. [ ] **실제 업무에서 필요한 다음 영역:** 실제 제품 요구가 생길 때 DB·인프라 또는 다른 스택의 부족한
   설정·검사 연결을 추가한다. 기존 테스트·기준을 재사용하고 수정된 부분의 결과로 채택 여부를 판단한다.
6. [ ] **점진적 공유:** 개인 프로젝트에서 유용성이 확인된 구성만 동료의 프로젝트에 적용한다.
   반복 설정 감소·검사 누락·재작업을 기준으로 판단하며 회사 전체 도입을 미리 완료 처리하지 않는다.

관련 판단 전에 [해당 본문](product-direction-roadmap-evidence.md)을 읽는다.

## 기존 거버넌스 작업과 보류 항목

[완료 범위·보류 조건](product-direction-governance-history.md)을 기존 거버넌스의 채택·재개를 판단하기 전에 읽는다. 아래 최신 소비 인수 경계와 함께 대조한다.

## 공통 개발 기반과 선택형 개발 조정

여러 개발자가 LLM으로 백엔드·프론트엔드·인프라를 다루는 공통 기반으로 사용한다. 기술 기준·governance core·native adapter에 [개발 조정](development-coordination.md)을 선택적으로 연결한다. Agent Orchestration에서는 인계·현재 증거 확인·재개 원칙만 선택해 workflow-pack의 짧은 skill로 연결한다. 별도 선언 검사 패키지·역할 상태 체계는 가져오지 않는다. 제품 코드·진행은 제품 저장소, 모델 실행·권한은 native 플랫폼, 품질 gate는 기존 core가 책임진다. 새 실행 엔진이나 별도 정책 체계를 만들지 않는다. 회사의 실제 기준 채택 여부는 제품 원본에서 확인한다.

원격 전달 전 webhook 로컬 코드 `ef6585a`는 SDK 7.1.1 전환 후 전체 110개·집중 31개·실제 별도 Keycloak/Chrome 로그인·역할 경계 및 전체 runtime/dev graph 감사 0을 확인했다. 독립 검토와 전달 기록은 위 소비 진행 기록을 따른다. 당시 운영 IdP·원격 gate·배포는 미확인이었다. 현재 원격 CI·develop 병합 결과는 아래 후속을 따른다.

DriveTree `907ea04`는 제품 전용 braces 깊이 보완·설치 확인·stdin import 회귀를 보안 10개로 검증했다. unit/build/Chromium의 기존 동일 앱 입력 증거 재사용과 full 감사 high 5는 구분한다. ERP `03a4bad`는 ignore-scripts·미확인 도달성 때문에 보완 미적용 조건과 증거 보존만 기록했다. Harness 공통 패치 기능이나 운영 배포는 추가하지 않았다.

### 소비 원격 인수 후속 (2026-10-07)

webhook은 기존 검증 입력을 보존하고 [develop PR #71](https://github.com/grinvi04/webhook-service/pull/71)의 실제 원격 필수 검사·독립 검토를 통과하고 develop `c4214248`로 병합했다. 보호 설정을 유지했으며 이미지 게시·운영 배포는 하지 않았다. SHA 지문 두 건의 secret-scan 오탐은 정확한 역사상 fingerprint만 식별하고 같은 경로의 합성 token 거부를 확인한다. ERP의 메시지 scope 오류를 고친 `b3fbfb36`은 기존 제품 입력을 유지한다. 사용자가 Vercel 관련 원격 작업 보류를 재확인해 DriveTree·siku와 제공자 preview 연결 미확인 ERP는 로컬 후보를 보존한다. main/default trusted 초기 배치·필수 context 전환·릴리즈·운영 배포는 완료되지 않았다. 실제 인수·정리 결과와 다음 행동은 [준비 기록](pilots/consumer-readiness-2026-10-07.md#후속-소비-원격-전달과-보류-조건-2026-10-07) 및 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)이 정본이다. 공통 Harness 동작·버전은 바꾸지 않는다.

의존성 후속 재확인에서 DriveTree 운영 감사 0·깊이 보완 10/10, ERP 보완 후보 high 9/7과 공식 수정판 부재를 확인했다. webhook trusted 자산의 로컬 계약 시험은 통과했지만 main 게시 영향 때문에 활성화는 준비 상태다. 현재 경계·완료 한계·복구 순서는 [후속 기록](pilots/consumer-readiness-2026-10-07.md#후속-의존성-재확인과-trusted-전환-준비-2026-10-07)을 따른다.

ERP 후속 `7a13802`는 제품 전용 깊이 보완 코드 `18b18a06`를 로컬 인수했다. ignore-scripts를 유지한 명시 설치 보완, 보안 11·단위 60·브라우저 38·Docker와 CSS/세 화면 동일성을 확인했고 고정 후보 독립 검토에 추가 P1/P2는 없었다. backend 불변의 기존 Java/실 IdP 증거 재사용, 합성 세션 smoke 및 전체 high 9/운영 high 7 FAIL을 구분한다. 공용 Harness 기능·버전은 바꾸지 않았으며 Vercel 원격 보류·trusted 활성화·배포 잔여는 유지한다. 범위와 실패·증거 연결은 [ERP 로컬 인수 기록](pilots/consumer-readiness-2026-10-07.md#후속-erp-깊이-보완의-로컬-인수-2026-10-07)을 따른다.

2026-10-07 당시 사용자가 미리보기 포함 원격 전달을 허용했다. DriveTree [PR #85](https://github.com/grinvi04/drivertree/pull/85) `907ea045`·siku [PR #87](https://github.com/grinvi04/siku/pull/87) `dea9994`·ERP [PR #255](https://github.com/grinvi04/erp/pull/255) `7a13802`는 모두 develop 대상 OPEN이고 현재 head의 필수 CI 6·6·8개가 각각 PASS다. DriveTree의 같은 SHA Vercel Preview는 SUCCESS·GET 200, siku는 배포 SUCCESS지만 비인증 GET 302 보호 화면이어서 앱 확인 UNVERIFIED, ERP는 deployment/status 연결이 없고 Vercel 인증도 없어 Preview UNVERIFIED다. 세 PR의 병합·staging·운영 반영과 감사 잔여 해소는 완료가 아니다. 당시 보류 기록은 위 문단의 시점으로 보존하고 [최신 후보·원격 경계](pilots/consumer-readiness-2026-10-07.md#후속-소비-원격-인수와-webhook-릴리즈-2026-10-07)를 당시 정본으로 삼는다. 현재 병합 상태는 아래 2026-10-08 절을 따른다.

webhook은 [main PR #72](https://github.com/grinvi04/webhook-service/pull/72) 병합 SHA `661ee4f`에 `v1.5.0`을 발행하고 [develop 역병합 PR #73](https://github.com/grinvi04/webhook-service/pull/73)을 마쳤다. main push의 GHCR 게시 job과 action metadata digest는 SUCCESS지만 직접 registry readback은 인증 401/403으로 UNVERIFIED다. [정상 PR #74](https://github.com/grinvi04/webhook-service/pull/74)에서 trusted target 검사가 실제 통과했고 main/develop 보호의 기존 commitlint 요구를 trusted context로 단계적으로 교체·readback했다. [정리 PR #75](https://github.com/grinvi04/webhook-service/pull/75)는 필수 5개·독립 검토를 통과해 develop `e1eee56e`에 병합됐으며 develop legacy workflow를 제거했다. 같은 SHA의 develop push CI는 앱 품질·DB head·비밀 검사 SUCCESS, 이미지 게시 SKIPPED다. main v1.5.0의 역사상 legacy 파일은 다음 정상 릴리즈에서 전파한다. 새 event 정책 예외는 승인·적용하지 않았고 이미지 게시 성공을 운영 배포 완료로 취급하지 않는다. 제품별 전체 보안·인수 상태는 여전히 미완료다.


### develop 병합·외부 기능 관찰 (2026-10-08)

사용자 승인 순서대로 DriveTree PR #85 → siku PR #87 → ERP PR #255를 develop에 병합했다. 필수 CI와 기존 고정 후보 검토를 대조했으며 보호 설정을 유지했다. DriveTree·siku의 merge SHA Preview는 생성됐지만 DriveTree 실제 유지비 계산은 오류로 FAIL, siku 앱 화면은 Vercel 로그인 보호로 UNVERIFIED, ERP 배포 연결도 UNVERIFIED다. 세 제품 main/default trusted 전환·운영 배포는 제외했다. 현재 상태·원문·다음 행동은 [최신 병합·실화면 점검](pilots/consumer-readiness-2026-10-07.md#후속-develop-병합과-실화면점검-2026-10-08)과 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)을 따른다. 공식 보안 수정판 부재와 전체 감사 잔여, 이전 ERP 컨테이너 런타임의 제한된 패키지 부재를 구분한다. 공통 Harness 동작·버전은 변경하지 않았다.


DriveTree staging 복구 후속 조사에서 실제 소스 연결 null과 Railway 배포 자격 INACTIVE/체험 종료를 확인했다. API health404와 원격 계산 FAIL을 유지하고 결제·계정/인프라/DB·production 변경은 하지 않았다. 계정 활성화 여부·workspace 영향·환경 단독 소스 복원·고정 SHA 기능 검증의 재개 조건은 [staging 진단 후속](pilots/consumer-readiness-2026-10-07.md#staging-복구-진단-후속-2026-10-08)과 제품 PR87·이슈 #496을 따른다. 전체 소비 채택이나 실제 복구 완료로 판정하지 않는다.


2026-10-08 현재 사용자는 DriveTree 추가 결제·Railway 활성화와 별도 테스트 Supabase가 없는 siku 원격 검증을 보류했다. 인증된 siku 미리보기는 Production 전용 Supabase 변수 때문에 실제 앱 기동 FAIL이며, 현재 Vercel 작업 공간 ERP 검색은 결과가 없고 ERP README는 운영 미배포다. 비용 없는 현재 잠금파일 감사와 공식 수정판 재확인에도 보안 판정 변화는 없다. 현재 결정·보류 해제 조건은 [최신 소비 관찰](pilots/consumer-readiness-2026-10-07.md#비용테스트-환경-결정과-인증된-미리보기-관찰-2026-10-08)을 따른다. 이전 활성화 순서는 조건부 계획이며 현재 실행할 다음 단계가 아니다. 새 운영/유료 환경을 만들거나 실패를 반복하지 않는다.

사용자 결정에 따라 이번 배포 제외 인수는 Harness QA 보강과 네 소비 제품의 선정 로컬 QA·develop 필수 CI·독립 검토 적용 검증까지다. 현재 입력·실행 원문·소비 경계의 독립 대조에서 이 범위의 새 차단 결함을 찾지 못해 해당 단계는 완료로 판정한다. 전체 보안 감사 FAIL과 DriveTree·siku·ERP trusted 실제 전환은 남아 있으므로 전체 소비 도입·출시 준비 완료로 판정하지 않는다. 기존 제품별 단계 종료 조건은 유지하며 이슈 #496을 열어 둔다. 현재 완료 범위·증거·재개 조건은 [배포 제외 최종 인수](pilots/consumer-readiness-2026-10-07.md#배포-제외-범위의-최종-인수-2026-10-08)를 따른다. 새 공용 기능·플러그인 버전 변경은 없다.

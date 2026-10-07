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

공통 QA 계약은 [범위·완료 기준 보강](specs/qa-scope-contract.md),
[근거 조사·평가](specs/qa-strategy-research-plan.md),
[명령별 보고·계약 연결 후속 검증](specs/qa-command-binding-validation.md)까지 완료했다.
행동 평가는 0.79.0 스킬 후보의 제한된 수용 범위에 한정한다. 0.80.0에서는 PR 사전 검사의 큰 문서
오판을 추가 수정했고 [PR #480](https://github.com/grinvi04/team-harness/pull/480)에서 develop 통합 상태를 추적한다.
해당 PR은 develop에 병합됐고 `3c5b4b3` 후보의 0.80.0 릴리즈 사전 검증도 통과했다.
실행 근거·비적용 항목은 같은 후속 문서에 보존한다. [정식 릴리즈 PR #481](https://github.com/grinvi04/team-harness/pull/481)을
main에 병합했고 [v0.80.0 태그](https://github.com/grinvi04/team-harness/tree/v0.80.0)를 발행했다.
솔로 머지 뒤 main의 사람 승인 1명과 기존 보호 정책의 복구를 확인했다. develop 반영 상태는
[역병합 PR #482](https://github.com/grinvi04/team-harness/pull/482) 원본에서 추적한다. 전역 v0.80.0 설치와 새 세션의 제한된 샘플 설치본 검증도 완료했다.
17개 스킬 발견과 명령별 보고·격리 회귀/API unit 검증 근거는 같은 후속 문서에 연결했다.
현재 대화의 skill catalog도 0.80.0 경로로 갱신됐고, 샘플의 정본 전체 로컬 자동 검사도 최초 exit 0으로 통과했다.
실제 API 흐름을 포함한 브라우저 49개와 임시 DB 재시작 보존을 확인했다. axe 색상 대비 incomplete는 2026-10-06에 해당 두 기호의 실제 렌더 색상 24개를 확인해 해소했다.
최소 대비는 5.4466:1이며, 전체 WCAG·모든 브라우저 검증이나 무결함 보장으로 확대하지 않는다.
실행 결과·한계는 같은 후속 문서에 기록하며 설치 이후 기록의 전달·병합 상태는
[기록 통합 PR #483](https://github.com/grinvi04/team-harness/pull/483)을 정본으로 추적한다.
2026-10-06 재조회로 현재 설치·로딩을 확인했으며, 과거 설치 전환/설정 복구의 원문 미보존은 독립 재검증의 한계로 구분한다.
소비 프로젝트별 수정/배포는 후속 작업이며, 제한된 평가는 자동 선택 전반과 제품 전체 품질 보장을 뜻하지 않는다.

2026-10-06 네 소비 repo의 읽기 전용 표준 자산 점검에서 Python `venv` 탐색 중단을 발견했다.
[공통 검사기 보완 명세](specs/repo-sync-python-venv.md)에 재현·회귀와 실제 드리프트를 연결한다.
이 작업은 제품별 QA 실행·표준 반영·배포를 재개하지 않으며, 0.81.0은 아직 소스 후보다.
`7cafd144` 후보의 사전검증은 로컬 품질 63단계·외부 파일럿 live 원본·릴리즈 묶음 검사가 통과했지만,
보안 음성 시험의 판정자 결함 [#486](https://github.com/grinvi04/team-harness/issues/486)으로 **NO-GO**다.
[후보별 결과·한계](specs/repo-sync-python-venv.md#0810-릴리즈-사전검증--no-go)를 보존하고,
2026-10-07 [시험 보완](specs/binary-trust-oracle.md)은 로컬 품질 63단계·실제 macOS unsigned 거부·변이
검출·독립 보안 검토를 통과했다. 전달·최종 CI·병합은 [PR #488](https://github.com/grinvi04/team-harness/pull/488),
최종 사전검증 판정은 [#486](https://github.com/grinvi04/team-harness/issues/486) 원본을 따른다. 과거 NO-GO 기록은 보존한다.
2026-10-07 사전검증 GO 후 [정식 릴리즈 준비](specs/binary-trust-oracle.md#0810-정식-릴리즈-진행)를 시작했다.
main 승인·CI·병합은 [릴리즈 PR #489](https://github.com/grinvi04/team-harness/pull/489)에서 추적한다.
PR #489 main 병합과 필수 승인 요건 1명·전체 보호 원상복구를 확인했고 동일 main SHA에 v0.81.0 태그를 발행했다.
[태그 원본 발행 기록](pilots/release-v0.81.0-publication.json)의 checksum 73/73이 통과했다.
develop 역병합·최종 검토·CI·병합은 [PR #490](https://github.com/grinvi04/team-harness/pull/490) 원본으로 추적한다.
전역 Codex 설치는 0.81.0으로 갱신했고 새 세션에서 스킬 17개 로딩을 확인했다.
[설치·샘플 통합 기록](specs/qa-command-binding-validation.md#0810-전역-설치와-완료-경계-2026-10-07)의
샘플 최초 종료 시험 실패는 보존하고, 사용자 승인 후 로컬 `0c905a0`에서 해당 결함을 수정했다.
새 회귀·전체 QA·독립 검토·문서 검사가 통과해 이 승인 범위의 샘플 통합은 VERIFIED다.
당시 의존성 감사 high 6건 중 후속 샘플 로컬 커밋 `140b6dc`에서 source-map-js 1건을 수정했다.
전체 QA와 독립 검토는 부분 패치 PASS다. 사용자 선택 후 샘플 로컬 `431523d`에서 고정
upstream PR #78의 깊이 보완을 설치 지문 검사와 연결했고, 제품 전체 QA와 동일 기반 독립 회귀
778개가 통과했다. 공식 수정 버전은 없어 전체 감사 high 5건/전체 취약점 제거 FAIL은 유지한다.
[후속 근거](specs/qa-install-v0.81.0-evidence.json)의 dependencySecurityFollowup·bracesMitigationFollowup과
제품 docs/specs/dependency-security.md가 현재 상태·정식 수정판 확인 후 보완 제거 조건을 소유한다.
후속 샘플 `e3f1f47`은 경로 별칭 설치 no-op·stdin import 회귀를 9개 보안 시험과 독립 검토로 보완했다. 기존 앱 QA 재사용과 전체 감사 high 5 잔여는 구분한다. 이는 샘플 전용 보완이며 Harness 공통 패치 기능을 추가하지 않는다. 소비 프로젝트의 최신 승인·적용 상태는 아래 후속 기록과 이슈 #496에서 구분한다.

2026-10-07 사용자 승인으로 [네 소비 프로젝트 적용 준비](pilots/consumer-readiness-2026-10-07.md)를
읽기 전용으로 대조했다. 로컬과 원격 develop 후보를 분리했고, 최신 정본 차이는 ERP 1·siku 3·
webhook-service 1·DriveTree 1이다. 네 프로젝트의 QA 증거/문서 완료 계약 연결, 과거 Proposed
문서 현행화, ERP UAT 목적지 검증과 webhook 게시 분리의 진입 조건을 적용 계획에 남겼다.
앱 QA는 미실행/UNVERIFIED이며 소비 변경·배포 보류를 유지한다. 후속 권고 순서는
DriveTree → webhook-service → siku → erp이며, 첫 소비 변경·격리 실행은 승인 범위를 정한 뒤 진행한다.
후속 범위는 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496), 기록 전달·CI·병합은
[PR #495](https://github.com/grinvi04/team-harness/pull/495) 원본을 따른다.

이후 사용자 진행 승인으로 DriveTree의 QA/문서 계약과 검사 자산 준비·격리 로컬 QA를 수행했다.
로컬 제품 후보 `b5fd437`에서 format/lint/build, backend 단위 70·실DB e2e 17,
frontend 단위 8·Chromium 20(재시도 0)이 PASS다. 실제 HTTP 201/400/413/500 회귀와 검색 출처의
응답/DB 긍정 단언을 보완했고, 빈 검색 반례 검출·복구 후 통합 검사·독립 재검토를 확인했다.
로컬 repo-sync는 새 정본 workflow를 탐지해 18/18 PASS이며 기존 commitlint는 유지한다.
**원격 CI·병합·신뢰 target 검사 활성화·배포는 미실행**이다. npm audit은 backend 운영 의존성
19(critical 1/high 9), frontend 운영 의존성 9(critical 1/high 5)로 exit 1이므로 전체 보안/배포 준비 FAIL을 유지한다.
DriveTree의 `docs/specs/quality-remediation.md`와 실행 근거 JSON이 제품 상태를 소유하며,
자세한 인계와 다음 단계는 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)에서 추적한다.
이 최초 후보 이후 사용자가 네 소비 프로젝트 모두 진행을 승인했다. DriveTree `36f9b0d`는 회귀
115개와 독립 검토를 통과했고 전체 감사 잔여를 제품 증거에 보존했다. siku `5ad8a96`는 실제
Auth/RLS/Storage 브라우저 25·단위 86·감사 0건과 독립 검토를 확인하고 삭제 거부·부분 실패 처리를 보정했다.
ERP 코드 `dc080bd`·기록 `4d4fbf4`는 실제 curl 우회 반례를 수정하고 격리 Keycloak 초대·재초대,
FE 60+38·Docker·새 전용 DB Java 957개 실제 실행을 검증했다. 최초 DB 잔여 데이터 실패도 보존했다. webhook `5fd2213`는 DB/큐·상속 연결 설정·실패 출력·pytest 시작 전 dotenv 로딩을 보완하고
기존·새 환경 각각 79개와 실제 시작 차단 회귀를 통과했다. 네 로컬 후보의 독립 재검토에서 추가 P1/P2 없음과 증거 지문 일치를 확인했다. 현재 전체 보안/원격 인수는 미완료이며 ERP의 기존 작업은 별도 worktree로 보존했다.
현재 범위·후보·원문·검토 상태는 [진행 기록](pilots/consumer-readiness-2026-10-07.md#후속-네-소비-프로젝트의-로컬-적용-진행)과
이슈 #496에 연결한다. develop 병합의 staging 자동 배포와 main/default 전환·보호 변경은 별도 영향 승인 범위다.
후속 [보안·원격 조건 조사](pilots/consumer-readiness-2026-10-07.md#후속-보안-잔여와-원격-전달-조건-조사)에서 상위 pin·공식 수정판과 Preview 배포 기록을 확인했다. DriveTree `8c5b4f8`은 Swagger 한정 YAML 보완 후 backend 70+19와 독립 검토를 통과했다(frontend 8+20은 이전 증거 재사용). webhook `eba4bfb`은 관리자 로그인 SDK/URL/route·공유 PEM 키·OAuth state와 승인된 admin 역할 제한을 보완하고 기존/새 환경 각각 104개·독립 검토를 통과했다. callback 대역 Redis 시험과 실제 Redis 원자 소비 시험은 구분한다. 이 조사·보완을 현재 보안 또는 원격 인수 완료로 처리하지 않는다. 추가 조회에서 네 repo의 명시 Actions 정책 목록은 0·기본 workflow 권한 read였으나 target 실행은 미실행이다. Railway DriveTree staging의 현재 source는 null, production은 repo 연결만 확인됐으며 최신 과거 배포는 양쪽 FAILED다. 현재 trigger/Wait for CI는 미확인이고 Vercel 설정 조회는 invalid token으로 차단됐다. 사용자는 Vercel 확인을 후속으로 미뤘다. 이 결과로 자동 배포 안전을 확정하거나 provider 설정을 바꾸지 않는다. 이후 DriveTree 코드 `0a654e0`·검토 기록 `76cb019`는 Prisma 버전 유지·내부 의존성 두 개 보완으로 backend 70+19·새 DB migrate 3·운영 감사 0·독립 검토 추가 P1/P2 없음을 확인했다. 전체 개발 도구 감사와 frontend 경고는 남는다. webhook 2.x 호환 pin은 새 경고, 3.9.1은 허용 오차 밖 만료 토큰 수용 P1을 확인해 적용하지 않았다.

작업의 범위·결정·단계가 바뀌면 관련 현재 로드맵·스펙 체크리스트·안내를 같은 변경에서 갱신한다.
검사가 아직 없거나 미실행이면 완료 표시하지 않는다. 적용 절차는 [Markdown 동기화](ai-collaboration.md#markdown-동기화)를 따른다.

열린 [split runtime 이슈 #412](https://github.com/grinvi04/team-harness/issues/412)는 2026-10-06에
CLI 0.156.1과 공식 manifest 문서를 재확인했으나 필요한 cross-plugin dependency/root binding 계약이
확인되지 않아 WAIT를 유지한다. 새 root manifest 권장과 기존 호환 형식 지원을 구분하며,
[최신 capability 기록](pilots/codex-split-runtime-v0.61.0.md#2026-10-06-capability-재확인)에 근거·미실행 범위를 연결한다.

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

원격 전달 전 webhook 로컬 코드 `ef6585a`는 SDK 7.1.1 전환 후 전체 110개·집중 31개·실제 별도 Keycloak/Chrome 로그인·역할 경계 및 전체 runtime/dev graph 감사 0을 확인했다. 독립 검토와 전달 기록은 위 소비 진행 기록을 따른다. 당시 운영 IdP·원격 gate·배포는 미확인이었다. 현재 원격 CI·develop 병합 결과는 아래 후속을 따른다.

DriveTree `907ea04`는 제품 전용 braces 깊이 보완·설치 확인·stdin import 회귀를 보안 10개로 검증했다. unit/build/Chromium의 기존 동일 앱 입력 증거 재사용과 full 감사 high 5는 구분한다. ERP `03a4bad`는 ignore-scripts·미확인 도달성 때문에 보완 미적용 조건과 증거 보존만 기록했다. Harness 공통 패치 기능이나 운영 배포는 추가하지 않았다.

### 소비 원격 인수 후속 (2026-10-07)

webhook은 기존 검증 입력을 보존하고 [develop PR #71](https://github.com/grinvi04/webhook-service/pull/71)의 실제 원격 필수 검사·독립 검토를 통과하고 develop `c4214248`로 병합했다. 보호 설정을 유지했으며 이미지 게시·운영 배포는 하지 않았다. SHA 지문 두 건의 secret-scan 오탐은 정확한 역사상 fingerprint만 식별하고 같은 경로의 합성 token 거부를 확인한다. ERP의 메시지 scope 오류를 고친 `b3fbfb36`은 기존 제품 입력을 유지한다. 사용자가 Vercel 관련 원격 작업 보류를 재확인해 DriveTree·siku와 제공자 preview 연결 미확인 ERP는 로컬 후보를 보존한다. main/default trusted 초기 배치·필수 context 전환·릴리즈·운영 배포는 완료되지 않았다. 실제 인수·정리 결과와 다음 행동은 [준비 기록](pilots/consumer-readiness-2026-10-07.md#후속-소비-원격-전달과-보류-조건-2026-10-07) 및 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)이 정본이다. 공통 Harness 동작·버전은 바꾸지 않는다.

의존성 후속 재확인에서 DriveTree 운영 감사 0·깊이 보완 10/10, ERP 보완 후보 high 9/7과 공식 수정판 부재를 확인했다. webhook trusted 자산의 로컬 계약 시험은 통과했지만 main 게시 영향 때문에 활성화는 준비 상태다. 현재 경계·완료 한계·복구 순서는 [후속 기록](pilots/consumer-readiness-2026-10-07.md#후속-의존성-재확인과-trusted-전환-준비-2026-10-07)을 따른다.

ERP 후속 `7a13802`는 제품 전용 깊이 보완 코드 `18b18a06`를 로컬 인수했다. ignore-scripts를 유지한 명시 설치 보완, 보안 11·단위 60·브라우저 38·Docker와 CSS/세 화면 동일성을 확인했고 고정 후보 독립 검토에 추가 P1/P2는 없었다. backend 불변의 기존 Java/실 IdP 증거 재사용, 합성 세션 smoke 및 전체 high 9/운영 high 7 FAIL을 구분한다. 공용 Harness 기능·버전은 바꾸지 않았으며 Vercel 원격 보류·trusted 활성화·배포 잔여는 유지한다. 범위와 실패·증거 연결은 [ERP 로컬 인수 기록](pilots/consumer-readiness-2026-10-07.md#후속-erp-깊이-보완의-로컬-인수-2026-10-07)을 따른다.

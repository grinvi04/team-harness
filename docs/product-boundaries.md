# Team Harness 제품 경계

혼자 또는 작은 팀이 기존 프로젝트에서 AI와 개발 업무를 수행할 때 필요한 연결·작업 계약·검증·전달을 제공한다.
공개 설치 단위는 **harness-guard 플러그인 하나**다. 분리 패키지 승격은 기본 제품 목표에 포함하지 않는다.
기능 소유 판단은 [제품 방향](product-direction.md), 현재 후보·판정은 [재설계 실행 기록](specs/team-harness-redesign/execution.md)이 정본이다.

## 네 가지 책임

| 책임 | 입력·출력 | 보존·실패 경계 |
|---|---|---|
| 프로젝트 연결 | 기존 규약·스택·runner·검사 → 필요한 자산 preview/apply | 기존 검사를 재사용. 충돌·미지원·동시 변경에서는 덮어쓰지 않고 중단·복구 결과 기록 |
| 작업 계약 | 자연어 요청·기존 스펙/이슈 → 목표·범위·완료 기준·소유 범위 | 작은 일에 별도 상태 엔진을 강제하지 않음. 기존 승인·사용자 변경과 최신 요구 보존 |
| 검증 | 후보·실제 실행·파일 관찰 → 기준별 PASS/FAIL/UNVERIFIED/SKIP | 원문·후보·관찰이 없으면 완료 불가. 부분 결과와 전체 결과 구분 |
| GitHub 전달 | 채택한 브랜치·현재 SHA·필수 CI·리뷰·보호 → PR/병합/릴리즈 증거 | 로컬 전용에서는 비적용. 조회 실패·후보 변경·보호 복구 실패를 통과 처리하지 않음 |

플랫폼은 skill 선택·hook 실행·agent·sandbox·권한을 소유한다. Harness는 이를 복제하지 않고 실제 결과를 확인한다.
제품은 업무 코드·규약·요구·검사·진행 기록을 소유한다. Harness 설치가 제품 파일·원격 보호를 자동 변경하지 않는다.
독립 검토는 검사의 의미와 누락을 판단한다. 체크섬·기계 판정은 의미적 정확성이나 생산성 향상을 보장하지 않는다.

## 사용과 설치

[설치 안내](harness-setup.md) → [기존 저장소 연결](company-onboarding.md) →
[업무 시작·완료·인계](development-coordination.md) 순서로 사용한다. 팀의 담당자·통합은 [팀 가이드](team-development-guide.md)에 연결한다.
필요한 로컬 구성만 사용할 수 있으며 GitHub·회사 정책·별도 조직 인수가 시작 조건은 아니다.

스킬 이름17개는 기존 진입 호환성을 유지한다. 모든 공유 스킬은 같은 최소 프로젝트 계약을 읽으며
Codex wrapper는 공통 metadata에서 생성한다. native 차이는 공통 실행 절과 해당 스킬 절만 읽는다.
프론트 설계 기준은 프론트 업무에서만 읽는다. 일반 방법론을 여러 번 실행하거나 승인을 반복하지 않는다.
기본 UserPromptSubmit 의도 라우팅은 제거하고 native 선택과 명시 호출을 사용한다.
PreToolUse 가드·시크릿 전송 검사·필수 CI·리뷰·보호·복구는 유지한다.

## 지원과 판정

현재 후보의 필수 호스트 집합은 [지원·인수 표](specs/team-harness-redesign/architecture.md#이번-재설계의-지원인수-집합)로 고정한다.
소스·artifact 검사, 공식 loader 설치, 실제 스킬 본문·hook 실행은 각각 증거를 남긴다.
CLI 성공을 데스크톱 성공으로 대체하지 않는다. Claude 소스 호환은 유지하고 실호스트는 미확인 보류다.
현재 후보의 결과가 과거 릴리즈·모든 도구 버전·실제 사람 효용까지 보장하지 않는다.

## 갱신·제거·복구

| 대상 | 절차 | 완료 기준 |
|---|---|---|
| 선택 자산 | [자산 관리](repo-assets.md) preview → 승인된 apply/update/remove | 소유 기록·현재 지문 대조, 사용자 수정 보존, 실패 시 복구 또는 남은 충돌 기록 |
| 작업 중 중단 | 저장된 journal과 실제 파일을 읽고 수동 recover 검토 | 살아 있는 writer 보존, 근거 없는 덮어쓰기 금지, 복구하지 못한 경로 표시 |
| 플러그인 | [설치·갱신](harness-setup.md)의 공식 경로 | 실제 설치 버전·경로·설정 보존과 호스트 실행 구분 |
| GitHub 정책 | 제품이 승인한 기존 wrapper·서버 정책 | branch protection·required CI·commit·PR·release gate·audit·recovery 유지 |

repo drift와 과거 실행 기록은 제거하지 않는다. 플러그인 제거와 제품의 원격 정책 제거는 별도 행동이다.

## 분리 패키지 실험과 역사

과거 governance-core·native-adapter·workflow-pack의 소속·profile·수명주기 계약은
[실험 경계](product-boundary-experiment.md)에 보존한다. 당시 소스·filesystem·loader 결과도 같은 문서에 연결했다.
[실험 구현](../experiments/split-packaging/README.md)은 `installable:false`이며 공식 공개 설치 단위가 아니다.
실험의 공식 dependency/runtime binding 대기는 현재 공개 제품의 새 필수 작업으로 다시 편입하지 않는다.
이전 17개 스킬 core9/workflow8 분류는 실험 artifact 소속이며 사용자에게 별도 설치 선택을 강제하지 않는다.

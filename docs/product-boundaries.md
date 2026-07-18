# Team Harness 제품 경계

이 문서는 Team Harness의 설치·활성화·운영 단위를 정의하는 정본이다. 기능의 소유 판단은
[`product-direction.md`](product-direction.md), 현재 구현 분류는
[`platform-overlap-audit.md`](platform-overlap-audit.md)를 따른다.

## 현재 전환 상태

현재 `harness-guard`는 governance core, Claude·Codex 호환 adapter, 16개 skill과 agent를 함께 배포하는
**전환기 monolith**다. marketplace manifest도 하나이고 사용자는 구성 요소를 독립적으로 설치하거나 제거할 수
없다. 아래 세 단위는 **목표 제품 경계**이며 아직 독립 설치 단위가 아니다.

v0.59.0부터 `packaging/packages.json`과 `scripts/build-packages.mjs`가 네 단위의 파일 소속·호환 범위를
검증하고 staged artifact를 물리 디렉터리로 조립한다. source는 중복하지 않고 기록된 Git `HEAD`에서 결정적으로
복사한다. adapter가 core 실행 파일을 호출하는 지점은 runtime binding으로 명시하며, 새 artifact는 profile
installer가 binding을 제공하고 doctor로 실측하기 전이라 `installable: false`이고 marketplace에 노출하지 않는다.
기존 plugin 설치·업데이트·doctor 경로는 그대로 유지한다. 목표 이름을 현재 사용할 수 있는 package나 명령처럼
안내하지 않는다.

## 목표 제품 단위

### `unit:governance-core`

Team Harness가 항상 소유하고 기본 설치하는 제품 본체다.

- 저장소 규약과 policy as code: AGENTS, commit 규약, 스펙·결정 기록, stack별 표준.
- 서버 강제: branch protection, required CI, commit·PR·release gate.
- 증거·감사·복구: 현재 SHA 검증, 리뷰·배포 상태, 드리프트, 원자적 보호 복구와 back-merge.
- 도구 중립 실행기: PR wrapper, commit validator, repo-sync, migration·secret·test guard와 신규 repo baseline.
- core skill 9개: GitHub delivery와 증거 계약을 수행하는 최소 인터페이스.

core는 agent runtime이나 일반 개발 방법론을 구현하지 않는다. 로컬 adapter가 없어도 Git hook·CI·GitHub 계층은
독립적으로 동작해야 한다.

### `unit:native-adapter`

Claude Code나 Codex 같은 특정 runtime의 공식 확장 surface를 core 정책에 연결하는 얇은 배포 단위다.

- 해당 runtime의 hook 등록과 입력 payload 정규화.
- core 수용기준을 native skill·agent에 전달하는 metadata와 역할 매핑.
- plugin 설치·trust·managed policy 상태를 읽는 adapter별 doctor probe.
- runtime 고유 cache, config, agent definition은 adapter가 소유하되 repo/GitHub 정책의 정본이 될 수 없다.

사용하는 runtime adapter 하나만 기본 활성화한다. Claude adapter는 Codex adapter에 의존하지 않는다.
Codex adapter는 Claude adapter에 의존하지 않는다. 외부 runtime이 없어도 core의 server-backed enforcement는 남는다.

### `unit:workflow-pack`

개발자가 원할 때만 활성화하는 방법론·편의 workflow 모음이다.

- 계획 작성, TDD 진행, 반복 수정, milestone 관리, 일반 디버깅과 프론트 QA처럼 플랫폼이 수행할 수 있는 절차.
- core의 승인 spec, wrapper, 증거 게이트를 호출할 수 있지만 새로운 commit·push·PR·merge·release 권한은 만들지 않는다.
- 제거해도 저장소 정책과 GitHub 게이트가 바뀌지 않으며, 산출물은 repo 문서·GitHub Issue·commit에 남는다.

workflow-pack은 범용 agent runtime, 필수 개발 방법론, 독립된 정책 정본이 아니다.

## Skill 설치 경계

`기본`은 governance-core 설치 시 제공되는 delivery 인터페이스이고, `선택`은 workflow-pack을 명시적으로
활성화할 때만 제공하는 목표 상태다. 현재 monolith에서는 모두 함께 배포된다.

| 식별자 | 목표 단위 | 활성화 | 이유 |
|---|---|---|---|
| `skill:feature-add` | **workflow-pack** | **선택** | 일반 TDD 수행은 선택 절차이며 core에는 승인 spec·브랜치·증거 계약만 남긴다. |
| `skill:feature-merge` | **governance-core** | **기본** | 품질·리뷰·승인·CI를 develop 머지에 연결하는 delivery gate다. |
| `skill:feature-modify` | **workflow-pack** | **선택** | 일반 수정 방법론은 선택 절차이고 실제 머지 정책은 core가 소유한다. |
| `skill:hotfix` | **governance-core** | **기본** | main 패치·태그·develop 역병합과 복구 증거를 보존한다. |
| `skill:loop` | **workflow-pack** | **선택** | 반복 수행은 편의 workflow이며 종료 증거만 core 계약을 사용한다. |
| `skill:milestone` | **workflow-pack** | **선택** | GitHub milestone을 이용하는 제품 관리 편의 기능이다. |
| `skill:plan` | **workflow-pack** | **선택** | 계획 방법은 선택 사항이고 core는 승인 spec 형식만 검증한다. |
| `skill:pr-create` | **governance-core** | **기본** | guard가 맨손 PR 생성을 막으므로 검증된 wrapper 진입점을 항상 제공해야 한다. |
| `skill:pr-review-gate` | **governance-core** | **기본** | 현재 SHA의 CI·리뷰·승인·배포 상태를 머지 증거로 합성한다. |
| `skill:qa` | **workflow-pack** | **선택** | 일반 WCAG·디자인 검토는 소비 repo와 플랫폼이 선택한다. |
| `skill:release-check` | **governance-core** | **기본** | 정식 릴리스 전 품질·보안·DB 준비 증거를 합성한다. |
| `skill:release` | **governance-core** | **기본** | release branch·tag·back-merge·health 결과 계약을 수행한다. |
| `skill:repo-sync` | **governance-core** | **기본** | 소비 repo와 정책 자산의 드리프트를 검출한다. |
| `skill:solo-merge` | **governance-core** | **기본** | 승인 제약만 원자적으로 풀고 보호 설정을 복구한다. |
| `skill:systematic-debugging` | **workflow-pack** | **선택** | 일반 디버깅 방법론은 플랫폼 native 기능으로 대체 가능하다. |
| `skill:verification-before-completion` | **governance-core** | **기본** | 완료·PR·머지·릴리스 주장을 현재 상태의 새 증거에 묶는다. |

runtime별 skill metadata와 agent 정의는 위 skill의 제품 소속이 아니라 `native-adapter`의 전달 메커니즘이다.
예를 들어 verifier의 수용기준은 core에 속하고, Claude agent Markdown이나 Codex agent TOML은 adapter에 속한다.

## 설치 프로필

프로필은 목표 구조의 사용자 선택이다. 물리 분리 전에는 문서상 계약이며 현재 설치 명령이 아니다.

| 프로필 | 구성 | 대상 | 기본 여부 |
|---|---|---|---|
| `profile:repository-only` | governance-core | AI plugin 없이 Git·CI·GitHub 정책만 사용하는 repo | 지원 |
| `profile:agent-governed` | governance-core + 해당 native-adapter | 하나의 지원 AI runtime에서 조기 가드와 delivery skill을 사용하는 팀 | **권장 기본** |
| `profile:workflow-assisted` | governance-core + 해당 native-adapter + 선택 workflow pack | 하네스의 계획·TDD·QA 편의 절차까지 원하는 팀 | opt-in |

여러 AI runtime을 함께 쓰는 팀은 core 하나에 adapter를 각각 독립 설치한다. workflow-pack 활성화 여부도 runtime별
UI가 아니라 repo 정책으로 기록하되, 어느 profile도 사용자의 기존 권한을 확대하지 않는다.

## 의존 방향

허용하는 제품 의존은 아래 두 방향뿐이다.

```text
native-adapter → governance-core
workflow-pack → governance-core
governance-core ↛ native-adapter
governance-core ↛ workflow-pack
```

- adapter는 core 검사기·wrapper·수용기준을 호출할 수 있다. core는 특정 runtime hook이나 model slug를 import하지 않는다.
- workflow는 core의 spec·wrapper·게이트를 호출할 수 있다. core CI는 workflow skill 존재 여부로 통과하지 않는다.
- adapter끼리 직접 의존하지 않는다. 공통 변환이 필요하면 core의 도구 중립 계약으로 올리거나 중복보다 작은
  공용 adapter 라이브러리로 분리하되 runtime 내부 구현을 복제하지 않는다.
- 순환 의존이 생기면 package 분리를 중단하고 책임 판정을 다시 한다.

workflow-pack을 설치하지 않거나 제거해도 다음 core 불변조건은 유지돼야 한다: **branch protection**,
**required CI**, **commit·PR·release gate**, **repo drift**, **audit·recovery**. adapter가 실패하거나 제거돼도
Git hook·CI·GitHub의 서버 강제를 성공으로 오판하지 않는다.

## 운영 수명주기

| 단계 | governance-core | native-adapter | workflow-pack |
|---|---|---|---|
| **설치** | repo baseline과 GitHub 정책을 먼저 적용하고 현재 SHA에서 self-check한다. | 사용하는 runtime 하나만 core version과 호환되는 공식 surface로 연결한다. | core와 adapter가 건강한 뒤 명시적 opt-in으로 활성화한다. |
| **업데이트** | 정책 schema·CI·wrapper migration을 우선 검증하고 소비 repo drift를 보고한다. | runtime 지원 matrix와 clean-session outcome parity를 검증한다. | skill 계약 변경만 배포하며 core 정책 변경을 숨겨 포함하지 않는다. |
| **doctor** | repo asset·branch protection·required check·wrapper 상태를 도구 호출 없이도 판정한다. | plugin·hook·managed policy·fresh-session probe를 해당 runtime에서만 검사한다. | 설치 목록·core 호환 version·권한 비확대만 검사한다. |
| **비활성화** | 서버 강제는 비활성화 대상으로 제공하지 않고 변경은 별도 승인 migration을 요구한다. | 로컬 조기 가드만 멈추며 CI·GitHub가 계속 최종 판정한다. | skill 자동·명시 선택을 멈추되 생성된 spec·Issue·commit은 보존한다. |
| **제거** | repo·GitHub 정책 제거는 영향 미리보기와 rollback 지점을 가진 별도 절차로만 수행한다. | 해당 runtime 설정·cache만 제거하고 다른 adapter와 core는 건드리지 않는다. | pack 파일·등록만 제거하고 core gate·repo 산출물은 삭제하지 않는다. |

영구 데이터의 소유자는 core다. repo 문서·spec·결정·commit과 GitHub Issue·PR·check가 정본이며 adapter cache와
workflow 세션 상태는 재생성 가능해야 한다. 제거 명령은 다른 단위의 파일이나 설정을 포괄 삭제하지 않는다.

## 물리 분리 전환 순서

1. **계약 잠금:** 이 문서와 동적 skill 경계 테스트를 먼저 배포한다. rollback은 문서 완료 표시를 되돌리는 것이다.
2. **manifest/package 분리(완료):** core, runtime adapter, workflow pack manifest와 버전 호환 범위를 추가하되
   기존 monolith는 그대로 유지한다. build artifact는 설치 불가로 표시해 검증 전 노출을 막는다.
3. **profile 설치·doctor 검증:** clean repo에서 세 profile의 설치·업데이트·비활성화·제거를 실측하고, adapter
   없이도 server-backed gate가 작동하는지 반증한다. 실패하면 새 profile을 기본으로 승격하지 않는다.
4. **호환 기간:** 최소 한 릴리스 동안 monolith를 deprecated alias로 유지하고 동일 결과·rollback 안내를 제공한다.
5. **legacy 경로 제거:** 사용률과 doctor 증거가 기준을 충족한 뒤 cache patch·중복 agent·monolith manifest를
   제거한다. required CI와 branch protection drift가 있으면 제거를 중단한다.

다음 단계는 로드맵 4번의 profile 설치·doctor 실측이다. 단위를 나누는 것 자체가 목적이 아니라 기본 설치의
강제력을 유지하면서 runtime 호환 비용과 선택 workflow 결합을 줄이는 것이 성공 기준이다.

## 비목표와 재검토 조건

- staged package는 실제 plugin·marketplace source, 설치 명령, 기본 활성 skill을 바꾸지 않는다.
- workflow-pack을 별도 범용 방법론 제품으로 확장하지 않는다.
- adapter가 플랫폼 sandbox·permission·agent runtime을 재구현하지 않는다.
- core를 설치하지 않은 standalone adapter나 workflow-pack은 지원하지 않는다.
- 공식 plugin packaging이 독립 dependency를 지원하지 않으면 임시 bundle을 유지할 수 있지만 논리 경계와
  제거 안전성 테스트는 유지한다.
- 지원 runtime, 조직 규모, GitHub 정책 모델이 바뀌면 profile과 단위 책임을 재검토하되 server-backed
  enforcement와 evidence-before-claims 원칙은 유지한다.

# 플랫폼 중복 감사

이 문서는 Team Harness의 실행 표면을 플랫폼과의 책임 경계에 따라 전수 분류한 정본이다. 판정은
[`product-direction.md`](product-direction.md)의 제품 경계와 `소유·연결·위임` 정의를 따른다.

## 감사 기준과 범위

- 최초 기준일: 2026-07-24; 개발 조정 연결 추가: 2026-09-20; 현행 목록·판정 갱신: 2026-10-15
- 현행 소스 기준: `develop`의 `ea75566`; 최초 감사 당시 근거는 아래에서 시점을 구분한다.
- 현재 대상: skill 17개, agent 정의 2개, hook handler 2개, Codex 호환 실행 파일 14개. 합계 35개다.
- 최초 36개 목록에는 `Agent` 모델 강제 hook이 있었다. 현대화 후보에서 native 선택으로 이전하며 등록을 제거했다.
  호환 script는 입력을 소비하지만 선택·출력·로그를 변경하지 않는다. fixture 48건 통과와 Claude 실제 실행 보류는
  [현재 실행 스펙](specs/harness-modernization.md)에 구분해 기록한다. 발행·설치 완료를 뜻하지 않는다.
- 근거: 각 구현, 직접 호출자, 회귀 테스트, 결정 기록과 로컬 `codex-cli 0.144.6`의 read-only 출력.
- 로컬 확인: `codex features list`에서 `hooks`, `plugins`, `multi_agent`가 stable이고 `codex plugin --help`가
  설치·목록·marketplace 관리 명령을 제공했다. 이는 이 버전의 시점 증거이며 향후 버전까지 보장하지 않는다.
- 탐지: 파일명에 `codex`가 있거나 Codex CLI·호환 실행 파일을 직접 호출하는 script를 포함한다. 따라서 이름에
  `codex`가 없는 `harness-doctor.sh`도 실행 표면으로 계산한다.
- 제외: 문서·테스트·spec과 Codex native skill wrapper는 구현 표면 수에 넣지 않았다. wrapper는 공용 skill의
  전달 계층이며 `codex-native-loader-test.sh`가 17개 일대일 대응을 별도로 고정한다.

판정의 의미는 다음과 같다.

- **소유:** GitHub 정책, 검증 증거, 감사, 복구, 드리프트처럼 실행 플랫폼이 바뀌어도 Team Harness가 책임진다.
- **연결:** 플랫폼 공식 기능을 사용하되 하네스의 결과 계약이나 GitHub 게이트에 이어 주는 최소 계층만 남긴다.
- **위임:** 일반 에이전트 방법론이나 플랫폼 실행 메커니즘이다. 하네스 구현을 축소하거나 제거한다.

## 전수 분류

각 행은 현행 책임과 유지 상태다. 조건부 제거 방향은 별도 근거·승인 전 실행하거나 완료로 세지 않는다.

### Skill

| 식별자 | 판정 | 목표 상태 | 근거·후속 조치 |
|---|---|---|---|
| `skill:ao-coordinate` | **연결** | 선택 기능 | native 역할을 작업·인계·독립 검증 계약과 core gate에 연결한다. 별도 runner·권한 엔진은 만들지 않는다. |
| `skill:feature-add` | **연결** | 축소 유지 | 일반 TDD 수행은 플랫폼에 맡기고 승인 spec·브랜치·RED/GREEN 증거·커밋 계약만 남긴다. |
| `skill:feature-merge` | **소유** | 유지 | 품질·리뷰·승인·CI를 develop 머지와 연결하는 delivery 계약이다. |
| `skill:feature-modify` | **연결** | 축소 유지 | 일반 수정 방법론은 위임하고 변경분 RED와 repo 게이트만 연결한다. |
| `skill:hotfix` | **소유** | 유지 | main 긴급 패치·태그·develop 역병합과 복구 증거를 책임진다. |
| `skill:loop` | **연결** | 축소 유지 | 반복 판단은 플랫폼에 맡기고 timeout·fingerprint·exit evidence만 재사용 가능한 연결로 남긴다. |
| `skill:milestone` | **연결** | 선택 기능 | GitHub milestone 기능을 복제하지 않고 제품 목표와 검증 가능한 진행률 계약만 연결한다. |
| `skill:plan` | **연결** | 축소 유지 | 일반 계획 방법은 위임하고 승인 spec 형식과 feature 진입 게이트만 남긴다. |
| `skill:pr-create` | **연결** | 얇게 유지 | 공식 GitHub PR 생성에 명시 base·제품 branchFlow와 현재 SHA 품질 증거를 연결한다. |
| `skill:pr-review-gate` | **소유** | 유지 | CI·리뷰·승인·외부 배포 상태를 현재 SHA의 머지 증거로 합성한다. |
| `skill:qa` | **연결** | 선택 기능 유지 | 일반 검토 방법론은 선택한 도구에 맡기며 프로젝트 디자인·접근성 검사 연결을 유지한다. 독립 package로 분리하지 않는다. |
| `skill:release-check` | **소유** | 유지 | 품질·보안·DB 준비 증거를 정식 릴리스 직전에 합성하는 게이트다. |
| `skill:release` | **소유** | 유지 | release branch·main 태그·develop 역병합·헬스체크의 감사 가능한 delivery 계약이다. |
| `skill:repo-sync` | **소유** | 유지 | 소비 repo와 정책 자산의 드리프트를 검출하는 제품 핵심이다. |
| `skill:solo-merge` | **소유** | 유지 | 자기승인 불가 조건만 원자적으로 풀고 복구하는 감사·복구 계약이다. |
| `skill:systematic-debugging` | **연결** | 축소 유지 | 일반 진단 방법론은 위임하고 프로젝트 재현 증거·진단 권한·수정 인계 계약은 유지한다. |
| `skill:verification-before-completion` | **소유** | 유지 | 완료·PR·머지·릴리스 주장을 현재 상태의 새 증거에 묶는 결과 계약이다. |

개발 조정은 선택형 skill 하나로 연결한다. 초기 통합본의 선언 검사·DRAFT 기록 도구와 연구용 역할 체계는 실제 소비 필요성이 없어 제거했다. 기존 native 실행과 core gate를 사용한다.

### Agent 정의

| 식별자 | 판정 | 목표 상태 | 근거·후속 조치 |
|---|---|---|---|
| `agent:plugins/harness-guard/agents/security-reviewer.md` | **연결** | 기준만 유지 | 보안 검토 기준은 유지하되 spawn·모델 선택·격리는 플랫폼에 맡긴다. |
| `agent:plugins/harness-guard/agents/verifier.md` | **연결** | 기준만 유지 | 독립 반증 체크리스트만 공유하고 실행 방식과 모델은 플랫폼에 맡긴다. |

### Hook handler

| 식별자 | 판정 | 목표 상태 | 근거·후속 조치 |
|---|---|---|---|
| `hook:PreToolUse:1:Bash:1:command` | **연결** | 얇게 유지 | 명령을 서버 정책과 같은 규칙에 연결하는 조기 피드백이며 CI·GitHub가 최종 강제한다. |
| `hook:PreToolUse:1:Bash:2:prompt` | **연결** | 현재 보호 유지 | Claude prompt hook은 등록 상태다. 대체 보호의 실제 동등성 확인 전 제거하지 않으며 플랫폼 permission·서버 secret scan을 유지한다. |
| `legacy-hook:UserPromptSubmit:1:*:1:command` | **위임** | 기본 연결 제거 | 과거 상태 기반 `route-intent` 소스만 호환 회귀로 보존한다. 의미 분류기는 native에 위임한다. |

### Codex 호환 실행 파일

| 식별자 | 판정 | 목표 상태 | 근거·후속 조치 |
|---|---|---|---|
| `codex-file:plugins/harness-guard/scripts/codex-pretool-guard.mjs` | **연결** | 축소 유지 | native hook 입력을 공용 guard 계약으로 정규화하는 최소 어댑터만 남긴다. |
| `codex-file:plugins/harness-guard/scripts/codex-secret-egress-guard.mjs` | **연결** | 축소 유지 | 결정적 외부 전송 검사를 native hook에 연결하되 플랫폼 permission과 서버 scan을 대체하지 않는다. |
| `codex-file:plugins/harness-guard/scripts/codex-security-guidance-adapter.mjs` | **위임** | 제거 보류 | 외부 출력 호환은 upstream 책임이지만 기존 patched 소비 경계·실측 미확인으로 adapter와 회귀를 보존한다. |
| `codex-file:plugins/harness-guard/scripts/patch-codex-security-guidance.mjs` | **위임** | 제거 보류 | 장기 cache mutation은 확대하지 않는다. 기본 호출은 없으며 기존 opt-in 계약의 종료 근거 확인 전 보존한다. |
| `codex-file:scripts/check-codex-native-plugin.mjs` | **연결** | 얇게 유지 | 설치된 source path의 native manifest·command hooks·skill inventory만 읽기 전용으로 검증한다. |
| `codex-file:scripts/generate-codex-skills.mjs` | **연결** | 유지 | 공유 skill metadata와 native 계약에서 얇은 wrapper를 생성하고 drift를 검사한다. |
| `codex-file:scripts/codex-binary-trust.mjs` | **소유** | 유지 | 승인 digest·code signature·version과 실행 전후 identity를 결박해 Codex provenance 증거를 책임진다. |
| `codex-file:scripts/codex-fresh-session-smoke.sh` | **소유** | 유지 | 실제 새 세션에서 정책·시크릿 차단 결과를 검증하는 outcome parity 증거다. |
| `codex-file:scripts/codex-hardened.sh` | **연결** | 얇게 유지 | 공식 plugin version sync와 native 계약 검사 뒤 Codex 인자를 그대로 전달한다. |
| `codex-file:scripts/harness-doctor.sh` | **연결** | 공식 surface 중심으로 유지 | Codex·plugin·managed policy 상태를 repo·GitHub 건강 증거와 합성하되 cache patch 의존은 제거한다. |
| `codex-file:scripts/install-codex-managed-requirements.sh` | **연결** | 조건부 유지 | 공식 managed requirements에서 hooks 활성화만 보장하고 unified exec 선택은 플랫폼에 맡긴다. |
| `codex-file:scripts/run-codex-native-loader-pilot.mjs` | **연결** | 검증 도구 유지 | 격리된 공식 loader·새 session 결과와 사용자 상태 불변을 증거로 남기며 runtime을 복제하지 않는다. |
| `codex-file:scripts/run-codex-split-loader-pilot.mjs` | **연결** | 검증 도구 유지 | exact split artifact를 격리된 공식 loader로 설치·역순 제거하고 cache·사용자 상태 불변을 검증한다. |
| `codex-file:scripts/sync-codex-plugin-cache.mjs` | **연결** | 얇게 유지 | launcher가 공식 `codex plugin` 명령의 버전 확인·조건부 갱신 helper로 사용한다. cache 내부는 건드리지 않는다. |

## 목표 구조

목표는 플랫폼별 기능을 모두 없애는 것이 아니라 책임을 세 층으로 정리하는 것이다.

1. **거버넌스 core:** branch protection, required CI, commit·PR·release gate, evidence, drift, audit와 복구를
   Team Harness가 소유한다.
2. **native adapter:** 공식 hook·plugin·managed policy가 공용 정책 검사와 결과 증거를 호출하도록 얇게 연결한다.
3. **선택 workflow:** 일반 계획·TDD·디버깅·QA·탐색은 플랫폼 native skill이나 소비 repo 구성을 사용한다.

skill과 agent의 prose는 실행 엔진이 아니다. 유지되는 항목도 모델 slug·spawn 방식·도구 이름을 고정하지 않고
수용기준과 GitHub 결과만 정의한다. 로컬 hook은 빠른 피드백이고, 거부 규칙의 최종 권위는 CI와 GitHub다.

## 전환 순서

아래는 기존 호환 계층 축소 때 적용한 순서다. 남은 호환 종료에도 같은 보호 기준을 사용하되
[1.0.0 재설계](specs/team-harness-redesign.md)의 합의 범위를 새 기능·분리 package 계획으로 늘리지 않는다.

1. **공식 surface 검증:** 지원 Codex·Claude 버전에서 plugin 설치, hook event, managed policy, native agent와 skill
   loading을 clean session으로 실측한다.
2. **결과 동등성 테스트:** 현재 guard·secret egress·skill 발견·검토 증거가 공식 surface에서도 같은
   수용기준과 exit 결과를 내는지 forward test를 추가한다.
3. **문서·doctor 전환:** 설치·업데이트·문제 진단을 공식 명령과 단일 doctor로 바꾸고 launcher는 sync·검사만
   수행하는 얇은 경로로 축소한다.
4. **호환 patch 제거:** v0.61.0에서 harness cache patch와 Codex agent 복사본을 제거했다. 외부
   security-guidance patch는 공식 호환 surface 확인 뒤 별도 제거하고 fresh-session smoke를 유지한다.
5. 일반 방법론은 선택한 native/Superpowers에 위임하고 공유 skill은 프로젝트 계약 연결로 유지한다.

초기 감사의 선택 package 분리·진단 skill 제거 방향은 위 재설계로 대체됐다. 공개 plugin은 하나이며
기존 발견 이름·wrapper를 유지한다. 과거 판단은 [정리 전 원문](https://github.com/grinvi04/team-harness/blob/ea755661e735c3ce2fb026e3b4eaeb65e49888ac/docs/platform-overlap-audit.md)에 보존한다.

2026-10-11 정리에서는 외부 security-guidance의 실제 상류 호환과 patched 소비 경계를 확인하지 못해
삭제를 보류한다. launcher 자동 호출은 없으며 [현재 근거](specs/global-cleanup-upgrade.md#security-guidance-삭제-보류-근거)를 따른다.
위 제거 판정은 방향이며 제거 완료가 아니다.

## 잔여 위험과 재검토 조건

- 최초 CLI 확인은 0.144.6의 시점 증거다. 이후 실제 CLI·데스크톱 인수와 Claude 보류 범위는
  [현행 지원 표](support.md)를 따른다. 다른 버전까지 같은 hook·trust 동작을 보장하지 않는다.
- local hook을 제거하기 전에 CI·GitHub의 대응 규칙이 실제로 같은 거부를 수행하는지 반증해야 한다.
- 외부 플러그인이 공식 Codex 호환을 제공하지 않으면 adapter 제거 대신 해당 플러그인을 선택 의존성으로
  분리할 수 있다. cache·snapshot 직접 수정은 복구하지 않는다.
- 공식 surface가 불안정하거나 outcome parity가 깨지면 연결 계층을 유지하되 내부 patch 확대는 중단한다.
- 새로운 skill·agent·hook·Codex 실행 파일이 추가되면 이 감사와 CI 인벤토리를 함께 갱신해야 한다.

## 역사: 2026-10-11 통합 구현 후보

plan·feature-add·feature-modify·systematic-debugging의 반복 계약을
[공통 프로젝트 계약](../plugins/harness-guard/skills/ao-coordinate/project-contract.md)으로 모은다.
일반 방법론은 선택한 Superpowers/native에 위임하고 기존 발견 이름·wrapper는 유지하고 기본 라우팅 연결은 제거한다.
loop의 timeout·fingerprint·중단과 milestone의 AC 증거 집계는 유지하며 고정 모델·인원·플랫폼 전용 호출을 줄인다.
release-check의 SVG·mtime·전용 provenance, release의 changelog 경로는 repo 선언으로 이전한다.
이 저장소의 live provenance·changelog는 AGENTS.md 필수 선언으로 유지한다.
당시 0.87.0 소스 후보의 검증·병합·발행·설치 기록은 [해당 스펙](specs/skill-contract-consolidation.md)에 보존한다.

# 플랫폼 중복 감사

이 문서는 Team Harness의 실행 표면을 플랫폼과의 책임 경계에 따라 전수 분류한 정본이다. 판정은
[`product-direction.md`](product-direction.md)의 제품 경계와 `소유·연결·위임` 정의를 따른다.

## 감사 기준과 범위

- 기준일: 2026-07-18
- 기준 브랜치: `develop`의 플랫폼 중복 감사 작업 시작 시점
- 대상: skill 16개, agent 정의 5개, hook handler 4개, Codex 호환 실행 파일 9개. 합계 34개다.
- 근거: 각 구현, 직접 호출자, 회귀 테스트, 결정 기록과 로컬 `codex-cli 0.144.5`의 read-only 출력.
- 로컬 확인: `codex features list`에서 `hooks`, `plugins`, `multi_agent`가 stable이고 `codex plugin --help`가
  설치·목록·marketplace 관리 명령을 제공했다. 이는 이 버전의 시점 증거이며 향후 버전까지 보장하지 않는다.
- 제외: 문서·테스트·spec은 구현 표면 수에 넣지 않았다. Codex agent TOML은 agent로만 계산했다.

판정의 의미는 다음과 같다.

- **소유:** GitHub 정책, 검증 증거, 감사, 복구, 드리프트처럼 실행 플랫폼이 바뀌어도 Team Harness가 책임진다.
- **연결:** 플랫폼 공식 기능을 사용하되 하네스의 결과 계약이나 GitHub 게이트에 이어 주는 최소 계층만 남긴다.
- **위임:** 일반 에이전트 방법론이나 플랫폼 실행 메커니즘이다. 하네스 구현을 축소하거나 제거한다.

## 전수 분류

각 행의 판정은 현재 항목에 대한 최종 책임 판정이고, 목표 상태는 실제 후속 변경 방향이다.

### Skill

| 식별자 | 판정 | 목표 상태 | 근거·후속 조치 |
|---|---|---|---|
| `skill:feature-add` | **연결** | 축소 유지 | 일반 TDD 수행은 플랫폼에 맡기고 승인 spec·브랜치·RED/GREEN 증거·커밋 계약만 남긴다. |
| `skill:feature-merge` | **소유** | 유지 | 품질·리뷰·승인·CI를 develop 머지와 연결하는 delivery 계약이다. |
| `skill:feature-modify` | **연결** | 축소 유지 | 일반 수정 방법론은 위임하고 변경분 RED와 repo 게이트만 연결한다. |
| `skill:hotfix` | **소유** | 유지 | main 긴급 패치·태그·develop 역병합과 복구 증거를 책임진다. |
| `skill:loop` | **연결** | 축소 유지 | 반복 판단은 플랫폼에 맡기고 timeout·fingerprint·exit evidence만 재사용 가능한 연결로 남긴다. |
| `skill:milestone` | **연결** | 선택 기능 | GitHub milestone 기능을 복제하지 않고 제품 목표와 검증 가능한 진행률 계약만 연결한다. |
| `skill:plan` | **연결** | 축소 유지 | 일반 계획 방법은 위임하고 승인 spec 형식과 feature 진입 게이트만 남긴다. |
| `skill:pr-create` | **연결** | 얇게 유지 | 공식 GitHub PR 생성에 base 감지·현재 SHA 품질 증거만 더하는 단일 래퍼로 제한한다. |
| `skill:pr-review-gate` | **소유** | 유지 | CI·리뷰·승인·외부 배포 상태를 현재 SHA의 머지 증거로 합성한다. |
| `skill:qa` | **위임** | 선택 기능으로 분리 | 일반 WCAG·디자인 검토 방법론은 플랫폼과 소비 repo 도구에 맡기고 공용 core에서 분리한다. |
| `skill:release-check` | **소유** | 유지 | 품질·보안·DB 준비 증거를 정식 릴리스 직전에 합성하는 게이트다. |
| `skill:release` | **소유** | 유지 | release branch·main 태그·develop 역병합·헬스체크의 감사 가능한 delivery 계약이다. |
| `skill:repo-sync` | **소유** | 유지 | 소비 repo와 정책 자산의 드리프트를 검출하는 제품 핵심이다. |
| `skill:solo-merge` | **소유** | 유지 | 자기승인 불가 조건만 원자적으로 풀고 복구하는 감사·복구 계약이다. |
| `skill:systematic-debugging` | **위임** | 공용 core에서 제거 | 일반 디버깅 방법론은 플랫폼 native skill과 에이전트 추론에 맡긴다. |
| `skill:verification-before-completion` | **소유** | 유지 | 완료·PR·머지·릴리스 주장을 현재 상태의 새 증거에 묶는 결과 계약이다. |

### Agent 정의

| 식별자 | 판정 | 목표 상태 | 근거·후속 조치 |
|---|---|---|---|
| `agent:plugins/harness-guard/agents/security-reviewer.md` | **연결** | 기준만 유지 | 보안 검토 기준은 유지하되 spawn·모델 선택·격리는 플랫폼에 맡긴다. |
| `agent:plugins/harness-guard/agents/verifier.md` | **연결** | 기준만 유지 | 독립 반증 체크리스트만 공유하고 실행 방식과 모델은 플랫폼에 맡긴다. |
| `agent:plugins/harness-guard/codex/agents/harness-explorer.toml` | **위임** | 제거 | 일반 read-only 탐색 역할은 Codex의 native agent 실행과 작업 지시로 충분하다. |
| `agent:plugins/harness-guard/codex/agents/harness-security-reviewer.toml` | **연결** | 공용 기준에 통합 | Codex 전용 복사본 대신 공용 보안 수용기준을 native agent에 전달한다. |
| `agent:plugins/harness-guard/codex/agents/harness-verifier.toml` | **연결** | 공용 기준에 통합 | Codex 전용 복사본 대신 공용 반증 수용기준을 native agent에 전달한다. |

### Hook handler

| 식별자 | 판정 | 목표 상태 | 근거·후속 조치 |
|---|---|---|---|
| `hook:PreToolUse:Bash:command` | **연결** | 얇게 유지 | 명령을 서버 정책과 같은 규칙에 연결하는 조기 피드백이며 CI·GitHub가 최종 강제한다. |
| `hook:PreToolUse:Bash:prompt` | **위임** | 제거 | LLM prompt 기반 시크릿 판정은 플랫폼 permission과 결정적 검사에 위임하고 서버 secret scan을 유지한다. |
| `hook:PreToolUse:Agent:command` | **위임** | 제거 | subagent 생성·모델 선택·reasoning effort는 플랫폼 책임이며 고정 모델 주입을 중단한다. |
| `hook:UserPromptSubmit:*:command` | **연결** | 좁게 유지 | `route-intent`는 Git/PR **상태 기반** 다음 단계만 연결하고 일반 자연어 **의미 분류기**로 확장하지 않는다. |

### Codex 호환 실행 파일

| 식별자 | 판정 | 목표 상태 | 근거·후속 조치 |
|---|---|---|---|
| `codex-file:plugins/harness-guard/scripts/codex-pretool-guard.mjs` | **연결** | 축소 유지 | native hook 입력을 공용 guard 계약으로 정규화하는 최소 어댑터만 남긴다. |
| `codex-file:plugins/harness-guard/scripts/codex-secret-egress-guard.mjs` | **연결** | 축소 유지 | 결정적 외부 전송 검사를 native hook에 연결하되 플랫폼 permission과 서버 scan을 대체하지 않는다. |
| `codex-file:plugins/harness-guard/scripts/codex-security-guidance-adapter.mjs` | **위임** | 제거 | 외부 플러그인의 Claude 전용 출력을 고치는 책임은 upstream 또는 공식 호환 surface에 맡긴다. |
| `codex-file:plugins/harness-guard/scripts/patch-codex-harness-guard.mjs` | **위임** | 우선 제거 | 설치 cache의 hook·skill·agent를 직접 변형하므로 공식 plugin과 hook surface 전환 후 제거한다. |
| `codex-file:plugins/harness-guard/scripts/patch-codex-security-guidance.mjs` | **위임** | 우선 제거 | 외부 plugin cache와 marketplace snapshot mutation은 장기 지원 API가 아니므로 제거한다. |
| `codex-file:scripts/codex-fresh-session-smoke.sh` | **소유** | 유지 | 실제 새 세션에서 정책·시크릿 차단 결과를 검증하는 outcome parity 증거다. |
| `codex-file:scripts/codex-hardened.sh` | **위임** | 우선 제거 후 doctor로 통합 | cache patch와 feature 강제 launcher 대신 공식 설치·managed policy·doctor 경로를 사용한다. |
| `codex-file:scripts/install-codex-managed-requirements.sh` | **연결** | 조건부 유지 | 공식 managed requirements에 조직 정책을 연결하되 지원 범위와 제거 절차를 명시한다. |
| `codex-file:scripts/sync-codex-plugin-cache.mjs` | **연결** | installer·doctor에 통합 | 공식 `codex plugin` 명령을 호출하는 버전 확인만 남기고 cache 내부는 건드리지 않는다. |

## 목표 구조

목표는 플랫폼별 기능을 모두 없애는 것이 아니라 책임을 세 층으로 정리하는 것이다.

1. **거버넌스 core:** branch protection, required CI, commit·PR·release gate, evidence, drift, audit와 복구를
   Team Harness가 소유한다.
2. **native adapter:** 공식 hook·plugin·managed policy가 공용 정책 검사와 결과 증거를 호출하도록 얇게 연결한다.
3. **선택 workflow:** 일반 계획·TDD·디버깅·QA·탐색은 플랫폼 native skill이나 소비 repo 구성을 사용한다.

skill과 agent의 prose는 실행 엔진이 아니다. 유지되는 항목도 모델 slug·spawn 방식·도구 이름을 고정하지 않고
수용기준과 GitHub 결과만 정의한다. 로컬 hook은 빠른 피드백이고, 거부 규칙의 최종 권위는 CI와 GitHub다.

## 전환 순서

호환 계층은 아래 순서를 지켜 보호 공백 없이 줄인다.

1. **공식 surface 검증:** 지원 Codex·Claude 버전에서 plugin 설치, hook event, managed policy, native agent와 skill
   loading을 clean session으로 실측한다.
2. **결과 동등성 테스트:** 현재 guard·secret egress·skill 발견·검토 증거가 공식 surface에서도 같은
   수용기준과 exit 결과를 내는지 forward test를 추가한다.
3. **문서·doctor 전환:** 설치·업데이트·문제 진단을 공식 명령과 단일 doctor로 바꾸고 기존 launcher 의존을
   경고가 보이는 deprecated 경로로 내린다.
4. **호환 patch 제거:** 두 cache patcher와 security adapter를 먼저 제거하고, 이어 hardened launcher와 중복
   agent 복사본을 제거한다. 한 릴리스 동안 rollback 가능한 이전 경로와 fresh-session smoke를 유지한다.
5. 선택 workflow 분리는 별도 제품 경계 작업에서 수행하고, core 설치가 일반 방법론 skill을 요구하지 않게 한다.

우선순위는 cache·snapshot mutation 제거가 1순위, 모델 강제 hook과 중복 agent 제거가 2순위, 일반 방법론
skill의 선택 패키지 분리가 3순위다. 실제 제거는 각각 별도 승인 spec과 릴리스로 진행한다.

## 잔여 위험과 재검토 조건

- 로컬 CLI 확인은 0.144.5 한 버전의 시점 증거다. 지원 최소·최대 버전에서 hook payload와 plugin trust가 같다는
  의미는 아니므로 clean-session matrix가 필요하다.
- local hook을 제거하기 전에 CI·GitHub의 대응 규칙이 실제로 같은 거부를 수행하는지 반증해야 한다.
- 외부 플러그인이 공식 Codex 호환을 제공하지 않으면 adapter 제거 대신 해당 플러그인을 선택 의존성으로
  분리할 수 있다. cache·snapshot 직접 수정은 복구하지 않는다.
- 공식 surface가 불안정하거나 outcome parity가 깨지면 연결 계층을 유지하되 내부 patch 확대는 중단한다.
- 새로운 skill·agent·hook·Codex 실행 파일이 추가되면 이 감사와 CI 인벤토리를 함께 갱신해야 한다.

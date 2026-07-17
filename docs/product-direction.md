# Team Harness 제품 방향

이 문서는 Team Harness가 무엇을 만들고 무엇을 만들지 않을지 판단하는 **제품 방향의 단일 출처**다.
기능 제안·설계·감사·정리 작업은 이 경계를 먼저 적용한다.

## 제품 정체성

> **Team Harness는 AI 코딩 에이전트를 사용하는 GitHub 팀을 위한 GitHub-native AI 코딩 거버넌스다.**
> 팀 정책을 `policy as code`로 배포하고, 변경이 검증 가능한 증거를 갖춰야 머지·릴리스되는
> `evidence-gated delivery`를 제공한다.

Team Harness는 코딩 에이전트나 개발 방법론을 대체하지 않는다. 실행 플랫폼이 제공하는 확장 기능과
GitHub의 서버 통제를 연결해, 사람과 AI가 같은 정책·승인·증거 계약을 따르게 하는 delivery 계층이다.

## Team Harness가 소유하는 것

다음은 실행 플랫폼이 바뀌어도 Team Harness가 직접 책임진다.

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
6. **small-team proportionality:** 5~10명 팀에 실제로 필요한 통제만 유지하고 추측성 기업 기능은 만들지 않는다.

## 신규 기능 판단 게이트

새 기능을 추가하기 전에 다음 질문에 답한다.

1. 이 기능은 팀 정책을 서버에서 강제하거나 현재 변경의 증거 품질을 높이는가?
2. 실행 도구가 달라도 동일해야 하는 결과 계약을 제공하는가?
3. Claude Code·Codex·GitHub의 안정적인 공식 기능이 이미 같은 문제를 해결하는가?
4. 공식 기능이 있다면 Team Harness에는 연결·검증만 남기고 구현을 위임할 수 있는가?
5. 특정 프로젝트의 요구라면 공용 하네스가 아니라 소비 repo 설정에 두는 것이 맞지 않은가?
6. 추가되는 유지보수·호환성 비용이 실제로 줄이는 운영 위험보다 작은가?

판정은 세 가지 중 하나로 기록한다.

- **소유:** 서버 강제·증거·감사·드리프트처럼 Team Harness의 핵심 책임이다.
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

1. [x] **공개 안전성 감사:** Git 히스토리 시크릿, 공개 식별정보·개인 경로, 라이선스 provenance 점검. 결과는
   [`public-safety-audit.md`](public-safety-audit.md)에 기록했다.
2. **플랫폼 중복 감사:** 현재 skill·hook·agent·Codex patch를 소유/연결/위임으로 전수 분류.
3. **제품 경계 분리:** 서버 거버넌스 core와 선택적 workflow 편의 기능의 설치·운영 경계 정의.
4. **배포 단순화:** 설치·업데이트·제거·doctor를 안정적인 단일 진입점으로 정리하고 공식 surface를 우선 사용.
5. **오픈소스 제품화:** 영문 Quick Start, 지원 환경, SECURITY·CONTRIBUTING·CHANGELOG와 release artifact 정리.
6. **호환성 검증:** 다른 skill/plugin과 함께 설치한 clean-session 충돌·우선순위 테스트.
7. **외부 파일럿:** 독립 프로젝트에서 설치 시간, 차단 오탐·누락, 유지보수 비용을 측정해 방향을 재검증.

로드맵 항목은 기능 수가 아니라 거버넌스 강제력, 증거 품질, 유지보수 감소로 성공 여부를 판단한다.

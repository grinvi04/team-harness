# 회사 개발팀 선택형 도입 개선

사용자 승인: 이 대화의 여섯 묶음을 선행 작업의 main·새 버전 발행 뒤 구현한다.
2026-10-12 확인: 선행 대화 완료, PR537 main=f8734af6,
원격 v0.91.1 같은 SHA, 두 manifest·README 0.91.1. 기반 develop=bfc57bf.
선행 전달 후 CI 빈 범위 오류 #539는 미해결이며 이번 범위에 자동 편입하지 않는다.

## 목표·권한·중단 조건

기존 회사 정책·제품 검사·사용자 파일을 보존하면서 필요한 자산만 채택한다.
기술 검증, 제품 적용, 원격 정책 집행, 독립 팀 효용을 각각 판정한다.
로컬 구현·검사·문서 작업 승인. 소비 원격 정책·운영·DB/Auth/Storage·배포·결제,
전역 설정/설치·다른 팀 연락은 제외한다. 실제 인수 환경·참여자가 없으면
가능한 로컬 작업을 마친 뒤 대상과 필요한 행동을 보고한다. 미실행을 완료로 세지 않는다.

제품 방향: 정책·증거·자산 수명주기는 소유, 제품 검사·팀 규약은 연결,
실제 승인·required CI·runtime/sandbox 실행은 GitHub/native 플랫폼에 위임한다.
새 agent runtime·package 승격·범용 정책 엔진·기존 앱 의존성 갱신은 비목표다.

## 승인된 여섯 묶음과 검사 계약

| ID·순서 | 새 동작·보존 계약 | 검사·완료 기준 |
|---|---|---|
| P0-policy | main-only/main+develop 선택, 기존 승인·CODEOWNERS·제한 보존, preview; 회사 경로 solo 차단 | fixture의 API writes 0/정확한 diff·재조회; 오류/미지원 거부. 실제 승인 서버의 동료 승인 집행은 별도 UNVERIFIED |
| P0-merge | 수동/자동 모두 비어 있지 않은 required 집합·현재 head 성공 필요, Actions fallback은 증거 대체 불가 | 없음/누락/실패/미완료/조회오류/다른 후보 거부, 정상·외부 CI 허용; head/base drift·match-head 유지 |
| P1-lifecycle | 명시 선택한 자산만 미리보기·적용·갱신·제거, source SHA·버전·소유 hash | preview 무변경, 멱등, 제품 변경 충돌, 중간 실패 복구, foreign 파일/기존 hooks 유지 |
| P1-options | 회사 규약 선택, 사용 구성별 doctor, 계획 파일 존재와 승인 분리 | tech-only에 Codex/GH 강제 없음, 선택한 규약만 설치; config/runtime 판정 분리, 소스 최신과 채택 버전 차이만으로 실패 금지 |
| P1-product | 0.91.1 스택 판독·충돌 경계를 재사용하고 제품 checker에 연결 | 독립 checker 정상·중간 실패 시 후속 실행0, 앱 의존성 자동 갱신0; 실제 제품 lock/build/통합은 대상 미선정 UNVERIFIED |
| P2-team | 독립 작성자·리뷰어 인계와 기존 native+CI 기준선 비교 | 실제 참여·업무·검사 누락0/정책 약화0·작업/재검토/유지 비용; fixture를 팀 인수로 인정하지 않음 |

## 최소 구현 선택

- 원격 보호 도구는 현재 보호를 먼저 읽고 보존한다. 낮은 승인/체크 요구로 기존 정책을 약화하지 않는다.
  unsupported ruleset/필드·권한·네트워크 실패는 mutation 전 중단한다.
- `.harness-policy.json`은 schema1의 회사/solo 선택과 자동머지 대상만 선언한다.
  선언 없음은 회사 경로이며 solo 예외를 허용하지 않는다. 회사 정책은 GitHub가 최종 집행한다.
  solo는 명시 opt-in에 더해 개인 소유 repo·실제 협업자 1명을 확인한다.
- 병합은 required status 정책의 strict/nonempty와 `gh pr checks --required` 결과를 함께 대조한다.
  API 확인이 불가능한 ruleset 전용 repo는 UNVERIFIED로 중단한다. 모든 GitHub 정책 구현을 추측하지 않는다.
- 신규 셋업의 개인 기본 호환은 유지하고 회사 경로를 명시 선택한다. 기존 hooksPath는 자동 교체하지 않는다.
  기존 repo의 관리 자산 갱신/제거는 별도 로컬 도구로 분리한다.
- 회사 commit validator는 제품 원문을 명시 선택해 연결한다. 개인 한국어 validator 정본은 유지한다.
  규약 선택으로 시크릿·test-guard·required CI를 끄지 않는다.
- doctor는 명시한 tech/github/codex 구성만 검사한다. 실행하지 않은 native probe는 UNVERIFIED다.
- 제품별 실제 명령·독립 팀 관찰은 제품 저장소의 기록을 연결하며 이 repo에서 운영 접근하지 않는다.

## 유지할 경계와 관련 문서

기존 guard·시크릿·테스트 감소·migration·head/base/review gate와 생성 정본 유지.
선행 React/Nuxt/Python/Rails 버전 기능을 다시 만들지 않는다.
관련 현재 문서: docs/code-review.md, docs/harness-maintenance.md,
docs/repository-structure.md, docs/local-development.md, docs/development-coordination.md,
회사 정책/자산 안내와 영향받는 PR/solo 스킬. decisions와 버전·생성물도 함께 대조한다.

## 검증·현재 상태

계약 고정 후 P0·P1 로컬 구현 진행, P2 인수 계약 준비. 전체 품질·독립 검토 전이므로 완료 아님; API fake·임시 Git repo만 로컬 시험한다.
필수 normal/refusal/boundary·기존 유지 시험, 전체 quality, 독립 보안/기능 검토가 구현 인수 조건이다.
최초 RED와 후속 GREEN/실패 원문은 `.runtime/company-adoption/`에 보존한다.
제품 환경과 독립 참여자 인수는 UNVERIFIED이며 전체 회사 도입 완료 주장을 막는다.
PR·병합·릴리즈·설치·배포 미실행. 이번 소스 버전 후보는 0.92.0으로 준비한다.

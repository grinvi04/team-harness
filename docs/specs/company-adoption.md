# 회사 개발팀 선택형 도입 개선

사용자 승인: 이 대화의 여섯 묶음을 선행 작업의 main·새 버전 발행 뒤 구현한다.
추가 승인된 [실제 원격 기술 검증](acceptance-policy-wire.md)은 회사 고유 인수와 구분한다.
현재 판정은 [도입 판정과 인수 순서](../pilots/company-adoption-2026-10-13.md)를 따른다.
2026-10-13 [현재 코드·검증의 요구 대조](../company-acceptance.md#원래-요구와-현재-harness-판정)를 확인한다.
구현·전달 완료 기록과 당시 실제 인수 FAIL1/UNVERIFIED2를 구분한다. 대표 원격/팀 기술 실행의 후속 PASS_SCOPED는 현재 판정을 따른다.
DriveTree 수정과 실제 사람/회사 고유 정책 실증은 제외한다. 기술 결과를 사람 부재로 통째로 미확인으로 되돌리지 않는다.
아래 구현·재개·전달 승인 단계는 당시 후보의 역사이며 현재 대기/실행 지시가 아니다.
이전 0.91.1 기반·#539 미해결·ddb1dcd 검증은 당시 기록으로 보존한다.
2026-10-12 확인: 선행 대화 완료, PR537 main=f8734af6,
원격 v0.91.1 같은 SHA, 두 manifest·README 0.91.1. 기반 develop=bfc57bf.
선행 전달 후 CI 빈 범위 오류 #539는 미해결이며 이번 범위에 자동 편입하지 않는다.

## 현재 범위와 종료 조건

2026-10-14 사용자는 보편적인 GitHub·PR·CI 개발 환경을 기준으로 완료를 판정하도록 확정했다.
혼자 또는 작은 팀, main 중심 또는 develop 기반 Git Flow, 제품별 검사·기존 자산/보호 보존이 기준이다.
사람 승인은 저장소가 채택한 요건에 따르며 일률적으로 추가하지 않는다.
여섯 묶음의 Harness 구현·준비, 대표 기술 검증과0.93.1 전달은 완료다. 현재 필수 잔여는0개다.
회사 고유 정책 인수·실제 사람 효용·소비 제품 수정은 현재 종료 조건/잔여에서 제외한다.
Claude 실제 hook은 UNVERIFIED·보류이며 자동 재개하지 않는다. 미확인을 PASS나 SKIP으로 바꾸지 않는다.
아래 원래 계약과 과거 결과는 당시 범위로 보존하며, P2의 실제 사람 측정은 현재 필수 조건이 아니다.
현재 근거·후속 조건은 [완료 판정 정본](../company-acceptance.md#보편적인-개발-환경-기준의-현재-완료-판정)을 따른다.

## 목표·권한·중단 조건

기존 회사 정책·제품 검사·사용자 파일을 보존하면서 필요한 자산만 채택한다.
기술 검증, 제품 적용, 원격 정책 집행, 독립 팀 효용을 각각 판정한다.
로컬 구현·검사·문서 작업 승인. 소비 원격 정책·운영·DB/Auth/Storage·배포·결제,
전역 설정/설치·다른 팀 연락은 제외한다. 새 공개 합성 원격 시험은 추가 승인을 따라 별도로 실행한다.
회사·참여자가 없어도 대표 기술 경로를 검증하고, 회사 고유 정책·사람 효용만 향후 실증으로 남긴다. 미실행을 완료로 세지 않는다.

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

## 검증·당시 상태 (로컬 구현)

2026-10-12 로컬 구현 인수는 **PASS_SCOPED**다. 검사 후보는
`ddb1dcdec6447056052d1911181423648ca05288`이며 소스 버전 후보는 0.92.0이다.
검사 이후 변경은 이 절의 결과 기록뿐이다. 제품·팀 인수 완료와 구분한다.

| 범위 | 현재 결과·원본 |
|---|---|
| P0-policy / P0-merge | 정책 보존·명시 solo·현재 head required CI의 정상/거부/경계 시험 PASS |
| P1-lifecycle / P1-options | 임시 실제 Git repo의 수명주기·충돌/복구, hook 보존·선택 doctor 시험 PASS |
| P1-product | 기존 Spring Boot·Vue 독립 checker 연결 시험 PASS; 실제 제품 실행 UNVERIFIED |
| P2-team | 업무·기준선·정책·비용 인수 계약 작성; 실제 독립 작성자/리뷰어 참여 UNVERIFIED |
| 전체 품질 | 현재 quality의 run 명령 74/74 PASS, 후보·추적 바이트·로그 SHA 대조 PASS |
| 독립 검토 | 읽기 전용 기능/정책 검토와 수정 재검토 PASS_SCOPED; actor 메모리 경계 202개 불일치0 |
| 조립 | 후보의 package4/files74, source-only bundle·checksum PASS; installable=false |

로컬 품질은 macOS에서 실행했다. Linux apt bootstrap 대신 기존 rg,
host pipx bootstrap 대신 격리 ruff0.15.15를 사용했다. 원격 CI 성공 주장이 아니다.
독립 검토는 별도 read-only 실행이며 parent가 CLI 시작 출력의 Astra/medium을 관찰했다.
실제 회사 제품·서버 집행·설치/native 실측·독립 팀 인수는 검토로 대체하지 않았다.

최초 실패와 재시도를 `.runtime/company-adoption/`에 보존한다.
독립 검토의 경로 별칭·solo 미지원 필드·doctor malformed 응답/actor 결함을 RED→GREEN으로 수정했다.
첫 전체 실행 중 actor 수정으로 중단한 27개 결과는 `quality-attempt1/`에 있다.
후속 72/74 실행은 PR 인계 fixture와 공용 source pin의 FAIL을 보존한 `quality-attempt2/`다.
이 실행 중 시험 교정이 진행됐으므로 고정 후보의 인수 증거로 재사용하지 않았다.
최종 고정 후보 실행은 73/74였고, 검증용 staged package 출력이 소스 Markdown으로 발견된 실패였다.
생성 출력을 checkout 밖으로 옮겨 같은 후보·동일한 문서 검사 전체 명령만 재실행해 74/74가 됐다.
검사나 단언을 완화하지 않았다. 이전 실패 로그·원문 보고서와 재시도는 `quality/`에 함께 남겼다.
보조 진단의 임시 ROOT 오류와 읽기 전용 검토의 무효 실행도 성공 증거로 세지 않았다.
최종 검토는 `actor-review-result.txt`, `fixture-review-result.txt`와 이전 전체 검토를 연결한다.
후속 source pin 갱신은 이미 검토한 공용 파일3개만이며 원문 바이트는 동일하다.

**남은 실제 인수:** 제품 repo·고정 후보·허용된 비운영 명령/데이터 범위,
원격 정책 집행 관찰 권한, 도구 작성자와 다른 개발자·리뷰어가 필요하다.
[제품·팀 인수 계약](../company-acceptance.md)의 기준을 실제 제품 기록에서 확인한다.
필수 FAIL/UNVERIFIED가 남아 회사 도입 완료는 아니다. 소비 원격·운영 변경과 연락은 실행하지 않았다.
PR·병합·릴리즈 사전검사·태그·설치·배포는 이번 작업에서 미실행이다.
로컬 구현 인수 뒤에는 대상과 권한/참여자 결정을 기다리며 자동 실행을 중지한다.

## 선행 0.91.2 발행 후 재개

2026-10-12 사용자 재개 요청과 원본 대조: 선행 대화 완료, PR542 main/tag
`62417bde0a9637be638d1e25896cc114beef317a`, develop
`32a004e67a159d8e16865c7c9a9eb6f5772d67fb`; 두 manifest·README0.91.2 일치.
#539는 선행 작업에서 수정·검증·병합·발행됐다. 위 0.91.1/#539 미해결은 당시 기록이다.
보존한 로컬 후보187cc6d에 발행된 develop을 병합한다. 기존 도입 기능·0.92.0 후보는 유지한다.
버전 배지·manifest와 생성 변경 이력의 충돌만 조정하고 양쪽 결정·CI·검사를 보존한다.
기존74/74는 ddb1dcd 당시 결과다. 통합 후보
`f6b8500689e87425b7a3b1e142ed10a43e257e6a`의 현재 품질은 **74/74 PASS**,
별도 Astra/medium read-only 통합 검토는 **PASS_SCOPED**다. 추적 bytes와 원문 log SHA를 대조했다.
회사 코드·시험22개는 이전 후보와 동일하고 incoming CI/template/digest/시험은 선행 develop과 동일하다.
package4/files74와 source-only bundle/checksum PASS; bundle은 installable=false다.
새 결과는 `.runtime/company-adoption/resume-quality/`와 `resume-integration.json`,
`resume-review-result.txt`에 기록했다. 준비 Python/PATH 오류는 실제 시험 미실행으로 구분해 보존했다.
현재74개 첫 전체 실행은 재시험 없이 모두 통과했다. macOS bootstrap 대체 범위는 이전과 같다.
이후 변경은 이 문서의 상태 기록뿐이다. 회사 실제 인수·원격 CI·delivery 완료와 구분한다.
실제 제품·원격 집행·독립 팀 3개는 UNVERIFIED이며 기존 제외 권한은 유지한다.

## 0.92.0 전달 승인 당시 기록

2026-10-12 사용자가 PR 생성, develop·main 병합, 태그 발행·설치를 승인했다.
기존 검증·보호는 유지하고 실제 회사 인수3개는 별도 UNVERIFIED로 남긴다.
태그 전 릴리즈 후보 검증 기록: [PR544](https://github.com/grinvi04/team-harness/pull/544)는
독립 검토·required5 통과 후 develop `492842f1103678ddb89890ee083c734e925ee9ce`에 병합됐다.
검토 head82f2840과 병합 tree는 동일하며 main/develop 전체 보호 API 원문이 원값과 일치했다.
main 사람 승인1·strict required5·admins는 유지한다.
최초 전달 승인에는 solo 선택이 없어 회사 기본 경로로 main 승인1에서 대기했다.
후속 사용자의 solo-merge 선택으로 **이 개인 저장소만** 명시 solo를 선언한다.
원격 개인 소유·협업자1명을 확인한 뒤 main PR의 승인요건만 일시 해제·복구한다.
strict required5·독립 리뷰·스레드·현재 후보 결박과 전체 보호 원값 복구 검증은 유지한다.
전달 결과는 연결 PR·[v0.92.0](https://github.com/grinvi04/team-harness/releases/tag/v0.92.0)의
현재 원본으로 확인한다. 이 절의 main 병합·태그·설치 전 검증 기록은 아래 발행 결과로 연결한다.
릴리즈 필수 live provenance·보안·bundle/checksum·현재 main PR CI는 후보별로 대조한다.
실제 DB·런타임 서버가 없어 DB·배포 health만 SKIP하며 회사 인수3개는 계속 UNVERIFIED다.

## 0.92.0 발행·설치 결과

[PR545](https://github.com/grinvi04/team-harness/pull/545)의 reviewed head2ec8889·required5/5·별도 read-only 보안 검토를 확인했다.
main 병합과 원격 v0.92.0은 `16150b474e353ab8132cf24b72ec51d26eb4e837`이다.
solo wrapper는 main 승인요건만 일시 해제했고 main·develop 전체 보호 API 원값 일치를 확인했다.
공식 Release3개 asset의 다운로드 bytes·checksum과 해당 SHA의 bundle을 대조했다.
Codex·Claude 공식 CLI로0.92.0을 설치·활성화하고 양쪽 설치76개 파일을 발행 원본과 대조했다.
새 app-server의 native skill17개·loading error0을 확인했다. 타 plugin·모델·권한·전역 지침은 불변이다.
기존 열린 대화는 이전 catalog를 유지할 수 있으며 Claude 실제 모델·인증 갱신은 실행하지 않았다.
develop 포함은 연결된 역병합 PR의 MERGED와 Git ancestry로 판정한다. 실제 회사 인수3개는 UNVERIFIED다.

로컬 검증을 마친 기술 후속은 [정책 API 호환 수정](company-policy-api-compatibility.md)이다. 실제 회사 인수와 별도로 판정한다.

## 후속 0.92.1 호환 수정·전달

[정책 API 수정과 전달 결과](company-policy-api-compatibility.md)는 실제 판독 실패 복구·발행·설치를 기록한다.
기존0.92.0 실제 제품 시험·미해결 인수 기준은 유지한다. 회사 인수 FAIL1/UNVERIFIED2는 별도다.

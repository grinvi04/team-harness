# 다음 개선: 업무 효과·재개·로컬 검사·문맥 비용

상태: 2026-10-14 실행 중. 로컬 조합 제거·기존 규약의 미발행1.0.0 후보를 승인했다.
기존 작업공간·초기12회 기록을 재사용한다. 단계별 판정과 최신 사용자 변경은 아래 기준을 따른다.
기준선: develop `11b2b714f18e42cfad61b1288fe57664fcf967f0`, 소스0.93.2.
기존 보편 개발 환경 개선·가이드·발행·설치 완료를 다시 미완료로 바꾸지 않는다.
현재 방향은 [제품 방향](../product-direction.md), 기존 인수 경계는 [회사 인수](../company-acceptance.md)다.

## 목표·범위·권한

혼자·작은 팀의 개발 업무에서 원래 목표·검사 기준을 유지하고 반복 설정·탐색·재작업을 줄인다.
확장 네 방향은 업무 결과 평가, 긴 작업의 인계·재개, 필요한 문맥 제공, 실패 회귀화다.
검사 연결과 증거·완료 계약은 **소유**, 플랫폼 실행·skill 로딩은 **위임**한다.
새 agent runtime·상태 서버·회사 정책 엔진·전역 설정·소비 저장소 수정은 추가하지 않는다.
현재 승인은 로컬 구현·격리 시험·관련 문서·커밋이다. 원격 전달·발행·설치는 이번에 실행하지 않는다.
운영·기존 DB/Auth/Storage·원본 .env·원격 보호는 변경하지 않는다.
Claude 실제 hook은 미확인 보류, 사람·회사 고유 인수는 현재 목표 밖으로 유지한다.

## 완료 계약과 중단 조건

각 단계는 요구·후보/파일 digest·명령·cwd·exit·원문으로 PASS/FAIL/UNVERIFIED/SKIP을 구분한다.
판정자는 구현의 결과나 답변의 PASS 문구가 아니라 외부 기대값·파일·실제 명령을 대조한다.
필수 실패·미확인은 완료를 막는다. 기존 과거 실패와 최초 시도는 보존한다.
접근/인증/도구 실패를 모델 전환·보호 완화·같은 재시도로 해결하지 않는다.
같은 실패의 재시도에는 새 원인·변경·환경 근거가 필요하다. 필요한 추가만 실행하고 상한을 기록한다.
효과 없는 새 규칙·연결 계층은 채택하지 않는다. 표본 결과를 일반화하거나 사람 효용으로 확대하지 않는다.
전체 로컬 품질·패키지·문서와 독립 최종 검토까지 확인한 뒤 로컬 후보 완료를 판정한다.
전달을 추가 승인받으면 feature→develop 확인→release 검증→main→태그→develop 역병합→설치 순서다.

## 작업 순서·의존성

| 단계 | 작업과 산출물 | 검사·기대 결과 | 상태 |
|---|---|---|---|
| M0 | 기존 판정자 확장, 6개 업무와 비교 조건 고정 | 판정 원문·정상/결함·조건 한계 보존 | 초기12회·독립 검토 완료, 비교 동등성 미확인 |
| M1 | 목표·재개 계약 대조, 재현된 원인만 보완 | 낡은 증거·허위 완료·범위 밖 수정 거부 | 로그 경계 후속2회 숨김 검사·허용 경로 통과, 독립 검토 대기 |
| M2 | 스택 카탈로그 기반 로컬 검사 확장 | preview 무변경·apply 파일1개·실제 검사·실패 중단 | 계약20PASS, 실제 앱 검증 중 |
| M3 | 실제 읽기·비용 대조, 필요한 문맥만 정리 | 필수 경계 보존; 이득 없는 새 계층 미채택 | 관측 분석 완료, 새 계층 미채택 |
| M4 | 실패 회귀·보존·미사용 과제·전체 후보 검토 | 정상 보존·효과/한계·문서 일치 | 미사용4회 완료, 전체 품질·독립 검토 대기 |

회귀는 각 단계에서 즉시 추가한다. M4는 이를 처음 만드는 단계가 아니라 종합·최종 검수다.
기존 [QA 실제 평가](qa-practical-validation.md), [명령 연결 평가](qa-command-binding-validation.md),
[프론트 계약 평가](frontend-contract-integration.md)의 정상·실패 판정 방법을 재사용한다.

## M0·M1: 선정 과제·비교 계약

| 과제 | 실제 관찰과 기대 결과 |
|---|---|
| 설계 | 기존 API/호출부·상태 소유를 확인한 변경 계획; 분석 요청에 구현0 |
| 진단 | 격리 소스의 실패 원인·직접 소비자 제시; 진단 요청에 수정0 |
| 구현 | 독립 숨김 검사의 정상/실패·호환 결과를 통과; 기존 검사 약화0 |
| 검증 | 다른 디렉터리/명령 성공을 대상 성공으로 세지 않음; 실행 원문 대조 |
| 리뷰 | 격리 소스의 호출부 계약 결함 발견; 리뷰 요청에 수정0 |
| 인계·재개 | 새 문맥·변경 후보·범위 밖 결함·진행 writer를 구분; 현재 기준과 다음 행동 정확 |

대조군은 native+프로젝트 검사, 후보는 동일 조건+현재 Harness 프로젝트 계약이다.
같은 CLI·모델·effort·요청·시작 코드·검사 기준, 별도 문맥·비밀없는 격리 디렉터리를 사용한다.
전역/부모 지침과 설치 plugin의 유입을 실제 조회·읽기 원문으로 확인하고 차이를 기록한다.
의미·진단 평가는 독립 원문 검토, 동작은 실제 숨김 검사·파일 불변·명령으로 판정한다.
최초6과제×2조건=12실행. 수정 후 영향 비교와 미사용 과제는 별도로 계수하며 총24실행 상한이다.
필수 독립 최종 리뷰는 비교 배우 실행과 별개다. 수정 없는 재실행으로 성공 표본을 고르지 않는다.
CLI 시간·호출·사용 토큰은 관찰값만 기록한다. 사람 리뷰 시간·구독 차감·생산성 수치로 환산하지 않는다.
양쪽 모두 통과하면 계약 적용은 확인해도 추가 품질 향상을 주장하지 않는다.
현재 한계인 장기 작업 전체 신뢰도·다른 모델·실제 팀 효용은 이 표본으로 통과 처리하지 않는다.

## M2: 로컬 생성기 계약

정본은 `templates/stacks.json`, `scripts/stack-catalog.mjs`와 스택별 원문이다.
`setup-local.mjs`는 앱 생성이 아니라 준비된 제품에 `scripts/check-harness.sh` 하나를 추가한다.
Spring Boot/Gradle·Vue/npm의 단독 검사, spring 별칭과 각 명령 순서는 보존한다.
로컬 조합·기본 Spring Boot+Vue 선택·backend/frontend 옵션은 제거한다. --stack을 명시해야 한다.
API+프런트는 각 앱을 --project로 지정해 단독 생성한다. 기존 생성 파일은 지우거나 바꾸지 않는다.
GitHub CI·new-repo의 기존 조합은 유지한다. 첫 확장은 Node·React/Vite·Next.js·Nuxt npm 단독이다.
Python·Rails와 Maven/pnpm 등의 실행 프로필은 현 범위 밖이며 지원 상태를 명시한다.
기술스택·역할/경로·실행 방식·필수 검사를 구분하고 새 중복 카탈로그/범용 plugin 엔진을 만들지 않는다.
지원 조회·준비 조건·명령 미리보기가 같은 스택 선언과 직접 연결되도록 한다.
React/Nuxt는 기존 CI에 맞는 lint·type-check·test:unit·build가 필수다.
Node는 lint·test·build, Next.js는 lint·build가 필수다. 선언된 선택 검사도 실행·실패 중단한다.
Node/Next의 type-check·lint:design 및 Next의 test는 기존 선택형 계약을 유지한다.
미선언 선택 검사는 NOT SELECTED로 안내하며 필수 검사를 선택형으로 내려 생성하지 않는다.
E2E는 신규 프로필에서 명시 선택이며 선택하면 Playwright 의존성·test:e2e가 필수다.
기존 Vue E2E는 계속 필수다. 제품에서 채택한 필수 검사는 선택형 표기를 이유로 생략하지 않는다.
임의 package.json·lockfile·기존 검사·AGENTS·CI를 생성/변경하거나 항상 성공하는 명령을 채우지 않는다.
미지원 실행 방식/누락 필수 명령·불명확한 lock·위험 경로·기존 목적 파일은 쓰기 전에 거부한다.
preview는 네트워크·쓰기·실행0, apply는 파일1개, 실행 실패 후 후속 명령/PASS0이다.
실행 파일은 source checkout 없이 동작한다. 실제 npm 실행에는 제품 명령·설치 script의 영향이 있음을 안내한다.
명령 대역 회귀와 별도로 폐기 가능한 앱의 실제 lint/type/unit/build 실행·원본 보존을 확인한다.

## M3·M4: 문맥·회귀·영향 파일

실제 읽기 원문에서 무관한 탐색·중복 설명을 찾아 기존 필수 읽기 경로만 정리한다.
권한·품질·완료 핵심은 필수 진입점에 유지하며 압축 요약을 현재 원본으로 대체하지 않는다.
원문 접근·최신성·관련 파일 선택 문제를 구분하고 이득 없는 새 resolver/cache는 만들지 않는다.
과거 실패는 당시 후보로 보존하고 현재 재현→최소 수정→회귀→정상 보존을 연결한다.
기계 판정자의 자체 시험은 오답/빈 검사/허위 완료를 거부하고 정상 결과를 허용해야 한다.
주 영향: `scripts/setup-local.mjs`, `scripts/stack-catalog.mjs`, `templates/stacks.json`,
`templates/stacks/*/local-check.sh`, `templates/local/check-harness.sh`, `tests/local-setup-test.mjs`.
평가 산출물/판정자는 기존 `tests/fixtures/qa-practical/` 방식과 `.runtime/` 원문 경계를 재사용한다.
문서: 이 스펙, `docs/local-development.md`, `docs/repository-structure.md`, `docs/product-direction.md`.
변경 근거가 있을 때만 공통 프로젝트/재개 계약과 직접 소비 안내를 수정한다.
CI는 기존 quality 전체와 새 검사 연결; 생성 CI 사본은 정본 변경이 있을 때 생성·drift를 함께 확인한다.
동작 변경의 두 manifest·README 배지는 다음 미발행 후보 버전으로 함께 갱신한다.
스펙/테스트 잠금·RED/GREEN·현재 후보 전체 품질·독립 검토·문서 상태를 작업 원문에 연결한다.
이 스펙의 완료는 로컬 후보 기준이며 병합·발행·설치는 별도 승인/결과다.

## 초기 기록의 재사용 한계

초기12회는 현재 공통 계약 bytes와 실행 원문이 남아 있다. 구현 숨김 검사 양쪽 PASS는 사실이다.
독립 검토는9PASS/1FAIL/2UNVERIFIED다. 구현1회는 허용 범위 밖 임시 로그를 만들어 FAIL이다.
전체 설정 hash가 도중 변경되어 조건 동등성은 미확인이다. 모델/effort는 호출에 고정했지만 실제
초기 실행 헤더는 없어 적용값을 추측하지 않는다. 숨김 검사는 구현 동작만 검사하며 빈 테스트 판정자가 아니다.
writer 상태 조회는 actor sandbox의 EPERM으로 미확인이며 범위 보존·fail-closed와 구분한다.
새 미사용 과제는 실행별 시작/종료 설정 hash와 입력 digest를 보존하고 최대24회 상한을 유지한다.

## 현재 검증과 전달 경계

후속 실행은 폐기 CODEX_HOME의 동일 최소 설정·공통 지침·실제 실행 헤더를 수집한다.
인증 값은 기록하지 않고 임시 사본을 정리한다. 전역 설정 불변과 프로세스 설정 hash 변화는 구분한다.
새 업무2개×2조건=4회는 최신 요청·일부 필수 검사 실패 보존을 확인하며 독립 의미 검토는 대기다.
로그 경계 후속2회는 같은 구현 요청으로 양쪽 숨김 검사가 통과했다. 허용 파일2개만 바뀌었다.
배우18/24회이며 필수 리뷰는 별도 계수한다. 구현 후속2회 config 변경은 격리 경로의 trust 항목이다.
미사용4회는 설정 원문이 없어 hash 변화의 내용은 미확인이다. 전역 불변·실제 헤더와 별개로 남긴다.
문맥 비용의 초기 관측은 기준선355.38초/996,035입력 토큰, Harness406.94초/1,131,020입력 토큰이다.
명령 출력 bytes를 실제 읽기 bytes로 부르지 않는다. 인과 효과·비용 절감·생산성 향상은 입증하지 못했다.
따라서 새 resolver/cache/요약 계층을 추가하지 않는다. 권한·품질·재개 진입점은 유지한다.
M2 최초 RED의6실패·조합 허용 반례, macOS 시스템 링크의 첫 GREEN 실패를 보존한다.
잠긴 테스트는 바꾸지 않고 TMPDIR 실경로로 환경을 정정해20PASS를 확인했다.
원문은 로컬 `.runtime/workflow-maturity-20261014/`, 현재 후속 판정은 이 스펙에 연결한다.
전체 quality 최초74단계는72PASS/2FAIL이었다. 두 실패는 승인된 공통 계약2줄의 기존 checksum 한 행이 원인이었다.
현재 계약 digest만 갱신해 source-native loader·Claude 격리 두 명령은 재실행 PASS다. 원래 실패 원문을 보존한다.
검사 코드·거부 기준·Claude 동작을 완화하지 않았다. 커밋 source package/bundle과 독립 소스·후속6회 검토는 완료했다.
독립 후속6회는 모두 요청 적합성 PASS이며 실제 시험 제품의 준비 완료와 구분한다. 종합 완료는 잔여 품질·문서 대조 뒤 판정한다.
로컬 후보 완료·원격 전달·태그·설치는 서로 별개이며 이번에 원격 전달을 시작하지 않는다.

```harness-doc-sync
{"version":1,"documents":[
 {"path":"docs/specs/workflow-maturity.md","reason":"승인 범위·현재 후보·최초 실패·검증 한계와 전달 상태"},
 {"path":"docs/local-development.md","reason":"단독 선택·새 프로필·기존 호출 이전·검사 한계"},
 {"path":"docs/repository-structure.md","reason":"localProfile 정본과 GitHub 조합 경계"},
 {"path":"docs/product-direction.md","reason":"과거 완료 보존과 현재 로컬 전환"},
 {"path":"docs/company-acceptance.md","reason":"현재 지원을 연결하되 실제 인수와 구분"},
 {"path":"docs/onboarding.md","reason":"로컬 진입점과 별도 앱 선택"},
 {"path":"docs/quick-start.md","reason":"영문 로컬 선택 안내"},
 {"path":"docs/development-coordination.md","reason":"지원 앱의 검사 진입점"},
 {"path":"docs/decisions.md","reason":"조합 제거·카탈로그 연결·버전 승인"},
 {"path":"README.md","reason":"현재 지원과 미발행 버전 표시"},
 {"path":"docs/harness-maintenance.md","reason":"MAJOR 후보와 이전·전달 경계"},
 {"path":"docs/specs/local-spring-vue-setup.md","reason":"이전 로컬 조합 결과 보존과 대체 계약 연결"},
 {"path":"docs/specs/structure-cleanup.md","reason":"과거 무옵션 보존 계약의 대체 경로"},
 {"path":"docs/specs/stack-profiles-version-contract.md","reason":"과거 로컬 프로필 범위와 후속 변경 구분"},
 {"path":"docs/pilots/workflow-maturity-2026-10-14.md","reason":"실제 업무·앱·비용 결과와 판정 한계"},
 {"path":"CHANGELOG.md","reason":"미발행1.0.0 구현 커밋 이력"},
 {"path":"docs/changelog/releases.md","reason":"생성한 이력 index"},
 {"path":"docs/changelog/2026/v1.0.0.md","reason":"후보 생성 이력이며 태그 발행과 구분"}
],"items":[]}
```

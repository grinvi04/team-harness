# 업무 성숙도 개선의 실행 결과

대상은 [승인 스펙](../specs/workflow-maturity.md)의 Team Harness 자체 개선이다.
기준선은0.93.2/develop `11b2b714`, 구현은 `codex/workflow-maturity`의 미발행1.0.0 후보다.
실제 제품·운영·회사 인수·사람 효용·Claude 실호스트 검증은 이번 결과에 포함하지 않는다.
원문은 로컬 `.runtime/workflow-maturity-20261014/`, 정제 기록은 [실행 데이터](workflow-maturity-2026-10-14.json)다.

## 업무 결과와 판정 경계

배우는 Codex CLI0.161.0의 Sol6.1/high다. 초기6업무×2조건, 미사용2업무×2조건,
로그 경계 보완 후 구현1업무×2조건으로18회 실행했다. 별도 독립 검토는 Astra/medium·read-only다.
native 대조군은 같은 프로젝트 요구·검사, 후보는 여기에 실제 Harness 공통·QA 계약을 명시 연결했다.
이 시험은 자동 skill 발견·긴 문맥 압축·실제 동료 이해도·모든 모델의 준수를 평가하지 않는다.

| 초기 업무 | 실제 관찰 | 판정 |
|---|---|---|
| 설계 | API 금액·계산 호출부 보존 계획, 수정0 | 양쪽 PASS |
| 진단 | 공개 호출로 중복 승인 재현, 원인·범위 제시, 수정0 | 양쪽 PASS |
| 구현 | isActive의 시작/만료·철회·입력 검증과 identifier 호환 숨김 검사 통과 | 기능 양쪽 PASS; 후보 외부 로그 작성 FAIL |
| 검증 | API 필수 verify exit1, 다른 경로 성공으로 대체하지 않음 | 양쪽 PASS |
| 리뷰 | repository→service의 pagination 토큰 유실 재현 | 양쪽 PASS |
| 재개 | 현재 실패·낡은 PASS 거부·source/consumer 보존; writer 조회 EPERM | 안전 보존 PASS; 프로세스 확인 UNVERIFIED |

초기 독립 판정은9PASS/1FAIL/2UNVERIFIED다. 배우의 exit0·PASS 문구만으로 성공을 세지 않았다.
초기 공통 계약의 읽기와 계약5개의 digest 동등성은 확인됐다. 스펙 커밋에 따른 HEAD 차이는 계약 변경이 아니다.
전역 config hash가 도중 달라져 전체 비교 조건 동등성은 UNVERIFIED다. 원인·영향을 추측하지 않는다.
초기는 실제 실행 헤더를 수집하지 않아 모델/effort의 요청값과 적용 확인을 구분한다.

후속6회는 실행별 폐기 CODEX_HOME·동일 최소 설정·공통 지침을 사용하고 실제 헤더를 수집했다.
인증 값은 기록하지 않고 임시 사본을 삭제했다. 전역 설정 불변은 확인됐다.
구현 후속에서는 시작/종료 설정 원문도 보존했고 차이는 각 fixture 경로의 자동 trust 항목이었다.
이 추가 표본을 초기 조건 드리프트의 소급 해소나 통계적 품질 향상으로 취급하지 않는다.

미사용 과제는 최신 요청 변경·담당자 완료 기록·기존 PASS를 대조하는 진단/재개와,
syntax PASS·invariant FAIL을 분리하는 필수 검사 판정이다.4회 모두 수정0이며 실제 실패를 보존했다.
로그 경계는 공통 계약에 직접 만드는 로그·임시 파일도 쓰기 범위에 포함하는2줄만 보완했다.
같은 구현 요청의 후속 양쪽은 숨김 검사를 통과하고 허용 파일2개만 변경했다. 독립 후속6회 모두 요청 적합성 PASS다.
원문 검토에서 허용 밖 직접 로그 작성은 발견하지 못했으며 외부 파일시스템 전체 불변 보장은 아니다.

## 판정자와 문맥 비용

기존 QA 판정자의 정상 허용·빈/약한 검사·기준선 약화·허위 완료 거부는 기존 self-test를 재사용한다.
이번 isActive 숨김 검사 자체 시험은 정상 허용, 만료 포함·철회 무시·입력 검증 누락·identifier 파괴를 거부했다.
isActive 부재의 TypeError로 거부한 사례를 “빈 테스트 검출”로 일반화하지 않는다.
의미 검토는 실제 요구·명령·최종 파일을 읽으며 기계 판정자는 전체 의미 보장이 아니다.

| 초기 관측 합계 | native 대조군 | Harness 계약 연결 |
|---|---:|---:|
| 실행시간 합계 |355.38초|406.94초|
| 완료 명령 |52|64|
| 입력 토큰 |996,035|1,131,020|
| 출력 토큰 |11,021|11,466|
| 명령 출력 |169,248bytes|233,078bytes|

명령 출력에는 검사 출력·검색·반복 출력이 섞이며 실제 읽기 bytes가 아니다. 캐시·자동 주입 문맥과
조건 드리프트의 영향을 분리하지 못했다. 비용 절감·생산성·사람 리뷰 시간·구독 차감을 주장하지 않는다.
효과가 입증되지 않은 resolver/cache/요약 계층은 채택하지 않았다. 핵심 읽기·권한·검증 계약은 보존했다.

## 로컬 생성기와 실제 앱

계약 회귀20개는 단독 선택·미리보기 무변경·생성 파일1개·각 명령 실패 후 후속/PASS0을 확인한다.
Spring/Vue 단독 원문·spring 별칭·Vue 필수 E2E와 GitHub CI 조합은 보존한다.
신규 npm4프로필은 준비된 스택·runner·lock·필수 scripts를 읽으며 선택 검사를 표시한다.

| 폐기 앱 | 실제 framework/도구 | 결과 |
|---|---|---|
| Node | Node22.18.0/npm11.6.2, ESLint9.36.0, TypeScript5.9.2, node:test | checker PASS·lint/type/unit 결함 거부 |
| React/Vite | React19.3.0, Vite8.3.4, plugin-react6.0.1 | checker PASS·실제 SPA build·결함 거부 |
| Next.js | Next16.4.0, React19.3.0, webpack build | checker PASS·정적 route build·선언된 선택 검사·결함 거부 |
| Nuxt | Nuxt4.1.2, vue-tsc3.3.13, Nitro build | 준비 교정 후 checker PASS·결함 거부 |

제품 AGENTS·source·test·package/lock의 적용 전후 digest를 대조했다. 검사 실행은 node_modules와
framework 출력을 생성하며 이를 제품 원본 수정과 구분했다. 원격·서비스·DB·운영 데이터를 사용하지 않았다.
새 E2E 선택의 실행 순서·실패 중단은 대역 회귀다. 위 앱의 실제 브라우저/E2E 통과를 주장하지 않는다.
타입 검사 표본은 공유 금액 module과 Nuxt Vue app이며 프런트 전체 타입·사용성 보장이 아니다.

최초 RED6실패·기존 조합 허용 반례를 보존했다. macOS `/var` 링크에 따른 첫 GREEN8실패는
잠긴 단언을 바꾸지 않고 TMPDIR 실경로로 정정해20PASS다. 별칭 경로 거부는 사용 안내에 남겼다.
Nuxt 최초 npm ci는 lock 불일치로 중단했다. 시험 앱의 표준 npm install로 lock 준비 후 동일 checker를 실행했다.
Nuxt 기본 타입 설정은 JS 결함을 놓쳤다. 시험 앱에 checkJs와 실제 포함 대상을 선언한 뒤 오류를 거부했다.
이는 제품 검사 충실도 문제다. 생성기의 필수 검사를 내리거나 항상 성공하는 명령으로 바꾸지 않았다.

## 현재 종합 상태

독립 소스·평가 검토는 새 차단 결함을 발견하지 못했다. 설정 주장 범위·진행 문구2건을 정정했다.
quality 최초74단계는72PASS/2FAIL이다. 두 실패는 공통 계약2줄의 이전 checksum 한 행 때문이다.
승인된 공용 계약 hash만 갱신해 해당2명령을 재실행 PASS; 검사·거부 기준과 최초 실패는 보존했다.
source fingerprint803개 중802개 불변을 대조했다. 최종74단계 PASS는 로컬 재현이며 hosted CI가 아니다.
b49f288 최초 source package/bundle checksum·provenance는 PASS다. 최종 기록 커밋의 재조립 판정은
로컬 원문의 `final/verification.json`·`final/bundle/RELEASE-MANIFEST.json`에서 대상 SHA와 대조한다.
최종 독립 문서 검토는 전체M0–M4 NOT VERIFIED다. 비교 조건 동등성·실제 writer 상태가 필수 미확인이다.
로컬 생성기·74단계 검사 통과와 전체 목표를 구분한다. 초기 기록을 무효화하거나 효과 향상을 주장하지 않는다.
현재18/24회 상한으로 완전 비교12회 재시험은 부족하다. 총30회 확대 선택을 요청했으며 응답 전 실행하지 않는다.
미발행1.0.0의 두 manifest·README 배지는 일치하며 실제 설치 버전은 이 후보와 별개다.
원격 PR·develop/main 병합·release-check·태그·설치는 이번 요청에서 실행하지 않는다.

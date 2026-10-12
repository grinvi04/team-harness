# 실제 제품과 독립 팀의 인수

이 문서는 회사 도입을 판정할 관찰 계약이다. 수행 결과나 연락 승인이 아니다.
로컬 구현 인수 후 제품 담당자가 대상·참여자·허용 환경을 정한다.
현재 결과는 [도입 판정과 인수 순서](pilots/company-adoption-2026-10-13.md)를 따른다.
DriveTree 실제 제품 인수는 필수 UI 실패로 **FAIL**, 회사 원격 집행·독립 팀은 **UNVERIFIED**다.
DriveTree 수정은 이번 범위에서 제외하며 아래 인수 기준은 유지한다.

## 원래 요구와 현재 Harness 판정

목표는 회사 개발팀의 실제 제품 업무에 필요한 Harness 자체를 개선하는 것이다.
기술 구현·검증, 실제 제품 적용, 회사 서버 집행, 독립 사용자 효용을 나눠 판정한다.
소비 저장소·회사·참여자 지정은 아래 실제 인수의 조건이며 Harness 수정의 선행 조건이 아니다.
기준은 [승인된 여섯 묶음](specs/company-adoption.md#승인된-여섯-묶음과-검사-계약)이다.

2026-10-13 원격 develop `4d62011de13cebadc43eef70abe1e62605fa2e1b`와
main/v0.92.1 `4e0d66b9fa34d273bb1ee7383846601d3fa2fd99`를 대조했다.
관련 코드·호출부·시험은 검증 후보 `3b5ad05931a308d3131fdec211fca2e6a2ac7662`와
품질 후보 `1fc5f40d7bfd13952b704d1b80e12341c01cf40c`의 입력과 동일하다.
후속 원문 로그의 SHA-256을 확인하여 아래 검사를 재사용했다. 이번에 다시 실행한 결과가 아니다.

| 원래 묶음 | 현재 구현·유지 경로 | 현재 증거·판정 |
|---|---|---|
| P0-policy | `branch-protection-policy.mjs`·`set-branch-protection.sh`·`repo-policy.mjs`: 기존 승인/CODEOWNERS/제한 보존, 선택 preview, 회사 solo 차단 | 보존32·회귀18 PASS, 개인 실제 GET/check PASS_SCOPED; 회사 집행 별도 |
| P0-merge | `pr-merge.sh`·`verify-required-checks.mjs`: 수동/자동의 nonempty required·최신 head/app 성공과 drift 차단 | wrapper65·회사 경계 포함 합동58 PASS_SCOPED; 실제 회사 거부/승인 별도 |
| P1-lifecycle | `manage-repo-assets.mjs`: 선택 적용/갱신/제거·출처/소유 hash·충돌 거부·포착한 실패 복구 | 합동58의 자산 수명주기 정상/거부/복구 PASS_SCOPED |
| P1-options | plan 선택·회사 AGENTS·`harness-doctor.sh`: 기존 규약 유지, tech-only, 설치 버전·구성/실행 분리 | doctor 원문 PASS_SCOPED; 미실행 fresh-session은 UNVERIFIED |
| P1-product | `setup-local.mjs`·`check-harness.sh`: 기존 stack 판독 재사용, Spring/Vue 검사 연결·중간 실패 후속0 | checker14·stack 판독 원문 PASS_SCOPED; 제품 lock/build/통합 별도 |
| P2-team | 이 계약·온보딩·자산 안내: 독립 역할·업무·비용·인계 관찰 기준 | 준비 자료 확인; 실제 독립 수행·비용은 UNVERIFIED이며 P2 전체 PASS가 아님 |

원문 식별자는 `company-policy-api-20261013/quality-04.log`, `quality-10.log`,
`quality-31.log`, `quality-34.log`, `quality-75.log`, `preservation-after.log`, `green.log`다.
`quality.json`·`targeted.json`의 명령·cwd·후보·exit와 로그 hash를 함께 대조한다.
원래 `company-adoption/` 원문 위치는 현재 기본 checkout에 없어 그 원문 전체를 재확인하지 못했다.
재사용 판단은 위에 실제 존재하는 후속 원문과 현재 Git 입력의 일치에 근거한다.

유지할 것은 기존 품질·보안·검토·보호 gate다. 개인 규약 강제·기존 정책 덮어쓰기·회사 solo는
선택형 경로에서 분리하거나 거부한다. 새 runtime·추가 stack·범용 회사 정책 엔진은 추가하지 않는다.
이번 대조에서 원래 범위 안의 새 코드 결함은 입증되지 않았다. 진행 기록의 잘못된 대기 연결을
정정하며, 실제 인수 FAIL1/UNVERIFIED2를 코드 미완료나 기술 PASS로 바꾸지 않는다.

## 제품 검사를 연결할 때

선행 0.91.1의 stack 판독·버전 미리보기·충돌 경계를 재사용한다.
[로컬 개발 안내](local-development.md)의 독립 checker는 현재 Spring Boot·Vue만 지원한다.
다른 스택은 제품의 기존 명령을 직접 연결하며 지원되지 않은 생성기를 성공으로 표시하지 않는다.
자산 적용은 앱 의존성을 자동 갱신하지 않는다. 실제 lockfile·빌드·통합은 제품의 후보에서 확인한다.

제품 기록에 아래 항목을 함께 남긴다.

| 항목 | 필요한 원본과 관찰 |
|---|---|
| 대상 | 제품 repo, 후보 SHA, 채택 자산 source SHA·버전·plan |
| 환경 | 담당자 승인된 비운영 환경, 명령과 데이터 범위 |
| 기존 기준선 | native 도구+CI로 수행한 같은 업무의 시간·재검토·검사 결과 |
| 제품 실행 | 실제 lint/test/build/통합 명령·exit·로그·검사 대상 |
| 차단 | 필수 검사 실패 시 후속 실행·병합0, 사용자 파일·lockfile 보존 |
| 원격 집행 | required 앱·head·동료 승인·CODEOWNERS와 실제 거부 관찰 |
| 결과 | PASS/FAIL/UNVERIFIED/SKIP, 실행자·날짜·한계 |

운영·DB/Auth/Storage·원격 보호 변경이 필요한 검증은 해당 권한 승인 후 수행한다.
fixture 성공, 파일 복사, 로컬 doctor PASS를 이 표의 실제 결과로 채우지 않는다.

## 독립 팀의 업무 인수

향후 실제 인수를 실행할 때 [독립 사용자 양식](pilots/independent-user-0921.md)에
대상·역할·실제 업무와 관찰표를 고정한다. 이 선택은 현재 Harness 수정의 선행 조건이 아니다.
자료 준비와 참여자 존재 확인은 실제 수행·비용 인수의 통과가 아니다.

도구 작성자가 아닌 개발자와 리뷰어가 시니어 개발 업무 전반에서 대표적인 실제 사례를 수행한다.
요구·설계·변경·진단·검증·리뷰·릴리즈·유지·인계를 대상으로 하며 단순 기능 개발로 한정하지 않는다.
사례별 기존 native+CI 기준선과 요구·시작 후보·수용 기준이 같아야 한다.
작성자 설명 없이 온보딩 안내만으로 적용·충돌 해결·검사·인계·제거를 시도한다.
작성자는 실제 PR을 제출하고 리뷰어는 요구·후보·검사 증거를 독립 대조한다.
참여자에게 연락하거나 제품을 수정하는 실행은 담당자의 별도 승인 범위에서 한다.

| 관찰 | 인수 기준 |
|---|---|
| 정책 | 승인·CODEOWNERS·required CI 약화0, 회사 경로 solo 예외0 |
| 필수 검사 | 누락·실패·미확인을 완료로 처리0 |
| 기존 자산 | 무단 덮어쓰기0, 충돌의 원인·해결 행동 이해 가능 |
| 인계 | 다음 개발자가 원본·후보·남은 위험·다음 행동을 찾을 수 있음 |
| 비용 | 설정·업무·재검토·업데이트·제거에 든 시간을 각 기록 |
| 효용 | 기준선 대비 절약 또는 추가 비용의 이유를 실제 관찰로 설명 |

시간을 줄이지 못해도 안전성·인계의 이득이 확인되면 팀이 그 비용을 선택할 수 있다.
그러나 이익을 수치 없이 추정하거나 내부 작성자 시험을 독립 팀 참여로 대체하지 않는다.
필수 기준에 FAIL/UNVERIFIED가 남으면 회사 인수 완료가 아니다.
충족하면 그 업무·환경의 도입 결과만 보고하고 새 기능 백로그를 임의로 추가하지 않는다.

[정책 API 호환 수정](specs/company-policy-api-compatibility.md)은0.92.1로 발행·설치했다. 실제 회사 인수는 별도로 판정한다.

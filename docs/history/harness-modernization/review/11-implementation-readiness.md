# 착수 준비 — 추가 전면 감사와 구현 후 검증의 구분

2026-10-09 KST. 기존 보고서·계획과 현재 직접 소비 계약을 대조했다.
원본 수정은 시작하지 않았다. 이번 보완은 임시 계획·검토 자료에만 저장했다.

## 판단

추가 전면 감사를 반복하기보다 안전성 수정부터 단계별로 진행하는 것이 적절하다.
1단계의 수정 대상·원래 반례·정상 대조군·완료 판정자는 구체화됐다. 착수는 수정 승인과 기준 원본 확인을 전제로 한다.
실제 전역 적용 전에는 아래 복구/호환 시험이 필요하다. 쓰기 차단이 확인되지 않은 검토로 고위험 완료를 판정하지 않는다.
계획 보완이 구현·실제 적용·필수 QA 완료를 뜻하지 않는다.

## 이번에 구체화한 공백

| 경계 | 기존 계획의 한계 | 보완과 판정 |
|---|---|---|
| 전역 부분 적용/복구 | 백업·복구 경계만 선언, 중간 실패·동시 변경 처리 미지정 | [3F](../plan/03-model-global.md#3f--적용-단위부분-실패복구): 대상/후보 digest·중단/복구·이후 사용자 변경 보존; AC-M5 |
| 혼합 버전·세션 | source/최종 설치의 확인은 있으나 중간/되돌린 조합 미지정 | [3G](../plan/03-model-global.md#3g--혼합-버전세션과-되돌리기): 실제 구/신 구성·plugin·실행기·reader의 지원/거부·갱신 순서; AC-M6 |
| 검증 역할의 실제 권한 | 역할 설정은 read-only, 이번 실행 metadata는 workspace-write | [5C](../plan/05-acceptance.md#5c--독립-검토와-실제-로딩): 실제 강제 확인 전 필수 독립 검증 완료 금지 |

전용 이관 시스템·새 상태 register·모든 구버전 호환을 추가하지 않는다.
기존 실행 기록·공식 설치 경로·작업에 필요한 조합의 fixture로 확인한다.

## 현재 원본에서 확인한 이유

- [maintenance](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/harness-maintenance.md#L95)는 소비자가 설치된 버전을 실행하며 templates가 기존 repo에 자동 전파되지 않는다고 명시한다.
- [모델 강제 hook](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/scripts/enforce-subagent-model.py#L24)은 명시한 모델까지 바꾼다. 새 설정만 적용하면 기존 설치 hook과 충돌할 수 있다.
- [profile 교체](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/scripts/manage-profile.mjs#L195)의 symlink 원자 교체는 해당 profile 동작이다. 전역 설정 여러 파일의 원자 적용 증거가 아니다.
- [plugin 동기화](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/scripts/sync-codex-plugin-cache.mjs#L75)는 공식 upgrade/add 뒤 version을 확인한다. 전체 전역 설정/소비 문서 복구의 증거로 확대하지 않는다.
- [package catalog](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/packaging/packages.json#L43)의 core 호환 범위는 staged package 계약이다. 설치 가능한 monolith의 임의 구버전 호환 약속으로 해석하지 않는다.

## 독립 설계 검토와 권한 한계

`personal-critical-verifier` 새 인스턴스는 고정된 계획 6개와 지시/실행 보고서 2개를 읽었다.
검토 전후 SHA-256은 일치했고 후보 작성·수정에는 참여하지 않았다.
설계 내용상 1단계 착수 준비는 PASS, 당시 3단계 실제 적용 준비는 복구/혼합 조합 누락으로 FAIL이었다.
이번 3F·3G는 그 누락을 계획에 보완한 것이다. 시험한 수정 후보가 아니며 보완 후 독립 검증 PASS로 바꾸지 않는다.

역할 파일에는 `sandbox_mode="read-only"`가 있지만 이 호출의 실제 turn_context는 `workspace-write`였다.
model=Astra, effort=high, 역할 identity는 일치했다. 4개 도구 호출은 읽기·digest·Git 조회뿐이었다.
쓰기 0과 쓰기 권한 차단은 다른 사실이다. 필수 독립 검증의 기술적 읽기 전용 제한은 INCONCLUSIVE로 남긴다.
지원되는 실행 경로에서 runtime 권한과 격리 거부 시험을 확인하며 권한 거부를 우회하거나 설정을 약화하지 않는다.
이번 실행 결과를 모든 플랫폼·역할의 권한 결함으로 일반화하지 않는다. 별도 보안 검토도 이 결과로 대신하지 않는다.

[고정 입력 SHA 목록](../readiness-review-inputs.json), [당시 입력 보존본](../readiness-fixed-inputs.json),
[실제 역할/model/권한 metadata](../readiness-independent-runtime.json), [독립 검토 원문](../readiness-independent-response.json).

## 남은 항목의 처리

| 항목 | 진행 위치·이유 |
|---|---|
| Claude 지원 실행기·실제 선택 binary/model/effort | 3A; 앱/CLI 버전·manifest 존재만으로 호출 성공을 채우지 않음 |
| 역할별 호출·품질/사용량·최신 공개 SNS | 3B·3C; 좁은 Codex 표본을 재사용하고 남은 과제군만 확인. X 부분 이행·실제 비용 미제공은 그대로 표시 |
| 변경된 문서/패키지·reader·설치 동작 | 4·5; 실제 수정 후보로 검증해야 하므로 지금 추가 정적 검토로 완료할 수 없음 |
| 현재 후보의 전체 gate·독립 보안/권한 검증 | 각 고위험 묶음과 5; 기존 63 PASS나 이번 계획 검토를 수정 후보 증거로 사용하지 않음 |
| 기록·실제 적용·작업 공간 정리 | 5; 승인 범위의 수용 기준을 충족한 뒤 담당 agent가 처리 |

원래 지시·발견 추적·직접 소비 경계 밖의 새 전면 조사로 범위를 확대하지 않는다.
수정 중 새 반례·원본 drift가 나타나면 그 경계만 재검토한다. 배포·운영·결제는 기존 제외 범위를 유지한다.
이번 검토의 종료는 계획 보완·현재 원본 보존·남은 필수 시험 연결이다. 원본 적용 완료와 구분한다.

[임시 자료 검사·원본 대조](../readiness-validation.json): MD 줄 수·실제 파일 참조와 Harness tracked bytes·전역 주요 5파일을 확인했다.
원본은 최신 확인 기준과 일치한다. 전체 감사 기간의 외부 변경 부재나 아직 수정하지 않은 사용자 MD의 상한 충족을 주장하지 않는다.

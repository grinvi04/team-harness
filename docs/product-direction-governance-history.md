# 기존 거버넌스 완료 범위와 보류 기록

[상위 문서](product-direction.md)로 돌아간다. 아래는 원문의 해당 주제·당시 후보 기록을 순서대로 보존한 본문이다.

## 기존 거버넌스 작업과 보류 항목

아래는 기존 개발 결과와 플랫폼 조건 때문에 보류한 항목이다. 개인 개발의 현재 우선순위를 대신하지 않는다.

1. [x] **공개 안전성 감사:** Git 히스토리 시크릿, 공개 식별정보·개인 경로, 라이선스 provenance 점검. 결과는
   [`public-safety-audit.md`](public-safety-audit.md)에 기록했다.
2. [x] **플랫폼 중복 감사:** 현재 skill·hook·agent·Codex patch를 소유/연결/위임으로 전수 분류. 결과는
   [`platform-overlap-audit.md`](platform-overlap-audit.md)에 기록했다.
3. [x] **제품 경계 분리:** 서버 거버넌스 core, runtime adapter, 선택 workflow의 설치·운영 경계를
   [`product-boundaries.md`](product-boundaries.md)에 정의했다.
4. [x] **배포 단순화:** package 정본·재현 build와 세 profile의 filesystem 설치·업데이트·비활성화·제거·doctor
   실측을 완료했다. 사용자 전역 marketplace 승격은 호환성 검증 뒤 별도 승인으로 남긴다.
5. [x] **오픈소스 제품화:** 영문 Quick Start, 지원 환경, SECURITY·CONTRIBUTING·생성형 CHANGELOG와
   기록된 `HEAD` 기반 release bundle·SHA-256 provenance를 정리했다. marketplace 공개는 호환성 검증 뒤다.
6. [x] **호환성 검증:** 다른 plugin과 세 profile을 clean filesystem session에 함께 배치해 identity 충돌,
   namespaced skill 공존, hook overlap 위임, 파일 불변과 malformed·symlink 거부를 검증했다.
7. [x] **외부 파일럿:** DriveTree clean `develop`에서 profile 설치 952.225ms, doctor 38.883ms,
   guard 표본 오탐·누락 0/9, repo-sync MISSING 11을 측정했다. 결과와 한계는
   [`pilots/drivertree-v0.60.0.md`](pilots/drivertree-v0.60.0.md)에 기록했다. v0.61.0에서 stack-rule 전달
   backlog 1건을 실제 처리한 전후 증거와 잔여 MISSING 10은
   [`pilots/drivertree-v0.61.0.md`](pilots/drivertree-v0.61.0.md)에 기록했으며, 판정은 **연결**이고
   후속 commit-provenance·destructive-DDL 두 slice를 완료해 같은 보고서와
   [zero-drift 원본](pilots/drivertree-v0.61.0-remediated.json)에 OK 18 · MISSING 0,
   repositoryUnchanged와 main/develop required gate 적용을 기록했다. 단일 repo 표본이므로 split package의
   `installable:false`와 marketplace 승격 보류를 유지한다.
8. [x] **Codex 공식 loader 전환:** monolith에 native manifest·command hooks·16개 skill wrapper를 직접 싣고
   harness cache patch·overlay·custom agent 복사·unified exec 비활성화를 제거했다. 격리 loader와 실제 새 세션
   결과는 [`pilots/codex-native-loader-v0.61.0.md`](pilots/codex-native-loader-v0.61.0.md)에 기록한다. 이 증거는
   operator-approved GitHub ref의 exact revision, allowlisted subprocess 환경, 격리 HOME·XDG root,
   refresh/API-key와 inherited long-lived credential 환경이 없는 session credential에 결박한다. monolith
   전환만 승인하며 split package의 `installable:false`와 marketplace 승격 보류는 유지한다.
9. [x] **두 번째 외부 파일럿:** Python·Alembic 소비 repo webhook-service의 격리 clean `develop`에서
   profile healthy, guard 9/9, repo-sync OK 5 · WARN 2 · MISSING 11을 측정하고 정본 세 slice로
   OK 18 · WARN 0 · MISSING 0 수렴을 simulation했다. 원본·판정은
   [`pilots/webhook-service-v0.61.0.md`](pilots/webhook-service-v0.61.0.md)에 기록했다. 실제 소비 repo
   [PR #69](https://github.com/grinvi04/webhook-service/pull/69)을 develop에 병합하고 앱 품질 56 tests,
   zero-drift 재측정, main/develop의 `commitlint`·`destructive-ddl` 포함 required context 5개 강제를
    [완료 원본](pilots/webhook-service-v0.61.0-remediated.json)으로 고정했다. 판정은 **연결**이며 두 public
    repo·단일 운영 환경 표본이므로 split package의 `installable:false`와 marketplace 승격 보류를 유지한다.
10. [x] **split package 공식 loader·rollback:** v0.62.0 이후 exact commit `d580808`에서 생성한 staged
    package를 Codex 0.144.6 공식 local marketplace loader로 세 profile에 각각 설치했다. 생성 artifact와 설치
    cache의 전체 tree digest, core-first 설치, workflow→adapter→core 역순 제거, 사용자 Codex 상태 불변과 격리
    HOME 삭제를 [`pilots/codex-split-loader-v0.61.0.md`](pilots/codex-split-loader-v0.61.0.md)에 고정했다.
    판정은 **연결**이며 loader 수명주기 증거만 충족했으므로 `installable:false`를 유지한다.
11. [ ] **split runtime 결과 계약:** 독립 core+Codex adapter에서 native hook·skill fresh-session outcome parity를
    검증한다. Codex가 plugin dependency와 runtime binding을 선언하는 공식 surface를 제공하지 않는 동안 custom
    resolver를 만들지 않고 전환기 monolith를 유지한다. 공식 surface가 생기거나 지원 가능한 native 연결이
    확인된 뒤에만 marketplace 승격·호환 기간·rollback 계획을 별도 결정한다. 2026-09-03 Codex 0.144.6과 공식
    plugin manifest를 재확인했지만 연결 surface가 없었고, 독립 artifact의 hook도 core root를 해석하지 못함을
    [`pilots/codex-split-runtime-v0.61.0.md`](pilots/codex-split-runtime-v0.61.0.md)에 기록했다. 따라서 항목은
    **WAIT**로 열어 두고 `installable:false`·monolith를 유지한다.

기존 거버넌스는 유지한다. 보류 항목은 새 플랫폼 근거가 있을 때만 재개하며 같은 실험을 반복하지 않는다.

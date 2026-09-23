# 요청부터 완료까지 workflow 연결 점검

## 범위와 판정

2026-09-23 사용자가 승인한 후속 작업: 기존 로컬 샘플을 기준으로 요청·skill 선택·구현·검사·문서·
완료 인계의 연결을 점검하고, 재현된 공통 문제를 최소 수정한다. 제품 방향은 **연결**이다.
실제 skill 선택은 실행 플랫폼에 맡기며 자연어 분류기·실행 엔진·별도 상태 저장소를 추가하지 않는다.
샘플 앱·데이터·전역 설치 설정은 변경하지 않는다. #412·#172의 보류 상태는 유지한다.

기준: Team Harness `289c03a6ad5986ed3d7e6e34e42d2078eed1723a`(v0.74.0 역병합 후 develop),
로컬 샘플 `team-task-board` `7185decc6bd4698bd4d51ae306d60707ddb89240`.
이 문서는 해당 후보에서의 점검 기록이며 제품 전체의 무결함을 뜻하지 않는다.

## 확인한 문제와 수정

| 경계 | 재현·근거 | 수정 |
|---|---|---|
| 요청 → skill 안내 | 과거 스펙이 남은 깨끗한 샘플에서 `기존 기능 수정해줘`를 입력하면 설치본 v0.74.0이 `현재=feature-add`와 적용 지시를 출력했다. | 출력은 상태 기반 후보로 표시하고, 실제 요청·기존 승인·프로젝트 원본과 대조한 뒤 skill을 선택하게 한다. 상태 판정·JSON 필드·권한 게이트는 유지한다. |
| 릴리즈 → 문서 검사 | release skill의 main·역병합 단문 본문 둘 다 실제 checker에서 `DECLARATION`, exit 1. | 준비한 본문 파일을 사용하고, 검사 채택 repo는 선언·현재 상태를 대조해 push 전에 `--committed`로 검사한다. 미채택 소비 repo의 선택 도입은 유지한다. |
| 역병합 → 사람 승인 | 공통 게이트 4단계는 보호 정책 조건부이나 release·간소 게이트는 일괄 승인을 요청했다. 실제 develop 보호 조회는 승인 요구 없음, CI 필수였다. | 현재 대상 브랜치가 요구할 때만 사람 승인을 확인한다. 승인 1 이상인 브랜치의 요구와 CI·머지 게이트는 유지한다. 추가 수정이 있으면 동일 내용 역병합으로 취급하지 않는다. |

## 검증과 한계

- 라우터의 실제 출력 계약을 강화한 기존 테스트에서 수정 전 33 PASS / 1 FAIL, 수정 후 34 PASS / 0 FAIL.
  구현 후 잠금한 테스트 SHA-256이 같음을 확인했다. 상태별 선택·조회/부정문 무주입·JSON 계약 검사는 유지한다.
- 전체 품질 검사 중 Codex native 훅 통합 테스트에 남아 있던 `현재=feature-add` 기대값이 실패했다.
  실제 훅 출력에서 후보·승인 범위 안내와 단정 문구 부재를 확인하도록 공개 계약에 맞췄다.
  공용 release·pr-review-gate 변경은 Claude/Codex 양쪽의 의도된 변경이므로 격리 검사에서 이 두
  skill의 고정 지문만 갱신한다. 다른 훅·가드·skill 지문과 격리 검사의 판정은 유지한다.
- 독립 검토에서 릴리즈 명령의 존재하지 않는 기본 경로와 보호 정책 조회 실패 분기 누락을 확인했다.
  실제 소스/설치 경로를 명시해 사용하고, 조회 실패는 승인 없음으로 해석하지 않고 중단하도록 보완한다.
- 같은 샘플의 라이브 모드에서 수정한 source는 `상태 기반 후보=feature-add`와 범위 대조 안내를 출력한다.
  `진행상황 확인해줘`는 무주입이다. 기존 기능 수정 요청을 feature-modify로 자동 분류하도록 바꾼 것은 아니다.
- 샘플의 기존 실행 관리 스크립트 4개는 보존된 검증 후보의 지문과 일치했다. 과거 앱 검사 기록을
  현재 앱 서버의 상태나 이번 전체 앱 재시험으로 보고하지 않는다. 이번 수정은 샘플 앱을 바꾸지 않는다.
- 소비 repo의 별도 문서 검사, 사람의 의미 검토, 이미 승인된 범위·검증 근거의 재사용은 의도된 계약이다.
  기계 검사는 미선언 문서·의미상 누락·모델의 실제 skill 선택 정확도까지 보장하지 않는다.

최종 검증 결과와 PR은 이 변경의 Git 이력·PR을 정본으로 대조한다. 소스 후보는 v0.75.0이며,
develop 반영과 정식 릴리즈·설치 갱신은 구분한다. 이번 점검은 v0.75.0 발행·설치 완료를 주장하지 않는다.

## 후속 v0.75.0 릴리즈

같은 날 사용자가 정식 릴리즈와 Codex 설치 갱신을 추가 승인했다. 점검 수정은
[PR #477](https://github.com/grinvi04/team-harness/pull/477)로 develop에 병합됐다.
사전 검증 후보 `5695cdcba2323fa6236da949215828b759093d64`에서 quality 실행 단계 61개 전체 재실행 PASS,
독립 보안 검토 PASS, 외부 파일럿 원격 원본 7건 PASS, 배포 묶음 SHA-256 검증 PASS를 확인했다.
실행 앱·DB가 없어 관련 앱·DB 운영 검사는 해당하지 않는다. `docs/gen_arch_svg.py`가 없어
SVG 신선도 검사는 SKIP이며, `templates/gen_arch_svg.py`는 소비 프로젝트용 서식이다.

릴리즈 준비 변경은 이 검증 기록 추가뿐이며 스크립트·스킬·권한 설정은 동일하다. 실제 배포 상태는
`release/v0.75.0 → main` PR, `v0.75.0` 태그, `sync/backmerge-v0.75.0 → develop` PR을 정본으로 확인한다.
사전 검증은 main 병합·태그 발행·역병합·설치 갱신 완료의 증거가 아니다. 설치 갱신 후에는 실제 설치 경로·
버전·로딩 결과와 기존 샘플의 문서 검사·라우터 안내를 별도로 확인한다. 샘플 앱·데이터는 유지한다.

## 문서 동기화 범위

`docs/ai-collaboration.md`의 후보·승인 경계, `docs/decisions.md`의 판단 기록,
release·pr-review-gate의 실행 안내, README·소개 페이지·양쪽 manifest·생성 CHANGELOG의 후보 버전을
같이 대조한다. 기존 `docs/specs/progress-document-check.md`는 v0.74.0 작업의 과거 기록으로 보존한다.
Codex native wrapper는 공용 skill을 직접 읽으므로 절차를 복제하지 않는다.

```harness-doc-sync
{
  "version": 1,
  "documents": [
    {"path": "docs/specs/workflow-advisory-boundary.md", "reason": "이번 점검의 범위·재현·검증 한계"},
    {"path": "docs/ai-collaboration.md", "reason": "상태 후보와 실행 승인 경계"},
    {"path": "docs/decisions.md", "reason": "공용 안내 변경의 이유"},
    {"path": "plugins/harness-guard/skills/release/SKILL.md", "reason": "릴리즈·역병합 본문 검사 연결"},
    {"path": "plugins/harness-guard/skills/pr-review-gate/SKILL.md", "reason": "대상 브랜치의 승인 조건"},
    {"path": "docs/specs/progress-document-check.md", "reason": "v0.74.0 과거 검증 기록 보존"},
    {"path": "docs/harness-maintenance.md", "reason": "기존 버전·문서 검사 채택·보호 정책과 대조"},
    {"path": "docs/code-review.md", "reason": "기존 PR·보호·문서 검사 계약 유지"},
    {"path": "README.md", "reason": "소스 후보 버전"},
    {"path": "docs/intro.html", "reason": "소개 페이지의 소스 후보 버전"},
    {"path": "CHANGELOG.md", "reason": "의미 변경 커밋에서 생성한 변경 이력"}
  ],
  "items": []
}
```

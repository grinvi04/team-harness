# QA·리뷰·전달 판정

## Q01 — test-guard가 현재 보안 시험의 assertion을 세지 못한다

정적 확인. [test-guard](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/.github/workflows/test-guard.yml#L41)의 정확한 패턴은 check/case_ 형태를 사용하는 주요 Bash 보안 시험 다섯 개에서 assertion을 0개로 센다.
assert 호출을 제거해도 이 수가 줄지 않을 수 있다. 일부 시험의 0 PASS/0 FAIL은 exit 0일 수 있다.
전체 변조 후보의 CI는 실행하지 않았다. 최소 실행 사례·실제 실패 전달·결함 변이를 잡는 판정 기준이 필요하다. template도 같이 변경해야 한다.

## Q02 — 보호 복구 확인이 복구 전 설정을 비교하지 않는다

정적·순수 판정 확인. [solo-merge skill](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/skills/solo-merge/SKILL.md#L24)은 --check 결과로 복구를 확인한다.
main의 기본 확인은 승인이 0이어도 성공할 수 있다. --approvals 1이면 다른 결과를 반환한다.
승인 수 하나만으로 전체 복구를 증명할 수도 없다. 저장한 review policy를 복원 결과와 비교하고 실패를 남겨야 한다. 모든 종료에서 복구 보장 표현도 API 실패 한계를 밝혀야 한다.

## Q03 — 처리한 리뷰와 해결 표시할 리뷰를 구분해야 한다

정적 확인. [pr-review-gate](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/skills/pr-review-gate/SKILL.md#L60)는 조회 시점의 모든 unresolved thread ID를 해결 대상으로 삼는다.
앞선 처리 뒤 새 thread가 생겼다면 답변·검토하지 않은 thread까지 해결할 수 있다.
실제 GitHub thread 변경은 없었다. 처리했던 ID와 후보를 저장해 그 범위만 해결하고 새 thread는 남겨야 한다.

## Q04 — hotfix 태그가 승인한 병합 SHA에 묶이지 않는다

정적 확인. [hotfix](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/skills/hotfix/SKILL.md#L81)는 최신 main에 태그하고 --tags로 다른 로컬 태그까지 push할 수 있다.
같은 저장소의 release 절차는 PR merge SHA를 확인하고 대상 태그 하나만 push한다.
hotfix에도 같은 후보·단일 태그 경계를 적용해야 한다. 실제 태그·push는 하지 않았다.

## Q05 — MISSING 0을 전체 드리프트 없음으로 확대한다

문서·판정 대조. [repo-sync skill](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/skills/repo-sync/SKILL.md#L38)의 요약은 MISSING 0을 드리프트 없음으로 표현한다.
WEAK·WARN·보호 조회 실패가 있어도 이런 문장이 만들어질 수 있다.
checker가 문서에 밝힌 범위 한계 자체는 결함이 아니다. 결과 종류를 유지하고 누락 검사와 의미·적합성 검토를 분리해야 한다.

## Q06 — 닫힌 이슈 수와 마일스톤 완료는 다르다

문서 판정 오류. [milestone skill](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/skills/milestone/SKILL.md#L227)는 closed_issues를 기능 완료 수로 해석한다.
닫힌 PR·이슈가 모두 원래 수용 기준을 충족했다는 연결이 없다. 취소·중복·단순 작업도 닫힐 수 있다.
이슈 개수와 수용 기준 충족을 별도로 보여주고, 완료는 후보·시험·기준에 연결해야 한다.

## Q07 — 불확실한 리뷰가 기각 또는 누락으로 바뀐다

순수 함수 재현. [.claude workflow](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/.claude/workflows/harness-review.js#L100)는 uncertain/isReal false를 rejected로 집계하고 null 판정을 누락한다.
메모리 입력에서 불확실한 항목 1개가 기각 1개가 되고 null은 확인/기각 양쪽 모두 0이었다.
확인·기각·미확인과 검토 범위 완료를 구분해야 한다. 이 workflow DSL이 현재 플랫폼에서 실제 활성화됐는지는 이번에 호출하지 않았다.

## Q08 — force-push 복구 안내가 해당 wrapper와 맞지 않는다

문서·코드 대조. [operations](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/operations.md#L83)는 solo-merge로 force-push 허용을 해제·복구한다고 안내한다.
[solo-merge.sh](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/scripts/solo-merge.sh)는 review 조건을 다루며 force-push 설정을 그렇게 변경하지 않는다.
실제로 지원하는 경로와 정확한 승인·복구 범위로 안내해야 한다. 새로운 강제 push 기능을 추측으로 추가하지 않는다.

## Q09 — 아키텍처 재생성 hook의 파싱 실패가 성공으로 숨겨진다

코드 경로 확인. [regen hook](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/templates/hooks/regen-arch-svg.sh#L5)은 잘못된 JSON을 받으면 출력 없이 exit 0이 되고 생성기를 실행하지 않는다.
비적용 입력과 실패한 입력을 구분하지 못한다. 조사 범위에서 generator의 부작용은 실행하지 않았다.
계약에 맞는 실패 출력·종료값과 정상 비적용 대조군을 시험해야 한다.

## Q10 — SVG 충돌 검사 결과를 무시한다

메모리 파일 시스템 재현. [generator](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/templates/gen_arch_svg.py#L231)는 check_labels의 false 결과를 무시하고 파일 쓰기·Written 출력으로 진행한다.
레이블 충돌을 실패로 판단하는 문서 계약과 다르다.
원본 SVG 파일은 쓰지 않았다. false가 전달되는 실패 경로와 정상 그림 대조군을 확인해야 한다.

## Q11 — SVG 텍스트를 XML에 맞게 escape하지 않는다

메모리 문자열 재현. generator에 `API & DB` 같은 레이블을 넣으면 생성 XML 파서가 실패한다.
입력 문자열이 현재 문서 예시보다 넓을 때 유효한 그림을 보장하지 못한다.
텍스트와 XML 속성을 각각 escape하고 유효한 생성 결과를 검사해야 한다. 원본 자산 변경은 없었다.

## Q12 — 실제 실행 증거와 선언·파일 존재를 계속 구분해야 한다

현재 doc-sync checker는 선언한 경로·상태·digest·후보 연결을 검사한다. 의미·빠진 대상까지 보장한다고 설명해서는 안 된다.
이번 quality 잡은 synthetic noImpact PR 입력을 사용했으며 실제 PR의 문서 영향 선언이나 사람 승인 검증이 아니다.
기존 시험은 반례를 모두 포함하지 않았다. 수정 시험은 원본의 실패와 변경 후보의 통과, 정상 대조군을 함께 보여줘야 한다.
모델·hook·보호 복구·배포를 실행하지 않은 항목은 미실행으로 남긴다.

## 변경 후 요구할 QA 범위

- 차단 본질의 기능: 허용·거부·경계 입력, 절대 경로·옵션 표현, 실패 전달, 로그에 비밀을 남기지 않는지.
- 후보 증거: SHA·바이트·실행 바이너리·환경·출력 대상의 연결과 검토 뒤 후보 변경 시 재검사.
- 원격 wrapper: 읽기 실패·부분 실패·복구 실패·새 head/thread의 안전한 모의 시험, 승인된 실제 확인의 별도 결과.
- 문서 판정: MISSING/WEAK/WARN/FAIL/UNVERIFIED 구분, 미확인에 완료 표현 금지.
- 부수 산출물: SVG 유효성·충돌 결과, hook 입력 오류의 전달, 관련 template·직접 소비자와 동기화.

이번 결과로 기존 체크리스트 전체가 무효가 되는 것은 아니다. 실행한 후보의 결과를 보존하고, 발견한 공백을 새 후보의 필수 범위로 추가한다.

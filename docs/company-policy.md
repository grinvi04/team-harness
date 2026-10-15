# 기존 회사 브랜치 정책 연결

회사 GitHub 서버 정책은 회사가 소유한다. Harness는 기존 REST branch protection을 읽고,
명시한 승인 수와 필수 검사 보강을 연결하며 변경 결과를 다시 조회한다. rulesets를 재작성하거나
회사의 승인·CODEOWNERS·push 제한을 솔로 표준으로 바꾸지 않는다.
제품 방향 판정은 **연결**이다. GitHub가 보호를 강제하고 Harness는 보존·검증을 담당한다.
저장소의 `.harness-policy.json` 선언은 원격 관리 권한이나 정책 변경 승인을 부여하지 않는다.
솔로 예외의 별도 opt-in과 소유자·협업자 사전 조건은 [코드리뷰 정책](code-review.md)을 따른다.

## PR 대상 브랜치 선언

기존 `.harness-policy.json`에 선택 필드 `branchFlow`를 추가할 수 있다. 선언은 기존 제품 흐름을 기록할 뿐이다.

```json
{"schemaVersion":1,"mode":"company","autoMergeTargets":[],"branchFlow":"main"}
```

`main`은 작업→main, `git-flow`는 작업→develop→release→main→develop 역병합이다.
`pr-create.sh --base`가 있으면 선언과 일치해야 한다. GitFlow release/hotfix는 `--base main`을 반드시 명시한다.
그 외 base 충돌·선언/입력 부재·원격 조회 실패는 push 전에 거부한다. 오래된 develop 존재나 로컬 추적 ref로 추정하지 않는다.
다른 브랜치 체계는 `branchFlow`를 선언하지 않고 해당 PR의 `--base`를 명시한다.
기존 mode·autoMergeTargets 의미는 그대로다. main 중심 선언이 자동머지나 보호 완화를 허용하지 않는다.

## 선택형 의존 PR

미발행1.1.0 후보는 `branchFlow`와 `stackedPRs: {enabled: true, provider: "github-gh-stack"}`를 함께 읽는다.
공식 확장에 등록된 같은 repo의 선형 작업 층만 `stack.sh`로 제출한다. 직접 parent는 작업 branch일 수 있지만
정책 trunk는 git-flow의 develop 또는 main 흐름의 main이다. 미선택 repo의 기존 생성 경로는 유지한다.
이 선언으로 보호 설정·사람 승인·원격 권한이 바뀌지 않는다. 현재 지원 범위는
[구현·검증 상태](specs/stacked-git-workflow/final-review.md)를 따른다. async 병합·solo 복구는 로컬 구현·검토를
통과했으며 실제 adapter의 원격 인수는 미확인이다. 이 후보의 병합 wrapper는 github.com만 지원하며 다른 GH_HOST는 거부한다.

## 실행 범위와 미리보기

플러그인의 `scripts/set-branch-protection.sh`를 현재 설치 경로에서 실행한다.
기존 보호가 적용된 저장소에서, 조회 및 변경 권한이 승인된 경우에만 apply를 실행한다.

```bash
bash set-branch-protection.sh org/repo --branches main --preview --contexts quality
bash set-branch-protection.sh org/repo --branches main,develop --check
bash set-branch-protection.sh org/repo --branches main,develop --preview \
  --approvals 2 --develop-approvals 1 --contexts quality,security
```

- `--branches main`은 develop을 조회·변경하지 않는다. 기본은 `main,develop`이다.
- `--preview`는 선택한 정책의 PUT payload를 출력하며 원격 쓰기는 0회다.
- `--check`는 읽기 전용이다. 승인 수 미지정은 각 브랜치에서 정보성이다.
  명시한 양수는 최소 승인 기준이며, 명시한 0은 승인 수 0을 진단한다.
  `--contexts`를 같이 주면 이름의 exact set을 진단한다.
- apply에서 승인 수 미지정은 기존 리뷰 설정 전체를 보존한다. `--approvals`는 main,
  `--develop-approvals`는 develop에만 적용한다. 기존 승인 수보다 낮추는 요청은 쓰기 전에 거부한다.
  양수 명시는 해당 승인 수와 stale 승인 무효화를 요구하며 나머지 리뷰 필드는 보존한다.
- apply의 `--contexts`는 기존 검사에 추가한다. 기존 검사와 app ID를 제거·재결박하지 않는다.
  미지정 시 현재 check-run 이름을 감지하고 비어 있지 않은 목록이어야 한다.
- 기존 `CODEOWNERS` 리뷰 요건, last-push 승인, dismissal/bypass 주체, push restrictions,
  linear history, block_creations, branch lock, fork syncing은 보존한다. 서명 요건은 별도 API 설정이므로
  PUT에서 건드리지 않고 사후 GET에서 원값과 대조한다.
- 기존 기본 불변식(strict checks, 관리자 강제, 대화 해결, force-push·삭제 차단)은 보강한다.

## 쓰기 전 차단과 사후 확인

선택한 모든 브랜치의 존재·기존 보호·유효한 검사·변환 가능한 정책을 먼저 읽는다.
상위 조직 정책을 포함한 rulesets 조회도 성공해야 한다. 어느 사전 조회라도 실패하거나
응답이 잘못되면 PUT하지 않는다. 알려지지 않은 정책 필드·주체 표현·app binding도 차단한다.
지원되지 않은 필드를 버리고 계속 적용하지 않는다.

이 도구는 **ruleset이 하나라도 있는 저장소에서 apply·preview를 차단**한다.
조건·우회 주체·조직 상속을 해석하는 일반 ruleset 엔진은 제공하지 않는다.
보호 미적용·404·권한 오류도 동일하게 차단한다. 오류를 보호 없음으로 추정하지 않는다.
`--check`는 공식 GET의 `block_creations`와 null app binding, 생략된 리뷰 설정을 판독한다.
생략된 리뷰 설정은 리뷰 조건 없음이며 회사 승인 충족을 뜻하지 않는다.
`checks.app_id:null`은 조회만 지원한다. plan·preview·apply는 PUT 전에 차단한다.
null을 정수/-1/생략으로 바꿔 앱 결박을 추측하지 않는다. 잘못된 app 표현도 차단한다.
이 경우 회사 정책 담당자가 GitHub 원본과 공식 관리 수단에서 필요한 변경을 검토한다.
새 검사 binding은 REST 자동 선택을 사용한다. 서버가 새 app ID를 정규화해 반환하면 엄격한
사후 비교가 실패할 수 있다. null binding·새 binding의 실제 PUT 왕복 호환성은 **미확인**이다.

쓰기 직전에 전체 선택 브랜치 정책을 다시 읽고 사전 원본과 다른 응답이면 중단한다.
각 PUT 뒤에는 전체 지원 정책과 서명 요건을 다시 조회하여 계획·원값과 대조한다.
불일치나 조회 실패는 실패로 보고하고 다음 브랜치 쓰기를 중단한다.
이미 성공한 PUT의 자동 복구는 수행하지 않는다. 실제 변경된 브랜치 정책 확인이 필요하다.

REST PUT에는 원자적 정책 비교 조건이 없어 마지막 조회와 쓰기 사이의 동시 관리자 변경을
완전히 방지하지 못한다. 적용은 회사의 정책 변경 절차·단일 변경 담당 아래 수행한다.
`--check` 성공은 회사 모든 ruleset·compliance 또는 정책 원값 복구의 증명이 아니다.

## 구현 및 검증 범위

변환 helper는 `plugins/harness-guard/scripts/branch-protection-policy.mjs`이며
스크립트와 같은 package에 포함해야 한다. 정책 변경 경로는 로컬 fake `gh`로 검증했다.
[0.92.0 후속 조회](pilots/company-adoption-2026-10-13.md)의 실패는 당시 후보의 기록이다.
[0.92.1 호환 수정](specs/company-policy-api-compatibility.md)은 block_creations 원값을 보존하고
조회/쓰기 가능한 표현을 구분한다. 정수 앱 결박·사후 손실 거부는 유지한다.
회사 가정 시험과 실제 회사 집행을 구분한다. 실제 회사 저장소 변경·회사 채택은 검증하지 않았다.

```bash
bash tests/set-branch-protection-test.sh
bash tests/set-branch-protection-preservation-test.sh
node --test tests/branch-protection-policy-test.mjs
node --check plugins/harness-guard/scripts/branch-protection-policy.mjs
bash -n plugins/harness-guard/scripts/set-branch-protection.sh
```

기존 단위·CLI 테스트는 유지한다. develop 승인 미지정의 과거 강제0 기대는 정책 보존 계약으로
바뀌었다. apply 사후 조회는 사전 조회를 포함한 횟수 대신 실제 PUT 이후의 재조회를 단언한다.
추가 fixture는 main-only, develop 승인1·2, 회사 리뷰·주체·checks 보존, 조회 실패·malformed,
강한 검사 유지, 미지원 필드·rulesets, 승인 하향 거부, preview 쓰기0, 사후 정책 손실을 검사한다.

공식 필드 계약은 [GitHub branch protection REST 문서](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection)를 따른다.
0.92.1의 회귀·기존 보존·전체 품질·독립 검토와 실제 개인 GitHub GET이 통과했다.
발행·Codex/Claude 설치·보호 원문 보존은 위 수정 명세의 전달 결과를 따른다.
0.93.0의 신규 시험 repo PUT은 HTTP422였다. [현재 호환 수정](specs/acceptance-policy-wire.md)을 따른다.
PUT은 앱 결박을 유지하는 checks 또는 legacy contexts 중 하나만 보내고 GET의 projection을 검증한다.
회사 고유 정책·집행은 별도 미확인이다. 개인 solo 자기승인 예외의 복구는 회사 승인 증거가 아니다.

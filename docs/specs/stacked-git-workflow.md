# 공식 gh-stack 연결 설계

상태: **G1 제출·재기반·trusted CI와 G2 async/solo 로컬 구현·독립 검토 PASS, G3 연결 중**. 기준 `59bf40b`의 미커밋 1.1.0 후보.
[최초 G0](../pilots/gh-stack-compatibility.md)의 frozen-group FAIL을 보존하고,
[최종 검토](stacked-git-workflow/final-review.md)에 따라 trunk·그룹 의미로 연결 설계를 정정했다. 실제 원격 인수·전체 지원 완료는 아직 아니다.
사용자는 stacked PR 방식과 무료 GitHub CLI 확장을 선택했다. 유료 Graphite는 범위 밖이다.

## 목표와 유지할 계약

개발 변경을 작고 의존 관계가 보이는 PR로 나누고 수정·재기반·전달 상태를 일관되게 관리한다.
제품 방향 판정은 **연결**이다. branch stack 엔진은 공식 확장에 맡기고 Harness는 검증·증거·전달을 소유한다.
모든 Git 업무를 아래 표로 연결하지만 commit·release·tag까지 무조건 `gh stack` 명령으로 바꾸지 않는다.

- `git-flow`의 개발 trunk는 명시적으로 `develop`; 기존 `main` flow 소비 repo만 선언에 따라 main을 쓴다.
- 한 PR이면 한 층이면 충분하다. 독립 변경을 억지로 한 stack에 연결하지 않는다.
- 기존 CI·독립 AI 리뷰·사람 승인·CODEOWNERS·strict 보호·문서 선언·현재 SHA 결박을 유지한다.
- 작업 PR 병합 전 그 결과의 release/main PR을 만들지 않는다. release/main/backmerge는 개발 stack 밖이다.
- `main/develop` 직접 commit/push·force push 금지, 소비 repo의 원격 보호 자동 변경 금지.
- 공용 기능은 명시 opt-in이며 기존 일반 PR 경로와 설정은 호환된다.

상세 실행은 [구현 계획](stacked-git-workflow/implementation-plan.md), 전체 순서는
[대시보드 설계](local-runtime-dashboard.md#두-작업의-실행-순서)를 따른다.

## 공식 기능과 현재 충돌

| 확인한 사실 | Harness에서 필요한 연결 |
|---|---|
| 공식 설치 `gh extension install github/gh-stack`, 확인한 release v0.2.1 | 지원 버전 고정·변경 시 호환 시험; 설치 완료와 기능 검증 구분 |
| init 기본 trunk는 repo default, 대화형에서 rerere 활성화를 질문 | `--base develop` 명시, 비대화형은 설정 보존; 대화형 변경·복구 기록 |
| submit은 push·PR 생성/수정·stack 연결을 함께 수행 | 기존 wrapper 사전 검사·PR 본문을 건너뛰는 직접 호출 금지 |
| link도 기존 PR base를 교정하며 실패를 warning으로 처리 가능 | 검증된 동일 repo PR URL만 전달·사전 대상 확인·실행 후 전부 재조회 |
| push는 내부 fetch 뒤 tracking OID로 lease를 생성 | adapter가 사전 관찰 OID·고정 source commit으로 표준 Git atomic push; 기대 OID 자동 갱신 금지 |
| sync는 fetch/rebase/push/PR 갱신을 결합, 비대화형 충돌은 성공 exit 가능 | 종료 코드 외 실제 ref·stack·PR 사후 조건 확인 |
| linked stack은 비동기 merge API 필수, auto-merge 미지원 | 기존 gate 뒤 새 provider 연결; stack에서 `--auto`를 명확히 거부 |
| merge-async는 선택 PR과 하단 미병합 PR을 함께 병합 | 현재 병합 그룹 전체 검증; 한 층씩이 기본이며 원자적 단일 PR 보장은 아님 |

기존 일반 경로는 feature base를 거부한다. opt-in adapter만 실제 등록된 parent를 생성 경로에 연결한다.
공식 stack은 모든 층에 trunk 보호를 적용한다. 병합 wrapper는 actual base=trunk인 최하단만 기존 gate로 연결한다.
Actions branch 필터는 trunk로 평가된다. main/develop 필터를 넓히지 않고 payload의 직접 parent와 구분한다.

## 모든 Git 업무의 적용표

| 업무 | 적용 경로 |
|---|---|
| status/diff/log/fetch·commit | Git 원래 기능과 현재 commit 검사; 변경 파일 자동 일괄 stage 금지 |
| 작업 시작·층 추가·이동 | 공식 `init --base`·`add`·`view`·navigation; 대상 worktree 확인 |
| PR 생성·갱신 | 새 `stack.sh submit` → 기존 `pr-create.sh`의 검증 → 공식 `link` → 원격 readback |
| rebase·push·동기화 | `stack.sh restack/sync` preview → 공식 local rebase → 관찰 OID 결박 전송·사후 검사 |
| 리뷰·CI | 현재 병합 그룹 각 층의 필수 게이트 + trunk 통합 후보 검토; 재기반 시 증거 재대조 |
| develop 병합 | 기존 `pr-merge.sh`가 stack 식별 후 새 비동기 provider 사용; 한 층씩 |
| 개인 repo 예외 | 기존 `solo-merge.sh` 자격·승인 범위만; 비동기 결과와 보호 복구를 별도 확인 |
| release/main/tag/backmerge | 기존 release 계약; 작업 stack 완료 근거·병합 SHA를 입력으로 연결 |
| 긴급 hotfix | 기존 main hotfix·develop 역병합; 개발 stack에 끼워 넣지 않음 |
| branch/worktree 정리 | descendants·사용 중 worktree 확인 후 leaf부터; 공식 sync의 무조건 prune 금지 |
| stack 재구성·포기 | 대상 diff·복구 지점 확인 후 명시 수행; 자동 drop/fold/unstack 제외 |

미발행 후보에는 opt-in·`inspect/check-create/submit/restack/sync`와 충돌·유실 응답 재개가 구현됐다.
층별 trusted CI는 로컬 검증했으며 실제 adapter 원격3층·trusted 이벤트·async 병합은 아직 미확인이다.
현재 설치 버전의 명령으로 안내하지 않는다. [현재 검사·한계](stacked-git-workflow/final-review.md#g1-제출-경계-최종-검토)를 따른다.
확장 자동 설치·업데이트, `gh skill install`, alias·전역 설정 변경을 제출 경로에 숨기지 않는다.

## 기존 스킬 17개의 연결 범위

모든 스킬의 적용성을 확인한다. Git 작업을 수행하는 스킬은 stack 경로로 연결하고, 검사·진단 스킬은
현재 층과 후보를 검증 문맥으로 받는다. 검사 방법을 stack 명령으로 대체하거나 Git 쓰기 권한을 늘리지 않는다.
공통 문맥은 `skills/ao-coordinate/project-contract.md`에 한 번 정의하고 각 스킬은 자기 책임만 연결한다.
문맥은 repo·worktree·소유자·trunk·현재 층·parent·head/base OID·대상 PR·영향받는 descendants다.
기록된 문맥은 승인이나 현재 상태의 증명이 아니며 실행 전에 원본과 대조한다.

| 스킬 | 연결할 책임 |
|---|---|
| `plan` | 독립 변경과 의존 변경·층별 수용 기준을 설계한다. 계획만으로 branch/PR을 생성하지 않는다. |
| `feature-add` | 승인된 기능을 기존 층 또는 새 층에 배치하고 현재 층의 고유 변경을 검사한다. |
| `feature-modify` | 수정할 층과 descendants 영향을 확인하고 필요 범위만 restack·재검증한다. |
| `ao-coordinate` | 층·worktree·실제 writer·후속 의존성을 인계하며 사용 중인 작업을 재기반하지 않는다. |
| `loop` | 현재 층에서 승인된 수정·checkpoint만 수행하고 parent 변경 시 관련 증거를 재대조한다. |
| `milestone` | 목표와 층별 PR을 연결하며 PR 생성 예시도 공통 제출 경로를 따른다. 개수로 목표 완료를 판단하지 않는다. |
| `pr-create` | 선택한 제출 범위·층별 본문·parent·draft를 검사한 뒤 adapter로 생성/연결한다. |
| `pr-review-gate` | parent 대비 층별 diff와 trunk 통합 영향을 구분하고 승격 후 현재 후보의 gate를 다시 확인한다. |
| `feature-merge` | 검증된 최하단 한 층만 병합하고 서버 retarget·새 후보 확인 후 다음 층으로 넘어간다. |
| `solo-merge` | 기존 solo 자격만 적용하고 async 미완료·보호 복구를 분리한다. 미보호 parent는 예외 자격이 아니다. |
| `verification-before-completion` | head/base·parent 관계·영향 범위에 증거를 연결하고 재기반 후 오래된 증거·pending 완료 판정을 거부한다. |
| `release-check` | 이번 릴리즈에 포함할 층의 실제 trunk 병합·후보 포함을 확인하고 기존 전체 릴리즈 검사를 유지한다. |
| `release` | 해당 작업의 develop 병합 후 release→main→태그·역병합 순서를 유지한다. 개발 stack과 분리한다. |
| `hotfix` | 기존 main 긴급 수정·develop 역병합을 유지하고 그 결과에 의존하는 개발 층의 재검증을 연결한다. |
| `systematic-debugging` | 실패한 층·parent·후보를 재현 근거에 연결한다. 진단만으로 stack을 수정하지 않는다. |
| `qa` | 검사한 화면·후보·통합 상태를 기록한다. 디자인·접근성 검사 자체와 권한 범위는 유지한다. |
| `repo-sync` | opt-in과 설치 자산·CI 계약의 불일치를 읽기 전용으로 점검한다. 미선택을 누락으로 취급하지 않는다. |

17개 본문에 같은 명령을 복사하지 않는다. 공통 계약으로 충분한 스킬은 연결 경로·의미를 검증하고
불필요한 본문 변경을 피한다. 로컬 전용·진단 전용 요청에는 stack 생성·push·PR을 강제하지 않는다.
shared 스킬→Codex 생성 wrapper·native runtime→자연어 라우터→분할 package도 같은 계약으로 대조한다.
부모 커밋만 있는 자식 층을 완료 작업으로 세거나 미보호 parent를 solo 후보로 안내하는 기존 추론을 수정한다.
짧은 요청의 라우팅 안내를 전체 stack 병합 승인으로 확대하지 않는다.

## 3단 PR 예시와 병합 순서

```text
develop ← A: event 계약 ← B: hook 연결 ← C: dashboard
          PR A→develop   PR B→A(draft)  PR C→B(draft)
```

1. 세 PR 모두 선언·각 층 diff·관계가 확인된 경우에만 제출한다. B/C는 선행 검토용 draft다.
2. A가 develop을 직접 대상으로 할 때 기존 필수 CI·독립 리뷰·승인·최신 후보를 검사한다.
3. A 하나의 head SHA로 비동기 병합을 요청하고 실제 MERGED·merge SHA를 확인한다.
4. 서버의 자동 retarget/rebase 결과를 다시 읽고 B/C를 공식 엔진으로 동기화한다.
5. 새 B의 head/base에 대한 CI·리뷰를 확인한 뒤 ready/병합한다. C도 동일하다.
6. C까지 원격 develop 포함을 확인한 뒤 그 병합 SHA에서 release를 시작한다.

rebase 후 diff가 같아도 과거 후보 검증을 현재 SHA의 검증으로 표시하지 않는다.
GitHub가 승인을 유지하는 동작과 Harness의 현재 후보 검토 계약은 따로 대조한다.

## 제출·CI 신뢰 경계

선택 필드 제안: `.harness-policy.json`의 `stackedPRs: {enabled: true, provider: "github-gh-stack"}`.
trunk는 `branchFlow`에서 유도한다. 임의 trunk·임의 base 면제 설정을 추가하지 않는다.
등록된 같은 repo·허용 작업 branch·선형 parent 관계·일치하는 실제 OID·clean 소유 worktree만 받는다.
검증 문맥 파일을 신뢰해 통과시키지 않고 wrapper가 현재 Git/원격에서 다시 대조한다.
모든 층을 사전 검사한 뒤 첫 push를 시작하며, 각 PR은 별도 body-file과 문서 동기화 선언을 갖는다.
기존 PR 재사용 시 다른 base·repo·head를 조용히 덮어쓰지 않는다. 의도한 retarget만 별도 계획으로 수행한다.
link에 숫자나 branch를 전달하지 않는다. 숫자 이름의 로컬 branch가 push되거나 stack ID로 해석될 수 있다.
현재 stack 구성·순서까지 사전 대조하며 raw link도 다른 mutation과 함께 Harness 경로로 유도한다.
native `view.head`는 캐시다. 후보는 실제 Git HEAD에서 읽으며 일반 commit 뒤 캐시 차이를 오류로 취급하지 않는다.
PR 본문은 preview 해시와 연결한 내용을 메모리에 보관해 층 검사·wrapper stdin에 전달한다.
표준 Git push는 모든 full ref와 source commit을 명시하고 absent ref에는 빈 expected lease를 쓴다.
원격 경합·atomic 미지원·응답 유실은 미확인으로 기록한다. 새 fetch 값으로 lease를 교체해 재시도하지 않는다.
공식 sync에는 no-push 옵션이 없다. local rebase 엔진과 전송을 분리하며 공식 metadata를 직접 편집하지 않는다.

상위 PR도 trunk 필터로 CI가 실행되는지 관찰한다. 신뢰 검사 원문은 protected 원본의 고정 SHA에서 읽는다.
후보 코드의 시험은 read-only token·비밀정보 없는 격리 job으로 실행한다.
`pull_request_target`에서 후보 코드를 높은 권한으로 실행하거나 부모 PR의 정책을 신뢰 원본으로 삼지 않는다.
trusted 검사기의 helper·설정도 같은 trusted SHA에서 읽는다. PR tree는 데이터/격리 시험 대상으로만 사용한다.
단일 PR 요청은 actual base=trunk·lowest unmerged를 재확인하며, 이미 상위층이면 거부한다.
명시 그룹 요청은 선택 PR까지 하단 전체를 검사한다. 직전 구성·head·base·trunk를 재대조하고 변경 시 중단한다.

## 비동기 merge·실패·복구

공식 `PUT .../pulls/<PR>/merge-async`에 검토한 `sha`, 허용 `merge_method`, `merge_action=default`를 보낸다.
`pending`은 UUID를 저장하고 조회한다. `enqueued`는 병합 완료가 아니며 queue 결과를 따로 확인한다.
`merged`도 실제 PR MERGED·merge SHA·trunk 포함을 확인한 뒤 완료로 기록한다.
409는 기존 요청의 head/method/action이 기대값과 같은지 확인한다. 다르면 새 요청을 보내지 않고 중단한다.
404·권한·network·응답 유실은 성공도 미지원 확정도 아니다. 결과 미확인 상태와 재조회 경로를 남긴다.
원격 효과가 불명확하면 자동 재제출·강제 rollback하지 않는다. 기존 요청 식별자로 복구한다.

solo 경로는 queue 사용을 보호 변경 전에 거부한다. async 대기 상한은 30초이며 종료·오류 시 보호를
즉시 복구하고 전체 readback을 확인한다. pending은 미완료로 남기며 같은 base의 후속 예외 실행을 막는다.
복구는 이미 요청된 병합의 취소가 아니다. 결과가 확정될 때까지 읽기 전용으로 확인하며 임의 재요청하지 않는다.
SIGKILL·전원 손실 복구 보장은 추가하지 않는다. 신규 async 경로의 trap·timeout·복구 readback 시험은 필수다.
head SHA 결박은 stack 전체 구성·base의 원자적 고정을 뜻하지 않는다. 최하단 한 층 제한과 직전 재조회로
범위를 줄이되 동시 원격 편집에 대한 남은 한계를 기록한다. 보호 완화로 이 한계를 해결하지 않는다.
최초 G0의 frozen-group 중단 판단은 기록에 보존한다. 공식 의미 확인 후 이 새 원자성 요구를
기존 보호와 혼동하지 않는다. 현재 그룹의 독립 리뷰·스레드·외부 상태는 서버 검사가 대신하지 않는다.
solo의 지연 병합·보호 복구는 G2 실제 지원의 필수 검증이며 단순 조회·fixture만으로 지원 완료로 세지 않는다.

## 고정 완료 기준

| ID | 완료 조건 |
|---|---|
| G0 | 고정 확장·합성 repo의 생성/link/재기반/SHA 거부와 trunk CI·승인 차단·정상 병합 확인 |
| G1 | 3단 제출·층별 CI·신뢰 원문·선행 조건 거부·부분 실패 재개가 기존 게이트를 보존 |
| G2 | 최하단 순차 병합, stale 후보 거부, pending/queue/409/timeout, solo 복구·정리 통과 |
| G3 | 17개 스킬과 생성·라우팅·package 소비 경로 대조; 대시보드 실제 3단 제출→리뷰→재기반→develop 통합; 기존 release 비회귀 |

시험 repo에서 같은 head의 A 요청에 새 lower X가 함께 병합된 사실은 보존한다. X 코드는 이미 A의 부모였다.
이는 새 코드 삽입·보호 우회의 증거가 아니다. 최종 검토 후 보호된 새 시험 trunk로 실제 gate를 관찰한다.
G1·G2는 로컬 구현·검토 통과, G3는 스킬·패키지 연결 중이다. 실제 원격 인수·대시보드는 미완료다.
로컬 전용 축소를 적용하지 않고 기존 원격 보호를 보존한다.
소비 repo 수정·실제 회사 인수·운영·DB/Auth/Storage 접근은 포함하지 않는다.

## 공식 근거

- [공식 저장소](https://github.com/github/gh-stack), [확인한 v0.2.1](https://github.com/github/gh-stack/releases/tag/v0.2.1).
- [CLI 명령](https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands), [stack 관리](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/managing-stacked-pull-requests).
- [stack 병합 요구](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests).
- [v0.2.1 비동기 API·sha](https://github.com/github/gh-stack/blob/v0.2.1/docs/src/content/docs/reference/merge-api.md).
- [link의 base 교정](https://github.com/github/gh-stack/blob/v0.2.1/cmd/link.go), [push의 부분 성공 경계](https://github.com/github/gh-stack/blob/v0.2.1/cmd/push.go).

# 공식 계약 기준 최종 설계 검토 — 2026-10-15

상태: **G1·G2 로컬 구현·독립 검토 PASS, G3 연결 중**. 구현 후보 `5d46b7c`, 미발행 1.1.0.
사용자는 공식 사용법 확인 뒤 최종 검토와 문제 해소 시 진행을 요청했다.
공식 원격 stack을 포기해야 할 근거는 확인되지 않았다. 지원 완료 판정은 아직 아니다.

## 정정하는 판단

- 상위 PR의 직접 parent와 정책 대상 trunk는 다르다. 보호는 검증된 trunk에서 읽는다.
- GitHub Actions의 branch 필터는 stack trunk를 기준으로 평가된다. feature 필터를 넓히지 않는다.
  webhook의 `pull_request.base`는 직접 parent이므로 필터와 실행 데이터의 의미를 구분한다.
- 선택 PR과 하단 미병합 PR이 하나의 병합 그룹이다. 현재 그룹 전체에 기존 리뷰·CI 계약을 적용한다.
- 기존 일반 wrapper도 base를 서버에서 원자 고정하지 못한다. G0의 같은 head·구성 변경 관찰을
  GitHub 보호 우회 또는 새 코드 삽입으로 확대했던 해석은 채택 근거로 사용하지 않는다.
- 로컬 전용으로 축소하는 권고는 철회한다. 공식 엔진에 branch·stack 관리를 맡기는 원래 목표를 유지한다.

[최초 G0 결과](../../pilots/gh-stack-compatibility.md)는 당시 frozen-group 중단 조건의 FAIL로 보존한다.
새 평가가 그 결과를 PASS로 바꾸지 않는다. 새 보편 원자성 요구를 추가하지 않고 원래 기존 보호의
보존 여부를 평가한다. 현재 API에 없는 원자적 PR 집합 고정을 제공한다고 설명하지 않는다.

## 실제로 연결해야 할 경계

| 경계 | 현재 코드 | 필요한 변경·검증 |
|---|---|---|
| 보호와 층 diff | pr-merge는 actual base의 protection 조회 | 검증된 trunk 보호와 각 PR의 현재 head 검사를 연결 |
| CI 실행 데이터 | github.base_ref와 payload.base를 서로 다른 용도로 소비 | 실제 관측된 trunk·parent 의미 보존, 신뢰 원본 validator 연결 |
| 로컬 리뷰 | 독립 AI 리뷰·스레드·외부 상태는 PR별 계약 | 현재 병합 그룹 전체 검사·요청 직전 재대조 |
| 단일 PR 요청 | API는 선택 PR 이하의 그룹을 병합 | 이미 상위층이면 거부; 최하단 사전 확인은 원자 보장이 아님 |
| 비동기 결과 | 기존 wrapper는 동기 반환 전제 | UUID·결과 미확인·queue·409·응답 유실 구분, 자동 재요청 금지 |
| solo 복구 | 전체 readback이 정상 경로에 있음 | timeout·신호·실패에도 복구 readback, 미확정 요청 중 후속 예외 차단 |

서버가 확인하는 CI·사람 승인·CODEOWNERS와 Harness 독립 AI 리뷰는 동일한 검사가 아니다.
후자를 서버가 자동 보장한다고 보고하지 않는다. 원격 동시 편집의 잔여 한계는 기존 base 경합과
구분해 기록하며, 관측된 구성 변경은 재검토로 중단한다. 기존 필수 검사를 낮춰 해결하지 않는다.

## 수행한 보호 통합 시험

승인된 `grinvi04/team-harness-acceptance-lab`의 새 `codex/g0-protected-20261015-*` ref만 쓴다.
새 전용 trunk에만 시험 보호를 만들며 기존 branch·main/develop 보호·rulesets·설정을 보존한다.
합성 PR·공식 stack API와 read-only GitHub Actions로 관찰한다. 제품 코드나 운영 배포는 없다.

| 요구·위험 | 행동 | 기대 결과 |
|---|---|---|
| 상위 PR CI | trunk 한정 branch 필터, link 후 이벤트 관찰 | 상위층 run·head와 직접 base/trunk 값을 원문으로 확인 |
| 하위 필수 CI 실패 | lower FAIL, upper PASS 상태에서 upper 병합 요청 | 그룹 미병합·terminal failed, required app/head 증거 보존 |
| 필수 승인 부족 | CI 모두 PASS, 새 trunk 승인1명 정책 | 그룹 미병합·terminal failed |
| 정상 그룹 | 같은 새 trunk의 시험 승인요건만 원래 시험 계획대로 0명으로 변경 | CI·strict·관리자 강제 유지, 해당 그룹만 실제 merged |
| 정리 | 소유 PR·refs·새 보호 제거, before/after 대조 | 기존 모든 branch·보호·rulesets 유지, 소유 잔여0 |

위 다섯 항목은 모두 **PASS**이며 [원문·결과](../../pilots/gh-stack-compatibility.md#공식-보호-계약-재검증--2026-10-15)로 연결한다.
상위 PR의 실제 `stacked` 실행에서 `github.base_ref=trunk`, payload의 base는 직접 parent였다.
별도 검토자가 요약 값 대신 명령·job 원문과 현재 후보를 대조했다. CLI init/link 정상 시험은 반복하지 않았다.
대화형 rerere 활성화 미확인, pending/409/유실/solo 복구는 별도 항목으로 유지한다.
새 보호의 승인 수 변경은 회사나 제품 정책 예외가 아니라 승인된 폐기 시험의 조건 전환이다.
remote 응답이 불명확하면 ref를 보존하고 자동 재요청·삭제하지 않는다.

## 검토 근거와 구현 순서

별도 read-only 인스턴스가 원래 요구·현재 코드·공식 문서·G0 원문을 대조했다.
`g0_probe_review`: 기존 로컬 gate·그룹 범위·solo async를 집중 검토했다.
`g0_source_check`: trunk trigger와 direct-parent payload, commitlint·test-guard 소비자를 확인했다.
실제 권한은 부모와 같으며 OS read-only 강제를 주장하지 않는다.

1. 확인: 보호 시험과 독립 검토로 공식 서버 CI·승인 강제를 확인했다.
2. G1 제출·재기반·trusted CI는 로컬 구현했다. 실제 adapter 원격 시험·trusted 이벤트·스킬 연결이 남았다.
3. G2 async provider·복구·중복 예외 차단은 로컬 구현·독립 검토했다. 실제 원격 반례 실행이 남았다.
4. G3의 17개 스킬·실제 전달과 O1–O5 대시보드를 원래 순서로 잇는다.

새 회사 인수·전역 메타데이터 잠금·다른 엔진 개발을 추가하지 않는다.
fixture PASS는 원격 지원 완료가 아니고, 보호 시험 PASS도 solo 복구·대시보드 완료가 아니다.
정식 PR·병합·릴리즈·설치는 기존 Git Flow와 각 단계 승인·검증을 유지한다.

## G1 제출 경계 최종 검토

현재 구현 범위는 `repo-policy`, `stack-policy/stack`, `pr-create`, raw mutation guard다.
아래 문제를 독립 검토·공식 원문·실제 binary 관측으로 확인해 수정했다. 모두 미발행 로컬 후보의 결과다.

| 반례·계약 불일치 | 현재 수정 | 확인 경계 |
|---|---|---|
| GH_REPO/GH_HOST로 실제 PR 대상이 달라짐 | 검증된 origin repo·host를 실제 gh 호출에 결박 | 거부/정상 생성 회귀 |
| 별도 pushurl로 다른 repo에 전송 | 하나의 동일 repo push URL만 허용 | 다른 bare repo에 ref 미생성 |
| native push의 fetch가 새 writer SHA를 lease로 채택 | 최초 OID lease·source commit·full ref·atomic push | 신규/기존 ref 경합 보존, 다른 층 미변경 |
| checkout 후 본문 파일이 달라짐 | preview한 본문을 메모리에 보관해 검사·stdin에 전달 | A/B의 다른 tracked 본문으로 재현·수정 |
| 시험 대역의 version 문자열이 실제와 다름 | 실제 `gh stack version 0.2.1` 계약 사용 | pinned binary 원문 관측·회귀 |
| view.head 캐시를 현재 HEAD로 간주 | 실제 Git OID와 ancestry를 검사 | native rebase 후 commit/view 차이·정상 제출 회귀 |

검사 디렉터리는 별도 `stack-dashboard/team-harness` worktree다. 원문은 `.runtime/gh-stack-g0/`에 보존한다.

| 검사 | 결과·범위 |
|---|---|
| `node --test tests/stack-cli-test.mjs tests/stack-workflow-test.mjs tests/pr-base-selection-test.mjs` | 78/78 PASS; `g1-current-final-suite.log` |
| `bash tests/guard-test.sh` | 191 PASS/0 FAIL; `g1-guard-green.log` |
| `bash tests/pr-create-test.sh` | 9 PASS/0 FAIL·Q2A40; `g1-pr-create-regression.log` |
| 실제 v0.2.1 init/add/rebase/commit/view | PASS; `native-view-result.json`; 시험 binary/repo 정리 |
| 독립 현재 원문 검토 | PASS_SCOPE; 사전 SHA/본문 고정·version/cache 수정 확인 |
| 소유 Markdown356개·변경 스크립트 구문·JSON·diff | PASS; `g1-owned-markdown-check.log`; 두 manifest·README1.1.0 일치 |

writer/body 2개 RED→GREEN, cache·version RED와 원문을 보존한다. 기존-ref 시험의 첫 fixture는
재기반 divergence로 writer 실행 전에 거부됐다. FF-compatible 후보로 고쳐 경합 경계를 실제 실행했다.
native 관측의 최초 asset/signed hash 혼동·초기 빈 cache 가정·fixture binary dirty 실패도 attempt1–3에 보존했다.
첫 전체 경로 문서 검사는 조사용 upstream 사본과 잘못된 대문자 anchor를 잡았다. anchor 수정 후 Git 소유·신규 문서 전체를 검사했다.
시험용 push 경합은 실제 bare Git이며 upstream fetch 순서만 모사했다. 실제 원격 adapter 전체 시험은 아니다.
본문은 같은 입력을 넘기되 기존 Bash wrapper의 끝 개행 정규화는 유지한다. byte 완전 동일을 주장하지 않는다.

**남은 필수 작업:** 실제 adapter 원격3층·trusted 이벤트·G2 async/solo, package·실제 전달,
O1–O5 대시보드. 전체 quality·현재 후보 package·원격 전달·릴리즈·설치는 이번 제출 경계 판정에 포함하지 않는다.

## G1 재기반·신뢰 검사 후속 검증

공식 local rebase만 호출하고 원래 remote OID의 atomic push를 사용한다. 충돌은 native continue/abort 후
journal을 재개하며 새 remote writer·미확인 부분 전송은 자동 덮어쓰기나 재요청 없이 중단한다.
독립 검토에서 native가 미리보기에 없던 local-ahead trunk를 사용할 수 있음을 발견했다.
local trunk OID를 fingerprint에 포함하고 sync 전 ancestor·후 exact remote OID를 검사해 RED2→GREEN2로 수정했다.

| 검사 | 결과·범위 |
|---|---|
| 재기반·경합·복구 회귀 | `g1-restack-suite.log` 85/85 PASS; local-trunk 수정 전 후보 |
| local trunk 반례 | `g1-local-trunk-{red,green}.log`: 2FAIL→2/2 PASS |
| 실제 pinned v0.2.1 + adapter | `g1-native-local-1/result.json`: 3층 restack·충돌 abort·continue/resume 3/3 PASS |
| 직접 parent trusted CI | `g1-ci-testguard-green.log` 11/11, `g1-ci-commit-final.log` PASS |
| trusted 문서 경계 | `g1-trusted-docs-{red,green}.log`: 2FAIL→27/27 PASS |
| 생성 사본 | `g1-repository-config.log` PASS; 자체 addon만 연결, 소비 템플릿 보존 |
| 독립 고정 후보 검토 | local trunk·CI 8개 원문 PASS_SCOPE; 원격 실행 제외 |

실제 native 시험은 Git·bare remote·공식 binary를 실행했고 GitHub REST만 대역이다. 임시 binary·repo는 제거했다.
CI 시험은 추출한 trusted shell과 Git 객체를 실행했다. 실제 `pull_request_target` stacked 관측은 아직 미확인이다.
첫 CI 시험 준비의 Python 구문 오류 뒤 실행된 기존 시험 로그는 RED로 세지 않는다. 이후 실제 반례 RED는 별도 보존했다.

## G2 async·solo 및 G3 연결 검증

실행 경로는 기존 `pr-merge/solo-merge` → `stack-merge-cli` → provider/journal이다. 일반 PR provider는 유지한다.
선택 PR이 현재 최하단인지 확인하고 기존 필수 CI·스레드·후보 검사를 통과한 SHA로만 async 요청한다.
보호 원값·요청 전 intent를 Git common-dir에 먼저 저장한다. 모르는 결과에는 새 PUT을 하지 않는다.
solo는 effective rules의 queue를 사전 거부하고, 신호·실패에서도 소유 child 종료 후 전체 정책을 복구·재조회한다.

| 검사·발견 | 결과·경계 |
|---|---|
| provider·journal·실제 Bash/Node wrapper 통합 | `g2-integrated-green.log` 68/68 PASS; 원격 API는 대역 |
| 기존 수동/자동 병합 | `g2-pr-regression-final.log` 70 PASS/0 FAIL |
| 기존 solo 및 queue 사전 차단 | `g2-solo-regression-final.log` 93 PASS/0 FAIL |
| 독립 검토의 host 혼용 반례 | GH_HOST가 다른 서버의 green을 빌려 github.com에 쓰는 경로를 사전 거부하도록 수정 |
| 응답 유실 후 UUID 없음 | 원래 PR의 실제 MERGED·head·merge SHA·trunk 포함을 GET으로 확인하면 해제 가능 |
| queue 응답·대기 상한 | UUID 없는 enqueued도 재조회, deadline 이후 마지막 GET 시작 금지 |
| fixed-candidate 독립 검토 | 5개 G2 원문 PASS_SCOPE; live 원격·다른 clone·SIGKILL은 제외 |
| G3 의미 검토 | shared17개·라우터·catalog PASS_SCOPE; 기능 추가/하단 수정/재개/단일 PR/전체 stack/진단 범위 대조 |

provider RED28·journal RED17·복구 RED3·host/유실/deadline RED5를 원문에 보존했다.
wrapper 시험의 첫1ms 제한은 fixture 준비 전에 종료되어 1000ms로 교정했다. remote timeout 성공 증거로 세지 않는다.
기존 fake gh의 옵션 parser 불일치(pr4·solo18 FAIL)는 GET 호출 형식을 교정하고 사후 복구 조회 단언을 강화했다.
잠금은 같은 Git common-dir 범위다. 다른 clone·관리자의 동시 변경 또는 원자적 stack 구성 고정을 보장하지 않는다.
현재 github.com만 지원하며 다른 GH_HOST는 쓰기 전에 거부한다. 실제 GitHub pending/409/유실·solo 복구는 미확인이다.
package catalog의 파일 포함·문서 검토는 packaged 실행이나 실제 native 사용자 행동의 증명이 아니다.

G3 후속: `5d46b7c`의 분리 core 패키지에서 실제 native binary·Git을 실행해 restack·abort·continue/resume
3/3 PASS를 확인했다(`g3-packaged-native-1/result.json`). REST는 대역이며 시험 환경을 정리했다.
G3 통합55 PASS에는 signal 시 provider 종료 전 보호 PATCH를 거부하는 순서 단언이 포함된다.
전체 quality의 첫 실행은7단계에서 옛 workflow hash와 새 이벤트 구독의 충돌로 FAIL했다.
exact `stacked` 구독 한 줄을 별도 단언하고 나머지 바이트는 기존 hash로 보존한다. 수정 후 생성 회귀 PASS.
첫 커밋은 도구 workdir 미인식 가드와 메시지 본문 형식에 막혔다. 명시 `git -C`와 규약 본문으로
재실행해 secret scan·commit-msg를 통과했다. 가드·훅 예외를 사용하지 않았다. 전체 품질 후속 실행은 진행 중이다.

## 공식 원본

- [보호·CI의 trunk 의미](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests)
- [연속 그룹 병합](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests)
- [v0.2.1 webhook](https://github.com/github/gh-stack/blob/v0.2.1/docs/src/content/docs/reference/webhooks.md)
- [v0.2.1 async merge API](https://github.com/github/gh-stack/blob/v0.2.1/docs/src/content/docs/reference/merge-api.md)
- [push 내부 fetch](https://github.com/github/gh-stack/blob/v0.2.1/cmd/push.go#L103-L108), [tracking OID lease](https://github.com/github/gh-stack/blob/v0.2.1/internal/git/gitops.go#L257-L289)
- [local rebase](https://github.com/github/gh-stack/blob/v0.2.1/cmd/rebase.go#L310-L338), [sync 옵션](https://github.com/github/gh-stack/blob/v0.2.1/cmd/sync.go#L72-L73)

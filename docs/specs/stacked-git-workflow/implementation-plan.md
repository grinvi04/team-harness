# 공식 gh-stack 연결 구현 계획

> 실행자: `superpowers:executing-plans`로 순차 구현하고 고위험 전달 경계는 별도 독립 검토한다.
> 최초 frozen-group G0 FAIL은 [원래 결과](../../pilots/gh-stack-compatibility.md)에 보존한다.
> [최종 검토](final-review.md)에 따라 보호 통합 시험·G1 제출·재기반·trusted CI 로컬 검사·독립 검토를 통과했다. G1·G2는 로컬 구현·독립 검토 통과, G3는 연결 중이다. 실제 원격 인수·package 실행은 남았다.

**Goal:** 공식 gh-stack의 branch/PR 관리를 기존 Harness gate와 Git Flow에 연결한다.
**Architecture:** 공식 엔진 + 얇은 stack 사전/사후 검사 + 기존 PR gate + SHA가 결박된 async provider.
기존 일반 PR provider와 release 경로를 유지하며 새 engine·보호 체계를 복제하지 않는다.
**Tech Stack:** GitHub CLI extension v0.2.1 검증 출발점, Bash, Node ESM, 기존 GitHub Actions.
**Spec:** [stacked Git 설계·G0–G3](../stacked-git-workflow.md).

## 공통 제약

- `branchFlow=git-flow`이면 trunk=develop. protected branch force push와 일반 PR base 면제는 금지다.
- opt-in 전 기존 PR 경로는 동일하다. auto-merge는 linked stack에서 지원하지 않음을 명시한다.
- source head·actual base·stack root·최하단·trusted policy SHA를 다른 값으로 다룬다.
- 기존 필수 CI·리뷰·보호가 유지되지 않으면 지원 완료로 판정하지 않는다. 원자적 metadata 고정은 주장하지 않는다.
- gh-stack v0.2.1 격리 시험 후 제거했다. 전역 확장 원상태를 확인했으며 자동 upgrade·skill·alias 설치는 하지 않는다.
- native push/sync의 내부 fetch가 사전 lease를 바꾸지 않게 공식 local rebase와 표준 Git atomic 전송을 분리한다.
- 코드 변경 시 현재 원격 버전을 기준으로 MINOR 후보와 양 manifest·README·CHANGELOG 계약을 적용한다.
- 새 API/경로는 계획이며 각 task는 RED→최소 구현→기존 회귀→문서→규약 커밋으로 진행한다.
- 스킬 적용 범위는 [17개 연결표](../stacked-git-workflow.md#기존-스킬-17개의-연결-범위)를 따른다.
  T1/T2에서 해당 공통 계약·스킬도 함께 갱신하고 T3에서 전체 연결을 검수한다. 실제 사용 이후로 미루지 않는다.

## 집중 검토할 반례

1. 숫자 이름 branch가 PR 번호보다 먼저 해석되어 push됨 — T1 URL-only 시험.
2. 사전 검사 후 stack 구성·base가 바뀌어 검토 안 한 PR이 함께 병합됨 — T0/T2.
3. link/sync가 exit0이지만 base나 실제 원격 구성이 다름 — T1 readback 시험.
4. async timeout 뒤 늦게 병합되거나 보호 복구가 실패함 — T0/T2 solo 시험.
5. trusted validator가 후보 helper·설정을 다시 읽어 자기 검사를 무력화함 — T1 CI 시험.

## 파일 책임과 인터페이스

제품 코드는 `plugins/harness-guard/scripts/` 아래에 둔다.

| 파일 | 책임·제안 API |
|---|---|
| 신규 `stack-policy.mjs` | `validateStack(snapshot,policy) → {allowed,violations}`; 순수 구조·정책 검증 |
| 신규 `stack.mjs`, `stack.sh` | CLI `inspect/submit/restack/sync`; 공식 엔진 호출·계획·효과·사후 대조 |
| 신규 `stack-merge.mjs` | `observeMerge(...) → snapshot`, `executeMerge(...) → MergeResult`; CLI·journal 분리 |
| 기존 `repo-policy.mjs`, `pr-create.sh` | opt-in parse, stack-context 재검증, 명시 층별 body-file·draft |
| 기존 `pr-merge.sh`, `solo-merge.sh` | 기존 gate 다음 provider 분기, pending·복구·정리 결과 구분 |
| 기존 `guard.sh` | 직접 stack mutation을 Harness 경로로 안내; 기존 허용/거부 보존 |

`snapshot={repo,trunk,trunkOid,layers,worktrees,remoteStack}`;
각 layer는 `{branch,parent,headOid,remoteOid,prUrl|null,draft,merged}`다.
`MergeResult={state,requestId|null,expectedHead,mergeSha|null,reasonCode}`이며 state는
`merged|pending|enqueued|failed|unverified`; exit0만으로 merged를 만들지 않는다.
효과 journal은 Git common-dir 아래 Harness 전용 파일이며 공식 gh-stack metadata를 직접 편집하지 않는다.
journal은 예정/실행/확인 ref·PR·UUID와 solo의 전체 보호 원값을 저장한다. 재개는 현재 원본과 대조하며 자동 롤백 권한이 아니다.

## T0 — 공식 기능 채택 시험 (G0)

작성: `tests/acceptance/gh-stack-{compatibility,remote}.mjs`; 보고서 `docs/pilots/gh-stack-compatibility.md`.
기존 fixture runner/evidence를 재사용한다. 설치·원격 시험은 정확한 대상·cleanup 범위 확인 후 수행한다.

- [x] 현재 gh/Git·확장 가용성·정확한 release SHA/버전과 기존 설정을 기록한다.
  설치 명령은 `gh extension install github/gh-stack --pin v0.2.1`; 기존 확장이 있으면 임의 교체하지 않는다.
- [ ] disposable clone과 합성3층으로 init/add/rebase/abort, 여러 worktree, rerere 변경·복구를 확인한다.
  로컬5개 PASS. 대화형 rerere 활성화는 PTY timeout으로 UNVERIFIED이며 완료로 세지 않는다.
- [x] 승인된 시험 repo에서 PR URL link, wrong SHA 거부, 최하단 병합·서버 retarget, request UUID를 관측한다.
- [ ] 요청 직전 lower PR 추가/base 변경, 409 다른 옵션, 응답 유실, 지연 병합·복구를 반증 시험한다.
  위험 사례는 합성 branch에서만 수행하고 운영·소비 repo·기존 보호는 건드리지 않는다.
  요청 전 구성/base 변경으로 검토 목록 밖 X 병합을 재현했다. 나머지 항목은 중단 조건 충족 후 미실행이다.
- [x] 로컬·원격 명령을 분리하고 stdout·원격 before/after·보호 원값·최초 실패·후속 정리를 보존했다.
  실제 CLI 인자는 보고서 JSON의 명령을 따른다. 원격 runner는 승인된 합성 lab·새 prefix만 받는다.
- [x] 최초 **NO-GO** 관찰·정리를 보존했다. 이후 공식 계약 최종 검토에서 native 원격 포기 권고를 철회했다.
- [x] `gh-stack-protected.mjs`로 새 전용 trunk의 상위 CI·하위 실패·승인 부족 거부와 정상 병합을 관찰했다.
  실제 응답·head·job 로그·전후 정책을 독립 검토했다. 원문 digest는 결과 JSON에 보존한다.
  solo pending·복구는 T2에서 실제 지원 판정 전에 확인하며 미확인일 때 지원 완료로 처리하지 않는다.

## T1 — 안전한 제출·restack·CI (G1)

파일: 위 stack-policy/stack, repo-policy/pr-create/guard; 신규 `tests/stack-workflow-test.mjs`.
연결: `skills/ao-coordinate/project-contract.md`, 작업 시작·수정·재개 및 pr-create 스킬,
`scripts/route-intent.mjs`와 기존 route-intent 시험. 라우터는 짧은 요청 안내 범위를 유지한다.
CI 정본: `templates/ci/common/workflow.yml`, `templates/ci/commitlint.yml` 및 feature-base 소비 workflow.
자체 `.github/workflows/ci-gate.yml`과 생성 배치 사본을 함께 연결한다.

- [x] `unregisteredParentRejected`, `protectedRefRejected`, `staleRemoteRejected`, `dirtyOwnerPreserved`,
  `numericBranchNotPushed`, `foreignPrUrlRejected`, `linkWarningIsNotSuccess` 테스트를 먼저 작성한다.
- [x] `node --test tests/stack-workflow-test.mjs tests/pr-base-selection-test.mjs`로 RED를 확인한다.
- [ ] opt-in·현재 모든 층·소유 worktree·PR 본문을 먼저 검사하고 검증 문맥을 PR wrapper에서 재조회한다.
- [ ] 기존 wrapper로 층별 PR을 만들고 동일 repo의 완전한 PR URL만 공식 link에 전달한다.
  기존 stack 구성/순서가 다르면 link 전에 거부한다. 상위 PR은 draft이며 각 층 body-file을 유지한다.
  opt-in·preflight·submit·restack/sync와 충돌 재개를 로컬 구현했다. 공식 binary+adapter 3사례 PASS. 실제 adapter의 원격 3층 실행은 아직 미실행이다.
- [ ] restack/sync는 변경 ref·예상 OID·worktree 전체를 보여주고 공식 engine을 호출한다.
  부분 성공·중단·다른 소유자의 remote push·noninteractive divergence를 readback으로 판정한다.
  공식 local rebase 후 최초 관찰 OID의 atomic push를 사용한다. native sync/push에는 expected OID 입력이 없다.
  통합 로컬87개 PASS. 실제 adapter 원격 시험 전까지 G1 전체 완료로 세지 않는다.
- [ ] raw submit/link/merge/sync/push/modify/unstack를 guard로 래퍼 유도한다.
  init/add/navigation의 실제 checkout·rerere 효과도 안내한다. shell alias로 보호를 우회하지 않는다.
  raw 7종 유도와 기존 guard 회귀191개 PASS. 전체 스킬 안내·후속 restack/sync 스킬은 G3에서 연결했고 실제 실행은 남았다.
- [ ] trunk branch 필터를 유지하고 직접 parent payload·정책 trunk·trusted SHA를 분리한다. validator/helper/config는 같은
  protected SHA에서 읽고 후보 코드는 비밀정보 없는 job에서 실행한다. `stacked` 가입 이벤트·재실행을 관찰해 연결한다.
  commitlint는 policy branch와 layer commit 범위를 구분하며 test-guard는 직접 parent SHA를 비교한다.
  자체 commitlint-trusted job에 protected 문서 checker를 연결했다. 로컬 회귀 PASS, 실제 trusted 이벤트는 미확인이다.
- [ ] candidate helper 변조·상위 CI 미실행·잘못된 parent·policy 미선언 거부와 기존 일반 PR PASS를 확인한다.
- [x] parent 커밋만 있는 child의 고유 변경 0을 완료 작업으로 세지 않고 미보호 parent의 404를 solo로
  안내하지 않는 회귀를 추가한다. 관계 조회 실패는 추측하지 않으며 안내와 실행 승인을 구분한다.
- [x] `node scripts/sync-repository-config.mjs --write`, `node scripts/generate-stack-templates.mjs --write`
  후 `--check`와 기존 생성 회귀를 실행한다. 현재 회사 소비 repo에 CI를 자동 적용하지 않는다.
- [ ] `docs/{company-policy,code-review,decisions}.md`를 실제 구현과 맞추고 규약대로 커밋한다.

## T2 — 순차 async 병합·solo·정리 (G2)

파일: stack-merge/pr-merge/solo-merge; 신규 `tests/stack-merge-test.mjs`와 기존 `tests/solo-merge-test.sh`.
연결: 리뷰·feature/solo 병합·검증 스킬의 현재 후보와 비동기 결과 계약을 함께 갱신한다.
T1 snapshot을 소비하지만 merge 직전 다시 조회한다. 기존 CI/review checker를 복제하지 않고 호출한다.

- [x] `notLowestRejected`, `wrongActualBaseRejected`, `staleHeadRejected`, `changedCompositionRejected`,
  `queuedIsNotMerged`, `conflicting409Stops`, `timeoutRetainsRequest`, `restoreMismatchBlocks`를 잠근다.
- [x] `node --test tests/stack-merge-test.mjs`의 의미 있는 RED를 확인한다.
- [x] 현재 병합 그룹 모든 PR의 required CI·스레드·리뷰·외부 상태와 trunk 통합 후보를 검토한다.
  한 층씩이 기본이다. 직전 그룹·head/base·trunk를 재조회하며 단일 PR 요청이 이미 상위층이면 거부한다.
  변경이 없을 때 selected head sha로 요청한다. 재조회는 원자적 metadata 고정이 아니다.
- [x] pending UUID를 보존하고 기본5초 간격·총30초의 bounded poll을 구현한다.
  409의 다른 head/method/action, 404·유실·모르는 status는 unverified로 중단하고 자동 재요청하지 않는다.
- [x] stack `--auto`는 명확히 거부한다. queue는 enqueued로 보고하고 실제 병합 전 release/cleanup을 막는다.
- [x] solo는 기존 자격과 승인된 예외 범위를 유지한다. queue를 DELETE 전에 거부하고 모든 종료에서
  보호 원값 복구·readback을 수행한다. pending/미확인 요청이 있으면 같은 base의 다음 예외를 거부한다.
- [x] branch 삭제는 하위 의존 PR·worktree가 없고 원격 병합 확인 후만 한다. 서버 retarget/rebase 후
  child의 기존 증거를 무효화하고 새 후보를 검증한다. 임의 `sync --prune`를 사용하지 않는다.
- [ ] 새 시험과 기존 pr-merge-auto·solo-merge·guard·보호 보존 회귀, T0 live 반례를 실행한다.
- [ ] 권한·동시 구성 변경·SIGKILL 한계를 문서에 남기고 독립 검토 후 규약대로 커밋한다.

## T3 — workflow 연결·실제 사용 (G3)

검수: shared `skills/*/SKILL.md` 전체 17개와 공통 계약. 앞 단계 변경을 재사용하고 연결표의 남은 영향을 수정한다.
소비 원문: `codex/native-runtime.md`, `scripts/generate-codex-skills.mjs`,
`experiments/split-packaging/packages.json`; generator는 실제 필요할 때만 바꾸고 생성 wrapper는 직접 편집하지 않는다.
안내: `docs/guides/{solo-development,team-development}.md`, `docs/{developer-workflow,harness-maintenance}.md`.
신규 사용 정본: `docs/guides/stacked-development.md`. 사용 예시는 여기에만 쓰고 기존 가이드는 연결한다.

- [x] 17개 각각에 변경 또는 공통 계약으로 충족한 근거·직접 소비 경로를 기록한다. 신규 방법론을 중복 도입하지 않는다.
- [x] shared frontmatter와 native runtime의 공통/스킬별 앵커를 유지하고 Codex wrapper를 재생성한다.
  trigger의 기존 사용/제외 경계를 유지한다. 단어·링크 검사는 자연어 의미 검증을 대신하지 않는다.
- [ ] 일반1PR·의존3PR·독립2stack·main-flow 소비 fixture에 대해 올바른 trunk/승인/정리 경로를 확인한다.
- [x] 요청 사례로 “기능 추가”, “아래 층 수정”, “중단된 작업 재개”, “이 PR만 병합”, “전체 stack 진행”을
  소스·문서 독립 검토로 대조했다(실제 agent 행동은 미확인). 제출/병합 대상 확대·활성 writer 재기반·진단/QA만 요청했는데 Git 쓰기 수행을 거부해야 한다.
- [ ] milestone의 간접 PR 생성과 workflow→core runtime binding도 adapter를 거친다. 새 helper를 package에
  포함하고 packaged artifact에서 실제 경로를 실행한다. source tree에서만 성공하면 미완료다.
- [ ] 아래 기존 생성·발견·라우팅·package 검사에 영향 회귀를 연결한다. 실제 사용 증거와 구분한다.
- [ ] 새 연결 자체는 기존 Git Flow로 develop에 통합한 뒤 대시보드 3층에서 실제 stack 제출·수정·병합을 수행한다.
- [ ] 원격 actual base/head·CI·리뷰·병합 SHA·보호 원값, 설치 확장 버전과 효과 journal을 기록한다.
- [ ] 대시보드 stack 종료 후에만 release/main을 시작하는 순서와 기존 hotfix/backmerge 비회귀를 확인한다.
- [ ] 전체 quality·package/bundle·독립 검토를 통과하고 G0–G3 실제 판정을 보고한다.

T3 관련 기존 검사(구현 시 실행, 이번 설계 보완에서는 미실행):

```bash
node scripts/generate-codex-skills.mjs --write
node scripts/generate-codex-skills.mjs --check
node --test tests/codex-skill-generation-test.mjs tests/route-intent-scope.test.mjs
bash tests/codex-skill-mapping-test.sh
bash tests/skill-trigger-contract-test.sh
bash tests/skill-discovery-test.sh
bash tests/route-intent-test.sh
node --test tests/skill-contract-consolidation-test.mjs
bash tests/package-build-test.sh
bash tests/package-artifact-integrity-test.sh
bash tests/package-catalog-integrity-test.sh
bash tests/package-workflow-binding-test.sh
```

## 종료·전달 경계

G0–G3 완료가 공식 stack 연결의 인수다. 예시 문서·fixture만으로 실제 원격 인수를 대체하지 않는다.
설치/원격 효과가 필요하면 이미 승인된 범위와 정확한 대상을 먼저 대조하고 부족한 범위만 확인한다.
정식 릴리즈·태그·플러그인 갱신은 기존 release-check/release 절차이며 이번 계획의 실행 사실로 기록하지 않는다.

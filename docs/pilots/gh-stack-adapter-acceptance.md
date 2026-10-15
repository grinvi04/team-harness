# gh-stack adapter 실제 원격 인수

2026-10-15. 미발행 1.1.0의 G1–G3 실행 기록이다. **부분 검증**이며 대시보드·정식 릴리즈 완료가 아니다.
설계·종료 기준은 [stack 설계](../specs/stacked-git-workflow.md), 이전 실패는
[공식 계약 검토](../specs/stacked-git-workflow/final-review.md)에 보존한다.

## 대상과 보존 경계

승인된 공개 합성 저장소 `grinvi04/team-harness-acceptance-lab`만 사용했다.
공식 gh-stack v0.2.1의 격리 binary와 실제 Git·GitHub API·Actions를 실행했다. 전역 확장은 설치하지 않았다.
기존 company 정책·main/develop 보호·rulesets, 잠금 제품 검사를 유지했다. 운영 시스템은 없다.
원문은 작업 worktree의 `.runtime/gh-stack-g0/`에 있으며 아래 경로는 그 디렉터리 기준이다.

## 실제 확인한 결과

| 경계 | 후보·원문 | 판정 |
|---|---|---|
| trusted 검사 준비 | lab PR29→develop `b5cdbf5`, PR30→main `acf16f2`, v0.2.2, PR31→develop `c87ad38` | PASS; 순차 Git Flow, 기존 보호 보존 |
| 3층 제출 | Harness `a24459f`; `adapter-live-2/state.json`; lab PR32/33/34 | PASS; 실제 adapter→wrapper→공식 link→readback |
| 하단 수정·재기반 | `adapter-live-2/restack-result.json` | PASS; 공식 rebase와 관찰 OID의 atomic push |
| 상위층 trusted 실행 | Actions run38730331919, `actual-stacked-upper-commitlint.log` | PASS; stacked 이벤트, protected main의 validator·직접 parent 범위 |
| 응답 유실·재개 | PR32 head `9a7d837`, merge `00bf77b`; `adapter-live-2/lost-reply-32.json`, `adapter-live-2-resume-a.log` | PASS; 실제 PUT 응답만 숨긴 뒤 GET으로 MERGED 복구 |
| 후보 검사기 변조·무효 커밋 | Harness `f15e45c`; `trusted-negative-1/summary.json` | PASS; PR36 예상 FAIL, PR37의 고유 정상 커밋 PASS |
| 음성 시험 정리 | `trusted-negative-1/final-audit.json` | PASS; PR36/37 닫기·소유 ref lease 삭제·기존 보호 불변 |
| 서버 재기반 수신 | Harness `9111758`; `adapter-live-3/sync-invariants.json`, `sync-c-invariants.json` | PASS; 실제 B/C 연속 수신·tree·고유 커밋·recovery ref 보존 |
| 후속 순차 병합 | PR33 `f3551df` → PR34 `135ead3`; `adapter-live-3/{merge-b,merge-c}.json` | PASS; 현재 후보 리뷰·required CI·실제 trunk 포함 |
| 정상 pending 조회 | `adapter-live-3/gh-commands.jsonl` | PASS; PR33/34 각각 PUT1회·반환 UUID GET 후 MERGED |
| 원격 보존 대조 | `adapter-live-3/final-remote-audit.json` | PASS; 기존 보호5개·rulesets·main 등 원래 비develop ref 불변, 소유 원격 ref 없음 |

lab v0.2.2는 합성 시험 저장소 버전이며 Harness 1.1.0 발행이 아니다.
PR32의 실제 pending UUID를 수신했지만 전달을 숨겼으므로 이 시험은 provider의 UUID polling 성공을 증명하지 않는다.
무효 커밋 시험은 [하단 run](https://github.com/grinvi04/team-harness-acceptance-lab/actions/runs/38731033258)과
[상단 run](https://github.com/grinvi04/team-harness-acceptance-lab/actions/runs/38731033269)의 실제 job 로그로 대조했다.
두 job 모두 main `acf16f2`에서 validator hash `0e16c0b6d7ebfd88bf48bcc952726149f0c00e3a136ac8dffcdff9653475cb61`을 실행했다.
후보의 다른 검사기 hash는 신뢰 원본으로 사용되지 않았다. 하단 test-guard도 검사기 삭제를 거부했다.

## 실제 실행에서 발견한 retained prefix 결함

PR32 병합 뒤 GitHub는 stack 목록에서 PR32를 지우지 않고 `[merged32, open33, open34]`와 원래 순서를 유지했다.
`adapter-live-2/stack-after-a.json`, 개별 PR JSON과 `probe-b-after-a.log`에서 기존 provider가
이전 PR도 open이어야 한다며 다음 층을 차단하는 결함을 확인했다.

수정은 전체 멤버의 동일 repo·identity·순서 검사를 보존하고, 확인된 연속 merged prefix 뒤의 첫 active PR만
병합 후보로 선택한다. sync도 원래 position/size를 검증한다. closed-unmerged·중간 merged·foreign 멤버는 계속 거부한다.
기존 lease·재기반 문맥·증거 무효화 규칙은 유지한다. CLI 대역의 잘못된 멤버 삭제·재번호화도 실제 API에 맞췄다.

- `retained-prefix-red.log`: 정상 prefix 수용 2개가 기존 구현에서 FAIL.
- `retained-prefix-focused.log`: 수정 후 순수 계약 73/73 PASS.
- `retained-prefix-green.log`: 통합 113/114 PASS; 나머지 1개는 잘못된 CLI 대역 형상으로 FAIL.
- `retained-prefix-cli-green.log`: 대역 교정 후 해당 실제 Git sync 시험 1/1 PASS. 나머지 검사는 입력 불변이다.
- `retained-prefix-independent-review.log`: 실제 read-only Codex/Astra medium 검토에서 추가 회귀 미발견;
  순수 계약 73개 재확인. sandbox상 CLI·원격 실행은 검토자가 수행하지 않았으며 별도 증거와 구분한다.

## 서버 재기반 뒤 로컬 수신 검증

다음 실제 sync preview는 B/C의 local·remote divergence 때문에 변경 전에 거부됐다.
`adapter-live-3/b-inspect.json`과 이전 confirmed restack journal을 대조하면 로컬은 전송된 그대로이고,
원격은 PR32 병합 뒤 재작성됐다. 공식 local rebase의 원격 반영은 FF만 지원하며 같은 구성의
native sync도 이 원격 tip을 채택하지 않는다. [설계의 수신 경계](../specs/stacked-git-workflow.md#제출ci-신뢰-경계)를
독립 검토 뒤 아래 회귀 검사와 실제 원격 수신을 통과했다. 최초 거부 기록도 보존한다.

기존 confirmed 기록의 동일 repo·root·trunk·PR·local=remote OID와 digest를 연결해 수신할 층을 정했다.
새 journal을 먼저 기록하고 옛 OID recovery ref 생성과 local branch CAS를 하나의 transaction으로 묶는다.
서버 tip 수신 후 공식 local rebase를 실행하며 remote 전송은 최초 lease를 유지한다.

- `sync-adoption-red.log`: 구현 전 4개 중 기대 수신·preview 2개 FAIL, 기존 거부 2개 PASS.
- `sync-adoption-green-1.log`: 4개 PASS; 서버 고유 내용·옛 로컬 OID 보존, 미발행·미확정·stale 거부.
- `sync-adoption-boundaries.log`, `sync-adoption-proof.log`: 추가 5개 PASS; dirty·CAS 경합·checkout 중단·
  원격 writer·증거 변경을 검사했다. 실제 Git 객체/ref를 쓰지만 REST와 native metadata는 대역이다.
- `sync-adoption-independent-review.log`: 실제 read-only Codex/Astra가 push 없는 confirmed 수신 뒤
  다음 서버 재작성을 받을 수 없는 결함을 지적했다. `sync-successive-adoption-red.log`에서 재현했다.
- `sync-successive-adoption-green.log`: 중간 수정의 연속 수신 1개 PASS. 최종 구현 증거와 구분한다.
- `sync-adoption-independent-review-2.log`: 응답 유실 후 확정된 전송·일반 FF 수신도 다음 재작성을
  받지 못하는 결함 발견. `sync-readback-proof-red.log`에서 2개 FAIL로 재현했다.
- 최종 기준은 명령 반환 여부가 아니라 confirmed journal의 실제 사후 local/remote OID 일치다.
  재귀 증거 사슬을 추가하지 않으며 미확정 효과와 미발행 로컬 후보는 계속 거부한다.
- `sync-adoption-final-suite.log`: CLI·정책·merge 110/110 PASS, skip 0, exit 0.
- `sync-adoption-independent-review-3.log`: 실제 read-only Codex/Astra medium에서 추가 결함 미발견.
  구문·정책 31개 PASS이며 Git 쓰기·원격 검증은 포함하지 않는다.

초기 `sync-adoption-preview.json`은 계획이다. 실제 실행은 `sync-preview-final.json`→`sync-applied-final.json`,
PR33 병합 뒤 `sync-c-preview.json`→`sync-c-applied.json`으로 각각 기록했다.
두 번째 수신은 첫 confirmed 수신 기록을 근거로 삼았으며 새 source 후보는 `source-final.json`에 고정했다.
`review-b.log`·`review-c.log`는 각 새 후보의 실제 read-only Codex/Astra medium 리뷰이며 추가 결함 미발견이다.
각 후보의 합성 제품 검사4개·build·임시 HTTP health도 PASS, 시험 서버 정리를 확인했다.
PR33/34의 UUID는 각각 `1fed1877-083e-4e85-b812-58fa974838c2`, `93692bcd-b54e-4398-aaf2-a46d25f39c5b`다.
PR32의 이전 응답 유실 시험도 기존 명령 로그에서 PUT1회임을 대조했다. 재개는 새 PUT을 보내지 않았다.

## 아직 필요한 확인

실제 solo 보호 복구, 미관측409·queue 경계, 정식 release-check와 G3 전달·O1–O5 대시보드는 남았다.
소스 변경 뒤 기존 frozen runner의 hash나 journal을 고쳐 재사용하지 않는다. 이전 실행은 보존하고 새 후보로 이어 기록한다.
실제 solo 시험은 2026-10-16 승인된 새 전용 lab에서 진행 중이며 아래 관측을 따른다.
Claude 실호스트 미확인 보류와 실제 사람·회사 고유 정책 인수의 제외 범위는 그대로다.

## 자체 trusted CI 전달 의존성

Harness 기본 main `d273a70`에는 stacked 이벤트가 없고 develop 필수 항목은 기존5개다.
`ci-bootstrap-remote-source.json`에서 현재 원본을 확인했다. 기본 브랜치 실행은
[GitHub 공식 계약](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target)이다.
develop 통합만으로 대시보드 stack의 trusted 검사기가 준비된다는 기존 계획은 성립하지 않는다.
[선행 전달 교정안](../specs/stacked-git-workflow/implementation-plan.md#전달-선행-조건-교정안--2026-10-16-승인)은 2026-10-16 승인됐고 별도 후보로 검증 중이다.
최소12파일 제안의 관련 검사6개는 PASS. 실제 main 배치·태그·전체 품질을 완료한 것은 아니다.

## 품질 후속

`quality-f15e45c`는 43–50·52–59·61–67·69–74단계 PASS, 51·60·68단계 FAIL이다.
51은 1.1.0 변경 이력 미생성이다. 60/68은 승인된 shared stack 변경 8개의 옛 checksum 때문에 실패했다.
8개만 갱신하고 다른 23개는 보존했다. `checksum-refresh/`의 Claude 표면·Codex loader 검사는 후속 leakage·기본값까지 PASS다.
이 분할 결과를 단일 후보의 전체 quality PASS로 표현하지 않는다.

후속 단일 후보 `a8b32bf482ea60812550b646f10a8b4da20da68d`는 격리 clone에서 전체 local quality74/74 PASS다.
실행18분32초, 실패·재시도·단계 생략0; 종료 후 HEAD 동일·작업트리 clean을 확인했다.
`quality-a8b32bf/quality/results.json`에 각 CI 원문·실제 명령·cwd·후보·exit·로그 SHA를 보존했다.
macOS에서는 apt 대신 기존 rg, 기존 고정 Python/Ruff를 사용하고 의존성 설치는 clone 안에서만 수행했다.
CI의 package/bundle 계약 검사도 포함한다. 정식 release-check의 현재 배포물·live provenance 확인이나
원격 CI·발행을 실행한 것은 아니다. 이후 변경이 이 기록·진행 안내뿐이면 해당 문서 검사로 범위를 연결한다.

## 신규 solo lab 실제 시험 — 2026-10-16 진행 중

새 공개 `grinvi04/team-harness-stack-solo-lab`에 허용된 합성 파일만 bootstrap했다.
main/develop `339d2d9`에 strict·관리자 보호·Actions app15368의 필수 quality/deploy-smoke·승인1을 설정했다.
owner와 sole collaborator는 grinvi04다. 기존 company lab과 그 보호는 변경하지 않았다.
source `6199588`의 adapter와 고정 v0.2.1로 [하단 PR1](https://github.com/grinvi04/team-harness-stack-solo-lab/pull/1),
[상단 PR2](https://github.com/grinvi04/team-harness-stack-solo-lab/pull/2)를 실제 제출했다. 상단은 draft다.

- 상단 solo 요청은 최하단 제한으로 거부됐다. 보호 DELETE·merge PUT0회, 두 보호의 전후 원값 일치를 확인했다.
- 하단 `dcbdf3f`를 실제 readonly Codex/Astra medium이 검토했고 추가 결함을 발견하지 못했다.
  미해결 thread0과 head/base 불변을 대조했다. 리뷰는 required CI의 대체물이 아니다.
- 실제 workflow_dispatch run38782486625의 두 job은 성공했지만 PR GraphQL rollup에는 포함되지 않았다.
  [공식 required-check 계약](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#checks-from-some-workflow-jobs-are-not-evaluated)에 따라 수동 실행을 PR 필수 검사 충족으로 세지 않는다.
- 하단 wrapper는 CI pre-gate에서 exit1로 중단했다. DELETE·merge PUT0회이며 main/develop 보호는 그대로다.
  실제 1→0→1 복구와 하단 병합은 아직 미확인이다.
- 자동 push/opened 실행이 없던 원인을 조사하며 동일 head/base/stack의 PR을 한 번 닫고 재개했다.
  새 eligible 이벤트와 실제 PR 검사 결과를 확인하기 전에는 병합을 재요청하지 않는다.

원문은 `solo-live-proposal/execution-1/`의 제출 journal, review, check-run·GraphQL 응답,
`upper-refusal-result.json`, `lower-solo-exit.json`, `pre-gate-outcome.json`에 보존한다.
실패를 정상 복구 시험으로 바꾸거나 CI 판정 경로를 우회하지 않는다.

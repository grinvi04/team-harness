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
독립 검토 뒤 아래 회귀 검사를 통과했다. 실제 원격 수신은 별도로 남아 있다.

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

실제 lab의 새 preview는 PR33/34의 옛 전송 OID·현재 원격 OID·proof digest를 함께 제시했다.
`adapter-live-3/sync-adoption-preview.json`은 계획이며 실제 수신·병합의 완료 증거는 아니다.

## 아직 필요한 확인

PR33/34의 실제 sync·새 후보 리뷰·필수 CI·순차 병합, provider의 일반 pending polling,
409·queue·실제 solo 보호 복구, 현 후보 package/전체 품질과 G3 전달·O1–O5 대시보드는 별도 남은 항목이다.
소스 변경 뒤 기존 frozen runner의 hash나 journal을 고쳐 재사용하지 않는다. 이전 실행은 보존하고 새 후보로 이어 기록한다.
실제 solo 시험은 company lab의 계약·보호를 임의 변경하지 않는 별도 승인 범위가 필요하다.
Claude 실호스트 미확인 보류와 실제 사람·회사 고유 정책 인수의 제외 범위는 그대로다.

## 품질 후속

`quality-f15e45c`는 43–50·52–59·61–67·69–74단계 PASS, 51·60·68단계 FAIL이다.
51은 1.1.0 변경 이력 미생성이다. 60/68은 승인된 shared stack 변경 8개의 옛 checksum 때문에 실패했다.
8개만 갱신하고 다른 23개는 보존했다. `checksum-refresh/`의 Claude 표면·Codex loader 검사는 후속 leakage·기본값까지 PASS다.
이 분할 결과를 단일 후보의 전체 quality PASS로 표현하지 않는다.

# 공식 gh-stack G0 호환 시험 — 2026-10-15

당시 판정: **frozen-group 조건의 native linked merge 채택 NO-GO**. 기존 Harness·GitHub의 결함이나 보호 우회 판정이 아니다.
기준 `59bf40ba8f02bcbd38c941995e769ab412092f7b`, 미커밋 시험 코드·문서 후보다.
[승인 스펙](../specs/stacked-git-workflow.md)의 구성 변경 중단 조건을 실제 원격 시험에서 충족했다.
현재는 [공식 계약 최종 검토](../specs/stacked-git-workflow/final-review.md)로 재평가 중이다.
G1–G3와 대시보드 O1–O5는 미시작이며 전체 구현 완료가 아니다.

## 대상·권한·환경

- macOS arm64, Git 2.54.0, gh 2.92.0, 공식 `github/gh-stack` v0.2.1.
- 확장 tag commit: `29a36d314be664583705f18e41cebdf2b61ad514`.
- 공식 release asset SHA256: `c4d62dc667343d6dd8ff1cb60dcff9d0e097c2460dea326892f36d5d2e835d76`.
- gh 설치본은 macOS ad-hoc 서명으로 바이트가 다르다. 원본 사본에 같은 서명을 적용해 설치본과 일치했다.
- 기존 승인된 `grinvi04/team-harness-acceptance-lab`의 합성 자료만 사용했다.
  전용 prefix `codex/g0-stack-20261015-a/`, `codex/g0-stack-20261015-b/` 밖의 ref는 수정하지 않았다.
- 원격 main/develop·rulesets·보호, 기존 workflow·tag·release·소비 repo·운영 자원은 변경하지 않았다.
- fixture PR 생성은 기존 `pr-create.sh`; 새 API 자체 시험만 합성 PR에 직접 `merge-async`를 호출했다.
  제품 병합 우회 경로로 추가하지 않았고 `merge_action=default`, 응답 `bypass_rules=false`였다.

## 관측 결과

| 시험 | 결과 | 확인한 범위 |
|---|---|---|
| develop 명시·3층 init/add | PASS | A/B/C 실제 ancestry·공식 view JSON |
| 하위 변경의 cascading rebase | PASS | parent ancestry·child 내용 |
| 다른 worktree의 dirty writer | PASS | 재기반 거부·파일·status·refs 보존 |
| conflict 후 abort | PASS | 모든 층 ref·원래 branch·clean 상태 복구 |
| 기존 rerere 설정 보존 | PASS | 비대화형 unset 유지·기존 true 유지·fixture 설정 복구 |
| 대화형 rerere 활성화 | UNVERIFIED | prompt 관측, PTY 응답 대기 timeout; 활성화 성공으로 세지 않음 |
| 원격 stacks 조회·URL link | PASS | 실제 등록된 PR 구성·순서 재조회 |
| 잘못된 선택 SHA | PASS | PR14 HTTP400·terminal failed·head 변경 오류·미병합 |
| 최하단 하나 정상 병합 | PASS | PR14 UUID→merged·merge SHA 포함·PR15/16 미병합·PR15 retarget |
| head 유지·하위 PR 삽입 후 병합 | **FAIL** | A18 요청이 최초 검토 목록 밖 X21까지 함께 병합 |
| pending 중 변경·별도 base 경합·409 옵션·응답 유실·solo 지연 복구 | 미실행 | 중단 기준 충족 후 채택 시험을 확장하지 않음 |

## 중단 조건의 직접 증거

1. 처음 확인한 stack20은 `[18,19]`. [A18](https://github.com/grinvi04/team-harness-acceptance-lab/pull/18)은
   최하단 position1, base `…/race-trunk`, head `aaad8ae33fb5505e8e9b815750263bcdb55f3d39`였다.
2. 기존 stack을 해제하고 X의 PR을 만든 뒤 A base를 X로 바꾸고 `[21,18,19]`를 stack22로 연결했다.
   A의 head는 동일했지만 position2·base `…/race-x`로 바뀌었다.
3. A18에 같은 `sha`, `merge_method=merge`, `merge_action=default`로 요청했다.
   UUID `71cae467-9cf7-467a-9c6f-b3625b0adf62`가 pending→merged로 종결됐다.
4. A18과 [X21](https://github.com/grinvi04/team-harness-acceptance-lab/pull/21) 모두 `merged:true`,
   merge SHA `19bb441d9a3e1c870f2adc243e6b6d67e114b336`을 원본 응답에서 확인했다.
   X21을 직접 병합하는 별도 요청은 없었다.

선택 PR의 SHA는 그 PR의 head를 묶지만 검토한 stack 구성·base까지 고정하지 않았다.
직전 재조회로 창을 줄일 수 있어도 조회와 요청 사이의 원격 변경을 원자적으로 막았다는 증거는 아니다.
X 커밋은 이미 A의 부모였다. **새 코드 삽입·보호된 trunk의 CI/리뷰 우회·pending 중 변경**의 증거가 아니다.
두 실제 사용자의 동시 실행 대신 사전 조회→원격 변경→요청 순서를 제어해 경계 조건을 재현했다.
당시 구현 전 스펙의 frozen-group 중단 조건은 FAIL이었다. 이 관측 결과는 바꾸지 않는다.
후속 최종 검토는 해당 조건을 기존 보호와 구분하며, 공식 API가 제공하지 않는 원자 보장을 주장하지 않는다.

## 최초 실패·수정·정리

- `GH_CONFIG_DIR`만 분리한 최초 설치는 extension 저장소를 분리하지 못했다. 기존 확장이 없던 위치에
  설치된 gh-stack만 공식 remove로 즉시 제거했다. 이후 `XDG_DATA_HOME`으로 격리했다.
- local attempt1은 비대화형 init도 rerere를 켠다는 잘못된 기대 때문에 FAIL이었다. 공식 소스의 대화형
  분기와 실제 설정을 확인해 보존 기준으로 바로잡았다. attempt2와 환경 allowlist 보완 후 attempt3은 5/5 PASS.
- live attempt1은 `link --base` 누락으로 link 전에 중단됐다. PR11–13·전용 refs4개 정리와 기존 원값 일치 확인.
  lowest PR의 실제 base를 명시한 attempt2로 재시험했다. 첫 실패 기록을 덮지 않았다.
- attempt2 자동 정리는 서버가 재기반한 child3개의 OID 차이를 발견해 삭제를 보류했다. 병합 PR의
  자동 삭제된 ref도 최초 로그에서는 조회 미확인으로 남겼다. 이를 원래 result에서 PASS로 바꾸지 않았다.
- 별도 후속 정리에서 닫힌 소유 PR·기록된 새 head·원래 합성 tree 일치를 대조한 뒤 exact lease로 삭제했다.
  최종 branch 목록·main/develop 보호·rulesets 전체가 before와 일치했고 소유 refs0·열린 시험 PR0을 확인했다.
- 실제 병합된 합성 PR14/18/21의 이력은 보존된다. 시험 branch 삭제는 그 병합 이력을 취소한다는 뜻이 아니다.
- 격리 확장·소유 fixture3개를 제거하고 전역 확장 목록 원상태를 재확인했다. 원본 로그·공식 소스 사본은 보존했다.
  로컬 객체 보관 중 remote merge 객체가 없어서 최초 정리가 중단된 기록도 보존했다. API 원문은 그대로다.

## 증거·검수·한계

[고정 관측 요약·digest](gh-stack-compatibility.json)에 명령·후보·원본 파일 hash를 연결한다.
원본은 작업공간의 `.runtime/gh-stack-g0/`에 보존하며 공개 PR은 위 링크에서 확인할 수 있다.
`local-attempt-3`, `live-attempt-2`, `cleanup-followup-*`를 구분하고 중간 실패 result를 보존한다.
요약 파일의 PASS 값 자체를 실행 증거로 취급하지 않는다.

독립 읽기 전용 검토자는 probe·commands 원문·응답 JSON·Git 객체를 직접 대조했다.
동일 head·구성 변경·A 대상 요청·X/A 병합 관측 PASS, G0 채택 조건 FAIL을 확인했다.
후속 정리도 별도 검토해 소유 head/tree·lease 삭제·최종 inventory·PR closed 일치를 확인했다.
검토는 별도 인스턴스에서 수행했으며 실제 권한은 부모와 동일했다. OS read-only 강제를 주장하지 않는다.
현재 코드는 시험 도구이며 공용 wrapper·스킬·정책·플러그인 버전을 변경하지 않았다.
전체 quality·릴리즈·설치 시험은 실행하지 않았고 앞선 제품 검증으로 대체하지 않는다.

## 후속 최종 검토

공식 trunk 정책과 연속 그룹 병합 의미를 확인해 로컬 전용 축소 권고를 철회했다.
현재 wrapper의 direct-base 가정·CI payload·solo async 연결을 정정하고 승인된 lab의 새 전용
보호 trunk에서 기존 gate 보존을 관찰한다. 상세 판단·반례·시험 계약은 위 최종 검토를 따른다.
최초 FAIL·raw digest·정리 결과와 후속 판정을 구분하며, 아직 G1–G3·대시보드 완료가 아니다.

공식 계약: [v0.2.1 merge API](https://github.com/github/gh-stack/blob/v0.2.1/docs/src/content/docs/reference/merge-api.md),
[v0.2.1 REST API](https://github.com/github/gh-stack/blob/v0.2.1/docs/src/content/docs/reference/rest-api.md).

## 공식 보호 계약 재검증 — 2026-10-15

최종 판정은 **구현 진행 가능**이다. 아래 공식 서버 계약 시험을 통과했으며 Harness 지원 완료와 구분한다.
후보는 `59bf40b` 기반 `tests/acceptance/gh-stack-protected.mjs`이며 정확한 SHA-256·실행 명령·원문 digest는
[결과 JSON](gh-stack-compatibility.json)의 `protectedIntegration`에 기록했다. 기존 G0 기록은 변경하지 않았다.

| 실제 시험 | 결과 |
|---|---|
| [PR23](https://github.com/grinvi04/team-harness-acceptance-lab/pull/23) CI 실패·[PR24](https://github.com/grinvi04/team-harness-acceptance-lab/pull/24) 성공 | required `g0-stack-contract` 실패를 명시한 terminal failed, 양쪽 미병합 |
| [PR26](https://github.com/grinvi04/team-harness-acceptance-lab/pull/26)·[PR27](https://github.com/grinvi04/team-harness-acceptance-lab/pull/27) CI 성공·승인1명 필요 | write 권한 승인 부족을 명시한 terminal failed, 양쪽 미병합 |
| 같은 PR26/27 head·새 시험 trunk 승인0명 | strict·required app/check·관리자 강제를 유지하며 둘 다 merged |
| 합성 환경 정리 | 자체 refs·보호 제거, PR 종료, 기존 전체 branch·보호·rulesets before/after 동일 |

정상 병합 SHA는 `67f49a9d8b8cbfedfb86a8ee76bec65cff232922`다. 필수 check는 GitHub Actions app `15368`과
현재 각 head에서 확인했다. 별도 인스턴스가 요약 PASS 대신 command 원응답·candidate·실제 job 로그를 대조했다.

상위 PR의 실제 `stacked` 실행은 `github.base_ref=trunk`, `pull_request.base.ref=직접 parent`였다.
trunk 한정 branch 필터에서 상위층 CI가 실행됐다. `pull_request_target`의 런타임 값까지 검증한 것은 아니다.
기존 CI의 base 이름 제한이 상위 PR을 반드시 거부한다는 추정은 철회하며 실제 소비 변수에 맞춰 연결한다.

최초 새 시험은 격리 Git credential helper 누락으로 push 인증 전에 실패했다. 초기 FAIL을 보존하고 원격 전체
상태가 그대로임을 별도 확인한 뒤 fixture를 정리했다. 다음 시도는 fixture 로컬 helper만 추가했고 전역 설정을
바꾸지 않았다. 현재 raw 위치는 `.runtime/gh-stack-g0/protected-attempt-{1,2}/`다.

이 시험은 AI 리뷰·스레드·외부 상태 연결, solo 비동기 복구, queue·409·응답 유실, CODEOWNERS, 설치를
대신하지 않는다. 이들은 [최종 검토](../specs/stacked-git-workflow/final-review.md)의 구현 항목으로 남는다.

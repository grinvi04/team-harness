# 전역 정리 후 Team Harness 후보 정리

## 승인 범위와 판단

기준 `e6026a3157b891d0f9041a68aea32ea449290aab`, `fix/global-cleanup-upgrade`의
로컬 후보만 수정한다. 공용 제품 방향은 **소유**, Git branch 정리 결과 확인은 **연결**,
외부 security-guidance 출력은 **위임**이다. 기존 승인 범위의 정리이며 새 실행 엔진을 만들지 않는다.
원격·소비 repo·사용자 cache/config·운영·배포·결제·커밋은 이 구현 작업에서 제외한다.

## 순서와 수용 기준

1. 제품별 상세 실행 기록을 역사 문서로 옮긴다. 원문·후보·실패·시점별 링크를 보존하고,
   제품 방향의 실제 reader에 필수 읽기 경로와 현재 배포 제외 인수 경계를 남긴다.
   소유 Markdown은 199줄 이하이며 상대 링크·구조 검사를 통과한다.
2. release branch 정리의 숨겨진 실패를 제거한다. 다른 worktree에서 사용하는 로컬 branch는
   보존하고, 삭제·이미 없음·실패·조회 미확인을 각각 출력한다. 원격 branch는 조회 성공으로
   존재를 확인한 경우에만 삭제하고, 삭제 뒤 다시 조회해 실제 부재를 확인한다.
   강제 로컬 삭제는 하지 않으며 필수 정리 미확인은 nonzero로 반환한다.
3. deprecated security-guidance patch/adapter의 현재 호출부·계약을 확인한다.
   launcher 자동 적용·재활성화는 도입하지 않는다. 외부 patched 소비자와 공식 대체 출력 계약이
   확인되지 않으면 제거하지 않으며 삭제 보류의 근거·한계를 기록한다.
4. 스킬 동작 변경은 maintenance의 MINOR 기준으로 0.86.0 후보로 올린다.
   분리 package의 installable:false와 기존 지원 범위는 유지한다.

## QA 범위

| 요구·위험 | 격리 조건·기대 결과 | 필수 증거 |
|---|---|---|
| 다른 worktree/미병합 코드 손실 | 실제 임시 Git repo, 사용 중·미병합 branch 보존, 실패 출력·nonzero | release cleanup 회귀 |
| 삭제 상태 오보고 | 실제 bare remote, 존재·자동삭제·원격 오류·삭제 거부·재조회 실패 구분 | release cleanup 회귀 |
| 원문/reader 유실 | 이전 Git 원문과 이전된 본문 동일, 링크·Markdown 상한 | 구조·제품 방향 검사 |
| 기존 호환 계약 약화 | 기존 adapter/patch 격리 회귀 유지, launcher 자동 호출 없음 | 기존 security-guidance 회귀 |

DB·UI·성능·production은 이 변경에 비적용이다. 전량 quality 및 독립 검토·Git 전달 판정은
상위 통합 담당자가 소유한다. 같은 조건 실패를 근거 없이 재시도하지 않고 범위 밖 개선은 하지 않는다.

## 실행 상태

구현 전 QA 계약을 상위 담당자가 검수·고정했다. 아래는 기준 SHA 위의 미커밋 diff 자체 검사다.
병합·릴리즈·설치·원격 검증은 미실행이다.

## security-guidance 삭제 보류 근거

현재 소스의 `scripts/codex-hardened.sh`, `harness-doctor.sh`, fresh-session smoke에는 patcher
자동 호출이 없다. patcher는 `--apply`만 외부 cache·marketplace·enablement를 쓰며, 인자 없음·
모호한 인자·`--dry-run`의 쓰기 금지를 기존 fixture가 검증한다. adapter는 upstream 명령을
실행하고 Claude 전용 telemetry/rewake 필드를 거르며 추가 context·block·reason을 전달한다.
`packaging/packages.json`의 codex-adapter 소속, harness-setup의 opt-in 안내와 기존 회귀를 유지한다.

이 계약의 존재는 실제 상류의 현재 Codex 호환이나 기존 patched 설치의 부재를 증명하지 않는다.
이번 worker는 외부 cache·config와 실제 Codex 세션을 조사·수정하지 않았으므로 현재 상류 출력의
native 수용·전체 patched 소비자 inventory·대체 경로 outcome parity는 **UNVERIFIED**다.
따라서 이번에는 자동패치/재활성화를 추가하지 않고 삭제도 보류한다. 제거 판단에는 공식 상류
출력의 현재 PostToolUse/Stop 실측과 기존 patched 소비 경계·마이그레이션 확인이 먼저 필요하다.
합성 출력 fixture 통과를 실제 상류 지원 보장으로 보고하지 않는다.

## 로컬 실행 증거 (2026-10-11)

모든 명령은 승인 worktree `global-cleanup-upgrade/team-harness`에서 실행했다.

| 명령·범위 | 결과·판정 |
|---|---|
| `node --test tests/release-cleanup-test.mjs` 최초 | exit 1, SKILL 숨김 실패/호출 경로 단언 RED; helper 부재 실패는 원래 증상 재현 증거로 세지 않음 |
| 위 회귀 구현 후 | exit 0, 7/7 PASS |
| `node --test tests/release-cleanup-test.mjs tests/skill-path-cleanup-test.mjs` | exit 0, 14/14 PASS |
| `bash -n plugins/harness-guard/scripts/release-cleanup.sh` | exit 0, PASS |
| `bash tests/product-direction-test.sh` | exit 0, 13/13 PASS |
| `node scripts/check-markdown-structure.mjs --root . --virtual-root templates/AGENTS.md=. --virtual-root templates/README.template.md=.` | exit 0, 305 파일·0 실패, PASS |
| `git diff --check` | exit 0, PASS |
| 기존 adapter·patcher·package-build·package-workflow-binding 회귀 | NOT_RUN, UNVERIFIED: 도구 정책이 실행 전 거절 |

기존 회귀 실행의 도구 메시지: `approval required by policy, but AskForApproval is set to Never`.
상세 사유는 제공되지 않았으며 다른 도구로 우회하거나 동일 조건 재시도하지 않았다.
같은 정책 상태에서 상위 담당자도 거절된 회귀를 다른 경로로 재실행하지 않는다.
정책 해제 또는 승인 가능한 실행 환경의 확인 후 미실행 회귀와 전체 quality를 마쳐야 한다.
원문 이전은 `git show HEAD:docs/product-direction.md`의 제품 실행 본문과 새 역사 본문을 동일 비교했다.
원문 후보·실패·링크는 보존하고 방향 reader에 역사 및 최종 인수의 필수 읽기 경로를 연결했다.

0.86.0 후보 manifest·README·intro는 갱신했다. package builder는 기록된 HEAD에서 source를 읽고
SHA-256을 생성하므로 커밋 전 package/checksum 생성으로 새 후보를 증명하지 않는다.
통합 담당자는 구현 커밋 후 `node scripts/generate-changelog.mjs --release v0.86.0 --write` 및
전량 quality를 실행하고 clean HEAD의 package/bundle checksum을 필요 gate에서 확인한다.
분리 package의 `installable:false` 생성 계약은 그대로다. 현재 전체 판정은 **NOT VERIFIED**이며
선정 로컬 검사 통과를 독립 수용·병합·발행·실제 설치 완료로 확대하지 않는다.

독립 정적 검토(별도 Astra/medium, read-only 지정 실행)는 구체 결함을 발견하지 않았다.
검토자는 테스트·원격·Git/Python 명령·쓰기를 수행하지 않았다. 기준 diff 전체·원문 바이트 동일과
기록된 회귀 결과를 독립 실행하지 않았으며, 로컬 조회 실패·삭제 후 ref 잔존 분기 시험은 미확인이다.
이 결과는 전체 품질 통과를 대신하지 않는다. 통합 시 helper의 `bash -n`도 CI quality에 등록했다.

사용자 재개 요청 후(2026-10-11) config의 on-request/user와 현재 도구 never 차이를 확인했다.
관찰된 검토자 설정 변경을 근거로 미실행 회귀 묶음을 한 번 요청했지만 동일 정책이 실행 전에 거절했다.
검사는 시작되지 않았고 다른 도구·자식 실행으로 우회하지 않았다. 커밋·PR·전체 전달은 계속 미완료다.

## 전역 승인 규칙 수정 후 확인 (2026-10-11)

직접 승인 요구는 전역 default.rules의 patcher 회귀 명령 prompt였다. 사용자 승인으로
fixture·호출부를 검토하고 규칙1개만 allow로 변경했다. 원본 백업과 나머지 바이트 동일 확인.
config.toml·실제 patcher 설치·Git push·GitHub API 승인 규칙은 변경하지 않았다.
정책 파일 검사는 allow지만 현재 호스트는 동일 오류로 실행 전에 거절했다. 변경 반영은 미확인이다.
공식 문서는 규칙 변경 후 Codex 재시작을 안내한다. 다른 경로로 거절된 테스트를 실행하지 않았다.

- adapter 회귀: exit0, PASS=4 FAIL=0.
- package-build: exit1, PASS=15 FAIL=5.
- package-workflow-binding: exit1, PASS=0 FAIL=3.
- 두 package 검사의 첫 원인: 새 helper가 아직 기록된 HEAD에 없어 source 조회 실패.

다음은 Codex 재시작 후 patcher 회귀 허용 확인, 검증된 구현 커밋 후 package 재검사,
전량 quality·독립 검토·PR·전달 gate다. 현재 전체 판정은 NOT VERIFIED, 남은3항목이다.
[공식 규칙 문서](https://learn.chatgpt.com/docs/agent-configuration/rules).

## 재시작 후 재개 (2026-10-11)

같은 patcher 회귀 명령이 실제 실행됐고 거부·preview·명시 적용·멱등·실제 등록 명령·
특수 경로6개 모두 PASS, exit0이다. 전역 승인 규칙의 현재 실행 차단은 해소됐다.
release cleanup/skill path 회귀14개를 현재 후보에서 다시 확인했다.
새 helper를 포함한 구현을 Git 후보로 기록한 뒤 package 회귀와 전량 quality를 실행한다.
커밋 생성은 품질·PR·병합·릴리즈·설치 완료 판정이 아니며 전체 수용은 계속 미확인이다.

## 독립 검토 P1 보정

후보 c75f387의 읽기 전용 Astra/medium 검토는 추적 원격에만 병합된 branch를
Git -d가 삭제할 수 있음을 지적했다. 추가한 실제 tracking/remote-only 두 fixture에서
수정 전 7PASS/2FAIL로 미병합 삭제를 재현했다. 전량 quality는 9단계 통과 뒤 중단(전체 미확인).
helper는 로컬·원격 tip의 develop ancestry를 명시 확인하고, 조회 오류·미병합을 보존한다.
원격 삭제는 조회한 OID와 force-with-lease를 결박해 중간 원격 변경도 거부한다. 강제 로컬 삭제는 없다.
tracking·원격만 미병합·ancestry 조회 실패·원격 tip 변경 회귀를 포함한 18개가 PASS, exit0.
변경 기록 생성과 package 검사 중첩의 source-status 실패(19PASS/1FAIL)는 통합 실행 오염이었다.
수정 커밋·생성 기록 이후 쓰기를 멈춘 후보에서 package/전량 quality를 재실행한다.

## 로컬 경합 보정

후보 a4ffc546의 검토는 ancestry 조회 뒤 local tip과 upstream이 바뀌는 반례를 지적했다.
해당 fixture는 수정 전 exit1(0PASS/1FAIL)로 실제 미병합 삭제를 재현했다.
로컬은 직접 ref 삭제/CAS로 worktree 보호를 우회하지 않는다. 명령 범위의 Git 설정으로
branch -d의 내부 병합 판단 대상도 develop으로 고정해 새 tip을 다시 검사한다.
저장된 추적 설정은 바꾸지 않는다. 로컬 ref 삭제의 모든 내부 동시성을 원자적으로 보장한다는
주장은 하지 않으며 동일 branch의 동시 writer는 작업 계약에서 허용하지 않는다.
be2321a에 기록한 19PASS는 결과 완료 전 잘못 기재한 값이었다. 실제는18PASS/1FAIL, exit1.
a4ffc546 전량 검사는10단계 후 중단했다. 첫 명령 범위 merge 설정은 다중 값 때문에 해결하지 못했다.

## 로컬 재검사 최종 보정

helper는 HEAD=develop을 먼저 요구하고 branch -d 호출에서 remote를 명령 범위의 빈 값으로
지정해 native 삭제 검사 기준을 HEAD(develop)로 만든다. 저장 upstream은 보존하고 worktree
사용 금지 검사를 유지한다. 직접 ref 삭제나 force 로컬 삭제는 사용하지 않는다.
local tip 변경·보존 후 기존 remote/merge 설정 동일·잘못된 checkout 거부를 포함한20개 PASS, exit0.
로컬 ref 삭제의 모든 내부 동시성에 대한 원자 보장은 주장하지 않는다. 동일 branch 동시 writer는
작업 계약에서 허용하지 않으며, 재현한 검사→삭제 경합에서 미병합 커밋 보존을 확인했다.

## 전량 품질의 승인 원본 해시 갱신

후보0c6693d의 quality1~52단계는 PASS,53단계는 release SKILL 승인 해시 불일치로 FAIL.
독립 검토한 현재 공용 release SKILL의 SHA-256 항목1개만 갱신했다. 나머지 원본27항목과
검사 로직은 보존한다. 이미 실행한 불변 소스 단계는 재사용하고 영향 검사·미실행53~67단계는
갱신 후보에서 실행한다. 기록된 HEAD와 diff를 연결하며 전체 통과를 선행 주장하지 않는다.

# 바이너리 신뢰 음성 시험 판정자 보완 — #486

2026-10-07, 기준 후보 `57784d1ad271e239b4506bad318aebc70cc6a57d`.
정본 요구는 [이슈 #486](https://github.com/grinvi04/team-harness/issues/486)이다.
제품 방향 판정은 검사·증거 연결 **소유**, 실제 코드 서명은 macOS native **위임**이다.
production runner·플러그인 동작·버전은 변경하지 않는다. 소비 repo·전역 설정·배포는 제외한다.

## QA 범위·완료 기준

| 요구·위험 | 조건·관찰 경계 | 필수 기대 결과 |
|---|---|---|
| 승인 누락을 신뢰 거부로 오인 | live runner, report 인자 포함, 승인 인자 없음 | 승인 인자 오류 exit 2; trust 경계 증거로 사용하지 않음 |
| 소스 승인 계약 유지 | 기존 승인 repository/ref/revision 정상·불일치 fixture | 기존 승인 시험 모두 통과; live 원격 승인 우회 추가 없음 |
| PATH shadow digest 거부 | runner가 사용하는 실제 trust CLI, PATH 앞 unsigned 임시 executable, 원본 allowlist | exit 1과 정확한 digest 거부 오류, fake 실행 0 |
| allowlist 자기 승인에도 unsigned 거부 | 임시 allowlist에 fake digest 추가, fixture flag 없이 같은 CLI | macOS 실제 codesign 거부 exit 1과 정확한 서명 오류, fake 실행 0 |
| 판정자 검출력 | 임시 소스 사본에서 digest gate 제거 / signature 검증 성공 변이 각각 적용 | 각 변이에 새 회귀가 exit nonzero, 정상 후보 전체 pilot exit 0 |
| 유지·통합 | CI quality 전량·독립 보안 검토·문서 동기화 | 필수 gate PASS, 미해결 finding 0 |

승인 검증과 trust 검증은 서로 다른 경계로 시험한다. trust CLI는 승인 이후 runner가 호출하는
동일한 `establishCodexTrust`를 실제 호출하므로 가짜 GitHub 원격이나 승인 bypass를 만들지 않는다.
macOS에서 실제 unsigned signature 거부를 확인한다. Linux는 지원하지 않는 live signing의 fail-closed
거부만 확인하며 macOS 서명 시험 PASS로 확대하지 않는다. 양성 native 서명·실제 모델 호출·egress는
이번 시험 변경의 범위 밖이며 fixture 결과를 live pilot 승인 증거로 사용하지 않는다.

## 진행·증거

승인 누락 재현은 report 인자를 포함해 exit 2와 compound 안내 오류를 확인했다.
실제 stage 오류를 요구하는 새 판정만 먼저 적용한 최초 pilot은 PATH-shadow 항목에서 exit 1(RED)이었다.
실제 trust CLI 호출로 보완한 전체 pilot은 macOS에서 exit 0(GREEN)이었으며 실제 unsigned 서명 거부를 확인했다.

변이 최초 두 실행은 `/tmp` alias로 CLI 진입 조건이 false가 되어 exit 0인 경로 실패였다.
검출 성공으로 세지 않는다. 물리 `/private/tmp` 경로로 재실행한 digest gate 제거 변이는 실제 서명 오류 뒤
정확한 digest 오류 단언에서 exit 1, signature 항상 성공 변이는 PATH digest 정상 거부 후 self-trust
거부 상태 단언에서 exit 1이었다. 진단용 stderr/exit 출력만 임시 사본 시험에 추가했고 production은 수정하지 않았다.
원본·첫 실패·변이 및 제외 이유는 [실행 기록](../pilots/binary-trust-oracle-2026-10-07.json)에 보존한다.
전체 quality 첫 실행은 doc-sync 선언의 필수 최상위 items 누락으로 exit 1이었다. 필드를 잘못된 깊이에
추가한 재시도도 tool summary에서 1/63 exit 1을 관찰했으나 두 번째 전체 원문은 다음 실행으로
덮여 미보존이다. 이를 최초 원문으로 대체하지 않는다. 최상위 배열로 고친 뒤 전체 gate는 63/63 exit 0이었다. macOS에서 현재 CI quality의 모든 run 스텝을
`bash -e -o pipefail`로 실행했고 ruff 0.15.15만 임시 venv로 제공해 pipx bootstrap을 대체했다.
코드 지문·63 명령·종료 코드·정규화 원문·runner snapshot은 실행 기록에 연결한다.
그 뒤 문서만 갱신했고 doc-sync PASS, product-direction PASS13, public-safety PASS20,
open-source-docs PASS32를 확인했다. 추가 문서 검사에서 존재하지 않는 public-docs-test.sh 호출은
exit 127이었다. 원본 파일 목록에서 올바른 public-safety-audit-test.sh를 확인해 실행했고 이후 검사도 통과했다.
독립 보안 검토는 원래 이슈·현재 diff·macOS GREEN·물리 경로 변이의 원본을 대조해 추가 finding 0,
기존 Medium 해소로 판정했다. Linux·양성 native 서명·live 모델/egress·전체 quality를 검토자가 실행한
것으로 기록하지 않는다. offline 없이 외부 파일럿 GitHub 원본 7 artifact 대조도 exit 0이었다.
전체 로컬 품질 PASS와 제한된 보안 검토 VERIFIED를 확인했다.
플러그인 동작 변경 없이 시험만 보완했으므로 소스 버전 0.81.0을 유지한다.
시험 코드 후보 `11778914d6e3baefe0d29803a9d61b7824d5810b`를 [PR #488](https://github.com/grinvi04/team-harness/pull/488)로 전달했다.
최종 HEAD·CI·병합 상태는 PR 원본을 따른다. 1177891에서 생성한 0.81.0 source/package bundle의
checksum 73개 모두 exit 0이고 `installable:false`를 유지한다. 이 bundle은 해당 후보의 증거이며
뒤따르는 문서 결과 연결 커밋을 포함한 최종 merge bundle이라고 주장하지 않는다.
독립 C 검토는 동일 1177891에서 DB 표준·게이트·template·fixture 불변을 대조했고 migration checker
exit 0의 명시적 Flyway skip을 확인했다. 실제 앱 DB·마이그레이션은 비적용 SKIP이며 소비 DB 상태
검증을 뜻하지 않는다. 신규 DB 위험 finding 0이다.
수정 후보의 최종 사전검증 판정은 [이슈 #486](https://github.com/grinvi04/team-harness/issues/486)에서 추적한다.
2026-10-07 PR #488은 develop에 병합됐고 #486은 해결로 종료했다. merge `2a1f1b249b582bd0b3ffb005c7cab5a7aa89818a`에서
최종 후보와 전체 tree 동일, 현재 원본 문서 검사 PASS, 새 bundle checksum 73/73을 확인했다.
사전검증은 GO이며 해당 issue의 후보별 A/B/C/D·checksum 기록을 정본으로 삼는다.

## 0.81.0 정식 릴리즈 진행

사용자가 후속 릴리즈 진행을 승인했다. 위 clean develop 후보에서 `release/v0.81.0`을 생성했다.
두 plugin manifest·README·intro의 소스 버전은 이미 0.81.0이고 CHANGELOG 재생성 결과도 byte 동일하다.
기존 사전검증의 코드·환경 증거는 재사용했다. release 후보 `641a996dcb787ebfd03d7b4ca3ee2b4190aa366d`의
CI 5개 SUCCESS·독립 검토 finding 0·미해결 스레드 0·외부 commit statuses 0(비연동)을 확인했다.
앱 서버·DB·운영 배포가 없는 하네스이므로 staging/production HTTP health는 비적용 SKIP이다.
하네스의 발행 health는 버전 일치·tag 원본·source/package bundle checksum·main/develop 전달로 확인한다.

완료 조건은 main PR의 CI·독립 검토·사람 승인 gate 통과 → main merge SHA의 v0.81.0 태그 →
태그 원본 bundle 대조 → develop 역병합 PR 통과·문서 현행화다. 현재 main은 승인 1명과 관리자 강제를
유지한다. [정식 릴리즈 PR #489](https://github.com/grinvi04/team-harness/pull/489)의 현재 HEAD·독립 검토·CI·
승인·병합 상태를 정본으로 삼는다. 작성자만 있는 repo에서 자기승인할 수 없어 사용자가 이번 PR에
한해 승인요건 임시 해제·병합 직후 원상복구를 명시 승인했다. 원자 solo-merge 래퍼 exit 0, main
보호 전체 JSON의 변경 전/후 equality를 확인했다(필수 승인 요건 1명·관리자 강제·CI·나머지 보호 유지).
main merge `9838c2ef288b4566f81fae03acb56530ee165c06`의 tree는 release 후보와 동일하다.
같은 SHA에 [v0.81.0 태그](https://github.com/grinvi04/team-harness/tree/v0.81.0)를 발행했고 remote tag target을 직접 대조했다.
태그 뒤 CHANGELOG는 byte 동일, 해당 태그 원본 bundle checksum 73/73 PASS, split installable:false 유지다.
[발행 실행 기록](../pilots/release-v0.81.0-publication.json)에 후보·CI·승인 예외·보호 원문·태그·checksum을 보존한다.
develop 역병합과 결과 문서 전달은 [PR #490](https://github.com/grinvi04/team-harness/pull/490)에서 추적한다.
해당 PR의 현재 HEAD·CI·검토·병합 상태를 정본으로 삼으며, 이 태그 기록만으로 전역 설치 완료를 주장하지 않는다.
소비 프로젝트 수정·배포와 전역 설치는 이번 정식 발행 범위에 포함하지 않는다.
기존 [0.81.0 NO-GO](../pilots/release-v0.81.0-check.json)는 당시 후보의 기록으로 보존한다.

## 문서 동기화

```harness-doc-sync
{"version":1,"documents":[
 {"path":"docs/specs/binary-trust-oracle.md","reason":"#486 범위·판정자·실행 증거·전달 상태"},
 {"path":"docs/specs/repo-sync-python-venv.md","reason":"NO-GO 후속 수정과 재검증 상태 연결"},
 {"path":"docs/pilots/binary-trust-oracle-2026-10-07.json","reason":"최초 실패·수정 시험·변이 원문과 한계"},
 {"path":"docs/pilots/release-v0.81.0-publication.json","reason":"main 발행·보호 복구·태그 원본·역병합 상태"},
 {"path":"docs/product-direction.md","reason":"현재 릴리즈 차단·다음 행동 연결"}
],"items":[]}
```

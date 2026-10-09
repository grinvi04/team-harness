# v0.81.0 전달·설치·보안 후속 기록

[상위 문서](qa-command-binding-validation.md)로 돌아간다. 아래는 원문의 해당 주제·당시 후보 기록을 순서대로 보존한 본문이다.

### PR 전달 전 증거·공개 범위 보완 (2026-10-06)

독립 검토에서 설치 전환의 원본 CLI 출력·skills/list 전체 응답·설정 비교 전후 원본은 보존되지 않았음을
확인했다. 위의 역사적 보고와 구조화된 값은 남기되, 이 기록만으로 당시 설치 전환·설정 복구를 독립
재검증하는 것은 **UNVERIFIED**다. 부모 agent가 실행한 전체 QA/대비의 최초 횟수·exit 값도 당시
실행자의 보고이며, 전체 tool-event 원본을 보존했다는 뜻이 아니다. 재설치로 과거 증거를 만들지 않았다.

대신 현재 공식 CLI plugin/marketplace 조회, source HEAD, source-vs-cache native 검사와 새 app-server
skills/list를 다시 확인했다. enabled 0.80.0, 발행 source SHA 일치, native 계약 exit 0, Harness 스킬
17개 enabled/로딩 오류 0의 **현재 상태는 VERIFIED**다. 대상 응답 발췌·실제 명령·결과와 역사적 한계는
실행 근거의 `currentInstallationRecheck`·`evidenceRetention`에 구분한다.

전체 quality 로컬 재현은 최초 후보 e77aa89에서 31개 단계 통과 후 32번째 공개 안전성 검사에서
개인 홈 경로 때문에 실패했다. 나머지는 그 실행에서 미실행이다. 기록의 개인 홈 접두어를
`<USER_HOME>`으로 정규화해 공개용 표현으로 바꿨고 검사는 완화하지 않았다. 원래 raw log SHA는
정규화 전 bytes의 값으로 유지하며 정규화 후 SHA도 따로 기록한다. 실행 스크립트·명령 표현은
실제 경로를 그대로 재실행할 파일이 아니라 공개용 치환본임을 명시한다. 설치 전환 원문 미보존과
공개 경로 실패는 지우지 않고 보존한다. 코드/플러그인 동작·샘플은 변경하지 않았다.

### 기록 전달 PR (2026-10-06)

[PR #483](https://github.com/grinvi04/team-harness/pull/483)이 설치 이후 기록 3개를 develop에 전달한다.
위의 로컬 보관/미병합 표현은 해당 단계 당시 상태이며, 최신 병합·CI·리뷰 상태의 정본은 이 PR이다.
첫 quality 실행은 1~31 통과/32 실패/33~63 미실행으로 보존했다. 개인 경로 정규화 후보 6c89eb7에서는
1·31~63을 모두 exit 0으로 확인했고, 관련 코드/시험/workflow 입력이 동일한 2~30 결과는 재사용했다.
ruff 0.15.15는 임시 venv에 미리 설치해 같은 실제 ruff 명령을 실행했다. 다른 단계 명령은 workflow와 같다.

독립 `harness-verifier`는 e77aa89의 증거 공백을 지적했고 6c89eb7에서 한계 표시·현재 조회·digest를
원본과 대조해 지적 해소/추가 지적 없음으로 판정했다. 최신 문서 상태와 이 전달 기록도 최종 후보에서
대조한다. 원격 CI·스레드·외부 status·현재 develop 보호 요건은 로컬 green으로 대체하지 않는다.
제품·플러그인 동작·버전·설치 상태는 이 전달 변경으로 수정하지 않는다.


### 0.81.0 전역 설치와 완료 경계 (2026-10-07)

사용자가 완료 시점까지 계속 진행하도록 요청했다. 범위는 발행 태그 설치 → 새 세션 로딩 → 샘플
통합 검증 → 관련 기록 현행화와 독립 검토다. 네 소비 프로젝트 수정·배포와 모델·역할 변경은 보류한다.

| 필수 범위 / 선정 이유 | 기대 결과와 관찰 경계 | 결과 |
|---|---|---|
| 발행본 설치 / 개발 후보 혼입 방지 | 공식 CLI 태그 v0.81.0, source HEAD=main 태그, cache inventory·digest 일치 | PASS |
| 설정 보존 / 전역 영향 제한 | Team Harness 두 설정 구역 외 문자열 동일 | PASS |
| 샘플 새 세션 발견 / 실제 소비 경계 | forceReload skills/list에서 17개 enabled·0.81.0 경로·로딩 오류 0 | PASS |
| 설치 계약 읽기 / 발견만으로 실행 계약 전달을 보장하지 않음 | 설치 cache의 native wrapper·common contract·native-runtime·risk-boundaries 읽기 | PASS |
| 샘플 전체 gate / 제품 통합 및 격리·종료·저장 경계 | 같은 제품 후보의 check-local.sh 모든 단계 exit 0, 제품 Git 변경 없음 | FAIL |
| 기록 대조 / 과거 결과와 현재 상태 구분 | 최초 실패와 미실행·설치 완료·통합 미완료 및 검토 상태 연결 | 실행 근거와 전달 PR 참조 |

[실행 근거](qa-install-v0.81.0-evidence.json)에 공식 CLI 출력·원본 digest·새 skills/list 발췌를 보존했다.
공식 절차는 [OpenAI plugin 안내](https://developers.openai.com/plugins/build/plugins)의 marketplace 명령과
[Native Refresh Runbook](codex-guard-compatibility.md#codex-native-refresh-runbook)을 따른다.
0.80.0의 당시 기록은 보존한다. 현재 설치는 0.81.0이며 새 app-server에서만 로딩을 검증했다.
기존 열린 대화의 catalogue 교체와 hook 런타임 발화·권한 집행은 이 결과로 증명하지 않는다.

샘플 전체 명령의 최초 실행은 실행 관리자 16개 시험 중 재시작 후 stop returncode=1로 exit 1이었다.
그 뒤 backend·frontend·영속성 단계는 미실행이다. 임시 관찰 wrapper로 해당 시험의 stop 응답을 수집한
1회 진단은 exit 0이었다. 최초 실패를 해소하지 못했으므로 통합 판정은 **NOT VERIFIED**다.
샘플 코드는 수정하지 않았고, 불안정 시험을 재시도 PASS로 바꾸거나 기준을 내리지 않는다.
완료에는 이 실패의 원인·복구 근거와 전체 gate 성공이 필요하다. 제품 수정이 필요하면 보류 범위의
변경 승인 후 처리하며, 새 실패·진단 결과를 기존 기록에 연결한다.


같은 16개 시험에 stop 응답과 manager log 관찰만 추가한 진단은 다른 dead-control-socket 시험에서
실패했다. stop은 관리자 연결 실패, manager log는 `Operation not permitted` 였다.
권한 오류를 일으킨 시스템 호출과 최초 실패의 원인은 미확인이다. 권한 우회나 제품 수정은 하지 않았다.


독립 `harness-verifier`는 현재 문서 3개·raw digest·설치 inventory·새 skills 응답·전역 설정의
두 구역 외 동일성과 샘플 HEAD/clean 상태를 대조해 추가 finding 없음으로 보고했다.
최초 CLI 종료 코드는 실행 tool 결과에 의존하며 저장 stdout만으로 종료 코드를 재검증할 수 없다는
한계를 유지한다. 샘플 실패 원인·전체 gate·hook 발화는 여전히 미확인이다.

Harness 문서 전달을 위한 로컬 quality 63단계는 모두 exit 0이었다. 임시 venv의 ruff 0.15.15를
사용해 같은 검사 명령을 실행했다. 이 결과는 샘플 전체 gate 실패를 대체하지 않는다.

설치·실패 기록 전달과 최신 원격 CI·검토·병합 상태는
[PR #491](https://github.com/grinvi04/team-harness/pull/491)의 현재 후보 원본을 따른다.


### 승인된 샘플 종료 결함 수정과 최종 통합 (2026-10-07)

PR #491 이후 사용자가 샘플 종료 결함만 수정하고 전체 검증을 이어가도록 승인했다.
제품 로컬 커밋 `0c905a07c6a91a1f2e69c58fc186a07525c7cb83`에서 그룹 존재 조회 EPERM이
cleanup 밖으로 전파돼 관리자를 조기 종료하는 경로를 확인하고 3줄을 수정했다.
조회 권한을 우회하거나 오류를 그룹 소멸로 간주하지 않는다. 실제 부재가 확인될 때까지 소유권을 유지한다.
제품 전용 실행기는 샘플에 두며 공용 Harness 런타임·스킬·버전은 바꾸지 않았다.

[현재 근거의 completionFollowup](qa-install-v0.81.0-evidence.json)에 최초 실패와 후속 해결을 분리한다.
기존 `overall`과 `limitations`는 첫 설치/샘플 검사 시점의 역사적 snapshot이다. 현재 결과는 이 후속
객체·제품 커밋과 제품 docs/specs/local-dev-lifecycle.md, docs/verification.md가 소유한다.

새 회귀 RED 2개 후 같은 잠긴 시험 GREEN 2개, 명령 회귀 3개, canonical 전체 QA exit 0을 확인했다.
전체 QA는 실행 관리자 18개·frontend 단위 76개·Chromium 49개·실제 격리 DB 재시작·등록 재요청을
포함했다. backend check/bootJar는 Java 입력이 동일해 UP-TO-DATE로 재사용했으며 새 시험 실행으로
세지 않았다. 기존 이미지·사용자 DB 파일 지문 동일, test 계약 digest 동일, 제품 Git clean이다.
독립 `harness-security-reviewer`는 요구·diff·RED/GREEN·잠긴 시험·전체 QA 원문을 대조하고 finding
없음으로 제한된 검토 VERIFIED를 반환했다. 새 시험 2개는 검토자가 직접 재실행했고 전체 QA/DB는
재실행하지 않았다. 제품 문서 checker는 커밋 결박까지 통과했다.

최종 설치 계약 검사 exit 0과 새 app-server의 forceReload에서도 cache 0.81.0·17개 enabled·로딩
오류 0을 다시 확인했다. 이번 대화의 제공 catalogue 경로도 0.81.0이다. hook 실제 발화나 권한 강제를
스킬 발견으로 증명하지 않으며, 기존 실행 중 앱/관리자 재시작·배포는 수행하지 않았다.

이전 설치 때 설정 사본과 이번 현재 설정의 재대조는 불일치했다. Team Harness 외 변경은
node_repl 환경 키 2개와 security-guidance hook 신뢰 상태이며, 현재 파일 수정 시각은 이번 최초
진단 파일보다 앞선다. 변경 주체는 미확인이고 다른 설정을 복원하거나 수정하지 않았다. 이전
동일성 검사는 당시 결과로 보존하며 이번 전체 기간의 설정 불변성으로 확대하지 않는다.

**현재 판정:** 승인된 설치·새 세션 로딩·샘플 종료 결함 수정·전체 로컬 QA 범위는 VERIFIED다.
변경하지 않은 제품 의존성의 npm audit는 exit 1, high 6건/critical 0을 보고했다. 이 잔여 보안 작업을
이번 종료 결함의 gate와 구분해 공개하며 전체 제품 보안/모든 OS/브라우저 검증으로 확대하지 않는다.
네 소비 프로젝트 수정·배포는 계속 보류한다. 기록 전달·최종 CI·검토·병합은 [PR #492](https://github.com/grinvi04/team-harness/pull/492)의 현재 원본을 따른다.


### 샘플 의존성 보안 후속 (2026-10-07)

사용자가 잔여 작업 진행을 승인해 제품 로컬 커밋 `140b6dc727fd7d925e231dbe65c8db470c0ca887`에서
source-map-js 잠금 한 노드만 1.2.1→1.2.2로 갱신했다. 제품의 실제 설치 트리 1.2.2,
전체 최초 QA exit 0(18 lifecycle·76 unit·49 Chromium·실제 격리 DB 재시작/등록 재요청),
기존 시험·이미지·사용자 DB 보존, 독립 보안 검토와 커밋 결박 문서 검사를 확인했다.
backend UP-TO-DATE는 재사용이다. 원문/한계는 제품 docs/specs/dependency-security.md와
[dependencySecurityFollowup](qa-install-v0.81.0-evidence.json)에 연결한다.

이전 high 6건은 당시 감사 결과로 유지한다. 현재 전체 감사는 exit 1/high 5, 운영 의존성만
exit 0/0건이다. [braces 공지](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)는 수정 버전 없음이며
Stylelint의 개발용 의존 관계가 남는다. 독립 검토자도 격리 Node에서 중첩 brace 오류를 재현했다.
부분 패치 PASS와 전체 취약점 제거 FAIL/미완료를 구분한다. 후속은 호환 upstream 수정 버전
발행 후 감사·전체 QA이며, 네 소비 프로젝트 수정·배포는 재개하지 않았다.
제품 전용 수정이며 Harness 런타임·버전·전역 설정 변경은 없다. 기록 전달·CI·병합의 최신 상태는 [PR #493](https://github.com/grinvi04/team-harness/pull/493)의 원본을 따른다.

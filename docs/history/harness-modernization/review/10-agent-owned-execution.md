# 추가 실행 확인 — 세부 조사와 검증의 담당

2026-10-09 KST. 사용자의 전체 대화 지시를 목표·범위·품질 기준으로 삼는다.
필요한 세부 조사·분해·정상/실패/경계 시험·결과 판정·기록은 agent가 담당한다.
항목을 사용자가 하나씩 지정하지 않았다는 이유로 필요한 작업을 보류하거나 QA를 사용자에게 넘기지 않는다.
새 권한·비가역적 행동·추가 비용이 필요한 선택만 확인하고 합의된 방향은 다시 묻지 않는다.
‘검토 뒤 수정’ 경계를 유지했다. 원본 코드·설정·소비 문서·설치·cache·메모리는 변경하지 않았다.

## 같은 과제의 실제 Codex 호출

공식 [모델 선택 안내](https://learn.chatgpt.com/docs/model-selection)의 같은 입력 비교를 적용했다.
별도 문맥의 default 역할 세 인스턴스에 같은 TASK·candidate를 줬다. 기존 고정 역할의 모델을 호출 인자로 덮어쓰지 않았다.
비교 입력은 실제 Harness 경계 결함에서 축소한 46줄 Python fixture와 19줄 요구다.
보호 조회 실패·전체 복원 비교·새 리뷰 thread·실패한 migration·merge SHA·QA SKIP의 계약 여섯 개와 정상 대조군 두 개를 잠갔다.
과제와 판정 기준은 호출 전에 저장했다. source location은 실제 잘못된 문장을 포함하는지 확인했다.

| client 실행 metadata | 결함 검출 | 정확한 근거 위치 | 관찰 시간 | 판정 |
|---|---|---|---|---|
| Luna / xhigh | 6/6, 오탐 0 | 1/6 | 24.6초 | 핵심 검출은 통과, 근거 위치 5곳 수정 필요 |
| Sol 6.1 / medium | 6/6, 오탐 0 | 6/6 | 44.4초 | 이 과제의 검출·근거 통과 |
| Astra / medium | 6/6, 오탐 0 | 6/6 | 42.0초 | 이 과제의 검출·근거 통과 |

Luna의 잘못된 위치는 restore_equivalent·merge_ready·migration_verdict·release_target·qa_gate다.
응답 원문을 고쳐 통과처럼 만들지 않았다. 큰 effort도 근거의 정확성을 자동 보장하지 않는 표본이다.
부모가 fixture에서 정상·실패·경계 23개를 실행했다. 계약 위반 7개는 결함군 여섯 개에 대응한다.
각 모델의 선택 model/effort는 실행 transcript의 turn_context에서 확인했다. 자기소개나 설정 파일 값으로 대신하지 않았다.
도구 호출은 파일 읽기와 메모리 내 Python 시험뿐이었다. 파일 쓰기 0을 명령과 fixture/source digest로 대조했다.
읽기 전용은 부여한 작업 계약이다. underlying sandbox가 쓰기를 금지한 전용 역할이라고 주장하지 않는다.

[입력·고정 기준](../bounded-model-review-manifest.json), [요구](../bounded-model-review/TASK.md),
[실행·응답·사용량·판정](../bounded-model-review-results.json), [부모의 반례/정상 시험](../bounded-model-review-oracle.json).
초기 metadata 수집기의 custom_tool_call 누락은 보존한 [초기 수집](../bounded-model-review-runtime.json)에 표시했고 최신 결과에서 정정했다.

## 실제 사용량과 비용 한계

| 설정 | 누적 입력 | 그중 cache 입력 | 출력 | 그중 reasoning 출력 |
|---|---|---|---|---|
| Luna/xhigh | 140,145 | 90,624 | 2,091 | 1,189 |
| Sol 6.1/medium | 142,256 | 93,568 | 1,371 | 49 |
| Astra/medium | 129,762 | 84,864 | 1,510 | 23 |

출력과 reasoning은 더해서 두 번 세지 않는다. cache도 입력의 부분집합이다.
계정의 실제 차감 크레딧·과제별 청구 금액은 제공되지 않았다. raw token 수를 구독 비용 순위로 바꾸지 않는다.
각 설정 한 번의 좁은 과제이며 API 가격·서버 대기·tokenizer·전체 수정 비용을 통제한 benchmark가 아니다.
전체 Harness 역할·구현·UI·Claude·effort 간 비교 완료나 모든 과제의 최적값을 주장하지 않는다.

세 실행의 첫 요청 입력은 42,124~46,360 tokens였다. 전체 대화를 fork하지 않아도 전달 문맥이 작다고 보장되지 않는다.
작은 TASK/fixture의 줄 수만으로 사용량이 결정되지 않았다. 이 측정만으로 도구·지침별 정확한 점유율은 확정하지 않는다.
MD 199줄과 함께 필수 읽기 범위·초기 전달 문맥·cache·출력·재작업을 확인하도록 계획에 연결했다.
단가가 낮거나 더 빨랐다는 이유로 잘못된 근거를 최종 검증 품질로 채택하지 않는다.
이번 결과는 Sol 6.1/medium을 일반 작업 후보로 유지할 근거이며 Astra의 중요 판단 배정을 일괄 제거할 근거는 아니다.

## Claude 앱 내부의 추가 확인

앱 2.26454.2의 패키지 본문을 읽었다. 실행/다운로드/설정 저장 코드를 호출하지 않았다.
패키지에 담긴 Claude Code target manifest는 2.1.293, SDK wrapper는 0.3.293 계열이다. 서로 다른 버전 축이다.
app data에서 확인한 설치 바이너리는 2.1.205이며 --version도 2.1.205를 반환했다.
터미널의 2.1.267과 앱 target manifest·남아 있는 설치 버전을 구분한다.
앱 package의 preseed 경로에는 바이너리를 찾지 못했다. 앱이 현재 어떤 binary/model을 실제 선택했는지는 확인하지 않았다.
manifest만으로 최신 모델 호출 성공을 보고하지 않는다. CLI 자동 업데이트나 설치 다운로드는 하지 않았다.
[공식 최소 조건](https://code.claude.com/docs/en/model-config)은 Opus 5.5 2.1.280+, Sonnet 5.5 2.1.284+, Haiku 5.5 2.1.293+다.

| 앞서 미확인이던 키 | 현재 추가 근거 | 남은 판정 |
|---|---|---|
| enableWorkflows | 앱 내부 optional boolean schema, 설정 전달·기능 제한 소비 코드 | 존재/지원 인식 확인; 계정 활성화·실제 실행과 구분 |
| skipWorkflowUsageWarning | optional boolean schema, workflow 동의 읽기·저장 소비 코드 | 오래된 무효 키로 삭제할 근거 없음; 기존 사용자 동의를 agent가 새로 켜지 않음 |
| skipAutoPermissionPrompt | restrictive merge 목록에서 이름 발견, 전체 JS에서 schema/직접 소비 정의 미발견 | 일부 이름 참조만 확인; 지원 runtime 검사 전 무효/삭제로 단정하지 않음 |

[패키지 schema/소비 근거](../claude-app-bundled-review.json), [실행기 경로·선택 코드](../claude-app-resolution-contract.json), [설치/버전 관찰](../claude-app-install-evidence.json).
패키지 내부 인식은 실제 설정 효력이나 hook dispatch의 증명이 아니다. 미확인을 사용자 테스트 요청으로 바꾸지 않는다.

## 이후 확인을 맡는 방식

1. 최신 Claude 실행기·plugin 준비는 적용 단계의 agent 작업이다. 사용자가 직접 재현·시험해야 하는 항목으로 두지 않는다.
2. 남은 역할별 로딩·명시/누락 모델·권한·실제 hook은 안전한 후보에서 정상/거부 입력과 metadata로 확인한다.
3. 실제 변경 후보가 생겨야 가능한 이전/설치 검증은 그 단계의 완료 gate로 남긴다. 현재 검토만으로 PASS를 채우지 않는다.
4. 최신 X 원문은 로그인 없는 공개 경로에서 확보하지 못한 상태를 보존한다. 접근/비용을 우회하지 않고 후기 부재를 게시글 부재로 말하지 않는다.
5. 관련 보고서·계획·지시 대조를 이번 증거와 함께 갱신했다. 원본 상태는 [현재 대조](../ownership-review-source-state.json)에 연결했다.

요구 누락을 찾는 책임은 agent에게 있다. 지시 표의 행 수나 발견 ID를 모두 연결했다는 사실을 완전성 증명으로 쓰지 않는다.

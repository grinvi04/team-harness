# 최신 모델·전역 설정 검토

[전역 범위 추가 확인](06-global-scope-addendum.md)에서 모델 외 설정·관리 계층·설치 버전·셸 진입부를 보강했다.

## 현재 설치와 설정

2026-10-09 최신 재확인: 터미널 Codex CLI 0.161.0, 터미널 Claude Code 2.1.267. 초기 관찰 Codex 0.156.1은 업데이트 전 값이다.
초기 도구 관찰 gh 2.92.0·curl 8.7.1과 최신 버전/원본 확인을 [현재 증거](../planning-source-state.json)로 구분한다.
사용자는 두 데스크톱 앱 업데이트를 알렸다. 추가 확인한 ChatGPT 내장 Codex는 0.162.0-alpha.2이며 터미널 버전과 다르다.
앱·CLI의 관찰값과 실행 위치 권고는 [실행 환경 검토](08-execution-environment.md)에 구분했다.
전역 Codex 선택값: gpt-6.1-sol/medium, review gpt-6-astra, 기본 subagent gpt-6-sol/medium, workspace-write.
전역 policy의 Astra/high와 현재 선택값은 모두 관찰한 기존 상태다. 저장돼 있다는 이유로 새 설계의 기준이나 유지 대상으로 삼지 않는다.
사용자가 이번 세션 모델을 바꿨다는 지시는 존중하지만 root runtime 모델·effort의 실제 적용을 config만으로 확정하지 않았다.

고정 역할 6개를 읽었다: explorer Luna/high, verifier Sol/high, security Astra/high, bounded worker Luna/high, critical verifier Astra/high, mapper Luna/high.
조사·검증 역할은 읽기 전용, bounded worker만 지정된 쓰기 권한이다. 권한·독립성 계약과 모델·effort 배정은 따로 판단한다.
현재 고정 역할은 호출 인자로 덮어쓸 수 없지만, 그 구현 제약이 기존 배정의 적합성을 뜻하지 않는다. 수정 단계에서 역할 정의 자체를 재설계한다.
Claude 사용자 설정은 model sonnet, effortLevel high이고 modelSettings·switchModelsOnFlag·availableModels는 설정되지 않았다.
비밀 provider 인증정보는 읽거나 출력하지 않았다. 실제 client·provider alias mapping은 모델 이름 문자열과 구분해야 한다.

## M01 — Sol을 전면 교체할 공식 근거는 없다

[Codex 공식 실무 안내](https://learn.chatgpt.com/guides/best-practices)는 가용한 GPT-6.1 Sol과 해당 client 기본 effort를 출발점으로 권장한다.
Luna는 high, Astra는 low에서 시작해 작업과 결과에 따라 조정하라고 설명한다. 이를 모든 역할의 고정 effort로 일반화하지 않는다.
Sol을 모든 작업에서 배제하거나 모든 역할을 Astra 최고 effort로 올릴 근거는 확보하지 못했다.
역할별 후보는 요구 품질·실패 위험·자체 완결성·독립 검증 필요·전체 사용량으로 선택해야 한다.
같은 과제에서 성공률·재작업·검토 비용까지 비교하기 전에는 현재 조합을 최적이라고 확정하지 않는다.
사용자는 Sol 6.1 기본·중요한 판단/독립 검증 Astra의 설계 방향을 선택했다. 기존 역할 모델·effort를 그대로 유지하라는 선택은 아니다.
최신 공식 권고는 출발점이며 실제 설정 변경·과제 비교 완료와 구분한다.

## M02 — Spark의 낡은 선택지를 제거해야 한다

같은 공식 안내에서 GPT-5.3-Codex-Spark는 2026-09-14 Codex 로그인 경로에서 retired로 명시된다.
현재 Codex 모델 운영 문서에 남은 Spark 선택지·이전 모델 안내는 현행 지원 범위와 대조해야 한다.
ChatGPT 로그인과 API의 수명·모델 가용성을 섞지 않는다. 실제 provider가 다른 모델로 전환했다고 추측하지 않는다.

## M03 — 터미널 Claude CLI가 최신 5.5 모델의 최소 버전보다 낮다

[Claude 공식 설정](https://code.claude.com/docs/en/model-config): Opus 5.5는 2.1.280+, Sonnet 5.5는 2.1.284+, Haiku 5.5는 2.1.293+가 필요하다.
현재 PATH의 2.1.267은 이 최소 버전들보다 낮다. 이 관찰을 업데이트된 Claude 데스크톱 앱 내부 실행기 버전으로 확대하지 않는다.
alias sonnet 설정만으로 최신 Sonnet이 실행됐다고 보고하면 안 된다.
클라이언트 지원을 먼저 맞춘 뒤 provider·alias·actual model을 확인해야 한다. 이번에는 업데이트·실제 최신 모델 호출을 하지 않았다.
같은 공식 안내의 Fable 5.1도 장기 작업 후보지만, 이름만으로 모든 상위 역할을 바꿀 근거는 아니다.

## M04 — Claude 사용자 effortLevel high의 적용 방식

공식 안내에서 Opus 5.5 이후 모델은 사용자 전역 top-level effortLevel 대신 기본 medium 및 모델별/session 설정을 사용한다.
현재 modelSettings가 없으므로 최신 모델 전환 뒤에도 high가 그대로 적용된다는 전제를 지침에서 제거해야 한다.
Claude Code의 Opus 5.5·Sonnet 5.5·Haiku 5.5 기본은 medium이다. API 모델 전체의 기본값과 혼용하지 않는다.
Opus 5→5.5는 이전 effort를 이월하지 말고 medium에서 시작하라는 공식 권고가 있다.
프로젝트/로컬/managed 설정, 환경변수, 세션 선택은 별도 우선순위와 적용 범위를 가진다. max의 저장/세션 범위도 구분한다.
Claude 모델 호출을 하지 않았으므로 실제 effort 결과를 추정해 PASS로 기록하지 않는다. Codex의 제한된 실제 비교는 아래 추가 보고서로 구분한다.

## M05 — SNS 검토의 근거 수준

X 로그인 없이 공개 검색했다. 최신 GPT-6.1 Sol/Opus 5.5의 관련 원문 표본을 충분히 확보하지 못했다. 오래된 결과를 최신 후기처럼 쓰지 않았다.
[Sol 발표 사용자 반응](https://www.reddit.com/r/codex/comments/1wtfui8/gpt_61_sol_is_here/)과 [지속성 불만 사례](https://www.reddit.com/r/codex/comments/1wz00n8/gpt_61_sol_is_so_incredibly_lazy_compared_to_astra/)는 상반된 경험을 보여준다.
공개 사용자가 낸 텍스트·시각 benchmark와 글쓰기 평가도 봤지만 우리 코드 과제의 통제된 비교는 아니다.
후기는 시험할 가설을 만드는 데 쓰고, 공식 지원·현재 설정·원본 반례·동일 과제 비교를 대체하지 않는다.

## M06 — 모델 티어링의 다음 비교 기준

[공식 모델 선택 안내](https://learn.chatgpt.com/docs/model-selection)는 같은 입력에서 비교하고 품질 기준을 충족하는 가장 가벼운 설정을 유지하도록 권고한다.
공식 Sol/medium·Astra/medium·xhigh 작업 예시와 Claude의 모델별 기본·검증 중심 high 권고를 아래 시험 후보에 연결했다.
표는 이 프로젝트에 대한 설계 추론이다. 공급자가 아래 Harness 역할 조합의 최적성을 보장한 것은 아니다.

| 작업·원래 품질 기준 | Codex 시험 후보 | Claude 시험 후보 |
|---|---|---|
| 경로·근거 수집 등 제한된 조사 | Luna/high 출발; 단순 추출에서는 low와 비교 | Haiku 5.5/medium 출발; 사람이 매 결과를 확인하는 작은 작업에서 low와 비교 |
| 여러 출처의 맥락 종합·긴 조사·엄격한 지시 준수 | Luna/xhigh와 high 비교; max는 추가 이득을 측정할 후보 | Haiku 5.5/high와 medium 비교; xhigh/max는 Sonnet 5.5와도 비교 |
| 범위가 명확한 구현·일반 검토 | Sol 6.1/medium | Sonnet 5.5/medium |
| 원인 불명 버그·연결 경계·복잡한 검증 | Sol 6.1/medium·high 비교 | Sonnet 5.5/high와 Opus 5.5/medium 비교 |
| 중요한 설계 판단·보안·독립 검증 | Astra/medium·high 비교; 까다로운 요구는 xhigh 후보 | Opus 5.5/medium·high 비교; xhigh/max는 필요성과 이득을 입증할 예외 후보 |

보안·독립 검증에는 강한 모델을 처음부터 선택할 수 있다. 모든 과제를 작은 모델부터 순서대로 통과시키지 않는다.
GPT-6 Sol 같은 이전 지원 모델은 자동 폐기하지 않되, 단지 현재 역할에 적혀 있다는 이유로 유지하지 않는다.
Fable 5.1은 장기·고난도 과제의 추가 후보다. 현재 기본으로 포함하거나 추가 결제·크레딧 사용을 켜지 않았다.
상향은 추론 실패·남은 위험·예산으로 결정한다. 인증·도구·환경 실패를 비싼 모델로 재시도하지 않는다.
완료 품질, 누락·오류, 수정 횟수, 독립 검토 후 남는 문제, 전체 소요 시간·사용량을 측정한다.
Codex와 Claude의 effort 이름이 같아도 같은 연산량·품질이라고 가정하지 않는다.
현재 역할 호출/구성 점검과 실제 품질·비용 최적화 시험은 분리한다. 이후 Codex 세 설정의 같은 fixture 비교·시간·token을 측정했다. [실제 결과](10-agent-owned-execution.md)는 좁은 표본이며 전체 최적화 완료가 아니다.

저렴한 모델과 높은 effort의 조합은 유효한 시험 후보이며, 저렴하다는 이유로 추론 강도를 낮게 고정하지 않는다.
그러나 저렴한 모델 모두에 xhigh/max를 상시 강제하라는 공식 공통 규칙은 확인하지 못했다.
[Luna의 공식 작업 예시](https://learn.chatgpt.com/docs/model-selection)는 단순 추출 low와 여러 맥락 종합 xhigh를 나눈다. API default medium은 Codex 출발점 high와 별개다.
[Haiku 5.5 전용 지침](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5)은 대부분 medium, 긴 작업·엄격한 지시 준수 high를 제시한다.
xhigh/max는 평가에서 비용에 상응하는 품질 이득이 있을 때 사용하고 Sonnet 5.5와도 품질·비용·속도를 비교하라고 명시한다.
effort를 높인다는 사실만으로 큰 모델의 능력·독립 검증·실제 테스트를 대체했다고 판단하지 않는다.

## M07 — Claude 강제 훅과 Codex 역할 정의도 재설계 대상

[현재 Claude 훅](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/scripts/enforce-subagent-model.py#L24)은 타입별 TIER로 명시 모델까지 덮어쓴다.
general-purpose/opus→sonnet, Explore/sonnet→haiku를 격리 입력 시험으로 재현했다. 현재 훅에는 effort 조정이 없다.
작업 난도·최신 모델의 능력·effort·실패 위험을 고려하지 않는 이 매핑을 새 모델 이름만 붙여 유지하지 않는다.
verifier 누락 시 opus를 채우는 DEFAULT도 품질 하한이 입증된 것은 아니며, 새 역할 기준과 함께 재평가한다.

[Claude native subagent 계약](https://code.claude.com/docs/en/sub-agents#choose-a-model)의 model/effort 정의·상속·호출 우선순위로 옮기는 것이 우선안이다.
기본 Explore는 현재 공식 안내에서 main 모델을 상속하며, 별도 Explore 정의로 작은 모델을 선택할 수 있다. 과거 기본 동작을 전제하지 않는다.
타입 이름만으로 작은 모델을 강제하는 훅은 대체 검증 뒤 제거하는 방향이다. 누락 기본값 보정도 native 정의와 중복이면 제거한다.
예산 제한을 실제로 강제할 필요가 있으면 native 모델 허용 목록·effort 상한의 지원과 범위를 따로 확인한다. effort는 비용의 절대 상한이 아니다.
사용자가 앞으로 해당 작업에서 직접 지정하는 모델·effort는 새 승인 정책 안에서 존중한다. 과거 저장값은 이와 구분한다.

Codex config·model-policy·고정 역할 TOML·Harness tiering·Claude 역할/훅·템플릿·installer/checker·직접 소비 문서의 충돌을 같은 수정 범위에서 해소한다.
모델 배정 변경으로 읽기 전용 권한·writer 소유 경로·독립 인스턴스·필수 QA·서버 gate를 약화하지 않는다.
플랫폼별 실제 지원값과 최종 model/effort를 확인한다. 훅 입력 로그는 최종 실행 모델의 증명이 아니다.

## 문서 구조에 영향을 주는 공식 사실

[AGENTS 안내](https://learn.chatgpt.com/docs/agent-configuration/agents-md): global→project 경로의 진입 문서, fallback, 기본 32KiB 프로젝트 문서 제한을 확인해야 한다.
현재 핵심 문서가 실제로 잘렸다는 증거는 없다. 199줄만으로 제한과 정보 전달을 보장할 수는 없다.
[Skill 안내](https://learn.chatgpt.com/docs/build-skills): metadata와 필요 시 SKILL 본문·reference를 점진적으로 읽는다. 공식 199줄 규칙은 아니다.
[Hooks 안내](https://learn.chatgpt.com/docs/hooks)와 [보안 안내](https://learn.chatgpt.com/docs/enterprise/agent-security)는 host별 도구·hook coverage와 cloud/local 경계를 구분한다.
Hook 설정이 존재하거나 직접 분류기가 통과/거부했다는 사실만으로 해당 host의 실제 tool interception을 증명하지 않는다.

## 적용 시의 순서

1. 최신 공식 지원·권고와 현재 client/provider의 적용 범위를 확인한다. 기존 값은 기준에서 제외하고 이관 입력으로만 기록한다.
2. 원래 수용 기준·실패 위험·권한·독립성을 고정하고 위 모델/effort 후보를 선정한다. API 기본값을 Codex 기본값으로 대입하지 않는다.
3. 같은 과제·입력·도구·권한에서 근거 수집, 알려진 결함, 거부/허용 경계, 완료 판정을 비교한다. 평가자가 원래 기준으로 오류·누락을 판정한다.
4. 품질 기준을 충족한 후보끼리 최초 성공·재시도·통합·독립 검토를 포함한 시간·사용량을 비교해 배정을 결정한다. 실제 실행하지 않은 비교는 미확인이다.
5. 수정 승인 후 설정·역할·훅·직접 소비 문서를 함께 적용하고 새 세션에서 로딩·최종 모델/effort·실제 권한/검사 집행을 확인한다.
OpenAI의 지원 effort 유지 안내는 호환 이관 출발점이다. 이번 재설계에서 기존 값의 최적성이나 영구 유지 근거로 쓰지 않는다.
최신 공식 문서도 같은 이름의 effort가 모델 간 동일한 연산량·품질이라는 전제를 두지 않는다.
이번에는 전역 지침·설정·역할·캐시·메모리를 변경하지 않았다.

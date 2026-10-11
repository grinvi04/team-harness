# 모델·추론 선택 — Claude Code와 Codex

Team Harness는 요구 품질·권한·독립 검증·실행 증거를 소유하고, 모델 선택·상속·effort 적용은 플랫폼에 위임한다.
모델 크기와 추론 강도는 별도 선택이다. 단순·연속 작업을 티어링 때문에 쪼개지 않는다.

## 운영 출발점과 현재 적용 상태

| 작업 | Codex 후보 | Claude 후보 | 권한·검증 계약 |
|---|---|---|---|
| 좁은 탐색·근거 수집 | Sol 6.1/medium; Luna는 과제별 비교 | Haiku 5.5/medium | 읽기 도구만; 파일·라인 근거 |
| 일반 구현·명확한 소유 파일 | Sol 6.1/medium | Sonnet 5.5/medium | 소유 파일과 판정 기준 명시 |
| 중요한 설계·보안·독립 최종 검토 | Astra/medium | Opus 5.5/medium | 구현자와 다른 인스턴스; 읽기만 |

이 표는 승인된 현대화 방향과 공식 권고를 연결한 출발점이다. 모든 과제의 최적값을 입증한 표가 아니다.
높은 effort는 누락 위험·과제 난도·측정된 이득으로 고른다. 저렴한 모델의 xhigh/max도 상시 강제하지 않는다.
환경·인증·도구 실패를 더 비싼 모델·다른 공급자·추가 결제로 해결하지 않는다.

현재 소스의 verifier·security-reviewer는 native `model: opus`, `effort: medium`, `tools: Read, Grep, Glob`을 선언한다.
실행·수정·하위 위임 도구를 제외했다. 필요한 명령 결과는 부모가 제공하고, 누락된 결과는 미확인으로 보고한다.
역할 설정 검사는 실제 모델 추론·권한 차단·품질 검증과 별개다.

**소스 이전:** 타입별 강제 hook 등록을 제거하고 이전 호출 경로는 입력을 소비하는 무수정 호환 no-op으로 남겼다.
명시·상속·unsupported 입력 48개에서 덮어쓰기·로그 변경이 없는 것을 확인했다. 이는 native 실행 성공과 별개다.
전역 설정 15개 파일과 후속 권한 안내 2개를 적용하고 새 Codex 역할 여섯 개를 호출했다. Claude 실제 상속·effort·권한은 사용자 요청으로 인증 갱신 후 재개한다.
현재 증거와 재개 조건은 [Phase 3 실행 기록](history/harness-modernization/execution-m3ac.json)을 따른다.

## Claude native 선택

[공식 모델 설정](https://code.claude.com/docs/en/model-config)의 Anthropic 경로에서 opus/sonnet/haiku는 각 5.5 계열을 가리킨다.
다른 공급자의 alias 버전은 다를 수 있다. Opus 5.5는 CLI 2.1.280+, Sonnet 5.5는 2.1.284+, Haiku 5.5는 2.1.293+가 필요하다.
세 모델의 Claude Code 기본 effort는 medium이며 effort 척도는 모델마다 보정된다. 이전 모델의 high를 자동 이월하지 않는다.
CLI 버전·앱 내부 실행기·현재 세션은 각각 확인한다. CLI 업데이트를 앱 실행 반영으로 보고하지 않는다.

[공식 subagent 계약](https://code.claude.com/docs/en/sub-agents#choose-a-model)은 명시 호출, 역할 model, 환경 기본값, 부모 model 순서와 예외를 정의한다.
`model: inherit`는 부모 모델을 선택한다. 기본 Explore가 과거처럼 항상 Haiku라고 가정하지 않는다.
역할 `effort`와 세션·환경·managed 설정의 우선순위를 확인한다. plugin 역할의 permissionMode는 무시되므로 그것만으로 읽기 권한을 주장하지 않는다.
읽기 역할의 도구 목록에서 Write/Edit/Bash와 다른 코드 실행 도구를 제외한다. worker의 파일 제한은 별도 native permission 규칙으로 확인한다.
[공식 skill frontmatter](https://code.claude.com/docs/en/skills#frontmatter-reference)의 `effort`는 세션 값을 덮어쓴다.
공용 스킬 12개에 남았던 low/high/max 등 고정값은 제거했다. 본문·QA·권한 계약은 유지하고,
스킬 실행은 명시적 선택과 모델별 native effort 해석을 따른다. 역할의 medium 출발점과는 별도 계약이다.
Claude 실제 skill effort 상속은 인증 복구 후 확인하며, source 검사만으로 실제 적용을 주장하지 않는다.

2026-10-09 지원 CLI 2.1.295의 격리 실행에서 시작 모델 claude-haiku-5-5와 Read/Grep/Glob 도구 목록을 관찰했다.
그러나 OAuth 인증이 실패해 `modelUsage`는 비었고 추론·도구 사용·effort 적용은 확인하지 못했다. Sonnet·Opus·inherit·worker 후속 호출은 미실행이다.
이 시작 정보는 실제 모델 응답이나 품질·권한 집행의 증명이 아니다. 사용자가 OAuth 갱신을 나중으로 미뤘으므로 추가 Claude 호출은 하지 않는다. 명시적 인증 복구 뒤 승인된 호출 예산으로 재개한다.

## Codex native 선택

Team Harness 설치는 사용자의 Codex 전역 agent TOML이나 모델 기본값을 덮어쓰지 않는다.
현재 task의 model·reasoning effort·sandbox는 native surface와 승인된 사용자 설정이 결정한다.
Sol 6.1 일반 작업·Astra 중요한 판단을 전역 설정에 적용했다. 실제 새 역할 실행 검증과 설치된 plugin 갱신은 별도 단계다.

기존 [고정 과제 비교](history/harness-modernization/bounded-model-review-manifest.json)는 Sol 6.1/medium·Astra/medium·Luna/xhigh로 같은 작은 입력을 검토했다.
각 설정은 여섯 결함을 찾고 두 정상 함수를 구분했다. Luna의 일부 라인 근거는 정확하지 않았다.
한 과제의 표본이며 다른 구현·보안 과제나 xhigh의 추가 품질 이득을 입증하지 않는다. 실행 권한은 요청과 실제 sandbox 기록을 구분한다.
새 역할 후보의 read-only sandbox와 worker 소유 계약을 유지한다. 설정 변경이 열린 대화나 예약 작업의 명시 모델을 소급 변경한다고 가정하지 않는다.

[실제 workflow 수정 표본](history/harness-modernization/execution-m3-representative.json)에서는 동일한 11개 회귀 기준을 잠갔다.
요청한 Sol 6.1/medium과 Luna/xhigh 모두 한 번의 수정으로 통과했고 별도 oracle도 통과했다.
관찰 시간은 48.731초와 85.846초였고 이 표본의 Sol 사용량이 적었다. ephemeral 출력이 실제 model/effort metadata를 제공하지 않아 그 적용값은 미확인이다.
Luna/medium과 비교하지 않았으므로 xhigh의 추가 이득·모든 과제의 최적값·구독 비용 절감을 입증하지 않는다.
후속 독립 검토가 추가한 검토 상태 누락 경계에서는 두 저장 후보 모두 실패했다. 새 추론 없이 같은 확장 oracle로 확인했고 현재 소스에서 고쳤다.
앞의 시간/사용량은 당시 11개 기준의 결과이며 현재 전체 품질 통과로 사용하지 않는다.

새 CLI의 실제 여섯 역할 호출에서 모델/medium 적용은 확인했다. 쓰기 가능한 부모 아래에서는
다섯 read-only TOML도 실제 metadata가 workspace-write였다. 별도로 read-only 부모를 명시한 새 실행에서는
다섯 자식의 read-only policy를 확인했다. 독립 검증에는 이 별도 실행 경로를 사용한다.
읽기 행동만으로 쓰기 거부를 증명하지 않는다. [호출 증거](history/harness-modernization/execution-m3-native-role.json)는
설정 적용·실제 policy·도구 행동·기존 별도 거부 시험을 구분한다. 앱의 현재 열린 역할에는 소급 적용을 주장하지 않는다.

고정 역할을 호출 인자로 덮어쓸 수 있다고 가정하지 않는다. 전체 문맥 복사와 독립 문맥 전달의 실제 상속 규칙을 확인한다.
부모는 통합·테스트 계약·최종 인수를 맡고 검토자는 후보를 수정하지 않는다. 모델 이름 변경은 검증자 독립성을 만들지 않는다.
권한·동시 writer 조건은 [native 실행 계약](../plugins/harness-guard/codex/native-runtime.md)을 따른다.
설정·역할 지원은 [공식 Codex Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)와 현재 도구 목록에서 확인한다.

## 결과 판정과 사용량

- 설정 파싱, 시작 시 선택, 실제 modelUsage/effort, 실제 tool/permission 결과, 품질 비교를 각각 기록한다.
- command·cwd·입력 hash·원래 기준·최초 실패·재시도·최종 exit를 연결한다. 실패한 auth를 모델 품질 실패로 분류하지 않는다.
- 현재 후보를 독립적으로 검토한다. 검증자가 후보를 작성했다면 다른 인스턴스에 맡긴다.
- 필요한 검사·권한 경계가 미실행이면 UNVERIFIED다. hook 감사 로그나 모델 자기소개를 실제 모델 증거로 쓰지 않는다.
- 시간·input/output/thinking/cache usage를 같은 과제와 환경에서 비교한다. 로컬 토큰·API 단가를 구독 차감량으로 환산하지 않는다.
- Fast mode는 effort와 별도 선택이다. 사용 비중을 맞추거나 비용 절감이 입증됐다고 추정해 켜지 않는다.
- 목표가 바뀌고 이전 문맥이 불필요하면 native clear/compact 사용을 제안할 수 있다. 사용자 문맥과 재작업 비용을 고려하며 임의로 대화를 지우지 않는다.

`tests/native-model-contract-test.sh`는 현재 역할의 설정 회귀만 검사한다.
`tests/enforce-subagent-model-test.sh`는 호환 경로가 모델 선택과 로그를 바꾸지 않는지 검사한다.
등록·wiring·surface 검사와 실제 새 세션 증거는 서로 다른 결과로 기록한다.

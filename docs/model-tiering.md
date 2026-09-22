# 모델·추론 티어링 — Claude Code와 Codex

작업 난이도는 공통으로 분류하되, 제어 방법은 런타임별로 분리한다. Claude의 모델명·skill `effort`를
Codex에도 적용된다고 표현하지 않고, Codex agent 생성·모델·reasoning effort는 플랫폼에 위임한다.

## 공통 난이도

| 난이도 | 작업 | 필요한 추론 |
|---|---|---|
| 낮음 | 파일 탐색·상태 조회·정형 검사·헬스 체크 | 좁은 범위, 판단이 적음 |
| 중간 | 구현·테스트 작성·lint/CI 수정·일반 코드 리뷰 | 여러 제약을 연결하는 실무 추론 |
| 높음 | 설계·보안·복잡한 원인 분석·릴리즈 판정·최종 반증 | 넓은 영향 범위와 독립 검증 |

가장 낮은 단계로 시작하되 누락 위험과 비가역성이 커지면 추론량을 올린다. 읽기 전용 탐색과 쓰기 작업은
모델 비용뿐 아니라 권한도 분리한다.

## Claude Code 매핑

| 역할 | 기본 모델 계열 | skill effort | 저장소의 강제 지점 |
|---|---|---|---|
| Explore·조회 | Haiku | low | `enforce-subagent-model.py`가 Explore→haiku |
| general-purpose·구현 | Sonnet | medium/high | 훅이 general-purpose→sonnet |
| verifier·security-reviewer | Opus | high/max | agent frontmatter + 훅의 품질 하한 |

- `SKILL.md`의 `effort:`는 Claude Code가 skill 수행에 사용할 추론량을 정한다. 모델 선택과 같은 개념은 아니다.
- 메인 세션 모델은 계정·사용자 선택을 따른다. 문서는 특정 시점의 최신 버전 번호나 모든 사용자에게 같은
  기본 모델을 가정하지 않는다.
- 역할별 모델 강제 결과는 Claude hook 로그로 감사할 수 있다.

## Codex 매핑

Team Harness는 Codex 전용 agent TOML이나 model slug를 배포하지 않는다. 현재 task와 native agent가 사용할
모델·reasoning effort·sandbox는 Codex의 지원 surface와 사용자 설정이 결정한다. 하네스는
범위가 명확한 저위험 구현, 증거 수집, 독립 검토에 필요한 계약을 native 역할에 전달한다.

사용자가 전역 custom agent에 특정 모델·effort를 설정했다면 그것은 개인/조직의 실행 설정이다.
Harness 설치가 그 값을 같은 이름의 역할 기본값으로 덮어쓰거나 모든 역할에 일괄 적용하지 않는다.
확인할 때는 현재 플랫폼의 전역·프로젝트·역할 설정과 실제 실행 정보를 구분한다.
Fast mode는 reasoning effort와 별도의 속도·사용량 선택이며 Harness는 이를 켜거나 강제하지 않는다.
저장된 기본값만으로 작업별 실제 적용을 확정하지 않는다. 설정 방법은 [Codex 공식 Speed 안내](https://developers.openai.com/codex/speed/)를 따른다.

| 역할 | model | model_reasoning_effort | 권한 |
|---|---|---|---|
| native 탐색 역할 | Codex 선택 | Codex 선택 | read-only 요청 |
| 범위가 명확한 저위험 구현·테스트 | 승인된 native worker 설정 | 해당 역할 설정 유지 | 소유 파일·검사·중단 조건 명시 |
| 일반 구현·오케스트레이션 | 현재 모델 유지 | 작업에 맞는 기본값 | 현재 task 권한 |
| native verifier 역할 | Codex 선택 | 높은 반증 추론 요청 | read-only 요청 |
| native security reviewer 역할 | Codex 선택 | 높은 보안 추론 요청 | read-only 요청 |

Claude 전용 `effort:`가 Codex에서 강제된다고 가정하지 않는다. 이미 승인된 사용자 역할이 예를 들어
Luna/max를 좁은 구현에 배정했다면 적합한 작업에서 그 역할을 사용한다. 탐색용 Luna/high를 호출했다고
구현용 Luna/max가 사용됐다고 보고하지 않는다. 설정이 max이면 사용량을 늘리기 위해 바꾸지 않는다.

위임 전에 호출 도구의 현재 지원값·상속 규칙을 확인한다. 전체 대화 복사가 부모 설정을 상속하는 도구라면
필요한 원본·범위만 전달하는 독립 컨텍스트를 사용한다. 고정 역할에 다른 모델 인자를 넣어 덮어쓴다고
가정하지 않는다. 직접 처리·위임은 문맥 전달과 통합 비용까지 비교해 결정하고 모델별 호출 할당량은 만들지 않는다.
부모가 테스트 계약 검수·Git 통합·최종 인수를 맡으며 검증자는 후보를 수정하지 않는다.
권한·동시 writer 조건은 [native 실행 계약](../plugins/harness-guard/codex/native-runtime.md)을 따른다.

### 실제 사용 점검

- 설정 검사와 실행 기록 집계를 분리한다. 최근 7일이라면 시작·종료 시각과 호스트 범위를 고정한다.
- 실제 turn의 model/effort·역할별 호출을 확인한다. 수정 시각만 최근인 오래된 thread를 최근 실행으로 세지 않는다.
- 토큰은 해당 기간의 실행 usage를 쓰고, 누적 snapshot은 중복 합산하지 않는다. thread의 평생 토큰을
  주간 사용량으로 쓰지 않는다. 기록이 없거나 분류가 불가능한 값은 미확인으로 둔다.
- 로컬 기록을 계정 전체 사용량이나 구독 차감량으로 환산하지 않는다. 대화 본문·인증정보는 집계에 불필요하다.
- 사용 비중이 낮으면 역할 미호출·부모 설정 상속·workflow의 위임 제한부터 확인한다. 낮은 비중 자체는
  결함이 아니며 적합한 작업이 없었다면 그대로 둔다. 효과 비교를 하지 않았다면 비용 절감·최적성을 주장하지 않는다.

공식 역할·상속·권한 설명은 [Codex Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)를 참고한다.

## workflow 적용

| 단계 | 공통 난이도 | Claude Code | Codex |
|---|---|---|---|
| 영향 범위 탐색 | 낮음 | Explore / Haiku / low | native explorer / 플랫폼 선택 |
| RED·GREEN 구현 | 중간 | general-purpose / Sonnet / high | 직접 수행 또는 승인된 bounded worker / 역할 설정 |
| 보안·릴리즈 사전 검증 | 높음 | security-reviewer / Opus / max | native security reviewer / 플랫폼 선택 |
| 완료 주장 반증 | 높음 | verifier / Opus / high | native verifier / 플랫폼 선택 |

정확한 현재 계약은 Claude Code의 skill·model 문서와 Codex의 skill·agent 설정 문서를 확인한다. 저장소에서는
`tests/enforce-subagent-model-test.sh`와 `tests/codex-skill-mapping-test.sh`가 위 매핑의 회귀를 막는다.

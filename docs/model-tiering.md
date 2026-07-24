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
모델·reasoning effort·sandbox는 Codex의 지원 surface와 사용자 설정이 결정한다. 하네스 skill은 필요한 경우
읽기 전용 증거 수집·보안 검토·반증 수용기준만 전달한다.

| 역할 | model | model_reasoning_effort | 권한 |
|---|---|---|---|
| native 탐색 역할 | Codex 선택 | Codex 선택 | read-only 요청 |
| 일반 구현·오케스트레이션 | 현재 모델 유지 | 작업에 맞는 기본값 | 현재 task 권한 |
| native verifier 역할 | Codex 선택 | 높은 반증 추론 요청 | read-only 요청 |
| native security reviewer 역할 | Codex 선택 | 높은 보안 추론 요청 | read-only 요청 |

Claude 전용 `effort:`가 Codex에서 강제된다고 가정하지 않는다. Codex에서는 현재 모델의 reasoning effort를
낮음·중간·높음으로 조절하고, 모델 slug 변경이 필요하면 사용자가 선택한다.

## workflow 적용

| 단계 | 공통 난이도 | Claude Code | Codex |
|---|---|---|---|
| 영향 범위 탐색 | 낮음 | Explore / Haiku / low | native explorer / 플랫폼 선택 |
| RED·GREEN 구현 | 중간 | general-purpose / Sonnet / high | 현재 모델 / 작업 기본 effort |
| 보안·릴리즈 사전 검증 | 높음 | security-reviewer / Opus / max | native security reviewer / 플랫폼 선택 |
| 완료 주장 반증 | 높음 | verifier / Opus / high | native verifier / 플랫폼 선택 |

정확한 현재 계약은 Claude Code의 skill·model 문서와 Codex의 skill·agent 설정 문서를 확인한다. 저장소에서는
`tests/enforce-subagent-model-test.sh`와 `tests/codex-skill-mapping-test.sh`가 위 매핑의 회귀를 막는다.

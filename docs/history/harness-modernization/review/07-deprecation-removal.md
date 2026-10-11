# 모델·플랫폼 업데이트에 따른 폐기·축소 검토

2026-10-09. 원본 코드·전역 설정·플러그인·소비 프로젝트는 수정하지 않았다.
이전 검토에는 폐기 모델과 일부 호환 코드가 포함됐다. 그러나 전체를 제거/대체/유지로 정리하지는 않았다.
이번에는 현재 원본·공식 지원·호출부·기존 전환 계획을 대조하고 정리 후보와 보존 대상을 구분했다.
모델의 성능 향상, 클라이언트 기능 변경, 사용자 정책 변경은 서로 다른 변경 사유다.

## 확인 방법과 한계

- 기존 MD 검토에 더해 다섯 저장소의 지정된 텍스트 확장자 714개와 전역 파일 18개에서 구형 모델·추론 옵션·과거 실행 플래그를 검색했다.
- [검색 목록](../obsolete-reference-inventory.json)은 문자열 출현 증거다. 모든 설정 키·동적 호출·제3자 구현의 완전한 분석은 아니다.
- 모델 정책, CLAUDE, 두 hook 설정, launcher, cache patch/adapter, 공식 설치 명령 연결, 관리 설정 installer와 직접 CI 호출을 읽었다.
- 현재 후보 HEAD는 980fe87b4429e601e7f95155063eb2c28906fbaf이다. 실제 Claude 설치 0.68.0과 현재 저장소/설치 Codex 0.81.0을 구분한다.
- 과거 [중복 감사](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/platform-overlap-audit.md)는 0.144.x의 시점·전환 목표다. 목표 상태가 구현 완료됐다고 가정하지 않았다.
- [모델 훅 시험](../model-override-probes.json)은 현재 저장소의 순수 입력 처리다. 실제 하위 에이전트·모델 호출은 0회이며 로그는 임시 폴더에만 썼다.

## 분류와 권고

| 대상 | 현재 근거 | 권고 | 제거/변경 전 확인 |
|---|---|---|---|
| Codex 정책의 Spark 추천 | 전역 model-policy 26줄은 폐기된 모델을 짧은 편집의 선택지로 소개함 | 현행 추천에서 삭제/교체 | API와 ChatGPT 로그인 경로, 과거 실행 기록을 구분 |
| 전역 모델·역할·effort 배정 | 정책은 Astra/high, config는 Sol 6.1/medium; 사용자는 기존 값을 기준으로 삼지 말라고 정정함 | 합의된 방향과 최신 공식 지침·과제 기준에서 전역 및 모든 역할 배정을 다시 선정 | 기존 값은 이관 입력이다. 지원·과제 품질·전체 사용량 비교와 실제 적용 확인을 구분 |
| Claude의 전역 high가 모든 최신 모델에 적용된다는 전제 | 사용자 settings의 effortLevel과 새 모델별 저장 방식이 다름 | 모델별 지원·설정으로 교체 | 지원 CLI와 실제 model/effort 확인; 과거 모델에도 필요한 키를 무조건 삭제하지 않음 |
| 항상 작은 모델부터·읽기/빌드 위임 규칙 | model-tiering 14줄·CLAUDE 11줄은 작업별 직접 처리/위임 판단과 충돌하거나 비용 절감을 일반화함 | 조건부 기준으로 축소 | 품질·권한·독립성·문맥 전달·통합 비용을 확인; 동일 과제 비교 전 절감 효과 단정 금지 |
| Claude Agent 모델 강제 훅 | 명시한 general-purpose/opus를 sonnet, Explore/sonnet을 haiku로 덮어쓰며 effort는 조정하지 않음 | 최신 작업별 model/effort 기준·native 역할 정의로 대체하고 타입별 하드포스 제거 방향 | 구형 기본값 보정도 재평가한다. 역할 기본값·상속·명시 선택·거부·최종 실제 호출 결과를 검증 |
| 외부 security-guidance cache patch와 adapter | launcher 50줄에서 patch 실행; 외부 cache·marketplace snapshot·plugin enabled를 수정함 | 우선 제거/공식 호환 또는 선택 의존성으로 대체 후보 | 실제 upstream 호환과 필요한 검사 범위 확인; 기존 보안 기능의 공백을 새 모델 성능으로 정당화하지 않음 |
| Claude 시크릿 판정 prompt hook | 과거 감사는 제거 목표지만 현재 hooks.json에는 계속 등록됨 | 결정적 검사·권한·CI와 역할을 대조해 제거 후보 판정 | 현재 전송 검사에 확인된 누락을 먼저 처리; 허용·거부·경계 사례의 결과 동등성 필요 |
| 일반 방법론의 중복 절차 | 플랫폼/Superpowers와 Harness의 계획·TDD·디버깅·QA 절차가 겹칠 수 있음 | 공용 스킬은 프로젝트 기준·증거·인계로 축소 | QA 범위·원래 수용 기준·완료 증거를 보존; 독립 검증을 중복 절차로 오인하지 않음 |
| 과거 managed hook·overlay·agent copy 안내 | 일부 specs/decisions는 unified_exec=false와 과거 호환 전략을 설명하지만 현행 installer는 hooks=true만 생성함 | 현행 안내에서 과거 기록으로 분리 | 당시 후보·실패·이관 시험을 보존하고 현재 정본으로 연결 |
| 고정 Claude Sonnet 4.6 공동 작성자 안내 | webhook AGENTS 225줄, DriveTree AGENTS 38줄에 남음 | 도구·모델을 미리 단정하는 문구 제거/실제 출처 기준으로 교체 | 실제 기여자 정보와 공통 ai-collaboration 계약 대조 |
| 소멸 trust 경로·구/신 hook trust·비활성 MCP 등록 | 전역 추가 감사에서 확인한 정리 후보 | 호출·재사용 필요 확인 후 정리 | 등록/저장 기록만으로 현재 활성 또는 불필요를 확정하지 않음 |
| .codex-plugin 호환 manifest | 현재 공식 문서도 legacy 형식을 지원함 | 공식 root plugin 형식으로의 전환은 선택적 후속 후보 | 설치·hook/skill 발견·버전·builder/checker/CI의 결과 동등성 확인; 파일만 삭제 금지 |

위 표는 수정 제안이다. 이번 검토에서 실제 제거·설정 적용을 하지 않았다.

## 문자열이 낡아 보여도 보존해야 하는 것

1. **GPT-5.5 은퇴 안내:** 2026-10-14 ChatGPT 로그인 Codex 은퇴에 대비하라는 현재 전역 정책은 유효하다. API 가용성과 구분한다.
2. **Codex 설정의 gpt-5.5:** 실제 위치는 tui.model_availability_nux.gpt-5.5의 정수 UI 기록이다. 현재 model 선택은 gpt-6.1-sol이다.
3. **MAX_THINKING_TOKENS 경고:** Claude 정책은 이를 모든 모델의 공통 비용 상한으로 취급하지 말라고 설명한다. 이 문구는 낡은 옵션을 권장하는 것이 아니다.
4. **unified_exec=false fixture:** [관리 설정 시험](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/tests/codex-managed-requirements-test.sh#L25)은 과거 설정을 이관하고 남의 설정을 보존하는 반례다. 현행 사용 규칙과 구분해 유지한다.
5. **과거 결정·실패·모델 이름:** 역사·출처·과거 후보를 최신 이름으로 덮어쓰지 않는다. 199줄 분할에서도 당시 내용을 보존한다.
6. **GPT-6 Sol/Luna 역할:** 지원 중이라는 사실은 폐기 대상 여부의 근거이며 현재 배정을 유지할 이유는 아니다. 기존 모델·effort를 기준으로 삼지 않고 최신 지원·권고·품질·전체 사용량으로 다시 선정한다.

## 이미 공식 기능을 연결하고 있는 구성

[sync-codex-plugin-cache.mjs](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/scripts/sync-codex-plugin-cache.mjs#L60)는 공식 plugin list/marketplace upgrade/add를 호출한다.
이름과 달리 외부 cache JSON을 직접 수정하는 patch와 같지 않다. 설치 버전·출처 결과를 확인하는 얇은 연결은 유지할 이유가 있다.
[관리 설정 installer](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/scripts/install-codex-managed-requirements.sh#L22)도 현재 hooks=true만 생성한다.
이미 제거된 unified exec 강제나 Codex agent 복사를 이번에 다시 제거했다고 보고하지 않는다.

native hook·skill 로딩·subagent 생성은 플랫폼에 맡긴다. Harness는 필요한 정책 검사와 결과 검증만 연결한다.
CI·브랜치 보호·PR/태그 후보 결박·독립 검증·감사·복구·QA 수용 기준은 더 좋은 LLM 출시로 불필요해지지 않는다.
실제로 이번 감사에서 기존 PASS와 함께 검사 누락·후보/복구 문제가 확인됐다.

## 추가 시험으로 확인한 모델 훅의 현재 의미

| 입력 | 현재 처리 결과 |
|---|---|
| general-purpose, 명시 opus | sonnet으로 변경 |
| Explore, 명시 sonnet | haiku로 변경 |
| harness-guard:verifier, 명시 sonnet | 명시 sonnet 유지 |
| harness-guard:verifier, 모델 누락 | opus 기본값 채움 |

네 경우 모두 exit 0이다. 이는 처리 동작의 확인이며 정책의 적합성·실제 모델·품질·사용량 통과를 뜻하지 않는다.
명시 선택을 덮어쓰는 hard force와 누락된 기본값 채우기를 같은 이유로 일괄 삭제하지 않는다.
그러나 둘 다 재설계 대상이다. native 정의로 대체되거나 최신 품질 근거가 없는 기존 매핑은 보존하지 않는다.
신규 배정 후보·공식 출발점·수정 범위·비교 기준은 [모델 재선정 계획](05-model-global.md)에 연결한다.

## 최신 지원을 아직 확정하지 않은 설정 키

Claude의 enableWorkflows, skipWorkflowUsageWarning, skipAutoPermissionPrompt는 별도 최신 reference 확인이 필요하다.
공식 settings 페이지는 파일·우선순위 안내로 분리됐으며 그 페이지에 키가 없다는 사실은 폐기의 증거가 아니다.
참조 HTML은 도구의 크기 제한, Markdown은 지원 형식 제한, 직접 공개 Markdown 조회는 HTTP 403으로 가져오지 못했다.
이 환경 조회 실패를 모델 추론 문제로 취급하거나 다른 계정·인증으로 우회하지 않았다.
최신 공식 키 reference 또는 지원 클라이언트의 격리 설정 검증이 확보되면 적용/무시/폐기 여부를 판정한다.
현재는 이 세 키를 삭제 가능한 것으로 확정하지 않는다. [조회 기록](../deprecation-evidence-notes.json).

## 수정 계획에 반영할 순서와 완료 조건

1. 현행 폐기 모델 추천·설정 우선순위 전제·고정 작성자 안내를 바로잡고 역사·UI 기록을 분리한다.
2. 확인된 안전 검사 누락을 먼저 처리하며 실제 호출되는 외부 cache patch·모델 강제·prompt hook의 대체 계약을 확정한다.
3. 격리된 공식 경로에서 필요한 설정·hook·skill·모델 선택·거부 결과를 확인한 뒤 해당 구현과 직접 호출부·CI·문서를 함께 축소한다.
4. 모든 관련 MD를 199줄 아래로 재구성하고 과거 안내가 현재 실행 지침으로 읽히지 않게 연결한다.
5. 필수 검사·원래 수용 기준·직접 소비자의 결과를 같은 후보에서 대조한다. 삭제 개수나 최신 모델 이름만으로 완료를 판정하지 않는다.

각 후보의 실제 제거 여부는 위 조건을 충족할 때 정한다. 신규 session 결과와 모델 비교는 앞선 미확인 보고서에 남아 있다.

## 공식 근거

- [Codex 모델 수명](https://learn.chatgpt.com/docs/models#deprecated-codex-models): Spark·구형 로그인 모델·API와 로그인 경로의 구분.
- [Codex 설정](https://learn.chatgpt.com/docs/config-file/config-reference): 구형 키/승인 정책과 내부 startup tooltip 기록의 의미. 이번 config에 확인한 구형 top-level 키 4개나 폐기 승인 정책은 없었다.
- [Codex hooks](https://learn.chatgpt.com/docs/hooks): plugin hook·trust·호스트별 적용 경계. 공식 로더가 존재해도 policy script의 필요가 자동으로 없어지지 않는다.
- [공식 plugin 패키징](https://developers.openai.com/plugins/build/plugins#bundled-mcp-servers-and-lifecycle-hooks): root 확장과 legacy .codex-plugin 지원·hook trust.
- [Claude 모델 설정](https://code.claude.com/docs/en/model-config): 모델별 effort·adaptive reasoning·공급자별 alias·최소 client 버전.
- [Claude subagent 설정](https://code.claude.com/docs/en/sub-agents#choose-a-model): 호출 model·frontmatter·상속 우선순위와 실제 적용 확인.

권고는 위 공식 기능과 현재 호출부를 연결한 판단이다. 모든 지원 버전의 실행 동등성을 검증했다는 주장은 아니다.

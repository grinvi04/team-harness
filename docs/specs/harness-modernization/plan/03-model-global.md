# 단계 3 — 모델·전역 설정·공식 기능으로 이전

근거: [최신 모델](../review/05-model-global.md), [전역 범위](../review/06-global-scope-addendum.md), [제거/보존](../review/07-deprecation-removal.md).
진행 상태: 전역 15개 파일 실제 적용 완료; 새 Codex 역할·설치 검증 중. Claude 실제 호출은 사용자 보류다.
설정·실행·품질 비교를 [전역 적용 기록](../execution-m3f.json) 및 [이전 표본](../review/10-agent-owned-execution.md)과 구분한다.
안전 검사 제거는 단계 1·2의 필요한 결과와 대체 경로 검증을 선행 조건으로 둔다.

## 변경 소유 경로

전역 지침: `$HOME/.config/ai-instructions/common.md`; `delegation.md`는 확인·보존했다.
`$HOME/.codex/AGENTS.md`, `model-policy.md`; `$HOME/.claude/CLAUDE.md`, `model-policy.md`.
설정: `$HOME/.codex/config.toml`, `rules/default.rules`; `$HOME/.claude/settings.json`.
역할: `$HOME/.codex/agents/`의 harness-explorer, harness-verifier, harness-security-reviewer,
personal-bounded-worker, personal-critical-verifier, project-mapper TOML 여섯 개.
Harness: `docs/model-tiering.md`, `CLAUDE.md`, `plugins/harness-guard/agents/*.md`의 실제 역할 정의,
`plugins/harness-guard/scripts/enforce-subagent-model.py`, 두 hook 등록과 관련 installer/checker/template.
개인 skill은 필요한 경우 `$HOME/.agents/skills/project-map/SKILL.md`의 실제 호출 계약만 정렬한다.
backup·revisions·대화 history·vendor cache·인증 값·사용자 UI 취향은 변경 소유 경로가 아니다.

## 3A — 실제 surface와 지원값

- [ ] 최신 공식 지원·모델별 effort·설정 우선순위를 구현 시점의 실제 앱/CLI와 대조한다.
- [ ] Codex 터미널 0.161.0과 앱 내장 0.162.0-alpha.2의 관찰을 섞지 않는다.
- [ ] Claude 터미널 2.1.267의 최신 모델 최소 조건 미달을 확인하고 지원 실행기를 준비한다.
- 준비 결과: 공식 갱신으로 2.1.295; 인증 이후 실제 호출은 USER-DEFERRED다.
- [ ] Claude 앱의 package target 2.1.293·설치 binary 2.1.205는 확인했다. 실제 새 세션의 선택 binary/model/effort를 별도로 확인하고 앱 업데이트를 실행 성공으로 간주하지 않는다.
- [ ] 가용 provider/alias와 최종 모델 ID·effort를 비밀 없이 확인한다. 지원되지 않는 값을 저장하지 않는다.
- [ ] 공식 경로가 제공하는 session 선택·role 기본값·상속·model 허용 범위를 구분한다.

AC-M1: 지원 범위·설정 값·실제 호출 결과가 일치하며 확인할 수 없는 값은 미확인이다.
참고: [Codex 모델 선택](https://learn.chatgpt.com/docs/model-selection), [Claude model-config](https://code.claude.com/docs/en/model-config).

## 3B — 비교 과제와 모델 후보

먼저 원래 요구·정답의 출처·오류/누락 기준·읽기/쓰기 권한·고정 입력을 잠근다.
각 모델의 호출 순서로 다른 후보의 답·패치를 미리 보게 하지 않는다. 동일 도구·환경·지원값으로 비교한다.

| 대표 과제 | Codex 출발 후보 | Claude 출발 후보 | 필수 품질 기준 |
|---|---|---|---|
| 지정 범위 근거 수집·분류 | Luna/high; 맥락 종합이면 xhigh 비교 | Haiku 5.5/medium; 긴/엄격 과제는 high 비교 | 원본 위치·판정 정확, 범위 밖 쓰기 0, 필수 근거 누락 0 |
| 기존 결함의 제한된 구현 | Sol 6.1/medium, 필요하면 high 비교 | Sonnet 5.5/medium, 필요하면 high 비교 | 원래 RED 해결·정상 유지·관련 gate, 소유 밖 변경 0 |
| 증거·권한·후보 경계 독립 검증 | Astra/medium·high 비교 | Opus 5.5/medium·high 비교 | 고정된 결함 검출·정상 오탐 판정·증거 근거, 수정/권한 우회 0 |

- [ ] 좁은 조사, 여러 문맥 종합, 알려진 결함 수정, 완료 주장 반증의 실제 대표 과제를 선정한다.
- [ ] 첫 묶음은 위 세 과제군의 플랫폼별 후보 한 쌍 이내로 제한한다. 모든 effort를 순회하지 않는다.
- [ ] 탐색/mapper/worker/검증 역할의 서로 다른 권한·필수 산출물은 각 실제 호출에서 따로 확인한다.
- [ ] 회귀·gate를 실제로 실행할 책임은 구현/통합 담당에게 남긴다. 모델의 자기평가로 품질을 채우지 않는다.
- [ ] 최초 결과·정확한 근거 위치·재작업·검토 후 남는 결함·전체 시간·초기 전달 문맥·입출력/추론/cache 사용량을 가능한 범위에서 기록한다. 작은 fixture의 Codex 3개 baseline은 재사용하고 새로운 과제군만 별도로 확인한다.
- [ ] 계정 공유 사용률을 한 호출의 정확한 비용으로 쓰지 않는다. API 단가 추정과 구독 실제 과금도 구분한다.
- [ ] 품질을 통과한 후보끼리 전체 비용/시간을 비교한다. 실패한 싼 후보를 효율적인 것으로 채택하지 않는다.
- [ ] 로그인 없는 공개 SNS 원문을 새로 확보할 수 있으면 날짜·model/effort·과제·측정 조건을 정리한다. X 원문 부족은 부분 이행으로 보존하고 다른 SNS/공식 근거와 구분한다.

AC-M2: 같은 기준의 실제 결과가 있고 선택 근거가 품질·위험·전체 사용량에 연결된다.
표본은 해당 과제군의 증거다. 모든 작업의 최적 조합이나 절감률을 보장한다고 쓰지 않는다.
SNS 후기는 시험 가설로만 사용한다. 로그인 없이 확보하지 못한 최신 X 원문이나 서로 다른 과제의 후기를 통제된 비교로 취급하지 않는다.
저렴한 모델의 xhigh/max는 추가 이득이 있을 때 시험한다. Haiku는 Sonnet과도 비교하며 상시 최고 effort를 강제하지 않는다.
추가 시험에는 새 실패/가설이 필요하다. 인증·환경·한도 실패를 비싼 모델/다른 공급자로 재시도하거나 결제하지 않는다.
사용량 상한이 지정되면 그 안에서 수행하고, 비교 미완료를 숨겨 최적화 완료로 보고하지 않는다.

## 3C — 강제 훅을 native 역할 기준으로 대체

- [ ] 현재 TIER 강제·DEFAULT 보정·호출부를 구분하고 각각 필요한 결과 계약을 정의한다.
- [ ] 작업별 모델/effort는 native 역할 정의·현재 세션 선택으로 이전한다.
- [ ] general-purpose/opus→sonnet, Explore/sonnet→haiku라는 타입별 강제를 유지하지 않는다.
- [ ] 누락 기본값 보정도 native 상속과 중복이면 제거한다. 기존 high/opus가 품질 하한이라는 전제를 버린다.
- [ ] 새 작업의 명시 선택·누락 선택·unsupported 입력·읽기 전용/worker 권한을 실제 native 호출로 확인한다.
- [ ] 분류 로그와 최종 모델 metadata를 구별하고 고정 역할의 실제 적용은 새 인스턴스로 확인한다.
- [ ] `tests/enforce-subagent-model-test.sh`, `tests/plugin-wiring-test.sh`, `tests/claude-surface-isolation-test.sh`,
      `tests/codex-skill-mapping-test.sh`의 유효 계약을 이전한다. 제거되는 동작을 계속 요구하는 시험은 정당한 이유와 함께 대체한다.

AC-M3: 오래된 매핑 강제 0, native 기본값/명시 선택의 실제 결과 확인, 독립성·권한·필수 QA 약화 0.

## 3D — 전역 설정과 중복 구성

- [ ] common 원본과 두 전역 진입점은 같은 변경에서 갱신하고 전체 본문 digest 일치를 확인한다.
- [ ] Codex 새 대화의 자동 메모리 생성 입력만 중단하고 기존 조회를 유지한다. 기존 기억은 삭제하지 않는다.
- [ ] broad git push/gh api 및 Claude 승인 조건 DELETE/PATCH 규칙을 저장된 권한 범위와 대조한다.
- [ ] 조회·일상 쓰기·파괴/보호 변경을 구별하는 최소 정책으로 조정하고 허용/거부/확인 필요를 안전한 판정 시험으로 확인한다.
- [ ] 오래된 Spark 추천·고정 Sonnet 작성자·일괄 위임·모든 모델의 global high 전제를 제거/교체한다.
- [ ] 소멸 trust 경로는 실제 재사용 필요 확인 후 정리한다. 재생성/다른 호스트 경로를 자동 삭제하지 않는다.
- [ ] MCP의 버전 없는 실행은 공식 지원·재현성·기존 연결을 확인해 필요한 최소 변경만 한다.
- [ ] 고정 compaction은 기본값 대비 실측 근거가 있을 때만 조정한다. theme/알림 등 취향은 보존한다.

enableWorkflows와 skipWorkflowUsageWarning은 앱 package의 schema/소비 코드에서 인식을 확인했다.
skipAutoPermissionPrompt는 merge 목록 참조만 찾았으므로 지원 runtime 검사 전 무효/삭제로 단정하지 않는다.
실제 효력과 계정 활성화는 별도 확인한다. 같은 403을 새 근거 없이 반복하지 않는다.

## 3E — cache patch·prompt hook의 축소

대상: `plugins/harness-guard/scripts/patch-codex-security-guidance.mjs`, 관련 adapter,
`scripts/codex-hardened.sh`, 두 hook 등록·직접 시험·CI·현재 안내.

- [ ] upstream 공식 호환/선택 의존성으로 대체 가능한지 확인하고 기능별 결과 동등성을 정의한다.
- [ ] 보안 입력 누락을 고친 뒤 deterministic guard·권한·CI가 맡는 계약을 대조한다.
- [ ] native 공식 경로로 같은 결과를 확인한 경우 외부 cache patch와 중복 prompt 판정을 제거/축소한다.
- [ ] caller·manifest·template·CI가 삭제한 경로를 호출하지 않도록 함께 정렬한다.
- [ ] official plugin list/marketplace 연결·현재 지원 legacy manifest·이관 fixture·과거 실패는 보존한다.
- [ ] launcher/managed requirements/plugin cache sync/semantic parity/native loader 관련 기존 시험을 영향에 맞게 실행한다.

AC-M4: 외부 cache 직접 수정 의존을 줄여도 필요한 보안 결과가 보존되고 실제 설치/로딩 결과가 확인된다.
공식 경로가 아직 동등하지 않으면 남는 이유와 해제 조건을 기록하며 임의 삭제하지 않는다.
사용자 원본 적용은 승인된 후보와 백업/복구 경계를 고정한 뒤 수행한다. worktree가 전역 설정을 격리한다고 가정하지 않는다.

## 3F — 적용 단위·부분 실패·복구

범위는 이번 작업이 변경하는 설정·역할·공통 지침 파일과 명시한 plugin 등록으로 제한한다.
인증·대화 기록·외부 cache 전체를 백업/복원 대상으로 확대하지 않는다. 기존 공식 설정·설치 경로를 우선한다.

- [ ] 적용 대상마다 정본 경로·파일 유형·권한·현재 digest·검증 후보 digest를 고정한다. 백업은 비공개 경로에 보존하고 값은 로그에 출력하지 않는다.
- [ ] 쓰기 직전에 기준 digest·유형을 재대조한다. 사용자/앱의 동시 변경이나 예상하지 않은 symlink 교체가 있으면 덮어쓰지 않는다.
- [ ] 적용 순서·중단 지점·적용 전/후 상태를 기존 실행 기록에 남긴다. 여러 파일의 개별 원자 교체를 전체 설정의 원자 적용으로 보고하지 않는다.
- [ ] 새 세션이 혼합 구성을 읽지 않도록 시작·재로딩 시점을 정한다. 실행 중인 다른 사용자 작업을 임의로 중단하지 않는다.
- [ ] 중간 실패 시 이번 작업이 쓴 값과 현재 값이 같은 대상만 복구한다. 이후 변경된 파일은 자동 복원하지 않고 충돌로 보존한다.
- [ ] 공통 원본/두 진입점의 전체 본문 일치, 구문·권한·plugin 상태와 새 세션의 실제 로딩을 적용/복구 후 확인한다.
- [ ] 합성 설정 fixture에서 정상 적용·두 번째 파일 실패·중단·복구 실패·사용자 동시 변경을 확인한다. 원본으로 복구 시험하지 않는다.

AC-M5: 부분 적용·복구 상태가 추적되고 동시 변경 손실 0, 불완전한 적용/복구를 성공으로 보고하지 않는다.
전용 관리 프레임워크나 병렬 상태 register는 만들지 않고 기존 실행 증거에 연결한다.

## 3G — 혼합 버전·세션과 되돌리기

- [ ] 실제 이전 설정/설치 plugin의 version·digest, 변경 후보, 앱/터미널 실행기와 새/기존 세션의 지원 조합을 고정한다.
- [ ] 기존 구성, 최종 구성, 실제 적용 순서의 중간 구성, 되돌린 구성을 격리해 시험한다. 모든 구버전의 영구 호환이나 전체 조합 순회를 요구하지 않는다.
- [ ] 지원하지 않는 조합은 실행 전 거부하거나 공식 갱신·새 세션 시작 조건을 안내한다. 기존 세션에 새 역할/지침이 소급 반영됐다고 가정하지 않는다.
- [ ] 이전 모델 강제 hook과 새 전역 선택의 충돌, 이전 plugin이 읽는 reference 경로, 4개 소비 지침/reader의 전환을 함께 확인한다.
- [ ] source·설치 plugin·전역 설정·문서/reader 중 되돌릴 단위를 명시한다. 공식 등록 source/ref도 보존하고 문서만 최신 상태로 남기지 않는다.
- [ ] staged package의 `installable:false`를 사용자 설치 경로로 바꾸지 않는다. 실제 호환 파괴는 maintenance의 MAJOR·이관 안내 계약으로 처리한다.

AC-M6: 지원 조합과 전환/복구 결과가 확인되고 미지원 조합이 조용히 실행되지 않는다. 버전 문자열 일치만으로 호환 PASS를 채우지 않는다.

## 단계 완료

설정 검사·실제 호출·품질/사용량 비교의 결과를 별도로 남긴다. 관련 MD는 단계 4까지 기다리지 않고 199줄 이하로 작성한다.
새 세션의 role·hook·skill·명시 선택·권한 관찰이 필요한 범위에서 확인돼야 실제 적용 완료로 판정한다.

## 사용자 보류와 현재 결과

2026-10-09: Claude CLI 2.1.295 공식 갱신 완료. 첫 최신 모델 요청은 OAuth 만료로 실패했고 사용자가 인증 갱신을 나중으로 미뤘다.
3A/B/C의 Claude 실제 모델·effort·상속·권한·품질/사용량 결과는 USER-DEFERRED이며, 정적 native 역할 정의/강제 hook 제거 시험과 구분한다.
3C source에서 타입별 강제 등록을 제거하고 호환 파일을 무효과로 남겼다. 입력 48건에서 출력·로그·선택 덮어쓰기 0을 확인했다.
Codex 실제 역할·전역 적용과 다른 승인 작업은 계속한다. 인증 실패를 다른 모델·공급자 재시도나 결제로 해결하지 않는다.

3F 적용 결과: 24개 실패/복구/경쟁 fixture와 별도 인스턴스 검토 후 15개 파일을 개별 원자 교체했다.
적용 뒤 전 대상 digest·mode와 공통 세 본문 일치를 확인했다. 다중 파일 전체의 원자성이나 강제 종료 복구는 보장하지 않는다.
기존 plugin 설치본·열린 세션에는 새 source 역할/hook이 소급 적용되지 않는다. 공식 갱신과 새 실행의 결과를 따로 확인한다.

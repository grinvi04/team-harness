# 요구·위험 기반 QA 범위와 완료 기준

## 요청과 경계

2026-09-29 사용자는 샘플 프로젝트의 오류 조사 경험을 Team Harness에 반영하도록 승인하고,
테스트 범위가 잘못되거나 그 범위의 품질 기준이 모호하면 문제가 반복됨을 지적했다.
기존의 검증 책임·증거 원칙에 범위 선정과 항목별 완료 기준을 연결한다.

판정은 결과 계약 **소유**, 기존 계획·구현·디버깅·QA와 **연결**, 제품별 테스트·실행 도구는 **위임**이다.
새 스킬·검사 엔진·모델 역할·전역 설정을 만들지 않는다. `/qa`는 디자인·접근성 범위를 유지한다.
설치된 플러그인·샘플 앱·운영 데이터·원격 PR·릴리즈는 이번 변경 대상이 아니다.

## 수용 기준과 검증 범위

| 요구·위험 | 확인할 결과 | 방법 | 필수 |
|---|---|---|---|
| 테스트 목록에 맞춰 범위를 좁히는 문제 | 요구·사용자 흐름·변경 경계·직접 소비자·실패 영향으로 사례 선정, 제외 근거 기록 | 공통 계약과 계획·구현·디버깅 진입점 대조 | 예 |
| 기대값이 모호한 QA | 조건·환경·관찰 대상·정확한 기대값/불변식·품질 임계값 출처·필수 여부를 실행 전에 연결 | 실제 사례를 적용한 독립 검토 | 예 |
| green 테스트로 거짓 완료 | 필수 사례 누락·미실행·차단 결함·다른 후보 증거는 완료 불가, 비적용과 실행 불가 구분 | 반례 시나리오 판정 검토 | 예 |
| 사용자에게 검증 전가 | 접근 가능한 시험은 에이전트 수행, 필요한 업무 판단·권한만 질문 | 협업 문서·디버깅·qa 문구 대조 | 예 |
| 국소 결함 수정으로 목표 달성 오인 | 발견 결함 해결과 미공개 원래 증상의 해결을 구분 | 재현 없는 증상 시나리오 검토 | 예 |
| 제품 전용 구현의 공용 강제 | 응답 유실·긴 입력 사례는 위험별 예시, 키=ID·특정 DB·전 브라우저 검사를 강제하지 않음 | API·프론트 기준과 scope 검토 | 예 |
| 소비 경로·버전 불일치 | Codex wrapper가 수정 source를 로딩하고 package에 source가 포함됨, 버전·문서 참조 정상 | 기존 발견성·매핑·패키징·문서 검사 | 예 |

평가 시나리오는 정상 계획, 저장 후 응답 유실, 필수 WebKit 검사 미실행, 무관한 전체 테스트 green,
단순 문구 수정, 미공개 증상 미재현을 포함한다. 리뷰어는 현재 후보와 원래 요구를 직접 읽고
각 사례의 범위·기대 결과·완료 판정이 가능한지 검토한다. 텍스트 존재 검사만으로 행동 개선을 증명하지 않는다.

## 현재 상태와 검증 한계

문서·스킬 초안 작성 후 검사·독립 검토 중이다. 결과는 검증한 후보와 범위를 확인한 뒤 갱신한다.
스킬 동작 변경으로 0.76.0 소스 후보를 준비한다. 정식 릴리즈·설치 완료를 뜻하지 않는다.
제품 로드맵의 기존 완료 항목이나 다른 스택 확대 범위는 바뀌지 않는다.

샘플의 관찰에서 일반화한 검증 패턴만 반영한다. 샘플의 과거 시험을 이번 Harness 후보의 시험으로
세지 않으며, 사용자가 발견한 미공개 오류가 해결됐다고 주장하지 않는다. 이번 검증도 모든 미래
작업에서의 준수나 실제 제품 결함 발견률 향상을 보장하지 않는다.

## 문서 동기화 대상

```harness-doc-sync
{
  "version": 1,
  "documents": [
    {"path":"docs/specs/qa-scope-contract.md","reason":"요구·수용 기준·검증 결과와 배포 경계"},
    {"path":"docs/ai-collaboration.md","reason":"에이전트 검증 책임과 QA 계약 안내"},
    {"path":"docs/development-coordination.md","reason":"자연어 요청에서 QA 범위 선정 책임 연결"},
    {"path":"docs/frontend-design-standards.md","reason":"긴 입력·화면 경계와 실제 동작 판정"},
    {"path":"docs/api-standards.md","reason":"저장 이후 응답 유실의 관찰 경계"},
    {"path":"docs/decisions.md","reason":"소유·연결·위임 결정"},
    {"path":"plugins/harness-guard/skills/verification-before-completion/SKILL.md","reason":"QA 범위와 완료 판정 정본"},
    {"path":"plugins/harness-guard/skills/plan/SKILL.md","reason":"계획 단계에서 QA 계약 연결"},
    {"path":"plugins/harness-guard/skills/feature-add/SKILL.md","reason":"신규 구현 전 QA 계약 연결"},
    {"path":"plugins/harness-guard/skills/feature-modify/SKILL.md","reason":"변경 전 QA 계약 연결"},
    {"path":"plugins/harness-guard/skills/systematic-debugging/SKILL.md","reason":"증상 없는 조사와 원래 목표 구분"},
    {"path":"plugins/harness-guard/skills/qa/SKILL.md","reason":"디자인·접근성 검사 범위와 미확인 처리"},
    {"path":"README.md","reason":"소스 후보 버전"},
    {"path":"docs/intro.html","reason":"소스 후보 버전"},
    {"path":"CHANGELOG.md","reason":"구현 커밋 뒤 생성한 후보 변경 이력"}
  ],
  "items": []
}
```

# 프론트엔드 설계 기준 연결

이 문서는 최초 구현 후보의 기준·검증 기록이다. [현재 0.92.1 기반 통합](frontend-contract-integration.md)을 함께 따른다.

## 승인·목표

2026-10-13 사용자가 보완된 통합안의 구현과 실제 Codex 실행 검증을 승인했다.
기준 후보는 develop `9a1be6d7867cbb847579f442cdd9296fbf3c72fb`다.
제품 방향 판정은 **연결**이다. 일반 설계·QA 방법론과 native skill 발견을 복제하지 않고,
프로젝트의 업무·데이터·상태·구조 판단을 기존 계약과 결과 기록에 연결한다.

## 범위·보존

- 설치되는 공통 프로젝트 계약에 조건부 핵심 설계 기준을 포함한다.
- 상세 안내를 `docs/frontend-engineering.md`로 두고 기존 디자인 표준·소비 템플릿에서 연결한다.
- 기존 plan·feature-add·feature-modify·QA·완료 계약의 이름·권한·검사 루프를 보존한다.
- 특정 UI/그리드·폴더·계층·상태 라이브러리·새 의존성·중앙 상태표는 추가하지 않는다.
- 기존 소비 프로젝트, 사용자 plugin cache/config, 모델 설정, 운영 환경은 수정하지 않는다.
- 로컬 구현·검증·커밋까지 수행한다. 원격 PR·병합·릴리즈·사용자 설치는 별도 상태다.

## 수용 기준·판정자

| ID | 조건 | 기대 결과·관찰 경계 | 필수 검사 |
|---|---|---|---|
| F1 | 프론트 업무·데이터·상태·구조 설계 | 업무 결과·기존 연결·상태 소유·책임 경계·재사용·검증이 현재 코드 근거와 연결됨 | 변경 전/후 fresh Codex 실행과 답변 수동 대조 |
| F2 | 이미 승인된 설계·QA가 있음 | 기존 기록 재사용, 별도 설계·승인·QA 루프 없음 | 동일 실행의 도구·답변·문서 생성 요청 확인 |
| F3 | 작은 문구 변경 | 영향 항목만 확인, 전체 설계·상태 분석·새 의존성 없음 | fresh Codex 작은 변경 시나리오 |
| F4 | 프론트 없는 백엔드 변경 | 프론트 기준 비적용, 기존 기능·검증 계약 유지 | fresh Codex 비프론트 시나리오 |
| F5 | 상세 docs 없는 설치 형태 | 핵심 기준은 설치된 공통 계약만으로 읽히고 적용됨 | wrapper→공용 skill→공통 계약 실제 읽기 로그 |
| F6 | 배포·회귀 | 기존 reader, 버전, 문서, package와 전체 quality 계약 유지 | 구조 회귀·문서/버전 검사·기존 CI quality 명령 |

F1은 같은 프론트 과제를 변경 전·후 각각 fresh context 5회로 비교한다.
F3/F4는 각각 변경 전·후 1회로 적용 범위를 확인한다. 응답은 기대 결론을 주입하지 않고
현재 원본의 업무 계약과 대조한다. 표본 준수를 모든 요청의 자동 선택·품질 개선으로 확대하지 않는다.
정적 reader 검사는 로딩 경로만 증명하며 답변의 의미 적합성은 수동 검토한다.
검사 환경은 격리 합성 fixture, CLI `--sandbox read-only`, 기존 승인 모델/effort를 사용한다.
JSONL 원본·명령·종료 코드·후보 digest·실행 시도를 보존한다. 수정·네트워크 장애는 별도로 판정한다.

## 영향 문서·다음 행동

현재 스펙이 진행 정본이다. 관련 문서: frontend-engineering.md, frontend-design-standards.md,
templates/AGENTS.md, decisions.md, harness-maintenance.md, README·두 plugin manifest.
수정된 공통 계약과 기존 skill-contract 회귀에 구조 검사를 연결한다.
승인된 공통 계약 변경의 checksum 한 행도 `tests/fixtures/claude-surface.sha256`에서 대조한다.
실행 원본은 작업 출력에 보존한다. [검증 결과·digest](frontend-engineering-verification.md)를 함께 대조한다.

- [x] 변경 전 실제 Codex 실행과 계약 누락 기록
- [x] 공통 계약·상세 안내·읽기 경로·버전 반영
- [ ] 변경 후 적용·비적용·중복 방지 검증
- [x] 전체 quality·후보 package·독립 의미 검토
- [x] 결과·사용 안내 현행화 및 로컬 커밋

## 완료 경계

필수 수용 기준 PASS, 현재 후보와 증거 일치, 관련 안내 현행화 시 로컬 구현·검증 완료다.
실제 제품의 사용성·미학·유지보수성·회사 채택은 이 과제에서 증명하지 않는다.
원격 전달·발행·사용자 설치를 로컬 검증 결과로 완료 처리하지 않는다.
현재 F1은 불완전 응답 1회 때문에 FAIL이며 전체 수용 완료는 보류한다. F2–F4는 표본 PASS, F5는 읽기·적용 확인이다.
F6의 로컬 quality 74단계·기록된 후보 package/bundle·checksum·문서 검사는 통과했다.
독립 검토의 F1 FAIL을 유지하며 전체 완료·발행·설치로 승격하지 않는다.

## 진행 문서 선언

```harness-doc-sync
{
  "version": 1,
  "documents": [
    {
      "path": "docs/specs/frontend-engineering-contract.md",
      "reason": "프론트 설계 기준 연결의 현재 안내와 실행 결과 대조"
    },
    {
      "path": "docs/specs/frontend-engineering-verification.md",
      "reason": "프론트 설계 기준 연결의 현재 안내와 실행 결과 대조"
    },
    {
      "path": "docs/pilots/frontend-contract-codex-v0.93.0.json",
      "reason": "프론트 설계 기준 연결의 현재 안내와 실행 결과 대조"
    },
    {
      "path": "docs/frontend-engineering.md",
      "reason": "프론트 설계 기준 연결의 현재 안내와 실행 결과 대조"
    },
    {
      "path": "docs/frontend-design-standards.md",
      "reason": "프론트 설계 기준 연결의 현재 안내와 실행 결과 대조"
    },
    {
      "path": "templates/AGENTS.md",
      "reason": "프론트 설계 기준 연결의 현재 안내와 실행 결과 대조"
    },
    {
      "path": "docs/decisions.md",
      "reason": "프론트 설계 기준 연결의 현재 안내와 실행 결과 대조"
    },
    {
      "path": "docs/harness-maintenance.md",
      "reason": "프론트 설계 기준 연결의 현재 안내와 실행 결과 대조"
    },
    {
      "path": "README.md",
      "reason": "프론트 설계 기준 연결의 현재 안내와 실행 결과 대조"
    },
    {
      "path": "docs/pilots/frontend-contract-quality-v0.93.0.json",
      "reason": "최초 실패와 최종 검증·후보 변경 이력 대조"
    },
    {
      "path": "CHANGELOG.md",
      "reason": "최초 실패와 최종 검증·후보 변경 이력 대조"
    },
    {
      "path": "docs/changelog/releases.md",
      "reason": "최초 실패와 최종 검증·후보 변경 이력 대조"
    },
    {
      "path": "docs/changelog/2026/v0.93.0.md",
      "reason": "최초 실패와 최종 검증·후보 변경 이력 대조"
    }
  ],
  "items": [
    {
      "document": "docs/specs/frontend-engineering-contract.md",
      "item": "변경 전 실제 Codex 실행과 계약 누락 기록",
      "state": "done",
      "evidence": {
        "path": "docs/specs/frontend-engineering-verification.md",
        "sha256": "0bd0f5bd982209aad5d221e1c56ef9b1e340f8de69d73f858b41551a14f45298"
      }
    },
    {
      "document": "docs/specs/frontend-engineering-contract.md",
      "item": "공통 계약·상세 안내·읽기 경로·버전 반영",
      "state": "done",
      "evidence": {
        "path": "docs/specs/frontend-engineering-verification.md",
        "sha256": "0bd0f5bd982209aad5d221e1c56ef9b1e340f8de69d73f858b41551a14f45298"
      }
    },
    {
      "document": "docs/specs/frontend-engineering-contract.md",
      "item": "변경 후 적용·비적용·중복 방지 검증",
      "state": "pending",
      "resume": "현재 담당자 후속 진단: candidate-frontend-11 불완전 답변 원문과 실제 원인 증거를 대조; 기준 완화·무근거 반복 금지"
    },
    {
      "document": "docs/specs/frontend-engineering-contract.md",
      "item": "전체 quality·후보 package·독립 의미 검토",
      "state": "done",
      "evidence": {
        "path": "docs/specs/frontend-engineering-verification.md",
        "sha256": "0bd0f5bd982209aad5d221e1c56ef9b1e340f8de69d73f858b41551a14f45298"
      }
    },
    {
      "document": "docs/specs/frontend-engineering-contract.md",
      "item": "결과·사용 안내 현행화 및 로컬 커밋",
      "state": "done",
      "evidence": {
        "path": "docs/specs/frontend-engineering-verification.md",
        "sha256": "0bd0f5bd982209aad5d221e1c56ef9b1e340f8de69d73f858b41551a14f45298"
      }
    }
  ]
}
```

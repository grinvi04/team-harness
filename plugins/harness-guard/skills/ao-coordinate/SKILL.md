---
name: ao-coordinate
description: 승인된 제품 개발 요청의 진행·인계·검증·인수를 이어갈 때 사용. 단순 단독 수정·배포 실행·전역 설치·권한 집행은 제외
---

# 제품 개발 조정

제품의 실제 루트, AGENTS.md, 현재 요청·작업 기록부터 읽고 [조정 절차](../../tools/orchestration/docs/coordination-workflow.md)를 따른다. 이미 승인된 범위는 다음 단계마다 재승인을 요구하지 않고 완료까지 이어간다. 제품 코드·요구·상태·증거는 제품 저장소에 둔다.

단순 작업은 주 에이전트가 직접 처리한다. 필요한 위임과 독립 검증만 선택하고, 실행은 현재 플랫폼이 제공하는 native 도구를 쓴다. 이 skill은 별도 실행 엔진이나 권한 gate가 아니다. 기능 구현·수정·PR·릴리즈 단계는 제품이 채택한 Harness workflow 하나와 연결하고 이미 유효한 검증을 불필요하게 반복하지 않는다.

새 요청에 기존 이슈·작업 기록이 없으면 [작업 기록 틀](../../tools/orchestration/docs/templates/work-item.md)을 제품에 작성한다. 선택형 `ao-project start ROOT SLUG REQUEST`는 같은 DRAFT 틀을 만들 뿐이며 설치 없이 직접 작성해도 된다. 사용자에게 내부 JSON이나 템플릿 칸을 대신 채우게 하지 않는다.

| 필요한 판단 | 읽을 정본 |
| --- | --- |
| 책임·최소 역할·writer와 verifier 분리 | [역할 계약 §§2–3, 7](../../tools/orchestration/docs/role-contracts.md) |
| native 역할 입력·준비·실행 전달·취소 | [역할 매핑 §7](../../tools/orchestration/docs/specs/codex-role-mapping.md) |
| 실제 ID·현재 attempt/epoch/base·writer 이력 | [할당 계약](../../tools/orchestration/docs/specs/assignment-context.md) |
| 실행 전 선언 검사와 결과 소비 | [도구 사용과 한계](../../tools/orchestration/docs/usage.md) |

Task/Assignment/Artifact 검사는 제출된 선언만 대조한다. 실제 권한·신선도·정지·품질 gate와 인수는 현재 원본에서 별도로 확인한다. 과거 한 제품의 로컬 시험 예외를 일반 작업에 적용하지 않는다. 필수 조건이 충족되지 않으면 해당 위임을 차단하고, 독립적으로 가능한 승인 작업은 계속한다.

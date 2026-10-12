# 회사 도입·정책 호환 결정

[결정 목록](decisions.md)으로 돌아간다. 아래 기존 결정은 당시 내용으로 보존한다.

## 회사 선택형 도입 (0.92.0 후보)

기존 회사 정책·규약·자산을 보존하고 solo 예외는 명시한 개인 경로로 제한한다.
수동/자동 모두 required 집합·현재 head 성공 미확인을 차단하며 일반 Actions 성공으로 대체하지 않는다.
기술 자산은 고정 원본·소유 hash로 선택 적용하고 실제 제품·독립 팀 인수는 [별도 계약](company-acceptance.md)으로 확인한다.

## 2026-10-12 — 이 개인 저장소의 solo 병합 선택

사용자가 0.92.0 전달 중 solo-merge를 선택했다. 기존 정책 연결로 이 repo만 schema1 `mode: solo`·자동머지 opt-in 없음으로 선언한다.
개인 소유·실제 협업자1명을 재확인하며 회사 기본값·소비 repo는 유지한다. main 승인1은 wrapper의 임시 예외 뒤 전체 원값으로 복원·검증한다.
required5·현재 head/base·독립 검토·스레드 게이트는 유지한다. [전달 상태](specs/company-adoption.md)를 따른다.

2026-10-13: [정책 API 호환 수정](specs/company-policy-api-compatibility.md)은 GET null 판독과 쓰기 거부를 분리하고 block_creations 원값을 보존한다.

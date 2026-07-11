# Codex 스킬 공동작성 표기 정규화 스펙

## 1. 목표 & Why

공용 harness 스킬의 Claude 공동작성 예시가 Codex 실행에서도 그대로 사용되는 오귀속을 막는다.
Claude 원본은 유지하고 Codex cache에서만 해당 표기를 제거한다.
**성공 기준: patch 후 Codex cache의 Claude 공동작성 표기는 0개이고 Claude source는 바뀌지 않는다.**

## 2. Scope

- **In:** Codex cache skill 정규화, 원본 불변·멱등 회귀 테스트, parity 문서와 버전 갱신.
- **Out (Non-goals):** Claude commit/PR body 정책 변경, 일반적인 AI 공동작성 정책 도입, 다른 Claude 설명 문구 제거.

## 3. 기능 요구사항 + 수용기준

- **AC-1 (정상):** WHEN Codex cache patch가 실행되면 THEN 모든 cached `SKILL.md`에서
  `Co-Authored-By: Claude` 줄을 제거한다.
- **AC-2 (격리):** WHEN patch가 완료돼도 THEN `plugins/harness-guard/skills/` 원본의 동일 문구는 유지된다.
- **AC-3 (멱등):** WHEN 이미 정규화된 cache에 patch를 다시 실행하면 THEN 공동작성 표기 변경 수는 0이다.
- **AC-4 (경계):** WHEN 스킬에 Claude 실행 설명이나 모델 메타데이터가 있더라도 THEN 공동작성 줄 이외의 본문은
  이 기능이 제거하지 않는다.

## 4. 제약 / 비기능

- Codex cache만 수정하며 Claude source/cache와 전역 Codex 설정은 변경하지 않는다.

## 5. 경계 / Do-Not

- ✅ 해도 됨: cache skill의 정확한 Claude 공동작성 trailer 줄 제거.
- ⚠️ 먼저 물어봐: 공동작성 정책 전체 변경, 다른 공급자의 attribution 제거.
- 🚫 절대 금지: Claude 원본 스킬 수정, 출처가 불명확한 임의 본문 삭제.

## 6. Open Questions

없음.

## 7. 기술 접근

- 기존 `normalizeCodexSkills` 단계에서 줄 단위의 정확한 Claude 공동작성 trailer만 제거한다.
- 기존 cache patch 통합 테스트를 RED 계약으로 확장해 제거 수, 원본 보존, 멱등성을 검증한다.
- semantic parity matrix와 결정 기록에 Codex-only 정규화 근거를 남긴다.

## 8. 태스크

| # | 태스크 | AC 참조 | 대상 파일 | 검증 | 의존 |
|---|---|---|---|---|---|
| 1 | 공동작성 표기 RED 계약 추가 | AC-1~4 | `tests/codex-harness-guard-patch-test.sh` | dedicated test가 attribution 미제거로 실패 | - |
| 2 | cache-only 정규화 구현 | AC-1~4 | `patch-codex-harness-guard.mjs` | dedicated test 통과 | #1 |
| 3 | parity 기록·버전 갱신 | AC-1, AC-2 | docs, manifest, README | Codex 회귀 + CI quality | #2 |

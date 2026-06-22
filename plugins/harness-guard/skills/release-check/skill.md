---
name: release-check
description: 릴리즈 사전 검증 — 품질·보안·DB 마이그레이션을 병렬 검증. /release의 전제 조건
disable-model-invocation: true
effort: max
---

# /release-check — 릴리즈 사전 검증

**사용법**: `/release-check`
develop 브랜치에서 실행한다. **전 항목 ✅여야 `/release` 진행 가능.**

> 빌드·테스트 명령은 **repo의 AGENTS.md "빌드·테스트 명령" 섹션**에서 읽는다.

---

## Phase 0 — 준비 (오케스트레이터 직접 실행)

```bash
git checkout develop && git pull origin develop
git status --short   # 미커밋 변경 있으면 중단
```

## Phase 1 — 병렬 검증 (3개 에이전트 동시 spawn)

### Agent A — 품질 (`subagent_type: general-purpose`, `model: sonnet`, `run_in_background: true`)

**프롬프트:**
- AGENTS.md의 품질 검증 명령 전체 실행 (lint + test + build, e2e 있으면 포함)
- 실패 항목은 파일·원인과 함께 리포트, 전부 통과 시 ✅

### Agent B — 보안 (`subagent_type: security-reviewer`, `run_in_background: true`)

`security-reviewer` 에이전트를 spawn한다 (체크리스트는 에이전트 정의에 포함).
검토 대상 디렉토리만 전달한다 — AGENTS.md의 "프로젝트 개요" 섹션(디렉토리 구조) 참조.

### Agent C — DB 마이그레이션·표준 (`subagent_type: general-purpose`, `model: haiku`, `run_in_background: true`)

**프롬프트:**
- 마이그레이션 디렉토리에서 마지막 릴리즈 태그 이후 추가된 파일 확인
- **적용된 마이그레이션 수정 금지 점검**: 기존(이전 릴리즈에 포함된) 마이그레이션 파일이 수정됐는지
  `git diff <마지막태그>..HEAD -- <마이그레이션 경로>` 로 확인 — 수정 발견 시 ❌
- **forward-only 위반 점검**: 신규 마이그레이션에 down/rollback 스크립트가 포함됐는지 — 포함 시 ❌
  (`db-standards.md`: 되돌릴 때도 새 forward 버전 추가)
- 신규 마이그레이션의 무중단 호환 위반(컬럼 즉시 삭제/rename, 비-CONCURRENTLY 대용량 인덱스) 점검
- 금액 컬럼 float 사용 등 DB 표준 위반 스캔

## Phase 2 — 종합 판정 (오케스트레이터 직접 실행)

세 에이전트 결과를 표로 종합:

```
| 항목 | 결과 | 비고 |
|---|---|---|
| A 품질 (lint·test·build) | ✅/❌ | |
| B 보안 | ✅/❌ | |
| C 마이그레이션·DB 표준 | ✅/❌ | |
```

- 전부 ✅ → **"release-check 통과 — /release <version> 진행 가능"** 출력
- 하나라도 ❌ → 실패 항목·원인·수정 방향을 리포트하고 **중단** (수정 후 재실행)

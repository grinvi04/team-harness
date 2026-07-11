---
name: release-check
description: 릴리즈 사전 검증 — 품질·보안·DB 마이그레이션을 병렬 검증. /release의 전제 조건
effort: max
---

# /release-check — 릴리즈 사전 검증

## Codex 실행

Claude named agent와 `subagent_type` 표기는 Claude 경로용 역할 경계다. Codex에서는 품질·DB 검증 근거를
`harness-explorer` (`부모 모델 상속`, low), 보안 반증을 `harness-security-reviewer` (`부모 모델 상속`, high),
종합 반증을 `harness-verifier` (`부모 모델 상속`, high) read-only subagent에 위임할 수 있다. Codex Security 평가는
#264의 별도 coverage이며 이 skill의 보안 검토를 침묵 대체하거나 생략하지 않는다.

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
- **배포 env 변수명 ↔ 코드 참조명 대조**: 코드가 실제로 읽는 환경변수 키(예: 프론트가
  `process.env.KEYCLOAK_ISSUER`를 읽음)와 배포 설정/문서(`docs/deployment.md`·`railway.json`·
  `vercel` env·`.env.example`)가 안내하는 키 목록이 **일치하는지** 대조한다. 불일치(예: 코드는
  `KEYCLOAK_ISSUER`인데 문서는 `AUTH_KEYCLOAK_ISSUER`로 안내)는 배포 시 런타임에서야 터지는
  로그인·연동 깨짐 클래스 → ❌로 리포트.
- **아키텍처 SVG 신선도 점검**: `docs/gen_arch_svg.py`가 존재하면
  `docs/architecture.svg`의 수정시각 ≥ `docs/gen_arch_svg.py`의 수정시각인지 확인
  (`python3 -c "import os; s=os.stat; g=s('docs/gen_arch_svg.py').st_mtime; a=s('docs/architecture.svg').st_mtime; exit(0 if a>=g else 1)"`).
  SVG가 스크립트보다 오래됐으면 ❌ (재생성 필요 — `python3 docs/gen_arch_svg.py` 실행 후 커밋).
  `docs/gen_arch_svg.py` 자체가 없으면 이 항목은 SKIP.
- 실패 항목은 파일·원인과 함께 리포트, 전부 통과 시 ✅

### Agent B — 보안 (`subagent_type: security-reviewer`, `run_in_background: true`)

`security-reviewer` 에이전트를 spawn한다 (체크리스트는 에이전트 정의에 포함).
검토 대상 디렉토리만 전달한다 — AGENTS.md의 "프로젝트 개요" 섹션(디렉토리 구조) 참조.

### Agent C — DB 마이그레이션·표준 (`subagent_type: general-purpose`, `model: sonnet`, `run_in_background: true`)

**프롬프트:**
- 마이그레이션 디렉토리에서 마지막 릴리즈 태그 이후 추가된 파일 확인
- **out-of-order 안전성 점검**: `node scripts/check-migration-safety.mjs` 실행(있으면) —
  접두사 번호 대역인데 out-of-order 허용이 없으면 ❌. 스크립트가 없으면 동등 점검:
  ① 대역 번호 규약 여부 ② out-of-order: true 설정 여부 ③ **기존 DB 증분 적용 관점**(빈 DB CI 통과 ≠ 운영 안전)
- **적용된 마이그레이션 수정 금지 점검**: 기존(이전 릴리즈에 포함된) 마이그레이션 파일이 수정됐는지
  `git diff <마지막태그>..HEAD -- <마이그레이션 경로>` 로 확인 — 수정 발견 시 ❌
- **forward-only 위반 점검(Flyway 전용)**: Flyway에서 신규 마이그레이션에 **undo 스크립트(`U{n}__.sql`)**가
  포함됐는지 — 포함 시 ❌ (`db-standards.md`: Flyway는 되돌릴 때도 새 forward 버전 추가, 별도 undo 파일 금지).
  **Alembic은 대상 아님** — `revision --autogenerate`가 생성하는 인라인 `downgrade()`는 정상 구조이며,
  금지되는 것은 `alembic downgrade base`(전체 삭제)뿐이다(`templates/rules/stacks/alembic.md`).
- **소프트삭제 제외 테스트 점검**: 신규 소프트삭제 엔티티/모델에 **삭제 후 목록 제외 테스트**가 있는지 —
  없으면 ❌ (`db-standards.md`: 필터가 하위 타입에 미상속될 수 있어 엔티티별 검증 필수)
- **하드삭제 신규 도입 점검**: 물리 삭제(`DELETE`·`hard delete`·물리 제거 쿼리) 신규 도입 여부 — 발견 시 사유 확인·리포트
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

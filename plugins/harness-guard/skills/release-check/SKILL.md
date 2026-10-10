---
name: release-check
description: 정식 릴리즈 직전에 품질·보안·DB 마이그레이션 준비를 검증할 때 사용. 실제 태그·배포·기능 PR 검증·버그 구현은 제외
---

# /release-check — 릴리즈 사전 검증

**사용법**: `/release-check`
develop 브랜치에서 실행한다. **필수 항목 통과와 아래 종합 판정의 정당한 SKIP 조건을 모두 확인해야 `/release` 진행 가능.**

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
- 먼저 `docs/db-standards.md`와 채택한 도구의 stack rule·프로젝트 규약을 읽는다.
  실제 DB·마이그레이션이 없으면 관련 항목만 사유와 함께 SKIP한다. 테스트 fixture를 운영 대상으로 세지 않는다.
- 마지막 릴리즈 이후 마이그레이션 변경을 확인한다. 이전 태그에 있다는 사실만으로 적용됐다고 가정하지 않는다.
  공유·운영 환경에 적용한 파일은 수정하지 않고 새 변경으로 보정한다. 적용 이력이 미확인이면 미확인으로 보고한다.
- **적용 순서 점검**: 연결된 `check-migration-safety.mjs`가 있으면 실행하고 기존 실패 기준을 유지한다.
  대역 번호로 판단한 Flyway 경로는 out-of-order 미설정/false를 거부한다.
  검사 결과와 실제 SQL 순서 독립성은 구분한다. 실제 단조·timestamp 규약은 지원 선언과 근거를 확인한다.
  검사기가 없으면 채택한 도구의 순서·분기 규약으로 동등하게 확인한다.
  빈 DB 전체 적용과 기존 상태의 증분 적용을 승인된 격리 DB에서 비교한다.
- **되돌리기 점검**: Flyway undo 파일의 존재만으로 공통 표준 위반을 판정하지 않는다.
  프로젝트가 채택한 forward-only 정책, 지원 버전·기능, 복구 가능성·데이터 영향·승인 범위를 확인한다.
  정책 위반이나 승인 없는 파괴적 실행 계획은 ❌로 보고한다. 운영 downgrade를 자동 복구 명령으로 실행하지 않는다.
  Alembic의 생성된 `downgrade()` 본문은 정상 구조지만 실행 허용이나 안전 보장이 아니다.
  `alembic downgrade base`처럼 전체 이력을 되돌리는 계획도 실제 역방향 변경과 위의 조건으로 판단한다.
- **파괴 DDL 점검**: 연결된 SQL·Alembic·ActiveRecord 정적 게이트의 차단 기준과 승인 마커 범위를 유지한다.
  downgrade/def down이 정적 검사에서 제외됐다는 사실은 실행 권한이 아니다. 마커도 운영 권한을 만들지 않는다.
  무중단 배포가 필요한 프로젝트는 확장·이관·검증·구버전 종료·제거의 호환성과 잠금 위험을 확인한다.
- **삭제 정책 점검**: 물리 삭제·비활성화·소프트 삭제는 보존·복구·참조 무결성·파기 요구로 선택한다.
  소프트 삭제를 채택했으면 목록·단건·집계·수정·직접 SQL의 제외 정책과 복원·UNIQUE 제약을 검증한다.
  상위 필터 선언이나 목록 테스트만으로 모든 경로가 안전하다고 판단하지 않는다.
  새 물리 삭제는 사유·권한·참조 영향이 프로젝트의 선택과 일치하는지 확인한다.
- **금액 계약 점검**: 정확한 값이 필요한 금액의 정밀도·범위·통화·단위와 반올림 정책을 확인한다.
  부동소수 변환으로 값이 손실되지 않는지 실제 DB·직렬화·지원 클라이언트·재전송 경계에서 대조한다.
  컬럼 선언이나 숫자 표본만으로 전체 경계를 검증했다고 보고하지 않는다.

## Phase 2 — 외부 파일럿 live provenance (오케스트레이터 직접 실행)

`docs/pilots/external-pilot-provenance.json`이 있으면 아래 명령을 **`--offline` 없이** 실행한다.

```bash
node scripts/check-external-pilot-provenance.mjs --manifest docs/pilots/external-pilot-provenance.json
```

- manifest가 없으면 이 항목만 SKIP한다.
- manifest가 있는데 verifier가 없거나 non-zero이면 provenance 검증 실패를 **NO-GO**로 판정하고 중단한다.
- network·rate limit·permission 실패를 SKIP, cache, 이전 성공 결과로 대체하지 않는다.

## Phase 3 — 종합 판정 (오케스트레이터 직접 실행)

세 에이전트 결과를 표로 종합:

```
| 항목 | 결과 | 비고 |
|---|---|---|
| A 품질 (lint·test·build) | ✅/❌ | |
| B 보안 | ✅/❌ | |
| C 마이그레이션·DB 표준 | ✅/❌/SKIP | 모든 항목이 실제 비적용일 때만 전체 SKIP |
| D 외부 파일럿 live provenance | ✅/❌/SKIP | manifest가 없을 때만 SKIP |
```

- A·B가 ✅이고 C·D가 ✅ 또는 정당한 SKIP → **"release-check 통과 — /release <version> 진행 가능"** 출력
- C의 전체 SKIP은 실제 DB·마이그레이션과 검토할 DB 계약이 모두 없을 때만 허용하고 사유를 기록한다.
  일부만 비적용이면 나머지 항목을 판정한다. 적용 이력 미확인·검사 미실행·환경 실패는 SKIP이 아니며 통과를 막는다.
- 하나라도 ❌ → 실패 항목·원인·수정 방향을 리포트하고 **중단** (수정 후 재실행)

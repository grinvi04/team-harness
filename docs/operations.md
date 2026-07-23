# 운영 표준 — 장애 대응·로깅·릴리즈

서비스 오픈 시점에 활성화하는 문서. 단, **로깅 실무(§3)는 첫 코드부터 적용**한다 —
오픈 후에 로그 체계를 고치는 비용이 가장 크다.

---

## 1. 장애 대응

### 장애 등급

| 등급 | 정의 | 초동 대응 | 예 |
|---|---|---|---|
| **SEV1** | 전사 업무 중단, 데이터 손상·유출 | 즉시, 전원 가용 인력 | 로그인 전면 불가, 전표 데이터 오염 |
| **SEV2** | 핵심 기능 장애 (우회로 존재) | 1시간 내 | 발주 승인 불가(전화로 우회 가능) |
| **SEV3** | 부분 기능·성능 저하 | 1영업일 내 | 특정 리포트 느림 |

판단이 애매하면 **한 등급 위로** 선언하고 나중에 낮춘다.

### 대응 절차

1. **감지**: Sentry·CloudWatch 알람 → Slack `#incident` (사람 신고도 같은 채널로 일원화)
2. **선언**: 발견자가 등급 선언 + 스레드 생성. SEV1/2는 리드 즉시 호출
3. **역할 분리** (SEV1/2): **지휘자(IC)** 1명 — 전파·의사결정·타임라인 기록 전담, 조치는 하지 않는다 /
   **조치자** — 복구 작업 전담. 소규모 팀에서도 이 분리가 핵심: 조치하는 사람이 보고까지 하면 둘 다 망한다
4. **복구 우선, 원인 분석은 나중**: 우선순위는 ① **롤백** (GitOps revert — `architecture-infra.md` §3,
   git revert가 곧 배포 롤백) → ② 픽스포워드 (`/hotfix` 커맨드). 원인을 모르겠으면 무조건 롤백 먼저
5. **수동 조치 예외**: "운영 직접 조작 금지" 원칙은 장애 중 일시 해제 가능 — 단 모든 수동 조치를
   스레드에 기록하고, 종료 후 IaC/마이그레이션에 반영해 드리프트 제거
6. **종료 선언**: IC가 복구 확인 후 채널에 명시적 종료 + 영향 범위 1차 공유

### 포스트모템 (SEV1/2 필수, 5영업일 내)

**Blameless 원칙** — 사람의 실수는 시스템(가드·절차·도구)의 결함으로 기술한다.
"왜 A가 실수했나"가 아니라 "왜 시스템이 그 실수를 허용했나".

템플릿: 요약(영향 범위·지속 시간) / 타임라인(감지~복구) / 근본 원인(5 whys) /
잘된 점·운이 좋았던 점 / **재발 방지 액션** — 반드시 GitHub 이슈화 + 담당 + 기한
(액션 없는 포스트모템은 작성하지 않은 것과 같다)

### 시크릿 유출 대응 런북

> **감지·차단은 이미 계층으로 존재**한다 — gitleaks(CI `ci-gate.yml` secret-scan 잡)·guard 명령 마스킹·
> PreToolUse 유출 탐지 프롬프트·release 전 `security-reviewer`·`.gitignore`(.env/*.key/*.pem), 저장 표준은
> `auth-standards.md`(AWS Secrets Manager/SSM — 코드·.env 금지). 이 런북은 그 계층이 **뚫린 뒤의 대응**만
> 다룬다(중복 서술 안 함 — 참조). 시크릿 유출은 **SEV1(데이터 유출)로 선언**하고 §1 대응 절차(IC/조치자 분리)를
> 따르되, 아래 시크릿 특유 단계를 얹는다.

**핵심 원칙 — 폐기가 히스토리 정리보다 우선.** 시크릿은 커밋된 순간 이미 공개다(clone·fork·CI 로그·캐시로
확산 — 되돌릴 수 없음). 그래서 **값을 죽이는 폐기가 1순위**, 히스토리 purge는 2차다(비가역성 원칙: 못 되돌릴
확산을 전제로 손실을 줄인다).

1. **폐기·회전 (즉시, 1순위)** — 유출된 크레덴셜을 **무효화**한다. 무엇을 지웠는지가 아니라 그 값이 아직
   유효한지가 위험의 크기다.
   - GitHub 토큰/PAT → 즉시 revoke (Settings→Developer settings / org 감사 로그로 사용 흔적 확인)
   - AWS 키 → IAM에서 비활성화 후 삭제, Secrets Manager 값은 rotate
   - DB 비밀번호·커넥션 문자열 → 회전 + 노출 계정 권한 축소
   - 서드파티 API 키 → 발급처 콘솔에서 폐기·재발급
   - 회전한 새 값의 저장 위치 = `auth-standards.md`(Secrets Manager/SSM — 코드·.env 재유입 금지)
2. **영향 범위 산정** — 무엇이·언제부터·어디까지 노출됐나:
   - gitleaks 리포트(`ci-gate.yml`)와 `git log -p`로 노출 커밋·기간을 특정
   - **public repo였나**(fork·clone·검색 인덱싱 가능성 ↑) vs private였나
   - 그 크레덴셜로 접근 가능한 자원(DB·버킷·결제)의 **실제 접근 로그**를 확인 — 오남용이 이미 일어났는지
3. **히스토리 purge (2차 — 폐기 이후에만)**:
   - `git filter-repo`(권장) 또는 BFG로 해당 파일·문자열 제거 후 force-push
   - ⚠️ **이미 clone/fork/캐시된 사본은 못 지운다** — purge는 노출 축소일 뿐 **폐기를 대체하지 않는다**.
     public이었으면 GitHub 지원에 캐시 무효화를 요청한다
   - main/develop force-push는 branch protection이 막으므로 사람이 직접(break-glass·`solo-merge` 경유)
4. **통지** — SEV1 선언 후:
   - `#incident` 스레드 + 리드 호출(§1의 IC/조치자 분리 적용 — 조치자가 폐기, IC가 전파)
   - 크레덴셜 소유 서드파티·영향받는 팀에 통지. 개인정보가 연루되면 고지 의무(법적 요건)를 확인
5. **포스트모템 (SEV1 필수, blameless)** — §1 포스트모템 템플릿 + 시크릿 특유 질문:
   - **왜 감지·차단 계층이 못 막았나** — gitleaks가 놓친 패턴? 로컬 커밋이 훅을 우회? `.gitignore` 누락?
     PreToolUse 프롬프트 사각? (사람 탓 아니라 계층의 구멍으로 기술)
   - 재발 방지 = 그 계층 강화(gitleaks 룰·`.gitignore` 패턴·guard 마스킹)로 GitHub 이슈화 + 담당 + 기한

## 2. 온콜 (서비스 오픈 후)

- 주 단위 로테이션 1명 (SEV 판단·초동 대응 책임), 백업 1명 지정
- 온콜은 야간 작업 의무가 아니다 — SEV1만 즉시, 나머지는 업무 시간
- 알람 정책: **알람 = 사람이 조치해야 하는 것만.** 조치 불가능한 알람은 만들지 않고,
  무시되는 알람은 즉시 제거 (알람 피로가 진짜 장애를 묻는다)

## 3. 로깅 실무 (첫 코드부터 적용)

### 레벨 기준 — "ERROR는 곧 알람이다"

| 레벨 | 기준 | 예 |
|---|---|---|
| `ERROR` | **사람의 조치가 필요한 실패** — 알람 연동 전제, 남발 금지 | 결제 연동 실패, 미처리 예외 |
| `WARN` | 잠재 문제·자동 복구된 이상 | 재시도 후 성공, 응답 지연 임계 초과 |
| `INFO` | 업무 이벤트·상태 전이 | 전표 생성/승인, 배치 시작·종료(건수 포함) |
| `DEBUG` | 개발 진단용 — **운영 기본 off** | 쿼리 파라미터, 분기 추적 |

- 사용자 입력 오류(검증 실패 400)는 ERROR가 아니다 — INFO/WARN
- 루프 내부 INFO 금지 (배치는 시작·종료·집계만)

### 구조화 필드 표준 (JSON — `stack-guide.md` 로깅 설정 전제)

```json
{
  "timestamp": "...", "level": "INFO", "service": "order",
  "traceId": "4bf92f35...", "userId": 123,
  "event": "ORDER_APPROVED", "message": "주문 승인",
  "orderId": 456
}
```

- 업무 이벤트는 `event` 코드(SCREAMING_SNAKE)를 붙인다 — 메시지 문자열 검색이 아니라 코드로 집계
- **개인정보·시크릿 출력 금지** (`auth-standards.md`) — 마스킹 유틸 공통 제공

### Trace ID 전파

- 표준: **W3C Trace Context** (`traceparent` 헤더) — 서비스 간 호출 시 자동 전파 (미니서비스 대비)
- 모든 로그에 자동 포함 (Java: MDC + 필터, NestJS: AsyncLocalStorage 미들웨어)
- **응답 헤더로도 반환** (`X-Trace-Id`) → 사용자 문의·프론트 에러 리포트에서 역추적 가능
- 프론트 Sentry 이벤트에도 같은 traceId 첨부 — 화면 에러 ↔ 서버 로그 연결

### 보존

- 앱 로그: CloudWatch 90일 (비용·조회 균형) — 그 이상의 "기록" 수요는 로그가 아니라
  DB 감사 테이블의 몫 (`db-standards.md` §감사)
- 감사성 접근 기록(CloudTrail 등): 1년+

### 하네스 자체 감사 로그

위는 **앱**의 로깅. 하네스(harness-guard)도 게이트 결정을 로컬 로그로 남긴다 — 실측·감사용:

| 로그 | 위치 | 내용 |
|---|---|---|
| 가드 차단 | `~/.claude/hooks/guard-block.log` | deny된 명령·사유·session·cwd (시크릿 마스킹) |
| Codex 가드 차단 | `~/.codex/hooks/guard-block.log` | Codex wrapper에서 deny된 명령·사유·session·cwd (Claude 로그와 격리) |
| 모델 티어링 | `~/.claude/hooks/subagent-model.log` | 서브에이전트 타입별 force/skip 모델 결정 |

- **읽는 법**: `grep 'cwd=.*/erp' ~/.claude/hooks/subagent-model.log`(특정 repo 스폰 모델 감사) · `grep DENY ~/.claude/hooks/guard-block.log`(차단 이력).
- **VCS 밖**: 머신 로컬 런타임 데이터(cwd·명령 히스토리 포함)라 **repo에 커밋하지 않는다** — 소스(훅)만 versioned. 팀 집계가 필요하면 로컬 커밋이 아니라 중앙 스토어로 ship.
- **로테이션**: 256KB 초과 시 훅이 최근 절반만 보존(무한 증가 방지).

## 4. 릴리즈·버전 정책

- **SemVer** `vMAJOR.MINOR.PATCH` — MINOR: 기능 릴리즈 / PATCH: hotfix (플러그인 `/release`·`/hotfix`
  커맨드가 태그까지 수행)
- **CHANGELOG 자동 생성**: Conventional Commits 기반 (`node scripts/generate-changelog.mjs`) — 수기 작성 금지.
  `feat`/`fix`만 노출, 커밋 메시지 품질이 곧 릴리즈 노트 품질 (`code-review.md`).
  정식 태그 전에는 `node scripts/generate-changelog.mjs --release vX.Y.Z`로 현재 `HEAD`의 release
  candidate를 생성하며, `/release` Phase 1에서 이 결과를 커밋한다.
- **두 종류의 릴리즈 노트**: 개발용 = CHANGELOG / **사용자 공지용** = 업무 영향 중심 한국어 별도 작성
  ("주문 화면에서 ~가 가능해집니다") — 기술 용어 금지
- 배포 공지: Slack 채널에 배포 전·후 자동 알림 (CI), DB 마이그레이션 포함 배포는 사전 공지
- 점검(다운타임) 필요 시: 최소 1영업일 전 공지 + 업무 시간 회피

## 5. 정기 운영 루틴

| 주기 | 작업 |
|---|---|
| 주간 | Sentry 신규 에러 triage (방치 = 알람 피로), 온콜 인수인계 |
| 월간 | 의존성 업데이트 PR(Dependabot) 처리, 보안 패치 |
| 분기 | 백업 복구 리허설 (`architecture-infra.md` §5 백업·DR), 미사용 알람·대시보드 정리, 비용 리뷰 |

## 6. 배포 검증·헬스체크

> **`/release` Phase 0(스테이징)·Phase 5(운영)가 이 절차를 따른다.** 명령·URL은 각 repo의
> `AGENTS.md`에서 읽으므로, **모든 배포 대상 repo는 AGENTS.md에 실제 도메인·헬스 엔드포인트를
> 명시**한다(플레이스홀더 `<...>` 금지 — 정의 없으면 Phase 5가 못 돈다).

### 원칙: liveness ≠ freshness
- **`curl 200`은 "구버전이 떠 있다"만 증명한다.** 방금 릴리즈한 코드가 실제로 배포됐는지는 별개다.
  (실사례: main 머지 후에도 운영은 16일 전 구버전을 200으로 응답 — 자동배포가 리소스 한도로 멈춰 있었음.)
- 그래서 **3층으로 검증**한다: ① 엔드포인트 liveness(curl) ② **배포 신선도**(플랫폼 CLI — 최신 배포가
  릴리즈 커밋/시각과 일치하는가) ③ DB 가용성. 그리고 ④ **배포가 안 됐으면 계정 리소스/쿼터를 의심**한다.

### 층별 검증 (CLI)
| 층 | 도구 | 확인 |
|---|---|---|
| 엔드포인트 | `curl -sf <repo AGENTS.md의 prod 헬스 URL>` | HTTP 200 |
| 배포 신선도 | `railway deployment list`(최신 SUCCESS의 commit·시각이 방금 릴리즈와 일치) / `vercel ls <project>`(최신 프로덕션 배포 READY·시각) | 릴리즈 = 배포 일치 |
| DB | `neonctl branches list --project-id <id>` | 브랜치 `ready` |
| 리소스/쿼터 | 배포 실패·정체 시 `railway up`/대시보드 | "used all your available resources" = 계정 한도 → 플랜·정리 필요 |

### 운용 규칙
- **릴리즈 직후**: 엔드포인트 200 + 배포 신선도(최신 배포 커밋 = 릴리즈 커밋)를 **함께** 확인. 200만 보고 "정상"이라 판단하지 않는다.
- **배포 env 키 대조**: 코드가 읽는 환경변수 키와 배포 플랫폼(Railway/Vercel)의 변수 목록·배포 문서가 일치하는지 릴리즈 전 대조한다 — 키 이름이 어긋나면(예: 코드 `KEYCLOAK_ISSUER` ↔ 문서 `AUTH_KEYCLOAK_ISSUER`) liveness는 200이어도 로그인·연동이 런타임에 깨진다(release-check가 이 대조를 강제).
- **자동배포(GitHub 연동)가 안 걸릴 때 점검 순서**: ① 서비스의 연결 브랜치(staging→develop, prod→main) ② 계정 리소스/크레딧 한도 ③ GitHub 앱/웹훅 연결. 대개 ②가 흔하다(배포가 *어느 날부터 일제히* 멈췄으면 한도 의심).
- AI는 **운영 배포를 임의 트리거하지 않는다**(ai-collaboration.md 금지 사항 · AGENTS.md "운영(prod) 환경 직접 조작 금지"). `railway up` 등은 사람 확인 후.
